/**
 * Képlékeny hajlítás–nyírás (M-V) interakció — ADR-0018, A) út.
 *
 * EN 1993-1-1 6.2.8 stílusú, UTÓLAGOS teherbírás-ellenőrzés: NEM módosítja
 * a radial-return belső logikáját vagy a tangens merevségi mátrixot (ld.
 * `material/resultantPlastic.ts`, `solver/nonlinearElement.ts`, amik
 * VÁLTOZATLANUL "a nyírás mindig rugalmas marad" elvet követik) — csak egy
 * FÜGGETLEN, a végeredményből számolt kapacitás-ellenőrzés.
 *
 * A szabvány formulája (6.2.8(2)):
 *   ρ = (2·V/Vpl − 1)²           ha V > 0.5·Vpl,  különben ρ = 0
 *   Mv,Rd = (1−ρ)·Mpl,Rd
 *
 * A Vpl (képlékeny nyíróerő-teherbírás) számításához a szabvány egy
 * szelvény-specifikus nyírt keresztmetszetet (Av) használ. A projekt EZ
 * HELYETT a MÁR MEGLÉVŐ, effektív nyírási területet (κs·A, ld.
 * `SectionStiffness.gas = κs·G·A`) használja Av helyett — ez egy TUDATOS
 * modellezési egyszerűsítés (nem szabvány szerinti Av-definíció, hanem a
 * modell saját, már kiszámított κs·A mennyisége), dokumentálva itt és a
 * `docs/THEORY.md`-ban.
 */

/**
 * Képlékeny nyíróerő-teherbírás: Vpl = A_eff·σY/√3, ahol A_eff = κs·A a
 * modell MÁR meglévő effektív nyírási területe (`SectionStiffness.gas / G`
 * — ld. a modul fejlécét).
 *
 * @param sigmaY egytengelyű folyáshatár [kN/m²]
 * @param effectiveShearArea κs·A [m²] (= `SectionStiffness.gas / material.g`)
 */
export function plasticShearCapacity(sigmaY: number, effectiveShearArea: number): number {
  return (effectiveShearArea * sigmaY) / Math.sqrt(3);
}

export interface ShearMomentInteraction {
  /** Képlékeny nyíróerő-teherbírás Vpl [kN]. */
  readonly vpl: number;
  /** Redukciós tényező ρ ∈ [0,1] — 0, ha |V| ≤ 0.5·Vpl. */
  readonly rho: number;
  /** A nyírással csökkentett nyomatéki teherbírás Mv,Rd = (1−ρ)·Mpl,Rd [kNm]. */
  readonly mvRd: number;
  /** Kihasználtság |M|/Mv,Rd — 1 fölött a keresztmetszet túllépi a redukált teherbírást. */
  readonly utilization: number;
}

/**
 * M-V interakciós ellenőrzés egy adott (M, V) igénybevétel-párra.
 *
 * @param m hajlítónyomaték [kNm] (előjeltől független — abszolút értékkel dolgozik)
 * @param v nyíróerő [kN] (előjeltől független)
 * @param mpl a NYÍRÁSTÓL FÜGGETLEN képlékeny nyomatéki teherbírás Mpl,Rd
 *   [kNm] (ld. `resultantPlastic.ts` `plasticMomentCapacity`, vagy a
 *   rétegelt szelvény `SectionStiffness.plasticModulus·σY`-ja)
 * @param vpl a `plasticShearCapacity()`-vel számolt Vpl [kN]
 */
export function shearMomentInteraction(m: number, v: number, mpl: number, vpl: number): ShearMomentInteraction {
  const vRatio = vpl > 0 ? Math.abs(v) / vpl : Number.POSITIVE_INFINITY;
  const rho = vRatio > 0.5 ? (2 * vRatio - 1) ** 2 : 0;
  const mvRd = (1 - rho) * mpl;
  const utilization = mvRd > 0 ? Math.abs(m) / mvRd : Number.POSITIVE_INFINITY;
  return { vpl, rho, mvRd, utilization };
}
