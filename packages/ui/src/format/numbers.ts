/**
 * Számformázás — a DESIGN-TERV.md 6.1 fejezete.
 *
 * EZ AZ EGYETLEN HELY, ahol szám szöveggé alakul. A komponensek nem hívnak
 * `toFixed`-et. Ha egy új mennyiség jelenik meg a felületen, ide kerül a
 * szabálya, nem a komponensbe.
 *
 * A bemenet minden esetben a mag SI-alapú belső egysége; a kimenet
 * ALAPÉRTELMEZÉSBEN a diplomaterv 3. táblázata szerinti SI megjelenítési
 * egység.
 *
 * MÉRTÉKEGYSÉG-VÁLTÓ (2026-09-04, CSAK KIJELZÉS): a SZÁMÍTOTT eredmény-
 * jellegű mennyiségek (`makeConvertible()` — deflection/smallLength/moment/
 * shear/force/acceleration/bendingStiffness/shearStiffness/area/inertia/
 * stress/length) a `state/appStore.ts` `unitSystem` globális kapcsolójától
 * függően SI vagy US customary (kip/ft/in/ksi) egységben jelennek meg. EZ
 * TUDATOS, MINIMÁLIS reaktív csatolás: a modul `useAppStore.getState()`-et
 * olvas (nem hook — plain zustand-store-olvasás, nincs kör-import, mert az
 * `appStore.ts` nem importál a `format/`-ból). A React-újrarenderelés
 * INGYEN jár, mert `App.tsx` a TELJES store-ra feliratkozik szelektor
 * nélkül (`useAppStore()`), és a kódbázisban nincs `React.memo` — bármely
 * store-mező (így `unitSystem`) változása mindent újrarenderel alatta.
 *
 * A BAL PANEL BEMENETE (csúszkák, számmezők) 2026-09-04 óta SZINTÉN vált —
 * ld. lentebb az `editable*` függvénycsaládot, ami a `makeConvertible`-től
 * eltérően nem csak kijelez, hanem a `Slider` `value`/`min`/`max`/`step`-jét
 * is konvertálja (oda-vissza, `toDisplay`/`toCore`), a mag SI-tárolásának
 * érintetlenül hagyása mellett. A "Keresztmetszet" kártya katalógus-
 * visszhangjai (méretek, A/I, E/G) 2026-09-04 óta SZINTÉN váltanak (a
 * felhasználó jelezte, hogy a bal panel többi részével inkonzisztens volt,
 * ha ez SI-ben ragad) — ezek is a `makeConvertible`-alapú display-only
 * formázókat használják (`smallLength`/`area`/`inertia`/`stress`), mert
 * nem szerkeszthetők, csak kijeleznek. A VÁSZON-FELIRATOK (a modell-
 * vászon saját feliratai, pl. "L = ... m") maradnak SZÁNDÉKOSAN SI-ben —
 * azok a mag belső, mindig SI-alapú ábrázolásának közvetlen tükrei, nem
 * felhasználói bemenet vagy katalógus-adat. Rendszer-független mennyiségek (idő, szög,
 * frekvencia, dimenziótlan arányok — `rotation`, `frequencyHz`,
 * `angularFrequency`, `modeShape`, `time`, `lambda`, `shapeFactor`,
 * `percent`, `count`) VÁLTOZATLANOK maradnak `unitSystem`-től függetlenül.
 */
import { useAppStore } from '../state/appStore.js';

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

// ─── Mértékegység-váltó (2026-09-04, CSAK KIJELZÉS) — ld. a modul fejléce ──────

/** Alap-átváltási tényezők (SI → US customary, egzakt definíciókból). */
const KN_TO_KIP = 1 / 4.4482216152605; // 1 kip = 4.4482216152605 kN (lbf pontos definíciója)
const M_TO_FT = 1 / 0.3048; // 1 ft = 0.3048 m (egzakt)
const M_TO_IN = 1 / 0.0254; // 1 in = 0.0254 m (egzakt)
const KPA_TO_KSI = 1 / 6894.757; // 1 ksi = 6894.757 kPa (psi pontos definíciójából)

interface UnitVariant {
  readonly digits: number;
  readonly unit: string;
  readonly scale: number;
}

/**
 * Mértékegység-rendszertől függő formázó — a `state/appStore.ts`
 * `unitSystem` globális kapcsolóját olvassa (nem hook, ld. a modul
 * fejléce). A bemenet MINDIG a mag SI-alapú belső egysége.
 */
const makeConvertible =
  (si: UnitVariant, imperial: UnitVariant) =>
  (v: number | null | undefined): Formatted => {
    const variant = useAppStore.getState().unitSystem === 'imperial' ? imperial : si;
    return {
      value: v === null || v === undefined || !Number.isFinite(v) ? MISSING : fixed(v * variant.scale, variant.digits),
      unit: variant.unit,
    };
  };

// ─── Elmozdulás-jellemzők ─────────────────────────────────────────────────────

/** Lehajlás [m] → mm (SI) / in (US), 3 tizedes. */
export const deflection = makeConvertible({ digits: 3, unit: 'mm', scale: 1e3 }, { digits: 3, unit: 'in', scale: M_TO_IN });

/** Kis hossz (keresztmetszet-méretek) [m] → mm (SI) / in (US), 1 tizedes. */
export const smallLength = makeConvertible({ digits: 1, unit: 'mm', scale: 1e3 }, { digits: 2, unit: 'in', scale: M_TO_IN });

/** Elfordulás [rad] → ×10⁻³ rad, 3 tizedes — RENDSZER-FÜGGETLEN (a radián nem SI/US-specifikus). */
export const rotation = make(3, '×10⁻³ rad', 1e3);

// ─── Igénybevételek ───────────────────────────────────────────────────────────

/** Hajlítónyomaték [kNm] (SI) / kip·ft (US), 2 tizedes. */
export const moment = makeConvertible({ digits: 2, unit: 'kNm', scale: 1 }, { digits: 2, unit: 'kip·ft', scale: KN_TO_KIP * M_TO_FT });

/** Nyíróerő [kN] (SI) / kip (US), 2 tizedes. */
export const shear = makeConvertible({ digits: 2, unit: 'kN', scale: 1 }, { digits: 2, unit: 'kip', scale: KN_TO_KIP });

/** Erő [kN] (SI) / kip (US), 2 tizedes. */
export const force = makeConvertible({ digits: 2, unit: 'kN', scale: 1 }, { digits: 2, unit: 'kip', scale: KN_TO_KIP });

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

// ─── Dinamikai válasz (tranziens, Newmark-β) ──────────────────────────────────

/** Idő [s], 3 tizedes. */
export const time = make(3, 's');

/** Gyorsulás [m/s²] (SI) / ft/s² (US), 3 tizedes. */
export const acceleration = makeConvertible({ digits: 3, unit: 'm/s²', scale: 1 }, { digits: 3, unit: 'ft/s²', scale: M_TO_FT });

// ─── Merevségek és keresztmetszeti jellemzők ─────────────────────────────────

/** Hajlítómerevség EI [kNm²] (SI) / kip·ft² (US), egész. */
export const bendingStiffness = makeConvertible(
  { digits: 0, unit: 'kNm²', scale: 1 },
  { digits: 0, unit: 'kip·ft²', scale: KN_TO_KIP * M_TO_FT * M_TO_FT },
);

/** Nyírási merevség GAs [kN] (SI) / kip (US), egész. */
export const shearStiffness = makeConvertible({ digits: 0, unit: 'kN', scale: 1 }, { digits: 0, unit: 'kip', scale: KN_TO_KIP });

/** Keresztmetszeti terület [m²] → cm² (SI) / in² (US), 2 tizedes. */
export const area = makeConvertible({ digits: 2, unit: 'cm²', scale: 1e4 }, { digits: 2, unit: 'in²', scale: M_TO_IN * M_TO_IN });

/** Másodrendű nyomaték [m⁴] → cm⁴ (SI) / in⁴ (US), SI-ben egész, US-ben 1 tizedes (kisebb számok). */
export const inertia = makeConvertible(
  { digits: 0, unit: 'cm⁴', scale: 1e8 },
  { digits: 1, unit: 'in⁴', scale: M_TO_IN ** 4 },
);

/** Feszültség / modulus [kN/m²] → kN/cm² (SI) / ksi (US), 2 tizedes. */
export const stress = makeConvertible({ digits: 2, unit: 'kN/cm²', scale: 1e-4 }, { digits: 2, unit: 'ksi', scale: KPA_TO_KSI });

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

/** Hossz [m] (SI) / ft (US), 2 tizedes. */
export const length = makeConvertible({ digits: 2, unit: 'm', scale: 1 }, { digits: 2, unit: 'ft', scale: M_TO_FT });

// ─── Szerkeszthető mezők (csúszkák) mértékegység-váltója (2026-09-04) ─────────
//
// A fenti `makeConvertible` CSAK kijelez (a `format/numbers.ts` fejléce
// szerint a mag mindig SI-ben számol, a bal panel bemenete pedig eddig
// szándékosan mindig SI maradt — ld. git history). A felhasználó kérésére
// ez kiterjed a bal panel MINDEN szerkeszthető csúszkájára/számmezőjére is:
// nem csak kijelez, hanem a `Slider` `value`/`min`/`max`/`step`-jét is az
// aktuális `unitSystem`-nek megfelelő alapra hozza. A hívó oldal (Toolbar/
// LeftPanel) a visszakapott `toDisplay`/`toCore` függvényekkel konvertál
// oda-vissza — a modell VÁLTOZATLANUL a mag SI-alapú (vagy a meglévő
// "SI-szép" — cm²/mm —) egységében tárol.
export interface EditableUnit {
  readonly unit: string;
  readonly toDisplay: (core: number) => number;
  readonly toCore: (display: number) => number;
}

const linearUnit = (unit: string, scale: number): EditableUnit => ({
  unit,
  toDisplay: (core) => core * scale,
  toCore: (display) => display / scale,
});

const editableField =
  (si: EditableUnit, imperial: EditableUnit) =>
  (): EditableUnit =>
    useAppStore.getState().unitSystem === 'imperial' ? imperial : si;

/** Hossz (fesztáv, pozíciók) — mag méterben. */
export const editableLength = editableField(linearUnit('m', 1), linearUnit('ft', M_TO_FT));

/** Kis hossz (süllyedés, vasalás-fedés, lemezvastagság) — mag méterben, SI-ben mm-ként szerkesztve. */
export const editableSmallLength = editableField(linearUnit('mm', 1e3), linearUnit('in', M_TO_IN));

/** Terület (vasalás Aₛ) — mag m²-ben, SI-ben cm²-ként szerkesztve. */
export const editableArea = editableField(linearUnit('cm²', 1e4), linearUnit('in²', M_TO_IN * M_TO_IN));

/** Erő (pontteher, mozgó teher, axiális erő). */
export const editableForce = editableField(linearUnit('kN', 1), linearUnit('kip', KN_TO_KIP));

/** Koncentrált nyomatékteher. */
export const editableMoment = editableField(linearUnit('kNm', 1), linearUnit('kip·ft', KN_TO_KIP * M_TO_FT));

/** Megoszló teher és rugóállandó (mindkettő erő/hossz — kN/m). */
export const editableLinearLoad = editableField(linearUnit('kN/m', 1), linearUnit('kip/ft', KN_TO_KIP / M_TO_FT));

/** Megoszló nyomatékteher (kNm/m). */
export const editableMomentPerLength = editableField(linearUnit('kNm/m', 1), linearUnit('kip·ft/ft', KN_TO_KIP));

/** Rugalmas ágyazási modulus (kN/m²). */
export const editableFoundationModulus = editableField(
  linearUnit('kN/m²', 1),
  linearUnit('kip/ft²', KN_TO_KIP / (M_TO_FT * M_TO_FT)),
);

/**
 * Hőmérséklet — AFFIN átváltás (°F = °C·9/5+32), ezért NEM `linearUnit`:
 * a `toDisplay`/`toCore` a `step`-re/deltára hívva hibás lenne (az eltolás
 * torzítaná), a hívó oldal ezért a hőteher-csúszkáknál a `step`-et fixen,
 * mértékegység-függetlenül adja meg (1 °C ≈ 1-2 °F, elhanyagolható eltérés).
 */
export function editableTemperature(): EditableUnit {
  if (useAppStore.getState().unitSystem !== 'imperial') return linearUnit('°C', 1);
  return { unit: '°F', toDisplay: (c) => c * 1.8 + 32, toCore: (f) => (f - 32) / 1.8 };
}

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
