/**
 * Teherkombináció (EN 1990) — 2026-09-04, versenytárs-elemzés alapján
 * azonosított hiány: a program eddig egyetlen (nem faktorozott) terhet
 * futtatott, ezért a "Határteher-ellenőrzés" kártya kihasználtsági %-ai
 * valójában a BEÍRT, nem a TERVEZÉSI teherre vonatkoztak.
 *
 * ŐSZINTE KORLÁTOK (MVP — csak a headline kombinációk, nem az EN 1990 6.10
 * teljes apparátusa):
 *  - NINCS ψ₀ kombinációs tényező több egyidejű változó teherre — minden
 *    `'variable'` jelölésű terhet EGYÜTT, egyetlen γQ-val skáláz.
 *  - NINCS kedvező/kedvezőtlen G-alternatíva (pl. 1.0G felhajtás-vizsgálathoz).
 *  - A hőteher (`model.thermalLoad`) NEM kap kategóriát, minden
 *    kombinációban 1.0 szorzóval, változatlanul marad benne.
 *  - Az önsúly (`model.selfWeight`) mindig automatikusan "állandó" (G) —
 *    a `model.selfWeightFactor` mezőn keresztül skálázva (`model/compile.ts`
 *    `compileModel` olvassa).
 *  - A nemlineáris (rugalmas-képlékeny, F5-ös) futtatás/λ-ramp EZT NEM
 *    használja — az a jellemző (γ=1) teherre fut, szándékosan független.
 *
 * A fő M/T/w/φ diagramok és a jobb panel "hero" sorai (w max, M max stb.)
 * TOVÁBBRA IS a jellemző (nem skálázott) modellt mutatják — ezt a két
 * függvényt KIZÁRÓLAG a "Határteher-ellenőrzés" kártya (`panels/
 * RightPanel.tsx`) és a szelvény-optimalizálás (`model/optimize.ts`)
 * használja, a `model/designChecks.ts` `computeUtilizations()` bemeneteként.
 */
import type { EditableLoad, EditableModel } from './editable.js';

/** EN 1990 Táblázat A1.2(B) — alapvető (fundamentális) ULS kombináció, γG. */
export const ULS_GAMMA_G = 1.35;
/** EN 1990 Táblázat A1.2(B) — alapvető (fundamentális) ULS kombináció, γQ. */
export const ULS_GAMMA_Q = 1.5;

function scaleLoad(load: EditableLoad, gammaG: number, gammaQ: number): EditableLoad {
  const gamma = load.category === 'permanent' ? gammaG : gammaQ;
  switch (load.kind) {
    case 'point':
      return { ...load, p: load.p * gamma };
    case 'moment':
      return { ...load, m: load.m * gamma };
    case 'distributed':
      return { ...load, q1: load.q1 * gamma, q2: load.q2 * gamma };
    case 'distributed-moment':
      return { ...load, m1: load.m1 * gamma, m2: load.m2 * gamma };
  }
}

/**
 * ULS = 1.35·G + 1.5·Q — a modell egy skálázott másolata (a támaszok,
 * geometria, szelvény, anyag, ágyazások VÁLTOZATLANOK, kizárólag a terhek
 * és az önsúly-szorzó skálázódik).
 *
 * FIGYELEM: ez a "minden változó teher egyszerre, teljes γQ-val" változat —
 * 2+ egyidejű változó teher esetén ez a valós EN 1990 6.10-nél szigorúbb
 * (biztonság oldali, de túltervező). A helyes kombinációhoz a lenti
 * `scaleModelForUlsVariants` kell.
 */
export function scaleModelForUls(model: EditableModel): EditableModel {
  return {
    ...model,
    loads: model.loads.map((l) => scaleLoad(l, ULS_GAMMA_G, ULS_GAMMA_Q)),
    selfWeightFactor: ULS_GAMMA_G,
  };
}

/**
 * EN 1990 6.10 — kombinációs (ψ₀) tényező kísérő változó teherre.
 * MVP: EGY közös érték minden `'variable'` teherre (nincs teherfajta szerinti
 * tábla — EN 1990 A1.1 melléklet A-C kategóriájú hasznos teher értéke, a
 * leggyakoribb épületmagasépítési eset).
 */
export const ULS_PSI0 = 0.7;

/**
 * EN 1990 6.10 — ΣγG·G + γQ,1·Qk,1 + Σγq,i·ψ₀·Qk,i: minden `'variable'`
 * terhet sorban "vezető"-nek (teljes γQ) tekint, a többit ψ₀-val
 * csökkentett γQ-val — mert nem tudható előre, melyik teher adja a
 * mértékadó igénybevételt. A hívónak mindegyik változatot le kell futtatnia
 * és a legkedvezőtlenebbet (envelope) kell vennie — ld.
 * `designChecks.ts` `computeUtilizationsEnveloped`.
 *
 * 1 vagy 0 db `'variable'` teher esetén nincs mit "vezetőnek" választani —
 * ilyenkor egyetlen elemű tömböt ad vissza, ami megegyezik `scaleModelForUls`
 * eredményével.
 */
function variableLoadIndices(model: EditableModel): readonly number[] {
  return model.loads.reduce<number[]>((acc, l, i) => (l.category === 'variable' ? [...acc, i] : acc), []);
}

export function scaleModelForUlsVariants(model: EditableModel): readonly EditableModel[] {
  const variableIndices = variableLoadIndices(model);
  if (variableIndices.length <= 1) {
    return [scaleModelForUls(model)];
  }
  return variableIndices.map((leadingIndex) => ({
    ...model,
    loads: model.loads.map((l, i) => scaleLoad(l, ULS_GAMMA_G, i === leadingIndex ? ULS_GAMMA_Q : ULS_GAMMA_Q * ULS_PSI0)),
    selfWeightFactor: ULS_GAMMA_G,
  }));
}

/**
 * Melyik teher volt a "vezető" `scaleModelForUlsVariants` egyes elemeiben,
 * UGYANOLYAN sorrendben — a hívó (`panels/RightPanel.tsx`) ebből tudja
 * kiírni, melyik teher adta a mértékadó ULS-kombinációt. 0/1 db `'variable'`
 * teher esetén nincs "vezető" fogalom, ilyenkor `[null]`.
 */
export function ulsVariantLeadingLoadIds(model: EditableModel): readonly (string | null)[] {
  const variableIndices = variableLoadIndices(model);
  if (variableIndices.length <= 1) {
    return [null];
  }
  return variableIndices.map((i) => model.loads[i].id);
}

/**
 * EN 1998-1 6.4.3.4 / EN 1990 6.12a-b — földrengési tervezési szituáció
 * kombinációs (ψ₂, kvázi-állandó) tényezője. MVP: EGY közös érték minden
 * `'variable'` teherre (EN 1990 A1.1 melléklet, A/B kategória — lakó-/
 * irodaépület hasznos terhe, a leggyakoribb eset), ugyanaz az egyszerűsítés,
 * mint `ULS_PSI0`-nál.
 */
export const SEISMIC_PSI2 = 0.3;

/**
 * Földrengés — EN 1998-1 FÜGGŐLEGES komponense (2026-09-06, ld.
 * `docs/ADR/0023-fuggoleges-foldrenges-kombinacio.md`): a teljes függőleges
 * tervezési hatás G + ψ₂·Q ± Ev, ahol Ev = Svd(T₁)·(G+ψ₂·Q) — mivel Ev
 * ARÁNYOS (G+ψ₂·Q)-val, ez EGYSZERŰEN egy (1±Svd(T₁)) közös szorzóval
 * fejezhető ki G-re ÉS ψ₂·Q-ra egyaránt. A hívónak (`RightPanel.tsx`) kell
 * kiszámítania Svd(T₁)-et (`@femati/fem-core` `verticalDesignSpectrum` +
 * a modell tényleges első sajátperiódusa a modális megoldóból,
 * `model/compile.ts` `solveModalModel`).
 *
 * Két változatot ad vissza (Ev felfelé/lefelé hat) — a hívónak mindkettőt
 * le kell futtatnia és a legkedvezőtlenebbet kell vennie (ugyanaz az
 * envelope-minta, mint `scaleModelForUlsVariants`-nál).
 */
export function scaleModelForSeismicVariants(model: EditableModel, svd: number): readonly EditableModel[] {
  const scale = (verticalFactor: number): EditableModel => ({
    ...model,
    loads: model.loads.map((l) => scaleLoad(l, verticalFactor, SEISMIC_PSI2 * verticalFactor)),
    selfWeightFactor: verticalFactor,
  });
  return [scale(1 + svd), scale(1 - svd)];
}

/**
 * SLS = 1.0·G + 1.0·Q — jellemző kombináció. A γ=1 miatt ez a jellemző
 * modellel EGYENÉRTÉKŰ (identitás), de külön függvényként exportálva, hogy
 * a hívó oldal (`RightPanel.tsx`, `optimize.ts`) egységesen "kombinációként"
 * kezelhesse mindkettőt, és a jövőbeli finomítás (pl. kedvezőtlen G-
 * alternatíva) itt, egy helyen bővíthető legyen.
 */
export function scaleModelForSls(model: EditableModel): EditableModel {
  return { ...model, selfWeightFactor: 1 };
}
