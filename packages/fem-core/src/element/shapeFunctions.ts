/**
 * Háromcsomópontú kvadratikus Lagrange-bázisfüggvények, C⁰ folytonossággal.
 *
 * Diplomaterv 3.1.4, (3.3) egyenlet — a paraméteres lokális koordináta-rendszer
 * ξ ∈ [−1, 1], a csomópontok ξ = −1, 0, +1 helyen:
 *
 *   N₁(ξ) = ½·ξ·(ξ − 1)
 *   N₂(ξ) = 1 − ξ²
 *   N₃(ξ) = ½·ξ·(ξ + 1)
 *
 * A bázisfüggvények kettős szerepe (Diplomaterv 37–38. oldal):
 *   1. a lokális és globális koordináta-rendszer kapcsolatának leírása (izoparametria),
 *   2. az elmozdulásfüggvények interpolálása a csomóponti értékekből.
 */

/** Egy Gauss-pontban kiértékelt alakfüggvények és ξ szerinti deriváltjaik. */
export interface ShapeValues {
  /** N₁, N₂, N₃ */
  readonly n: readonly [number, number, number];
  /** dN₁/dξ, dN₂/dξ, dN₃/dξ */
  readonly dn: readonly [number, number, number];
}

/**
 * Az alakfüggvények és deriváltjaik kiértékelése a lokális ξ koordinátában.
 *
 * @param xi lokális koordináta, ξ ∈ [−1, 1]
 */
export function shapeFunctions(xi: number): ShapeValues {
  return {
    n: [0.5 * xi * (xi - 1), 1 - xi * xi, 0.5 * xi * (xi + 1)],
    dn: [xi - 0.5, -2 * xi, xi + 0.5],
  };
}

/** A csomópontok lokális koordinátái, a `nodes` tömb sorrendjében. */
export const NODE_XI: readonly [number, number, number] = [-1, 0, 1];

/**
 * Interpoláció a csomóponti értékekből: f(ξ) = Σ Nᵢ(ξ)·fᵢ.
 * (Diplomaterv (3.4)–(3.6) egyenletek.)
 */
export function interpolate(values: readonly [number, number, number], xi: number): number {
  const { n } = shapeFunctions(xi);
  return n[0] * values[0] + n[1] * values[1] + n[2] * values[2];
}
