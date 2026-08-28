/**
 * Teherlépcső-idővonal — MASTER-PROMPT-TERV 4.1 (alsó sáv) és P13 prompt #1:
 * "léptetés, lejátszás, sebességszabályzó; az idővonalon jelölve, hol folyt
 * meg először egy Gauss-pont, és hol alakult ki képlékeny csukló."
 *
 * Az `activeStep` a `combinedSteps(run)` (terhelés, majd — ha van —
 * tehermentesítés) tömbjébe indexel; ezt olvassa minden más P13-komponens
 * (vászon képlékeny zónák, teher–elmozdulás pont, keresztmetszet-inspektor).
 */
import { useEffect, useState } from 'react';
import { useAppStore } from '../state/appStore.js';
import { useNonlinearStore } from '../state/nonlinearStore.js';
import { combinedSteps, computeHingeMarkers } from '../model/nonlinear.js';
import * as fmt from '../format/numbers.js';

const SPEEDS = [0.5, 1, 2, 4] as const;
const FRAME_MS = 220;

export function Timeline(): JSX.Element {
  const activeStep = useAppStore((s) => s.activeStep);
  const setActiveStep = useAppStore((s) => s.setActiveStep);
  const run = useNonlinearStore((s) => s.run);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);

  const steps = run ? combinedSteps(run) : [];
  const total = steps.length;
  const markers = run ? computeHingeMarkers(run) : [];
  const current = steps[activeStep];
  const inUnload = run !== null && activeStep >= run.loadingSteps.length;

  useEffect(() => {
    if (!playing || total === 0) return;
    const id = window.setInterval(() => {
      const prev = useAppStore.getState().activeStep;
      const next = prev + 1;
      if (next >= total) {
        setPlaying(false);
        return;
      }
      setActiveStep(next);
    }, FRAME_MS / speed);
    return () => window.clearInterval(id);
  }, [playing, speed, total, setActiveStep]);

  useEffect(() => {
    if (total === 0) setPlaying(false);
  }, [total]);

  if (run === null || total === 0) {
    return (
      <div className="vem-timeline" aria-label="Teherlépcső-idővonal">
        <span className="vem-timeline__empty">
          Nincs nemlineáris eredmény — futtasd a SZÁMÍTÁS gombbal (F5) a teherlépcső-idővonal megjelenítéséhez.
        </span>
      </div>
    );
  }

  return (
    <div className="vem-timeline" aria-label="Teherlépcső-idővonal">
      <button
        type="button"
        className="vem-btn vem-btn--sm"
        onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
        disabled={activeStep <= 0}
        title="Előző lépés"
        aria-label="Előző lépés"
      >
        ◀
      </button>
      <button
        type="button"
        className="vem-btn vem-btn--sm"
        onClick={() => setPlaying((p) => !p)}
        title={playing ? 'Szünet' : 'Lejátszás'}
        aria-pressed={playing}
        aria-label={playing ? 'Szünet' : 'Lejátszás'}
      >
        {playing ? '⏸' : '▶'}
      </button>
      <button
        type="button"
        className="vem-btn vem-btn--sm"
        onClick={() => setActiveStep(Math.min(total - 1, activeStep + 1))}
        disabled={activeStep >= total - 1}
        title="Következő lépés"
        aria-label="Következő lépés"
      >
        ▶|
      </button>

      <div className="vem-timeline__track" role="group" aria-label="Lépések">
        <input
          type="range"
          className="vem-timeline__range"
          min={0}
          max={total - 1}
          step={1}
          value={activeStep}
          onChange={(e) => setActiveStep(Number(e.target.value))}
          aria-label="Aktuális teherlépcső"
        />
        <div className="vem-timeline__marks" aria-hidden="true">
          {markers.map((m, i) => (
            <span
              key={i}
              className={`vem-timeline__mark vem-timeline__mark--${m.kind}`}
              style={{ left: `${(m.stepIndex / Math.max(1, total - 1)) * 100}%` }}
              title={
                m.kind === 'first-yield'
                  ? `${m.elementId}: első folyás`
                  : `${m.elementId}: teljes képlékeny csukló`
              }
            />
          ))}
        </div>
      </div>

      <span className="vem-timeline__lambda">
        λ = {current ? fmt.lambda(current.lambda).value : '—'}
        {inUnload ? ' (tehermentesítés)' : ''}
      </span>

      <div className="vem-segmented" role="group" aria-label="Lejátszási sebesség">
        {SPEEDS.map((v) => (
          <button
            key={v}
            type="button"
            className="vem-segmented__item"
            aria-pressed={speed === v}
            onClick={() => setSpeed(v)}
            title={`${v}×`}
          >
            {v}×
          </button>
        ))}
      </div>
    </div>
  );
}
