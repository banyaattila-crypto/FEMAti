/**
 * „Történelmi mód" — MASTER-PROMPT-TERV P17 prompt: a diplomaterv 3.1.7.3
 * pontjában leírt EREDETI (1996-os) frontális megoldó (`solveFrontal`,
 * `@femati/fem-core`) bemutatása — a front kialakulásának és mozgásának
 * animálása, a pillanatnyi frontszélesség kiírva, összevetve a Skyline-
 * profil méretével, plusz rövid magyarázó szöveg, hogy miért volt ez 1996-ban
 * a helyes választás, és mi változott azóta.
 *
 * NEM a produkciós megoldó — az a Skyline-LDLᵀ (ld. ADR-0002); ez a nézet
 * KIZÁRÓLAG didaktikus/hitelesítő célú, ugyanazt a `K·v=q` rendszert oldja
 * meg, csak más eliminációs sorrenddel.
 */
import { useEffect, useMemo, useState } from 'react';
import { describeDof, solveFrontal, type FrontalResult } from '@femati/fem-core';
import './historical.css';
import { compileLayeredModel } from '../model/nonlinear.js';
import { useAppStore } from '../state/appStore.js';
import { useModelStore } from '../state/modelStore.js';
import { HISTORICAL } from '../i18n/historical.js';

const SPEEDS = [0.5, 1, 2, 4] as const;
const FRAME_MS = 500;

const VIEW_W = 760;
const VIEW_H = 150;
const MARGIN_X = 40;
const BEAM_Y = 60;
const NODE_R = 7;

interface FrontDofState {
  readonly dof: number;
  readonly nodeIndex: number;
  readonly kind: 'w' | 'phi';
}

/** A frontban lévő szabadságfokok halmaza az adott lépés UTÁN — a lépések kumulatív szimulációjával. */
function frontDofsAfterStep(result: FrontalResult, stepIndex: number): readonly FrontDofState[] {
  const active = new Set<number>();
  for (let k = 0; k <= stepIndex; k++) {
    const step = result.steps[k];
    if (step === undefined) continue;
    for (const d of step.enteredDofs) active.add(d);
    for (const d of step.eliminatedDofs) active.delete(d);
  }
  return Array.from(active)
    .sort((a, b) => a - b)
    .map((dof) => ({ dof, ...describeDof(dof) }));
}

export function HistoricalView(): JSX.Element | null {
  const lang = useAppStore((s) => s.lang);
  const t = HISTORICAL[lang];
  const historicalOpen = useAppStore((s) => s.historicalOpen);
  const setHistoricalOpen = useAppStore((s) => s.setHistoricalOpen);
  const model = useModelStore((s) => s.model);

  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);

  const computed = useMemo(() => {
    if (!historicalOpen) return null;
    try {
      const femModel = compileLayeredModel(model);
      const nodeX = femModel.nodes.map((n) => n.x as number);
      const result = solveFrontal(femModel);
      return { result, nodeX, error: null as string | null };
    } catch (e) {
      return { result: null, nodeX: [], error: (e as Error).message };
    }
  }, [historicalOpen, model]);

  const total = computed?.result?.steps.length ?? 0;

  useEffect(() => {
    if (!historicalOpen) return;
    setStepIndex(0);
    setPlaying(false);
  }, [historicalOpen, computed]);

  useEffect(() => {
    if (!playing || total === 0) return;
    const id = window.setInterval(() => {
      setStepIndex((prev) => {
        const next = prev + 1;
        if (next >= total) {
          setPlaying(false);
          return prev;
        }
        return next;
      });
    }, FRAME_MS / speed);
    return () => window.clearInterval(id);
  }, [playing, speed, total]);

  if (!historicalOpen || computed === null) return null;

  const close = (): void => setHistoricalOpen(false);

  if (computed.error !== null || computed.result === null) {
    return (
      <div className="vem-overlay vem-historical-overlay" onPointerDown={close}>
        <div className="vem-historical" onPointerDown={(e) => e.stopPropagation()}>
          <header className="vem-historical__header">
            <h1>{t.title}</h1>
            <button type="button" className="vem-btn vem-btn--sm" onClick={close}>
              {t.close}
            </button>
          </header>
          <p className="vem-historical__error">{t.errorMessage(computed.error ?? '')}</p>
        </div>
      </div>
    );
  }

  const { result, nodeX } = computed;
  const step = result.steps[stepIndex];
  const span = Math.max(...nodeX, 1e-9) - Math.min(...nodeX, 0);
  const x0 = Math.min(...nodeX);
  const sx = (x: number): number => MARGIN_X + ((x - x0) / (span || 1)) * (VIEW_W - 2 * MARGIN_X);

  const frontDofs = frontDofsAfterStep(result, stepIndex);
  const frontNodeIndices = new Set(frontDofs.map((d) => d.nodeIndex));

  const skylineWidth = 140;
  const maxScaleWidth = Math.max(result.maxFrontWidth, result.skylineMeanBandwidth, 1);
  const frontBarW = (step?.frontWidthAfterAssembly ?? 0) * (skylineWidth / maxScaleWidth);
  const skylineBarW = result.skylineMeanBandwidth * (skylineWidth / maxScaleWidth);

  return (
    <div className="vem-overlay vem-historical-overlay" onPointerDown={close}>
      <div className="vem-historical" onPointerDown={(e) => e.stopPropagation()}>
        <header className="vem-historical__header">
          <div>
            <h1>{t.title}</h1>
            <p className="vem-historical__subtitle">{t.subtitle}</p>
          </div>
          <button type="button" className="vem-btn vem-btn--sm" onClick={close}>
            {t.close}
          </button>
        </header>

        <section className="vem-historical__animation">
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="vem-historical__svg" role="img" aria-label={t.svgAriaLabel}>
            <line x1={MARGIN_X} y1={BEAM_Y} x2={VIEW_W - MARGIN_X} y2={BEAM_Y} className="vem-historical__beam-axis" />
            {result.steps.map((s, i) => {
              const elIndex = s.elementIndex;
              const x1 = sx(nodeX[elIndex] ?? 0);
              const x2 = sx(nodeX[elIndex + 1] ?? 0);
              const cls =
                i < stepIndex
                  ? 'vem-historical__element vem-historical__element--done'
                  : i === stepIndex
                    ? 'vem-historical__element vem-historical__element--current'
                    : 'vem-historical__element vem-historical__element--pending';
              return <line key={s.elementId} x1={x1} y1={BEAM_Y} x2={x2} y2={BEAM_Y} className={cls} />;
            })}
            {nodeX.map((x, i) => {
              const inFront = frontNodeIndices.has(i);
              const cls = inFront ? 'vem-historical__node vem-historical__node--front' : 'vem-historical__node';
              return <circle key={i} cx={sx(x)} cy={BEAM_Y} r={NODE_R} className={cls} />;
            })}
          </svg>
          <div className="vem-historical__legend">
            <span className="vem-historical__legend-item">
              <span className="vem-historical__swatch vem-historical__swatch--done" /> {t.legendDone}
            </span>
            <span className="vem-historical__legend-item">
              <span className="vem-historical__swatch vem-historical__swatch--current" /> {t.legendCurrent}
            </span>
            <span className="vem-historical__legend-item">
              <span className="vem-historical__swatch vem-historical__swatch--front" /> {t.legendFront}
            </span>
          </div>
        </section>

        <section className="vem-historical__controls" aria-label={t.playbackAriaLabel}>
          <button
            type="button"
            className="vem-btn vem-btn--sm"
            onClick={() => setStepIndex((v) => Math.max(0, v - 1))}
            disabled={stepIndex <= 0}
            aria-label={t.prevElementAria}
          >
            ◀
          </button>
          <button
            type="button"
            className="vem-btn vem-btn--sm"
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
            aria-label={playing ? t.pauseAria : t.playAria}
          >
            {playing ? '⏸' : '▶'}
          </button>
          <button
            type="button"
            className="vem-btn vem-btn--sm"
            onClick={() => setStepIndex((v) => Math.min(total - 1, v + 1))}
            disabled={stepIndex >= total - 1}
            aria-label={t.nextElementAria}
          >
            ▶|
          </button>
          <input
            type="range"
            className="vem-historical__range"
            min={0}
            max={Math.max(0, total - 1)}
            step={1}
            value={stepIndex}
            onChange={(e) => setStepIndex(Number(e.target.value))}
            aria-label={t.rangeAriaLabel}
          />
          <span className="vem-historical__step-label">
            {step ? t.stepLabel(stepIndex + 1, step.elementId) : t.noStep} / {total}
          </span>
          <div className="vem-segmented" role="group" aria-label={t.speedGroupAria}>
            {SPEEDS.map((v) => (
              <button key={v} type="button" className="vem-segmented__item" aria-pressed={speed === v} onClick={() => setSpeed(v)}>
                {v}×
              </button>
            ))}
          </div>
        </section>

        <section className="vem-historical__stats">
          <div className="vem-historical__stat">
            <div className="vem-historical__stat-label">{t.statCurrentFrontWidth}</div>
            <div className="vem-historical__stat-value">{step?.frontWidthAfterAssembly ?? 0} DOF</div>
          </div>
          <div className="vem-historical__stat">
            <div className="vem-historical__stat-label">{t.statMaxFrontWidth}</div>
            <div className="vem-historical__stat-value">{result.maxFrontWidth} DOF</div>
          </div>
          <div className="vem-historical__stat">
            <div className="vem-historical__stat-label">{t.statMeanFrontWidth}</div>
            <div className="vem-historical__stat-value">{result.meanFrontWidth.toFixed(1)} DOF</div>
          </div>
          <div className="vem-historical__stat">
            <div className="vem-historical__stat-label">{t.statSkylineBandwidth}</div>
            <div className="vem-historical__stat-value">{result.skylineMeanBandwidth.toFixed(1)} DOF</div>
          </div>
        </section>

        <section className="vem-historical__compare">
          <div className="vem-historical__bar-row">
            <span className="vem-historical__bar-label">{t.compareFrontLabel}</span>
            <div className="vem-historical__bar-track">
              <div className="vem-historical__bar vem-historical__bar--front" style={{ width: `${frontBarW}px` }} />
            </div>
            <span className="vem-historical__bar-value">{step?.frontWidthAfterAssembly ?? 0}</span>
          </div>
          <div className="vem-historical__bar-row">
            <span className="vem-historical__bar-label">{t.compareSkylineLabel}</span>
            <div className="vem-historical__bar-track">
              <div className="vem-historical__bar vem-historical__bar--skyline" style={{ width: `${skylineBarW}px` }} />
            </div>
            <span className="vem-historical__bar-value">{result.skylineMeanBandwidth.toFixed(1)}</span>
          </div>
        </section>

        <section className="vem-historical__explain">
          <h2>{t.explainTitle}</h2>
          <p>{t.explainParagraph1}</p>
          <p>{t.explainParagraph2}</p>
          {t.quoteNote !== '' ? <p className="vem-historical__note">{t.quoteNote}</p> : null}
        </section>
      </div>
    </div>
  );
}
