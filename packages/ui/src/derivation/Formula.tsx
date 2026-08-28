/**
 * Egy sor LaTeX-képlet KaTeX-szel szedve (ADR-0005 "Képletek megjelenítése"
 * pontja: "A HTML/PDF nézetben KaTeX-szel szedett képlet is megengedett").
 *
 * A `.docx`-be VÁLTOZATLANUL a `formulaText.ts` szöveges (monospace, Unicode)
 * formája kerül — ez a komponens KIZÁRÓLAG a HTML/nyomtatási nézetet szolgálja.
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
