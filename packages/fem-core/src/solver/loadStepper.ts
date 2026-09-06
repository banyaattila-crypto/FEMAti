/**
 * Adaptív teherlépcsőzés (Diplomaterv 3.2.1 "egyparaméteres terhelés" +
 * MASTER-PROMPT-TERV 1.8 "Modern kiegészítések").
 *
 * Minden lépés egy `runNewtonRaphsonStep` hívás a `[λ, λ+Δλ]` tehernövekményre:
 *  - konvergál → a lépés elfogadva, `λ ← λ+Δλ`; ha kevés iteráció kellett
 *    (`iter < iterMin`), a KÖVETKEZŐ lépés `Δλ`-ja nő (max. `Δλ_max`-ig);
 *  - NEM konvergál (`iter > iterMax`) → `Δλ` FELEZŐDIK, a lépés ELVETVE.
 *
 * **A visszaállítás automatikusan TELJES**: a `runNewtonRaphsonStep` funkcionális
 * (bemenetét sosem módosítja, mindig ÚJ `u`/állapot-térképet ad vissza) —
 * ezért egy elvetett (nem konvergált) próbálkozás után a hívó egyszerűen NEM
 * fogadja el a visszaadott `u`/`states`-t, és a következő próbálkozás a
 * VÁLTOZATLAN (a lépés eleji, utoljára konvergált) `u`/`states`-ből indul —
 * minden Gauss-pont MINDEN rétegének állapota automatikusan, bookkeeping
 * nélkül visszaáll, mert sosem lett felülírva.
 *
 * Ha `Δλ` a `minStepFraction·targetLambda` alá esne, a teher-vezérelt eljárás
 * DEFINÍCIÓ SZERINT nem tud tovább haladni — ez a HATÁRTEHER közelségének
 * fizikai jele (MASTER-PROMPT-TERV 1.8, "FIGYELEM"), NEM szoftverhiba. Ezt a
 * `'limit-load-reached'` státusz jelzi, nem általános hiba.
 */
import { validateModel, isRunnable, type Diagnostic } from '../model/validate.js';
import { assemble, type AssembledSystem } from '../assembly/assembler.js';
import { buildLoadVector, unsupportedLoads } from '../assembly/loadVector.js';
import type { Model } from '../model/types.js';
import { elementMaterialData, initialNonlinearState, type ElementMaterialData, type NonlinearStateMap } from './materialState.js';
import { runNewtonRaphsonStep, type NewtonIterationLog, type NonlinearAlgorithm } from './newtonRaphson.js';

export type LoadStepperStatus = 'converged' | 'limit-load-reached' | 'aborted';

export interface LoadStepRecord {
  readonly lambda: number;
  readonly accepted: boolean;
  readonly deltaLambda: number;
  readonly u: Float64Array;
  readonly states: NonlinearStateMap;
  readonly iterations: readonly NewtonIterationLog[];
}

export interface LoadStepperResult {
  readonly status: LoadStepperStatus;
  readonly system: AssembledSystem;
  /** Az ELFOGADOTT (konvergált) lépések, terhelési sorrendben. */
  readonly steps: readonly LoadStepRecord[];
  /** Az ELVETETT (nem konvergált, felezést kiváltó) próbálkozások is — diagnosztikához. */
  readonly rejectedAttempts: readonly LoadStepRecord[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface LoadStepperOptions {
  readonly algorithm: NonlinearAlgorithm;
  readonly iterMax: number;
  /** Ha egy lépés ennél kevesebb iterációval konvergál, a KÖVETKEZŐ lépés Δλ-ja nő. */
  readonly iterMin: number;
  readonly tolerancePercent: number;
  /** A végső teherszorzó, amit a lépcsőzés célul tűz ki. Alapértelmezés: 1. */
  readonly targetLambda?: number;
  /** A KEZDETI lépések száma (ebből számol Δλ₀ = targetLambda/initialSteps). */
  readonly initialSteps?: number;
  /** A Δλ felső korlátja (alapértelmezés: 4·Δλ₀). */
  readonly deltaLambdaMax?: number;
  /** Δλ ez alá a `targetLambda` hányada alá HALADÁS ESETÉN a szerkezet a határteherhez ért. */
  readonly minStepFraction?: number;
  readonly signal?: AbortSignal;
  readonly onProgress?: (record: LoadStepRecord) => void;
}

const DEFAULT_INITIAL_STEPS = 10;
const DEFAULT_MIN_STEP_FRACTION = 1 / 1024;
/** Biztonsági kör-limit — ha ennyi próbálkozás után sincs sem konvergencia, sem határteher-jel, megállunk. */
const MAX_STEP_ATTEMPTS = 500;

/** A modell nem futtatható a nemlineáris megoldóval. */
export class NonlinearModelError extends Error {
  override readonly name = 'NonlinearModelError';
  constructor(message: string) {
    super(message);
  }
}

function assertSupportedScope(model: Model): void {
  const notSupported = unsupportedLoads(model);
  const withoutThermal = notSupported.filter((l) => l.kind !== 'thermal');
  if (withoutThermal.length > 0) {
    const kinds = [...new Set(withoutThermal.map((l) => l.kind))].join(', ');
    throw new NonlinearModelError(`A nemlineáris megoldó (P11) NEM támogatja a következő tehertípusokat: ${kinds}.`);
  }
  if (model.loads.some((l) => l.kind === 'thermal')) {
    throw new NonlinearModelError(
      'A nemlineáris megoldó (P11) jelenlegi hatóköre NEM tartalmazza a hőteher és a ' +
        'rugalmas-képlékeny anyagmodell együttes kezelését (κ0 eltolás a folyási feltételben) — ' +
        'ez egy dokumentált, jövőbeli kiterjesztési pont.',
    );
  }
  for (const load of model.loads) {
    if (load.kind !== 'support-displacement') continue;
    if ((load.dz !== undefined && (load.dz as number) !== 0) || (load.dPhi !== undefined && (load.dPhi as number) !== 0)) {
      throw new NonlinearModelError(
        'A nemlineáris megoldó (P11) jelenlegi hatóköre NEM tartalmazza a nemnulla ' +
          'támaszmozgás és a rugalmas-képlékeny anyagmodell együttes kezelését.',
      );
    }
  }
}

/**
 * Adaptív teherlépcsőzés a `targetLambda` teherszorzóig (Diplomaterv 3.2.1,
 * MASTER-PROMPT-TERV 1.8).
 *
 * @throws NonlinearModelError ha a modell a P11 jelenlegi hatókörén kívül esik
 */
export function runLoadStepper(model: Model, options: LoadStepperOptions): LoadStepperResult {
  const diagnostics = validateModel(model);
  if (!isRunnable(diagnostics)) {
    throw new NonlinearModelError(`A modell nem futtatható, ${diagnostics.filter((d) => d.severity === 'error').length} hiba miatt.`);
  }
  assertSupportedScope(model);

  const system = assemble(model, { strategy: 'elimination' });
  const k0 = system.k;
  k0.factorize();

  const materialData = new Map<string, ElementMaterialData>();
  for (const element of model.elements) {
    materialData.set(element.id as string, elementMaterialData(model, element));
  }
  const initialStates = initialNonlinearState(
    system.elements.map((e) => e.id),
    materialData,
  );

  const targetLambda = options.targetLambda ?? 1;
  const initialSteps = options.initialSteps ?? DEFAULT_INITIAL_STEPS;
  const deltaLambda0 = targetLambda / initialSteps;
  const deltaLambdaMax = options.deltaLambdaMax ?? 4 * deltaLambda0;
  const minStepFraction = options.minStepFraction ?? DEFAULT_MIN_STEP_FRACTION;
  const minDeltaLambda = targetLambda * minStepFraction;

  let lambda = 0;
  let u: Float64Array = new Float64Array(system.map.activeDofs);
  let states = initialStates;
  let deltaLambda = deltaLambda0;

  const steps: LoadStepRecord[] = [];
  const rejectedAttempts: LoadStepRecord[] = [];

  for (let attempt = 0; attempt < MAX_STEP_ATTEMPTS && lambda < targetLambda; attempt++) {
    if (options.signal?.aborted === true) {
      return { status: 'aborted', system, steps, rejectedAttempts, diagnostics };
    }

    const nextLambda = Math.min(targetLambda, lambda + deltaLambda);
    const loads = buildLoadVector(model, system.map, nextLambda);
    const fTarget = new Float64Array(system.map.activeDofs);
    for (let a = 0; a < fTarget.length; a++) {
      fTarget[a] = (loads.active[a] ?? 0) + (system.constraintLoad[a] ?? 0);
    }

    const result = runNewtonRaphsonStep(system, model, materialData, k0, u, states, fTarget, {
      algorithm: options.algorithm,
      iterMax: options.iterMax,
      tolerancePercent: options.tolerancePercent,
    });

    if (result.converged) {
      lambda = nextLambda;
      u = result.u;
      states = result.states;
      const record: LoadStepRecord = {
        lambda,
        accepted: true,
        deltaLambda,
        u,
        states,
        iterations: result.iterations,
      };
      steps.push(record);
      options.onProgress?.(record);

      if (result.iterations.length < options.iterMin) {
        deltaLambda = Math.min(deltaLambdaMax, deltaLambda * 2);
      }
      continue;
    }

    // Nem konvergált — a próbálkozás ELVETVE, u/states VÁLTOZATLAN marad
    // (ld. a fájl fejlécét: a visszaállítás automatikus).
    const rejected: LoadStepRecord = {
      lambda: nextLambda,
      accepted: false,
      deltaLambda,
      u: result.u,
      states: result.states,
      iterations: result.iterations,
    };
    rejectedAttempts.push(rejected);
    options.onProgress?.(rejected);

    deltaLambda /= 2;
    if (deltaLambda < minDeltaLambda) {
      return { status: 'limit-load-reached', system, steps, rejectedAttempts, diagnostics };
    }
  }

  if (lambda >= targetLambda) {
    return { status: 'converged', system, steps, rejectedAttempts, diagnostics };
  }
  return { status: 'limit-load-reached', system, steps, rejectedAttempts, diagnostics };
}
