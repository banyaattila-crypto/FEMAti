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
import { Legend } from '../components/Feedback.js';
import { jetColor } from '../charts/colormap.js';
import * as fmt from '../format/numbers.js';
import { PANELS } from '../i18n/panels.js';

const PANEL_W = 460;
/* 2026-09-03 újratervezés (felhasználói kérés: "túl egyszerűen néznek ki"):
   a korábbi 200×(14·rétegszám) puszta oszlopdiagram helyett margóval, σ-/z-
   tengellyel, folytonos hőtérkép-kitöltéssel (`jetColor`, ugyanaz a nyelv,
   mint a 3D-feszültségképen és az M/T/w/φ diagramokon) és a rétegállapot
   (rugalmas/részben képlékeny/képlékeny) színes körvonallal jelölve. */
const LEFT_MARGIN = 52;
const TOP_MARGIN = 22;
const BAR_AREA_W = 220;
const BAR_ROW_H = 18;
const RIGHT_PAD = 14;
const BOTTOM_PAD = 6;
const MK_W = 220;
const MK_H = 160;
const MK_PAD = 28;

export function CrossSectionInspector(): JSX.Element | null {
  const inspector = useAppStore((s) => s.inspector);
  const closeInspector = useAppStore((s) => s.closeInspector);
  const activeStep = useAppStore((s) => s.activeStep);
  const t = PANELS[useAppStore((s) => s.lang)];
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
            <span>{t.inspectorTitleNoData}</span>
            <button type="button" className="vem-btn vem-btn--sm" onClick={closeInspector} aria-label={t.inspectorCloseAria}>
              ✕
            </button>
          </div>
          <div style={{ padding: 'var(--space-5)', fontSize: 12, color: 'var(--text-muted)' }}>{t.noLayerData}</div>
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

  // 2026-09-03 javítás: a korábbi `zTop = -totalHeight/2` hallgatólagosan
  // SZIMMETRIKUS keresztmetszetet tételezett fel (rect/kör/I-szelvénynél
  // helyes, mert a réteg-koordináták a súlypontra szimmetrikusak) — az
  // ASZIMMETRIKUS T-szelvénynél (ADR-0020) viszont NEM, ott a rétegek a
  // valós, súlyponttól eltolt tetőponttól indulnak. A ténylegesen legfelső/
  // legalsó réteg SZÉLÉBŐL számolva mindkét esetben helyes.
  const topLayer = layers[0];
  const bottomLayer = layers[layers.length - 1];
  const zTop = (topLayer?.z ?? 0) - (topLayer?.t ?? 0) / 2;
  const zBottom = (bottomLayer?.z ?? 0) + (bottomLayer?.t ?? 0) / 2;
  const barPlotH = layers.length * BAR_ROW_H;
  const zToY = (z: number): number => TOP_MARGIN + ((z - zTop) / totalHeight) * barPlotH;
  const barCx = LEFT_MARGIN + BAR_AREA_W / 2;
  const barHalfW = BAR_AREA_W / 2 - 6;
  const svgW = LEFT_MARGIN + BAR_AREA_W + RIGHT_PAD;
  const svgH = TOP_MARGIN + barPlotH + BOTTOM_PAD;

  const mkPoints = steps.map((s) => {
    const gp = s.states.get(elementId)?.gaussPoints[gaussIndex];
    return { kappa: gp?.kappa ?? 0, m: gp?.m ?? 0 };
  });
  const maxKappa = Math.max(1e-9, ...mkPoints.map((p) => Math.abs(p.kappa)));
  const maxM = Math.max(1e-9, ...mkPoints.map((p) => Math.abs(p.m)));
  const mkSx = (k: number): number => MK_W / 2 + (k / maxKappa) * (MK_W / 2 - MK_PAD);
  const mkSy = (m: number): number => MK_H / 2 - (m / maxM) * (MK_H / 2 - MK_PAD);
  const mkPath = mkPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${mkSx(p.kappa).toFixed(2)},${mkSy(p.m).toFixed(2)}`).join(' ');

  return (
    <div className="vem-inspector-overlay" onPointerDown={closeInspector}>
      <div className="vem-inspector" style={{ width: PANEL_W }} onPointerDown={(e) => e.stopPropagation()}>
        <div className="vem-inspector__header">
          <span>
            {t.inspectorTitle(elementId, gaussIndex + 1, preparedElement ? preparedElement.nodeX[1].toFixed(2) : null)}
          </span>
          <button type="button" className="vem-btn vem-btn--sm" onClick={closeInspector} title={t.inspectorCloseTitle} aria-label={t.inspectorCloseAria}>
            ✕
          </button>
        </div>

        <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="vem-inspector__readouts">
            <span>λ = {currentStep ? fmt.lambda(currentStep.lambda).value : '—'}</span>
            <span>M = {fmt.moment(currentGp.m).value} kNm</span>
            <span>κ = {currentGp.kappa.toExponential(3)} 1/m</span>
            {inUnload ? <span className="vem-inspector__unload-tag">{t.unloadingTag}</span> : null}
          </div>

          <div>
            <div className="vem-section-label-sm">{t.layerProfileSectionTitle}</div>
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              width={svgW}
              height={svgH}
              role="img"
              aria-label={t.layerProfileSvgAria}
            >
              {/* σ-tengely: skála-vonal + 3 jelölő (bal: max nyomás, közép: 0, jobb: max húzás). */}
              <line x1={barCx - barHalfW} y1={TOP_MARGIN - 10} x2={barCx + barHalfW} y2={TOP_MARGIN - 10} stroke="var(--border-medium)" strokeWidth={1} />
              {[barCx - barHalfW, barCx, barCx + barHalfW].map((tx, i) => (
                <line key={i} x1={tx} y1={TOP_MARGIN - 13} x2={tx} y2={TOP_MARGIN - 7} stroke="var(--border-medium)" strokeWidth={1} />
              ))}
              <text x={barCx - barHalfW} y={TOP_MARGIN - 15} textAnchor="start" fontSize={9} fontFamily="var(--font-mono)" fill="var(--text-faint)">
                {fmt.stress(-maxAbsStress).value}
              </text>
              <text x={barCx} y={TOP_MARGIN - 15} textAnchor="middle" fontSize={9} fontFamily="var(--font-mono)" fill="var(--text-faint)">
                0
              </text>
              <text x={barCx + barHalfW} y={TOP_MARGIN - 15} textAnchor="end" fontSize={9} fontFamily="var(--font-mono)" fill="var(--text-faint)">
                +{fmt.stress(maxAbsStress).value} {fmt.stress(maxAbsStress).unit}
              </text>

              {/* z-tengely: a keresztmetszet tetejének/aljának pozíciója. */}
              <text x={LEFT_MARGIN - 6} y={TOP_MARGIN + 3} textAnchor="end" fontSize={9} fontFamily="var(--font-mono)" fill="var(--text-faint)">
                {(zTop * 1e3).toFixed(0)} mm
              </text>
              <text x={LEFT_MARGIN - 6} y={TOP_MARGIN + barPlotH} textAnchor="end" fontSize={9} fontFamily="var(--font-mono)" fill="var(--text-faint)">
                {(zBottom * 1e3).toFixed(0)} mm
              </text>

              <line x1={barCx} y1={TOP_MARGIN} x2={barCx} y2={TOP_MARGIN + barPlotH} stroke="var(--border-medium)" strokeWidth={1} />
              {layers.map((layer, i) => {
                const st = layerStates[i];
                if (st === undefined) return null;
                const y = zToY(layer.z) - BAR_ROW_H / 2;
                const magnitude = Math.abs(st.sigma) / maxAbsStress;
                const w = magnitude * barHalfW;
                const x = st.sigma >= 0 ? barCx : barCx - w;
                // A KITÖLTÉS mostantól a feszültség NAGYSÁGÁT hőtérképként
                // mutatja (`jetColor`, ugyanaz, mint a 3D-feszültségképen és
                // az M/T/w/φ diagramokon) — az ÁLLAPOTOT (rugalmas/részben
                // képlékeny/képlékeny) a színes KÖRVONAL jelzi, ld. lentebb a
                // jelmagyarázatot.
                const stateColor = st.yielded ? 'var(--sem-plastic-edge)' : st.epsPEff > 0 ? 'var(--sem-partial-edge)' : 'var(--sem-elastic-edge)';
                return (
                  <rect
                    key={i}
                    x={x}
                    y={y + 1.5}
                    width={Math.max(0.5, w)}
                    height={BAR_ROW_H - 3}
                    fill={jetColor(magnitude)}
                    stroke={stateColor}
                    strokeWidth={1.4}
                  />
                );
              })}
              {neutralZ !== null ? (
                <line
                  x1={LEFT_MARGIN}
                  y1={zToY(neutralZ)}
                  x2={LEFT_MARGIN + BAR_AREA_W}
                  y2={zToY(neutralZ)}
                  stroke="var(--sem-deformed)"
                  strokeWidth={1.2}
                  strokeDasharray="4 2"
                />
              ) : null}
            </svg>
            <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
              {neutralZ !== null ? t.neutralAxisText((neutralZ * 1e3).toFixed(1)) : t.neutralAxisOutsideText}
            </div>
            <div style={{ marginTop: 6 }}>
              <Legend
                items={[
                  { label: t.layerLegendElastic, fill: 'transparent', stroke: 'var(--sem-elastic-edge)' },
                  { label: t.layerLegendPartial, fill: 'transparent', stroke: 'var(--sem-partial-edge)' },
                  { label: t.layerLegendPlastic, fill: 'transparent', stroke: 'var(--sem-plastic-edge)' },
                ]}
              />
            </div>
          </div>

          <div>
            <div className="vem-section-label-sm">{t.mkCurveSectionTitle}</div>
            <svg viewBox={`0 0 ${MK_W} ${MK_H}`} width={MK_W} height={MK_H} role="img" aria-label={t.mkCurveSvgAria}>
              {/* Halvány rács a jobb olvashatóságért. */}
              {[0.25, 0.75].map((f) => (
                <g key={f}>
                  <line x1={MK_W * f} y1={0} x2={MK_W * f} y2={MK_H} stroke="var(--border-subtle)" strokeWidth={0.4} strokeDasharray="2 3" />
                  <line x1={0} y1={MK_H * f} x2={MK_W} y2={MK_H * f} stroke="var(--border-subtle)" strokeWidth={0.4} strokeDasharray="2 3" />
                </g>
              ))}
              <line x1={0} y1={MK_H / 2} x2={MK_W} y2={MK_H / 2} stroke="var(--border-subtle)" strokeWidth={0.6} />
              <line x1={MK_W / 2} y1={0} x2={MK_W / 2} y2={MK_H} stroke="var(--border-subtle)" strokeWidth={0.6} />
              <path d={mkPath} fill="none" stroke="var(--accent)" strokeWidth={1.6} />
              <circle cx={mkSx(currentGp.kappa)} cy={mkSy(currentGp.m)} r={4} fill="var(--accent)" stroke="var(--surface-canvas)" strokeWidth={1.3} />
              <text x={MK_W - 2} y={MK_H / 2 - 4} textAnchor="end" fontSize={9} fontFamily="var(--font-mono)" fill="var(--text-faint)">
                κ_max ≈ {maxKappa.toExponential(2)}
              </text>
              <text x={MK_W / 2 + 4} y={10} textAnchor="start" fontSize={9} fontFamily="var(--font-mono)" fill="var(--text-faint)">
                M_max ≈ {fmt.moment(maxM).value} kNm
              </text>
            </svg>
          </div>

          {inUnload ? (
            <div className="vem-inspector__equilibrium">
              <div className="vem-section-label-sm">{t.residualSectionTitle}</div>
              <div>{t.residualAxialText(netAxial.toExponential(2))}</div>
              <div>{t.residualMomentText(netMoment.toFixed(3))}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
