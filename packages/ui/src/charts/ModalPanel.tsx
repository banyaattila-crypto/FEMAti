/**
 * A "Modális" fül — sajátfrekvenciák és módalak-diagram (ADR-0016).
 *
 * A megjelenítés a meglévő diagram-mintát követi (`DiagramChart`), de a
 * módalak AMPLITÚDÓJA dimenziótlan (M-ortonormált, ld.
 * `solver/modal.ts` fejléce) — csak az ALAKJA hordoz mérnöki jelentést, a
 * nagysága nem hasonlítható össze a lehajlás [mm]-es diagramjával.
 */
import { useRef } from 'react';
import { SegmentedControl } from '../components/Button.js';
import { DiagramChart, CHART_HEIGHT, type ChartElementSpan } from './DiagramChart.js';
import { exportSvgElement } from './exportSvg.js';
import * as fmt from '../format/numbers.js';
import type { ModalOutcome } from '../model/compile.js';
import type { Lang } from '../state/appStore.js';
import { CHARTS } from '../i18n/charts.js';

export interface ModalPanelProps {
  readonly outcome: ModalOutcome;
  readonly activeMode: number;
  readonly onActiveModeChange: (index: number) => void;
  readonly span: number;
  readonly lang?: Lang;
}

const MAX_MODES_SHOWN = 8;

export function ModalPanel({ outcome, activeMode, onActiveModeChange, span, lang = 'hu' }: ModalPanelProps): JSX.Element {
  const t = CHARTS[lang];
  const svgRef = useRef<SVGSVGElement | null>(null);

  if (outcome.error !== null) {
    return (
      <div style={{ padding: 'var(--space-5)', fontSize: 12, color: 'var(--text-muted)' }}>
        {t.modelNotRunnable} ({outcome.error})
      </div>
    );
  }
  if (outcome.modal === null || outcome.modal.modes.length === 0) {
    return (
      <div style={{ padding: 'var(--space-5)', fontSize: 12, color: 'var(--text-muted)' }}>
        {t.modalNoResult}
      </div>
    );
  }

  const { modal, model } = outcome;
  const modeIndex = Math.min(activeMode, modal.modes.length - 1);
  const mode = modal.modes[modeIndex];
  if (mode === undefined) {
    return (
      <div style={{ padding: 'var(--space-5)', fontSize: 12, color: 'var(--text-muted)' }}>
        {t.modalNoResult}
      </div>
    );
  }

  const xs = model.nodes.map((n) => n.x as number);
  const ys = model.nodes.map((_, i) => mode.shape[2 * i] ?? 0);
  const elements: ChartElementSpan[] = model.elements.map((el) => {
    const nodeById = new Map(model.nodes.map((n) => [n.id as unknown as string, n.x as number]));
    const first = nodeById.get(el.nodes[0] as unknown as string) ?? 0;
    const last = nodeById.get(el.nodes[2] as unknown as string) ?? 0;
    return { x1: Math.min(first, last), x2: Math.max(first, last), errorEstimate: 0 };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          padding: '2px var(--space-6)',
          fontSize: 13,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          flex: 'none',
        }}
      >
        <SegmentedControl
          ariaLabel={t.modeSelectAria}
          value={String(modeIndex)}
          onChange={(v) => onActiveModeChange(Number(v))}
          options={modal.modes.slice(0, MAX_MODES_SHOWN).map((m, i) => ({
            value: String(i),
            label: `${i + 1}. — ${fmt.frequencyHz(m.frequencyHz).value} Hz`,
            title: t.modeTitle(i + 1),
          }))}
        />
        <div style={{ flex: 1 }} />
        <span>
          ω = {fmt.angularFrequency(mode.omega).value} {fmt.angularFrequency(mode.omega).unit}
        </span>
        <button
          type="button"
          className="vem-btn vem-btn--sm"
          onClick={() => svgRef.current && exportSvgElement(svgRef.current, `femati-modal-${modeIndex + 1}.svg`)}
          title={t.modeDownloadSvgTitle}
        >
          SVG
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, height: CHART_HEIGHT }}>
        <DiagramChart
          title={t.modeShapeTitle(modeIndex + 1, fmt.frequencyHz(mode.frequencyHz).value)}
          xs={xs}
          ys={ys}
          span={span}
          elements={elements}
          format={fmt.modeShape}
          hoverX={null}
          onHoverX={() => undefined}
          svgRef={(el) => {
            svgRef.current = el;
          }}
          lang={lang}
        />
      </div>
    </div>
  );
}
