/**
 * Rajzjelek — DESIGN-TERV.md 5.3, magyar építőmérnöki konvenció szerint.
 * Minden jel a tengelyre (`y`) van igazítva, képernyő-koordinátákban kap
 * helyet; a modelltér átváltása a hívó dolga (`useModelTransform`).
 */

import type { SupportType } from '../data/catalog.js';

/** Típusonkénti teher-/támaszszín (2026-08-30, felhasználói kérés) — a `design/tokens.css` `--sem-load-*`/`--sem-support-*` tokenjeire mutat. */
export const SUPPORT_COLOR: Record<SupportType, string> = {
  fixed: 'var(--sem-support-fixed)',
  pinned: 'var(--sem-support-pinned)',
  roller: 'var(--sem-support-roller)',
  spring: 'var(--sem-support-spring)',
};
export const FOUNDATION_COLOR = 'var(--sem-support-foundation)';
export type LoadColorKind = 'point' | 'moment' | 'distributed' | 'distributed-moment';
export const LOAD_COLOR: Record<LoadColorKind, string> = {
  point: 'var(--sem-load-point)',
  moment: 'var(--sem-load-moment)',
  distributed: 'var(--sem-load-distributed)',
  'distributed-moment': 'var(--sem-load-distributed-moment)',
};
/** A `CanvasDefs`-ben definiált, tehertípusonkénti nyílhegy-marker azonosítója. */
export const arrowMarkerId = (kind: LoadColorKind): string => `vem-arrow-${kind}`;

export interface SupportMarkProps {
  readonly x: number;
  readonly y: number;
  readonly type: SupportType;
}

export function SupportMark({ x, y, type }: SupportMarkProps): JSX.Element {
  const color = SUPPORT_COLOR[type];

  if (type === 'fixed') {
    // Befogás: függőleges fal + 45°-os sraffozás a tartón kívül.
    const w = 9;
    const h = 30;
    return (
      <g aria-hidden="true">
        <line x1={x} y1={y - h} x2={x} y2={y + h} stroke={color} strokeWidth={2.2} />
        {Array.from({ length: 7 }, (_, i) => {
          const yy = y - h + (i * 2 * h) / 6;
          return (
            <line
              key={i}
              x1={x}
              y1={yy}
              x2={x - w}
              y2={yy + w}
              stroke={color}
              strokeWidth={1.1}
            />
          );
        })}
      </g>
    );
  }

  if (type === 'spring') {
    // Rugós támasz: cikkcakk (rugó-) vonal a csomópont alatt, két rögzítő szárral.
    const h = 30;
    const zigzags = 5;
    const w = 6;
    const points: string[] = [`${x},${y}`];
    for (let i = 1; i <= zigzags; i++) {
      const yy = y + (i * h) / (zigzags + 1);
      points.push(`${x + (i % 2 === 1 ? w : -w)},${yy}`);
    }
    points.push(`${x},${y + h}`);
    return (
      <g aria-hidden="true">
        <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
        <line x1={x - 10} y1={y + h} x2={x + 10} y2={y + h} stroke={color} strokeWidth={1.6} />
      </g>
    );
  }

  // Csuklós és görgős: háromszög csúcsával a csomópontra.
  const s = 11;
  const tri = `${x},${y} ${x - s},${y + s * 1.5} ${x + s},${y + s * 1.5}`;
  return (
    <g aria-hidden="true">
      <polygon points={tri} fill="none" stroke={color} strokeWidth={1.6} />
      {type === 'roller' ? (
        <>
          <circle cx={x - s * 0.5} cy={y + s * 1.5 + 3.5} r={3.2} fill="none" stroke={color} strokeWidth={1.2} />
          <circle cx={x + s * 0.5} cy={y + s * 1.5 + 3.5} r={3.2} fill="none" stroke={color} strokeWidth={1.2} />
        </>
      ) : (
        <line
          x1={x - s * 1.3}
          y1={y + s * 1.5 + 2}
          x2={x + s * 1.3}
          y2={y + s * 1.5 + 2}
          stroke={color}
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
  readonly color?: string;
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
  color = LOAD_COLOR.distributed,
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
        stroke={color}
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
            stroke={color}
            strokeWidth={1.1}
            markerEnd={`url(#${arrowMarkerId('distributed')})`}
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
  readonly color?: string;
}

/** Koncentrált nyomatékteher: köríves nyíl a csomópont fölött. */
export function MomentLoad({ x, y, label, radius = 15, color = LOAD_COLOR.moment }: MomentLoadProps): JSX.Element {
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
        stroke={color}
        strokeWidth={2}
        fill="none"
        markerEnd={`url(#${arrowMarkerId('moment')})`}
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
  readonly color?: string;
}

export function PointLoad({ x, y, label, height = 46, color = LOAD_COLOR.point }: PointLoadProps): JSX.Element {
  return (
    <g>
      <line
        x1={x}
        y1={y - height}
        x2={x}
        y2={y - 4}
        stroke={color}
        strokeWidth={2}
        markerEnd={`url(#${arrowMarkerId('point')})`}
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

export interface DistributedMomentLoadProps {
  readonly x1: number;
  readonly x2: number;
  readonly y: number;
  readonly label: string;
  readonly color?: string;
}

/** Megoszló nyomatékteher: kis köríves nyilak sorozata a szakasz mentén — a `MomentLoad` megoszló párja. */
export function DistributedMomentLoad({ x1, x2, y, label, color = LOAD_COLOR['distributed-moment'] }: DistributedMomentLoadProps): JSX.Element {
  const width = x2 - x1;
  const n = Math.max(2, Math.min(10, Math.round(width / 60)));
  const radius = 9;
  const cy = y - radius - 14;
  const startAngle = -40;
  const endAngle = 260;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  return (
    <g>
      <line x1={x1} y1={cy} x2={x2} y2={cy} stroke={color} strokeWidth={1} opacity={0.6} />
      {Array.from({ length: n + 1 }, (_, i) => {
        const t = i / n;
        const xx = x1 + t * width;
        const sx = xx + radius * Math.cos(toRad(startAngle));
        const sy = cy + radius * Math.sin(toRad(startAngle));
        const ex = xx + radius * Math.cos(toRad(endAngle));
        const ey = cy + radius * Math.sin(toRad(endAngle));
        return (
          <path
            key={i}
            d={`M${sx.toFixed(2)},${sy.toFixed(2)} A${radius},${radius} 0 1 1 ${ex.toFixed(2)},${ey.toFixed(2)}`}
            stroke={color}
            strokeWidth={1.4}
            fill="none"
            markerEnd={`url(#${arrowMarkerId('distributed-moment')})`}
            opacity={0.85}
          />
        );
      })}
      <text x={(x1 + x2) / 2} y={cy - radius - 6} textAnchor="middle" fill="var(--text-muted)" style={{ font: "500 15px var(--font-mono)" }}>
        {label}
      </text>
    </g>
  );
}

export interface FoundationProps {
  readonly x1: number;
  readonly x2: number;
  readonly y: number;
  readonly label: string;
}

/** Winkler-féle rugalmas ágyazat: talaj-sraffozás a gerinc alatt. */
export function Foundation({ x1, x2, y, label }: FoundationProps): JSX.Element {
  const depth = 14;
  const n = Math.max(3, Math.min(30, Math.round((x2 - x1) / 12)));
  return (
    <g aria-hidden="true">
      <line x1={x1} y1={y + 2} x2={x2} y2={y + 2} stroke={FOUNDATION_COLOR} strokeWidth={1.6} />
      {Array.from({ length: n + 1 }, (_, i) => {
        const xx = x1 + (i * (x2 - x1)) / n;
        return <line key={i} x1={xx} y1={y + 2} x2={xx - 5} y2={y + 2 + depth} stroke={FOUNDATION_COLOR} strokeWidth={1} />;
      })}
      <text x={(x1 + x2) / 2} y={y + 2 + depth + 14} textAnchor="middle" fill="var(--text-muted)" style={{ font: "500 13px var(--font-mono)" }}>
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
      {/* "Kék papír" rácsminta a vászon hátterén (2026-09-02, felhasználói
          kérés: "a canvas is legyen színesebb") — a korábbi teljesen sima,
          egyszínű háttér helyett egy finom, mérnöki-rajzasztal jellegű
          rács, a márka türkizébe hangolva. A finom rács 20px-enként, az
          erősebb fővonalak 100px-enként (5 finom cellánként) — ez a
          klasszikus "blueprint" arány. Screen-space (nem a modell-
          koordinátákkal skálázódik), mert a vászon zoom/pan-tartománya
          (0.5×–6×) mellett egy modell-térbe kötött rács vagy túl sűrű, vagy
          túl ritka lenne a szélsőértékeknél. */}
      <pattern id="vem-grid-minor" width={20} height={20} patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--accent)" strokeOpacity={0.05} strokeWidth={1} />
      </pattern>
      <pattern id="vem-grid-major" width={100} height={100} patternUnits="userSpaceOnUse">
        <rect width={100} height={100} fill="url(#vem-grid-minor)" />
        <path d="M 100 0 L 0 0 0 100" fill="none" stroke="var(--accent)" strokeOpacity={0.12} strokeWidth={1} />
      </pattern>
      {/* Nagyon halvány, közép felé melegedő türkiz derengés a rács fölött —
          a cél, hogy a vászon KÖZEPE (ahol a modell van) vizuálisan a
          fókuszpont legyen, a sarkok pedig egy árnyalattal semlegesebbek. */}
      <radialGradient id="vem-canvas-vignette" cx="50%" cy="42%" r="75%">
        <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.05" />
        <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
      </radialGradient>

      {(Object.keys(LOAD_COLOR) as LoadColorKind[]).map((kind) => (
        <marker
          key={kind}
          id={arrowMarkerId(kind)}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M0,1 L9,5 L0,9 z" fill={LOAD_COLOR[kind]} />
        </marker>
      ))}

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
      {selected ? <circle cx={x} cy={y} r={8} fill="var(--accent-a10)" /> : null}
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
