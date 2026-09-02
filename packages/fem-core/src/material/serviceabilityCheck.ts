/**
 * Használhatósági (SLS) ellenőrzések — lehajlás-korlát és beton repedési
 * nyomaték. UTÓLAGOS, a végeredményből számolt jelzések, a `shearMomentInteraction.
 * ts`-hez hasonló architektúrával (nem módosítják a megoldó belső logikáját).
 *
 * A repedési nyomaték ellenőrzés (EN 1992-1-1 §7.1 szellemében, fctm-mel,
 * γc nélkül — karakterisztikus/SLS konvenció) TÁJÉKOZTATÓ jellegű: azt
 * jelzi, mikor lép túl a modell a rugalmas (repedésmentes) tartományon.
 * NEM egy vasbeton ULS hajlítási teherbírás-ellenőrzés (M_Rd) — ahhoz
 * vasalás-geometria (As) modellezése kellene, ami jelenleg nincs a
 * motorban (ld. ADR-0019, ADR-0021).
 */

/** Lehajlás-kihasználtság w_max/L a megengedett arányhoz (alapértelmezetten 1/250) képest. */
export function deflectionUtilization(wMax: number, span: number, limitRatio = 1 / 250): number {
  return span > 0 ? Math.abs(wMax) / span / limitRatio : Number.POSITIVE_INFINITY;
}

/** Repedési nyomaték kihasználtsága |M_max|/M_cr — 1 fölött a keresztmetszet berepedt (elméletileg). */
export function crackingMomentUtilization(mMax: number, mcr: number): number {
  return mcr > 0 ? Math.abs(mMax) / mcr : Number.POSITIVE_INFINITY;
}
