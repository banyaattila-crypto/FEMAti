/**
 * Idő–válasz görbe a dinamikai válasz (tranziens, Newmark-β) fülhöz — a
 * `LoadDisplacementChart.tsx` kézzel rajzolt SVG-mintáját követi.
 *
 * Az x-tengely az idő [s], az y-tengely a referencia-csomópont (`DynamicRun.
 * referenceNodeIndex` — a teljes futás alatt legnagyobb |w|-t elérő
 * csomópont) lehajlása [mm] VAGY gyorsulása [m/s²] — a `quantity` prop
 * dönti el; a `TransientStep` amúgy is tárolja mindkettőt (és a sebességet
 * is), ezért ez a váltás gyakorlatilag ingyen jött.
 */
import { useMemo } from 'react';
import { VIEW_WIDTH } from '../canvas/useModelTransform.js';
import type { DynamicRun } from '../model/dynamicRun.js';
import * as fmt from '../format/numbers.js';

export const TRANSIENT_CHART_HEIGHT = 200;
const PAD_L = 64;
const PAD_R = 24;
const PAD_T = 20;
const PAD_B = 34;

export type TransientQuantity = 'w' | 'a';

export interface TransientChartProps {
  readonly run: DynamicRun;
  readonly quantity: TransientQuantity;
}

export function TransientChart({ run, quantity }: TransientChartProps): JSX.Element {
  const points = useMemo(
    () =>
      run.result.steps.map((s) => {
        const dof = 2 * run.referenceNodeIndex;
        const raw = quantity === 'w' ? (s.displacement[dof] ?? 0) : (s.acceleration[dof] ?? 0);
        return { t: s.t, value: quantity === 'w' ? raw * 1e3 : raw }; // w: mm, a: m/s²
      }),
    [run, quantity],
  );

  const maxT = Math.max(1e-9, ...points.map((p) => p.t));
  const maxAbsValue = Math.max(1e-9, ...points.map((p) => Math.abs(p.value)));

  const innerW = VIEW_WIDTH - PAD_L - PAD_R;
  const innerH = TRANSIENT_CHART_HEIGHT - PAD_T - PAD_B;
  const sx = (t: number): number => PAD_L + (t / maxT) * innerW;
  const sy = (v: number): number => PAD_T + innerH / 2 - (v / maxAbsValue) * (innerH / 2);

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.t).toFixed(2)},${sy(p.value).toFixed(2)}`).join(' ');
  const zeroY = sy(0);
  const label = quantity === 'w' ? 'w — lehajlás' : 'a — gyorsulás';
  const format = quantity === 'w' ? fmt.deflection : fmt.acceleration;
  const peak = points.reduce((max, p) => (Math.abs(p.value) > Math.abs(max.value) ? p : max), points[0] ?? { t: 0, value: 0 });
  const referenceX = (run.model.nodes[run.referenceNodeIndex]?.x as number | undefined) ?? 0;

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${TRANSIENT_CHART_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Idő–${label} görbe, csomópont x ≈ ${referenceX.toFixed(2)} m, csúcsérték ${format(peak.value).value} ${format(peak.value).unit}`}
      style={{ width: '100%', height: '100%' }}
    >
      {/* tengelyek */}
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + innerH} stroke="var(--border-medium)" strokeWidth={1} />
      <line x1={PAD_L} y1={zeroY} x2={PAD_L + innerW} y2={zeroY} stroke="var(--border-medium)" strokeWidth={1} />
      <text x={PAD_L} y={16} fill="var(--text-secondary)" style={{ font: '600 13px var(--font-ui)' }}>
        {label} — idő
      </text>
      <text x={PAD_L + innerW} y={TRANSIENT_CHART_HEIGHT - 6} textAnchor="end" fill="var(--text-muted)" style={{ font: '500 13px var(--font-mono)' }}>
        t [s]
      </text>
      <text x={4} y={PAD_T + 9} fill="var(--text-muted)" style={{ font: '500 13px var(--font-mono)' }}>
        {quantity === 'w' ? 'w [mm]' : 'a [m/s²]'}
      </text>

      {/* a görbe */}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={1.6} />

      {/* csúcsérték jelölése */}
      <circle cx={sx(peak.t)} cy={sy(peak.value)} r={4} fill="var(--accent)" stroke="var(--surface-canvas)" strokeWidth={1.5} />
      <text x={sx(peak.t)} y={sy(peak.value) - 8} textAnchor="middle" fill="var(--text-muted)" style={{ font: '500 12px var(--font-mono)' }}>
        {format(peak.value).value} {format(peak.value).unit}
      </text>
    </svg>
  );
}
