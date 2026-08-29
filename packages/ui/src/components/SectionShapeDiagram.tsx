import { useId } from 'react';
import type { SectionEntry } from '../data/catalog.js';

export interface SectionShapeDiagramProps {
  readonly section: SectionEntry;
  /** Renderelt szélesség [px] — a magasság ebből, a `VIEW_W`/`VIEW_H` arányából adódik. */
  readonly width?: number;
  readonly height?: number;
}

const H = 130;
const W = 90;
const PAD = 8;
/** Bal margó — az I-/U-szelvény tw/tf méretjelző-feliratainak. */
const MARGIN_L = 18;
/** Jobb margó — a h (és kör/cső esetén t) méretjelző-vonalnak. */
const MARGIN_R = 26;
/** Alsó margó — a b (ill. kör/cső esetén d) méretjelző-vonalnak. */
const MARGIN_B = 20;
const VIEW_W = MARGIN_L + W + MARGIN_R;
const VIEW_H = H + MARGIN_B;

const DIM_STROKE = 'var(--border-strong, var(--text-faint))';
const DIM_TEXT = 'var(--text-secondary)';

/** Egy karakteres méretjelző-felirat (h, b, tw, tf, d, t) — mindig `var(--font-mono)`. */
function DimText({
  x,
  y,
  anchor = 'middle',
  children,
}: {
  readonly x: number;
  readonly y: number;
  readonly anchor?: 'start' | 'middle' | 'end';
  readonly children: string;
}): JSX.Element {
  return (
    <text x={x} y={y} fontSize={8.5} fontFamily="var(--font-mono)" fill={DIM_TEXT} textAnchor={anchor} dominantBaseline="middle">
      {children}
    </text>
  );
}

/** Függőleges méretvonal (nyílvégekkel) a szelvény jobb oldalán — magasság (h) vagy átmérő (d). */
function VDim({ x, y1, y2, label }: { readonly x: number; readonly y1: number; readonly y2: number; readonly label: string }): JSX.Element {
  return (
    <g aria-hidden="true">
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={DIM_STROKE} strokeWidth={0.6} />
      <line x1={x - 3} y1={y1} x2={x + 3} y2={y1} stroke={DIM_STROKE} strokeWidth={0.6} />
      <line x1={x - 3} y1={y2} x2={x + 3} y2={y2} stroke={DIM_STROKE} strokeWidth={0.6} />
      <DimText x={x + 8} y={(y1 + y2) / 2}>
        {label}
      </DimText>
    </g>
  );
}

/** Vízszintes méretvonal (nyílvégekkel) a szelvény alatt — szélesség (b) vagy átmérő (d). */
function HDim({ y, x1, x2, label }: { readonly y: number; readonly x1: number; readonly x2: number; readonly label: string }): JSX.Element {
  return (
    <g aria-hidden="true">
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={DIM_STROKE} strokeWidth={0.6} />
      <line x1={x1} y1={y - 3} x2={x1} y2={y + 3} stroke={DIM_STROKE} strokeWidth={0.6} />
      <line x1={x2} y1={y - 3} x2={x2} y2={y + 3} stroke={DIM_STROKE} strokeWidth={0.6} />
      <DimText x={(x1 + x2) / 2} y={y + 9}>
        {label}
      </DimText>
    </g>
  );
}

/** Rövid vezetővonalas jelölő (tw/tf/t) — a kontúr egy pontjától egy külső feliratig. */
function Leader({ from, to, label, anchor }: { readonly from: readonly [number, number]; readonly to: readonly [number, number]; readonly label: string; readonly anchor: 'start' | 'end' }): JSX.Element {
  return (
    <g aria-hidden="true">
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={DIM_STROKE} strokeWidth={0.5} />
      <DimText x={to[0] + (anchor === 'end' ? -2 : 2)} y={to[1]} anchor={anchor}>
        {label}
      </DimText>
    </g>
  );
}

/**
 * Keresztmetszet-vázlat a szelvény valós kontúrjából, [mm] méretekből,
 * méretjelző-feliratokkal (h, b, tw, tf, d, t — a katalógus mezőneveivel
 * egyező szimbólumok, ld. `catalog/DatabaseView.tsx` `DimensionRows`) —
 * kiemelve `panels/LeftPanel.tsx`-ből (2026-08-29), hogy a szelvény-
 * adatbázis böngésző (`catalog/SectionDatabaseView.tsx`) is nagyobb
 * méretben újrahasználhassa, ugyanazzal a rajzoló-logikával.
 */
export function SectionShapeDiagram({ section, width, height }: SectionShapeDiagramProps): JSX.Element {
  const gradientId = `section-metal-${useId()}`;
  const scale = Math.min((W - 2 * PAD) / section.b, (H - 2 * PAD) / section.h);
  const h = section.h * scale;
  const b = section.b * scale;
  const cx = MARGIN_L + W / 2;
  const top = (H - h) / 2;
  const right = cx + b / 2;
  const left = cx - b / 2;
  const bottom = top + h;

  const fill = `url(#${gradientId})`;
  const stroke = 'var(--accent-light)';

  const w = width ?? (VIEW_W / VIEW_H) * (height ?? 109);
  const hpx = height ?? (VIEW_H / VIEW_W) * w;

  const shape = ((): JSX.Element => {
    switch (section.kind) {
      case 'I': {
        const tw = (section.tw ?? 6) * scale;
        const tf = (section.tf ?? 10) * scale;
        return (
          <>
            <rect x={left} y={top} width={b} height={tf} fill={fill} stroke={stroke} strokeWidth={0.8} />
            <rect x={cx - tw / 2} y={top + tf} width={tw} height={h - 2 * tf} fill={fill} stroke={stroke} strokeWidth={0.8} />
            <rect x={left} y={bottom - tf} width={b} height={tf} fill={fill} stroke={stroke} strokeWidth={0.8} />
            <VDim x={W + MARGIN_L + 8} y1={top} y2={bottom} label="h" />
            <HDim y={H + 8} x1={left} x2={right} label="b" />
            <Leader from={[left, top + tf / 2]} to={[MARGIN_L - 4, top + tf / 2]} label="tf" anchor="end" />
            <Leader from={[cx - tw / 2, top + h / 2]} to={[MARGIN_L - 4, top + h / 2]} label="tw" anchor="end" />
          </>
        );
      }
      case 'circle':
        return (
          <>
            <circle cx={cx} cy={H / 2} r={h / 2} fill={fill} stroke={stroke} strokeWidth={0.8} />
            <HDim y={H + 8} x1={cx - h / 2} x2={cx + h / 2} label="d" />
          </>
        );
      case 'tube': {
        const t = (section.t ?? 8) * scale;
        return (
          <>
            <circle cx={cx} cy={H / 2} r={h / 2} fill={fill} stroke={stroke} strokeWidth={0.8} />
            <circle cx={cx} cy={H / 2} r={h / 2 - t} fill="var(--surface-panel)" stroke={stroke} strokeWidth={0.8} />
            <HDim y={H + 8} x1={cx - h / 2} x2={cx + h / 2} label="d" />
            <Leader from={[cx + h / 2 - t / 2, H / 2]} to={[W + MARGIN_L + 8, H / 2 - 14]} label="t" anchor="start" />
          </>
        );
      }
      case 'rect':
        return (
          <>
            <rect x={left} y={top} width={b} height={h} fill={fill} stroke={stroke} strokeWidth={0.8} />
            <VDim x={W + MARGIN_L + 8} y1={top} y2={bottom} label="h" />
            <HDim y={H + 8} x1={left} x2={right} label="b" />
          </>
        );
      case 'U': {
        // Nyitott csatorna (UPN) — a MECHANIKAI modellben (erős tengely
        // körüli hajlítás) egzaktul I-szelvényként kezelt (ld. compile.ts),
        // de a vázlaton a valódi (egyoldali övű) kontúrt rajzoljuk, hogy a
        // felhasználó lássa, milyen szelvényt választott.
        const tw = (section.tw ?? 6) * scale;
        const tf = (section.tf ?? 10) * scale;
        const path = [
          `M${left},${top}`,
          `L${right},${top}`,
          `L${right},${top + tf}`,
          `L${left + tw},${top + tf}`,
          `L${left + tw},${bottom - tf}`,
          `L${right},${bottom - tf}`,
          `L${right},${bottom}`,
          `L${left},${bottom}`,
          'Z',
        ].join(' ');
        return (
          <>
            <path d={path} fill={fill} stroke={stroke} strokeWidth={0.8} />
            <VDim x={W + MARGIN_L + 8} y1={top} y2={bottom} label="h" />
            <HDim y={H + 8} x1={left} x2={right} label="b" />
            <Leader from={[left, top + tf / 2]} to={[MARGIN_L - 4, top + tf / 2]} label="tf" anchor="end" />
            <Leader from={[left + tw, top + h / 2]} to={[MARGIN_L - 4, top + h / 2]} label="tw" anchor="end" />
          </>
        );
      }
    }
  })();

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={{ width: w, height: hpx, flex: 'none' }} aria-hidden="true">
      <defs>
        {/* "Mély fém" kitöltés (2026-08-29, 3 koncepció közül választva) — a
            fényforrás balról fentről jön, a sem-elastic tokenből
            color-mix()-elt világos csúcsfénnyel, a sem-elastic-edge-be
            sötétedve. */}
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="color-mix(in srgb, var(--sem-elastic) 55%, white)" />
          <stop offset="0.5" stopColor="var(--sem-elastic)" />
          <stop offset="1" stopColor="var(--sem-elastic-edge)" />
        </linearGradient>
      </defs>
      {shape}
      {/* Semleges tengely */}
      <line x1={MARGIN_L + 2} y1={H / 2} x2={MARGIN_L + W - 2} y2={H / 2} stroke="var(--sem-plastic)" strokeWidth={0.8} strokeDasharray="4 3" />
    </svg>
  );
}
