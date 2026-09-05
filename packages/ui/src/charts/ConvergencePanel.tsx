/**
 * Konvergencia-panel — MASTER-PROMPT-TERV P13 prompt #5: "iterációnkénti
 * reziduum log-skálán, lépésenként csoportosítva; látszódjon, ha a megoldó
 * felezte a teherlépcsőt."
 *
 * Minden ELFOGADOTT lépés iterációi egy csoportot alkotnak az x-tengelyen
 * (a lépések λ-val feliratozva); az y-tengely a CONUND reziduum-mérőszám
 * (`NewtonIterationLog.residualPercent`, %) log-skálán (HIBATURESI-POLITIKA
 * 5. pont). Az ELVETETT (Δλ-felezést kiváltó) próbálkozásokat külön lista
 * sorolja fel.
 */
import { VIEW_WIDTH } from '../canvas/useModelTransform.js';
import { combinedSteps, type NonlinearRun } from '../model/nonlinear.js';
import * as fmt from '../format/numbers.js';
import type { Lang } from '../state/appStore.js';
import { CHARTS } from '../i18n/charts.js';

export const CONVERGENCE_HEIGHT = 200;
const PAD_L = 58;
const PAD_R = 16;
const PAD_T = 20;
const PAD_B = 30;
const MIN_LOG = -6; // 1e-6 % — gyakorlatilag "konvergált"
const MAX_LOG = 3; // 1000 % — durván divergens

export interface ConvergencePanelProps {
  readonly run: NonlinearRun;
  readonly activeStep: number;
  readonly lang?: Lang;
}

export function ConvergencePanel({ run, activeStep, lang = 'hu' }: ConvergencePanelProps): JSX.Element {
  const t = CHARTS[lang];
  const steps = combinedSteps(run);
  const innerW = VIEW_WIDTH - PAD_L - PAD_R;
  const innerH = CONVERGENCE_HEIGHT - PAD_T - PAD_B;
  const groupW = steps.length > 0 ? innerW / steps.length : innerW;

  const logResidual = (pct: number): number => {
    const v = pct > 0 ? Math.log10(pct) : MIN_LOG;
    return Math.min(MAX_LOG, Math.max(MIN_LOG, v));
  };
  const sy = (pct: number): number => PAD_T + innerH - ((logResidual(pct) - MIN_LOG) / (MAX_LOG - MIN_LOG)) * innerH;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${CONVERGENCE_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t.convergenceAriaLabel}
        style={{ width: '100%', height: '100%' }}
      >
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + innerH} stroke="var(--border-medium)" strokeWidth={1} />
        <line x1={PAD_L} y1={PAD_T + innerH} x2={PAD_L + innerW} y2={PAD_T + innerH} stroke="var(--border-medium)" strokeWidth={1} />
        <text x={PAD_L} y={16} fill="var(--text-secondary)" style={{ font: '600 13px var(--font-ui)' }}>
          {t.convergenceTitle}
        </text>

        {/* y-tengely rácsvonalak, tízhatványonként */}
        {Array.from({ length: MAX_LOG - MIN_LOG + 1 }, (_, i) => MIN_LOG + i)
          .filter((p) => p % 2 === 0)
          .map((p) => (
            <g key={p}>
              <line x1={PAD_L} y1={sy(10 ** p)} x2={PAD_L + innerW} y2={sy(10 ** p)} stroke="var(--border-subtle)" strokeWidth={0.6} />
              <text x={PAD_L - 6} y={sy(10 ** p) + 4} textAnchor="end" fill="var(--text-faint)" style={{ font: '400 13px var(--font-mono)' }}>
                10^{p}
              </text>
            </g>
          ))}

        {steps.map((step, si) => {
          const x0 = PAD_L + si * groupW;
          const isActive = si === activeStep;
          return (
            <g key={si}>
              {isActive ? <rect x={x0} y={PAD_T} width={groupW} height={innerH} fill="var(--accent-soft)" opacity={0.5} /> : null}
              {step.iterations.map((it, ii) => {
                const cx = x0 + ((ii + 0.5) / Math.max(1, step.iterations.length)) * groupW;
                const cy = sy(it.residualPercent);
                return (
                  <circle
                    key={ii}
                    cx={cx}
                    cy={cy}
                    r={2.2}
                    fill={it.stiffnessRebuilt ? 'var(--accent)' : 'var(--text-faint)'}
                  />
                );
              })}
              {si % Math.max(1, Math.round(steps.length / 8)) === 0 ? (
                <text x={x0} y={CONVERGENCE_HEIGHT - 6} fill="var(--text-faint)" style={{ font: '400 13px var(--font-mono)' }}>
                  {step.lambda.toFixed(2)}
                </text>
              ) : null}
            </g>
          );
        })}

        {/* tolerancia-küszöb vízszintes vonala */}
        <line
          x1={PAD_L}
          y1={sy(1e-4)}
          x2={PAD_L + innerW}
          y2={sy(1e-4)}
          stroke="var(--sem-ok)"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      </svg>

      <div style={{ padding: '0 var(--space-6) var(--space-4)', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
        {run.rejectedAttempts.length > 0 ? (
          <span>{t.rejectedAttempts(fmt.count(run.rejectedAttempts.length).value, run.rejectedAttempts.at(-1)?.lambda.toFixed(4) ?? '—')}</span>
        ) : (
          <span>{t.noHalving}</span>
        )}
      </div>
    </div>
  );
}
