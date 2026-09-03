/**
 * A diagramsáv teste — MASTER-PROMPT-TERV P8 prompt.
 *
 * Az aktív fülnek megfelelő diagramot rajzolja, DE a hover-metszet mind a
 * négy mezőre (M, T, w, φ) egyszerre olvasható a fejléc-sorban — így nem
 * kell mind a négy ábrát egyszerre látni ahhoz, hogy „egy helyen mozgatva
 * az egeret mind a négy ábrán megjelenik a metszet értéke" teljesüljön.
 */
import { useRef, useState } from 'react';
import { geometricProperties, shearMomentInteraction } from '@femati/fem-core';
import { toShape } from '../model/compile.js';
import { useModelStore } from '../state/modelStore.js';
import { useAppStore } from '../state/appStore.js';
import { useNonlinearStore } from '../state/nonlinearStore.js';
import { useLiveResult } from '../solve/useLiveResult.js';
import { useModalResult } from '../solve/useModalResult.js';
import { findSection } from '../data/catalog.js';
import { DiagramChart, CHART_HEIGHT, type ChartElementSpan } from './DiagramChart.js';
import { LoadDisplacementChart, LD_CHART_HEIGHT } from './LoadDisplacementChart.js';
import { ConvergencePanel, CONVERGENCE_HEIGHT } from './ConvergencePanel.js';
import { Beam3DStress, STRESS3D_HEIGHT } from './Beam3DStress.js';
import { ModalPanel } from './ModalPanel.js';
import { DynamicPanel } from './DynamicPanel.js';
import { interpolateAt } from './interpolate.js';
import { exportSvgElement } from './exportSvg.js';
import * as fmt from '../format/numbers.js';
import type { DiagramTab } from '../state/appStore.js';

export interface DiagramPanelProps {
  readonly activeDiagram: DiagramTab;
  readonly momentFlip: boolean;
}

export function DiagramPanel({ activeDiagram, momentFlip }: DiagramPanelProps): JSX.Element {
  const model = useModelStore((s) => s.model);
  const { result, error } = useLiveResult(model);
  const modalOutcome = useModalResult(model, activeDiagram === 'modal');
  const nonlinearRun = useNonlinearStore((s) => s.run);
  const nonlinearError = useNonlinearStore((s) => s.error);
  const activeStep = useAppStore((s) => s.activeStep);
  const activeMode = useAppStore((s) => s.activeMode);
  const setActiveMode = useAppStore((s) => s.setActiveMode);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  if (activeDiagram === 'modal') {
    return <ModalPanel outcome={modalOutcome} activeMode={activeMode} onActiveModeChange={setActiveMode} span={model.span} />;
  }

  if (activeDiagram === 'dynamic') {
    return <DynamicPanel />;
  }

  if (activeDiagram === 'load-displacement' || activeDiagram === 'convergence') {
    if (nonlinearError !== null) {
      return (
        <div style={{ padding: 'var(--space-5)', fontSize: 12, color: 'var(--text-muted)' }}>
          A nemlineáris futtatás nem sikerült: {nonlinearError}
        </div>
      );
    }
    if (nonlinearRun === null) {
      return (
        <div style={{ padding: 'var(--space-5)', fontSize: 12, color: 'var(--text-faint)' }}>
          Nincs nemlineáris eredmény — futtasd a SZÁMÍTÁS gombbal (F5).
        </div>
      );
    }
    return (
      <div style={{ width: '100%', height: activeDiagram === 'load-displacement' ? LD_CHART_HEIGHT : CONVERGENCE_HEIGHT }}>
        {activeDiagram === 'load-displacement' ? (
          <LoadDisplacementChart run={nonlinearRun} activeStep={activeStep} />
        ) : (
          <ConvergencePanel run={nonlinearRun} activeStep={activeStep} />
        )}
      </div>
    );
  }

  if (error !== null) {
    return (
      <div style={{ padding: 'var(--space-5)', fontSize: 12, color: 'var(--text-muted)' }}>
        A modell jelenleg nem futtatható — nincs mit ábrázolni.
      </div>
    );
  }
  if (result === null) {
    return (
      <div style={{ padding: 'var(--space-5)', fontSize: 12, color: 'var(--text-muted)' }}>
        Nincs számítási eredmény.
      </div>
    );
  }

  if (activeDiagram === 'utilization') {
    // 2026-09-03, felhasználói kérés ("milyen látványos diagramot lehetne
    // még csinálni M/T/w/φ mellé") — az M-V interakciós ellenőrzés
    // (ADR-0018, `panels/RightPanel.tsx`) eddig csak a globális M-max/T-max
    // szélsőértékekből, EGYETLEN számként jelent meg. Itt UGYANAZ a
    // `shearMomentInteraction()` fut le, de a gerenda MINDEN csomópontján
    // (ugyanaz az `n.m`/`n.t` sor, amit az M/T diagram is rajzol) — a
    // kihasználtság így folytonos görbeként látszik, megmutatva, HOL a
    // legkritikusabb keresztmetszet, nem csak hogy mennyi a legrosszabb.
    const { mp, vpl } = result.props;
    if (mp === null || vpl === null) {
      return (
        <div style={{ padding: 'var(--space-5)', fontSize: 12, color: 'var(--text-faint)' }}>
          A kihasználtsági térképhez folyáshatárral (σY) rendelkező anyag szükséges — a jelenlegi anyagnak nincs
          megadva képlékeny teherbírása.
        </div>
      );
    }
    const uXs = result.nodes.map((n) => n.x);
    // 200%-nál felül elvágva: egy Vpl-t is meghaladó, numerikusan végtelen
    // kihasználtságú pont (ld. `test/shearMomentInteraction.test.ts` "V >
    // Vpl" regressziós próbája) még mindig SÚLYOS túllépésként látszik a
    // diagramon, nem törné el a görbe skáláját.
    const uYs = uXs.map((_, i) => {
      const node = result.nodes[i];
      const u = shearMomentInteraction(node?.m ?? 0, node?.t ?? 0, mp, vpl).utilization;
      return Math.min(u, 2) * 100;
    });
    const uElements: ChartElementSpan[] = result.elements.map((el, i) => ({
      x1: result.nodes[2 * i]?.x ?? 0,
      x2: result.nodes[2 * i + 2]?.x ?? 0,
      errorEstimate: el.errorEstimate,
    }));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
        <div
          style={{
            padding: '2px var(--space-6)',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            flex: 'none',
          }}
        >
          M-V kihasználtság (EN 1993-1-1 6.2.8) a gerenda mentén — 100% fölött a keresztmetszet túllépi a redukált
          teherbírást (200%-nál a skála levágva)
        </div>
        <div style={{ flex: 1, minHeight: 0, height: CHART_HEIGHT }}>
          <DiagramChart
            title="M-V kihasználtság"
            xs={uXs}
            ys={uYs}
            span={model.span}
            elements={uElements}
            format={fmt.percent}
            hoverX={hoverX}
            onHoverX={setHoverX}
            svgRef={(el) => {
              svgRef.current = el;
            }}
          />
        </div>
      </div>
    );
  }

  if (activeDiagram === 'stress3d') {
    const section = findSection(model.sectionId);
    const secProps = geometricProperties(toShape(section));
    return (
      <div style={{ width: '100%', height: STRESS3D_HEIGHT }}>
        <Beam3DStress
          xs={result.nodes.map((n) => n.x)}
          ms={result.nodes.map((n) => n.m)}
          inertia={result.props.inertia}
          yTopMm={(secProps.yTop ?? secProps.yMax) * 1000}
          yBottomMm={(secProps.yBottom ?? secProps.yMax) * 1000}
        />
      </div>
    );
  }

  const xs = result.nodes.map((n) => n.x);
  const elements: ChartElementSpan[] = result.elements.map((el, i) => ({
    x1: result.nodes[2 * i]?.x ?? 0,
    x2: result.nodes[2 * i + 2]?.x ?? 0,
    errorEstimate: el.errorEstimate,
  }));

  const fields: Record<'M' | 'T' | 'w' | 'phi', { readonly ys: readonly number[]; readonly format: typeof fmt.moment; readonly title: string }> = {
    M: { ys: result.nodes.map((n) => n.m), format: fmt.moment, title: 'M — hajlítónyomaték' },
    T: { ys: result.nodes.map((n) => n.t), format: fmt.shear, title: 'T — nyíróerő' },
    w: { ys: result.nodes.map((n) => n.w), format: fmt.deflection, title: 'w — lehajlás' },
    phi: { ys: result.nodes.map((n) => n.phi), format: fmt.rotation, title: 'φ — elfordulás' },
  };
  const active = fields[activeDiagram as 'M' | 'T' | 'w' | 'phi'];

  const readouts: readonly { readonly label: string; readonly value: number | null; readonly format: typeof fmt.moment }[] = [
    { label: 'M', value: hoverX !== null ? interpolateAt(xs, fields.M.ys, hoverX) : null, format: fmt.moment },
    { label: 'T', value: hoverX !== null ? interpolateAt(xs, fields.T.ys, hoverX) : null, format: fmt.shear },
    { label: 'w', value: hoverX !== null ? interpolateAt(xs, fields.w.ys, hoverX) : null, format: fmt.deflection },
    { label: 'φ', value: hoverX !== null ? interpolateAt(xs, fields.phi.ys, hoverX) : null, format: fmt.rotation },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-5)',
          padding: '2px var(--space-6)',
          fontSize: 13,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          flex: 'none',
        }}
      >
        <span>{hoverX !== null ? `x = ${hoverX.toFixed(2)} m` : 'metszet: mozgasd az egeret a diagramon'}</span>
        {readouts.map((r) => (
          <span key={r.label}>
            {r.label} = {r.value !== null ? `${r.format(r.value).value} ${r.format(r.value).unit}` : '—'}
          </span>
        ))}
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="vem-btn vem-btn--sm"
          onClick={() => svgRef.current && exportSvgElement(svgRef.current, `femati-${activeDiagram}.svg`)}
          title="Az aktív diagram SVG letöltése"
        >
          SVG
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, height: CHART_HEIGHT }}>
        <DiagramChart
          title={active.title}
          xs={xs}
          ys={active.ys}
          span={model.span}
          elements={elements}
          format={active.format}
          flip={activeDiagram === 'M' ? momentFlip : false}
          hoverX={hoverX}
          onHoverX={setHoverX}
          svgRef={(el) => {
            svgRef.current = el;
          }}
        />
      </div>
    </div>
  );
}
