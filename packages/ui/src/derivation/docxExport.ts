/**
 * Levezetés — .docx export (MASTER-PROMPT-TERV P15/A prompt).
 *
 * Valódi OOXML a `docx` npm könyvtárral. A KÉPLETEK 2026-09-04 óta VALÓDI
 * Word-képletobjektumok (`<m:oMath>`, `formulaOmml.ts` — a `formulaLatex.ts`
 * ugyanazon LaTeX-sorait alakítja OOXML-lé, amiket a `DerivationView.tsx`
 * KaTeX-hez használ), NEM sima szöveg — ez a felhasználó kifejezett
 * kérésére FELÜLBÍRÁLJA a korábbi ADR-0005 "monospace Unicode-szöveg"
 * döntését. A `mono()` segédfüggvény ezután csak a ténylegesen egyszerű
 * (nem behelyettesítéses) érték-felsorolásokhoz marad (pl. mátrix-sorok,
 * összegzés-vektorok) — ott nincs mit "képletesíteni".
 */
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import type { DerivationExportData, FormulaLine } from './derivationExportData.js';
import { mathParagraph, mathParagraphs } from './formulaOmml.js';
import type { Lang } from '../state/appStore.js';
import { DERIVATION } from '../i18n/derivation.js';
import { REPORT } from '../i18n/report.js';

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } });
}

/** Többsoros (monospace) szöveg — minden `\n` külön sortörés, NEM külön bekezdés (egyben marad). */
function mono(text: string): Paragraph {
  const lines = text.split('\n');
  const children: TextRun[] = [];
  lines.forEach((line, i) => {
    if (i > 0) children.push(new TextRun({ text: '', break: 1 }));
    children.push(new TextRun({ text: line, font: 'Courier New', size: 20 }));
  });
  return new Paragraph({ children, spacing: { after: 120 } });
}

function para(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text)], spacing: { after: 120 } });
}

function cell(text: string, opts: { readonly header?: boolean } = {}): TableCell {
  const header = opts.header === true;
  const run = header ? new TextRun({ text, bold: true }) : new TextRun({ text, font: 'Courier New' });
  return new TableCell({
    width: { size: 100, type: WidthType.AUTO },
    children: [new Paragraph({ children: [run] })],
  });
}

/** Egy `FormulaLine`-lista (feliratok és LaTeX-képletsorok vegyesen) → bekezdés-lista. */
function formulaLineParagraphs(lines: readonly FormulaLine[]): Paragraph[] {
  return lines.map((l) => (l.kind === 'text' ? para(l.text) : mathParagraph(l.latex)));
}

function table(headerRow: readonly string[], rows: readonly (readonly string[])[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headerRow.map((h) => cell(h, { header: true })) }),
      ...rows.map((r) => new TableRow({ children: r.map((v) => cell(v)) })),
    ],
  });
}

/** A teljes levezetés .docx dokumentummá építése a már kiszámított adatokból. `lang` alapértelmezése `'hu'` — visszamenőlegesen kompatibilis a nyelvet nem ismerő hívókkal/tesztekkel. */
export function buildDerivationDocx(data: DerivationExportData, lang: Lang = 'hu'): Promise<Blob> {
  const t = DERIVATION[lang];
  const r = REPORT[lang];
  const children: (Paragraph | Table)[] = [];
  const push = (...items: readonly (Paragraph | Table)[]): void => {
    children.push(...items);
  };

  // ── 0/1. Fejléc + Feladat ──────────────────────────────────────────────
  push(
    new Paragraph({ text: t.title, heading: HeadingLevel.TITLE }),
    para(
      `${data.presetName} (ref. ${data.presetRef}) · ${data.generatedAt} · v${data.appVersion} · ${lang === 'en' ? 'core' : 'mag'}: ${data.gitCommit}`,
    ),
    heading(t.section1Title, HeadingLevel.HEADING_1),
    table(
      [t.propertyHeader, t.valueGenericHeader],
      [
        [t.spanLabel, `${data.span.toFixed(2)} m`],
        [t.elementCountLabel, String(data.elementCount)],
        [t.integrationLabel, data.integrationLabel],
        [t.sectionLabel, `${data.sectionName} (${data.sectionSource})`],
        [t.materialLabel, `${data.materialName}, ${data.materialSummary} (${data.materialSource})`],
      ],
    ),
    para(' '),
    table([t.supportHeader, t.xHeader, t.typeHeader], data.supportRows),
    para(' '),
    table([t.loadHeader, t.valueHeader], data.loadRows),
  );

  // ── 2. Keresztmetszet ───────────────────────────────────────────────────
  push(
    heading(t.section2Title, HeadingLevel.HEADING_1),
    para(t.layeredIntro(data.layerRows.length)),
    table(['l', 'b_l [mm]', 't_l [mm]', 'z_l [mm]'], data.layerRows),
    ...mathParagraphs(data.layerSumFormula),
    ...(data.meMpFormula !== null ? mathParagraphs(data.meMpFormula) : [para(data.meMpNote)]),
  );

  // ── 3. Végeselem-felosztás ───────────────────────────────────────────────
  push(
    heading(t.section3Title, HeadingLevel.HEADING_1),
    table(
      [t.propertyHeader, t.valueGenericHeader],
      [
        [t.elementCountLabel, String(data.elementCount)],
        [t.elementLengthLabel, `${data.elementLength.toFixed(4)} m`],
        [t.nodeCountLabel, String(data.nodeCount)],
        [t.dofLabel, String(data.dofCount)],
      ],
    ),
  );

  // ── 4. Egy választott elem teljes levezetése ────────────────────────────
  push(
    heading(t.section4Title(data.elementId), HeadingLevel.HEADING_1),
    mono(`x₁=${data.elementNodeX[0]}, x₂=${data.elementNodeX[1]}, x₃=${data.elementNodeX[2]} m, L_e=${data.elementLength.toFixed(3)} m`),
    heading(t.section4_1Title, HeadingLevel.HEADING_2),
    ...mathParagraphs(data.jacobianFormula),
    heading(t.section4_2Title, HeadingLevel.HEADING_2),
    table(['ξ', 'w', 'N₁', 'N₂', 'N₃', 'dN₁/dξ', 'dN₂/dξ', 'dN₃/dξ'], data.bendingRows),
    ...mathParagraphs(data.bendingFormulas),
    heading(t.section4_3Title(data.shearRows.length), HeadingLevel.HEADING_2),
    table(['ξ', 'w', 'N₁', 'N₂', 'N₃'], data.shearRows),
    ...mathParagraphs(data.shearFormulas),
    heading(t.section4_4Title, HeadingLevel.HEADING_2),
    mono(`EI = ${data.ei} kNm²   GAs = ${data.gas} kN`),
    heading(t.section4_5Title, HeadingLevel.HEADING_2),
    ...mathParagraphs(data.keDiagonalFormula),
    heading(t.section4_6Title, HeadingLevel.HEADING_2),
    ...data.keRows.map((row) => mono(row)),
    heading(t.section4_7Title, HeadingLevel.HEADING_2),
    ...formulaLineParagraphs(data.loadFormulas),
    mono(`${t.summationHeading}: q_e = ${data.loadVectorRow}`),
  );

  // ── 4A. A választott elem tömegmátrix-levezetése (ADR-0016) ────────────
  push(
    heading(t.section4ATitle(data.elementId), HeadingLevel.HEADING_1),
    para(t.section4AIntro),
    mono(`m' = γ·A/g = ${data.massPerLength} kN·s²/m²\nm'ᵩ = γ·I/g = ${data.rotaryInertiaPerLength} kN·s²`),
    heading(t.section4A_1Title, HeadingLevel.HEADING_2),
    table(['ξ', 'w', 'N₁', 'N₂', 'N₃'], data.massRows),
    ...mathParagraphs(data.massFormulas),
    heading(t.section4A_2Title, HeadingLevel.HEADING_2),
    ...mathParagraphs(data.massDiagonalFormula),
    heading(t.section4A_3Title, HeadingLevel.HEADING_2),
    ...data.meRows.map((row) => mono(row)),
  );

  // ── 5. Kompilálás és megoldás ─────────────────────────────────────────
  push(
    heading(t.section5Title, HeadingLevel.HEADING_1),
    heading(t.section5_1Title(data.elementId), HeadingLevel.HEADING_2),
    table([t.localDofHeader, t.nodeShortHeader, t.roleHeader, t.globalDofHeader], data.assemblyRows),
    ...(data.assemblyNote !== '' ? [mono(data.assemblyNote)] : []),
    heading(t.section5_2Title, HeadingLevel.HEADING_2),
    table([t.nodeShortHeader, t.xHeader, t.prescriptionHeader], data.boundaryRows),
    mono(data.boundaryNote),
    heading(t.section5_3Title, HeadingLevel.HEADING_2),
    table(
      [t.propertyHeader, t.valueGenericHeader],
      [
        [t.globalMatrixSizeLabel, t.globalMatrixSizeValue(data.dofCount, data.activeDofCount)],
        [t.bandwidthLabel, data.meanBandwidth],
        [t.solverMethodLabel, t.solverMethodValue],
      ],
    ),
    ...(data.ueRow !== '' ? [mono(data.ueRow)] : []),
  );

  // ── 6. Eredmények és ellenőrzések ────────────────────────────────────────
  push(
    heading(t.section6Title, HeadingLevel.HEADING_1),
    heading(t.section6_1Title, HeadingLevel.HEADING_2),
    ...mathParagraphs(data.internalForceFormulas),
    heading(t.section6_2Title(data.elementId), HeadingLevel.HEADING_2),
    table([t.gaussPointHeader, t.xHeader, t.momentHeader, t.shearHeader], data.resultGaussRows),
    heading(t.section6_3Title, HeadingLevel.HEADING_2),
    ...mathParagraphs(data.extrapolationFormulas),
    table(
      [t.propertyHeader, t.valueGenericHeader],
      [
        [t.sumFzLabel, `${data.sumFz} kN`],
        [t.sumMyLabel, `${data.sumMy} kNm`],
      ],
    ),
  );

  // ── 7. Képlékeny számítás ────────────────────────────────────────────────
  if (data.plastic !== null) {
    push(
      heading(t.section7Title, HeadingLevel.HEADING_1),
      table([t.stepHeader, t.lambdaHeader, t.iterationsHeader, t.psiNormHeader, t.fNormHeader, t.finalResidualHeader], data.plastic.stepRows),
      heading(t.convergenceFormulaTitle, HeadingLevel.HEADING_2),
      ...(data.plastic.convergenceFormula !== null ? mathParagraphs(data.plastic.convergenceFormula) : []),
      heading(data.plastic.sampleTitle, HeadingLevel.HEADING_2),
      ...(data.plastic.sampleFormula !== null ? mathParagraphs(data.plastic.sampleFormula) : []),
      table(
        [t.layerHeader, t.zHeader, t.prevStressHeader, t.dEpsHeader, t.trialStressHeader, t.rHeader, t.newStressHeader, t.yieldedHeader],
        data.plastic.layerRows,
      ),
      heading(t.hingeSequenceTitle, HeadingLevel.HEADING_2),
      table([t.hingeIndexHeader, t.hingeEventHeader, t.hingeElementHeader, t.hingeXHeader, 'λ'], data.plastic.hingeRows),
    );
  }

  push(para(r.footerNote));

  const doc = new Document({
    sections: [{ children }],
    styles: { default: { document: { run: { size: 20 } } } },
  });

  return Packer.toBlob(doc);
}
