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
import { findMaterial, findPreset, findSection, UNVERIFIED_WARNING } from '../data/catalog.js';
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

const noop = (): void => {};

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat('hu-HU', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(d);
}

const HINGE_KIND_LABEL: Record<'first-yield' | 'full-hinge', string> = {
  'first-yield': 'első megfolyás',
  'full-hinge': 'képlékeny csukló (teljes keresztmetszet)',
};

export function ReportView(): JSX.Element | null {
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
        { key: 'M', title: 'M — hajlítónyomaték', ys: result.nodes.map((n) => n.m), format: fmt.moment, flip: momentTensionSide },
        { key: 'T', title: 'T — nyíróerő', ys: result.nodes.map((n) => n.t), format: fmt.shear, flip: false },
        { key: 'w', title: 'w — lehajlás', ys: result.nodes.map((n) => n.w), format: fmt.deflection, flip: false },
        { key: 'phi', title: 'φ — elfordulás', ys: result.nodes.map((n) => n.phi), format: fmt.rotation, flip: false },
      ] as const)
    : [];

  const hinges = nonlinearRun ? buildHingeReport(nonlinearRun) : [];
  const lastStepIndex = nonlinearRun ? combinedSteps(nonlinearRun).length - 1 : 0;
  const catalogUnverified = !material.verified || !section.verified;

  return (
    <div className="vem-report-overlay" onPointerDown={() => setReportOpen(false)}>
      <div className="vem-report-toolbar">
        <div className="vem-report-toolbar__inner" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className="vem-btn vem-btn--sm" onClick={() => setReportOpen(false)}>
            Bezárás
          </button>
          <button type="button" className="vem-btn vem-btn--primary vem-btn--sm" onClick={() => window.print()}>
            Nyomtatás / PDF mentése
          </button>
        </div>
      </div>

      <article className="vem-report" onPointerDown={(e) => e.stopPropagation()}>
        {/* 1. Fejléc */}
        <header className="vem-report__header">
          <div>
            <h1>FEMAti — Számítási jegyzőkönyv</h1>
            <p className="vem-report__subtitle">
              {preset.name} (ref. {preset.ref})
            </p>
          </div>
          <div className="vem-report__header-meta">
            <div>{formatDateTime(generatedAt)}</div>
            <div>v{__APP_VERSION__} · mag: {__GIT_COMMIT__}</div>
          </div>
        </header>

        {/* 2. Modell */}
        <section className="vem-report__section">
          <h2>2. Modell</h2>
          <div className="vem-report__grid">
            <table>
              <tbody>
                <tr>
                  <th>Fesztáv L</th>
                  <td>{fmt.length(model.span).value} m</td>
                </tr>
                <tr>
                  <th>Szelvény</th>
                  <td>{section.name}</td>
                </tr>
                <tr>
                  <th>Anyag</th>
                  <td>{material.name}</td>
                </tr>
                <tr>
                  <th>Önsúly</th>
                  <td>{model.selfWeight ? 'figyelembe véve' : 'nincs figyelembe véve'}</td>
                </tr>
              </tbody>
            </table>
            <table>
              <thead>
                <tr>
                  <th>Támasz</th>
                  <th>x [m]</th>
                  <th>Típus</th>
                </tr>
              </thead>
              <tbody>
                {model.supports.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.x.toFixed(2)}</td>
                    <td>{s.type === 'fixed' ? 'befogás' : s.type === 'pinned' ? 'csuklós' : 'görgős'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <table style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Teher</th>
                <th>Típus</th>
                <th>Jellemző</th>
              </tr>
            </thead>
            <tbody>
              {model.loads.map((l) => (
                <tr key={l.id}>
                  <td>{l.id}</td>
                  <td>
                    {l.kind === 'point'
                      ? 'koncentrált erő'
                      : l.kind === 'moment'
                        ? 'koncentrált nyomaték'
                        : l.kind === 'distributed'
                          ? 'megoszló teher'
                          : 'megoszló nyomatékteher'}
                  </td>
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
              {!material.verified ? ` Anyag (${material.name}): ${material.source}.` : ''}
              {!section.verified ? ` Szelvény (${section.name}): ${section.source}.` : ''}
            </div>
          ) : null}
        </section>

        {/* 3. Háló */}
        <section className="vem-report__section">
          <h2>3. Háló</h2>
          <table>
            <tbody>
              <tr>
                <th>Elemszám</th>
                <td>{model.elementCount}</td>
              </tr>
              <tr>
                <th>Elemhossz</th>
                <td>{(model.span / model.elementCount).toFixed(3)} m</td>
              </tr>
              <tr>
                <th>Szabadságfokok</th>
                <td>{result ? fmt.count(result.dofCount, 'DOF').value : '—'}</td>
              </tr>
              <tr>
                <th>Integrálási séma</th>
                <td>
                  {model.integration === 'selective'
                    ? 'szelektív redukált (hajlítás 3 pont, nyírás 2 pont)'
                    : 'teljes (mindkét tag 3 pontos)'}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 4. Megoldó beállításai */}
        <section className="vem-report__section">
          <h2>4. Megoldó beállításai</h2>
          <table>
            <tbody>
              <tr>
                <th>Algoritmus</th>
                <td>{algorithm === 'newton' ? 'Newton-Raphson (teljes)' : 'módosított Newton'}</td>
              </tr>
              <tr>
                <th>Teherlépcső Δλ</th>
                <td>{loadStep.toFixed(2)}</td>
              </tr>
              <tr>
                <th>Tolerancia</th>
                <td>{tolerance.toFixed(2)} %</td>
              </tr>
              <tr>
                <th>Csúcs-teherszorzó λ_cél</th>
                <td>{peakLambda.toFixed(2)}</td>
              </tr>
              <tr>
                <th>Tehertörténet</th>
                <td>{loadHistory === 'unloading' ? 'terhelés a csúcsig, majd tehermentesítés' : 'monoton'}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 5. Eredmények (lineáris) */}
        <section className="vem-report__section">
          <h2>5. Eredmények</h2>
          {error !== null ? (
            <div className="vem-report__note vem-report__note--warn">A modell jelenleg nem futtatható: {error}</div>
          ) : result === null ? (
            <div className="vem-report__note">Nincs számítható modell.</div>
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
                      <th>Reakció</th>
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
                      <th>ΣFz / ΣMy ellenőrzés</th>
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
            <h2>6. Nemlineáris (rugalmas–képlékeny) futás</h2>
            <table>
              <tbody>
                <tr>
                  <th>Állapot</th>
                  <td>
                    {nonlinearRun.status === 'converged'
                      ? `konvergált λ = ${nonlinearRun.peakLambda.toFixed(3)}-ig`
                      : nonlinearRun.status === 'limit-load-reached'
                        ? `a szerkezet a határteher közelébe ért (λ ≈ ${(nonlinearRun.loadingSteps.at(-1)?.lambda ?? 0).toFixed(3)})`
                        : 'a futás megszakadt'}
                  </td>
                </tr>
                <tr>
                  <th>Elvetett próbálkozások (Δλ-felezés)</th>
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
                  <th>#</th>
                  <th>Esemény</th>
                  <th>Elem</th>
                  <th>x ≈ [m]</th>
                  <th>λ</th>
                </tr>
              </thead>
              <tbody>
                {hinges.map((h, i) => (
                  <tr key={`${h.elementId}-${h.kind}-${h.stepIndex}-${i}`}>
                    <td>{i + 1}</td>
                    <td>{HINGE_KIND_LABEL[h.kind]}</td>
                    <td>{h.elementId}</td>
                    <td>{h.xApprox !== null ? h.xApprox.toFixed(2) : '—'}</td>
                    <td>{h.lambda.toFixed(3)}</td>
                  </tr>
                ))}
                {hinges.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Nem alakult ki képlékeny zóna ebben a futásban.</td>
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
          <h2>7. Hibabecslés és hálófüggetlenség</h2>
          {result ? (
            <p>
              A legrosszabb elemenkénti hibajelző (az elemhatáron mért, átlagolás előtti igénybevétel-ugrás a mező
              szélsőértékéhez viszonyítva): <strong>{fmt.percent(result.errorEstimate).value}%</strong>. A jelző a
              hálósűrűség növelésével csökken (h-konvergencia) — ld. docs/THEORY.md 6. és 12. pont. A jelen
              jegyzőkönyv NEM helyettesíti a hálófüggetlenségi vizsgálatot: eltérő elemszámmal újrafuttatva
              ellenőrizendő, hogy az eredmény érdemben nem változik.
            </p>
          ) : null}
        </section>

        <footer className="vem-report__footer">
          A számítás eredményét szakmai felelősséggel ellenőrizni kell.
        </footer>
      </article>
    </div>
  );
}
