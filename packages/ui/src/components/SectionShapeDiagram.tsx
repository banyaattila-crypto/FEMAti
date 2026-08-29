import type { SectionEntry } from '../data/catalog.js';

export interface SectionShapeDiagramProps {
  readonly section: SectionEntry;
  /** Renderelt szélesség [px] — a magasság ebből, a szelvény arányából adódik. */
  readonly width?: number;
  readonly height?: number;
}

/**
 * Keresztmetszet-vázlat a szelvény valós kontúrjából, [mm] méretekből —
 * kiemelve `panels/LeftPanel.tsx`-ből (2026-08-29), hogy a szelvény-/
 * anyagadatbázis böngésző (`catalog/DatabaseView.tsx`) is nagyobb méretben
 * újrahasználhassa, ugyanazzal a rajzoló-logikával.
 */
export function SectionShapeDiagram({ section, width = 74, height = 106 }: SectionShapeDiagramProps): JSX.Element {
  const H = 130;
  const W = 90;
  const pad = 8;
  const scale = Math.min((W - 2 * pad) / section.b, (H - 2 * pad) / section.h);
  const h = section.h * scale;
  const b = section.b * scale;
  const cx = W / 2;
  const top = (H - h) / 2;

  const fill = 'var(--sem-elastic)';
  const stroke = 'var(--sem-elastic-edge)';

  const shape = ((): JSX.Element => {
    switch (section.kind) {
      case 'I': {
        const tw = (section.tw ?? 6) * scale;
        const tf = (section.tf ?? 10) * scale;
        return (
          <>
            <rect x={cx - b / 2} y={top} width={b} height={tf} fill={fill} stroke={stroke} strokeWidth={0.8} />
            <rect
              x={cx - tw / 2}
              y={top + tf}
              width={tw}
              height={h - 2 * tf}
              fill={fill}
              stroke={stroke}
              strokeWidth={0.8}
            />
            <rect
              x={cx - b / 2}
              y={top + h - tf}
              width={b}
              height={tf}
              fill={fill}
              stroke={stroke}
              strokeWidth={0.8}
            />
          </>
        );
      }
      case 'circle':
        return <circle cx={cx} cy={H / 2} r={h / 2} fill={fill} stroke={stroke} strokeWidth={0.8} />;
      case 'tube': {
        const t = (section.t ?? 8) * scale;
        return (
          <>
            <circle cx={cx} cy={H / 2} r={h / 2} fill={fill} stroke={stroke} strokeWidth={0.8} />
            <circle
              cx={cx}
              cy={H / 2}
              r={h / 2 - t}
              fill="var(--surface-panel)"
              stroke={stroke}
              strokeWidth={0.8}
            />
          </>
        );
      }
      case 'rect':
        return <rect x={cx - b / 2} y={top} width={b} height={h} fill={fill} stroke={stroke} strokeWidth={0.8} />;
      case 'U': {
        // Nyitott csatorna (UPN) — a MECHANIKAI modellben (erős tengely
        // körüli hajlítás) egzaktul I-szelvényként kezelt (ld. compile.ts),
        // de a vázlaton a valódi (egyoldali övű) kontúrt rajzoljuk, hogy a
        // felhasználó lássa, milyen szelvényt választott.
        const tw = (section.tw ?? 6) * scale;
        const tf = (section.tf ?? 10) * scale;
        const left = cx - b / 2;
        const right = cx + b / 2;
        const path = [
          `M${left},${top}`,
          `L${right},${top}`,
          `L${right},${top + tf}`,
          `L${left + tw},${top + tf}`,
          `L${left + tw},${top + h - tf}`,
          `L${right},${top + h - tf}`,
          `L${right},${top + h}`,
          `L${left},${top + h}`,
          'Z',
        ].join(' ');
        return <path d={path} fill={fill} stroke={stroke} strokeWidth={0.8} />;
      }
    }
  })();

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width, height, flex: 'none' }} aria-hidden="true">
      {shape}
      {/* Semleges tengely */}
      <line
        x1={4}
        y1={H / 2}
        x2={W - 4}
        y2={H / 2}
        stroke="var(--sem-plastic)"
        strokeWidth={0.8}
        strokeDasharray="4 3"
      />
    </svg>
  );
}
