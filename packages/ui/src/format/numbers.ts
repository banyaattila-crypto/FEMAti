/**
 * Számformázás — a DESIGN-TERV.md 6.1 fejezete.
 *
 * EZ AZ EGYETLEN HELY, ahol szám szöveggé alakul. A komponensek nem hívnak
 * `toFixed`-et. Ha egy új mennyiség jelenik meg a felületen, ide kerül a
 * szabálya, nem a komponensbe.
 *
 * A bemenet minden esetben a mag SI-alapú belső egysége; a kimenet a
 * diplomaterv 3. táblázata szerinti megjelenítési egység.
 */

/** Formázott mennyiség: az érték és a mértékegység MINDIG külön. */
export interface Formatted {
  /** A számérték szövegként. Nem véges érték esetén `—`. */
  readonly value: string;
  /** A mértékegység jele. Dimenziótlan mennyiségnél üres. */
  readonly unit: string;
}

/** Nem véges vagy hiányzó érték egységes jelölése. Soha nem `NaN`. */
export const MISSING = '—';

function fixed(v: number | null | undefined, digits: number): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return MISSING;
  // A −0 megjelenítése 0.
  const x = Object.is(v, -0) ? 0 : v;
  return x.toFixed(digits);
}

const make =
  (digits: number, unit: string, scale = 1) =>
  (v: number | null | undefined): Formatted => ({
    value: v === null || v === undefined || !Number.isFinite(v) ? MISSING : fixed(v * scale, digits),
    unit,
  });

// ─── Elmozdulás-jellemzők ─────────────────────────────────────────────────────

/** Lehajlás [m] → mm, 3 tizedes. */
export const deflection = make(3, 'mm', 1e3);

/** Elfordulás [rad] → ×10⁻³ rad, 3 tizedes. */
export const rotation = make(3, '×10⁻³ rad', 1e3);

// ─── Igénybevételek ───────────────────────────────────────────────────────────

/** Hajlítónyomaték [kNm], 2 tizedes. */
export const moment = make(2, 'kNm');

/** Nyíróerő [kN], 2 tizedes. */
export const shear = make(2, 'kN');

/** Erő [kN], 2 tizedes. */
export const force = make(2, 'kN');

// ─── Modális analízis (ADR-0016) ───────────────────────────────────────────────

/** Sajátfrekvencia [Hz], 3 tizedes. */
export const frequencyHz = make(3, 'Hz');

/** Sajátkörfrekvencia [rad/s], 2 tizedes. */
export const angularFrequency = make(2, 'rad/s');

/**
 * Módalak-amplitúdó — DIMENZIÓTLAN (M-ortonormált sajátvektor, ld.
 * `solver/modal.ts`), a fizikai lehajlástól ELTÉRŐEN nincs mértékegysége és
 * az abszolút nagysága önmagában nem értelmezhető, csak az ALAKJA (a
 * relatív arányok a hossz mentén).
 */
export const modeShape = make(4, '');

// ─── Merevségek és keresztmetszeti jellemzők ─────────────────────────────────

/** Hajlítómerevség EI [kNm²], egész. */
export const bendingStiffness = make(0, 'kNm²');

/** Nyírási merevség GAs [kN], egész. */
export const shearStiffness = make(0, 'kN');

/** Keresztmetszeti terület [m²] → cm², 2 tizedes. */
export const area = make(2, 'cm²', 1e4);

/** Másodrendű nyomaték [m⁴] → cm⁴, egész. */
export const inertia = make(0, 'cm⁴', 1e8);

/** Feszültség / modulus [kN/m²] → kN/cm², 2 tizedes. */
export const stress = make(2, 'kN/cm²', 1e-4);

// ─── Dimenziótlan mennyiségek ────────────────────────────────────────────────

/** Teherszorzó λ, 3 tizedes. */
export const lambda = make(3, '');

/** Alaki tényező c = Mp/Me, 3 tizedes. */
export const shapeFactor = make(3, '');

/** Százalékos eltérés, 2 tizedes. */
export const percent = make(2, '%');

/** Darabszám (elem, szabadságfok, iteráció). */
export const count = (v: number | null | undefined, unit = ''): Formatted => ({
  value: v === null || v === undefined || !Number.isFinite(v) ? MISSING : String(Math.round(v)),
  unit,
});

/** Hossz [m], 2 tizedes. */
export const length = make(2, 'm');

// ─── Eltérés-értékelés (DESIGN-TERV 6.2) ─────────────────────────────────────

export type Tone = 'neutral' | 'ok' | 'warn' | 'error';

/**
 * Egy analitikus referenciától vett eltérés minősítése.
 * @param deviationPercent az eltérés abszolút értéke százalékban
 * @param tolerancePercent a validációs tűrés százalékban
 */
export function deviationTone(deviationPercent: number, tolerancePercent: number): Tone {
  if (!Number.isFinite(deviationPercent)) return 'neutral';
  const d = Math.abs(deviationPercent);
  if (d <= tolerancePercent) return 'ok';
  if (d <= 3 * tolerancePercent) return 'warn';
  return 'error';
}

/**
 * Deformációs lépték kiírása. A DESIGN-TERV 5.1 megköveteli, hogy a
 * nagyítás mértéke mindig látszódjon.
 */
export const scaleFactor = (v: number): string =>
  !Number.isFinite(v) ? MISSING : `×${Math.round(v).toLocaleString('hu-HU')}`;
