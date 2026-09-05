/**
 * Levezetés — MASTER-PROMPT-TERV P15/A prompt, ADR-0005 (b) útja
 * (újraszámolás, nem nyomvonal-rögzítés): a mag publikus, finom szemcsézetű
 * függvényeit hívja lépésenként (`deriveElementStiffness`, `deriveLayerStep`
 * a `@femati/fem-core` `derivation` moduljából), és a köztes értékeket
 * jeleníti meg — a modul maga NEM számol semmit "kézzel".
 *
 * A levezetés 7 pontja (P15/A prompt sorrendje):
 *  1. FELADAT — statikai váz, anyagok/szelvények forrásmegjelöléssel.
 *  2. KERESZTMETSZET — rétegzés-levezetés, Mₑ/Mₚ/c behelyettesített számokkal.
 *  3. VÉGESELEM-FELOSZTÁS — csomópontok, szabadságfok-kiosztás.
 *  4. EGY VÁLASZTOTT ELEM TELJES LEVEZETÉSE — Gauss-pontok, N/dN, Jacobi, B,
 *     D, Kₑ, tehervektor — "a lényeg" (a felhasználó választja az elemet).
 *  5. KOMPILÁLÁS ÉS MEGOLDÁS.
 *  6. EREDMÉNYEK ÉS ELLENŐRZÉSEK.
 *  7. KÉPLÉKENY SZÁMÍTÁS — csak ha van nemlineáris futás.
 *
 * KÖTELEZŐ GARANCIA (ADR-0005): a 4. pont Kₑ/tehervektora és a 7. pont
 * rétegfeszültsége bit-azonos (ill. a többlépéses Newton-akkumuláció miatt
 * gépi pontosságig azonos — ld. `layerStepDerivation.ts`) a solver által
 * ténylegesen használt értékkel, mert SZÓ SZERINT ugyanazokat a fem-core
 * függvényeket hívja (ld. `packages/fem-core/test/derivation.test.ts`).
 */
import { useMemo, useState } from 'react';
import {
  deriveElementInternalForces,
  deriveElementLoadVector,
  deriveElementMass,
  deriveElementStiffness,
  elementGlobalNodeIndices,
} from '@femati/fem-core';
import './derivation.css';
import { findMaterial, findPreset, findSection, UNVERIFIED_WARNING } from '../data/catalog.js';
import { useAppStore } from '../state/appStore.js';
import { useModelStore } from '../state/modelStore.js';
import { useNonlinearStore } from '../state/nonlinearStore.js';
import type { NonlinearRun } from '../model/nonlinear.js';
import { buildHingeReport } from '../report/reportData.js';
import {
  buildDerivationData,
  computePlasticLayerRows,
  pickDefaultPlasticSample,
  plasticSampleElementX,
  type PlasticLayerRow,
  type PlasticSample,
} from './derivationData.js';
import { buildDerivationExportData } from './derivationExportData.js';
import { buildDerivationDocx, downloadBlob } from './docxExport.js';
import { FormulaBlock } from './Formula.js';
import {
  bendingGaussTex,
  convergenceTex,
  distributedLoadGaussTex,
  extrapolationTex,
  internalForceTex,
  jacobianTex,
  keDiagonalTex,
  layerSumTex,
  massDiagonalTex,
  massGaussTex,
  meMpTex,
  nodalLoadTex,
  plasticLayerTex,
  shearGaussTex,
  thermalLoadGaussTex,
} from './formulaLatex.js';
import * as fmt from '../format/numbers.js';
import { SUPPORT_TYPE_LABEL } from '../i18n/panels.js';
import { REPORT, formatReportDateTime } from '../i18n/report.js';
import { DERIVATION } from '../i18n/derivation.js';
import { presetDisplayName } from '../i18n/catalog.js';
import type { Lang } from '../state/appStore.js';

function fmtNum(v: number, digits = 4): string {
  if (!Number.isFinite(v)) return '—';
  return Object.is(v, -0) ? (0).toFixed(digits) : v.toFixed(digits);
}

function distributedLoadLabel(kind: 'distributed-force' | 'distributed-moment' | 'self-weight', t: (typeof DERIVATION)['hu']): string {
  return kind === 'distributed-force' ? t.distributedForceLabel : kind === 'distributed-moment' ? t.distributedMomentLabel : t.selfWeightLabel;
}

export function DerivationView(): JSX.Element | null {
  const lang = useAppStore((s) => s.lang);
  const t = DERIVATION[lang];
  const derivationOpen = useAppStore((s) => s.derivationOpen);
  const setDerivationOpen = useAppStore((s) => s.setDerivationOpen);
  const model = useModelStore((s) => s.model);
  const nonlinearRun = useNonlinearStore((s) => s.run);

  const data = useMemo(() => (derivationOpen ? buildDerivationData(model) : null), [derivationOpen, model]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  if (!derivationOpen || data === null) return null;

  const elementId = selectedElementId !== null && data.elementIds.includes(selectedElementId)
    ? selectedElementId
    : data.defaultElementId;

  const preset = findPreset(model.presetId);
  const section = findSection(model.sectionId);
  const material = findMaterial(model.materialId);
  const catalogUnverified = !material.verified || !section.verified;

  const layeredSection = data.model.sections[0];
  const layers = layeredSection?.kind === 'layered' ? layeredSection.layers : [];
  const layerA = layers.reduce((s, l) => s + (l.b as number) * (l.t as number), 0);
  const layerI = layers.reduce((s, l) => s + (l.b as number) * (l.z as number) ** 2 * (l.t as number), 0);
  const lastLayer = layers[layers.length - 1];
  const yMaxMm = lastLayer !== undefined ? ((lastLayer.z as number) + (lastLayer.t as number) / 2) * 1e3 : 0;

  const elementDerivation = deriveElementStiffness(data.model, elementId);
  const massDerivation = deriveElementMass(data.model, elementId);
  const loadDerivation = deriveElementLoadVector(data.model, elementId);
  const internalForceDerivation = deriveElementInternalForces(data.model, elementId, data.linear.displacements);
  const globalNodeIdx = elementGlobalNodeIndices(data.model, elementId);
  const boundaryRows: readonly (readonly [string, string, string])[] = data.model.boundaries.map((b) => {
    const nodeIndex = data.model.nodes.findIndex((n) => (n.id as unknown as string) === (b.nodeId as unknown as string));
    const x = data.model.nodes[nodeIndex]?.x as unknown as number | undefined;
    const dofs = [b.wFixed ? 'w = 0' : null, b.phiFixed ? 'φ = 0' : null].filter((v): v is string => v !== null);
    return [String(nodeIndex), x !== undefined ? x.toFixed(3) : '—', dofs.length > 0 ? dofs.join(', ') : t.springOnlyLabel] as const;
  });
  const elementResult = data.linear.elements.find((e) => e.elementId === elementId);

  const plasticSample = nonlinearRun !== null ? pickDefaultPlasticSample(nonlinearRun) : null;
  const hinges = nonlinearRun !== null ? buildHingeReport(nonlinearRun) : [];
  const plasticLayerRows = plasticSample !== null && nonlinearRun !== null ? computePlasticLayerRows(plasticSample, nonlinearRun) : null;

  const handleExportDocx = (): void => {
    const exportData = buildDerivationExportData({
      model,
      preset,
      section,
      material,
      linear: data.linear,
      layers,
      layerA,
      layerI,
      elementDerivation,
      massDerivation,
      loadDerivation,
      internalForceDerivation,
      globalNodeIdx,
      boundaryRows,
      elementResult,
      nonlinearRun,
      hinges,
      plasticSampleTitle: plasticSample !== null && nonlinearRun !== null ? plasticSampleTitle(plasticSample, nonlinearRun, lang) : '',
      plasticLayerDerivations: plasticLayerRows ?? [],
      lang,
    });
    buildDerivationDocx(exportData, lang)
      .then((blob) => downloadBlob(blob, `femati-levezetes-${model.presetId}.docx`))
      .catch((error: unknown) => {
         
        console.error('A .docx export sikertelen:', error);
      });
  };

  return (
    <div className="vem-overlay vem-derivation-overlay" onPointerDown={() => setDerivationOpen(false)}>
      <div className="vem-derivation-toolbar">
        <div className="vem-derivation-toolbar__inner" onPointerDown={(e) => e.stopPropagation()}>
          <label>
            {t.derivedElementLabel}
            <select
              className="vem-select"
              value={elementId}
              onChange={(e) => setSelectedElementId(e.target.value)}
            >
              {data.elementIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="vem-btn vem-btn--sm" onClick={() => setDerivationOpen(false)}>
            {t.close}
          </button>
          <button type="button" className="vem-btn vem-btn--sm" onClick={handleExportDocx}>
            {t.exportWord}
          </button>
          <button type="button" className="vem-btn vem-btn--primary vem-btn--sm" onClick={() => window.print()}>
            {t.printSave}
          </button>
        </div>
      </div>

      <article className="vem-derivation" onPointerDown={(e) => e.stopPropagation()}>
        {/* 1. FELADAT */}
        <header className="vem-derivation__header">
          <div>
            <h1>{t.title}</h1>
            <p className="vem-derivation__subtitle">
              {presetDisplayName(preset.id, lang)} (ref. {preset.ref})
            </p>
          </div>
          <div className="vem-derivation__header-meta">
            <div>{formatReportDateTime(new Date(), lang)}</div>
            <div>{t.versionLabel(__APP_VERSION__, __GIT_COMMIT__)}</div>
          </div>
        </header>

        <section className="vem-derivation__section">
          <h2>{t.section1Title}</h2>
          <table>
            <tbody>
              <tr>
                <th>{t.spanLabel}</th>
                <td>{fmt.length(model.span).value} m</td>
              </tr>
              <tr>
                <th>{t.elementCountLabel}</th>
                <td>{model.elementCount}</td>
              </tr>
              <tr>
                <th>{t.integrationLabel}</th>
                <td>{model.integration === 'selective' ? t.integrationSelective : t.integrationFull}</td>
              </tr>
              <tr>
                <th>{t.sectionLabel}</th>
                <td>
                  {section.name}
                  {!section.verified ? t.sectionSourceSuffixUnverified(section.source) : t.sectionSourceSuffixVerified(section.source)}
                </td>
              </tr>
              <tr>
                <th>{t.materialLabel}</th>
                <td>
                  {t.materialSummary(
                    fmt.stress(material.e * 1e4).value,
                    material.sigmaY > 0 ? `${material.sigmaY.toFixed(2)} kN/cm²` : t.materialElastic,
                    material.source,
                  )}
                </td>
              </tr>
            </tbody>
          </table>
          <table style={{ marginTop: 6 }}>
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
          <table style={{ marginTop: 6 }}>
            <thead>
              <tr>
                <th>{t.loadHeader}</th>
                <th>{t.valueHeader}</th>
              </tr>
            </thead>
            <tbody>
              {model.loads.map((l) => (
                <tr key={l.id}>
                  <td>{l.id}</td>
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
          {catalogUnverified ? (
            <div className="vem-derivation__note vem-derivation__note--warn">{UNVERIFIED_WARNING}</div>
          ) : null}
        </section>

        {/* 2. KERESZTMETSZET */}
        <section className="vem-derivation__section">
          <h2>{t.section2Title}</h2>
          <p>{t.layeredIntro(layers.length)}</p>
          <table>
            <thead>
              <tr>
                <th>l</th>
                <th>b_l [mm]</th>
                <th>t_l [mm]</th>
                <th>z_l [mm]</th>
                <th>b_l·t_l [mm²]</th>
                <th>b_l·z_l²·t_l [mm⁴]</th>
              </tr>
            </thead>
            <tbody>
              {layers.map((l, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{((l.b as number) * 1e3).toFixed(2)}</td>
                  <td>{((l.t as number) * 1e3).toFixed(2)}</td>
                  <td>{((l.z as number) * 1e3).toFixed(2)}</td>
                  <td>{((l.b as number) * (l.t as number) * 1e6).toFixed(1)}</td>
                  <td>{((l.b as number) * (l.z as number) ** 2 * (l.t as number) * 1e12).toFixed(0)}</td>
                </tr>
              ))}
              <tr>
                <th colSpan={4}>Σ</th>
                <td>
                  <strong>{(layerA * 1e6).toFixed(1)}</strong>
                </td>
                <td>
                  <strong>{(layerI * 1e12).toFixed(0)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
          <FormulaBlock lines={layerSumTex(layerA * 1e4, layerI * 1e8)} />
          <table style={{ marginTop: 6 }}>
            <tbody>
              <tr>
                <th>Mₑ = σY·Wₑ (Wₑ = I/y_max)</th>
                <td>{fmt.moment(data.linear.props.me).value} kNm</td>
              </tr>
              <tr>
                <th>Mₚ = σY·Wₚ (Wₚ = 2·S₀)</th>
                <td>{fmt.moment(data.linear.props.mp).value} kNm</td>
              </tr>
              <tr>
                <th>c = Mₚ/Mₑ</th>
                <td>{fmt.shapeFactor(data.linear.props.shapeFactor).value}</td>
              </tr>
            </tbody>
          </table>
          {data.linear.props.me !== null && data.linear.props.mp !== null ? (
            <>
              <FormulaBlock
                lines={meMpTex(
                  material.sigmaY,
                  data.linear.props.elasticModulus * 1e6,
                  data.linear.props.plasticModulus * 1e6,
                  data.linear.props.me,
                  data.linear.props.mp,
                  data.linear.props.shapeFactor,
                )}
              />
              <p className="vem-derivation__note">
                (W_e = I/y_max, y_max = {(yMaxMm / 10).toFixed(2)} cm; W_p = 2·S₀ = Σ(b_l·t_l·|z_l|).)
              </p>
            </>
          ) : (
            <p className="vem-derivation__note">
              {t.meMpNoteElastic(material.name, fmt.shapeFactor(data.linear.props.shapeFactor).value)}
            </p>
          )}
          {section.aCat !== undefined && section.iCat !== undefined
            ? (() => {
                const devA = ((layerA * 1e4 - section.aCat) / section.aCat) * 100;
                const devI = ((layerI * 1e8 - section.iCat) / section.iCat) * 100;
                const large = Math.abs(devA) > 10 || Math.abs(devI) > 10;
                return (
                  <p className={`vem-derivation__note${large ? ' vem-derivation__note--warn' : ''}`}>
                    {t.sectionTableDeviation(section.aCat.toFixed(2), devA.toFixed(2), String(section.iCat), devI.toFixed(2))}
                    {large
                      ? t.deviationLarge(layers.length, ((model.span > 0 ? (layers[0]?.t ?? 0) : 0) * 1e3).toFixed(1))
                      : t.deviationSmall}
                  </p>
                );
              })()
            : null}
        </section>

        {/* 3. VÉGESELEM-FELOSZTÁS */}
        <section className="vem-derivation__section">
          <h2>{t.section3Title}</h2>
          <table>
            <tbody>
              <tr>
                <th>{t.elementCountLabel}</th>
                <td>{model.elementCount}</td>
              </tr>
              <tr>
                <th>{t.elementLengthLabel}</th>
                <td>{(model.span / model.elementCount).toFixed(4)} m</td>
              </tr>
              <tr>
                <th>{t.nodeCountLabel}</th>
                <td>{data.linear.nodes.length}</td>
              </tr>
              <tr>
                <th>{t.dofLabel}</th>
                <td>
                  {data.linear.dofCount} {t.dofPerNodeSuffix}
                </td>
              </tr>
              <tr>
                <th>{t.activeDofLabel}</th>
                <td>{data.linear.activeDofCount}</td>
              </tr>
            </tbody>
          </table>
          <table style={{ marginTop: 6, maxHeight: 200 }}>
            <thead>
              <tr>
                <th>{t.nodeHeader}</th>
                <th>{t.xHeader}</th>
                <th>{t.dofHeader}</th>
              </tr>
            </thead>
            <tbody>
              {data.linear.nodes.map((n, i) => (
                <tr key={n.nodeId as unknown as string}>
                  <td>{n.nodeId as unknown as string}</td>
                  <td>{n.x.toFixed(3)}</td>
                  <td>
                    {2 * i}, {2 * i + 1}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 4. EGY VÁLASZTOTT ELEM TELJES LEVEZETÉSE */}
        <section className="vem-derivation__section">
          <h2>{t.section4Title(elementId)}</h2>
          <p>
            {t.section4Intro(
              elementDerivation.nodeX[0].toFixed(3),
              elementDerivation.nodeX[1].toFixed(3),
              elementDerivation.nodeX[2].toFixed(3),
              elementDerivation.length.toFixed(3),
              elementDerivation.scheme === 'selective' ? t.integrationSelective : t.integrationFull,
            )}
          </p>

          <h3>{t.section4_1Title}</h3>
          <FormulaBlock
            lines={jacobianTex(
              elementDerivation.bendingPoints[0]?.dn ?? [0, 0, 0],
              elementDerivation.nodeX,
              elementDerivation.bendingPoints[0]?.jacobian.j ?? 0,
              elementDerivation.bendingPoints[0]?.jacobian.invJ ?? 0,
            )}
          />
          <p className="vem-derivation__note">{t.jacobianNote}</p>

          <h3>{t.section4_2Title}</h3>
          <table>
            <thead>
              <tr>
                <th>ξ</th>
                <th>w</th>
                <th>N₁</th>
                <th>N₂</th>
                <th>N₃</th>
                <th>dN₁/dξ</th>
                <th>dN₂/dξ</th>
                <th>dN₃/dξ</th>
                <th>{t.bendingRowLabel}</th>
              </tr>
            </thead>
            <tbody>
              {elementDerivation.bendingPoints.map((gp, i) => (
                <tr key={i}>
                  <td>{fmtNum(gp.xi, 4)}</td>
                  <td>{fmtNum(gp.w, 4)}</td>
                  <td>{fmtNum(gp.n[0])}</td>
                  <td>{fmtNum(gp.n[1])}</td>
                  <td>{fmtNum(gp.n[2])}</td>
                  <td>{fmtNum(gp.dn[0])}</td>
                  <td>{fmtNum(gp.dn[1])}</td>
                  <td>{fmtNum(gp.dn[2])}</td>
                  <td>[{Array.from(gp.bRows.kappa).map((v) => fmtNum(v, 3)).join(', ')}]</td>
                </tr>
              ))}
            </tbody>
          </table>
          {elementDerivation.bendingPoints.map((gp, i) => (
            <FormulaBlock key={i} lines={bendingGaussTex(gp, i, elementDerivation.stiffness.ei, lang)} />
          ))}

          <h3>{t.section4_3Title(elementDerivation.shearPoints.length)}</h3>
          <table>
            <thead>
              <tr>
                <th>ξ</th>
                <th>w</th>
                <th>N₁</th>
                <th>N₂</th>
                <th>N₃</th>
                <th>{t.shearRowLabel}</th>
              </tr>
            </thead>
            <tbody>
              {elementDerivation.shearPoints.map((gp, i) => (
                <tr key={i}>
                  <td>{fmtNum(gp.xi, 4)}</td>
                  <td>{fmtNum(gp.w, 4)}</td>
                  <td>{fmtNum(gp.n[0])}</td>
                  <td>{fmtNum(gp.n[1])}</td>
                  <td>{fmtNum(gp.n[2])}</td>
                  <td>[{Array.from(gp.bRows.gamma).map((v) => fmtNum(v, 3)).join(', ')}]</td>
                </tr>
              ))}
            </tbody>
          </table>
          {elementDerivation.shearPoints.map((gp, i) => (
            <FormulaBlock key={i} lines={shearGaussTex(gp, i, elementDerivation.stiffness.gas, lang)} />
          ))}

          <h3>{t.section4_4Title}</h3>
          <FormulaBlock
            lines={[
              `EI = ${fmt.bendingStiffness(elementDerivation.stiffness.ei).value}\\ \\text{kNm}^2`,
              `GA_s = ${fmt.shearStiffness(elementDerivation.stiffness.gas).value}\\ \\text{kN}`,
            ]}
          />

          <h3>{t.section4_5Title}</h3>
          <p>{t.keIntro(elementDerivation.shearPoints.length)}</p>
          <FormulaBlock
            lines={keDiagonalTex(
              elementDerivation.bendingPoints,
              elementDerivation.shearPoints,
              elementDerivation.stiffness.ei,
              elementDerivation.stiffness.gas,
              elementDerivation.ke.get(1, 1),
              lang,
            )}
          />

          <h3>{t.section4_6Title}</h3>
          <div className="vem-derivation__matrix">
            <table>
              <tbody>
                {Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }, (_, j) => (
                      <td key={j}>{elementDerivation.ke.get(i, j).toExponential(3)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>{t.section4_7Title}</h3>
          {loadDerivation !== undefined ? (
            <>
              {loadDerivation.distributed.length === 0 && loadDerivation.nodal.length === 0 && loadDerivation.thermal === null ? (
                <p className="vem-derivation__note">{t.noDirectLoad}</p>
              ) : null}

              {loadDerivation.distributed.map((contribution, ci) => (
                <div key={ci}>
                  <h4>{t.distributedLoadHeading(distributedLoadLabel(contribution.kind, t), contribution.loadId, contribution.points.length)}</h4>
                  {contribution.points.map((gp, gi) => (
                    <FormulaBlock key={gi} lines={distributedLoadGaussTex(gp, gi, contribution.dofOffset === 0 ? '\\text{kN/m}' : '\\text{kNm/m}', lang)} />
                  ))}
                </div>
              ))}

              {loadDerivation.nodal.map((contribution, ni) => (
                <div key={ni}>
                  <h4>{contribution.kind === 'nodal-force' ? t.nodalForceHeading(contribution.loadId) : t.nodalMomentHeading(contribution.loadId)}</h4>
                  <FormulaBlock
                    lines={nodalLoadTex(contribution.localNode, contribution.dofOffset, contribution.value, contribution.dofOffset === 0 ? '\\text{kN}' : '\\text{kNm}', lang)}
                  />
                </div>
              ))}

              {loadDerivation.thermal !== null ? (
                <div>
                  <h4>{t.thermalLoadHeading}</h4>
                  <p className="vem-derivation__note">{t.thermalKappa0Note(loadDerivation.thermal.kappa0.toExponential(3))}</p>
                  {loadDerivation.thermal.points.map((gp, gi) => (
                    <FormulaBlock key={gi} lines={thermalLoadGaussTex(gp, gi, elementDerivation.stiffness.ei, loadDerivation.thermal?.kappa0 ?? 0, lang)} />
                  ))}
                </div>
              ) : null}

              <h4>{t.summationHeading}</h4>
              <div className="vem-derivation__matrix">
                q_e = [{Array.from(loadDerivation.total).map((v) => v.toExponential(3)).join(', ')}]
              </div>
            </>
          ) : (
            <div className="vem-derivation__matrix">
              [{Array.from(elementDerivation.loadVector).map((v) => v.toExponential(3)).join(', ')}]
            </div>
          )}
        </section>

        {/* 4A. A VÁLASZTOTT ELEM TÖMEGMÁTRIX-LEVEZETÉSE (ADR-0016) */}
        <section className="vem-derivation__section">
          <h2>{t.section4ATitle(elementId)}</h2>
          <p>{t.section4AIntro}</p>
          <FormulaBlock
            lines={[
              `m' = \\gamma\\cdot A / g = ${fmtNum(massDerivation.mass.massPerLength, 4)}\\ \\tfrac{\\text{kN}\\cdot\\text{s}^2}{\\text{m}^2}`,
              `m'_\\varphi = \\gamma\\cdot I / g = ${massDerivation.mass.rotaryInertiaPerLength.toExponential(4)}\\ \\text{kN}\\cdot\\text{s}^2`,
            ]}
          />

          <h3>{t.section4A_1Title}</h3>
          <table>
            <thead>
              <tr>
                <th>ξ</th>
                <th>w</th>
                <th>N₁</th>
                <th>N₂</th>
                <th>N₃</th>
                <th>{t.wRowLabel}</th>
                <th>{t.phiRowLabel}</th>
              </tr>
            </thead>
            <tbody>
              {massDerivation.points.map((gp, i) => (
                <tr key={i}>
                  <td>{fmtNum(gp.xi, 4)}</td>
                  <td>{fmtNum(gp.w, 4)}</td>
                  <td>{fmtNum(gp.n[0])}</td>
                  <td>{fmtNum(gp.n[1])}</td>
                  <td>{fmtNum(gp.n[2])}</td>
                  <td>[{Array.from(gp.nRows.w).map((v) => fmtNum(v, 3)).join(', ')}]</td>
                  <td>[{Array.from(gp.nRows.phi).map((v) => fmtNum(v, 3)).join(', ')}]</td>
                </tr>
              ))}
            </tbody>
          </table>
          {massDerivation.points.map((gp, i) => (
            <FormulaBlock
              key={i}
              lines={massGaussTex(gp, i, massDerivation.mass.massPerLength, massDerivation.mass.rotaryInertiaPerLength, lang)}
            />
          ))}

          <h3>{t.section4A_2Title}</h3>
          <p>{t.section4A_2Intro}</p>
          <FormulaBlock
            lines={massDiagonalTex(
              massDerivation.points,
              massDerivation.mass.massPerLength,
              massDerivation.mass.rotaryInertiaPerLength,
              massDerivation.me.get(0, 0),
              massDerivation.me.get(1, 1),
              lang,
            )}
          />

          <h3>{t.section4A_3Title}</h3>
          <div className="vem-derivation__matrix">
            <table>
              <tbody>
                {Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }, (_, j) => (
                      <td key={j}>{massDerivation.me.get(i, j).toExponential(3)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 5. KOMPILÁLÁS ÉS MEGOLDÁS */}
        <section className="vem-derivation__section">
          <h2>{t.section5Title}</h2>

          <h3>{t.section5_1Title(elementId)}</h3>
          {globalNodeIdx !== undefined ? (
            <>
              <p>{t.assemblyIntro(globalNodeIdx[0], globalNodeIdx[1], globalNodeIdx[2])}</p>
              <table>
                <thead>
                  <tr>
                    <th>{t.localDofHeader}</th>
                    <th>{t.nodeShortHeader}</th>
                    <th>{t.roleHeader}</th>
                    <th>{t.globalDofHeader}</th>
                  </tr>
                </thead>
                <tbody>
                  {(['w₁', 'φ₁', 'w₂', 'φ₂', 'w₃', 'φ₃'] as const).map((label, i) => (
                    <tr key={i}>
                      <td>{i}</td>
                      <td>{globalNodeIdx[Math.floor(i / 2)]}</td>
                      <td>{label}</td>
                      <td>{2 * (globalNodeIdx[Math.floor(i / 2)] ?? 0) + (i % 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="vem-derivation__note">
                {t.assemblyNote(
                  elementDerivation.ke.get(1, 1).toExponential(3),
                  `${2 * (globalNodeIdx[0] ?? 0) + 1}, ${2 * (globalNodeIdx[0] ?? 0) + 1}`,
                )}
              </p>
            </>
          ) : null}

          <h3>{t.section5_2Title}</h3>
          <table>
            <thead>
              <tr>
                <th>{t.nodeShortHeader}</th>
                <th>{t.xHeader}</th>
                <th>{t.prescriptionHeader}</th>
              </tr>
            </thead>
            <tbody>
              {boundaryRows.map((row, i) => (
                <tr key={i}>
                  <td>{row[0]}</td>
                  <td>{row[1]}</td>
                  <td>{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="vem-derivation__note">
            {data.linear.strategy === 'elimination'
              ? t.eliminationNote(data.linear.dofCount, data.linear.activeDofCount)
              : t.penaltyNote}
          </p>

          <h3>{t.section5_3Title}</h3>
          <table>
            <tbody>
              <tr>
                <th>{t.globalMatrixSizeLabel}</th>
                <td>{t.globalMatrixSizeValue(data.linear.dofCount, data.linear.activeDofCount)}</td>
              </tr>
              <tr>
                <th>{t.bandwidthLabel}</th>
                <td>{data.linear.meanBandwidth.toFixed(2)}</td>
              </tr>
              <tr>
                <th>{t.solverMethodLabel}</th>
                <td>{t.solverMethodValue}</td>
              </tr>
              <tr>
                <th>{t.selfCheckLabel}</th>
                <td>
                  {t.selfCheckValue(
                    data.linear.selfCheck.results.length - data.linear.selfCheck.errorCount,
                    data.linear.selfCheck.results.length,
                    data.linear.selfCheck.warningCount > 0 ? t.selfCheckWarningSuffix(data.linear.selfCheck.warningCount) : '',
                  )}
                </td>
              </tr>
            </tbody>
          </table>
          {internalForceDerivation !== undefined ? (
            <>
              <p>{t.displacementsIntro(elementId)}</p>
              <div className="vem-derivation__matrix">
                uₑ = [{Array.from(internalForceDerivation.ue).map((v) => v.toExponential(3)).join(', ')}]
              </div>
              <p className="vem-derivation__note">{t.displacementsNote}</p>
            </>
          ) : null}
        </section>

        {/* 6. EREDMÉNYEK ÉS ELLENŐRZÉSEK */}
        <section className="vem-derivation__section">
          <h2>{t.section6Title}</h2>

          {internalForceDerivation !== undefined ? (
            <>
              <h3>{t.section6_1Title}</h3>
              <p>{t.section6_1Intro}</p>
              {internalForceDerivation.points.map((gp, i) => (
                <FormulaBlock
                  key={i}
                  lines={internalForceTex(
                    i,
                    gp.xi,
                    gp.x,
                    gp.bKappa,
                    gp.bGamma,
                    gp.kappa,
                    gp.gamma,
                    gp.m,
                    gp.t,
                    elementDerivation.stiffness.ei,
                    elementDerivation.stiffness.gas,
                    internalForceDerivation.kappa0,
                    lang,
                  )}
                />
              ))}
              {internalForceDerivation.kappa0 !== 0 ? (
                <p className="vem-derivation__note">{t.kappa0Note(internalForceDerivation.kappa0.toExponential(3))}</p>
              ) : null}
            </>
          ) : null}

          {elementResult ? (
            <>
              <h3>{t.section6_2Title(elementId)}</h3>
              <table>
                <thead>
                  <tr>
                    <th>{t.gaussPointHeader}</th>
                    <th>{t.xHeader}</th>
                    <th>{t.momentHeader}</th>
                    <th>{t.shearHeader}</th>
                  </tr>
                </thead>
                <tbody>
                  {elementResult.gaussPoints.map((gp, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{gp.x.toFixed(3)}</td>
                      <td>{fmt.moment(gp.m).value}</td>
                      <td>{fmt.shear(gp.t).value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="vem-derivation__note">{t.elementErrorNote(fmt.percent(elementResult.errorEstimate).value)}</p>

              <h3>{t.section6_3Title}</h3>
              <p>{t.section6_3Intro}</p>
              {(() => {
                const gp0 = elementResult.gaussPoints[0];
                const gp1 = elementResult.gaussPoints[1];
                const gp2 = elementResult.gaussPoints[2];
                const xi0 = elementDerivation.bendingPoints[0]?.xi;
                const xi1 = elementDerivation.bendingPoints[1]?.xi;
                const xi2 = elementDerivation.bendingPoints[2]?.xi;
                if (gp0 === undefined || gp1 === undefined || gp2 === undefined || xi0 === undefined || xi1 === undefined || xi2 === undefined) {
                  return null;
                }
                const xis: readonly [number, number, number] = [xi0, xi1, xi2];
                const mValues: readonly [number, number, number] = [gp0.m, gp1.m, gp2.m];
                return (
                  <>
                    <FormulaBlock lines={extrapolationTex('M', mValues, xis, -1, `\\xi{=}{-}1\\ (\\text{${t.extrapLeftNode}})`, '\\text{kNm}')} />
                    <FormulaBlock lines={extrapolationTex('M', mValues, xis, 1, `\\xi{=}{+}1\\ (\\text{${t.extrapRightNode}})`, '\\text{kNm}')} />
                  </>
                );
              })()}
            </>
          ) : null}

          <table style={{ marginTop: 8 }}>
            <tbody>
              <tr>
                <th>{t.sumFzLabel}</th>
                <td className={data.linear.equilibrium.satisfied ? '' : 'vem-derivation__note--warn'}>
                  {fmt.force(data.linear.equilibrium.sumFz).value} kN
                </td>
              </tr>
              <tr>
                <th>{t.sumMyLabel}</th>
                <td className={data.linear.equilibrium.satisfied ? '' : 'vem-derivation__note--warn'}>
                  {fmt.moment(data.linear.equilibrium.sumMy).value} kNm
                </td>
              </tr>
            </tbody>
          </table>
          <p className="vem-derivation__note">{t.noReferenceNote}</p>
        </section>

        {/* 7. KÉPLÉKENY SZÁMÍTÁS */}
        {nonlinearRun !== null ? (
          <section className="vem-derivation__section">
            <h2>{t.section7Title}</h2>
            <h3>{t.stepLogTitle}</h3>
            <table>
              <thead>
                <tr>
                  <th>{t.stepHeader}</th>
                  <th>{t.lambdaHeader}</th>
                  <th>{t.iterationsHeader}</th>
                  <th>{t.psiNormHeader}</th>
                  <th>{t.fNormHeader}</th>
                  <th>{t.finalResidualHeader}</th>
                </tr>
              </thead>
              <tbody>
                {nonlinearRun.loadingSteps.map((s, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{s.lambda.toFixed(4)}</td>
                    <td>{s.iterations.length}</td>
                    <td>{(s.iterations.at(-1)?.psiNorm ?? 0).toExponential(3)}</td>
                    <td>{(s.iterations.at(-1)?.fNorm ?? 0).toExponential(3)}</td>
                    <td>{(s.iterations.at(-1)?.residualPercent ?? 0).toExponential(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>{t.convergenceFormulaTitle}</h3>
            <p>{t.convergenceFormulaIntro}</p>
            {(() => {
              const lastStep = nonlinearRun.loadingSteps.at(-1);
              const lastIter = lastStep?.iterations.at(-1);
              if (lastIter === undefined) return null;
              return (
                <FormulaBlock
                  lines={convergenceTex(
                    lastIter.psiNorm,
                    lastIter.fNorm,
                    lastIter.residualPercent,
                    nonlinearRun.tolerancePercent,
                    lastIter.residualPercent <= nonlinearRun.tolerancePercent,
                    lang,
                  )}
                />
              );
            })()}

            {plasticSample !== null ? (
              <PlasticSampleSection sample={plasticSample} run={nonlinearRun} lang={lang} />
            ) : (
              <p className="vem-derivation__note">{t.noPlasticSample}</p>
            )}

            <h3>{t.hingeSequenceTitle}</h3>
            <table>
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
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{REPORT[lang].hingeKindLabel[h.kind]}</td>
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

            <p className="vem-derivation__note">
              {nonlinearRun.status === 'converged'
                ? t.runConverged(nonlinearRun.peakLambda.toFixed(3))
                : nonlinearRun.status === 'limit-load-reached'
                  ? t.runLimitLoad((nonlinearRun.loadingSteps.at(-1)?.lambda ?? 0).toFixed(3))
                  : t.runDiverged}
            </p>
          </section>
        ) : (
          <section className="vem-derivation__section">
            <h2>{t.section7Title}</h2>
            <p className="vem-derivation__note">{t.noNonlinearRun}</p>
          </section>
        )}

        <footer className="vem-derivation__footer">{REPORT[lang].footerNote}</footer>
      </article>
    </div>
  );
}

/** A 7. pont "egy választott Gauss-pont rétegenkénti feszültségszámítása" táblázata. */
function plasticSampleTitle(sample: PlasticSample, run: NonlinearRun, lang: Lang): string {
  const t = DERIVATION[lang];
  const x = plasticSampleElementX(sample, run);
  return t.plasticSampleTitle(
    sample.elementId,
    sample.gaussIndex + 1,
    x !== null ? t.plasticSampleXSuffix(x.toFixed(2)) : '',
    sample.stepIndex + 1,
  );
}

export function pickPlasticFormulaSample(rows: readonly PlasticLayerRow[]): PlasticLayerRow | undefined {
  return rows.reduce((best, r) => (Math.abs(r.derived.sigmaTrial) > Math.abs(best.derived.sigmaTrial) ? r : best), rows[0]);
}

function PlasticSampleSection({
  sample,
  run,
  lang,
}: {
  readonly sample: PlasticSample;
  readonly run: NonlinearRun;
  readonly lang: Lang;
}): JSX.Element | null {
  const t = DERIVATION[lang];
  const rows = computePlasticLayerRows(sample, run);
  if (rows === null) return null;

  const extreme = pickPlasticFormulaSample(rows);

  return (
    <>
      <h3>{plasticSampleTitle(sample, run, lang)}</h3>
      {extreme !== undefined ? (
        <>
          <p className="vem-derivation__note">{t.plasticSampleExtreme}</p>
          <FormulaBlock lines={plasticLayerTex(extreme, lang)} />
        </>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>{t.layerHeader}</th>
            <th>{t.zHeader}</th>
            <th>{t.prevStressHeader}</th>
            <th>{t.dEpsHeader}</th>
            <th>{t.trialStressHeader}</th>
            <th>{t.rHeader}</th>
            <th>{t.newStressHeader}</th>
            <th>{t.yieldedHeader}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ layerIndex, zMm, derived }) => (
            <tr key={layerIndex}>
              <td>{layerIndex + 1}</td>
              <td>{zMm.toFixed(1)}</td>
              <td>{(derived.prevState.sigma * 1e-4).toFixed(3)}</td>
              <td>{derived.dEps.toExponential(3)}</td>
              <td>{(derived.sigmaTrial * 1e-4).toFixed(3)}</td>
              <td>{derived.step.r.toFixed(3)}</td>
              <td>{(derived.step.sigma * 1e-4).toFixed(3)}</td>
              <td>{derived.step.state.yielded ? t.yesWord : t.noWord}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
