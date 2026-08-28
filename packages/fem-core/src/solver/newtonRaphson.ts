/**
 * Egyetlen teherlépcső Newton–Raphson iterációja (Diplomaterv 3.4.2.1/3.4.3.2
 * algoritmus 1–7. lépése, MASTER-PROMPT-TERV 1.8).
 *
 * ```
 * 1) Tehernövekmény:  f ← f + Δf ; i = 0
 * 2) K_T tangenciális merevségi mátrix előállítása
 * 3) Δuᵢ megoldása:   ψᵢ = K_T · Δuᵢ
 * 4) u ← u + Δuᵢ
 * 5) Minden elemre (és rétegre) σ frissítése; belső erők p(e) = ∫Bᵀσ dx;
 *    reziduális erők ψ(e) = p(e) − f(e), globális kompilálás
 * 6) Konvergencia (CONUND): 100·√(Σψᵢ²)/√(Σfᵢ²) ≤ Tolerancia
 * 7) Ha konvergál → kész; különben i ← i+1, ugrás 2)-re
 * ```
 *
 * Ez a modul a fenti hurkot EGYETLEN lépésre futtatja — a lépések közti
 * adaptív tehernövelést/felezést a `loadStepper.ts` végzi.
 *
 * **Algoritmusválasztás** (a diplomaterv "NONAL" modulja):
 *  - `newton`: K_T MINDEN iterációban újraépül a pillanatnyi állapotból.
 *  - `modified-newton`: K_T a lépés ELEJÉN (a lépést megelőző, konvergált
 *    állapotból) épül fel egyszer, és az egész lépés alatt változatlan.
 *  - `initial-stiffness`: mindig a kezdeti (rugalmas) `K₀` — sosem épül újra.
 *
 * A diplomaterv lábjegyzete (10. oldal) kifejezetten felveti a módosított
 * Newton–Raphson gépidő-előnyét: "az iterációnkénti új merevségi mátrix
 * készítése általában több gépidőt vesz igénybe, mintha csak több iterációt
 * hajtanánk végre" — ezt a `loadStepper.ts` szintjén mérjük (P-15).
 */
import { type DenseMatrix, norm2 } from '../linalg/dense.js';
import { SkylineMatrix } from '../linalg/skyline.js';
import { SingularMatrixError } from '../linalg/errors.js';
import { strains } from '../element/bMatrix.js';
import { STRESS_POINTS } from '../element/quadrature.js';
import { foundationMatrix, type AssembledSystem, type PreparedElement } from '../assembly/assembler.js';
import type { IntegrationScheme, Model } from '../model/types.js';
import {
  updateGaussPointState,
  type ElementGaussStates,
  type ElementMaterialData,
  type ElementNonlinearState,
  type GaussPointState,
  type NonlinearStateMap,
} from './materialState.js';
import { elementInternalForceVector, elementTangentStiffness } from './nonlinearElement.js';
import { residualPercent } from './convergence.js';

export type NonlinearAlgorithm = 'newton' | 'modified-newton' | 'initial-stiffness';

export interface NewtonIterationLog {
  readonly iteration: number;
  readonly residualPercent: number;
  /** ‖ψ‖ — a kiegyensúlyozatlansági vektor normája (a 7. pont konvergencia-képletéhez). */
  readonly psiNorm: number;
  /** ‖f‖ — a célteher-vektor normája (a 7. pont konvergencia-képletéhez). */
  readonly fNorm: number;
  /** Az EBBEN az iterációban megoldott Δu normája (0 az elsőnél). */
  readonly displacementIncrementNorm: number;
  readonly yieldedGaussPoints: number;
  readonly elapsedMs: number;
  /** Igaz, ha ebben az iterációban ÚJRA kellett építeni K_T-t (a gépidő-mérés alapja, P-15). */
  readonly stiffnessRebuilt: boolean;
}

export interface NewtonRaphsonStepResult {
  readonly converged: boolean;
  /** Az AKTÍV szabadságfokok elmozdulásvektora a lépés végén (konvergált VAGY az utolsó megkísérelt állapot). */
  readonly u: Float64Array;
  readonly states: NonlinearStateMap;
  readonly iterations: readonly NewtonIterationLog[];
}

export interface NewtonRaphsonOptions {
  readonly algorithm: NonlinearAlgorithm;
  readonly iterMax: number;
  readonly tolerancePercent: number;
}

function gatherElementU(e: PreparedElement, u: Float64Array, ue: Float64Array): void {
  for (let i = 0; i < 6; i++) {
    const a = e.activeDofs[i] ?? -1;
    ue[i] = a >= 0 ? (u[a] ?? 0) : 0;
  }
}

function schemeOf(model: Model, elementId: string): IntegrationScheme {
  return model.elements.find((e) => (e.id as string) === elementId)?.integration ?? 'selective';
}

function countYielded(gp: ElementGaussStates): number {
  let c = 0;
  for (const g of gp) {
    const yielded = g.kind === 'resultant' ? g.state.yielded : g.layers.some((l) => l.yielded);
    if (yielded) c++;
  }
  return c;
}

/** Minden elem állapotának frissítése a JELENLEGI `u`-ból számított teljes κ-ból. */
function updateAllStates(
  system: AssembledSystem,
  materialData: ReadonlyMap<string, ElementMaterialData>,
  states: NonlinearStateMap,
  u: Float64Array,
): NonlinearStateMap {
  const next = new Map<string, ElementNonlinearState>();
  const ue = new Float64Array(6);

  for (const e of system.elements) {
    const data = materialData.get(e.id);
    const prev = states.get(e.id);
    if (data === undefined || prev === undefined) {
      throw new Error(`Hiányzó nemlineáris állapot/anyagadat: "${e.id}".`);
    }
    gatherElementU(e, u, ue);

    const updated = STRESS_POINTS.map((gp, i): GaussPointState => {
      const { kappa } = strains(e.nodeX, ue, gp.xi, e.id);
      const prevGp = prev.gaussPoints[i];
      if (prevGp === undefined) throw new Error(`Hiányzó Gauss-ponti állapot: "${e.id}"[${i}].`);
      return updateGaussPointState(data, prevGp, kappa);
    });
    const [gp0, gp1, gp2] = updated;
    if (gp0 === undefined || gp1 === undefined || gp2 === undefined) {
      throw new Error(`A(z) "${e.id}" elemnek nem pontosan 3 hajlítási Gauss-pontja van.`);
    }
    const gaussPoints: ElementGaussStates = [gp0, gp1, gp2];

    next.set(e.id, { elementId: e.id, gaussPoints });
  }
  return next;
}

/** A teljes szerkezet belső erővektora (aktív szabadságfokokon) a pillanatnyi állapotból. */
function assembleInternalForce(
  system: AssembledSystem,
  model: Model,
  states: NonlinearStateMap,
  u: Float64Array,
): Float64Array {
  const fInt = new Float64Array(system.map.activeDofs);
  const ue = new Float64Array(6);

  for (const e of system.elements) {
    const st = states.get(e.id);
    if (st === undefined) throw new Error(`Hiányzó nemlineáris állapot: "${e.id}".`);
    gatherElementU(e, u, ue);
    const pe = elementInternalForceVector(e.nodeX, e.id, ue, st.gaussPoints, e.stiffness.gas, schemeOf(model, e.id));
    for (let i = 0; i < 6; i++) {
      const a = e.activeDofs[i] ?? -1;
      if (a >= 0) fInt[a] += pe[i] ?? 0;
    }
    if (e.foundationC > 0) {
      const ff = foundationMatrix(e.nodeX, e.foundationC, e.id).multiplyVector(ue);
      for (let i = 0; i < 6; i++) {
        const a = e.activeDofs[i] ?? -1;
        if (a >= 0) fInt[a] += ff[i] ?? 0;
      }
    }
  }

  for (const b of model.boundaries) {
    const i = system.map.nodeIndex.get(b.nodeId as string);
    if (i === undefined) continue;
    const wIndex = system.map.activeIndex[2 * i] ?? -1;
    const phiIndex = system.map.activeIndex[2 * i + 1] ?? -1;
    if (b.springW !== undefined && wIndex >= 0) fInt[wIndex] += (b.springW as number) * (u[wIndex] ?? 0);
    if (b.springPhi !== undefined && phiIndex >= 0) fInt[phiIndex] += (b.springPhi as number) * (u[phiIndex] ?? 0);
  }

  return fInt;
}

/** A tangenciális globális merevségi mátrix a pillanatnyi állapotból (2. lépés). */
function buildTangentMatrix(system: AssembledSystem, model: Model, states: NonlinearStateMap): SkylineMatrix {
  const k = SkylineMatrix.fromConnectivity(
    system.map.activeDofs,
    system.elements.map((e) => e.activeDofs),
  );

  for (const e of system.elements) {
    const st = states.get(e.id);
    if (st === undefined) throw new Error(`Hiányzó nemlineáris állapot: "${e.id}".`);
    const ke: DenseMatrix = elementTangentStiffness(
      e.nodeX,
      e.id,
      st.gaussPoints,
      e.stiffness.gas,
      schemeOf(model, e.id),
    );
    const keEffective =
      e.foundationC > 0 ? ke.clone().addScaled(1, foundationMatrix(e.nodeX, e.foundationC, e.id)) : ke;
    k.addBlock(e.activeDofs, keEffective);
  }

  for (const boundary of model.boundaries) {
    const i = system.map.nodeIndex.get(boundary.nodeId as string);
    if (i === undefined) continue;
    const wIndex = system.map.activeIndex[2 * i] ?? -1;
    const phiIndex = system.map.activeIndex[2 * i + 1] ?? -1;
    if (boundary.springW !== undefined && wIndex >= 0) k.addDiagonal(wIndex, boundary.springW as number);
    if (boundary.springPhi !== undefined && phiIndex >= 0) k.addDiagonal(phiIndex, boundary.springPhi as number);
  }

  return k;
}

/**
 * Egyetlen teherlépcső Newton–Raphson-hurka.
 *
 * @param k0 a kezdeti (rugalmas) merevségi mátrix — `initial-stiffness` módhoz
 * @param uStart az AKTÍV elmozdulásvektor a lépés elején (a korábban konvergált állapot)
 * @param statesStart a nemlineáris állapot a lépés elején
 * @param fTarget a lépés VÉGÉN elérendő teljes (aktív) külső tehervektor
 */
export function runNewtonRaphsonStep(
  system: AssembledSystem,
  model: Model,
  materialData: ReadonlyMap<string, ElementMaterialData>,
  k0: SkylineMatrix,
  uStart: Float64Array,
  statesStart: NonlinearStateMap,
  fTarget: Float64Array,
  options: NewtonRaphsonOptions,
): NewtonRaphsonStepResult {
  let u = Float64Array.from(uStart);
  let states = statesStart;
  const iterations: NewtonIterationLog[] = [];

  let modifiedK: SkylineMatrix | undefined;

  for (let iter = 1; iter <= options.iterMax; iter++) {
    const started = Date.now();

    states = updateAllStates(system, materialData, states, u);
    const fInt = assembleInternalForce(system, model, states, u);
    const psi = new Float64Array(fTarget.length);
    for (let a = 0; a < psi.length; a++) psi[a] = (fTarget[a] ?? 0) - (fInt[a] ?? 0);

    const residPct = residualPercent(psi, fTarget);
    const psiNorm = norm2(psi);
    const fNorm = norm2(fTarget);
    const yielded = [...states.values()].reduce((s, e) => s + countYielded(e.gaussPoints), 0);

    if (residPct <= options.tolerancePercent) {
      iterations.push({
        iteration: iter,
        residualPercent: residPct,
        psiNorm,
        fNorm,
        displacementIncrementNorm: 0,
        yieldedGaussPoints: yielded,
        elapsedMs: Date.now() - started,
        stiffnessRebuilt: false,
      });
      return { converged: true, u, states, iterations };
    }

    if (iter === options.iterMax) {
      iterations.push({
        iteration: iter,
        residualPercent: residPct,
        psiNorm,
        fNorm,
        displacementIncrementNorm: 0,
        yieldedGaussPoints: yielded,
        elapsedMs: Date.now() - started,
        stiffnessRebuilt: false,
      });
      return { converged: false, u, states, iterations };
    }

    let stiffnessRebuilt = false;
    let kt: SkylineMatrix;
    if (options.algorithm === 'initial-stiffness') {
      kt = k0;
    } else if (options.algorithm === 'modified-newton') {
      if (modifiedK === undefined) {
        modifiedK = buildTangentMatrix(system, model, statesStart);
        stiffnessRebuilt = true;
      }
      kt = modifiedK;
    } else {
      kt = buildTangentMatrix(system, model, states);
      stiffnessRebuilt = true;
    }

    // K_T a határteher közelében ELFAJULHAT (szinguláris/majdnem szinguláris
    // pivot) — ez FIZIKAILAG a szerkezet mechanizmussá válásának jele
    // (MASTER-PROMPT-TERV 1.8, "FIGYELEM"), nem szoftverhiba. A hívó
    // (`loadStepper.ts`) ezt egyszerű nem-konvergenciaként kezeli: felezi
    // Δλ-t, és VÁLTOZATLAN (korábban konvergált) állapotból próbálkozik újra.
    let du: Float64Array;
    try {
      du = kt.solve(psi);
    } catch (error) {
      if (error instanceof SingularMatrixError) {
        iterations.push({
          iteration: iter,
          residualPercent: residPct,
          psiNorm,
          fNorm,
          displacementIncrementNorm: Number.POSITIVE_INFINITY,
          yieldedGaussPoints: yielded,
          elapsedMs: Date.now() - started,
          stiffnessRebuilt,
        });
        return { converged: false, u, states, iterations };
      }
      throw error;
    }
    const duNorm = norm2(du);
    const next = new Float64Array(u.length);
    for (let a = 0; a < next.length; a++) next[a] = (u[a] ?? 0) + (du[a] ?? 0);
    u = next;

    iterations.push({
      iteration: iter,
      residualPercent: residPct,
      psiNorm,
      fNorm,
      displacementIncrementNorm: duNorm,
      yieldedGaussPoints: yielded,
      elapsedMs: Date.now() - started,
      stiffnessRebuilt,
    });
  }

  // iterMax === 0 esetén ide sosem jutunk (a ciklus nem fut le) — védelmi ág.
  return { converged: false, u, states, iterations };
}
