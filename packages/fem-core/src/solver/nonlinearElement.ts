/**
 * Elemi tangenciális merevségi mátrix és belső erővektor a nemlineáris
 * (rugalmas–képlékeny) megoldóhoz (Diplomaterv 3.4.2.1/3.4.3.2 algoritmus
 * 2. és 5./8. lépése, MASTER-PROMPT-TERV 1.8).
 *
 *   K_T = ∫ Bκᵀ·EI_T·Bκ·|J| dξ  +  ∫ Bγᵀ·GAs·Bγ·|J| dξ     (2. lépés)
 *   p   = ∫ Bκᵀ·M·|J| dξ        +  ∫ Bγᵀ·T·|J| dξ           (3.60), 68. oldal
 *
 * A hajlítási tag Gauss-pontonkénti tangens `EI_T`-vel (ill. `M`-mel) épül a
 * pillanatnyi anyagállapotból (`materialState.ts`); a nyírási tag
 * VÁLTOZATLANUL rugalmas (`GAs` állandó, `T = GAs·γ`) — ld. a P9/P10 modulok
 * fejléce: "a nyírás mindig rugalmas marad".
 */
import { DenseMatrix } from '../linalg/dense.js';
import { DOF_PER_ELEMENT, bRows } from '../element/bMatrix.js';
import { quadratureFor } from '../element/quadrature.js';
import type { IntegrationScheme } from '../model/types.js';
import type { ElementGaussStates } from './materialState.js';

function addOuterProduct(k: DenseMatrix, row: Float64Array, factor: number): void {
  for (let i = 0; i < DOF_PER_ELEMENT; i++) {
    const ri = row[i];
    if (ri === 0) continue;
    for (let j = i; j < DOF_PER_ELEMENT; j++) {
      const v = factor * ri * row[j];
      if (v === 0) continue;
      k.add(i, j, v);
      if (j !== i) k.add(j, i, v);
    }
  }
}

/** A tangenciális merevségi mátrix (6×6) — a Gauss-pontonkénti `tangentEi` felhasználásával. */
export function elementTangentStiffness(
  nodeX: readonly [number, number, number],
  elementId: string,
  gaussStates: ElementGaussStates,
  gas: number,
  scheme: IntegrationScheme = 'selective',
): DenseMatrix {
  const k = new DenseMatrix(DOF_PER_ELEMENT, DOF_PER_ELEMENT);
  const rules = quadratureFor(scheme);

  rules.bending.forEach((gp, i) => {
    const { kappa, detJ } = bRows(nodeX, gp.xi, elementId);
    const tangentEi = gaussStates[i].tangentEi;
    addOuterProduct(k, kappa, tangentEi * detJ * gp.w);
  });

  for (const gp of rules.shear) {
    const { gamma, detJ } = bRows(nodeX, gp.xi, elementId);
    addOuterProduct(k, gamma, gas * detJ * gp.w);
  }

  return k;
}

/** A kiegyensúlyozott csomóponti erővektor (6×1), (3.60), 3 pontos Gauss-integrállal. */
export function elementInternalForceVector(
  nodeX: readonly [number, number, number],
  elementId: string,
  ue: Float64Array,
  gaussStates: ElementGaussStates,
  gas: number,
  scheme: IntegrationScheme = 'selective',
): Float64Array {
  const p = new Float64Array(DOF_PER_ELEMENT);
  const rules = quadratureFor(scheme);

  rules.bending.forEach((gp, i) => {
    const { kappa: row, detJ } = bRows(nodeX, gp.xi, elementId);
    const factor = gaussStates[i].m * detJ * gp.w;
    for (let d = 0; d < DOF_PER_ELEMENT; d++) p[d] += factor * row[d];
  });

  for (const gp of rules.shear) {
    const { gamma: row, detJ } = bRows(nodeX, gp.xi, elementId);
    let gammaTotal = 0;
    for (let d = 0; d < DOF_PER_ELEMENT; d++) gammaTotal += row[d] * ue[d];
    const t = gas * gammaTotal;
    const factor = t * detJ * gp.w;
    for (let d = 0; d < DOF_PER_ELEMENT; d++) p[d] += factor * row[d];
  }

  return p;
}
