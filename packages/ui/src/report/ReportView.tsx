/**
 * Számítási jegyzőkönyv — MASTER-PROMPT-TERV P15 prompt: nyomtatható HTML,
 * amelyet a böngésző natív "Nyomtatás → Mentés PDF-ként" párbeszéde exportál
 * (nincs külön PDF-könyvtár — DESIGN-TERV szellemében kézzel rajzolt SVG és
 * minimális függőség). A tartalom és a formázás UGYANAZOKAT a `fmt.*`
 * függvényeket és `LinearResult`/`NonlinearRun` adatokat használja, mint a
 * munkaasztal panel-jei (`RightPanel`, `DiagramPanel`) — ezért a jegyzőkönyv
 * számértékei a konstrukció miatt SOSEM térhetnek el a felületen látottaktól.
 *
 * A jegyzőkönyv 8 pontja (P15 prompt sorrendje):
 *  1. Fejléc — projekt, dátum, verzió, mag commit-hash.
 *  2. Modell — geometria, anyagok, szelvények, terhek, peremfeltételek.
 *  3. Háló — elemszám, elemméret, integrálási séma.
 *  4. Megoldó beállításai.
 *  5. Eredmények — M/T/w/φ, szélsőértékek, reakciók, egyensúly.
 *  6. Nemlineáris futás — teher–elmozdulás, csuklók sorrendje, konvergencia.
 *  7. Hibabecslés és hálófüggetlenségi megjegyzés.
 *  8. Lábléc minden oldalon (ld. `report.css` — nyomtatáskor `position:fixed`).
 */
import './report.css';
import { crackingMomentUtilization, deflectionUtilization, shearMomentInteraction } from '@femati/fem-core';
import { findMaterial, findPreset, findSection, UNVERIFIED_WARNING } from '../data/catalog.js';
import { presetDisplayName } from '../i18n/catalog.js';
import { useAppStore } from '../state/appStore.js';
import { useModelStore } from '../state/modelStore.js';
import { useNonlinearStore } from '../state/nonlinearStore.js';
import { useLiveResult } from '../solve/useLiveResult.js';
import { DiagramChart, CHART_HEIGHT, type ChartElementSpan } from '../charts/DiagramChart.js';
import { LoadDisplacementChart, LD_CHART_HEIGHT } from '../charts/LoadDisplacementChart.js';
import { ConvergencePanel, CONVERGENCE_HEIGHT } from '../charts/ConvergencePanel.js';
import { combinedSteps } from '../model/nonlinear.js';
import { buildHingeReport } from './reportData.js';
import { BeamFigure, BEAM_FIGURE_HEIGHT } from './BeamFigure.js';
import * as fmt from '../format/numbers.js';
import { utilizationVerdict } from '../format/utilization.js';
import { SUPPORT_TYPE_LABEL, VERDICT_LABEL } from '../i18n/panels.js';
import { REPORT, formatReportDateTime } from '../i18n/report.js';

const noop = (): void => {};

export function ReportView(): JSX.Element | null {
  const lang = useAppStore((s) => s.lang);
  const t = REPORT[lang];
  const reportOpen = useAppStore((s) => s.reportOpen);
  const setReportOpen = useAppStore((s) => s.setReportOpen);
  const algorithm = useAppStore((s) => s.algorithm);
  const loadStep = useAppStore((s) => s.loadStep);
  const tolerance = useAppStore((s) => s.tolerance);
  const peakLambda = useAppStore((s) => s.peakLambda);
  const loadHistory = useAppStore((s) => s.loadHistory);
  const momentTensionSide = useAppStore((s) => s.momentTensionSide);

  const model = useModelStore((s) => s.model);
  const { result, error } = useLiveResult(model);
  const nonlinearRun = useNonlinearStore((s) => s.run);

  if (!reportOpen) return null;

  const preset = findPreset(model.presetId);
  const section = findSection(model.sectionId);
  const material = findMaterial(model.materialId);
  const generatedAt = new Date();

  const xs = result?.nodes.map((n) => n.x) ?? [];
  const elements: ChartElementSpan[] = result
    ? result.elements.map((el, i) => ({
        x1: result.nodes[2 * i]?.x ?? 0,
        x2: result.nodes[2 * i + 2]?.x ?? 0,
        errorEstimate: el.errorEstimate,
      }))
    : [];

  const diagramFields = result
    ? ([
        { key: 'M', title: t.diagramTitle.M, ys: result.nodes.map((n) => n.m), format: fmt.moment, flip: momentTensionSide },
        { key: 'T', title: t.diagramTitle.T, ys: result.nodes.map((n) => n.t), format: fmt.shear, flip: false },
        { key: 'w', title: t.diagramTitle.w, ys: result.nodes.map((n) => n.w), format: fmt.deflection, flip: false },
        { key: 'phi', title: t.diagramTitle.phi, ys: result.nodes.map((n) => n.phi), format: fmt.rotation, flip: false },
      ] as const)
    : [];

  const interaction =
    result && result.props.mp !== null && result.props.vpl !== null
      ? shearMomentInteraction(result.extremes.m.value, result.extremes.t.value, result.props.mp, result.props.vpl)
      : null;
  const mvVerdict = utilizationVerdict(interaction?.utilization ?? null);
  const deflectionUtil = result ? deflectionUtilization(result.extremes.w.value, model.span) : null;
  const deflectionVerdict = utilizationVerdict(deflectionUtil);
  // fctm a katalógusban kN/cm² (ld. compile.ts `mat.e * 1e4` mintája) — kN/m²-re váltva, hogy Kₑ-vel (m³) szorozva kNm-et adjon.
  const mcr = result && material.fctm !== undefined ? material.fctm * 1e4 * result.props.elasticModulus : null;
  const crackingUtil = result && mcr !== null ? crackingMomentUtilization(result.extremes.m.value, mcr) : null;
  const crackingVerdict = utilizationVerdict(crackingUtil);

  const hinges = nonlinearRun ? buildHingeReport(nonlinearRun) : [];
  const lastStepIndex = nonlinearRun ? combinedSteps(nonlinearRun).length - 1 : 0;
  const catalogUnverified = !material.verified || !section.verified;

  return (
    <div className="vem-overlay vem-report-overlay" onPointerDown={() => setReportOpen(false)}>
      <div className="vem-report-toolbar">
        <div className="vem-report-toolbar__inner" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className="vem-btn vem-btn--sm" onClick={() => setReportOpen(false)}>
            {t.close}
          </button>
          <button type="button" className="vem-btn vem-btn--primary vem-btn--sm" onClick={() => window.print()}>
            {t.printSave}
          </button>
        </div>
      </div>

      <article className="vem-report" onPointerDown={(e) => e.stopPropagation()}>
        {/* 1. Fejléc */}
        <header className="vem-report__header">
          <div>
            <h1>{t.reportTitle}</h1>
            <p className="vem-report__subtitle">
              {presetDisplayName(preset.id, lang)} (ref. {preset.ref})
            </p>
          </div>
          <div className="vem-report__header-meta">
            <div>{formatReportDateTime(generatedAt, lang)}</div>
            <div>{t.versionLabel(__APP_VERSION__, __GIT_COMMIT__)}</div>
          </div>
        </header>

        {/* 2. Modell */}
        <section className="vem-report__section">
          <h2>{t.section2Title}</h2>
          <div className="vem-report__grid">
            <table>
              <tbody>
                <tr>
                  <th>{t.spanLabel}</th>
                  <td>{fmt.length(model.span).value} m</td>
                </tr>
                <tr>
                  <th>{t.sectionLabel}</th>
                  <td>{section.name}</td>
                </tr>
                <tr>
                  <th>{t.materialLabel}</th>
                  <td>{material.name}</td>
                </tr>
                <tr>
                  <th>{t.selfWeightLabel}</th>
                  <td>{model.selfWeight ? t.selfWeightYes : t.selfWeightNo}</td>
                </tr>
              </tbody>
            </table>
            <table>
              <thead>
                <tr>
                  <th>{t.supportHeader}</th>
                  <th>{t.xHeader}</th>
                  <th>{t.typeHeader}</th>
                </tr>
              </thead>
              <tbody>
                {model.supports.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.x.toFixed(2)}</td>
                    <td>{SUPPORT_TYPE_LABEL[lang][s.type]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <table style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>{t.loadHeader}</th>
                <th>{t.typeHeader}</th>
                <th>{t.valueHeader}</th>
              </tr>
            </thead>
            <tbody>
              {model.loads.map((l) => (
                <tr key={l.id}>
                  <td>{l.id}</td>
                  <td>{t.loadKindLabel[l.kind]}</td>
                  <td>
                    {l.kind === 'point'
                      ? `P = ${l.p.toFixed(1)} kN, x = ${l.x.toFixed(2)} m`
                      : l.kind === 'moment'
                        ? `M = ${l.m.toFixed(1)} kNm, x = ${l.x.toFixed(2)} m`
                        : l.kind === 'distributed'
                          ? l.q1 === l.q2
                            ? `q = ${l.q1.toFixed(1)} kN/m, ${l.x1.toFixed(2)}–${l.x2.toFixed(2)} m`
                            : `q = ${l.q1.toFixed(1)}→${l.q2.toFixed(1)} kN/m, ${l.x1.toFixed(2)}–${l.x2.toFixed(2)} m`
                          : l.m1 === l.m2
                            ? `m = ${l.m1.toFixed(1)} kNm/m, ${l.x1.toFixed(2)}–${l.x2.toFixed(2)} m`
                            : `m = ${l.m1.toFixed(1)}→${l.m2.toFixed(1)} kNm/m, ${l.x1.toFixed(2)}–${l.x2.toFixed(2)} m`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="vem-report__chart" style={{ height: BEAM_FIGURE_HEIGHT }}>
            <BeamFigure model={model} />
          </div>

          {catalogUnverified ? (
            <div className="vem-report__note vem-report__note--warn">
              {UNVERIFIED_WARNING}
              {!material.verified ? t.materialSourceNote(material.name, material.source) : ''}
              {!section.verified ? t.sectionSourceNote(section.name, section.source) : ''}
            </div>
          ) : null}
        </section>

        {/* 3. Háló */}
        <section className="vem-report__section">
          <h2>{t.section3Title}</h2>
          <table>
            <tbody>
              <tr>
                <th>{t.elementCountLabel}</th>
                <td>{model.elementCount}</td>
              </tr>
              <tr>
                <th>{t.elementLengthLabel}</th>
                <td>{(model.span / model.elementCount).toFixed(3)} m</td>
              </tr>
              <tr>
                <th>{t.dofLabel}</th>
                <td>{result ? fmt.count(result.dofCount, 'DOF').value : '—'}</td>
              </tr>
              <tr>
                <th>{t.integrationLabel}</th>
                <td>{model.integration === 'selective' ? t.integrationSelective : t.integrationFull}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 4. Megoldó beállításai */}
        <section className="vem-report__section">
          <h2>{t.section4Title}</h2>
          <table>
            <tbody>
              <tr>
                <th>{t.algorithmLabel}</th>
                <td>{algorithm === 'newton' ? t.algorithmNewton : t.algorithmModified}</td>
              </tr>
              <tr>
                <th>{t.loadStepLabel}</th>
                <td>{loadStep.toFixed(2)}</td>
              </tr>
              <tr>
                <th>{t.toleranceLabel}</th>
                <td>{tolerance.toFixed(2)} %</td>
              </tr>
              <tr>
                <th>{t.peakLambdaLabel}</th>
                <td>{peakLambda.toFixed(2)}</td>
              </tr>
              <tr>
                <th>{t.loadHistoryLabel}</th>
                <td>{loadHistory === 'unloading' ? t.loadHistoryUnloading : t.loadHistoryMonotonic}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 5. Eredmények (lineáris) */}
        <section className="vem-report__section">
          <h2>{t.section5Title}</h2>
          {error !== null ? (
            <div className="vem-report__note vem-report__note--warn">{t.modelNotRunnable(error)}</div>
          ) : result === null ? (
            <div className="vem-report__note">{t.noComputableModel}</div>
          ) : (
            <>
              <div className="vem-report__grid">
                <table>
                  <tbody>
                    <tr>
                      <th>w max</th>
                      <td>
                        {fmt.deflection(result.extremes.w.value).value} {fmt.deflection(result.extremes.w.value).unit} @{' '}
                        {result.extremes.w.x.toFixed(2)} m
                      </td>
                    </tr>
                    <tr>
                      <th>φ max</th>
                      <td>
                        {fmt.rotation(result.extremes.phi.value).value} {fmt.rotation(result.extremes.phi.value).unit} @{' '}
                        {result.extremes.phi.x.toFixed(2)} m
                      </td>
                    </tr>
                    <tr>
                      <th>M max</th>
                      <td>
                        {fmt.moment(result.extremes.m.value).value} {fmt.moment(result.extremes.m.value).unit} @{' '}
                        {result.extremes.m.x.toFixed(2)} m
                      </td>
                    </tr>
                    <tr>
                      <th>T max</th>
                      <td>
                        {fmt.shear(result.extremes.t.value).value} {fmt.shear(result.extremes.t.value).unit} @{' '}
                        {result.extremes.t.x.toFixed(2)} m
                      </td>
                    </tr>
                  </tbody>
                </table>
                <table>
                  <thead>
                    <tr>
                      <th>{t.reactionHeader}</th>
                      <th>Fz [kN]</th>
                      <th>My [kNm]</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.reactions.map((r) => (
                      <tr key={r.nodeId}>
                        <td>x = {r.x.toFixed(2)} m</td>
                        <td>{fmt.force(r.fz).value}</td>
                        <td>{fmt.moment(r.my).value}</td>
                      </tr>
                    ))}
                    <tr>
                      <th>{t.equilibriumCheckLabel}</th>
                      <td className={result.equilibrium.satisfied ? 'vem-report__tone-ok' : 'vem-report__tone-error'}>
                        {fmt.force(result.equilibrium.sumFz).value}
                      </td>
                      <td className={result.equilibrium.satisfied ? 'vem-report__tone-ok' : 'vem-report__tone-error'}>
                        {fmt.moment(result.equilibrium.sumMy).value}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>{t.standardsCheckHeader}</th>
                    <th>{t.utilizationHeader}</th>
                    <th>{t.verdictHeader}</th>
                  </tr>
                </thead>
                <tbody>
                  {interaction !== null ? (
                    <tr>
                      <th>{t.mvCheckLabel}</th>
                      <td className={mvVerdict.tone === 'ok' ? 'vem-report__tone-ok' : 'vem-report__tone-error'}>
                        {fmt.percent(interaction.utilization * 100).value}%
                      </td>
                      <td className={mvVerdict.tone === 'ok' ? 'vem-report__tone-ok' : 'vem-report__tone-error'}>
                        {VERDICT_LABEL[lang][mvVerdict.code]}
                      </td>
                    </tr>
                  ) : null}
                  <tr>
                    <th>{t.deflectionCheckLabel}</th>
                    <td className={deflectionVerdict.tone === 'ok' ? 'vem-report__tone-ok' : 'vem-report__tone-error'}>
                      {deflectionUtil !== null && Number.isFinite(deflectionUtil)
                        ? `${fmt.percent(deflectionUtil * 100).value}%`
                        : fmt.MISSING}
                    </td>
                    <td className={deflectionVerdict.tone === 'ok' ? 'vem-report__tone-ok' : 'vem-report__tone-error'}>
                      {VERDICT_LABEL[lang][deflectionVerdict.code]}
                    </td>
                  </tr>
                  {mcr !== null ? (
                    <tr>
                      <th>{t.crackingCheckLabel}</th>
                      <td className={crackingVerdict.tone === 'ok' ? 'vem-report__tone-ok' : 'vem-report__tone-error'}>
                        {crackingUtil !== null && Number.isFinite(crackingUtil)
                          ? `${fmt.percent(crackingUtil * 100).value}%`
                          : fmt.MISSING}
                      </td>
                      <td className={crackingVerdict.tone === 'ok' ? 'vem-report__tone-ok' : 'vem-report__tone-error'}>
                        {VERDICT_LABEL[lang][crackingVerdict.code]}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              {mcr !== null ? <div className="vem-report__note">{t.crackingNote}</div> : null}

              {diagramFields.map((f) => (
                <div key={f.key} className="vem-report__chart" style={{ height: CHART_HEIGHT }}>
                  <DiagramChart
                    title={f.title}
                    xs={xs}
                    ys={f.ys}
                    span={model.span}
                    elements={elements}
                    format={f.format}
                    flip={f.flip}
                    hoverX={null}
                    onHoverX={noop}
                  />
                </div>
              ))}
            </>
          )}
        </section>

        {/* 6. Nemlineáris futás */}
        {nonlinearRun ? (
          <section className="vem-report__section">
            <h2>{t.section6Title}</h2>
            <table>
              <tbody>
                <tr>
                  <th>{t.stateLabel}</th>
                  <td>
                    {nonlinearRun.status === 'converged'
                      ? t.convergedText(nonlinearRun.peakLambda.toFixed(3))
                      : nonlinearRun.status === 'limit-load-reached'
                        ? t.limitLoadText((nonlinearRun.loadingSteps.at(-1)?.lambda ?? 0).toFixed(3))
                        : t.divergedText}
                  </td>
                </tr>
                <tr>
                  <th>{t.rejectedAttemptsLabel}</th>
                  <td>{nonlinearRun.rejectedAttempts.length}</td>
                </tr>
              </tbody>
            </table>

            <div className="vem-report__chart" style={{ height: LD_CHART_HEIGHT }}>
              <LoadDisplacementChart run={nonlinearRun} activeStep={lastStepIndex} />
            </div>

            <table style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>{t.hingeIndexHeader}</th>
                  <th>{t.hingeEventHeader}</th>
                  <th>{t.hingeElementHeader}</th>
                  <th>{t.hingeXHeader}</th>
                  <th>λ</th>
                </tr>
              </thead>
              <tbody>
                {hinges.map((h, i) => (
                  <tr key={`${h.elementId}-${h.kind}-${h.stepIndex}-${i}`}>
                    <td>{i + 1}</td>
                    <td>{t.hingeKindLabel[h.kind]}</td>
                    <td>{h.elementId}</td>
                    <td>{h.xApprox !== null ? h.xApprox.toFixed(2) : '—'}</td>
                    <td>{h.lambda.toFixed(3)}</td>
                  </tr>
                ))}
                {hinges.length === 0 ? (
                  <tr>
                    <td colSpan={5}>{t.noPlasticZone}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            <div className="vem-report__chart" style={{ height: CONVERGENCE_HEIGHT }}>
              <ConvergencePanel run={nonlinearRun} activeStep={lastStepIndex} />
            </div>
          </section>
        ) : null}

        {/* 7. Hibabecslés */}
        <section className="vem-report__section">
          <h2>{t.section7Title}</h2>
          {result ? (
            <p>
              {t.errorEstimateBefore}
              <strong>{fmt.percent(result.errorEstimate).value}%</strong>
              {t.errorEstimateAfter}
            </p>
          ) : null}
        </section>

        <footer className="vem-report__footer">{t.footerNote}</footer>
      </article>
    </div>
  );
}
