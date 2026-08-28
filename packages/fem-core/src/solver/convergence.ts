/**
 * Konvergencia-mérőszám (Diplomaterv 3.4.2.1/6. lépés, "CONUND"):
 *
 *   100 · √(Σψᵢ²) / √(Σfᵢ²)  ≤  Tolerancia [%]
 *
 * Az 1996-os 0.5%-os toleranciaszint GÉPIDŐ-korlát volt, nem elvi határ —
 * mai gépen indokolatlanul laza: a maradó kiegyensúlyozatlan erő a teher fél
 * százaléka, ami képlékeny feladatnál a képlékeny csuklók helyét is
 * elmozdíthatja (docs/HIBATURESI-POLITIKA.md 5. pont). Az alapértelmezés
 * ezért szigorúbb; a diplomaterv eredeti értéke külön "történelmi módban"
 * elérhető marad.
 */
import { norm2 } from '../linalg/dense.js';

/** Alapértelmezett tolerancia [%] — 1e−6 relatív (docs/HIBATURESI-POLITIKA.md 5. pont). */
export const DEFAULT_TOLERANCE_PERCENT = 1e-4;
/** A diplomaterv eredeti tolerancia-szintje ("történelmi mód"). */
export const HISTORICAL_TOLERANCE_PERCENT = 0.5;
export const MIN_TOLERANCE_PERCENT = 1e-8;
export const MAX_TOLERANCE_PERCENT = 1e-2;

/**
 * A reziduum-mérőszám [%]. `f` normája nulla esetén (nincs valódi teher —
 * pl. a legelső, terheletlen állapot) a mérőszám 0, ha `ψ` is nulla,
 * különben `+∞` (nem 0/0, hanem valódi kiegyensúlyozatlanság nulla teher
 * mellett — ez sosem szabadna előforduljon egy jól definiált lépésnél).
 */
export function residualPercent(psi: Float64Array, f: Float64Array): number {
  const psiNorm = norm2(psi);
  const fNorm = norm2(f);
  if (fNorm === 0) return psiNorm === 0 ? 0 : Number.POSITIVE_INFINITY;
  return (100 * psiNorm) / fNorm;
}

/** A tolerancia a megengedett [MIN, MAX] sávra szorítva (docs/HIBATURESI-POLITIKA.md 5. pont). */
export function clampTolerancePercent(value: number): number {
  return Math.min(MAX_TOLERANCE_PERCENT, Math.max(MIN_TOLERANCE_PERCENT, value));
}
