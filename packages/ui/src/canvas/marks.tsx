/**
 * Rajzjelek — DESIGN-TERV.md 5.3, magyar építőmérnöki konvenció szerint.
 * Minden jel a tengelyre (`y`) van igazítva, képernyő-koordinátákban kap
 * helyet; a modelltér átváltása a hívó dolga (`useModelTransform`).
 */

import type { SupportType } from '../data/catalog.js';

const SUPPORT = 'var(--sem-support)';
const LOAD = 'var(--sem-load)';

export interface SupportMarkProps {
  readonly x: number;
  readonly y: number;
  readonly type: SupportType;
}

export function SupportMark({ x, y, type }: SupportMarkProps): JSX.Element {
  if (type === 'fixed') {
    // Befogás: függőleges fal + 45°-os sraffozás a tartón kívül.
    const w = 9;
    const h = 30;
    return (
      <g aria-hidden="true">
        <line x1={x} y1={y - h} x2={x} y2={y + h} stroke={SUPPORT} strokeWidth={2.2} />
        {Array.from({ length: 7 }, (_, i) => {
          const yy = y - h + (i * 2 * h) / 6;
          return (
            <line
              key={i}
              x1={x}
              y1={yy}
              x2={x - w}
              y2={yy + w}
              stroke={SUPPORT}
              strokeWidth={1.1}
            />
          );
        })}
      </g>
    );
  }

  // Csuklós és görgős: háromszög csúcsával a csomópontra.
  const s = 11;
  const tri = `${x},${y} ${x - s},${y + s * 1.5} ${x + s},${y + s * 1.5}`;
  return (
    <g aria-hidden="true">
      <polygon points={tri} fill="none" stroke={SUPPORT} strokeWidth={1.6} />
      {type === 'roller' ? (
        <>
          <circle cx={x - s * 0.5} cy={y + s * 1.5 + 3.5} r={3.2} fill="none" stroke={SUPPORT} strokeWidth={1.2} />
          <circle cx={x + s * 0.5} cy={y + s * 1.5 + 3.5} r={3.2} fill="none" stroke={SUPPORT} strokeWidth={1.2} />
        </>
      ) : (
        <line
          x1={x - s * 1.3}
          y1={y + s * 1.5 + 2}
          x2={x + s * 1.3}
          y2={y + s * 1.5 + 2}
          stroke={SUPPORT}
          strokeWidth={1.6}
        />
      )}
    </g>
  );
}

export interface DistributedLoadProps {
  readonly x1: number;
  readonly x2: number;
  readonly y: number;
  /** A LEGNAGYOBB nyíl hossza képpontban — a kisebbik végponti intenzitáshoz tartozó nyíl ehhez képest arányosan rövidebb (trapéz alak). */
  readonly height?: number;
  /** Intenzitás a szakasz elején/végén — csak az ARÁNYuk számít a megjelenítésnél; ha egyenlő, a fedővonal vízszintes. */
  readonly q1?: number;
  readonly q2?: number;
  readonly label: string;
}

/**
 * Megoszló teher: fedővonal + egyenletesen elosztott nyilak. `q1`≠`q2`
 * esetén a fedővonal és a nyilak hossza LINEÁRISAN interpolál a két
 * végponti intenzitás között — ez adja a trapéz alakot. A nyilak száma
 * korlátozott (24), hogy sűrű hálónál se váljon zajjá.
 */
export function DistributedLoad({
  x1,
  x2,
  y,
  height = 26,
  q1 = 1,
  q2 = 1,
  label,
}: DistributedLoadProps): JSX.Element {
  const width = x2 - x1;
  const n = Math.max(2, Math.min(24, Math.round(width / 44)));
  const maxAbsQ = Math.max(Math.abs(q1), Math.abs(q2), 1e-9);
  const heightAt = (t: number): number => (height * ((1 - t) * Math.abs(q1) + t * Math.abs(q2))) / maxAbsQ;
  const topAt = (t: number): number => y - heightAt(t);
  return (
    <g>
      <path
        d={`M${x1},${topAt(0)} L${x2},${topAt(1)}`}
        stroke={LOAD}
        strokeWidth={1.4}
        fill="none"
      />
      {Array.from({ length: n + 1 }, (_, i) => {
        const t = i / n;
        const xx = x1 + t * width;
        return (
          <line
            key={i}
            x1={xx}
            y1={topAt(t)}
            x2={xx}
            y2={y - 3}
            stroke={LOAD}
            strokeWidth={1.1}
            markerEnd="url(#vem-arrow)"
            opacity={0.85}
          />
        );
      })}
      <text
        x={(x1 + x2) / 2}
        y={Math.min(topAt(0), topAt(1)) - 7}
        textAnchor="middle"
        fill="var(--text-muted)"
        style={{ font: "500 15px var(--font-mono)" }}
      >
        {label}
      </text>
    </g>
  );
}

export interface MomentLoadProps {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly radius?: number;
}

/** Koncentrált nyomatékteher: köríves nyíl a csomópont fölött. */
export function MomentLoad({ x, y, label, radius = 15 }: MomentLoadProps): JSX.Element {
  const cy = y - radius - 4;
  // 300°-os köríves nyíl (nem teljes kör, hogy a nyílhegy egyértelmű legyen).
  const startAngle = -40;
  const endAngle = 260;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const sx = x + radius * Math.cos(toRad(startAngle));
  const sy = cy + radius * Math.sin(toRad(startAngle));
  const ex = x + radius * Math.cos(toRad(endAngle));
  const ey = cy + radius * Math.sin(toRad(endAngle));
  return (
    <g>
      <path
        d={`M${sx.toFixed(2)},${sy.toFixed(2)} A${radius},${radius} 0 1 1 ${ex.toFixed(2)},${ey.toFixed(2)}`}
        stroke={LOAD}
        strokeWidth={2}
        fill="none"
        markerEnd="url(#vem-arrow)"
      />
      <text
        x={x}
        y={cy - radius - 6}
        textAnchor="middle"
        fill="var(--text-muted)"
        style={{ font: "500 15px var(--font-mono)" }}
      >
        {label}
      </text>
    </g>
  );
}

export interface PointLoadProps {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly height?: number;
}

export function PointLoad({ x, y, label, height = 46 }: PointLoadProps): JSX.Element {
  return (
    <g>
      <line
        x1={x}
        y1={y - height}
        x2={x}
        y2={y - 4}
        stroke={LOAD}
        strokeWidth={2}
        markerEnd="url(#vem-arrow)"
      />
      <text
        x={x + 7}
        y={y - height + 11}
        fill="var(--text-muted)"
        style={{ font: "500 15px var(--font-mono)" }}
      >
        {label}
      </text>
    </g>
  );
}

export interface NodeMarkProps {
  readonly x: number;
  readonly y: number;
  /** A középső (elem-belső) csomópont üres jelet kap. */
  readonly interior?: boolean;
}

export function NodeMark({ x, y, interior = false }: NodeMarkProps): JSX.Element {
  return (
    <circle
      cx={x}
      cy={y}
      r={2.6}
      fill={interior ? 'var(--surface-canvas)' : 'var(--text-secondary)'}
      stroke="var(--text-secondary)"
      strokeWidth={1}
    />
  );
}

/** Nyílhegy- és mintázat-definíciók; egyszer kell elhelyezni az SVG `defs` blokkjában. */
export function CanvasDefs(): JSX.Element {
  return (
    <defs>
      <marker
        id="vem-arrow"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="5"
        markerHeight="5"
        orient="auto"
      >
        <path d="M0,1 L9,5 L0,9 z" fill={LOAD} />
      </marker>

      {/* Színvakság-biztos mintázatok a képlékeny zónák jelöléséhez (DESIGN-TERV 2.2). */}
      <pattern id="vem-hatch-partial" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={6} height={6} fill="var(--sem-partial)" />
        <line x1={0} y1={0} x2={0} y2={6} stroke="var(--sem-partial-edge)" strokeWidth={2} />
      </pattern>
      <pattern id="vem-cross-plastic" width={6} height={6} patternUnits="userSpaceOnUse">
        <rect width={6} height={6} fill="var(--sem-plastic)" />
        <line x1={0} y1={0} x2={6} y2={6} stroke="var(--sem-plastic-edge)" strokeWidth={1.4} />
        <line x1={6} y1={0} x2={0} y2={6} stroke="var(--sem-plastic-edge)" strokeWidth={1.4} />
      </pattern>

      {/* Átmenetes ("shaded") kitöltés a lehajlási görbe alatt — a
          design-referencia hero-illusztrációjának "beam glow" gradiense
          (türkiz, a tengelytől elfelé fokozatosan átlátszóvá válva). */}
      <linearGradient id="vem-deform-glow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--sem-deformed)" stopOpacity="0.32" />
        <stop offset="100%" stopColor="var(--sem-deformed)" stopOpacity="0" />
      </linearGradient>

      {/* Finom mélység a deformált-alak vonalán, ugyanabból a referenciából.
          `--shadow-flood` már hordozza a saját alfa-értékét, ezért nincs
          külön `floodOpacity` — az duplán szorozta volna az átlátszóságot. */}
      <filter id="vem-beam-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="var(--shadow-flood)" />
      </filter>
    </defs>
  );
}

export type PlasticZoneKind = 'elastic' | 'partial' | 'plastic';

const ZONE_FILL: Record<PlasticZoneKind, string> = {
  elastic: 'var(--sem-elastic)',
  partial: 'url(#vem-hatch-partial)',
  plastic: 'url(#vem-cross-plastic)',
};

export interface PlasticZoneBarProps {
  readonly x1: number;
  readonly x2: number;
  readonly y: number;
  readonly kind: PlasticZoneKind;
}

/** Egy elem képlékenységi állapota a vászon tengelye alatt (P13 #2). */
export function PlasticZoneBar({ x1, x2, y, kind }: PlasticZoneBarProps): JSX.Element | null {
  if (kind === 'elastic') return null;
  return (
    <rect
      x={Math.min(x1, x2)}
      y={y + 8}
      width={Math.max(0, Math.abs(x2 - x1))}
      height={7}
      fill={ZONE_FILL[kind]}
      stroke={kind === 'plastic' ? 'var(--sem-plastic-edge)' : 'var(--sem-partial-edge)'}
      strokeWidth={0.6}
    />
  );
}

export interface GaussPointMarkProps {
  readonly x: number;
  readonly y: number;
  readonly yielded: boolean;
  readonly selected: boolean;
  readonly onClick: () => void;
  readonly label: string;
}

/** Kattintható Gauss-pont-jel — a keresztmetszet-inspektor (P13 #4) belépési pontja. */
export function GaussPointMark({ x, y, yielded, selected, onClick, label }: GaussPointMarkProps): JSX.Element {
  return (
    <g
      tabIndex={0}
      role="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{ cursor: 'pointer', outline: 'none' }}
    >
      {selected ? <circle cx={x} cy={y} r={8} fill="var(--accent-a10, rgba(120,170,255,0.25))" /> : null}
      <circle
        cx={x}
        cy={y}
        r={3.4}
        fill={yielded ? 'var(--sem-plastic)' : 'var(--surface-canvas)'}
        stroke={yielded ? 'var(--sem-plastic-edge)' : 'var(--sem-elastic-edge)'}
        strokeWidth={1.2}
      />
    </g>
  );
}
