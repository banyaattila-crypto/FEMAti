/**
 * Keresztmetszet-inspektor — MASTER-PROMPT-TERV P13 prompt #4 ("a legfontosabb
 * funkció", a diplomaterv 3-7. ábrájának élő megfelelője).
 *
 * Egy kiválasztott Gauss-pontra (elem + hajlítási Gauss-index) mutatja:
 *  - a rétegenkénti σ-profil oszlopdiagramját a keresztmetszet magassága mentén,
 *  - a semleges tengely (σ=0 metszéspont) aktuális helyét,
 *  - a rugalmas/képlékeny zónák határát (folyt rétegek kiemelve),
 *  - az adott pont M–κ görbéjét a TELJES tehertörténetre, a pillanatnyi
 *    állapottal megjelölve,
 *  - tehermentesítés után a maradó (saját)feszültségeket, az egyensúly
 *    (ΣσbΔz≈0, Σσ·z·bΔz = M) kiírásával.
 */
import { useAppStore } from '../state/appStore.js';
import { useNonlinearStore } from '../state/nonlinearStore.js';
import { combinedSteps, findPreparedElement } from '../model/nonlinear.js';
import * as fmt from '../format/numbers.js';

const PANEL_W = 420;
const BAR_AREA_W = 200;
const BAR_ROW_H = 14;
const MK_W = 200;
const MK_H = 140;

export function CrossSectionInspector(): JSX.Element | null {
  const inspector = useAppStore((s) => s.inspector);
  const closeInspector = useAppStore((s) => s.closeInspector);
  const activeStep = useAppStore((s) => s.activeStep);
  const run = useNonlinearStore((s) => s.run);

  if (inspector === null || run === null) return null;

  const { elementId, gaussIndex } = inspector;
  const materialData = run.materialData.get(elementId);
  const steps = combinedSteps(run);
  const currentStep = steps[activeStep];
  const currentState = currentStep?.states.get(elementId);
  const currentGp = currentState?.gaussPoints[gaussIndex];
  const preparedElement = findPreparedElement(run.system, elementId);
  const inUnload = run !== null && activeStep >= run.loadingSteps.length;

  if (materialData === undefined || materialData.kind !== 'layered' || currentGp === undefined || currentGp.kind !== 'layered') {
    return (
      <div className="vem-inspector-overlay" onPointerDown={closeInspector}>
        <div className="vem-inspector" onPointerDown={(e) => e.stopPropagation()}>
          <div className="vem-inspector__header">
            <span>Keresztmetszet-inspektor</span>
            <button type="button" className="vem-btn vem-btn--sm" onClick={closeInspector} aria-label="Keresztmetszet-inspektor bezárása">
              ✕
            </button>
          </div>
          <div style={{ padding: 'var(--space-5)', fontSize: 12, color: 'var(--text-muted)' }}>
            Nincs réteg-adat ehhez a Gauss-ponthoz.
          </div>
        </div>
      </div>
    );
  }

  const layers = materialData.layers;
  const layerStates = currentGp.layers;
  const maxAbsStress = Math.max(1e-6, ...layerStates.map((l) => Math.abs(l.sigma)));
  const totalHeight = layers.reduce((s, l) => s + l.t, 0);

  // Semleges tengely: az a z, ahol σ előjelet vált a szomszédos rétegek között.
  let neutralZ: number | null = null;
  for (let i = 1; i < layers.length; i++) {
    const s0 = layerStates[i - 1]?.sigma ?? 0;
    const s1 = layerStates[i]?.sigma ?? 0;
    if ((s0 >= 0 && s1 < 0) || (s0 < 0 && s1 >= 0)) {
      const z0 = layers[i - 1]?.z ?? 0;
      const z1 = layers[i]?.z ?? 0;
      const frac = s0 !== s1 ? s0 / (s0 - s1) : 0.5;
      neutralZ = z0 + frac * (z1 - z0);
      break;
    }
  }

  const netAxial = layers.reduce((s, l, i) => s + (layerStates[i]?.sigma ?? 0) * l.b * l.t, 0);
  const netMoment = layers.reduce((s, l, i) => s + (layerStates[i]?.sigma ?? 0) * l.b * l.z * l.t, 0);

  const zTop = -totalHeight / 2;
  const zToY = (z: number): number => ((z - zTop) / totalHeight) * (layers.length * BAR_ROW_H);
  const barCx = BAR_AREA_W / 2;

  const mkPoints = steps.map((s) => {
    const gp = s.states.get(elementId)?.gaussPoints[gaussIndex];
    return { kappa: gp?.kappa ?? 0, m: gp?.m ?? 0 };
  });
  const maxKappa = Math.max(1e-9, ...mkPoints.map((p) => Math.abs(p.kappa)));
  const maxM = Math.max(1e-9, ...mkPoints.map((p) => Math.abs(p.m)));
  const mkSx = (k: number): number => MK_W / 2 + (k / maxKappa) * (MK_W / 2 - 10);
  const mkSy = (m: number): number => MK_H / 2 - (m / maxM) * (MK_H / 2 - 10);
  const mkPath = mkPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${mkSx(p.kappa).toFixed(2)},${mkSy(p.m).toFixed(2)}`).join(' ');

  return (
    <div className="vem-inspector-overlay" onPointerDown={closeInspector}>
      <div className="vem-inspector" style={{ width: PANEL_W }} onPointerDown={(e) => e.stopPropagation()}>
        <div className="vem-inspector__header">
          <span>
            Keresztmetszet-inspektor — {elementId}, Gauss-pont {gaussIndex + 1}/3
            {preparedElement ? ` (x ≈ ${preparedElement.nodeX[1].toFixed(2)} m)` : ''}
          </span>
          <button type="button" className="vem-btn vem-btn--sm" onClick={closeInspector} title="Bezárás (Esc)" aria-label="Keresztmetszet-inspektor bezárása">
            ✕
          </button>
        </div>

        <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="vem-inspector__readouts">
            <span>λ = {currentStep ? fmt.lambda(currentStep.lambda).value : '—'}</span>
            <span>M = {fmt.moment(currentGp.m).value} kNm</span>
            <span>κ = {currentGp.kappa.toExponential(3)} 1/m</span>
            {inUnload ? <span className="vem-inspector__unload-tag">tehermentesítés</span> : null}
          </div>

          <div>
            <div className="vem-section-label-sm">Rétegenkénti σ-profil (a keresztmetszet magassága mentén)</div>
            <svg
              viewBox={`0 0 ${BAR_AREA_W} ${layers.length * BAR_ROW_H}`}
              width={BAR_AREA_W}
              height={layers.length * BAR_ROW_H}
              role="img"
              aria-label="Rétegenkénti feszültségprofil"
            >
              <line x1={barCx} y1={0} x2={barCx} y2={layers.length * BAR_ROW_H} stroke="var(--border-medium)" strokeWidth={1} />
              {layers.map((layer, i) => {
                const st = layerStates[i];
                if (st === undefined) return null;
                const y = zToY(layer.z) - BAR_ROW_H / 2;
                const w = (Math.abs(st.sigma) / maxAbsStress) * (BAR_AREA_W / 2 - 6);
                const x = st.sigma >= 0 ? barCx : barCx - w;
                return (
                  <rect
                    key={i}
                    x={x}
                    y={y + 1.5}
                    width={Math.max(0.5, w)}
                    height={BAR_ROW_H - 3}
                    fill={st.yielded ? 'var(--sem-plastic)' : st.epsPEff > 0 ? 'var(--sem-partial)' : 'var(--sem-elastic)'}
                    stroke={st.yielded ? 'var(--sem-plastic-edge)' : 'var(--sem-elastic-edge)'}
                    strokeWidth={0.6}
                  />
                );
              })}
              {neutralZ !== null ? (
                <line
                  x1={0}
                  y1={zToY(neutralZ)}
                  x2={BAR_AREA_W}
                  y2={zToY(neutralZ)}
                  stroke="var(--sem-deformed)"
                  strokeWidth={1.2}
                  strokeDasharray="4 2"
                />
              ) : null}
            </svg>
            <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
              {neutralZ !== null
                ? `semleges tengely: z ≈ ${(neutralZ * 1e3).toFixed(1)} mm`
                : 'semleges tengely a szélső rétegen kívül esik (a teljes szelvény egy előjelű feszültségű)'}
            </div>
          </div>

          <div>
            <div className="vem-section-label-sm">M–κ görbe (a teljes tehertörténetre)</div>
            <svg viewBox={`0 0 ${MK_W} ${MK_H}`} width={MK_W} height={MK_H} role="img" aria-label="M-kappa görbe">
              <line x1={0} y1={MK_H / 2} x2={MK_W} y2={MK_H / 2} stroke="var(--border-subtle)" strokeWidth={0.6} />
              <line x1={MK_W / 2} y1={0} x2={MK_W / 2} y2={MK_H} stroke="var(--border-subtle)" strokeWidth={0.6} />
              <path d={mkPath} fill="none" stroke="var(--accent)" strokeWidth={1.6} />
              <circle cx={mkSx(currentGp.kappa)} cy={mkSy(currentGp.m)} r={4} fill="var(--accent)" stroke="var(--surface-canvas)" strokeWidth={1.3} />
            </svg>
          </div>

          {inUnload ? (
            <div className="vem-inspector__equilibrium">
              <div className="vem-section-label-sm">Maradó (saját)feszültségek egyensúlya</div>
              <div>Σ σ·b·Δz (axiális erő) = {(netAxial).toExponential(2)} kN — elvileg 0</div>
              <div>Σ σ·z·b·Δz (nyomaték) = {netMoment.toFixed(3)} kNm — egyezik a fent kiírt M-mel</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
