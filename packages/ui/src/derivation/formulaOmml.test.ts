import { describe, expect, it } from 'vitest';
import { Document, Packer } from 'docx';
import JSZip from 'jszip';
import { mathParagraph, mathParagraphs } from './formulaOmml.js';

/** Egy Paragraph-listát .docx-szé csomagol, és visszaadja a word/document.xml tartalmát. */
async function documentXmlOf(paragraphs: readonly ReturnType<typeof mathParagraph>[]): Promise<string> {
  const doc = new Document({ sections: [{ children: [...paragraphs] }] });
  const buf = await Packer.toBuffer(doc);
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (xml === undefined) throw new Error('nincs word/document.xml a csomagban');
  return xml;
}

describe('formulaOmml — LaTeX → valódi OOXML Word-képlet', () => {
  it('egyszerű behelyettesítést (törtekkel, alsó/felső indexszel) valódi <m:oMath> objektummá alakít', async () => {
    const xml = await documentXmlOf([mathParagraph('N_1(\\xi) = \\tfrac{1}{2}\\xi(\\xi-1) = \\tfrac{1}{2}\\cdot 0.7746\\cdot(0.7746-1) = 0.6873')]);
    expect(xml).toContain('<m:oMath');
    expect(xml).toContain('<m:f>'); // MathFraction → OMML "fraction" elem
    expect(xml).toContain('N');
    expect(xml).toContain('0.6873');
  });

  it('felső indexet (J^{-1}) m:sSup-ként ad ki, nem sima "^{-1}" szövegként', async () => {
    const xml = await documentXmlOf([mathParagraph('J^{-1} = \\frac{1}{J} = \\frac{1}{2.66667} = 0.37500')]);
    expect(xml).toContain('<m:sSup');
    expect(xml).toContain('-1');
  });

  it('kombinált alsó+felső indexet (f_e^{(1)}) egyetlen m:sSubSup-ban ad ki', async () => {
    const xml = await documentXmlOf([mathParagraph('f_e^{(1)} = [0.1234,\\ -0.5678]')]);
    expect(xml).toContain('<m:sSubSup');
  });

  it('\\left(...\\right)-et zárójel-csoportként kezeli, a tartalom nem vész el', async () => {
    const xml = await documentXmlOf([
      mathParagraph(
        'K_e[\\varphi_1,\\varphi_1] = \\sum\\left(EI\\cdot|J|\\cdot w\\cdot B_\\kappa[1]^2\\right) + \\sum\\left(GA_s\\cdot|J|\\cdot w\\cdot B_\\gamma[1]^2\\right)',
      ),
    ]);
    expect(xml).toContain('EI');
    expect(xml).toContain('GA');
    // A görög/jel-szótár szimbólumai (Σ, κ, γ) ténylegesen bekerülnek.
    expect(xml).toContain('Σ');
    expect(xml).toContain('κ');
    expect(xml).toContain('γ');
  });

  it('\\text{...} tartalmát szó szerint (LaTeX-ként NEM értelmezve) illeszti be', async () => {
    const xml = await documentXmlOf([mathParagraph('\\text{Gauss-pont } B_{1}:\\ \\xi=-0.7746,\\ w=0.5556')]);
    expect(xml).toContain('Gauss-pont');
    expect(xml).toContain('ξ');
  });

  it('több sort (egy teljes Gauss-pont levezetést) egyenlő számú <m:oMath> bekezdésre bont', async () => {
    const lines = [
      '\\text{Gauss-pont } B_{1}:\\ \\xi=-0.7746,\\ w=0.5556',
      'N_1(\\xi) = \\tfrac{1}{2}\\xi(\\xi-1) = 0.6873',
      '\\frac{dN_1}{d\\xi} = \\xi-0.5 = -1.2746',
    ];
    const xml = await documentXmlOf(mathParagraphs(lines));
    const count = (xml.match(/<m:oMath[ >]/g) ?? []).length;
    expect(count).toBe(lines.length);
  });

  it('a végeredmény szám sosem vész el egyetlen valódi levezetés-sorból sem (regresszió: minden sorban szerepel az utolsó "= szám" jobb oldala)', async () => {
    const line = 'c = \\frac{M_p}{M_e} = \\frac{141.23}{123.96} = 1.139';
    const xml = await documentXmlOf([mathParagraph(line)]);
    expect(xml).toContain('1.139');
  });
});
