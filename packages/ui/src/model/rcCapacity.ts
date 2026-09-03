/**
 * Vasbeton ULS hajlítási teherbírás — 2026-09-03, felhasználói kérés.
 *
 * EGYSZERŰSÍTETT TÉGLALAP FESZÜLTSÉGBLOKK (EC2 EN 1992-1-1 3.1.7(3), fck≤50
 * MPa: η=1.0, λ=0.8) — ez a KLASSZIKUS kézi RC-tervezési módszer, tudatosan
 * FÜGGETLEN a rétegelt (EC2 parabola-téglalap, ADR-0019) fiber-modelltől és
 * a nemlineáris futtatástól — ugyanaz a szétválasztás, mint az Mₑ/Mₚ
 * (parametrikus, mindig ÉLŐ, nem igényel SZÁMÍTÁS-t) és a rétegelt
 * nemlineáris futtatás (csak F5-re fut) között.
 *
 * FELTÉTELEZÉSEK (dokumentált egyszerűsítések, NEM a szabvány teljes köre):
 * - jellemző (nem tervezési, γ=1.0) érték — ugyanaz a konvenció, mint a
 *   Vpl/M-V ellenőrzésnél (ADR-0018, "γM0 = 1.00 (ajánlott érték)").
 * - a húzott ÉS a nyomott vasalás is folyik (alulvasalt, alakváltozó
 *   keresztmetszet — a szokásos tervezési feltevés; túlvasalt, rideg
 *   tönkremenetelnél a tényleges Mu ennél KISEBB lehet — ezt ez a
 *   függvény NEM jelzi).
 * - fck ≤ 50 MPa (η=1, λ=0.8) — a katalógus jelenlegi betonosztályai
 *   (C16/20…C50/60) mind ebbe a tartományba esnek.
 * - B500B betonacél (fyk=500 MPa) — nem választható katalógus-anyag,
 *   ugyanúgy belső állandó, mint a rétegelt modellnél (ld.
 *   `model/nonlinear.ts` `REBAR_MATERIAL`).
 * - CSAK állandó szélességű (téglalap) keresztmetszetre érvényes — a
 *   nyomott zóna szélessége a képletben `b`, ami T-szelvénynél/más
 *   alaknál nem állandó.
 */

const REBAR_FYK = 500e3; // kN/m² (500 MPa) — B500B jellemző folyáshatár
const STRESS_BLOCK_LAMBDA = 0.8;
const STRESS_BLOCK_ETA = 1.0;

export interface RcRectSection {
  /** Keresztmetszet szélessége [m] */
  readonly b: number;
  /** Keresztmetszet magassága [m] */
  readonly h: number;
}

export interface RcCapacityResult {
  /** Teherbírás |MRd| [kNm] */
  readonly mu: number;
  /** Semleges tengely mélysége a nyomott szálótól [m] */
  readonly x: number;
}

/**
 * @param section téglalap keresztmetszet geometriája
 * @param fck jellemző nyomószilárdság [kN/m²] (pozitív érték)
 * @param asTension a HÚZOTT oldali vasalás területe [m²]
 * @param asCompression a NYOMOTT oldali vasalás területe [m²]
 * @param cover tengelytávolság a szélső betonszáltól mindkét oldalon [m]
 * @returns `null`, ha nincs húzott vasalás, vagy a semleges tengely
 *   degenerált (x ≤ 0 — pl. a nyomott vasalás önmagában meghaladja a
 *   húzottat)
 */
export function rcMomentCapacity(
  section: RcRectSection,
  fck: number,
  asTension: number,
  asCompression: number,
  cover: number,
): RcCapacityResult | null {
  if (!(asTension > 0) || !(fck > 0) || !(section.b > 0) || !(section.h > 0)) return null;

  const d = section.h - cover; // effektív magasság a húzott vasig
  const dPrime = cover; // a nyomott vas távolsága a nyomott szálótól

  // Erő-egyensúly: Fc + Fs' = Fs  (nincs axiális teher — a gerendaelemnek
  // nincs N szabadságfoka, ld. `element/bMatrix.ts`).
  const x = ((asTension - asCompression) * REBAR_FYK) / (STRESS_BLOCK_ETA * fck * STRESS_BLOCK_LAMBDA * section.b);
  if (!(x > 0)) return null;

  const fc = STRESS_BLOCK_ETA * fck * STRESS_BLOCK_LAMBDA * x * section.b; // beton eredő nyomóerő
  const mu = fc * (d - (STRESS_BLOCK_LAMBDA * x) / 2) + asCompression * REBAR_FYK * (d - dPrime);
  return { mu, x };
}
