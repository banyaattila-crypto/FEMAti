/**
 * Hálófüggetlenségi (h-konvergencia) vizsgálat.
 *
 * Ez volt a `DESIGN-TERV.md` eredeti tervében szereplő, jobb paneli
 * "Hálófüggetlenség" szekció, amit a felület sokáig csak egy `disabled`
 * menüponttal jelzett ("Számítás" menü) — inkább látszott szürkén "még
 * nincs kész", mint hogy úgy tegyünk, mintha működne. Ez a modul az
 * ígért funkció: az aktuális modellt egy rögzített elemszám-sorozaton
 * futtatja le, és megmutatja, hogyan áll be a legnagyobb lehajlás/nyomaték
 * a háló finomításával.
 *
 * MINDIG a LINEÁRIS megoldón át fut (`solveEditableModel`, ld. `compile.ts`
 * fejléce: "a felület nem számol" — ez a modul is csak TÖBBSZÖR hívja meg
 * ugyanazt az egyetlen belépési pontot). A nemlineáris (Newton-Raphson,
 * rétegelt) futás minden elemszámnál a teljes teherlépcső-történetet
 * újrafuttatná — drága lenne egy interaktív panelhez —, miközben a
 * hálófüggetlenség kérdése (konvergál-e az elmozdulásmező a
 * hálósűrűséggel) a lineáris megoldáson is jól vizsgálható: a záródásmentes
 * elem geometriai konvergenciája nem függ az anyagmodelltől.
 *
 * Ez a panel NEM helyettesíti az `ElementResult.errorEstimate`-et (a
 * csomópontra extrapolált/átlagolt ugrás mértékét, ld. CONVENTIONS.md 8.
 * pont) — az egyetlen hálón belüli, elemenkénti finomítási javaslat; ez
 * itt TÖBB, EGÉSZ hálón át vizsgálja, hogy a globális szélsőérték
 * elmozdul-e finomítással.
 */
import { solveEditableModel } from './compile.js';
import type { EditableModel } from './editable.js';

/** Alapértelmezett elemszám-sorozat — doublingok a Toolbar Elemszám-csúszkájának [4, 100] tartományában. */
export const DEFAULT_MESH_CONVERGENCE_COUNTS: readonly number[] = [4, 8, 16, 32, 64];

export interface MeshConvergencePoint {
  readonly elementCount: number;
  /** `NaN`, ha a modell az adott elemszámmal nem oldható meg (ld. `error`). */
  readonly dofCount: number;
  readonly wMax: number;
  readonly wMaxX: number;
  readonly mMax: number;
  readonly mMaxX: number;
  /** Relatív eltérés az ELŐZŐ (durvább) hálóhoz képest, %; `null` az első pontnál vagy hibás szomszéd esetén. */
  readonly wRelChangePercent: number | null;
  readonly mRelChangePercent: number | null;
  readonly error: string | null;
}

function relChangePercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  const denom = Math.abs(current) > 1e-12 ? Math.abs(current) : 1;
  return (Math.abs(current - previous) / denom) * 100;
}

/**
 * Az `editable` modell lefuttatása `elementCounts` mindegyikével.
 * Hibatűrő: egy adott elemszámnál sikertelen megoldás nem szakítja meg a
 * sorozatot (`error` mezővel jelezve), és a rá következő pont relatív
 * eltérése — mivel nincs érvényes "előző" érték — `null` lesz.
 */
export function runMeshConvergence(
  editable: EditableModel,
  elementCounts: readonly number[] = DEFAULT_MESH_CONVERGENCE_COUNTS,
): readonly MeshConvergencePoint[] {
  const points: MeshConvergencePoint[] = [];
  let prevW: number | null = null;
  let prevM: number | null = null;

  for (const elementCount of elementCounts) {
    const outcome = solveEditableModel({ ...editable, elementCount });

    if (outcome.result === null) {
      points.push({
        elementCount,
        dofCount: NaN,
        wMax: NaN,
        wMaxX: NaN,
        mMax: NaN,
        mMaxX: NaN,
        wRelChangePercent: null,
        mRelChangePercent: null,
        error: outcome.error,
      });
      prevW = null;
      prevM = null;
      continue;
    }

    const { w, m } = outcome.result.extremes;
    points.push({
      elementCount,
      dofCount: outcome.result.dofCount,
      wMax: w.value,
      wMaxX: w.x,
      mMax: m.value,
      mMaxX: m.x,
      wRelChangePercent: prevW === null ? null : relChangePercent(w.value, prevW),
      mRelChangePercent: prevM === null ? null : relChangePercent(m.value, prevM),
      error: null,
    });
    prevW = w.value;
    prevM = m.value;
  }

  return points;
}
