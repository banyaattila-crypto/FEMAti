/**
 * Izometrikus, extrudált hajlítófeszültség-vizualizáció — a felhasználó
 * kifejezett kérésére ("látványos outputok", egy valódi 3D-FEA von Mises
 * kontúrkép mintájára).
 *
 * FONTOS, ŐSZINTE KORLÁT: a FEMAti szigorúan 1D Timoshenko-gerendaelem-modell
 * (ld. `DESIGN-TERV.md` 11. pont, `STATUS_REPORT.md` 10. pont) — nincs 2D/3D
 * kontinuum-hálója, ezért ez NEM egy valódi kontinuum-FEA eredmény, és NEM
 * mutat geometriai törésponti (pl. gerinc/öv sarki) feszültségkoncentrációt.
 * Amit mutat: a σ = M(x)·z/I klasszikus, zárt alakú hajlítófeszültséget a
 * szélső szálon (z = ±h/2), a gerenda hossza mentén, egy leegyszerűsített
 * (téglatest-burkoló, NEM a tényleges szelvényalak) izometrikus extrudáláson
 * ábrázolva. A színskála ezért VALÓDI, a modellből számolt adat — csak a
 * geometria sematikus.
 */
import { interpolateAt } from './interpolate.js';

export const STRESS3D_HEIGHT = 300;

export interface Beam3DStressProps {
  readonly xs: readonly number[];
  readonly ms: readonly number[];
  /** Másodrendű nyomaték [m⁴] — a modell aktuális szelvényéből. */
  readonly inertia: number;
  /** Szelvénymagasság [mm] — a szélső szál z = ±h/2. */
  readonly sectionHeightMm: number;
}

const SEGMENTS = 36;

/** 5 megállójú "jet"-szerű kontúr-színskála, 0 (kék) → 1 (piros). */
const STOPS: readonly [number, string][] = [
  [0, '#2a5fb0'],
  [0.25, '#2fb0c9'],
  [0.5, '#5fbf7f'],
  [0.75, '#e0b23a'],
  [1, '#c93b2e'],
];

function hexToRgb(hex: string): readonly [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const LAST_STOP_COLOR = STOPS[STOPS.length - 1]?.[1] ?? '#c93b2e';

function jetColor(t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const stop0 = STOPS[i];
    const stop1 = STOPS[i + 1];
    if (stop0 === undefined || stop1 === undefined) continue;
    const [t0, c0] = stop0;
    const [t1, c1] = stop1;
    if (clamped >= t0 && clamped <= t1) {
      const f = t1 !== t0 ? (clamped - t0) / (t1 - t0) : 0;
      const [r0, g0, b0] = hexToRgb(c0);
      const [r1, g1, b1] = hexToRgb(c1);
      const r = Math.round(r0 + (r1 - r0) * f);
      const g = Math.round(g0 + (g1 - g0) * f);
      const b = Math.round(b0 + (b1 - b0) * f);
      return `rgb(${r},${g},${b})`;
    }
  }
  return LAST_STOP_COLOR;
}

const P0 = { x: 30, y: 190 };
const P1 = { x: 430, y: 60 };
const WIDTH_VEC = { x: 90, y: 26 };
const HEIGHT_VEC = { x: 0, y: 34 };

function lerpPoint(t: number): { readonly x: number; readonly y: number } {
  return { x: P0.x + (P1.x - P0.x) * t, y: P0.y + (P1.y - P0.y) * t };
}

export function Beam3DStress({ xs, ms, inertia, sectionHeightMm }: Beam3DStressProps): JSX.Element {
  const span = xs.length > 0 ? (xs[xs.length - 1] ?? 1) : 1;
  const zMax = sectionHeightMm / 2 / 1000; // [m]

  /** Szélső szál |σ| [MPa] adott x-nél — σ = M·z/I, kPa → MPa (/1000). */
  const stressAt = (x: number): number => {
    const m = interpolateAt(xs, ms, x) ?? 0;
    if (inertia <= 0) return 0;
    return (Math.abs(m) * zMax) / inertia / 1000;
  };

  let sigmaMax = 0;
  for (let i = 0; i <= SEGMENTS; i++) {
    sigmaMax = Math.max(sigmaMax, stressAt((i / SEGMENTS) * span));
  }
  if (sigmaMax === 0) sigmaMax = 1;

  const topFaces: JSX.Element[] = [];
  const frontFaces: JSX.Element[] = [];

  for (let i = 0; i < SEGMENTS; i++) {
    const t0 = i / SEGMENTS;
    const t1 = (i + 1) / SEGMENTS;
    const xMid = ((t0 + t1) / 2) * span;
    const color = jetColor(stressAt(xMid) / sigmaMax);

    const near0 = lerpPoint(t0);
    const near1 = lerpPoint(t1);
    const far0 = { x: near0.x + WIDTH_VEC.x, y: near0.y - WIDTH_VEC.y };
    const far1 = { x: near1.x + WIDTH_VEC.x, y: near1.y - WIDTH_VEC.y };
    const bot0 = { x: near0.x, y: near0.y + HEIGHT_VEC.y };
    const bot1 = { x: near1.x, y: near1.y + HEIGHT_VEC.y };

    topFaces.push(
      <polygon
        key={`top-${i}`}
        points={`${near0.x},${near0.y} ${near1.x},${near1.y} ${far1.x},${far1.y} ${far0.x},${far0.y}`}
        fill={color}
        stroke="#221d18"
        strokeWidth={0.4}
      />,
    );
    frontFaces.push(
      <polygon
        key={`front-${i}`}
        points={`${near0.x},${near0.y} ${near1.x},${near1.y} ${bot1.x},${bot1.y} ${bot0.x},${bot0.y}`}
        fill={color}
        fillOpacity={0.82}
        stroke="#221d18"
        strokeWidth={0.4}
      />,
    );
  }

  return (
    <svg width="100%" height={STRESS3D_HEIGHT} viewBox="0 0 460 300" role="img" aria-label="Extrudált szélső szál hajlítófeszültség, izometrikus">
      <title>Extrudált szélső szál hajlítófeszültség (σ = M·z/I), izometrikus, sematikus geometria</title>
      {frontFaces}
      {topFaces}
      <defs>
        <linearGradient id="vem-stress-legend" x1="0%" y1="0%" x2="100%" y2="0%">
          {STOPS.map(([t, c]) => (
            <stop key={t} offset={`${t * 100}%`} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <rect x="30" y="250" width="300" height="10" rx="2" fill="url(#vem-stress-legend)" stroke="var(--border-medium)" strokeWidth={0.75} />
      <text x="30" y="276" fontFamily="var(--font-mono)" fontSize="11" fill="var(--text-muted)">
        0 MPa
      </text>
      <text x="330" y="276" fontFamily="var(--font-mono)" fontSize="11" fill="var(--text-muted)" textAnchor="end">
        {sigmaMax.toFixed(1)} MPa
      </text>
      <text x="180" y="276" fontFamily="var(--font-mono)" fontSize="11" fill="var(--text-muted)" textAnchor="middle">
        szélső szál |σ|
      </text>
    </svg>
  );
}
