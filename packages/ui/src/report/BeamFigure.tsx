/**
 * Statikus tartó-vázlat a számítási jegyzőkönyvhöz (P15, 2. pont: "geometria,
 * anyagok, szelvények, terhek, peremfeltételek — táblázatosan ÉS ábrán").
 *
 * NEM a `ModelCanvas` interaktív változata — nincs húzás/kattintás, csak a
 * `canvas/marks.tsx` meglévő, tiszta (adat → SVG) rajzjeleit használja fel,
 * hogy a jegyzőkönyv ábrája vizuálisan megegyezzen a vászonnal. Az x-tengely
 * ugyanazt az `AXIS_X0`/`AXIS_X1`/`VIEW_WIDTH` leképezést használja, mint a
 * diagramok (`DiagramChart`), hogy a nyomtatott oldalon minden ábra közös
 * léptékű legyen.
 */
import { CanvasDefs, DistributedLoad, DistributedMomentLoad, Foundation, MomentLoad, NodeMark, PointLoad, SupportMark } from '../canvas/marks.js';
import { AXIS_X0, AXIS_X1, VIEW_WIDTH } from '../canvas/useModelTransform.js';
import type { EditableModel } from '../model/editable.js';
import * as fmt from '../format/numbers.js';

export const BEAM_FIGURE_HEIGHT = 170;
const AXIS_Y = 78;

export interface BeamFigureProps {
  readonly model: EditableModel;
}

export function BeamFigure({ model }: BeamFigureProps): JSX.Element {
  const sx = (x: number): number => AXIS_X0 + (x / model.span) * (AXIS_X1 - AXIS_X0);
  const elementBoundaries = Array.from({ length: model.elementCount + 1 }, (_, i) =>
    sx((i * model.span) / model.elementCount),
  );

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${BEAM_FIGURE_HEIGHT}`}
      width="100%"
      role="img"
      aria-label={`Statikai váz: ${fmt.length(model.span).value} m fesztáv, ${model.supports.length} támasz, ${model.loads.length} teher`}
    >
      <CanvasDefs />

      <line x1={AXIS_X0} y1={AXIS_Y} x2={AXIS_X1} y2={AXIS_Y} stroke="var(--text-secondary)" strokeWidth={2} />

      {elementBoundaries.map((x, i) => (
        <NodeMark key={i} x={x} y={AXIS_Y} />
      ))}

      {model.supports.map((s) => (
        <SupportMark key={s.id} x={sx(s.x)} y={AXIS_Y} type={s.type} />
      ))}

      {model.loads.map((l) =>
        l.kind === 'point' ? (
          <PointLoad key={l.id} x={sx(l.x)} y={AXIS_Y} label={`P = ${l.p.toFixed(1)} kN`} />
        ) : l.kind === 'moment' ? (
          <MomentLoad key={l.id} x={sx(l.x)} y={AXIS_Y} label={`M = ${l.m.toFixed(1)} kNm`} />
        ) : l.kind === 'distributed' ? (
          <DistributedLoad
            key={l.id}
            x1={sx(l.x1)}
            x2={sx(l.x2)}
            y={AXIS_Y}
            q1={l.q1}
            q2={l.q2}
            label={l.q1 === l.q2 ? `q = ${l.q1.toFixed(1)} kN/m` : `q = ${l.q1.toFixed(1)}→${l.q2.toFixed(1)} kN/m`}
          />
        ) : (
          <DistributedMomentLoad
            key={l.id}
            x1={sx(l.x1)}
            x2={sx(l.x2)}
            y={AXIS_Y}
            label={l.m1 === l.m2 ? `m = ${l.m1.toFixed(1)} kNm/m` : `m = ${l.m1.toFixed(1)}→${l.m2.toFixed(1)} kNm/m`}
          />
        ),
      )}

      {model.foundations.map((f) => (
        <Foundation key={f.id} x1={sx(f.x1)} x2={sx(f.x2)} y={AXIS_Y} label={`c = ${f.c.toFixed(0)} kN/m²`} />
      ))}

      <g>
        <line x1={AXIS_X0} y1={AXIS_Y + 56} x2={AXIS_X1} y2={AXIS_Y + 56} stroke="var(--text-faint)" strokeWidth={0.8} />
        <line x1={AXIS_X0} y1={AXIS_Y + 50} x2={AXIS_X0} y2={AXIS_Y + 62} stroke="var(--text-faint)" strokeWidth={0.8} />
        <line x1={AXIS_X1} y1={AXIS_Y + 50} x2={AXIS_X1} y2={AXIS_Y + 62} stroke="var(--text-faint)" strokeWidth={0.8} />
        <text
          x={(AXIS_X0 + AXIS_X1) / 2}
          y={AXIS_Y + 50}
          textAnchor="middle"
          fill="var(--text-muted)"
          style={{ font: '500 12px var(--font-mono)' }}
        >
          L = {fmt.length(model.span).value} m
        </text>
      </g>
    </svg>
  );
}
