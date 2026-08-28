/**
 * A validációs esetek közös típusai.
 *
 * HIBATURESI-POLITIKA szerint minden eset egy vagy több ellenőrzést (`checks`)
 * tartalmaz — mindegyiknek van analitikus referenciája, számított értéke és
 * hibafajta szerinti tűrése (nem egyetlen mérnöki szám).
 */

/** Egyetlen numerikus összevetés a referenciaérték és a FE-eredmény között. */
export interface ValidationCheck {
  /** Emberi nyelvű leírás (pl. "w(L) [m]"). */
  readonly label: string;
  readonly reference: number;
  readonly computed: number;
  readonly tolerance: number;
  /**
   * 'relative': |computed-reference|/max(|reference|,1) <= tolerance.
   * 'absolute': |computed-reference| <= tolerance.
   * 'range': `computed` a [range.min, range.max] intervallumban van (pl. a
   * konvergencia-rend V-12-nél nem egyetlen szám, hanem elfogadható sáv).
   */
  readonly kind: 'relative' | 'absolute' | 'range';
  /** Csak 'range' esetén: az elfogadható intervallum. */
  readonly range?: { readonly min: number; readonly max: number };
}

export interface ValidationCase {
  /** A MASTER-PROMPT-TERV 3.1/3.2 táblázatának azonosítója (pl. "V-01"). */
  readonly id: string;
  readonly title: string;
  /** Analitikus referencia rövid leírása. */
  readonly description: string;
  /** Diplomaterv-hivatkozás. */
  readonly reference: string;
  readonly checks: readonly ValidationCheck[];
}

export function checkError(c: ValidationCheck): number {
  if (c.kind === 'range') {
    const { min, max } = c.range ?? { min: -Infinity, max: Infinity };
    if (c.computed < min) return min - c.computed;
    if (c.computed > max) return c.computed - max;
    return 0;
  }
  const diff = Math.abs(c.computed - c.reference);
  if (c.kind === 'absolute') return diff;
  const denom = Math.abs(c.reference) > 0 ? Math.abs(c.reference) : 1;
  return diff / denom;
}

export function checkPassed(c: ValidationCheck): boolean {
  return checkError(c) <= c.tolerance;
}

export function casePassed(vc: ValidationCase): boolean {
  return vc.checks.every(checkPassed);
}
