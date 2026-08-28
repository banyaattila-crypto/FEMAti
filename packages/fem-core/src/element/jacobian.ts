/**
 * Jacobi-mátrix az izoparametrikus leképezéshez.
 *
 * Diplomaterv (3.7)–(3.9): a lokális → globális leképezés akkor fordítható meg,
 * ha a Jacobi-mátrix az értelmezési tartomány minden pontjában invertálható,
 * vagyis a determinánsa sehol sem zérus.
 *
 * Egyenes gerendaelemnél a Jacobi 1×1-es:
 *   J(ξ) = dx/dξ = Σ (dNᵢ/dξ)·xᵢ
 * Egyenközű csomópontoknál (a középső pontosan a felezőpontban) J = Lₑ/2,
 * és független ξ-től.
 */

import { DegenerateElementError } from '../linalg/errors.js';
import { shapeFunctions } from './shapeFunctions.js';

export interface JacobianValues {
  /** J = dx/dξ */
  readonly j: number;
  /** |J| — az integrálás mértéktényezője */
  readonly detJ: number;
  /** J⁻¹ = dξ/dx (Diplomaterv (3.8)) */
  readonly invJ: number;
  /** A globális x koordináta az adott ξ helyen */
  readonly x: number;
}

/**
 * A Jacobi kiértékelése egy lokális koordinátában.
 *
 * @param nodeX az elem három csomópontjának globális x koordinátája [m],
 *              a [bal, közép, jobb] sorrendben
 * @param xi lokális koordináta
 * @param elementId hibaüzenethez
 * @throws DegenerateElementError ha |J| ≤ 0 — a leképezés nem megfordítható
 */
export function jacobian(
  nodeX: readonly [number, number, number],
  xi: number,
  elementId = '?',
): JacobianValues {
  const { n, dn } = shapeFunctions(xi);

  const j = dn[0] * nodeX[0] + dn[1] * nodeX[1] + dn[2] * nodeX[2];
  const x = n[0] * nodeX[0] + n[1] * nodeX[1] + n[2] * nodeX[2];

  if (!(j > 0) || !Number.isFinite(j)) {
    throw new DegenerateElementError(elementId, j);
  }

  return { j, detJ: j, invJ: 1 / j, x };
}

/**
 * Az alakfüggvények GLOBÁLIS x szerinti deriváltjai a láncszabállyal
 * (Diplomaterv (3.13)):  ∂Nᵢ/∂x = (∂Nᵢ/∂ξ)·(∂ξ/∂x)
 */
export function shapeDerivativesX(
  nodeX: readonly [number, number, number],
  xi: number,
  elementId = '?',
): { readonly dNdx: readonly [number, number, number]; readonly jac: JacobianValues } {
  const jac = jacobian(nodeX, xi, elementId);
  const { dn } = shapeFunctions(xi);
  return {
    dNdx: [dn[0] * jac.invJ, dn[1] * jac.invJ, dn[2] * jac.invJ],
    jac,
  };
}

/** Az elem hossza a szélső csomópontok távolságából. */
export const elementLength = (nodeX: readonly [number, number, number]): number =>
  Math.abs(nodeX[2] - nodeX[0]);
