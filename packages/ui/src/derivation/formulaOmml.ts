/**
 * LaTeX (a `formulaLatex.ts` sorai) → valódi Word-képletobjektum (OOXML
 * `<m:oMath>`, a `docx` könyvtár `Math`/`MathRun`/`MathFraction`/…
 * osztályaival) — a felhasználó kifejezett kérésére (2026-09-04): a `.docx`
 * export korábban (ADR-0005) SZÁNDÉKOSAN sima, monospace Unicode-szöveget
 * használt a képletekhez, hogy a dokumentum szerkeszthető/kereshető
 * maradjon — ez a döntés MOST felülbírálva: a felhasználó valódi,
 * grafikusan szedett Word-képleteket kért.
 *
 * NEM egy általános LaTeX-értelmező — csak azt a SZŰK, ismert szintaxis-
 * részhalmazt tudja, amit a `formulaLatex.ts` ténylegesen termel (lásd az
 * ottani fejléc-kommentet és a `SYMBOLS` táblázatot lent): `\frac`/`\tfrac`,
 * `_`/`^` alsó/felső index (egyetlen karakter vagy `{...}` csoport),
 * `\left(`/`\right)`, `\text{...}`, és egy rögzített görög/jel-szótár. Ha a
 * jövőben a `formulaLatex.ts` új LaTeX-konstrukciót kezd használni, ide is
 * bővíteni kell — ez SZÁNDÉKOS, nem hiányosság: egy teljes LaTeX-motor
 * (vagy KaTeX→MathML→OMML XSLT-lánc) sokszorosan nagyobb, törékenyebb
 * függőség lenne a ténylegesen előforduló ~20 konstrukcióhoz képest.
 */
import { Math as OMath, MathFraction, MathRoundBrackets, MathRun, MathSubScript, MathSubSuperScript, MathSuperScript, Paragraph } from 'docx';
import type { MathComponent } from 'docx';

type MNode =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'frac'; readonly num: readonly MNode[]; readonly den: readonly MNode[] }
  | { readonly kind: 'sub'; readonly base: MNode; readonly sub: readonly MNode[] }
  | { readonly kind: 'sup'; readonly base: MNode; readonly sup: readonly MNode[] }
  | { readonly kind: 'subsup'; readonly base: MNode; readonly sub: readonly MNode[]; readonly sup: readonly MNode[] }
  | { readonly kind: 'paren'; readonly inner: readonly MNode[] };

/** `\parancs` → szimbólum — csak a ténylegesen előforduló készlet (ld. fenti fejléc). */
const SYMBOLS: Record<string, string> = {
  xi: 'ξ',
  kappa: 'κ',
  gamma: 'γ',
  varphi: 'φ',
  sigma: 'σ',
  varepsilon: 'ε',
  lambda: 'λ',
  psi: 'ψ',
  Delta: 'Δ',
  pm: '±',
  cdot: '·',
  sum: 'Σ',
  Rightarrow: '⇒',
  le: '≤',
  lVert: '‖',
  rVert: '‖',
  quad: '  ',
};

class LatexParser {
  private i = 0;
  public constructor(private readonly src: string) {}

  private peek(): string {
    return this.src[this.i] ?? '';
  }

  private startsWith(s: string): boolean {
    return this.src.startsWith(s, this.i);
  }

  /** Egy `\szó` alakú parancsnév beolvasása (a `\` UTÁN állva hívandó). */
  private readCommandName(): string {
    let name = '';
    while (/[A-Za-z]/.test(this.peek())) {
      name += this.peek();
      this.i++;
    }
    return name;
  }

  /** `{...}` csoport tartalmának feldolgozása — feltételezi, hogy a kurzor a `{`-n áll. */
  private parseGroup(): MNode[] {
    this.i++; // '{'
    const nodes = this.parseExpr(() => this.peek() === '}');
    if (this.peek() === '}') this.i++;
    return nodes;
  }

  /** Alsó/felső index argumentuma: `{...}` csoport, VAGY egyetlen atom (parancs vagy karakter). */
  private parseScriptArg(): MNode[] {
    if (this.peek() === '{') return this.parseGroup();
    if (this.peek() === '\\') {
      this.i++;
      return [this.parseCommand()];
    }
    const ch = this.peek();
    this.i++;
    return [{ kind: 'text', value: ch }];
  }

  /** Egy `\parancs` feldolgozása (a `\` UTÁN állva hívandó) — a névtől függően frac/text/szimbólum. */
  private parseCommand(): MNode {
    const name = this.readCommandName();
    if (name === 'frac' || name === 'tfrac') {
      const num = this.parseGroup();
      const den = this.parseGroup();
      return { kind: 'frac', num, den };
    }
    if (name === 'text') {
      const raw = this.parseRawGroupText();
      return { kind: 'text', value: raw };
    }
    if (name === 'left') {
      this.i++; // a záró/nyitó jel (mindig '(' a formulaLatex.ts-ben)
      const inner = this.parseExpr(() => this.startsWith('\\right'));
      if (this.startsWith('\\right')) {
        this.i += '\\right'.length;
        this.i++; // a párzáró jel
      }
      return { kind: 'paren', inner };
    }
    const symbol = SYMBOLS[name];
    return { kind: 'text', value: symbol ?? name };
  }

  /** `\text{...}` tartalma — NEM LaTeX-ként értelmezve, szó szerinti szöveg. */
  private parseRawGroupText(): string {
    if (this.peek() !== '{') return '';
    this.i++;
    let depth = 1;
    let text = '';
    while (this.i < this.src.length && depth > 0) {
      const ch = this.peek();
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          this.i++;
          break;
        }
      }
      text += ch;
      this.i++;
    }
    return text;
  }

  /** Egy összefüggő, "sima" (parancs/csoport-határ nélküli) karaktersorozat egyetlen szöveg-csomópontként. */
  private parsePlainRun(): MNode {
    let text = '';
    while (this.i < this.src.length && !'\\{}_^'.includes(this.peek())) {
      text += this.peek();
      this.i++;
    }
    return { kind: 'text', value: text };
  }

  /** Egy atom (parancs/csoport/sima szöveg-futam) + az esetleges alsó/felső index rákötése. */
  private parseAtomWithScripts(): MNode {
    let base: MNode;
    if (this.peek() === '\\') {
      this.i++;
      base = this.parseCommand();
    } else if (this.peek() === '{') {
      const nodes = this.parseGroup();
      base = nodes.length === 1 ? (nodes[0] as MNode) : { kind: 'paren', inner: nodes };
    } else {
      base = this.parsePlainRun();
    }

    let sub: readonly MNode[] | null = null;
    let sup: readonly MNode[] | null = null;
    if (this.peek() === '_') {
      this.i++;
      sub = this.parseScriptArg();
    }
    if (this.peek() === '^') {
      this.i++;
      sup = this.parseScriptArg();
    }
    if (sub === null && this.peek() === '_') {
      this.i++;
      sub = this.parseScriptArg();
    }

    if (sub !== null && sup !== null) return { kind: 'subsup', base, sub, sup };
    if (sub !== null) return { kind: 'sub', base, sub };
    if (sup !== null) return { kind: 'sup', base, sup };
    return base;
  }

  private parseExpr(stop: () => boolean): MNode[] {
    const nodes: MNode[] = [];
    while (this.i < this.src.length && !stop()) {
      nodes.push(this.parseAtomWithScripts());
    }
    return nodes;
  }

  public parse(): MNode[] {
    return this.parseExpr(() => false);
  }
}

function toMathComponent(n: MNode): MathComponent {
  switch (n.kind) {
    case 'text':
      return new MathRun(n.value);
    case 'frac':
      return new MathFraction({ numerator: n.num.map(toMathComponent), denominator: n.den.map(toMathComponent) });
    case 'sub':
      return new MathSubScript({ children: [toMathComponent(n.base)], subScript: n.sub.map(toMathComponent) });
    case 'sup':
      return new MathSuperScript({ children: [toMathComponent(n.base)], superScript: n.sup.map(toMathComponent) });
    case 'subsup':
      return new MathSubSuperScript({
        children: [toMathComponent(n.base)],
        subScript: n.sub.map(toMathComponent),
        superScript: n.sup.map(toMathComponent),
      });
    case 'paren':
      return new MathRoundBrackets({ children: n.inner.map(toMathComponent) });
  }
}

/** Egy LaTeX-sor (a `formulaLatex.ts` kimenete) → valódi, szerkeszthető OOXML Word-képlet bekezdés. */
export function mathParagraph(latex: string): Paragraph {
  const nodes = new LatexParser(latex).parse();
  return new Paragraph({ children: [new OMath({ children: nodes.map(toMathComponent) })], spacing: { after: 60 } });
}

/** Egy teljes LaTeX-sor-tömb (pl. egy Gauss-pont teljes levezetése) → képlet-bekezdések listája. */
export function mathParagraphs(lines: readonly string[]): readonly Paragraph[] {
  return lines.map(mathParagraph);
}
