/**
 * Mozgó teher — burkolóábra (2026-09-04). Egy sáv-kitöltés a lehetséges
 * legnagyobb/legkisebb M (vagy T) között, ahogy a mozgó pontteher
 * végigsétál a tartón — `model/envelope.ts` `computeEnvelope()`. NEM a
 * `DiagramChart`-ot bővíti (az egyetlen görbére/hőtérkép-színezésre épül,
 * ami itt nem értelmezhető), hanem önálló, kis SVG-komponens — ugyanaz a
 * minta, mint `LoadDisplacementChart.tsx`/`ConvergencePanel.tsx`.
 */
import { useState } from 'react';
import { SegmentedControl } from '../components/Button.js';
import { VIEW_WIDTH } from '../canvas/useModelTransform.js';
import type { EnvelopeResult } from '../model/envelope.js';
import * as fmt from '../format/numbers.js';
import type { Lang } from '../state/appStore.js';
import { CHARTS } from '../i18n/charts.js';

export const ENVELOPE_CHART_HEIGHT = 200;
const PAD_L = 64;
const PAD_R = 24;
const PAD_T = 28;
const PAD_B = 34;

export interface EnvelopeChartProps {
  readonly result: EnvelopeResult;
  readonly span: number;
  readonly lang?: Lang;
}

export function EnvelopeChart({ result, span, lang = 'hu' }: EnvelopeChartProps): JSX.Element {
  const t = CHARTS[lang];
  const [field, setField] = useState<'M' | 'T'>('M');
  const ys = field === 'M' ? { max: result.mMax, min: result.mMin } : { max: result.tMax, min: result.tMin };
  const formatValue = field === 'M' ? fmt.moment : fmt.shear;

  const innerW = VIEW_WIDTH - PAD_L - PAD_R;
  const innerH = ENVELOPE_CHART_HEIGHT - PAD_T - PAD_B;
  const maxAbs = Math.max(1e-6, ...ys.max.map(Math.abs), ...ys.min.map(Math.abs));
  const sx = (x: number): number => PAD_L + (span > 0 ? x / span : 0) * innerW;
  const sy = (v: number): number => PAD_T + innerH / 2 - (v / maxAbs) * (innerH / 2);

  const maxPath = result.xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(2)},${sy(ys.max[i] ?? 0).toFixed(2)}`).join(' ');
  const minPath = result.xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(2)},${sy(ys.min[i] ?? 0).toFixed(2)}`).join(' ');
  const minPathReversed = [...result.xs]
    .map((x, i) => ({ x, v: ys.min[i] ?? 0 }))
    .reverse()
    .map((p) => `L${sx(p.x).toFixed(2)},${sy(p.v).toFixed(2)}`)
    .join(' ');
  const bandPath = `${maxPath} ${minPathReversed} Z`;

  const peakMax = Math.max(...ys.max);
  const peakMin = Math.min(...ys.min);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <div style={{ padding: '2px var(--space-6)', flex: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <SegmentedControl
          ariaLabel={t.envelopeFieldAria}
          value={field}
          onChange={setField}
          options={[
            { value: 'M', label: 'M' },
            { value: 'T', label: 'T' },
          ]}
        />
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          max {formatValue(peakMax).value} {formatValue(peakMax).unit} · min {formatValue(peakMin).value} {formatValue(peakMin).unit}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${ENVELOPE_CHART_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t.envelopeChartAria(field)}
        style={{ width: '100%', flex: '1 1 auto' }}
      >
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + innerH} stroke="var(--border-medium)" strokeWidth={1} />
        <line
          x1={PAD_L}
          y1={PAD_T + innerH / 2}
          x2={PAD_L + innerW}
          y2={PAD_T + innerH / 2}
          stroke="var(--border-medium)"
          strokeWidth={1}
        />
        <path d={bandPath} fill="var(--tab-envelope)" opacity={0.28} />
        <path
          d={maxPath}
          fill="none"
          stroke="var(--tab-envelope)"
          strokeWidth={2}
        />
        <path d={minPath} fill="none" stroke="var(--tab-envelope)" strokeWidth={2} strokeDasharray="5 3" />
      </svg>
    </div>
  );
}
