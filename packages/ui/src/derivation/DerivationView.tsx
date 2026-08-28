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
import { deriveElementInternalForces, deriveElementLoadVector, deriveElementStiffness, elementGlobalNodeIndices } from '@femati/fem-core';
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
  jacobianTex,
  keDiagonalTex,
  layerSumTex,
  meMpTex,
  nodalLoadTex,
  plasticLayerTex,
  shearGaussTex,
  thermalLoadGaussTex,
} from './formulaLatex.js';
import * as fmt from '../format/numbers.js';

function fmtNum(v: number, digits = 4): string {
  if (!Number.isFinite(v)) return '—';
  return Object.is(v, -0) ? (0).toFixed(digits) : v.toFixed(digits);
}

const HINGE_KIND_LABEL: Record<'first-yield' | 'full-hinge', string> = {
  'first-yield': 'első megfolyás',
  'full-hinge': 'képlékeny csukló (teljes keresztmetszet)',
};

const DISTRIBUTED_LOAD_LABEL: Record<'distributed-force' | 'distributed-moment' | 'self-weight', string> = {
  'distributed-force': 'Megoszló erő',
  'distributed-moment': 'Megoszló nyomaték',
  'self-weight': 'Önsúly',
};

export function DerivationView(): JSX.Element | null {
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
  const loadDerivation = deriveElementLoadVector(data.model, elementId);
  const internalForceDerivation = deriveElementInternalForces(data.model, elementId, data.linear.displacements);
  const globalNodeIdx = elementGlobalNodeIndices(data.model, elementId);
  const boundaryRows: readonly (readonly [string, string, string])[] = data.model.boundaries.map((b) => {
    const nodeIndex = data.model.nodes.findIndex((n) => (n.id as unknown as string) === (b.nodeId as unknown as string));
    const x = data.model.nodes[nodeIndex]?.x as unknown as number | undefined;
    const dofs = [b.wFixed ? 'w = 0' : null, b.phiFixed ? 'φ = 0' : null].filter((v): v is string => v !== null);
    return [String(nodeIndex), x !== undefined ? x.toFixed(3) : '—', dofs.length > 0 ? dofs.join(', ') : '(csak rugó)'] as const;
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
      loadDerivation,
      internalForceDerivation,
      globalNodeIdx,
      boundaryRows,
      elementResult,
      nonlinearRun,
      hinges,
      plasticSampleTitle: plasticSample !== null && nonlinearRun !== null ? plasticSampleTitle(plasticSample, nonlinearRun) : '',
      plasticLayerDerivations: plasticLayerRows ?? [],
    });
    buildDerivationDocx(exportData)
      .then((blob) => downloadBlob(blob, `femati-levezetes-${model.presetId}.docx`))
      .catch((error: unknown) => {
         
        console.error('A .docx export sikertelen:', error);
      });
  };

  return (
    <div className="vem-derivation-overlay" onPointerDown={() => setDerivationOpen(false)}>
      <div className="vem-derivation-toolbar">
        <div className="vem-derivation-toolbar__inner" onPointerDown={(e) => e.stopPropagation()}>
          <label>
            Levezetett elem
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
            Bezárás
          </button>
          <button type="button" className="vem-btn vem-btn--sm" onClick={handleExportDocx}>
            Export: Word (.docx)
          </button>
          <button type="button" className="vem-btn vem-btn--primary vem-btn--sm" onClick={() => window.print()}>
            Nyomtatás / PDF mentése
          </button>
        </div>
      </div>

      <article className="vem-derivation" onPointerDown={(e) => e.stopPropagation()}>
        {/* 1. FELADAT */}
        <header className="vem-derivation__header">
          <div>
            <h1>FEMAti — Levezetés</h1>
            <p className="vem-derivation__subtitle">
              {preset.name} (ref. {preset.ref})
            </p>
          </div>
          <div className="vem-derivation__header-meta">
            <div>{new Intl.DateTimeFormat('hu-HU', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())}</div>
            <div>
              v{__APP_VERSION__} · mag: {__GIT_COMMIT__}
            </div>
          </div>
        </header>

        <section className="vem-derivation__section">
          <h2>1. Feladat</h2>
          <table>
            <tbody>
              <tr>
                <th>Fesztáv L</th>
                <td>{fmt.length(model.span).value} m</td>
              </tr>
              <tr>
                <th>Elemszám</th>
                <td>{model.elementCount}</td>
              </tr>
              <tr>
                <th>Integrálási séma</th>
                <td>{model.integration === 'selective' ? 'szelektív redukált' : 'teljes'}</td>
              </tr>
              <tr>
                <th>Szelvény</th>
                <td>
                  {section.name}
                  {!section.verified ? ` — ${section.source}` : ` (forrás: ${section.source})`}
                </td>
              </tr>
              <tr>
                <th>Anyag</th>
                <td>
                  E = {fmt.stress(material.e * 1e4).value} kN/cm², σY ={' '}
                  {material.sigmaY > 0 ? `${material.sigmaY.toFixed(2)} kN/cm²` : '— (rugalmas)'} — forrás:{' '}
                  {material.source}
                </td>
              </tr>
            </tbody>
          </table>
          <table style={{ marginTop: 6 }}>
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
          <table style={{ marginTop: 6 }}>
            <thead>
              <tr>
                <th>Teher</th>
                <th>Jellemző</th>
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
                        : l.q1 === l.q2
                          ? `q = ${l.q1.toFixed(1)} kN/m, ${l.x1.toFixed(2)}–${l.x2.toFixed(2)} m`
                          : `q = ${l.q1.toFixed(1)}→${l.q2.toFixed(1)} kN/m, ${l.x1.toFixed(2)}–${l.x2.toFixed(2)} m`}
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
          <h2>2. Keresztmetszet</h2>
          <p>
            A rétegelt (fiber) modell {layers.length} egyenlő vastagságú csíkra osztja a keresztmetszetet, a
            kontúrszélességet minden csík KÖZÉPVONALÁBAN mintavételezve (Diplomaterv 3.4.3, (3.54)).
          </p>
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
              Az anyagnak ({material.name}) nincs megadott folyáshatára (σY) — a katalógusban "csak rugalmas"
              jelöléssel szerepel. Emiatt Mₑ és Mₚ NEM értelmezhető (nem 0, hanem definiálatlan); csak a
              rugalmas keresztmetszeti jellemzők (A, I, Wₑ, Wₚ) számottevők ennél az anyagnál. A c = Wₚ/Wₑ alaki
              tényező a σY-tól függetlenül, tisztán geometriai mennyiség, ezért az továbbra is érvényes:{' '}
              c = {fmt.shapeFactor(data.linear.props.shapeFactor).value}.
            </p>
          )}
          {section.aCat !== undefined && section.iCat !== undefined
            ? (() => {
                const devA = ((layerA * 1e4 - section.aCat) / section.aCat) * 100;
                const devI = ((layerI * 1e8 - section.iCat) / section.iCat) * 100;
                const large = Math.abs(devA) > 10 || Math.abs(devI) > 10;
                return (
                  <p className={`vem-derivation__note${large ? ' vem-derivation__note--warn' : ''}`}>
                    Szelvénytáblázat: A = {section.aCat.toFixed(2)} cm² (eltérés {devA.toFixed(2)}%), I = {section.iCat}{' '}
                    cm⁴ (eltérés {devI.toFixed(2)}%) —{' '}
                    {large
                      ? `JELENTŐS eltérés: ${layers.length} rétegnél a rétegvastagság (${((model.span > 0 ? (layers[0]?.t ?? 0) : 0) * 1e3).toFixed(1)} mm) meghaladja az öv vastagságát, ezért a középponti mintavétel az első/utolsó rétegnél a teljes övszélességet a valós övnél vastagabb sávra vetíti ki (a P-13 validációs eset szerint ez a hiba 64 rétegnél 1% alá csökken — ld. docs/THEORY.md).`
                      : 'a rétegelt modell középponti mintavétele miatt kis mértékben eltér a lekerekítéseket is tartalmazó katalógusadattól.'}
                  </p>
                );
              })()
            : null}
        </section>

        {/* 3. VÉGESELEM-FELOSZTÁS */}
        <section className="vem-derivation__section">
          <h2>3. Végeselem-felosztás</h2>
          <table>
            <tbody>
              <tr>
                <th>Elemszám</th>
                <td>{model.elementCount}</td>
              </tr>
              <tr>
                <th>Elemhossz</th>
                <td>{(model.span / model.elementCount).toFixed(4)} m</td>
              </tr>
              <tr>
                <th>Csomópontok száma</th>
                <td>{data.linear.nodes.length}</td>
              </tr>
              <tr>
                <th>Szabadságfokok</th>
                <td>{data.linear.dofCount} (2 DOF/csomópont: w, φ)</td>
              </tr>
              <tr>
                <th>Aktív szabadságfokok</th>
                <td>{data.linear.activeDofCount}</td>
              </tr>
            </tbody>
          </table>
          <table style={{ marginTop: 6, maxHeight: 200 }}>
            <thead>
              <tr>
                <th>Csomópont</th>
                <th>x [m]</th>
                <th>DOF (w, φ)</th>
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
          <h2>4. A(z) {elementId} elem teljes levezetése</h2>
          <p>
            Csomópontok: x₁ = {elementDerivation.nodeX[0].toFixed(3)} m, x₂ = {elementDerivation.nodeX[1].toFixed(3)}{' '}
            m, x₃ = {elementDerivation.nodeX[2].toFixed(3)} m — hossz L_e ={' '}
            {elementDerivation.length.toFixed(3)} m. Integrálási séma: {elementDerivation.scheme === 'selective' ? 'szelektív redukált' : 'teljes'}.
          </p>

          <h3>4.1 Jacobi (a leképezés minden ξ-ben azonos, mert az elem egyenes és a középső csomópont pontosan a felezőpontban van)</h3>
          <FormulaBlock
            lines={jacobianTex(
              elementDerivation.bendingPoints[0]?.dn ?? [0, 0, 0],
              elementDerivation.nodeX,
              elementDerivation.bendingPoints[0]?.jacobian.j ?? 0,
              elementDerivation.bendingPoints[0]?.jacobian.invJ ?? 0,
            )}
          />
          <p className="vem-derivation__note">
            (A dN/dξ-ből fentebb csak a B1 Gauss-pont értékét használtuk — J minden ξ-re ugyanezt adja, mert az
            elem egyenes és a középső csomópont pontosan a felezőpontban van.)
          </p>

          <h3>4.2 Hajlítási tag — 3 pontos Gauss-integrálás, MINDEN pont TELJES, behelyettesített levezetése</h3>
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
                <th>κ-sor (B)</th>
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
            <FormulaBlock key={i} lines={bendingGaussTex(gp, i, elementDerivation.stiffness.ei)} />
          ))}

          <h3>
            4.3 Nyírási tag — {elementDerivation.shearPoints.length} pontos Gauss-integrálás, MINDEN pont TELJES
            levezetése
          </h3>
          <table>
            <thead>
              <tr>
                <th>ξ</th>
                <th>w</th>
                <th>N₁</th>
                <th>N₂</th>
                <th>N₃</th>
                <th>γ-sor (B)</th>
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
            <FormulaBlock key={i} lines={shearGaussTex(gp, i, elementDerivation.stiffness.gas)} />
          ))}

          <h3>4.4 D anyagmátrix</h3>
          <FormulaBlock
            lines={[
              `EI = ${fmt.bendingStiffness(elementDerivation.stiffness.ei).value}\\ \\text{kNm}^2`,
              `GA_s = ${fmt.shearStiffness(elementDerivation.stiffness.gas).value}\\ \\text{kN}`,
            ]}
          />

          <h3>4.5 Kₑ integrálás — konkrét, ellenőrizhető példa egy mátrixelemre</h3>
          <p>
            A Kₑ minden eleme az öt Gauss-pont (3 hajlítási + {elementDerivation.shearPoints.length} nyírási)
            hozzájárulásának ÖSSZEGE: Kₑ = Σ (tényező · Bᵀ·B). Az alábbi példa ezt egyetlen, teljesen kiírt
            mátrixelemre mutatja be, amely mindkét tagból kap járulékot:
          </p>
          <FormulaBlock
            lines={keDiagonalTex(
              elementDerivation.bendingPoints,
              elementDerivation.shearPoints,
              elementDerivation.stiffness.ei,
              elementDerivation.stiffness.gas,
              elementDerivation.ke.get(1, 1),
            )}
          />

          <h3>4.6 A 6×6 Kₑ mátrix végső alakja</h3>
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

          <h3>4.7 Elemi tehervektor (λ = 1) — terhenkénti, TELJES levezetés</h3>
          {loadDerivation !== undefined ? (
            <>
              {loadDerivation.distributed.length === 0 && loadDerivation.nodal.length === 0 && loadDerivation.thermal === null ? (
                <p className="vem-derivation__note">Erre az elemre nem hat közvetlen teher (a q_e = 0 vektor helyes).</p>
              ) : null}

              {loadDerivation.distributed.map((contribution, ci) => (
                <div key={ci}>
                  <h4>
                    {DISTRIBUTED_LOAD_LABEL[contribution.kind]} ({contribution.loadId}) — q_e = ∫Nᵀ·p dx, {contribution.points.length}{' '}
                    pontos Gauss-integrálással a teher és az elem tartományának metszetén
                  </h4>
                  {contribution.points.map((gp, gi) => (
                    <FormulaBlock key={gi} lines={distributedLoadGaussTex(gp, gi, contribution.dofOffset === 0 ? '\\text{kN/m}' : '\\text{kNm/m}')} />
                  ))}
                </div>
              ))}

              {loadDerivation.nodal.map((contribution, ni) => (
                <div key={ni}>
                  <h4>
                    {contribution.kind === 'nodal-force' ? 'Koncentrált csomóponti erő' : 'Koncentrált csomóponti nyomaték'} (
                    {contribution.loadId})
                  </h4>
                  <FormulaBlock
                    lines={nodalLoadTex(contribution.localNode, contribution.dofOffset, contribution.value, contribution.dofOffset === 0 ? '\\text{kN}' : '\\text{kNm}')}
                  />
                </div>
              ))}

              {loadDerivation.thermal !== null ? (
                <div>
                  <h4>Hőteher (κ₀-ból) — q_e = +∫Bᵀ·D·ε₀ dx (ADR-0006 előjel)</h4>
                  <p className="vem-derivation__note">κ₀ = {loadDerivation.thermal.kappa0.toExponential(3)} 1/m</p>
                  {loadDerivation.thermal.points.map((gp, gi) => (
                    <FormulaBlock key={gi} lines={thermalLoadGaussTex(gp, gi, elementDerivation.stiffness.ei, loadDerivation.thermal?.kappa0 ?? 0)} />
                  ))}
                </div>
              ) : null}

              <h4>Összegzés</h4>
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

        {/* 5. KOMPILÁLÁS ÉS MEGOLDÁS */}
        <section className="vem-derivation__section">
          <h2>5. Kompilálás és megoldás</h2>

          <h3>5.1 Összeszerelés — hova kerül a(z) {elementId} elem Kₑ-je a globális mátrixban?</h3>
          {globalNodeIdx !== undefined ? (
            <>
              <p>
                Csomópont-sorszámok a modellben (0-tól): {globalNodeIdx[0]}, {globalNodeIdx[1]}, {globalNodeIdx[2]} — a globális DOF
                index minden csomópontra 2·i (w) és 2·i+1 (φ), ld. `assembly/dofMap.ts`.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Lokális DOF</th>
                    <th>Csomópont</th>
                    <th>Szerep</th>
                    <th>Globális DOF</th>
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
                Az összeszerelés szabálya: K_global[I,J] += Kₑ[i,j] minden (i,j) lokális párra, ahol I,J a fenti táblázat szerinti
                globális DOF. Például a Kₑ[φ₁,φ₁] = {elementDerivation.ke.get(1, 1).toExponential(3)} (ld. 4.5/4.6 pont) a
                K_global[{2 * (globalNodeIdx[0] ?? 0) + 1}, {2 * (globalNodeIdx[0] ?? 0) + 1}] helyre kerül HOZZÁADVA (nem felülírva —
                más elemek is adhatnak járulékot ugyanoda, ha osztoznak ezen a csomóponton).
              </p>
            </>
          ) : null}

          <h3>5.2 Peremfeltétel-kezelés</h3>
          <table>
            <thead>
              <tr>
                <th>Csomópont</th>
                <th>x [m]</th>
                <th>Előírás</th>
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
              ? `Eliminációs stratégia: a fenti előírt DOF-ok KIMARADNAK a megoldandó rendszerből — a teljes ${data.linear.dofCount} DOF-ból ${data.linear.activeDofCount} marad aktív (ismeretlen).`
              : 'Penalty stratégia: az előírt DOF-ok egy nagy merevségű "rugóval" kényszerítve maradnak a rendszerben.'}
          </p>

          <h3>5.3 A megoldott rendszer és a kiválasztott elem elmozdulásai</h3>
          <table>
            <tbody>
              <tr>
                <th>Globális mátrix mérete</th>
                <td>
                  {data.linear.dofCount} × {data.linear.dofCount} (aktív: {data.linear.activeDofCount})
                </td>
              </tr>
              <tr>
                <th>Profil (átlagos sávszélesség)</th>
                <td>{data.linear.meanBandwidth.toFixed(2)}</td>
              </tr>
              <tr>
                <th>Megoldás módszere</th>
                <td>K_active·d_active = f_active, Skyline LDLᵀ direkt megoldó (ADR-0002)</td>
              </tr>
              <tr>
                <th>Önellenőrzés (selfCheck)</th>
                <td>
                  {data.linear.selfCheck.results.length - data.linear.selfCheck.errorCount}/
                  {data.linear.selfCheck.results.length} ellenőrzés rendben
                  {data.linear.selfCheck.warningCount > 0 ? `, ${data.linear.selfCheck.warningCount} figyelmeztetés` : ''}
                </td>
              </tr>
            </tbody>
          </table>
          {internalForceDerivation !== undefined ? (
            <>
              <p>
                A megoldásból (d = K⁻¹·f) kiolvasott elmozdulások a(z) {elementId} elem 3 csomópontjára, uₑ = [w₁,φ₁,w₂,φ₂,w₃,φ₃]:
              </p>
              <div className="vem-derivation__matrix">
                uₑ = [{Array.from(internalForceDerivation.ue).map((v) => v.toExponential(3)).join(', ')}]
              </div>
              <p className="vem-derivation__note">
                Ez a vektor a 6. pontban κ = B_κ·uₑ és γ = B_γ·uₑ formában adja az igénybevételt — a híd a "megoldás" (ez a pont) és
                az "eredmény" (6. pont) között.
              </p>
            </>
          ) : null}
        </section>

        {/* 6. EREDMÉNYEK ÉS ELLENŐRZÉSEK */}
        <section className="vem-derivation__section">
          <h2>6. Eredmények és ellenőrzések</h2>

          {internalForceDerivation !== undefined ? (
            <>
              <h3>6.1 Igénybevétel-visszaszámítás — κ = B_κ·uₑ, γ = B_γ·uₑ, M = EI·(κ−κ₀), T = GAs·γ</h3>
              <p>
                A csomóponti elmozdulásokból (5.3 pont, uₑ) az elem BÁRMELY ξ pontjában visszaszámítható a görbület
                (κ) és nyírási szögtorzulás (γ) — az alábbiakban ugyanabban a 3 pontban (STRESS_POINTS = GAUSS_3),
                ahol a szelvény ténylegesen M/T-t szolgáltat a diagramhoz.
              </p>
              {internalForceDerivation.points.map((gp, i) => (
                <FormulaBlock
                  key={i}
                  lines={[
                    `\\text{Gauss-pont } ${i + 1}:\\ \\xi=${gp.xi.toFixed(4)},\\ x=${gp.x.toFixed(3)}\\ \\text{m}`,
                    `\\kappa = B_\\kappa\\cdot u_e = [${Array.from(gp.bKappa).map((v) => v.toFixed(3)).join(',\\ ')}]\\cdot u_e = ${gp.kappa.toExponential(3)}\\ \\tfrac{1}{\\text{m}}`,
                    `\\gamma = B_\\gamma\\cdot u_e = [${Array.from(gp.bGamma).map((v) => v.toFixed(3)).join(',\\ ')}]\\cdot u_e = ${gp.gamma.toExponential(3)}`,
                    `M = EI\\cdot(\\kappa-\\kappa_0) = ${elementDerivation.stiffness.ei.toFixed(1)}\\cdot(${gp.kappa.toExponential(3)}-${internalForceDerivation.kappa0.toExponential(3)}) = ${gp.m.toFixed(3)}\\ \\text{kNm}`,
                    `T = GA_s\\cdot\\gamma = ${elementDerivation.stiffness.gas.toFixed(1)}\\cdot ${gp.gamma.toExponential(3)} = ${gp.t.toFixed(3)}\\ \\text{kN}`,
                  ]}
                />
              ))}
              {internalForceDerivation.kappa0 !== 0 ? (
                <p className="vem-derivation__note">
                  κ₀ = {internalForceDerivation.kappa0.toExponential(3)} 1/m (hőteher kezdeti görbülete, ld. 4.7 pont) — ezért M
                  képlete κ−κ₀-t használ, nem önmagában κ-t.
                </p>
              ) : null}
            </>
          ) : null}

          {elementResult ? (
            <>
              <h3>
                6.2 A(z) {elementId} elem Gauss-ponti igénybevétele → csomóponti extrapoláció (Diplomaterv 3.1.7.4)
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>Gauss-pont</th>
                    <th>x [m]</th>
                    <th>M [kNm]</th>
                    <th>T [kN]</th>
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
              <p className="vem-derivation__note">
                Elemhatáron a szomszédos elemek extrapolált értékét átlagoljuk, a köztük mért ugrás adja az
                elemenkénti hibajelzőt (jelenleg {fmt.percent(elementResult.errorEstimate).value}%) — ld.
                docs/THEORY.md 6. pont.
              </p>

              <h3>6.3 Gauss-pont → csomópont extrapoláció — a másodfokú (Lagrange-) képlet behelyettesítve</h3>
              <p>
                A 3 Gauss-pont (ξ₁,ξ₂,ξ₃) M-értékén átfektetett másodfokú polinomot kiértékelve ξ=−1-ben és ξ=+1-ben
                kapjuk az elem SAJÁT (még nem szomszéd-átlagolt) csomóponti extrapolált értékét — ξ=0-ban ez
                triviálisan a középső Gauss-pont saját értéke (ld. `extrapolation.ts` fejléce).
              </p>
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
                    <FormulaBlock lines={extrapolationTex('M', mValues, xis, -1, '\\xi{=}{-}1\\ (\\text{bal csp.})', '\\text{kNm}')} />
                    <FormulaBlock lines={extrapolationTex('M', mValues, xis, 1, '\\xi{=}{+}1\\ (\\text{jobb csp.})', '\\text{kNm}')} />
                  </>
                );
              })()}
            </>
          ) : null}

          <table style={{ marginTop: 8 }}>
            <tbody>
              <tr>
                <th>ΣFz (egyensúly)</th>
                <td className={data.linear.equilibrium.satisfied ? '' : 'vem-derivation__note--warn'}>
                  {fmt.force(data.linear.equilibrium.sumFz).value} kN
                </td>
              </tr>
              <tr>
                <th>ΣMy (egyensúly)</th>
                <td className={data.linear.equilibrium.satisfied ? '' : 'vem-derivation__note--warn'}>
                  {fmt.moment(data.linear.equilibrium.sumMy).value} kNm
                </td>
              </tr>
            </tbody>
          </table>
          <p className="vem-derivation__note">
            Ehhez az általános (felhasználó által szerkesztett) statikai vázhoz nincs kanonikus zárt alakú
            analitikus referencia — konkrét, rögzített esetekre (konzol, kéttámaszú, kétnyílású stb.) a zárt alakú
            összevetést a `fem-validation` csomag V-01…V-12 / P-01…P-16 esetei végzik el (ld. STATUS_REPORT.md 5.
            pont).
          </p>
        </section>

        {/* 7. KÉPLÉKENY SZÁMÍTÁS */}
        {nonlinearRun !== null ? (
          <section className="vem-derivation__section">
            <h2>7. Képlékeny számítás</h2>
            <h3>Teherlépcsőnkénti napló</h3>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>λ</th>
                  <th>iterációk</th>
                  <th>‖ψ‖</th>
                  <th>‖f‖</th>
                  <th>végső reziduum [%]</th>
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
            <h3>A konvergencia-képlet behelyettesítve (Diplomaterv 3.4.2.1/6. lépés, "CONUND")</h3>
            <p>
              100·‖ψ‖/‖f‖ ≤ Tolerancia — az utolsó teherlépcső utolsó iterációjára konkrétan kiírva:
            </p>
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
                  )}
                />
              );
            })()}

            {plasticSample !== null ? (
              <PlasticSampleSection sample={plasticSample} run={nonlinearRun} />
            ) : (
              <p className="vem-derivation__note">Ebben a futásban sehol nem folyt meg réteg — nincs bemutatható példa.</p>
            )}

            <h3>A képlékeny csuklók kialakulási sorrendje</h3>
            <table>
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
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{HINGE_KIND_LABEL[h.kind]}</td>
                    <td>{h.elementId}</td>
                    <td>{h.xApprox !== null ? h.xApprox.toFixed(2) : '—'}</td>
                    <td>{h.lambda.toFixed(3)}</td>
                  </tr>
                ))}
                {hinges.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Nem alakult ki képlékeny zóna.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            <p className="vem-derivation__note">
              {nonlinearRun.status === 'converged'
                ? `A futás λ = ${nonlinearRun.peakLambda.toFixed(3)}-ig konvergált — ez a beállított csúcs-teherszorzó, NEM feltétlenül a szerkezet valódi határtehere.`
                : nonlinearRun.status === 'limit-load-reached'
                  ? `A futás a numerikus határteher közelébe ért (λ ≈ ${(nonlinearRun.loadingSteps.at(-1)?.lambda ?? 0).toFixed(3)}). Ehhez az általános vázhoz nincs kanonikus zárt alakú képlékeny határteher-képlet — konkrét esetekre ld. fem-validation P-03…P-08.`
                  : 'A futás megszakadt.'}
            </p>
          </section>
        ) : (
          <section className="vem-derivation__section">
            <h2>7. Képlékeny számítás</h2>
            <p className="vem-derivation__note">
              Nincs nemlineáris futási eredmény — futtasd a SZÁMÍTÁS gombbal (F5), majd nyisd meg újra a
              levezetést, hogy ez a pont is megjelenjen.
            </p>
          </section>
        )}

        <footer className="vem-derivation__footer">
          A számítás eredményét szakmai felelősséggel ellenőrizni kell.
        </footer>
      </article>
    </div>
  );
}

/** A 7. pont "egy választott Gauss-pont rétegenkénti feszültségszámítása" táblázata. */
function plasticSampleTitle(sample: PlasticSample, run: NonlinearRun): string {
  const x = plasticSampleElementX(sample, run);
  return (
    `Egy választott Gauss-pont rétegenkénti feszültségszámítása — ${sample.elementId}, Gauss-pont ` +
    `${sample.gaussIndex + 1}/3${x !== null ? ` (x ≈ ${x.toFixed(2)} m)` : ''}, lépés #${sample.stepIndex + 1}`
  );
}

export function pickPlasticFormulaSample(rows: readonly PlasticLayerRow[]): PlasticLayerRow | undefined {
  return rows.reduce((best, r) => (Math.abs(r.derived.sigmaTrial) > Math.abs(best.derived.sigmaTrial) ? r : best), rows[0]);
}

function PlasticSampleSection({
  sample,
  run,
}: {
  readonly sample: PlasticSample;
  readonly run: NonlinearRun;
}): JSX.Element | null {
  const rows = computePlasticLayerRows(sample, run);
  if (rows === null) return null;

  const extreme = pickPlasticFormulaSample(rows);

  return (
    <>
      <h3>{plasticSampleTitle(sample, run)}</h3>
      {extreme !== undefined ? (
        <>
          <p className="vem-derivation__note">Teljesen kiírt példa — a legnagyobb |σ_trial|-jal:</p>
          <FormulaBlock lines={plasticLayerTex(extreme)} />
        </>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>réteg</th>
            <th>z [mm]</th>
            <th>σ_{'{r-1}'} [kN/cm²]</th>
            <th>Δε</th>
            <th>σ_trial [kN/cm²]</th>
            <th>R</th>
            <th>σ_új [kN/cm²]</th>
            <th>folyva?</th>
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
              <td>{derived.step.state.yielded ? 'igen' : 'nem'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
