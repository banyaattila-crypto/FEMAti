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

  // ── Vastagságfüggő acélosztály (EN 10025-2 7. táblázat) — CSAK acélnál ──
  // FONTOS: ezeket a mezőket a megoldó (fem-core) MÉG NEM használja — a
  // rétegelt képlékenységi mag jelenleg egyetlen `sigmaY`-t rendel minden
  // réteghez (ADR-0019/D fázis: adatmodell-bővítés; a tényleges vastagság-
  // függő folyáshatár-választás a rétegelésben egy KÉSŐBBI, külön
  // jóváhagyott lépés — ld. terv E) fázis). Egyelőre TISZTÁN referencia-adat
  // a katalógus-nézetben, ugyanúgy, mint az `aCat`/`iCat` a szelvényeknél.
  /** Folyáshatár a vékonyabb vastagságosztályban [kN/cm²] (t ≤ `thicknessThreshold`) */
  readonly fy1?: number;
  /** Folyáshatár a vastagabb vastagságosztályban [kN/cm²] (t > `thicknessThreshold`) */
  readonly fy2?: number;
  /** Szakítószilárdság a vékonyabb vastagságosztályban [kN/cm²] */
  readonly fu1?: number;
  /** Szakítószilárdság a vastagabb vastagságosztályban [kN/cm²] */
  readonly fu2?: number;
  /** A vastagságosztályok határa [mm] (jellemzően 40 mm, EN 10025-2) */
  readonly thicknessThreshold?: number;
  /** Hőtágulási együttható tűzhatás esetén [1/°C] */
  readonly alphaFi?: number;

  // ── EC2 beton feszültség-alakváltozás modell (EN 1992-1-1 3.1.7) ────────
  // CSAK betonnál — ugyanaz a "referencia-adat, a megoldó még nem használja"
  // megjegyzés érvényes, mint fent (E)/F) fázis vezeti be ténylegesen a
  // parabola-téglalap modellt a rétegelt magba).
  /** Jellemző (karakterisztikus) nyomószilárdság fck [kN/cm²] */
  readonly fck?: number;
  /** Középértékű húzószilárdság fctm [kN/cm²] */
  readonly fctm?: number;
  /** Jellemző húzószilárdság (5%-os kvantilis) fctk,0.05 [kN/cm²] */
  readonly fctk005?: number;
  /** Rugalmassági modulus biztonsági/bizonytalansági tényezője γcE [-] */
  readonly gammaCE?: number;
  /** Végső (t=∞) kúszási tényező φ(∞,t0) [-] — ÁLTALÁNOS, projektfüggő becslés, ld. `note` */
  readonly phiInfinity?: number;
  /** Folyási határnyúlás a nemlineáris (nem a design) modellhez ε_c1 [-] */
  readonly epsC1?: number;
  /** Folyási határnyúlás a parabola-téglalap modellhez ε_c2 [-] */
  readonly epsC2?: number;
  /** Szakadási határnyúlás a parabola-téglalap modellhez ε_cu2 [-] */
  readonly epsCu2?: number;
  /** Folyási határnyúlás a bilineáris modellhez ε_c3 [-] */
  readonly epsC3?: number;
  /** Szakadási határnyúlás a bilineáris modellhez ε_cu3 [-] */
  readonly epsCu3?: number;
  /** Nyomószilárdság-csökkentő tényező η [-] (fck ≤ 50 MPa esetén 1,0) */
  readonly eta?: number;
  /** A parabola-téglalap modell kitevője n [-] (fck ≤ 50 MPa esetén 2,0) */
  readonly n?: number;
}

export type SectionKind = 'I' | 'U' | 'circle' | 'tube' | 'rect' | 'rhs' | 't';

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
