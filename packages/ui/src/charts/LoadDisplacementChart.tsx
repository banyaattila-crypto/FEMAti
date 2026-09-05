/**
 * Teher–elmozdulás görbe — MASTER-PROMPT-TERV P13 prompt #3: "a pillanatnyi
 * állapot pontja mozog az idővonallal; a rugalmas egyenes referenciaként
 * bejelölve; a határteher vízszintes aszimptotája."
 *
 * Az x-tengely a referencia-csomópont lehajlása [mm] (mindig ugyanaz a
 * csomópont a teljes tehertörténetre — `NonlinearRun.referenceNodeIndex`,
 * ld. `model/nonlinear.ts`), az y-tengely a teherszorzó λ.
 */
import { useMemo } from 'react';
import { VIEW_WIDTH } from '../canvas/useModelTransform.js';
import { combinedSteps, nodalDisplacements, type NonlinearRun } from '../model/nonlinear.js';
import * as fmt from '../format/numbers.js';
import type { Lang } from '../state/appStore.js';
import { CHARTS } from '../i18n/charts.js';

export const LD_CHART_HEIGHT = 200;
const PAD_L = 64;
const PAD_R = 24;
const PAD_T = 20;
const PAD_B = 34;

export interface LoadDisplacementChartProps {
  readonly run: NonlinearRun;
  readonly activeStep: number;
  readonly lang?: Lang;
}

export function LoadDisplacementChart({ run, activeStep, lang = 'hu' }: LoadDisplacementChartProps): JSX.Element {
  const t = CHARTS[lang];
  const steps = combinedSteps(run);

  const points = useMemo(
    () =>
      steps.map((s) => {
        const nodal = nodalDisplacements(run.system, s.u);
        const w = nodal[run.referenceNodeIndex]?.w ?? 0;
        return { lambda: s.lambda, w: w * 1e3 }; // mm
      }),
    [steps, run],
  );

  const elasticWmm = run.elasticReferenceW * 1e3;
  const maxLambda = Math.max(1e-6, ...points.map((p) => p.lambda), run.peakLambda);
  const maxW = Math.max(1e-6, ...points.map((p) => Math.abs(p.w)), Math.abs(elasticWmm) * maxLambda);

  const innerW = VIEW_WIDTH - PAD_L - PAD_R;
  const innerH = LD_CHART_HEIGHT - PAD_T - PAD_B;
  const sx = (w: number): number => PAD_L + (Math.abs(w) / maxW) * innerW;
  const sy = (lambda: number): number => PAD_T + innerH - (lambda / maxLambda) * innerH;

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.w).toFixed(2)},${sy(p.lambda).toFixed(2)}`).join(' ');
  const elasticEndLambda = Math.min(maxLambda, elasticWmm !== 0 ? maxW / Math.abs(elasticWmm) : maxLambda);
  const elasticPath = `M${sx(0).toFixed(2)},${sy(0).toFixed(2)} L${sx(elasticEndLambda * elasticWmm).toFixed(2)},${sy(elasticEndLambda).toFixed(2)}`;

  const current = points[activeStep];
  const limitLambda = run.status === 'limit-load-reached' ? (run.loadingSteps.at(-1)?.lambda ?? null) : null;

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${LD_CHART_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={t.loadDisplacementAriaLabel(maxLambda.toFixed(3))}
      style={{ width: '100%', height: '100%' }}
    >
      {/* tengelyek */}
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + innerH} stroke="var(--border-medium)" strokeWidth={1} />
      <line x1={PAD_L} y1={PAD_T + innerH} x2={PAD_L + innerW} y2={PAD_T + innerH} stroke="var(--border-medium)" strokeWidth={1} />
      <text x={PAD_L} y={16} fill="var(--text-secondary)" style={{ font: '600 13px var(--font-ui)' }}>
        {t.loadDisplacementTitle}
      </text>
      <text x={PAD_L + innerW} y={LD_CHART_HEIGHT - 6} textAnchor="end" fill="var(--text-muted)" style={{ font: '500 13px var(--font-mono)' }}>
        |w| [mm]
      </text>
      <text x={4} y={PAD_T + 9} fill="var(--text-muted)" style={{ font: '500 13px var(--font-mono)' }}>
        λ
      </text>

      {/* rugalmas referencia-egyenes */}
      <path d={elasticPath} fill="none" stroke="var(--sem-analytic)" strokeWidth={1.4} strokeDasharray="5 3" />

      {/* határteher vízszintes aszimptotája */}
      {limitLambda !== null ? (
        <line
          x1={PAD_L}
          y1={sy(limitLambda)}
          x2={PAD_L + innerW}
          y2={sy(limitLambda)}
          stroke="var(--sem-plastic)"
          strokeWidth={1.2}
          strokeDasharray="2 3"
        />
      ) : null}

      {/* a görbe */}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} />

      {/* a pillanatnyi állapot pontja — az idővonallal mozog */}
      {current ? (
        <circle cx={sx(current.w)} cy={sy(current.lambda)} r={4.5} fill="var(--accent)" stroke="var(--surface-canvas)" strokeWidth={1.5} />
      ) : null}

      {limitLambda !== null ? (
        <text x={PAD_L + innerW} y={sy(limitLambda) - 5} textAnchor="end" fill="var(--sem-plastic)" style={{ font: '500 13px var(--font-mono)' }}>
          λ_u ≈ {fmt.lambda(limitLambda).value}
        </text>
      ) : null}
    </svg>
  );
}
