/**
 * Rayleigh- (arányos) csillapítás — ADR-0017.
 *
 *   C = α·M + β·K
 *
 * A "klasszikus" (arányos) csillapítás lényege: a K/M sajátvektorai (a
 * csillapítatlan módalakok) a csillapított rendszernek IS sajátvektorai
 * maradnak (mert C UGYANAZOKKAL a mátrixokkal, azonos bázisban
 * diagonalizálható, mint K és M) — ezért minden módus EGYMÁSTÓL FÜGGETLEN,
 * csillapított egyszabadságfokú oszcillátorként viselkedik:
 *
 *   ζₙ = α/(2·ωₙ) + β·ωₙ/2
 *
 * (ld. pl. Chopra, *Dynamics of Structures* — klasszikus, széles körben
 * használt eredmény, nem ez a projekt saját levezetése). Ez a tulajdonság
 * adja a `test/transient.test.ts` fő validációs eszközét: egy tisztán egy
 * módusalakkal gerjesztett, Rayleigh-csillapított szabadrezgés ZÁRT ALAKBAN
 * (nem csak numerikusan) egy egyszabadságfokú, exponenciálisan lecsengő
 * lengés — ez FÜGGETLEN referencia a Newmark-β integrátor validálásához.
 */
import { DenseMatrix } from '../linalg/dense.js';

export interface RayleighDamping {
  readonly alpha: number;
  readonly beta: number;
}

/**
 * Az α, β együtthatók előállítása KÉT célzott módushoz tartozó csillapítási
 * tényezőből (ζ₁ az ω₁-en, ζ₂ az ω₂-n) — a ζₙ = α/(2ωₙ) + β·ωₙ/2
 * egyenletrendszer 2×2-es megoldása.
 */
export function rayleighFromModalDamping(
  omega1: number,
  zeta1: number,
  omega2: number,
  zeta2: number,
): RayleighDamping {
  const a11 = 1 / (2 * omega1);
  const a12 = omega1 / 2;
  const a21 = 1 / (2 * omega2);
  const a22 = omega2 / 2;
  const det = a11 * a22 - a12 * a21;
  return {
    alpha: (zeta1 * a22 - zeta2 * a12) / det,
    beta: (a11 * zeta2 - a21 * zeta1) / det,
  };
}

/** C = α·M + β·K előállítása. */
export function dampingMatrix(k: DenseMatrix, m: DenseMatrix, damping: RayleighDamping): DenseMatrix {
  const c = DenseMatrix.zeros(k.rows, k.cols);
  c.addScaled(damping.alpha, m);
  c.addScaled(damping.beta, k);
  return c;
}
