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
import type { Lang } from '../state/appStore.js';
import { SUPPORT_TYPE_LABEL } from '../i18n/panels.js';
import { REPORT, formatReportDateTime } from '../i18n/report.js';
import { DERIVATION, type DerivationStrings } from '../i18n/derivation.js';
import { presetDisplayName } from '../i18n/catalog.js';
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

function distributedLoadLabel(kind: 'distributed-force' | 'distributed-moment' | 'self-weight', t: DerivationStrings): string {
  return kind === 'distributed-force' ? t.distributedForceLabel : kind === 'distributed-moment' ? t.distributedMomentLabel : t.selfWeightLabel;
}

/** Egy képlet-mező sora: sima felirat VAGY egy LaTeX-sor (→ valódi Word-képlet, ld. `formulaOmml.ts`). */
export type FormulaLine = { readonly kind: 'text'; readonly text: string } | { readonly kind: 'math'; readonly latex: string };

const text = (t: string): FormulaLine => ({ kind: 'text', text: t });
const mathLines = (lines: readonly string[]): readonly FormulaLine[] => lines.map((latex) => ({ kind: 'math', latex }) as const);

/** A 4.7 pont terhenkénti, TELJES levezetése — feliratok és LaTeX-képletsorok vegyesen. */
function buildLoadFormulas(loadDerivation: ElementLoadDerivation | undefined, ei: number, lang: Lang): readonly FormulaLine[] {
  if (loadDerivation === undefined) return [];
  const t = DERIVATION[lang];
  const lines: FormulaLine[] = [];
  if (loadDerivation.distributed.length === 0 && loadDerivation.nodal.length === 0 && loadDerivation.thermal === null) {
    lines.push(text(t.noDirectLoad));
  }
  for (const contribution of loadDerivation.distributed) {
    const unit = contribution.dofOffset === 0 ? '\\text{kN/m}' : '\\text{kNm/m}';
    lines.push(
      text(`${t.distributedLoadHeading(distributedLoadLabel(contribution.kind, t), contribution.loadId, contribution.points.length)}:`),
      ...contribution.points.flatMap((gp, i) => mathLines(distributedLoadGaussTex(gp, i, unit, lang))),
    );
  }
  for (const contribution of loadDerivation.nodal) {
    const unit = contribution.dofOffset === 0 ? '\\text{kN}' : '\\text{kNm}';
    lines.push(
      text(`${contribution.kind === 'nodal-force' ? t.nodalForceHeading(contribution.loadId) : t.nodalMomentHeading(contribution.loadId)}:`),
      ...mathLines(nodalLoadTex(contribution.localNode, contribution.dofOffset, contribution.value, unit, lang)),
    );
  }
  if (loadDerivation.thermal !== null) {
    const thermal = loadDerivation.thermal;
    lines.push(
      text(`${t.thermalLoadHeading}. ${t.thermalKappa0Note(thermal.kappa0.toExponential(3))}`),
      ...thermal.points.flatMap((gp, i) => mathLines(thermalLoadGaussTex(gp, i, ei, thermal.kappa0, lang))),
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
  /** Alapértelmezése `'hu'` — visszamenőlegesen kompatibilis a nyelvet nem ismerő hívókkal/tesztekkel. */
  readonly lang?: Lang;
}

export function buildDerivationExportData(ctx: DerivationExportContext): DerivationExportData {
  const { model, preset, section, material, linear, layers, layerA, layerI, elementDerivation, elementResult } = ctx;
  const lang: Lang = ctx.lang ?? 'hu';
  const t = DERIVATION[lang];

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
              lang,
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
                  lang,
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
            derived.step.state.yielded ? t.yesWord : t.noWord,
          ]),
          hingeRows: ctx.hinges.map((h, i) => [
            String(i + 1),
            REPORT[lang].hingeKindLabel[h.kind],
            h.elementId,
            h.xApprox !== null ? h.xApprox.toFixed(2) : '—',
            h.lambda.toFixed(3),
          ]),
        }
      : null;

  return {
    generatedAt: formatReportDateTime(new Date(), lang),
    appVersion: __APP_VERSION__,
    gitCommit: __GIT_COMMIT__,
    presetName: presetDisplayName(preset.id, lang),
    presetRef: preset.ref,

    span: model.span,
    elementCount: model.elementCount,
    integrationLabel: model.integration === 'selective' ? t.integrationSelective : t.integrationFull,
    sectionName: section.name,
    sectionSource: section.source,
    materialName: material.name,
    materialSummary: `E=${(material.e).toFixed(0)} kN/cm², σY=${material.sigmaY > 0 ? material.sigmaY.toFixed(2) : '—'} kN/cm²`,
    materialSource: material.source,
    supportRows: model.supports.map((s) => [s.id, s.x.toFixed(2), SUPPORT_TYPE_LABEL[lang][s.type]]),
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
    meMpNote: t.meMpNoteElastic(material.name, fixed(linear.props.shapeFactor, 3)),

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
    bendingFormulas: elementDerivation.bendingPoints.flatMap((gp, i) => bendingGaussTex(gp, i, elementDerivation.stiffness.ei, lang)),
    shearFormulas: elementDerivation.shearPoints.flatMap((gp, i) => shearGaussTex(gp, i, elementDerivation.stiffness.gas, lang)),
    keDiagonalFormula: keDiagonalTex(
      elementDerivation.bendingPoints,
      elementDerivation.shearPoints,
      elementDerivation.stiffness.ei,
      elementDerivation.stiffness.gas,
      elementDerivation.ke.get(1, 1),
      lang,
    ),
    ei: fixed(elementDerivation.stiffness.ei, 1),
    gas: fixed(elementDerivation.stiffness.gas, 1),
    keRows: Array.from({ length: 6 }, (_, i) =>
      Array.from({ length: 6 }, (_, j) => elementDerivation.ke.get(i, j).toExponential(3)).join('  '),
    ),
    loadFormulas: buildLoadFormulas(ctx.loadDerivation, elementDerivation.stiffness.ei, lang),
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
      massGaussTex(gp, i, ctx.massDerivation.mass.massPerLength, ctx.massDerivation.mass.rotaryInertiaPerLength, lang),
    ),
    massDiagonalFormula: massDiagonalTex(
      ctx.massDerivation.points,
      ctx.massDerivation.mass.massPerLength,
      ctx.massDerivation.mass.rotaryInertiaPerLength,
      ctx.massDerivation.me.get(0, 0),
      ctx.massDerivation.me.get(1, 1),
      lang,
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
        ? t.assemblyNote(
            elementDerivation.ke.get(1, 1).toExponential(3),
            `${2 * ctx.globalNodeIdx[0] + 1}, ${2 * ctx.globalNodeIdx[0] + 1}`,
          )
        : '',
    boundaryRows: ctx.boundaryRows,
    boundaryNote: linear.strategy === 'elimination' ? t.eliminationNote(linear.dofCount, linear.activeDofCount) : t.penaltyNote,
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
              lang,
            ),
          )
        : [],

    meanBandwidth: fixed(linear.meanBandwidth, 2),
    strategyLabel: linear.strategy === 'elimination' ? t.strategyLabelElimination : t.strategyLabelPenalty,
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
        ...extrapolationTex('M', mValues, xis, -1, `\\xi{=}{-}1\\ (\\text{${t.extrapLeftNode}})`, '\\text{kNm}'),
        ...extrapolationTex('M', mValues, xis, 1, `\\xi{=}{+}1\\ (\\text{${t.extrapRightNode}})`, '\\text{kNm}'),
      ];
    })(),
    sumFz: fixed(linear.equilibrium.sumFz, 4),
    sumMy: fixed(linear.equilibrium.sumMy, 4),

    plastic,
  };
}
