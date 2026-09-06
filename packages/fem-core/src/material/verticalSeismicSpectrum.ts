/**
 * EN 1998-1 (Eurocode 8) — a FÜGGŐLEGES szeizmikus komponens rugalmas és
 * tervezési válaszspektruma, Sve(T)/Svd(T) (2026-09-06).
 *
 * Hatókör-döntés (ld. `docs/ADR/0023-fuggoleges-foldrenges-kombinacio.md`):
 * CSAK a függőleges komponens (EN 1998-1 4.3.3.5.2 — nagy fesztávú,
 * konzolos, vagy rideg elemet alátámasztó gerendáknál előírt) — NINCS
 * vízszintes/keret-hatás, mert egyetlen, egysíkú hajlító gerendaelemnek
 * nincs értelmezhető vízszintes földrengési válasza (ahhoz keretszerkezet/
 * tömegeloszlás kellene, ami explicit KIZÁRT hatókör, ld. az ADR-t).
 *
 * Forrás: az EN 1998-1:2004 szövege nem volt közvetlenül elérhető — a
 * képletet és a 3.4. táblázat értékeit Carvalho, E. (2011), "EUROCODE 8 —
 * Background and Applications" (JRC/Lisbon, 2011.02.10-11, hivatalos EU
 * JRC oktatási anyag, eurocodes.jrc.ec.europa.eu) 23-24. diái alapján
 * vettük át.
 */

/** EN 1998-1 3.2.2.2(2) — a két válaszspektrum-alak (a régió szeizmicitásától függ, felhasználói bemenet). */
export type VerticalSpectrumType = 1 | 2;

export interface VerticalSpectrumTableEntry {
  /** avg/ag arány [–]. */
  readonly avgOverAg: number;
  /** Alsó töréspont [s]. */
  readonly TB: number;
  /** Felső töréspont (plató vége) [s]. */
  readonly TC: number;
  /** A leszálló ág töréspontja [s]. */
  readonly TD: number;
}

/**
 * EN 1998-1 3.4. táblázat — a talajosztály (S) a függőleges spektrumot NEM
 * befolyásolja (Carvalho 2011, 24. dia: "Soil factor not influencing the
 * vertical response spectrum") — ezért itt nincs talajosztály-paraméter.
 */
export const VERTICAL_SPECTRUM_TABLE: Readonly<Record<VerticalSpectrumType, VerticalSpectrumTableEntry>> = {
  1: { avgOverAg: 0.9, TB: 0.05, TC: 0.15, TD: 1.0 },
  2: { avgOverAg: 0.45, TB: 0.05, TC: 0.15, TD: 1.0 },
};

/**
 * EN 1998-1 (3.6) — csillapítási korrekciós tényező η, ξ=5%-nál PONTOSAN 1.
 * @param dampingRatioPercent ξ [%] — alapértelmezés 5 (szerkezeti acél/beton szokásos feltételezése).
 */
export function verticalDampingCorrection(dampingRatioPercent = 5): number {
  return Math.max(Math.sqrt(10 / (5 + dampingRatioPercent)), 0.55);
}

export interface VerticalSpectrumInput {
  /** ag/g — a referencia csúcsgyorsulás a gravitációs gyorsulás többszöröseként (pl. 0.15 = "0.15g"). */
  readonly agOverG: number;
  /** Fontossági tényező γI (EN 1998-1 4.2.5). */
  readonly gammaI: number;
  readonly spectrumType: VerticalSpectrumType;
  /** ξ [%] — alapértelmezés 5. */
  readonly dampingRatioPercent?: number;
}

/** avg/g = (avg/ag)·γI·(ag/g). */
function verticalDesignAccelOverG(input: VerticalSpectrumInput): number {
  const { avgOverAg } = VERTICAL_SPECTRUM_TABLE[input.spectrumType];
  return avgOverAg * input.gammaI * input.agOverG;
}

/**
 * EN 1998-1 — a rugalmas függőleges válaszspektrum Sve(T)/g, NÉGY ágban
 * (Carvalho 2011, 23. dia):
 *   0≤T≤TB:  Sve = avg·(1+(T/TB)·(η·3.0−1))
 *   TB≤T≤TC: Sve = avg·η·3.0
 *   TC≤T≤TD: Sve = avg·η·3.0·(TC/T)
 *   TD≤T≤4s: Sve = avg·η·3.0·(TC·TD/T²)
 * Az eredmény — mivel `agOverG` már a g többszöröseként adott bemenet — a
 * g többszöröseként adódik vissza (nincs külön mértékegység-váltás).
 */
export function verticalElasticSpectrum(periodSeconds: number, input: VerticalSpectrumInput): number {
  if (periodSeconds < 0) throw new RangeError('periodSeconds nem lehet negatív');
  const { TB, TC, TD } = VERTICAL_SPECTRUM_TABLE[input.spectrumType];
  const eta = verticalDampingCorrection(input.dampingRatioPercent ?? 5);
  const avg = verticalDesignAccelOverG(input);
  const T = periodSeconds;
  if (T <= TB) return avg * (1 + (T / TB) * (eta * 3.0 - 1));
  if (T <= TC) return avg * eta * 3.0;
  if (T <= TD) return avg * eta * 3.0 * (TC / T);
  return avg * eta * 3.0 * ((TC * TD) / (T * T));
}

/** EN 1998-1 4.3.3.5.2(1) — a viselkedési tényező függőleges irányban minden anyagra/rendszerre qv ≤ 1.5. */
export const VERTICAL_BEHAVIOR_FACTOR_MAX = 1.5;

/** Svd(T) = Sve(T)/qv — MVP: egyszerű osztás, a vízszintes tervezési spektrum (3.13) alsó korlátja (β·ag) NÉLKÜL, mert az EC8 ezt a függőleges komponensre nem írja elő explicit módon. */
export function verticalDesignSpectrum(periodSeconds: number, input: VerticalSpectrumInput, behaviorFactor = VERTICAL_BEHAVIOR_FACTOR_MAX): number {
  return verticalElasticSpectrum(periodSeconds, input) / behaviorFactor;
}
