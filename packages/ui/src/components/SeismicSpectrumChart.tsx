import { useId, useMemo } from 'react';
import { useAppStore } from '../state/appStore.js';
import { SHELL } from '../i18n/shell.js';
import { verticalDesignSpectrum, type VerticalSpectrumInput } from '@femati/fem-core';

export interface SeismicSpectrumChartProps {
  readonly input: VerticalSpectrumInput;
  readonly behaviorFactor: number;
  /** A modell tényleges első sajátperiódusa [s] — `null`, ha a modális analízis nem futtatható (pl. mechanizmus). */
  readonly t1: number | null;
  readonly width?: number;
  readonly height?: number;
}

const W = 260;
const H = 140;
const MARGIN_L = 30;
const MARGIN_T = 10;
const MARGIN_R = 10;
const MARGIN_B = 22;
const PLOT_W = W - MARGIN_L - MARGIN_R;
const PLOT_H = H - MARGIN_T - MARGIN_B;
/** A plató + a leszálló ág eleje — tipikus gerenda-sajátperiódusokhoz (jóval TD=1.0s alatt) elég. */
const T_MAX = 1.2;
const SAMPLE_COUNT = 80;

const AXIS_STROKE = 'var(--border-strong, var(--text-faint))';
const AXIS_TEXT = 'var(--text-secondary)';

/**
 * Svd(T) függőleges tervezési válaszspektrum-görbe, a modell tényleges
 * T₁ sajátperiódusával megjelölve (2026-09-06, EC8 földrengés-kombináció,
 * ld. `docs/ADR/0023-fuggoleges-foldrenges-kombinacio.md`) — ugyanaz a
 * plain-SVG, CSS-token-alapú rajzoló-stílus, mint `SectionShapeDiagram.tsx`.
 */
export function SeismicSpectrumChart({ input, behaviorFactor, t1, width, height }: SeismicSpectrumChartProps): JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const areaGradientId = `seismic-spectrum-${useId()}`;

  const samples = useMemo(() => {
    const points: { readonly t: number; readonly v: number }[] = [];
    for (let i = 0; i <= SAMPLE_COUNT; i++) {
      const t = (T_MAX * i) / SAMPLE_COUNT;
      points.push({ t, v: verticalDesignSpectrum(t, input, behaviorFactor) });
    }
    return points;
  }, [input, behaviorFactor]);

  const maxV = Math.max(...samples.map((p) => p.v), 1e-9);
  const x = (t: number): number => MARGIN_L + (t / T_MAX) * PLOT_W;
  const y = (v: number): number => MARGIN_T + PLOT_H - (v / maxV) * PLOT_H;
  const baseline = MARGIN_T + PLOT_H;

  const linePath = samples.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(2)},${y(p.v).toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L${x(T_MAX).toFixed(2)},${baseline.toFixed(2)} L${x(0).toFixed(2)},${baseline.toFixed(2)} Z`;

  const t1Clamped = t1 !== null && Number.isFinite(t1) ? Math.min(Math.max(t1, 0), T_MAX) : null;
  const t1Value = t1Clamped !== null ? verticalDesignSpectrum(t1Clamped, input, behaviorFactor) : null;

  const w = width ?? W;
  const h = height ?? H;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: w, height: h, flex: 'none' }} role="img" aria-label={SHELL[lang].seismicSpectrumAria}>
      <defs>
        <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <line x1={MARGIN_L} y1={MARGIN_T} x2={MARGIN_L} y2={baseline} stroke={AXIS_STROKE} strokeWidth={0.8} />
      <line x1={MARGIN_L} y1={baseline} x2={MARGIN_L + PLOT_W} y2={baseline} stroke={AXIS_STROKE} strokeWidth={0.8} />

      <path d={areaPath} fill={`url(#${areaGradientId})`} stroke="none" />
      <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={1.4} />

      {t1Clamped !== null && t1Value !== null ? (
        <g aria-hidden="true">
          <line
            x1={x(t1Clamped)}
            y1={y(t1Value)}
            x2={x(t1Clamped)}
            y2={baseline}
            stroke="var(--sem-plastic)"
            strokeWidth={0.8}
            strokeDasharray="3 2"
          />
          <circle cx={x(t1Clamped)} cy={y(t1Value)} r={3} fill="var(--sem-plastic)" />
          <text x={x(t1Clamped)} y={baseline + 12} fontSize={8} fontFamily="var(--font-mono)" fill={AXIS_TEXT} textAnchor="middle">
            T₁={t1Clamped.toFixed(2)}s
          </text>
        </g>
      ) : null}

      <text x={MARGIN_L - 4} y={baseline} fontSize={8} fontFamily="var(--font-mono)" fill={AXIS_TEXT} textAnchor="end" dominantBaseline="middle">
        0
      </text>
      <text x={MARGIN_L - 4} y={MARGIN_T + 4} fontSize={8} fontFamily="var(--font-mono)" fill={AXIS_TEXT} textAnchor="end">
        {maxV.toFixed(2)}
      </text>
      <text x={4} y={MARGIN_T - 2} fontSize={7.5} fontFamily="var(--font-mono)" fill={AXIS_TEXT} textAnchor="start">
        Svd/g
      </text>
      <text x={MARGIN_L + PLOT_W} y={H - 2} fontSize={7.5} fontFamily="var(--font-mono)" fill={AXIS_TEXT} textAnchor="end">
        T [s]
      </text>
    </svg>
  );
}
