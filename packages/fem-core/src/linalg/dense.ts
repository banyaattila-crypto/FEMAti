/**
 * Sűrű vektor- és mátrixműveletek kis méretekre (elemi 6×6 mátrixok,
 * 2×6 B mátrix, 2×2 anyagmátrix).
 */

import { assertDim, assertIndex, DimensionError } from './errors.js';

// ─── Vektor ───────────────────────────────────────────────────────────────────

export const zeros = (n: number): Float64Array => new Float64Array(n);

export function dot(a: Float64Array, b: Float64Array): number {
  assertDim(b.length, a.length, 'dot');
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Euklideszi norma ‖v‖₂. */
export function norm2(v: Float64Array): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s);
}

/** y ← y + α·x */
export function axpy(alpha: number, x: Float64Array, y: Float64Array): Float64Array {
  assertDim(y.length, x.length, 'axpy');
  for (let i = 0; i < x.length; i++) y[i] += alpha * x[i];
  return y;
}

/** v ← α·v */
export function scale(alpha: number, v: Float64Array): Float64Array {
  for (let i = 0; i < v.length; i++) v[i] *= alpha;
  return v;
}

/** Legnagyobb abszolút eltérés két vektor között. */
export function maxAbsDiff(a: Float64Array, b: Float64Array): number {
  assertDim(b.length, a.length, 'maxAbsDiff');
  let d = 0;
  for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i]));
  return d;
}

// ─── Sűrű mátrix (sorfolytonos tárolás) ───────────────────────────────────────

export class DenseMatrix {
  readonly rows: number;
  readonly cols: number;
  readonly data: Float64Array;

  constructor(rows: number, cols: number, data?: Float64Array) {
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 0 || cols < 0) {
      throw new DimensionError(`Érvénytelen mátrixméret: ${rows}×${cols}.`);
    }
    this.rows = rows;
    this.cols = cols;
    if (data !== undefined) {
      assertDim(data.length, rows * cols, 'DenseMatrix adat');
      this.data = data;
    } else {
      this.data = new Float64Array(rows * cols);
    }
  }

  static zeros(rows: number, cols: number): DenseMatrix {
    return new DenseMatrix(rows, cols);
  }

  static identity(n: number): DenseMatrix {
    const mx = new DenseMatrix(n, n);
    for (let i = 0; i < n; i++) mx.data[i * n + i] = 1;
    return mx;
  }

  /** Sorfolytonos tömbökből (a tesztek olvashatósága kedvéért). */
  static fromRows(rows: readonly (readonly number[])[]): DenseMatrix {
    const r = rows.length;
    const c = r > 0 ? rows[0].length : 0;
    const mx = new DenseMatrix(r, c);
    for (let i = 0; i < r; i++) {
      if (rows[i].length !== c) {
        throw new DimensionError(`A(z) ${i}. sor hossza ${rows[i].length}, várt: ${c}.`);
      }
      for (let j = 0; j < c; j++) mx.data[i * c + j] = rows[i][j];
    }
    return mx;
  }

  get(i: number, j: number): number {
    return this.data[i * this.cols + j];
  }

  set(i: number, j: number, v: number): void {
    this.data[i * this.cols + j] = v;
  }

  add(i: number, j: number, v: number): void {
    this.data[i * this.cols + j] += v;
  }

  clone(): DenseMatrix {
    return new DenseMatrix(this.rows, this.cols, new Float64Array(this.data));
  }

  transpose(): DenseMatrix {
    const t = new DenseMatrix(this.cols, this.rows);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) t.data[j * this.rows + i] = this.data[i * this.cols + j];
    }
    return t;
  }

  /** C = this · B */
  multiply(b: DenseMatrix): DenseMatrix {
    assertDim(b.rows, this.cols, 'mátrixszorzás');
    const c = new DenseMatrix(this.rows, b.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let k = 0; k < this.cols; k++) {
        const aik = this.data[i * this.cols + k];
        if (aik === 0) continue;
        for (let j = 0; j < b.cols; j++) c.data[i * b.cols + j] += aik * b.data[k * b.cols + j];
      }
    }
    return c;
  }

  /** y = this · x */
  multiplyVector(x: Float64Array): Float64Array {
    assertDim(x.length, this.cols, 'mátrix-vektor szorzás');
    const y = new Float64Array(this.rows);
    for (let i = 0; i < this.rows; i++) {
      let s = 0;
      for (let j = 0; j < this.cols; j++) s += this.data[i * this.cols + j] * x[j];
      y[i] = s;
    }
    return y;
  }

  /** this ← this + α·B */
  addScaled(alpha: number, b: DenseMatrix): this {
    assertDim(b.rows, this.rows, 'mátrixösszeadás (sorok)');
    assertDim(b.cols, this.cols, 'mátrixösszeadás (oszlopok)');
    for (let i = 0; i < this.data.length; i++) this.data[i] += alpha * b.data[i];
    return this;
  }

  /** Legnagyobb abszolút elem — normálásokhoz és tesztekhez. */
  maxAbs(): number {
    let mx = 0;
    for (let i = 0; i < this.data.length; i++) mx = Math.max(mx, Math.abs(this.data[i]));
    return mx;
  }

  /** Szimmetria-eltérés: max |A_ij − A_ji|. */
  symmetryDefect(): number {
    if (this.rows !== this.cols) {
      throw new DimensionError('A szimmetria csak négyzetes mátrixra értelmezett.');
    }
    let d = 0;
    for (let i = 0; i < this.rows; i++) {
      for (let j = i + 1; j < this.cols; j++) {
        d = Math.max(d, Math.abs(this.get(i, j) - this.get(j, i)));
      }
    }
    return d;
  }

  /**
   * Numerikus rang teljes pivotálású Gauss-eliminációval.
   * @param tol relatív tűrés a legnagyobb pivothoz képest (alapértelmezés 1e-10)
   */
  rank(tol = 1e-10): number {
    const a = this.clone();
    const { rows, cols } = a;
    const scaleRef = a.maxAbs();
    if (scaleRef === 0) return 0;
    const eps = tol * scaleRef;

    let rank = 0;
    const usedRows = new Set<number>();
    for (let col = 0; col < cols && rank < rows; col++) {
      let pivotRow = -1;
      let best = eps;
      for (let i = 0; i < rows; i++) {
        if (usedRows.has(i)) continue;
        const v = Math.abs(a.get(i, col));
        if (v > best) {
          best = v;
          pivotRow = i;
        }
      }
      if (pivotRow < 0) continue;
      usedRows.add(pivotRow);
      const p = a.get(pivotRow, col);
      for (let i = 0; i < rows; i++) {
        if (i === pivotRow || usedRows.has(i)) continue;
        const f = a.get(i, col) / p;
        if (f === 0) continue;
        for (let j = col; j < cols; j++) a.set(i, j, a.get(i, j) - f * a.get(pivotRow, j));
      }
      rank++;
    }
    return rank;
  }

  /** Sorok tömbjeként — tesztekhez és naplózáshoz. */
  toRows(): number[][] {
    const out: number[][] = [];
    for (let i = 0; i < this.rows; i++) {
      const row: number[] = [];
      for (let j = 0; j < this.cols; j++) row.push(this.get(i, j));
      out.push(row);
    }
    return out;
  }

  /** Elem biztonságos lekérdezése határellenőrzéssel (nem hot path). */
  at(i: number, j: number): number {
    assertIndex(i, this.rows, 'DenseMatrix sor');
    assertIndex(j, this.cols, 'DenseMatrix oszlop');
    return this.get(i, j);
  }
}
