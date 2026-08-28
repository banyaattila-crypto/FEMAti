/**
 * Lineáris interpoláció egy (x, y) ponthalmazon — a diagramok hoverjéhez és
 * az összehangolt metszet-olvasáshoz (MASTER-PROMPT-TERV P8 prompt: „egy
 * helyen mozgatva az egeret mind a négy ábrán megjelenik a metszet értéke").
 *
 * A pontok CSOMÓPONTI (extrapolált, átlagolt) értékek — a mag maga
 * biztosítja, hogy ezek `x` szerint rendezettek (Diplomaterv 3.1.7.4).
 */
export function interpolateAt(xs: readonly number[], ys: readonly number[], x: number): number | null {
  if (xs.length === 0) return null;
  if (xs.length === 1) return ys[0] ?? null;

  const first = xs[0];
  const last = xs[xs.length - 1];
  if (first === undefined || last === undefined) return null;
  const clamped = Math.min(Math.max(x, first), last);

  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i];
    const x1 = xs[i + 1];
    if (x0 === undefined || x1 === undefined) continue;
    if (clamped >= x0 && clamped <= x1) {
      const y0 = ys[i] ?? 0;
      const y1 = ys[i + 1] ?? 0;
      const t = x1 !== x0 ? (clamped - x0) / (x1 - x0) : 0;
      return y0 + (y1 - y0) * t;
    }
  }
  return ys[ys.length - 1] ?? null;
}

export interface Extreme {
  readonly value: number;
  readonly x: number;
}

/** A legnagyobb abszolút értékű pont — a diagramfeliratokhoz. */
export function findExtreme(xs: readonly number[], ys: readonly number[]): Extreme | null {
  if (xs.length === 0) return null;
  let best: Extreme = { value: ys[0] ?? 0, x: xs[0] ?? 0 };
  for (let i = 1; i < xs.length; i++) {
    const y = ys[i] ?? 0;
    if (Math.abs(y) > Math.abs(best.value)) best = { value: y, x: xs[i] ?? 0 };
  }
  return best;
}
