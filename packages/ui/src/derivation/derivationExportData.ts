/**
 * A .docx exporthoz szükséges, MÁR KISZÁMÍTOTT értékekből összeállított,
 * lapos (csak stringeket/számokat tartalmazó) adatszerkezet.
 *
 * SZÁNDÉKOSAN nem számol semmit újra — a `DerivationView.tsx`-ben már
 * meglévő objektumokat (a fem-core `deriveElementStiffness`/`deriveLayerStep`
 * kimenetét, a `LinearResult`-ot, a `NonlinearRun`-t) alakítja át
 * docx-barát formára, hogy a képernyőn látott és a .docx-be exportált szám
 * UGYANONNAN származzon (ADR-0005 szelleme).
 *
 * KÉPLETEK (2026-09-04 óta): a képlet-mezők a `formulaLatex.ts` UGYANAZON
 * LaTeX-sorait használják, amiket a `DerivationView.tsx` KaTeX-hez —
 * korábban (ADR-0005) egy KÜLÖN, sima szöveges `formulaText.ts` modul adta
 * ezeket a .docx-hez; ez a felhasználó kifejezett kérésére megszűnt (a
 * `.docx`-ben mostantól valódi Word-képletobjektum jelenik meg, ld.
 * `formulaOmml.ts`), ezért itt is a LaTeX-sorokat exponáljuk — a
 * `docxExport.ts` alakítja őket OOXML-lé.
 */
import type { ElementInternalForceDerivation, ElementLoadDerivation, ElementResult, LinearResult } from '@femati/fem-core';
import type { ElementMassDerivation, ElementStiffnessDerivation, LayerStepDerivation } from '@femati/fem-core';
import type { MaterialEntry, PresetEntry, SectionEntry } from '../data/catalog.js';
import type { EditableModel } from '../model/editable.js';
import type { NonlinearRun } from '../model/nonlinear.js';
import type { ReportHinge } from '../report/reportData.js';
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

const DISTRIBUTED_LOAD_LABEL_TEXT: Record<'distributed-force' | 'distributed-moment' | 'self-weight', string> = {
  'distributed-force': 'Megoszló erő',
  'distributed-moment': 'Megoszló nyomaték',
  'self-weight': 'Önsúly',
};

/** Egy képlet-mező sora: sima felirat VAGY egy LaTeX-sor (→ valódi Word-képlet, ld. `formulaOmml.ts`). */
export type FormulaLine = { readonly kind: 'text'; readonly text: string } | { readonly kind: 'math'; readonly latex: string };

const text = (t: string): FormulaLine => ({ kind: 'text', text: t });
const mathLines = (lines: readonly string[]): readonly FormulaLine[] => lines.map((latex) => ({ kind: 'math', latex }) as const);

/** A 4.7 pont terhenkénti, TELJES levezetése — feliratok és LaTeX-képletsorok vegyesen. */
function buildLoadFormulas(loadDerivation: ElementLoadDerivation | undefined, ei: number): readonly FormulaLine[] {
  if (loadDerivation === undefined) return [];
  const lines: FormulaLine[] = [];
  if (loadDerivation.distributed.length === 0 && loadDerivation.nodal.length === 0 && loadDerivation.thermal === null) {
    lines.push(text('Erre az elemre nem hat közvetlen teher (a q_e = 0 vektor helyes).'));
  }
  for (const contribution of loadDerivation.distributed) {
    const unit = contribution.dofOffset === 0 ? '\\text{kN/m}' : '\\text{kNm/m}';
    lines.push(
      text(
        `${DISTRIBUTED_LOAD_LABEL_TEXT[contribution.kind]} (${contribution.loadId}) — q_e = ∫Nᵀ·p dx, ${contribution.points.length} pontos Gauss-integrálással:`,
      ),
      ...contribution.points.flatMap((gp, i) => mathLines(distributedLoadGaussTex(gp, i, unit))),
    );
  }
  for (const contribution of loadDerivation.nodal) {
    const unit = contribution.dofOffset === 0 ? '\\text{kN}' : '\\text{kNm}';
    lines.push(
      text(contribution.kind === 'nodal-force' ? `Koncentrált csomóponti erő (${contribution.loadId}):` : `Koncentrált csomóponti nyomaték (${contribution.loadId}):`),
      ...mathLines(nodalLoadTex(contribution.localNode, contribution.dofOffset, contribution.value, unit)),
    );
  }
  if (loadDerivation.thermal !== null) {
    const thermal = loadDerivation.thermal;
    lines.push(
      text(`Hőteher (κ₀-ból) — q_e = +∫Bᵀ·D·ε₀ dx (ADR-0006 előjel). κ₀ = ${thermal.kappa0.toExponential(3)} 1/m`),
      ...thermal.points.flatMap((gp, i) => mathLines(thermalLoadGaussTex(gp, i, ei, thermal.kappa0))),
    );
  }
  return lines;
}

export interface DerivationExportPlastic {
  readonly stepRows: readonly (readonly string[])[];
  readonly convergenceFormula: readonly string[] | null;
  readonly sampleTitle: string;
  readonly sampleFormula: readonly string[] | null;
  readonly layerRows: readonly (readonly string[])[];
  readonly hingeRows: readonly (readonly string[])[];
}

export interface DerivationExportData {
  readonly generatedAt: string;
  readonly appVersion: string;
  readonly gitCommit: string;
  readonly presetName: string;
  readonly presetRef: string;

  readonly span: number;
  readonly elementCount: number;
  readonly integrationLabel: string;
  readonly sectionName: string;
  readonly sectionSource: string;
  readonly materialName: string;
  readonly materialSummary: string;
  readonly materialSource: string;
  readonly supportRows: readonly (readonly string[])[];
  readonly loadRows: readonly (readonly string[])[];

  readonly layerRows: readonly (readonly string[])[];
  readonly layerSumFormula: readonly string[];
  readonly me: string;
  readonly mp: string;
  readonly shapeFactor: string;
  /** `null` esetén nincs σY (ld. `meMpNote`), egyébként 3 LaTeX-sor (Mₑ/Mₚ/c). */
  readonly meMpFormula: readonly string[] | null;
  readonly meMpNote: string;

  readonly elementLength: number;
  readonly nodeCount: number;
  readonly dofCount: number;

  readonly elementId: string;
  readonly elementNodeX: readonly [string, string, string];
  readonly jacobianFormula: readonly string[];
  readonly bendingRows: readonly (readonly string[])[];
  readonly shearRows: readonly (readonly string[])[];
  readonly bendingFormulas: readonly string[];
  readonly shearFormulas: readonly string[];
  readonly keDiagonalFormula: readonly string[];
  readonly ei: string;
  readonly gas: string;
  readonly keRows: readonly string[];
  readonly loadFormulas: readonly FormulaLine[];
  readonly loadVectorRow: string;

  readonly massPerLength: string;
  readonly rotaryInertiaPerLength: string;
  readonly massRows: readonly (readonly string[])[];
  readonly massFormulas: readonly string[];
  readonly massDiagonalFormula: readonly string[];
  readonly meRows: readonly string[];

  readonly assemblyRows: readonly (readonly string[])[];
  readonly assemblyNote: string;
  readonly boundaryRows: readonly (readonly string[])[];
  readonly boundaryNote: string;
  readonly ueRow: string;
  readonly internalForceFormulas: readonly string[];

  readonly meanBandwidth: string;
  readonly strategyLabel: string;
  readonly activeDofCount: number;

  readonly resultGaussRows: readonly (readonly string[])[];
  readonly extrapolationFormulas: readonly string[];
  readonly sumFz: string;
  readonly sumMy: string;

  readonly plastic: DerivationExportPlastic | null;
}

function fixed(v: number | null, digits = 4): string {
  return v !== null && Number.isFinite(v) ? v.toFixed(digits) : '—';
}

export interface DerivationExportContext {
  readonly model: EditableModel;
  readonly preset: PresetEntry;
  readonly section: SectionEntry;
  readonly material: MaterialEntry;
  readonly linear: LinearResult;
  readonly layers: readonly { readonly b: number; readonly t: number; readonly z: number }[];
  readonly layerA: number;
  readonly layerI: number;
  readonly elementDerivation: ElementStiffnessDerivation;
  readonly massDerivation: ElementMassDerivation;
  readonly loadDerivation: ElementLoadDerivation | undefined;
  readonly internalForceDerivation: ElementInternalForceDerivation | undefined;
  readonly globalNodeIdx: readonly [number, number, number] | undefined;
  readonly boundaryRows: readonly (readonly [string, string, string])[];
  readonly elementResult: ElementResult | undefined;
  readonly nonlinearRun: NonlinearRun | null;
  readonly hinges: readonly ReportHinge[];
  readonly plasticSampleTitle: string;
  readonly plasticLayerDerivations: readonly {
    readonly layerIndex: number;
    readonly zMm: number;
    readonly derived: LayerStepDerivation;
  }[];
}

export function buildDerivationExportData(ctx: DerivationExportContext): DerivationExportData {
  const { model, preset, section, material, linear, layers, layerA, layerI, elementDerivation, elementResult } = ctx;

  const plastic: DerivationExportPlastic | null =
    ctx.nonlinearRun !== null
      ? {
          stepRows: ctx.nonlinearRun.loadingSteps.map((s, i) => [
            String(i + 1),
            s.lambda.toFixed(4),
            String(s.iterations.length),
            (s.iterations.at(-1)?.psiNorm ?? 0).toExponential(3),
            (s.iterations.at(-1)?.fNorm ?? 0).toExponential(3),
            (s.iterations.at(-1)?.residualPercent ?? 0).toExponential(2),
          ]),
          convergenceFormula: (() => {
            const lastIter = ctx.nonlinearRun?.loadingSteps.at(-1)?.iterations.at(-1);
            if (lastIter === undefined || ctx.nonlinearRun === null) return null;
            return convergenceTex(
              lastIter.psiNorm,
              lastIter.fNorm,
              lastIter.residualPercent,
              ctx.nonlinearRun.tolerancePercent,
              lastIter.residualPercent <= ctx.nonlinearRun.tolerancePercent,
            );
          })(),
          sampleTitle: ctx.plasticSampleTitle,
          sampleFormula:
            ctx.plasticLayerDerivations.length > 0
              ? plasticLayerTex(
                  ctx.plasticLayerDerivations.reduce(
                    (best, r) => (Math.abs(r.derived.sigmaTrial) > Math.abs(best.derived.sigmaTrial) ? r : best),
                    ctx.plasticLayerDerivations[0] as (typeof ctx.plasticLayerDerivations)[number],
                  ),
                )
              : null,
          layerRows: ctx.plasticLayerDerivations.map(({ layerIndex, zMm, derived }) => [
            String(layerIndex + 1),
            zMm.toFixed(1),
            (derived.prevState.sigma * 1e-4).toFixed(3),
            derived.dEps.toExponential(3),
            (derived.sigmaTrial * 1e-4).toFixed(3),
            derived.step.r.toFixed(3),
            (derived.step.sigma * 1e-4).toFixed(3),
            derived.step.state.yielded ? 'igen' : 'nem',
          ]),
          hingeRows: ctx.hinges.map((h, i) => [
            String(i + 1),
            h.kind === 'first-yield' ? 'első megfolyás' : 'képlékeny csukló',
            h.elementId,
            h.xApprox !== null ? h.xApprox.toFixed(2) : '—',
            h.lambda.toFixed(3),
          ]),
        }
      : null;

  return {
    generatedAt: new Intl.DateTimeFormat('hu-HU', { dateStyle: 'long', timeStyle: 'short' }).format(new Date()),
    appVersion: __APP_VERSION__,
    gitCommit: __GIT_COMMIT__,
    presetName: preset.name,
    presetRef: preset.ref,

    span: model.span,
    elementCount: model.elementCount,
    integrationLabel: model.integration === 'selective' ? 'szelektív redukált' : 'teljes',
    sectionName: section.name,
    sectionSource: section.source,
    materialName: material.name,
    materialSummary: `E=${(material.e).toFixed(0)} kN/cm², σY=${material.sigmaY > 0 ? material.sigmaY.toFixed(2) : '—'} kN/cm²`,
    materialSource: material.source,
    supportRows: model.supports.map((s) => [
      s.id,
      s.x.toFixed(2),
      s.type === 'fixed' ? 'befogás' : s.type === 'pinned' ? 'csuklós' : s.type === 'roller' ? 'görgős' : 'rugós',
    ]),
    loadRows: model.loads.map((l) => [
      l.id,
      l.kind === 'point'
        ? `P = ${l.p.toFixed(1)} kN, x = ${l.x.toFixed(2)} m`
        : l.kind === 'moment'
          ? `M = ${l.m.toFixed(1)} kNm, x = ${l.x.toFixed(2)} m`
          : l.kind === 'distributed'
            ? l.q1 === l.q2
              ? `q = ${l.q1.toFixed(1)} kN/m, ${l.x1.toFixed(2)}–${l.x2.toFixed(2)} m`
              : `q = ${l.q1.toFixed(1)}→${l.q2.toFixed(1)} kN/m, ${l.x1.toFixed(2)}–${l.x2.toFixed(2)} m`
            : l.m1 === l.m2
              ? `m = ${l.m1.toFixed(1)} kNm/m, ${l.x1.toFixed(2)}–${l.x2.toFixed(2)} m`
              : `m = ${l.m1.toFixed(1)}→${l.m2.toFixed(1)} kNm/m, ${l.x1.toFixed(2)}–${l.x2.toFixed(2)} m`,
    ]),

    layerRows: layers.map((l, i) => [
      String(i + 1),
      (l.b * 1e3).toFixed(2),
      (l.t * 1e3).toFixed(2),
      (l.z * 1e3).toFixed(2),
    ]),
    layerSumFormula: layerSumTex(layerA * 1e4, layerI * 1e8),
    me: fixed(linear.props.me, 2),
    mp: fixed(linear.props.mp, 2),
    shapeFactor: fixed(linear.props.shapeFactor, 3),
    meMpFormula:
      linear.props.me !== null && linear.props.mp !== null
        ? meMpTex(
            material.sigmaY,
            linear.props.elasticModulus * 1e6,
            linear.props.plasticModulus * 1e6,
            linear.props.me,
            linear.props.mp,
            linear.props.shapeFactor,
          )
        : null,
    meMpNote: `Az anyagnak (${material.name}) nincs megadott folyáshatára (σY) — Mₑ és Mₚ NEM értelmezhető. A c = Wₚ/Wₑ alaki tényező σY-tól függetlenül érvényes: c = ${fixed(linear.props.shapeFactor, 3)}.`,

    elementLength: elementDerivation.length,
    nodeCount: linear.nodes.length,
    dofCount: linear.dofCount,

    elementId: elementDerivation.elementId,
    elementNodeX: [
      fixed(elementDerivation.nodeX[0], 3),
      fixed(elementDerivation.nodeX[1], 3),
      fixed(elementDerivation.nodeX[2], 3),
    ],
    jacobianFormula: jacobianTex(
      elementDerivation.bendingPoints[0]?.dn ?? [0, 0, 0],
      elementDerivation.nodeX,
      elementDerivation.bendingPoints[0]?.jacobian.j ?? 0,
      elementDerivation.bendingPoints[0]?.jacobian.invJ ?? 0,
    ),
    bendingRows: elementDerivation.bendingPoints.map((gp) => [
      fixed(gp.xi),
      fixed(gp.w),
      fixed(gp.n[0]),
      fixed(gp.n[1]),
      fixed(gp.n[2]),
      fixed(gp.dn[0]),
      fixed(gp.dn[1]),
      fixed(gp.dn[2]),
    ]),
    shearRows: elementDerivation.shearPoints.map((gp) => [fixed(gp.xi), fixed(gp.w), fixed(gp.n[0]), fixed(gp.n[1]), fixed(gp.n[2])]),
    bendingFormulas: elementDerivation.bendingPoints.flatMap((gp, i) => bendingGaussTex(gp, i, elementDerivation.stiffness.ei)),
    shearFormulas: elementDerivation.shearPoints.flatMap((gp, i) => shearGaussTex(gp, i, elementDerivation.stiffness.gas)),
    keDiagonalFormula: keDiagonalTex(
      elementDerivation.bendingPoints,
      elementDerivation.shearPoints,
      elementDerivation.stiffness.ei,
      elementDerivation.stiffness.gas,
      elementDerivation.ke.get(1, 1),
    ),
    ei: fixed(elementDerivation.stiffness.ei, 1),
    gas: fixed(elementDerivation.stiffness.gas, 1),
    keRows: Array.from({ length: 6 }, (_, i) =>
      Array.from({ length: 6 }, (_, j) => elementDerivation.ke.get(i, j).toExponential(3)).join('  '),
    ),
    loadFormulas: buildLoadFormulas(ctx.loadDerivation, elementDerivation.stiffness.ei),
    loadVectorRow: `[${Array.from(elementDerivation.loadVector).map((v) => v.toExponential(3)).join(', ')}]`,

    massPerLength: fixed(ctx.massDerivation.mass.massPerLength, 4),
    rotaryInertiaPerLength: ctx.massDerivation.mass.rotaryInertiaPerLength.toExponential(4),
    massRows: ctx.massDerivation.points.map((gp) => [
      fixed(gp.xi),
      fixed(gp.w),
      fixed(gp.n[0]),
      fixed(gp.n[1]),
      fixed(gp.n[2]),
    ]),
    massFormulas: ctx.massDerivation.points.flatMap((gp, i) =>
      massGaussTex(gp, i, ctx.massDerivation.mass.massPerLength, ctx.massDerivation.mass.rotaryInertiaPerLength),
    ),
    massDiagonalFormula: massDiagonalTex(
      ctx.massDerivation.points,
      ctx.massDerivation.mass.massPerLength,
      ctx.massDerivation.mass.rotaryInertiaPerLength,
      ctx.massDerivation.me.get(0, 0),
      ctx.massDerivation.me.get(1, 1),
    ),
    meRows: Array.from({ length: 6 }, (_, i) =>
      Array.from({ length: 6 }, (_, j) => ctx.massDerivation.me.get(i, j).toExponential(3)).join('  '),
    ),

    assemblyRows:
      ctx.globalNodeIdx !== undefined
        ? (['w₁', 'φ₁', 'w₂', 'φ₂', 'w₃', 'φ₃'] as const).map((label, i) => {
            const nodeIdx = (ctx.globalNodeIdx as readonly [number, number, number])[Math.floor(i / 2)] ?? 0;
            return [String(i), String(nodeIdx), label, String(2 * nodeIdx + (i % 2))];
          })
        : [],
    assemblyNote:
      ctx.globalNodeIdx !== undefined
        ? `K_global[I,J] += Kₑ[i,j] minden (i,j) lokális párra. Példa: Kₑ[φ₁,φ₁] = ${elementDerivation.ke.get(1, 1).toExponential(3)} → K_global[${2 * ctx.globalNodeIdx[0] + 1}, ${2 * ctx.globalNodeIdx[0] + 1}] (HOZZÁADVA, nem felülírva).`
        : '',
    boundaryRows: ctx.boundaryRows,
    boundaryNote:
      linear.strategy === 'elimination'
        ? `Eliminációs stratégia: az előírt DOF-ok kimaradnak a megoldandó rendszerből — a teljes ${linear.dofCount} DOF-ból ${linear.activeDofCount} marad aktív.`
        : 'Penalty stratégia: az előírt DOF-ok nagy merevségű "rugóval" kényszerítve maradnak a rendszerben.',
    ueRow:
      ctx.internalForceDerivation !== undefined
        ? `uₑ = [${Array.from(ctx.internalForceDerivation.ue).map((v) => v.toExponential(3)).join(', ')}]`
        : '',
    internalForceFormulas:
      ctx.internalForceDerivation !== undefined
        ? ctx.internalForceDerivation.points.flatMap((gp, i) =>
            internalForceTex(
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
              (ctx.internalForceDerivation as ElementInternalForceDerivation).kappa0,
            ),
          )
        : [],

    meanBandwidth: fixed(linear.meanBandwidth, 2),
    strategyLabel: linear.strategy === 'elimination' ? 'eliminációs (kizárt DOF)' : 'penalty',
    activeDofCount: linear.activeDofCount,

    resultGaussRows:
      elementResult?.gaussPoints.map((gp, i) => [String(i + 1), fixed(gp.x, 3), fixed(gp.m, 2), fixed(gp.t, 2)]) ?? [],
    extrapolationFormulas: (() => {
      const gp0 = elementResult?.gaussPoints[0];
      const gp1 = elementResult?.gaussPoints[1];
      const gp2 = elementResult?.gaussPoints[2];
      const xi0 = elementDerivation.bendingPoints[0]?.xi;
      const xi1 = elementDerivation.bendingPoints[1]?.xi;
      const xi2 = elementDerivation.bendingPoints[2]?.xi;
      if (gp0 === undefined || gp1 === undefined || gp2 === undefined || xi0 === undefined || xi1 === undefined || xi2 === undefined) {
        return [];
      }
      const xis: readonly [number, number, number] = [xi0, xi1, xi2];
      const mValues: readonly [number, number, number] = [gp0.m, gp1.m, gp2.m];
      return [
        ...extrapolationTex('M', mValues, xis, -1, '\\xi{=}{-}1\\ (\\text{bal csp.})', '\\text{kNm}'),
        ...extrapolationTex('M', mValues, xis, 1, '\\xi{=}{+}1\\ (\\text{jobb csp.})', '\\text{kNm}'),
      ];
    })(),
    sumFz: fixed(linear.equilibrium.sumFz, 4),
    sumMy: fixed(linear.equilibrium.sumMy, 4),

    plastic,
  };
}
