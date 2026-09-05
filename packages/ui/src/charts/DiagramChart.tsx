/**
 * Egyetlen igénybevétel/elmozdulás-diagram — MASTER-PROMPT-TERV P8 prompt +
 * DESIGN-TERV 5.4.
 *
 * - Közös x-tengely a modellvászonnal (ugyanaz az `sx` leképezés, ld.
 *   `useModelTransform`), hogy a diagram és a gerendarajz vizuálisan
 *   összehangolt legyen.
 * - Szélsőérték felirat (érték + hely).
 * - Nullátmenetek jelölve.
 * - Elemenkénti hibabecslő-sáv az x-tengely alatt, színkóddal.
 * - Analitikus referencia (ha van) szaggatott vonallal.
 */
import { useCallback, useId, useRef } from 'react';
import { AXIS_X0, AXIS_X1, VIEW_WIDTH } from '../canvas/useModelTransform.js';
import { findExtreme, interpolateAt } from './interpolate.js';
import { jetColor } from './colormap.js';
import type { Formatted } from '../format/numbers.js';
import type { Lang } from '../state/appStore.js';
import { CHARTS } from '../i18n/charts.js';

export const CHART_HEIGHT = 132;
const BASELINE = 58;
const AMPLITUDE = 40;
const ERROR_BAND_Y = 116;
const ERROR_BAND_H = 8;

export interface ChartElementSpan {
  readonly x1: number;
  readonly x2: number;
  readonly errorEstimate: number;
}

export interface DiagramChartProps {
  readonly title: string;
  readonly xs: readonly number[];
  readonly ys: readonly number[];
  readonly analyticYs?: readonly number[];
  readonly span: number;
  readonly elements: readonly ChartElementSpan[];
  readonly format: (v: number | null) => Formatted;
  /** Csak az M ábránál értelmezett: a görbe tükrözése a húzott oldal konvenciója szerint. */
  readonly flip?: boolean;
  readonly hoverX: number | null;
  readonly onHoverX: (x: number | null) => void;
  readonly svgRef?: (el: SVGSVGElement | null) => void;
  readonly lang?: Lang;
}

function errorColor(pct: number): string {
  if (pct <= 5) return 'var(--sem-ok)';
  if (pct <= 20) return 'var(--sem-warn)';
  return 'var(--sem-error)';
}

/** A diagram-y-koordinátája: a legnagyobb |érték| az AMPLITUDE pixelnek felel meg. */
function makeScale(ys: readonly number[], analyticYs: readonly number[] | undefined, flip: boolean) {
  const all = analyticYs ? [...ys, ...analyticYs] : ys;
  const maxAbs = all.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const sign = flip ? -1 : 1;
  return (v: number): number => BASELINE - sign * (v / maxAbs) * AMPLITUDE;
}

export function DiagramChart({
  title,
  xs,
  ys,
  analyticYs,
  span,
  elements,
  format,
  flip = false,
  hoverX,
  onHoverX,
  svgRef,
  lang = 'hu',
}: DiagramChartProps): JSX.Element {
  const t = CHARTS[lang];
  const localRef = useRef<SVGSVGElement | null>(null);
  const gradientId = `vem-heat-${useId()}`;

  const sx = useCallback((x: number): number => AXIS_X0 + (x / span) * (AXIS_X1 - AXIS_X0), [span]);
  const sy = makeScale(ys, analyticYs, flip);

  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(2)},${sy(ys[i] ?? 0).toFixed(2)}`).join(' ');
  const areaPath = xs.length > 0 ? `${path} L${sx(xs[xs.length - 1] ?? 0).toFixed(2)},${BASELINE} L${sx(xs[0] ?? 0).toFixed(2)},${BASELINE} Z` : '';
  const analyticPath = analyticYs
    ? xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(2)},${sy(analyticYs[i] ?? 0).toFixed(2)}`).join(' ')
    : null;

  // Hőtérkép-jellegű kitöltés/vonal — a szín az ADATON (a mező nagyságán)
  // él, nem dekoráció (2026-08-29 újratervezés, ANSYS/GstarCAD referencia
  // alapján: "a szín az adaton legyen, ne a kereten"). |y|/maxAbs → jet
  // színskála, ugyanaz, mint a 3D feszültségképen (`colormap.ts`).
  const maxAbsForColor = Math.max(...ys.map((v) => Math.abs(v)), 1e-12);
  const HEAT_STEPS = 24;
  const heatStops = Array.from({ length: HEAT_STEPS + 1 }, (_, i) => {
    const t = i / HEAT_STEPS;
    const x = t * span;
    const y = interpolateAt(xs, ys, x) ?? 0;
    return { offset: t * 100, color: jetColor(Math.abs(y) / maxAbsForColor) };
  });

  const extreme = findExtreme(xs, ys);
  const hoverY = hoverX !== null ? interpolateAt(xs, ys, hoverX) : null;

  const onMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>): void => {
      const svg = localRef.current;
      if (svg === null) return;
      const ctm = svg.getScreenCTM();
      if (ctm === null) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const p = pt.matrixTransform(ctm.inverse());
      const x = Math.min(Math.max(((p.x - AXIS_X0) / (AXIS_X1 - AXIS_X0)) * span, 0), span);
      onHoverX(x);
    },
    [span, onHoverX],
  );

  // Nullátmenetek (előjelváltás két szomszédos csomópont között).
  const zeroCrossings: number[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const y0 = ys[i] ?? 0;
    const y1 = ys[i + 1] ?? 0;
    if ((y0 > 0 && y1 < 0) || (y0 < 0 && y1 > 0)) {
      const x0 = xs[i] ?? 0;
      const x1 = xs[i + 1] ?? 0;
      const t = y0 - y1 !== 0 ? y0 / (y0 - y1) : 0;
      zeroCrossings.push(x0 + t * (x1 - x0));
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg
        ref={(el) => {
          localRef.current = el;
          svgRef?.(el);
        }}
        viewBox={`0 0 ${VIEW_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t.diagramAriaLabel(title, extreme ? format(extreme.value).value + ' ' + format(extreme.value).unit : '—')}
        style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
        onPointerMove={onMove}
        onPointerLeave={() => onHoverX(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            {heatStops.map((s, i) => (
              <stop key={i} offset={`${s.offset}%`} stopColor={s.color} />
            ))}
          </linearGradient>
        </defs>

        {/* alapvonal */}
        <line x1={AXIS_X0} y1={BASELINE} x2={AXIS_X1} y2={BASELINE} stroke="var(--border-medium)" strokeWidth={1} />

        {/* hibabecslő-sáv elemenként */}
        {elements.map((e, i) => (
          <rect
            key={i}
            x={sx(e.x1)}
            y={ERROR_BAND_Y}
            width={Math.max(0, sx(e.x2) - sx(e.x1))}
            height={ERROR_BAND_H}
            fill={errorColor(e.errorEstimate)}
            opacity={0.75}
          />
        ))}

        {/* analitikus referencia */}
        {analyticPath ? (
          <path d={analyticPath} fill="none" stroke="var(--sem-analytic)" strokeWidth={1.4} strokeDasharray="5 3" />
        ) : null}

        {/* kitöltés + kontúr — hőtérkép-színezve a mező nagysága szerint */}
        {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} opacity={0.55} /> : null}
        <path d={path} fill="none" stroke={`url(#${gradientId})`} strokeWidth={2.5} />

        {/* nullátmenetek */}
        {zeroCrossings.map((x, i) => (
          <circle key={i} cx={sx(x)} cy={BASELINE} r={2.4} fill="var(--text-faint)" />
        ))}

        {/* szélsőérték felirat — mindig a legforróbb (piros) szín, hiszen a szélsőérték a maximum */}
        {extreme ? (
          <g>
            <circle cx={sx(extreme.x)} cy={sy(extreme.value)} r={3.5} fill={jetColor(1)} stroke="var(--surface-canvas)" strokeWidth={1} />
            <text
              x={sx(extreme.x)}
              y={sy(extreme.value) + (extreme.value >= 0 ? -11 : 22)}
              textAnchor="middle"
              fill="var(--text-muted)"
              style={{ font: '500 13px var(--font-mono)' }}
            >
              {format(extreme.value).value} {format(extreme.value).unit} @ {extreme.x.toFixed(2)} m
            </text>
          </g>
        ) : null}

        {/* hover-kereszthaj */}
        {hoverX !== null ? (
          <g>
            <line x1={sx(hoverX)} y1={4} x2={sx(hoverX)} y2={CHART_HEIGHT - 4} stroke="var(--text-faint)" strokeWidth={1} strokeDasharray="3 2" />
            {hoverY !== null ? (
              <circle
                cx={sx(hoverX)}
                cy={sy(hoverY)}
                r={3.5}
                fill={jetColor(Math.abs(hoverY) / maxAbsForColor)}
                stroke="var(--surface-canvas)"
                strokeWidth={1}
              />
            ) : null}
          </g>
        ) : null}

        {/* cím + tükrözés-jelzés */}
        <text x={AXIS_X0} y={17} fill="var(--text-secondary)" style={{ font: '600 13px var(--font-ui)' }}>
          {title}
          {flip ? t.tensionSideSuffix : ''}
        </text>
      </svg>
    </div>
  );
}
