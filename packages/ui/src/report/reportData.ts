/**
 * Számítási jegyzőkönyv — tiszta adat-előállítás (MASTER-PROMPT-TERV P15
 * prompt). Ez a fájl NEM rajzol semmit (nincs JSX) — a `ReportView.tsx`
 * dolgozza fel a kimenetét. A szétválasztás azért fontos, mert ez a modul
 * unit-tesztelhető a DOM/böngésző nélkül (ld. `reportData.test.ts`).
 */
import {
  combinedSteps,
  computeHingeMarkers,
  findPreparedElement,
  type NonlinearRun,
} from '../model/nonlinear.js';

export interface ReportHinge {
  readonly stepIndex: number;
  readonly kind: 'first-yield' | 'full-hinge';
  readonly elementId: string;
  /** Az elem középpontjának x koordinátája [m] — a jegyzőkönyvi táblázathoz. */
  readonly xApprox: number | null;
  /** A teherszorzó λ abban a lépésben, amelyben az esemény bekövetkezett. */
  readonly lambda: number;
}

/**
 * A `computeHingeMarkers()` (P13) kimenetének kiegészítése x-koordinátával
 * és λ-val — a jegyzőkönyv 6. pontja ("a képlékeny csuklók kialakulási
 * sorrendje") ehhez a táblázathoz igényli. A sorrend MEGŐRZŐDIK
 * (`computeHingeMarkers` már időrendben ad vissza), ezt a `reportData.test.ts`
 * a P-08 esetre (támasz-csukló ELŐBB, mint a mezőn belüli) ellenőrzi.
 */
export function buildHingeReport(run: NonlinearRun): readonly ReportHinge[] {
  const steps = combinedSteps(run);
  return computeHingeMarkers(run).map((marker) => {
    const step = steps[marker.stepIndex];
    const element = findPreparedElement(run.system, marker.elementId);
    return {
      stepIndex: marker.stepIndex,
      kind: marker.kind,
      elementId: marker.elementId,
      xApprox: element ? element.nodeX[1] : null,
      lambda: step?.lambda ?? 0,
    };
  });
}
