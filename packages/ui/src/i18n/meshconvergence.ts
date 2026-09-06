/**
 * A `meshconvergence/MeshConvergenceView.tsx` (Számítás → Hálófüggetlenségi
 * vizsgálat) szövegei.
 *
 * Publikálás előtti audit, 2026-09-06 (I18N-001): ez a panel TELJES EGÉSZÉBEN
 * kimaradt a korábbi i18n-körből — magyarul jelent meg EN nézetben is. Miután
 * az alapértelmezett nyelv angol lett (99. pont), ez már nem szűk réteget
 * érintő szépséghiba: egy külföldi látogató teljesen magyar panelt kapott.
 *
 * A `Record<Lang, T>` minta itt is azt a célt szolgálja, mint mindenhol
 * máshol: a TypeScript nem fordít le hiányzó fordítást.
 */
import type { Lang } from '../state/appStore.js';

interface MeshConvergenceStrings {
  readonly title: string;
  readonly subtitle: (runCount: number) => string;
  readonly close: string;
  readonly intro: (span: string, sectionId: string, materialId: string, from: number, to: number, threshold: number) => string;
  readonly colElementCount: string;
  readonly colDof: string;
  readonly note: string;
  /** A záró figyelmeztetés akkor jelenik meg, ha a két legfinomabb háló között még mindig nagy az eltérés. */
  readonly notConvergedLead: string;
  readonly notConvergedW: (percent: string) => string;
  readonly notConvergedM: (percent: string) => string;
  readonly notConvergedTail: string;
}

export const MESH_CONVERGENCE: Record<Lang, MeshConvergenceStrings> = {
  hu: {
    title: 'Hálófüggetlenségi vizsgálat',
    subtitle: (runCount) => `Az aktuális modell újrafuttatása ${runCount} elemszámmal`,
    close: 'Bezárás',
    intro: (span, sectionId, materialId, from, to, threshold) =>
      `A táblázat az aktuális modellt (${span} m, ${sectionId} / ${materialId}) a Toolbar Elemszám-csúszkájának beállításától FÜGGETLENÜL, ` +
      `egy rögzített ${from}–${to} elemes sorozaton futtatja le (mindig a lineáris megoldóval). A relatív eltérés oszlop az ELŐZŐ (durvább) ` +
      `hálóhoz képesti változást mutatja — ha ez tartósan ${threshold} % alá esik (kiemelve), a háló gyakorlatilag függetlenné vált az eredménytől.`,
    colElementCount: 'Elemszám',
    colDof: 'DOF',
    note:
      'Ez a vizsgálat a globális szélsőértékek (w max, M max) TELJES hálón át vett stabilitását mutatja — nem helyettesíti az Eredmények panel ' +
      'elemenkénti hibabecslőjét (`errorEstimate`), ami egyetlen hálón belül jelzi, hol érdemes sűríteni. Mindig a lineáris megoldón fut, mert a ' +
      'hálófüggetlenség kérdése az anyagmodelltől független, geometriai kérdés (ld. THEORY.md 6. és 12. pont) — a nemlineáris (Newton-Raphson) ' +
      'futás minden elemszámnál a teljes teherlépcső-történetet újrafuttatná, ami interaktív panelhez feleslegesen drága lenne.',
    notConvergedLead: 'A legfinomabb két háló közötti eltérés még',
    notConvergedW: (percent) => `w max-nál ${percent} %`,
    notConvergedM: (percent) => `M max-nál ${percent} %`,
    notConvergedTail: '— érdemes lehet a modellben is nagyobb elemszámot beállítani.',
  },
  en: {
    title: 'Mesh-independence study',
    subtitle: (runCount) => `Re-running the current model at ${runCount} different element counts`,
    close: 'Close',
    intro: (span, sectionId, materialId, from, to, threshold) =>
      `The table re-runs the current model (${span} m, ${sectionId} / ${materialId}) on a fixed ${from}–${to} element series, ` +
      `INDEPENDENTLY of the Element count slider in the toolbar (always with the linear solver). The relative change column shows the change ` +
      `against the PREVIOUS (coarser) mesh — once this stays below ${threshold} % (highlighted), the mesh has effectively stopped influencing the result.`,
    colElementCount: 'Elements',
    colDof: 'DOF',
    note:
      'This study shows the stability of the global extremes (w max, M max) across the WHOLE mesh — it does not replace the per-element error ' +
      'estimator (`errorEstimate`) in the Results panel, which tells you where within a single mesh refinement would pay off. It always runs on the ' +
      'linear solver, because mesh independence is a geometric question, independent of the material model (see THEORY.md §6 and §12) — a nonlinear ' +
      '(Newton–Raphson) run would repeat the entire load-step history at every element count, which is needlessly expensive for an interactive panel.',
    notConvergedLead: 'The difference between the two finest meshes is still',
    notConvergedW: (percent) => `${percent} % for w max`,
    notConvergedM: (percent) => `${percent} % for M max`,
    notConvergedTail: '— consider raising the element count in the model as well.',
  },
};
