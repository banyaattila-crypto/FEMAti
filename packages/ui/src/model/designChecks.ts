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
 * A repedési nyomaték (`crackingMomentUtilization`) SZÁNDÉKOSAN NINCS itt:
 * a `RightPanel.tsx`-ben is TÁJÉKOZTATÓ jellegű (nem ULS/SLS-kapu, ld. ADR-
 * 0019/ADR-0021), ezért sem a `governing` mezőbe, sem a szelvény-
 * optimalizálás "megfelel" döntésébe nem számít bele.
 */
import { deflectionUtilization, shearMomentInteraction, type LinearResult } from '@femati/fem-core';
import { findMaterial, findSection } from '../data/catalog.js';
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
}

/**
 * A `panels/RightPanel.tsx` M-V/lehajlás/vasbeton-ULS számítása.
 * `ulsResult`/`slsResult`: ugyanannak a modellnek az ULS (1.35G+1.5Q),
 * illetve SLS (G+Q) kombinációra megoldott eredménye (`model/
 * combinations.ts` `scaleModelForUls`/`scaleModelForSls` + `solveEditableModel`).
 */
export function computeUtilizations(model: EditableModel, ulsResult: LinearResult, slsResult: LinearResult): DesignUtilizations {
  const interaction =
    ulsResult.props.mp !== null && ulsResult.props.vpl !== null
      ? shearMomentInteraction(ulsResult.extremes.m.value, ulsResult.extremes.t.value, ulsResult.props.mp, ulsResult.props.vpl)
      : null;
  const mv = interaction?.utilization ?? null;

  const deflection = deflectionUtilization(slsResult.extremes.w.value, model.span);

  const materialEntry = findMaterial(model.materialId);
  const sectionEntry = findSection(model.sectionId);
  const rcCapacity =
    model.rebar.enabled && sectionEntry.kind === 'rect' && materialEntry.fck !== undefined
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

  return { mv, deflection, rc, rcMu, governing };
}
