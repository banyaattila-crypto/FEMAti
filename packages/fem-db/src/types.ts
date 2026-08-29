/**
 * Az anyag- és szelvényadatbázis típusai (Diplomaterv 3.1.6.3.1-3.1.6.3.2,
 * MASTER-PROMPT-TERV P14 prompt).
 *
 * MINDEN rekordhoz KÖTELEZŐ a `source` (szabvány- vagy irodalmi hivatkozás)
 * és a `verified` mező — a diplomaterv saját figyelmeztetése szerint:
 * "az adatbázisban megtalálható keresztmetszetek jellemzőinek értékei
 * TÁJÉKOZTATÓ jellegűek, az értékeket az első felhasználás előtt
 * ELLENŐRIZNI KELL!" (42. oldal, szó szerint).
 */

/** Anyagcsalád — a Szelvény/Anyag combobox csoportosításához és ikonjához (UI). */
export type MaterialFamily = 'steel' | 'aluminum' | 'concrete' | 'timber';

/** Anyagjellemzők (Diplomaterv "Táblázat 2.", 41. oldal). Egységek: E, σY [kN/cm²] · α [1/°C] · ρ [kg/m³]. */
export interface MaterialEntry {
  readonly id: string;
  readonly name: string;
  readonly family: MaterialFamily;
  /** Rugalmassági modulus [kN/cm²] */
  readonly e: number;
  /** Poisson-tényező [-] */
  readonly nu: number;
  /** Egytengelyű folyáshatár [kN/cm²]; 0 = a képlékeny vizsgálat nem értelmezett */
  readonly sigmaY: number;
  /** Hőtágulási együttható [1/°C] */
  readonly alpha: number;
  /** Sűrűség [kg/m³] */
  readonly density: number;
  /** Lineáris keményedési paraméter H' [kN/cm²]; 0 = tökéletesen képlékeny */
  readonly hPrime: number;
  readonly plastic: boolean;
  /** Szabvány- vagy irodalmi hivatkozás — KÖTELEZŐ. */
  readonly source: string;
  /** Igaz, ha az érték ELLENŐRZÖTT (nem csak számított/emlékezetből felvett). */
  readonly verified: boolean;
  /** Kiegészítő megjegyzés a felülethez (pl. fa/beton diplomaterv-figyelmeztetés). */
  readonly note?: string;
}

export type SectionKind = 'I' | 'U' | 'circle' | 'tube' | 'rect' | 'rhs';

/** Szelvényjellemzők (Diplomaterv 3.1.6.3.2, 42. oldal). Méretek [mm]. */
export interface SectionEntry {
  readonly id: string;
  readonly name: string;
  readonly kind: SectionKind;
  /** Magasság [mm] */
  readonly h: number;
  /** Szélesség [mm] */
  readonly b: number;
  /** Gerincvastagság [mm] — I és U szelvénynél */
  readonly tw?: number;
  /** Övvastagság [mm] — I és U szelvénynél */
  readonly tf?: number;
  /** Átmérő [mm] — kör és cső */
  readonly d?: number;
  /** Falvastagság [mm] — cső */
  readonly t?: number;
  /** Katalógus-terület [cm²] — összevetéshez */
  readonly aCat?: number;
  /** Katalógus-inercia [cm⁴] */
  readonly iCat?: number;
  /** Katalógus képlékeny modulus [cm³] */
  readonly wplCat?: number;
  /** Szabvány- vagy irodalmi hivatkozás — KÖTELEZŐ. */
  readonly source: string;
  /** Igaz, ha az érték ELLENŐRZÖTT (nem csak számított/emlékezetből felvett). */
  readonly verified: boolean;
}
