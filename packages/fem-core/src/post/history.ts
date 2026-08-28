/**
 * Teherlépcsőnkénti állapot-pillanatképek (Diplomaterv 3.2.1: „Terhelés:
 * egyparaméteres").
 *
 * Ez a lineáris fázisban (P6) még egyszerű: mivel a válasz arányos λ-val,
 * minden lépés egy önálló `solveLinear` hívás a megfelelő `scale`-lel. Az
 * infrastruktúra (sűrű, elő-allokált Float64Array-ekben tárolt pillanatképek,
 * NEM objektum-tömbben) viszont már a P9+ nemlineáris teherlépcsőzőnek készül
 * — ott a lépések már NEM lesznek egymástól függetlenül számíthatók.
 */
import { solveLinear, type SolveOptions } from '../solver/linearSolver.js';
import type { Model } from '../model/types.js';

export interface LoadHistoryResult {
  /** A ténylegesen lefuttatott teherszorzók, lépés-sorrendben. */
  readonly lambdas: readonly number[];
  readonly dofCount: number;
  /** Sűrű tárolás: `displacements[lépés·dofCount + dof]`. */
  readonly displacements: Float64Array;
  /** Lépésenkénti szélsőérték, mezőnként külön Float64Array-ben. */
  readonly extremeW: Float64Array;
  readonly extremePhi: Float64Array;
  readonly extremeM: Float64Array;
  readonly extremeT: Float64Array;
}

/** Egy adott lépés elmozdulásvektora — nézet (subarray), másolás nélkül. */
export function displacementsAtStep(history: LoadHistoryResult, step: number): Float64Array {
  const start = step * history.dofCount;
  return history.displacements.subarray(start, start + history.dofCount);
}

/**
 * A modell `history.lambdaTargets` célértékein futtatott lineáris megoldások
 * pillanatképei.
 */
export function computeLoadHistory(model: Model, options: SolveOptions = {}): LoadHistoryResult {
  const lambdas = model.history.lambdaTargets;
  const steps = lambdas.length;

  const extremeW = new Float64Array(steps);
  const extremePhi = new Float64Array(steps);
  const extremeM = new Float64Array(steps);
  const extremeT = new Float64Array(steps);

  let dofCount = 0;
  let displacements = new Float64Array(0);

  for (let s = 0; s < steps; s++) {
    const lambda = lambdas[s] ?? 0;
    const result = solveLinear(model, { ...options, scale: lambda });

    if (s === 0) {
      dofCount = result.dofCount;
      displacements = new Float64Array(steps * dofCount);
    }
    displacements.set(result.displacements, s * dofCount);

    extremeW[s] = result.extremes.w.value;
    extremePhi[s] = result.extremes.phi.value;
    extremeM[s] = result.extremes.m.value;
    extremeT[s] = result.extremes.t.value;
  }

  return { lambdas, dofCount, displacements, extremeW, extremePhi, extremeM, extremeT };
}
