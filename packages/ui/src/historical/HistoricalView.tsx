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
      <div className="vem-historical-overlay" onPointerDown={close}>
        <div className="vem-historical" onPointerDown={(e) => e.stopPropagation()}>
          <header className="vem-historical__header">
            <h1>FEMAti — Történelmi mód</h1>
            <button type="button" className="vem-btn vem-btn--sm" onClick={close}>
              Bezárás
            </button>
          </header>
          <p className="vem-historical__error">
            A frontális megoldó nem tudta megoldani az aktuális modellt: {computed.error}
          </p>
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
    <div className="vem-historical-overlay" onPointerDown={close}>
      <div className="vem-historical" onPointerDown={(e) => e.stopPropagation()}>
        <header className="vem-historical__header">
          <div>
            <h1>FEMAti — Történelmi mód</h1>
            <p className="vem-historical__subtitle">
              A diplomaterv 3.1.7.3 pontjának EREDETI (1996-os) frontális algoritmusa
            </p>
          </div>
          <button type="button" className="vem-btn vem-btn--sm" onClick={close}>
            Bezárás
          </button>
        </header>

        <section className="vem-historical__animation">
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="vem-historical__svg" role="img" aria-label="A front mozgása">
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
              <span className="vem-historical__swatch vem-historical__swatch--done" /> feldolgozott elem
            </span>
            <span className="vem-historical__legend-item">
              <span className="vem-historical__swatch vem-historical__swatch--current" /> aktuális elem
            </span>
            <span className="vem-historical__legend-item">
              <span className="vem-historical__swatch vem-historical__swatch--front" /> aktív front-csomópont
            </span>
          </div>
        </section>

        <section className="vem-historical__controls" aria-label="Lejátszás">
          <button
            type="button"
            className="vem-btn vem-btn--sm"
            onClick={() => setStepIndex((v) => Math.max(0, v - 1))}
            disabled={stepIndex <= 0}
            aria-label="Előző elem"
          >
            ◀
          </button>
          <button
            type="button"
            className="vem-btn vem-btn--sm"
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
            aria-label={playing ? 'Szünet' : 'Lejátszás'}
          >
            {playing ? '⏸' : '▶'}
          </button>
          <button
            type="button"
            className="vem-btn vem-btn--sm"
            onClick={() => setStepIndex((v) => Math.min(total - 1, v + 1))}
            disabled={stepIndex >= total - 1}
            aria-label="Következő elem"
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
            aria-label="Elem sorszáma"
          />
          <span className="vem-historical__step-label">
            {step ? `${stepIndex + 1}. elem: ${step.elementId}` : '—'} / {total}
          </span>
          <div className="vem-segmented" role="group" aria-label="Lejátszási sebesség">
            {SPEEDS.map((v) => (
              <button
                key={v}
                type="button"
                className="vem-segmented__item"
                aria-pressed={speed === v}
                onClick={() => setSpeed(v)}
              >
                {v}×
              </button>
            ))}
          </div>
        </section>

        <section className="vem-historical__stats">
          <div className="vem-historical__stat">
            <div className="vem-historical__stat-label">Pillanatnyi frontszélesség</div>
            <div className="vem-historical__stat-value">{step?.frontWidthAfterAssembly ?? 0} DOF</div>
          </div>
          <div className="vem-historical__stat">
            <div className="vem-historical__stat-label">Legnagyobb frontszélesség (max)</div>
            <div className="vem-historical__stat-value">{result.maxFrontWidth} DOF</div>
          </div>
          <div className="vem-historical__stat">
            <div className="vem-historical__stat-label">Átlagos frontszélesség</div>
            <div className="vem-historical__stat-value">{result.meanFrontWidth.toFixed(1)} DOF</div>
          </div>
          <div className="vem-historical__stat">
            <div className="vem-historical__stat-label">Skyline-profil átlagos sávszélessége</div>
            <div className="vem-historical__stat-value">{result.skylineMeanBandwidth.toFixed(1)} DOF</div>
          </div>
        </section>

        <section className="vem-historical__compare">
          <div className="vem-historical__bar-row">
            <span className="vem-historical__bar-label">Front (jelenlegi)</span>
            <div className="vem-historical__bar-track">
              <div className="vem-historical__bar vem-historical__bar--front" style={{ width: `${frontBarW}px` }} />
            </div>
            <span className="vem-historical__bar-value">{step?.frontWidthAfterAssembly ?? 0}</span>
          </div>
          <div className="vem-historical__bar-row">
            <span className="vem-historical__bar-label">Skyline (átlagos sáv)</span>
            <div className="vem-historical__bar-track">
              <div className="vem-historical__bar vem-historical__bar--skyline" style={{ width: `${skylineBarW}px` }} />
            </div>
            <span className="vem-historical__bar-value">{result.skylineMeanBandwidth.toFixed(1)}</span>
          </div>
        </section>

        <section className="vem-historical__explain">
          <h2>Miért ez volt 1996-ban a helyes választás?</h2>
          <p>
            A diplomaterv (3.1.7.3, 44. oldal) szerint a program a frontális algoritmust alkalmazta:
            „nem a csomópontok, hanem a rudak sorszámozása határozza meg a számítás időigényét", és „az
            együtthatómátrix előállítása és az egyenletrendszer megoldása nem válik szét" — az elemek
            beépítése és a kiküszöbölés EGYETLEN átmenetben, elemenként haladva történt. Ennek oka
            egyszerű: a korabeli gépeken a memória volt a szűkös erőforrás, nem a számítási idő. A
            frontális módszer sosem tartja memóriában a TELJES merevségi mátrixot — csak a pillanatnyi
            "frontot" (a még ki nem küszöbölt szabadságfokokat) —, ezért egy néhány tíz-száz kilobájtos
            memóriájú gépen is megoldható volt egy több száz szabadságfokú szerkezet, amit a teljes mátrix
            tárolása ellehetetlenített volna.
          </p>
          <p>
            Ami azóta megváltozott: a memória ma gyakorlatilag nem korlát egy ilyen méretű 1D
            gerendaanalízisnél, viszont a front SZÉLESSÉGE (és ezzel a művigény) erősen függ az ELEM-
            sorszámozástól — egy rosszul sorszámozott hálón a front indokolatlanul kiszélesedhet. A mai
            Skyline-LDLᵀ megoldó (ld. `linalg/skyline.ts`, ADR-0002) ehelyett a CSOMÓPONT-sorszámozásból
            adódó sávszerkezetet ("profilt") használja ki, és a teljes mátrixot egyszerre, elkülönítve
            állítja össze és faktorizálja — ez modern gépeken gyorsabb és egyszerűbb karbantartani, ezért
            ez maradt a produkciós megoldó ebben a programban. A frontális algoritmus itt KIZÁRÓLAG azért
            szerepel, mert az eredeti diplomaterv EZT valósította meg — ez a nézet az akkori mérnöki
            döntés hitelesítésére és bemutatására szolgál.
          </p>
        </section>
      </div>
    </div>
  );
}
