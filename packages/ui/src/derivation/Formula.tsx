/**
 * Egy sor LaTeX-képlet KaTeX-szel szedve — ez a komponens a HTML/nyomtatási
 * nézetet szolgálja. A `.docx` export (`formulaOmml.ts`) UGYANEZEKET a
 * LaTeX-sorokat (`formulaLatex.ts`) alakítja valódi OOXML Word-
 * képletobjektummá, nem KaTeX-et hív — a két kimenet így egy forrásból ered.
 *
 * A `tex` forrás mindig a mi saját, számokból generált kódunkból származik
 * (ld. `formulaLatex.ts`), sosem felhasználói bevitelből — de a biztonság
 * kedvéért `throwOnError:false` és `strict:'ignore'` mellett, defenzíven.
 */
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'react';

export interface FormulaProps {
  readonly tex: string;
  readonly display?: boolean;
}

export function Formula({ tex, display = true }: FormulaProps): JSX.Element {
  const html = useMemo(
    () =>
      katex.renderToString(tex, {
        throwOnError: false,
        strict: 'ignore',
        displayMode: display,
        output: 'html',
      }),
    [tex, display],
  );
  return <span className="vem-formula" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Egymás alatt megjelenő képletsorok (egy "levezetési blokk"). */
export function FormulaBlock({ lines, label }: { readonly lines: readonly string[]; readonly label?: string }): JSX.Element {
  return (
    <div className="vem-derivation__formula vem-derivation__formula--tex">
      {label !== undefined ? <div className="vem-derivation__formula-label">{label}</div> : null}
      {lines.map((tex, i) => (
        <Formula key={i} tex={tex} />
      ))}
    </div>
  );
}
