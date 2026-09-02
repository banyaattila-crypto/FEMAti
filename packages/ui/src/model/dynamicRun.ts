/**
 * Dinamikai válasz (tranziens, Newmark-β) — a "dinamika" diagram-fülhöz.
 *
 * A `fem-core` `solveTransient()`-je (ADR-0017) MÁR KÉSZ, tesztelt — ez a
 * fájl csak összeköti a UI-val. A gerjesztés NEM új teher-szerkesztő
 * felület: a modell MEGLÉVŐ statikus teherképét (`buildLoadVector()` —
 * UGYANAZ a függvény, amit a nemlineáris teherlépcsőző használ a
 * λ-skálázáshoz) egy időfüggvénnyel szorozzuk fel. Ez KÖVETKEZETES a
 * nemlineáris λ_cél viselkedésével (az önsúly/hőteher is skálázódik, ha be
 * van kapcsolva — nem új inkonzisztencia).
 *
 * TISZTÁN RUGALMAS elemzés (M, C, K állandó) — a `compileModel()` PARAMETRIKUS
 * útját használja, NEM a rétegeltet (nincs szükség réteg-adatra, nincs
 * képlékenyedés). Szándékosan külön van a nemlineáris (`nonlinear.ts`)
 * teherlépcsőzőtől.
 *
 * v1-korlátok (dokumentálva, ld. terv):
 * - a referencia-csomópont automatikus (legnagyobb |w|), nem választható;
 * - nincs módus-frekvencia-alapú csillapítási arány (ζ) mező, csak nyers α/β
 *   (a kész `rayleighFromModalDamping()` később bekötheti, ha kell);
 * - a beállítások NEM kerülnek a `.femati.json` mentésbe.
 */
import { buildDofMap, buildLoadVector, solveTransient, type Model, type TransientResult } from '@femati/fem-core';
import { compileModel } from './compile.js';
import type { EditableModel } from './editable.js';

export type ExcitationKind = 'step' | 'ramp' | 'harmonic' | 'impulse';

export interface DynamicSettings {
  readonly excitation: ExcitationKind;
  /** Szorzó a meglévő statikus teherképen. */
  readonly amplitude: number;
  /** [Hz] — csak 'harmonic'. */
  readonly frequencyHz: number;
  /** [s] — csak 'ramp'. */
  readonly rampDuration: number;
  /** [s] — csak 'impulse'. */
  readonly impulseDuration: number;
  readonly dampingAlpha: number;
  readonly dampingBeta: number;
  /** Időlépés [s]. */
  readonly dt: number;
  readonly steps: number;
}

export const DEFAULT_DYNAMIC_SETTINGS: DynamicSettings = {
  excitation: 'step',
  amplitude: 1,
  frequencyHz: 5,
  rampDuration: 0.2,
  impulseDuration: 0.05,
  dampingAlpha: 0,
  dampingBeta: 0,
  dt: 0.01,
  steps: 400,
};

/** A gerjesztéstípusnak megfelelő λ(t) szorzófüggvény — a statikus teherkép erre szorzódik minden időpillanatban. */
function excitationShape(settings: DynamicSettings): (t: number) => number {
  switch (settings.excitation) {
    case 'step':
      return () => settings.amplitude;
    case 'ramp':
      return (t) => settings.amplitude * Math.min(1, Math.max(0, t / settings.rampDuration));
    case 'harmonic':
      return (t) => settings.amplitude * Math.sin(2 * Math.PI * settings.frequencyHz * t);
    case 'impulse':
      return (t) => (t <= settings.impulseDuration ? settings.amplitude : 0);
  }
}

export interface DynamicRun {
  readonly model: Model;
  readonly result: TransientResult;
  /** A teljes futás alatt legnagyobb |w|-t elérő csomópont indexe — `model/nonlinear.ts` `referenceNodeIndex`-ének mintájára. */
  readonly referenceNodeIndex: number;
  readonly settings: DynamicSettings;
}

export interface DynamicOutcome {
  readonly run: DynamicRun | null;
  readonly error: string | null;
}

/** A modell tranziens (Newmark-β) futtatása a megadott gerjesztéssel, hibatűrő módon. */
export function runDynamicEditableModel(editable: EditableModel, settings: DynamicSettings): DynamicOutcome {
  try {
    const model = compileModel(editable);
    const map = buildDofMap(model);
    const staticFull = buildLoadVector(model, map, 1).full;
    const shape = excitationShape(settings);

    const result = solveTransient(model, {
      dt: settings.dt,
      steps: settings.steps,
      damping: { alpha: settings.dampingAlpha, beta: settings.dampingBeta },
      force: (t) => {
        const scale = shape(t);
        return staticFull.map((v) => v * scale);
      },
    });

    let referenceNodeIndex = 0;
    let maxAbs = 0;
    for (const step of result.steps) {
      for (let i = 0; i < map.nodeCount; i++) {
        const w = Math.abs(step.displacement[2 * i] ?? 0);
        if (w > maxAbs) {
          maxAbs = w;
          referenceNodeIndex = i;
        }
      }
    }

    return { run: { model, result, referenceNodeIndex, settings }, error: null };
  } catch (error) {
    return { run: null, error: error instanceof Error ? error.message : String(error) };
  }
}
