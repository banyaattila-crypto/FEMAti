/**
 * Hálófüggetlenségi (h-konvergencia) vizsgálat — a `DESIGN-TERV.md`
 * eredeti tervében szereplő, korábban `disabled` menüpontként jelzett
 * funkció megvalósítása. Az aktuális modellt egy rögzített elemszám-
 * sorozaton futtatja le (ld. `model/meshConvergence.ts` fejléce), és
 * táblázatban mutatja, hogyan áll be a legnagyobb lehajlás/nyomaték a
 * háló finomításával.
 */
import { useMemo } from 'react';
import './meshconvergence.css';
import * as fmt from '../format/numbers.js';
import { DEFAULT_MESH_CONVERGENCE_COUNTS, runMeshConvergence, type MeshConvergencePoint } from '../model/meshConvergence.js';
import { useAppStore } from '../state/appStore.js';
import { useModelStore } from '../state/modelStore.js';

/** A relatív eltérés akkor számít "gyakorlatilag konvergáltnak", ha ez alatt van. */
const CONVERGED_THRESHOLD_PERCENT = 1;

function relCell(v: number | null): { readonly text: string; readonly ok: boolean } {
  if (v === null) return { text: '—', ok: false };
  return { text: `${fmt.percent(v).value} %`, ok: v < CONVERGED_THRESHOLD_PERCENT };
}

/** `true`, ha van érvényes relatív eltérés, és az még a küszöb FÖLÖTT van (tehát nem tekinthető konvergáltnak). */
function notConverged(v: number | null): v is number {
  return v !== null && v >= CONVERGED_THRESHOLD_PERCENT;
}

function Row({ point, elementCount }: { readonly point: MeshConvergencePoint; readonly elementCount: number }): JSX.Element {
  if (point.error !== null) {
    return (
      <tr>
        <td>{elementCount}</td>
        <td className="vem-meshconv__error" colSpan={5}>
          {point.error}
        </td>
      </tr>
    );
  }
  const wRel = relCell(point.wRelChangePercent);
  const mRel = relCell(point.mRelChangePercent);
  return (
    <tr>
      <td>{elementCount}</td>
      <td>{fmt.count(point.dofCount).value}</td>
      <td>{fmt.deflection(point.wMax).value} mm</td>
      <td className={wRel.ok ? 'vem-meshconv__rel-ok' : undefined}>{wRel.text}</td>
      <td>{fmt.moment(point.mMax).value} kNm</td>
      <td className={mRel.ok ? 'vem-meshconv__rel-ok' : undefined}>{mRel.text}</td>
    </tr>
  );
}

export function MeshConvergenceView(): JSX.Element | null {
  const meshConvergenceOpen = useAppStore((s) => s.meshConvergenceOpen);
  const setMeshConvergenceOpen = useAppStore((s) => s.setMeshConvergenceOpen);
  const model = useModelStore((s) => s.model);

  const points = useMemo(() => {
    if (!meshConvergenceOpen) return null;
    return runMeshConvergence(model, DEFAULT_MESH_CONVERGENCE_COUNTS);
  }, [meshConvergenceOpen, model]);

  if (!meshConvergenceOpen || points === null) return null;

  const close = (): void => setMeshConvergenceOpen(false);
  const lastValid = [...points].reverse().find((p) => p.error === null);

  return (
    <div className="vem-overlay vem-meshconv-overlay" onPointerDown={close}>
      <div className="vem-meshconv" onPointerDown={(e) => e.stopPropagation()}>
        <header className="vem-meshconv__header">
          <div>
            <h1>Hálófüggetlenségi vizsgálat</h1>
            <p className="vem-meshconv__subtitle">Az aktuális modell újrafuttatása {DEFAULT_MESH_CONVERGENCE_COUNTS.length} elemszámmal</p>
          </div>
          <button type="button" className="vem-btn vem-btn--sm" onClick={close}>
            Bezárás
          </button>
        </header>

        <p className="vem-meshconv__intro">
          A táblázat az aktuális modellt ({model.span.toFixed(1)} m, {model.sectionId} / {model.materialId}) a Toolbar Elemszám-csúszkájának
          beállításától FÜGGETLENÜL, egy rögzített {DEFAULT_MESH_CONVERGENCE_COUNTS[0]}–
          {DEFAULT_MESH_CONVERGENCE_COUNTS[DEFAULT_MESH_CONVERGENCE_COUNTS.length - 1]} elemes sorozaton futtatja le (mindig a lineáris megoldóval). A
          relatív eltérés oszlop az ELŐZŐ (durvább) hálóhoz képesti változást mutatja — ha ez tartósan {CONVERGED_THRESHOLD_PERCENT} % alá esik
          (kiemelve), a háló gyakorlatilag függetlenné vált az eredménytől.
        </p>

        <table>
          <thead>
            <tr>
              <th>Elemszám</th>
              <th>DOF</th>
              <th>w max</th>
              <th>Δw</th>
              <th>M max</th>
              <th>ΔM</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <Row key={p.elementCount} point={p} elementCount={p.elementCount} />
            ))}
          </tbody>
        </table>

        <p className="vem-meshconv__note">
          Ez a vizsgálat a globális szélsőértékek (w max, M max) TELJES hálón át vett stabilitását mutatja — nem helyettesíti az Eredmények panel
          elemenkénti hibabecslőjét (`errorEstimate`), ami egyetlen hálón belül jelzi, hol érdemes sűríteni. Mindig a lineáris megoldón fut, mert a
          hálófüggetlenség kérdése az anyagmodelltől független, geometriai kérdés (ld. THEORY.md 6. és 12. pont) — a nemlineáris (Newton-Raphson)
          futás minden elemszámnál a teljes teherlépcső-történetet újrafuttatná, ami interaktív panelhez feleslegesen drága lenne.
          {lastValid !== undefined && (notConverged(lastValid.wRelChangePercent) || notConverged(lastValid.mRelChangePercent)) ? (
            <>
              {' '}
              A legfinomabb két háló közötti eltérés még{' '}
              {notConverged(lastValid.wRelChangePercent) ? `w max-nál ${fmt.percent(lastValid.wRelChangePercent).value} %` : null}
              {notConverged(lastValid.wRelChangePercent) && notConverged(lastValid.mRelChangePercent) ? ', ' : null}
              {notConverged(lastValid.mRelChangePercent) ? `M max-nál ${fmt.percent(lastValid.mRelChangePercent).value} %` : null} — érdemes lehet a
              modellben is nagyobb elemszámot beállítani.
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
