/**
 * Kihasználtsági ellenőrzések EGY HELYEN — a `panels/RightPanel.tsx`
 * korábban ezt inline számolta ki, az új `model/optimize.ts` szelvény-
 * optimalizálónak pedig UGYANERRE a logikára van szüksége (minden jelölt
 * szelvényre le kell tudnia futtatni) — kiemelve ide, hogy a kettő ne
 * csúszhasson szét egymástól (2026-09-04).
 *
 * 2026-09-04 (teherkombináció): a bemenet mostantól KÉT megoldás — az
 * erő-/teherbírás-jellegű ellenőrzések (M-V, vasbeton ULS) az ULS
 * kombinációra (1.35G+1.5Q, `model/combinations.ts` `scaleModelForUls`),
 * a lehajlás-ellenőrzés az SLS kombinációra (G+Q) futnak, ahogy azt az EN
 * 1990 megköveteli. A hívó (`RightPanel.tsx`/`optimize.ts`) felelőssége
 * mindkét kombinációt lefuttatni és idehozni.
 *
 * 2026-09-06 (ψ₀ kombináció, EN 1990 6.10): 2+ egyidejű `'variable'` teher
 * esetén nem egy, hanem TÖBB ULS-változat létezik (mindegyik változó teher
 * sorban "vezető" — ld. `combinations.ts` `scaleModelForUlsVariants`) — ezek
 * envelope-jára `computeUtilizationsEnveloped` hívandó `computeUtilizations`
 * helyett.
 *
 * A repedési nyomaték (`crackingMomentUtilization`) SZÁNDÉKOSAN NINCS itt:
 * a `RightPanel.tsx`-ben is TÁJÉKOZTATÓ jellegű (nem ULS/SLS-kapu, ld. ADR-
 * 0019/ADR-0021), ezért sem a `governing` mezőbe, sem a szelvény-
 * optimalizálás "megfelel" döntésébe nem számít bele.
 */
import { deflectionUtilization, shearMomentInteraction, type LinearResult } from '@femati/fem-core';
import { findMaterial, findSection } from '../data/catalog.js';
import { isCompositeActive } from './compile.js';
import { rcMomentCapacity } from './rcCapacity.js';
import type { EditableModel } from './editable.js';

export interface DesignUtilizations {
  /** M-V interakció (EN 1993-1-1 6.2.8), ULS kombinációra — null, ha az anyagnak nincs folyáshatára. */
  readonly mv: number | null;
  /** Lehajlás-ellenőrzés (SLS, L/250), SLS kombinációra — anyagfüggetlen, mindig számítható. */
  readonly deflection: number | null;
  /** Vasbeton ULS hajlítási teherbírás, ULS kombinációra — null, ha nincs bekapcsolt vasalás vagy nem téglalap szelvény. */
  readonly rc: number | null;
  /** A vasbeton ULS teherbírás MRd [kNm] — a `rc` kihasználtság mögötti nyers érték, kiíráshoz. */
  readonly rcMu: number | null;
  /** A legnagyobb ALKALMAZHATÓ kihasználtság a fentiek közül — null csak akkor, ha egyik sem alkalmazható. */
  readonly governing: number | null;
  /**
   * Melyik ULS-kombináció (a hívó `ulsResults`/`scaleModelForUlsVariants`
   * tömbjének indexe) adta az `mv`/`rc` mértékadó értékét — a hívó ebből
   * tudja kiírni a mértékadó M/T-t és a "vezető" terhet (`combinations.ts`
   * `ulsVariantLeadingLoadIds`). `computeUtilizations` (egyetlen kombináció)
   * esetén mindig 0.
   */
  readonly ulsGoverningIndex: number;
}

/**
 * A `panels/RightPanel.tsx` M-V/lehajlás/vasbeton-ULS számítása.
 * `ulsResult`/`slsResult`: ugyanannak a modellnek az ULS (1.35G+1.5Q),
 * illetve SLS (G+Q) kombinációra megoldott eredménye (`model/
 * combinations.ts` `scaleModelForUls`/`scaleModelForSls` + `solveEditableModel`).
 */
export function computeUtilizations(model: EditableModel, ulsResult: LinearResult, slsResult: LinearResult): DesignUtilizations {
  // 2026-09-04: kompozit acél-beton keresztmetszeten sem az M-V plasztikus
  // interakció (egyanyagú Wpl/σy-t tételez fel), sem a vasbeton ULS-blokk
  // (homogén beton nyomott zónát tételez fel) nem értelmezhető — az MVP
  // csak a rugalmas viselkedésre vonatkozik, ld. `model/compile.ts`
  // `buildCompositeSection()` fejléce. A lehajlás-ellenőrzés anyagfüggetlen,
  // a helyesen számított kompozit EI-vel TOVÁBBRA IS érvényes.
  const isComposite = isCompositeActive(model);

  const interaction =
    !isComposite && ulsResult.props.mp !== null && ulsResult.props.vpl !== null
      ? shearMomentInteraction(ulsResult.extremes.m.value, ulsResult.extremes.t.value, ulsResult.props.mp, ulsResult.props.vpl)
      : null;
  const mv = interaction?.utilization ?? null;

  const deflection = deflectionUtilization(slsResult.extremes.w.value, model.span);

  const materialEntry = findMaterial(model.materialId);
  const sectionEntry = findSection(model.sectionId);
  const rcCapacity =
    !isComposite && model.rebar.enabled && sectionEntry.kind === 'rect' && materialEntry.fck !== undefined
      ? rcMomentCapacity(
          { b: sectionEntry.b / 1000, h: sectionEntry.h / 1000 },
          materialEntry.fck * 1e4,
          ulsResult.extremes.m.value >= 0 ? model.rebar.asBottom : model.rebar.asTop,
          ulsResult.extremes.m.value >= 0 ? model.rebar.asTop : model.rebar.asBottom,
          model.rebar.cover,
        )
      : null;
  const rcMu = rcCapacity?.mu ?? null;
  const rc = rcCapacity ? Math.abs(ulsResult.extremes.m.value) / rcCapacity.mu : null;

  const applicable = [mv, deflection, rc].filter((v): v is number => v !== null && Number.isFinite(v));
  const governing = applicable.length > 0 ? Math.max(...applicable) : null;

  return { mv, deflection, rc, rcMu, governing, ulsGoverningIndex: 0 };
}

/**
 * Envelope 2+ egyidejű változó teherre (EN 1990 6.10, `model/combinations.ts`
 * `scaleModelForUlsVariants`): mindegyik "melyik teher a vezető" változatra
 * lefuttatja `computeUtilizations`-t, és minden mezőt KÜLÖN a legkedvezőtlenebb
 * (legnagyobb) értékre envelope-ol — nem ugyanattól a kombinációtól várja el
 * mindegyik ellenőrzés mértékadó eredményét. 1 elemű `ulsResults` esetén
 * pontosan `computeUtilizations` eredményét adja vissza.
 */
export function computeUtilizationsEnveloped(model: EditableModel, ulsResults: readonly LinearResult[], slsResult: LinearResult): DesignUtilizations {
  const perCombo = ulsResults.map((uls) => computeUtilizations(model, uls, slsResult));
  const worstOf = (get: (u: DesignUtilizations) => number | null): number | null => {
    const values = perCombo.map(get).filter((v): v is number => v !== null && Number.isFinite(v));
    return values.length > 0 ? Math.max(...values) : null;
  };
  // Melyik változat adta az ULS-alapú (mv/rc) mértékadó értéket — a deflection
  // SLS-ből jön, minden változatnál azonos, ezért nem számít bele.
  let ulsGoverningIndex = 0;
  let bestUlsScore = -Infinity;
  perCombo.forEach((u, i) => {
    const score = Math.max(u.mv ?? -Infinity, u.rc ?? -Infinity);
    if (score > bestUlsScore) {
      bestUlsScore = score;
      ulsGoverningIndex = i;
    }
  });
  return {
    mv: worstOf((u) => u.mv),
    deflection: worstOf((u) => u.deflection),
    rc: worstOf((u) => u.rc),
    rcMu: worstOf((u) => u.rcMu),
    governing: worstOf((u) => u.governing),
    ulsGoverningIndex,
  };
}

export interface SeismicUtilization {
  /** M-V interakció (EN 1993-1-1 6.2.8), a G+ψ₂Q±Ev kombinációra — null, ha az anyagnak nincs folyáshatára. */
  readonly mv: number | null;
  /** Vasbeton ULS hajlítási teherbírás — null, ha nincs bekapcsolt vasalás vagy nem téglalap szelvény. */
  readonly rc: number | null;
  readonly rcMu: number | null;
  /** A legnagyobb ALKALMAZHATÓ kihasználtság a fentiek közül — null csak akkor, ha egyik sem alkalmazható. */
  readonly governing: number | null;
  /** Melyik változat (0 = Ev felfelé, 1 = Ev lefelé) adta a mértékadó értéket. */
  readonly governingIndex: number;
}

/**
 * EN 1998-1 4.3.3.5.2 — a FÜGGŐLEGES földrengési komponens M-V/vasbeton ULS
 * ellenőrzése, a `combinations.ts` `scaleModelForSeismicVariants` KÉT
 * változatára (Ev felfelé/lefelé) envelope-olva. SZÁNDÉKOSAN NINCS
 * lehajlás-ellenőrzés itt — az EC8 4.3.3.5.2 egy ULS-jellegű (teherbírási),
 * nem SLS-ellenőrzés, ld. `docs/ADR/0023-fuggoleges-foldrenges-kombinacio.md`.
 */
export function computeSeismicUtilization(model: EditableModel, seismicResults: readonly LinearResult[]): SeismicUtilization {
  const isComposite = isCompositeActive(model);
  const materialEntry = findMaterial(model.materialId);
  const sectionEntry = findSection(model.sectionId);

  const perCombo = seismicResults.map((result) => {
    const interaction =
      !isComposite && result.props.mp !== null && result.props.vpl !== null
        ? shearMomentInteraction(result.extremes.m.value, result.extremes.t.value, result.props.mp, result.props.vpl)
        : null;
    const mv = interaction?.utilization ?? null;

    const rcCapacity =
      !isComposite && model.rebar.enabled && sectionEntry.kind === 'rect' && materialEntry.fck !== undefined
        ? rcMomentCapacity(
            { b: sectionEntry.b / 1000, h: sectionEntry.h / 1000 },
            materialEntry.fck * 1e4,
            result.extremes.m.value >= 0 ? model.rebar.asBottom : model.rebar.asTop,
            result.extremes.m.value >= 0 ? model.rebar.asTop : model.rebar.asBottom,
            model.rebar.cover,
          )
        : null;
    const rcMu = rcCapacity?.mu ?? null;
    const rc = rcCapacity ? Math.abs(result.extremes.m.value) / rcCapacity.mu : null;

    const applicable = [mv, rc].filter((v): v is number => v !== null && Number.isFinite(v));
    const governing = applicable.length > 0 ? Math.max(...applicable) : null;
    return { mv, rc, rcMu, governing };
  });

  let governingIndex = 0;
  let best = -Infinity;
  perCombo.forEach((u, i) => {
    const score = u.governing ?? -Infinity;
    if (score > best) {
      best = score;
      governingIndex = i;
    }
  });

  const worstOf = (get: (u: (typeof perCombo)[number]) => number | null): number | null => {
    const values = perCombo.map(get).filter((v): v is number => v !== null && Number.isFinite(v));
    return values.length > 0 ? Math.max(...values) : null;
  };

  return {
    mv: worstOf((u) => u.mv),
    rc: worstOf((u) => u.rc),
    rcMu: worstOf((u) => u.rcMu),
    governing: worstOf((u) => u.governing),
    governingIndex,
  };
}
