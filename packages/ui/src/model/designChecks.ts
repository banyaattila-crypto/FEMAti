/**
 * Kihasználtsági ellenőrzések EGY HELYEN — a `panels/RightPanel.tsx`
 * korábban ezt inline számolta ki, az új `model/optimize.ts` szelvény-
 * optimalizálónak pedig UGYANERRE a logikára van szüksége (minden jelölt
 * szelvényre le kell tudnia futtatni) — kiemelve ide, hogy a kettő ne
 * csúszhasson szét egymástól (2026-09-04).
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
  /** M-V interakció (EN 1993-1-1 6.2.8) — null, ha az anyagnak nincs folyáshatára. */
  readonly mv: number | null;
  /** Lehajlás-ellenőrzés (SLS, L/250) — anyagfüggetlen, mindig számítható. */
  readonly deflection: number | null;
  /** Vasbeton ULS hajlítási teherbírás — null, ha nincs bekapcsolt vasalás vagy nem téglalap szelvény. */
  readonly rc: number | null;
  /** A vasbeton ULS teherbírás MRd [kNm] — a `rc` kihasználtság mögötti nyers érték, kiíráshoz. */
  readonly rcMu: number | null;
  /** A legnagyobb ALKALMAZHATÓ kihasználtság a fentiek közül — null csak akkor, ha egyik sem alkalmazható. */
  readonly governing: number | null;
}

/** A `panels/RightPanel.tsx` M-V/lehajlás/vasbeton-ULS számítása, egy adott (már megoldott) modellre. */
export function computeUtilizations(model: EditableModel, result: LinearResult): DesignUtilizations {
  const interaction =
    result.props.mp !== null && result.props.vpl !== null
      ? shearMomentInteraction(result.extremes.m.value, result.extremes.t.value, result.props.mp, result.props.vpl)
      : null;
  const mv = interaction?.utilization ?? null;

  const deflection = deflectionUtilization(result.extremes.w.value, model.span);

  const materialEntry = findMaterial(model.materialId);
  const sectionEntry = findSection(model.sectionId);
  const rcCapacity =
    model.rebar.enabled && sectionEntry.kind === 'rect' && materialEntry.fck !== undefined
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

  const applicable = [mv, deflection, rc].filter((v): v is number => v !== null && Number.isFinite(v));
  const governing = applicable.length > 0 ? Math.max(...applicable) : null;

  return { mv, deflection, rc, rcMu, governing };
}
