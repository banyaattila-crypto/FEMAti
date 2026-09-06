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
import { MESH_CONVERGENCE } from '../i18n/meshconvergence.js';
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
  const t = MESH_CONVERGENCE[useAppStore((s) => s.lang)];
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
            <h1>{t.title}</h1>
            <p className="vem-meshconv__subtitle">{t.subtitle(DEFAULT_MESH_CONVERGENCE_COUNTS.length)}</p>
          </div>
          <button type="button" className="vem-btn vem-btn--sm" onClick={close}>
            {t.close}
          </button>
        </header>

        <p className="vem-meshconv__intro">
          {t.intro(
            model.span.toFixed(1),
            model.sectionId,
            model.materialId,
            DEFAULT_MESH_CONVERGENCE_COUNTS[0] as number,
            DEFAULT_MESH_CONVERGENCE_COUNTS[DEFAULT_MESH_CONVERGENCE_COUNTS.length - 1] as number,
            CONVERGED_THRESHOLD_PERCENT,
          )}
        </p>

        <table>
          <thead>
            <tr>
              <th>{t.colElementCount}</th>
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
          {t.note}
          {lastValid !== undefined && (notConverged(lastValid.wRelChangePercent) || notConverged(lastValid.mRelChangePercent)) ? (
            <>
              {' '}
              {t.notConvergedLead}{' '}
              {notConverged(lastValid.wRelChangePercent) ? t.notConvergedW(String(fmt.percent(lastValid.wRelChangePercent).value)) : null}
              {notConverged(lastValid.wRelChangePercent) && notConverged(lastValid.mRelChangePercent) ? ', ' : null}
              {notConverged(lastValid.mRelChangePercent) ? t.notConvergedM(String(fmt.percent(lastValid.mRelChangePercent).value)) : null}{' '}
              {t.notConvergedTail}
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
