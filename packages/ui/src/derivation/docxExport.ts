/**
 * Levezetés — .docx export (MASTER-PROMPT-TERV P15/A prompt, ADR-0005).
 *
 * Valódi OOXML a `docx` npm könyvtárral — a képletek strukturált szövegként
 * (monospace, Unicode jelekkel) kerülnek be, NEM képként, hogy a dokumentum
 * Word-ben szerkeszthető és kereshető maradjon (ADR-0005 "Képletek
 * megjelenítése" pontja).
 */
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { DerivationExportData } from './derivationExportData.js';

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

function table(headerRow: readonly string[], rows: readonly (readonly string[])[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headerRow.map((h) => cell(h, { header: true })) }),
      ...rows.map((r) => new TableRow({ children: r.map((v) => cell(v)) })),
    ],
  });
}

/** A teljes levezetés .docx dokumentummá építése a már kiszámított adatokból. */
export function buildDerivationDocx(data: DerivationExportData): Promise<Blob> {
  const children: (Paragraph | Table)[] = [];
  const push = (...items: readonly (Paragraph | Table)[]): void => {
    children.push(...items);
  };

  // ── 0/1. Fejléc + Feladat ──────────────────────────────────────────────
  push(
    new Paragraph({ text: 'FEMAti — Levezetés', heading: HeadingLevel.TITLE }),
    para(`${data.presetName} (ref. ${data.presetRef}) · ${data.generatedAt} · v${data.appVersion} · mag: ${data.gitCommit}`),
    heading('1. Feladat', HeadingLevel.HEADING_1),
    table(
      ['Jellemző', 'Érték'],
      [
        ['Fesztáv L', `${data.span.toFixed(2)} m`],
        ['Elemszám', String(data.elementCount)],
        ['Integrálási séma', data.integrationLabel],
        ['Szelvény', `${data.sectionName} (${data.sectionSource})`],
        ['Anyag', `${data.materialName}, ${data.materialSummary} (${data.materialSource})`],
      ],
    ),
    para(' '),
    table(['Támasz', 'x [m]', 'Típus'], data.supportRows),
    para(' '),
    table(['Teher', 'Jellemző'], data.loadRows),
  );

  // ── 2. Keresztmetszet ───────────────────────────────────────────────────
  push(
    heading('2. Keresztmetszet', HeadingLevel.HEADING_1),
    para(`A rétegelt modell ${data.layerRows.length} rétegre osztja a keresztmetszetet (Diplomaterv 3.4.3, (3.54)).`),
    table(['l', 'b_l [mm]', 't_l [mm]', 'z_l [mm]'], data.layerRows),
    mono(`A = Σ b_l·t_l = ${data.layerASum}\nI = Σ b_l·z_l²·t_l = ${data.layerISum}`),
    mono(data.meMpFormula),
  );

  // ── 3. Végeselem-felosztás ───────────────────────────────────────────────
  push(
    heading('3. Végeselem-felosztás', HeadingLevel.HEADING_1),
    table(
      ['Jellemző', 'Érték'],
      [
        ['Elemszám', String(data.elementCount)],
        ['Elemhossz', `${data.elementLength.toFixed(4)} m`],
        ['Csomópontok száma', String(data.nodeCount)],
        ['Szabadságfokok', String(data.dofCount)],
      ],
    ),
  );

  // ── 4. Egy választott elem teljes levezetése ────────────────────────────
  push(
    heading(`4. A(z) ${data.elementId} elem teljes levezetése`, HeadingLevel.HEADING_1),
    mono(`x₁=${data.elementNodeX[0]}, x₂=${data.elementNodeX[1]}, x₃=${data.elementNodeX[2]} m, L_e=${data.elementLength.toFixed(3)} m`),
    heading('4.1 Jacobi', HeadingLevel.HEADING_2),
    mono(data.jacobianFormula),
    heading('4.2 Hajlítási Gauss-pontok — táblázat és teljes, behelyettesített levezetés', HeadingLevel.HEADING_2),
    table(['ξ', 'w', 'N₁', 'N₂', 'N₃', 'dN₁/dξ', 'dN₂/dξ', 'dN₃/dξ'], data.bendingRows),
    ...data.bendingFormulas.map((f) => mono(f)),
    heading('4.3 Nyírási Gauss-pontok — táblázat és teljes levezetés', HeadingLevel.HEADING_2),
    table(['ξ', 'w', 'N₁', 'N₂', 'N₃'], data.shearRows),
    ...data.shearFormulas.map((f) => mono(f)),
    heading('4.4 D anyagmátrix', HeadingLevel.HEADING_2),
    mono(`EI = ${data.ei} kNm²   GAs = ${data.gas} kN`),
    heading('4.5 Kₑ integrálás — konkrét példa egy mátrixelemre', HeadingLevel.HEADING_2),
    mono(data.keDiagonalFormula),
    heading('4.6 A 6×6 Kₑ mátrix', HeadingLevel.HEADING_2),
    ...data.keRows.map((row) => mono(row)),
    heading('4.7 Elemi tehervektor (λ=1) — terhenkénti, teljes levezetés', HeadingLevel.HEADING_2),
    ...data.loadFormulas.map((f) => mono(f)),
    mono(`Összegzés: q_e = ${data.loadVectorRow}`),
  );

  // ── 4A. A választott elem tömegmátrix-levezetése (ADR-0016) ────────────
  push(
    heading(`4A. A(z) ${data.elementId} elem tömegmátrix-levezetése (ADR-0016)`, HeadingLevel.HEADING_1),
    para(
      'A tömegmátrix mindkét tagja (transzlációs m\', forgási tehetetlenség m\'ᵩ) AZONOS, teljes (3 pontos ' +
        'Gauss) kvadratúrával integrálódik — nincs szelektív séma, ellentétben a merevségi mátrixszal. Csak ' +
        'VÉGEREDMÉNY: a sajátérték-megoldás (Jacobi-forgatás) nem kap lépésenkénti levezetést itt.',
    ),
    mono(`m' = γ·A/g = ${data.massPerLength} kN·s²/m²\nm'ᵩ = γ·I/g = ${data.rotaryInertiaPerLength} kN·s²`),
    heading('4A.1 Gauss-pontok — táblázat és teljes, behelyettesített levezetés', HeadingLevel.HEADING_2),
    table(['ξ', 'w', 'N₁', 'N₂', 'N₃'], data.massRows),
    ...data.massFormulas.map((f) => mono(f)),
    heading('4A.2 Mₑ integrálás — konkrét példa két mátrixelemre', HeadingLevel.HEADING_2),
    mono(data.massDiagonalFormula),
    heading('4A.3 A 6×6 Mₑ mátrix', HeadingLevel.HEADING_2),
    ...data.meRows.map((row) => mono(row)),
  );

  // ── 5. Kompilálás és megoldás ─────────────────────────────────────────
  push(
    heading('5. Kompilálás és megoldás', HeadingLevel.HEADING_1),
    heading('5.1 Összeszerelés', HeadingLevel.HEADING_2),
    table(['Lokális DOF', 'Csomópont', 'Szerep', 'Globális DOF'], data.assemblyRows),
    ...(data.assemblyNote !== '' ? [mono(data.assemblyNote)] : []),
    heading('5.2 Peremfeltétel-kezelés', HeadingLevel.HEADING_2),
    table(['Csomópont', 'x [m]', 'Előírás'], data.boundaryRows),
    mono(data.boundaryNote),
    heading('5.3 A megoldott rendszer és a kiválasztott elem elmozdulásai', HeadingLevel.HEADING_2),
    table(
      ['Jellemző', 'Érték'],
      [
        ['Globális mátrix mérete', `${data.dofCount} × ${data.dofCount} (aktív: ${data.activeDofCount})`],
        ['Profil (átlagos sávszélesség)', data.meanBandwidth],
        ['Megoldás módszere', 'K_active·d_active = f_active, Skyline LDLᵀ direkt megoldó (ADR-0002)'],
      ],
    ),
    ...(data.ueRow !== '' ? [mono(data.ueRow)] : []),
  );

  // ── 6. Eredmények és ellenőrzések ────────────────────────────────────────
  push(
    heading('6. Eredmények és ellenőrzések', HeadingLevel.HEADING_1),
    heading('6.1 Igénybevétel-visszaszámítás — κ = B_κ·uₑ, γ = B_γ·uₑ, M = EI·(κ−κ₀), T = GAs·γ', HeadingLevel.HEADING_2),
    ...data.internalForceFormulas.map((f) => mono(f)),
    heading('6.2 Gauss-ponti igénybevétel → csomóponti extrapoláció', HeadingLevel.HEADING_2),
    table(['Gauss-pont', 'x [m]', 'M [kNm]', 'T [kN]'], data.resultGaussRows),
    heading('6.3 A másodfokú (Lagrange-) extrapolációs képlet behelyettesítve', HeadingLevel.HEADING_2),
    ...data.extrapolationFormulas.map((f) => mono(f)),
    table(
      ['Jellemző', 'Érték'],
      [
        ['ΣFz', `${data.sumFz} kN`],
        ['ΣMy', `${data.sumMy} kNm`],
      ],
    ),
  );

  // ── 7. Képlékeny számítás ────────────────────────────────────────────────
  if (data.plastic !== null) {
    push(
      heading('7. Képlékeny számítás', HeadingLevel.HEADING_1),
      table(['#', 'λ', 'iterációk', '‖ψ‖', '‖f‖', 'végső reziduum [%]'], data.plastic.stepRows),
      heading('A konvergencia-képlet behelyettesítve (100·‖ψ‖/‖f‖ ≤ Tolerancia)', HeadingLevel.HEADING_2),
      ...(data.plastic.convergenceFormula !== null ? [mono(data.plastic.convergenceFormula)] : []),
      heading(data.plastic.sampleTitle, HeadingLevel.HEADING_2),
      ...(data.plastic.sampleFormula !== null ? [mono(data.plastic.sampleFormula)] : []),
      table(
        ['réteg', 'z [mm]', 'σ_{r-1}', 'Δε', 'σ_trial', 'R', 'σ_új', 'folyva?'],
        data.plastic.layerRows,
      ),
      heading('A képlékeny csuklók kialakulási sorrendje', HeadingLevel.HEADING_2),
      table(['#', 'esemény', 'elem', 'x ≈ [m]', 'λ'], data.plastic.hingeRows),
    );
  }

  push(para('A számítás eredményét szakmai felelősséggel ellenőrizni kell.'));

  const doc = new Document({
    sections: [{ children }],
    styles: { default: { document: { run: { size: 20 } } } },
  });

  return Packer.toBlob(doc);
}

/** A .docx letöltés kiváltása böngészőben. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
