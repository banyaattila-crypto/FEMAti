/**
 * Automatikus szelvény-optimalizálás — "legkisebb megfelelő szelvény"
 * (2026-09-04, versenytárs-elemzés: SkyCiv "Beam Design and Optimization").
 *
 * A KIHASZNÁLTSÁGI ELLENŐRZÉSEK már léteznek (`model/designChecks.ts`,
 * ugyanaz, amit a `panels/RightPanel.tsx` is mutat) — ez a modul "csak"
 * végigfuttatja őket a katalógus, a jelenleg kiválasztottal AZONOS `kind`-ú
 * (I, U, kör, cső, téglalap, RHS, T) szelvényein, terület szerint növekvő
 * sorrendben, és az elsőt javasolja, ami mindenhol megfelel.
 *
 * ŐSZINTE KORLÁTOK:
 * - CSAK a szelvényt változtatja — anyagot, fesztávot, terheket, támaszokat
 *   nem.
 * - Vasbetonnál (`model.rebar`) a vasalás mennyisége FIX marad minden
 *   jelölt szelvénynél — ezt a hívó UI-nak jeleznie kell a felhasználó felé.
 * - A repedési nyomaték (TÁJÉKOZTATÓ jellegű, ld. `designChecks.ts`) nem
 *   számít bele a "megfelel" döntésbe, ugyanúgy, ahogy a jobb panelen sem.
 *
 * 2026-09-04 (teherkombináció): jelöltenként az ULS (EN 1990 6.10, 2+
 * egyidejű változó teherre több "vezető teher" változat envelope-ja) ÉS az
 * SLS (G+Q) kombinációt is lefuttatja (`model/combinations.ts`) — ugyanaz,
 * amit a `RightPanel.tsx` "Határteher-ellenőrzés" kártyája használ
 * (`model/designChecks.ts` `computeUtilizationsEnveloped`), hogy a javaslat a
 * TÉNYLEGES tervezési teherre legyen "megfelelő", ne a nem faktorozott
 * jellemző teherre.
 */
import { geometricProperties } from '@femati/fem-core';
import { SECTIONS, findSection, type SectionKind } from '../data/catalog.js';
import { solveEditableModel, toShape } from './compile.js';
import { scaleModelForSls, scaleModelForUlsVariants } from './combinations.js';
import { computeUtilizationsEnveloped } from './designChecks.js';
import { utilizationVerdict } from '../format/utilization.js';
import type { EditableModel } from './editable.js';

export interface OptimizeCandidate {
  readonly sectionId: string;
  readonly name: string;
  /** Keresztmetszeti terület [m²] — ez alapján rendezett a `candidates` lista. */
  readonly area: number;
  /** A legnagyobb alkalmazható kihasználtság — `null`, ha a modell erre a szelvényre nem futtatható. */
  readonly governing: number | null;
  readonly ok: boolean;
}

export interface OptimizeResult {
  /** A vizsgált szelvénycsalád — nyelv-semleges, a hívó (`panels/LeftPanel.tsx`) fordítja `i18n/catalog.ts` `sectionKindGroupLabel`-jével (ugyanaz a minta, mint a `format/utilization.ts` `UtilizationVerdictCode`-jánál). */
  readonly kind: SectionKind;
  /** Terület szerint növekvő sorrendben — minden azonos `kind`-ú katalógus-szelvény. */
  readonly candidates: readonly OptimizeCandidate[];
  /** Az első `ok === true` jelölt — `null`, ha egyik sem felel meg. */
  readonly best: OptimizeCandidate | null;
}

/**
 * A jelenlegi modellhez tartozó szelvénycsaládon belül megkeresi a legkisebb
 * (legkisebb keresztmetszeti területű) olyan szelvényt, amellyel az M-V
 * interakció, a lehajlás-ellenőrzés (SLS) és — ha alkalmazható — a vasbeton
 * ULS is megfelel (kihasználtság ≤ 100%).
 */
export function findSmallestSuitableSection(model: EditableModel): OptimizeResult {
  const currentSection = findSection(model.sectionId);
  const sameKind = SECTIONS.filter((s) => s.kind === currentSection.kind);

  const candidates: OptimizeCandidate[] = sameKind
    .map((section) => ({ section, area: geometricProperties(toShape(section)).area }))
    .sort((a, b) => a.area - b.area)
    .map(({ section, area }) => {
      const candidateModel = { ...model, sectionId: section.id };
      const ulsResults = scaleModelForUlsVariants(candidateModel)
        .map((variant) => solveEditableModel(variant).result)
        .filter((r): r is NonNullable<typeof r> => r !== null);
      const slsResult = solveEditableModel(scaleModelForSls(candidateModel)).result;
      const governing =
        ulsResults.length > 0 && slsResult ? computeUtilizationsEnveloped(candidateModel, ulsResults, slsResult).governing : null;
      const ok = governing !== null && utilizationVerdict(governing).tone === 'ok';
      return { sectionId: section.id, name: section.name, area, governing, ok };
    });

  return {
    kind: currentSection.kind,
    candidates,
    best: candidates.find((c) => c.ok) ?? null,
  };
}
