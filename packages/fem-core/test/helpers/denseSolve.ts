/**
 * Referencia-megoldó KIZÁRÓLAG tesztekhez.
 *
 * Gauss-elimináció részleges pivotálással, sűrű tárolással. Szándékosan
 * más algoritmus, mint a vizsgált skyline LDLᵀ — így a két út egyezése
 * valódi bizonyíték, nem ugyanannak a hibának a kétszeri megismétlése.
 */

import { DenseMatrix } from '../../src/linalg/dense.js';

/** A·x = b megoldása sűrű Gauss-eliminációval. */
export function denseSolve(a: DenseMatrix, b: Float64Array): Float64Array {
  const n = a.rows;
  if (a.cols !== n || b.length !== n) {
    throw new RangeError('denseSolve: nem négyzetes mátrix vagy hibás jobboldal.');
  }

  // Kibővített mátrix
  const m = new Float64Array(n * (n + 1));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) m[i * (n + 1) + j] = a.get(i, j);
    m[i * (n + 1) + n] = b[i];
  }

  for (let col = 0; col < n; col++) {
    // Részleges pivotálás
    let pivot = col;
    let best = Math.abs(m[col * (n + 1) + col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(m[r * (n + 1) + col]);
      if (v > best) {
        best = v;
        pivot = r;
      }
    }
    if (best < 1e-300) throw new Error(`denseSolve: szinguláris mátrix a(z) ${col}. oszlopnál.`);

    if (pivot !== col) {
      for (let j = col; j <= n; j++) {
        const t = m[col * (n + 1) + j];
        m[col * (n + 1) + j] = m[pivot * (n + 1) + j];
        m[pivot * (n + 1) + j] = t;
      }
    }

    const p = m[col * (n + 1) + col];
    for (let r = col + 1; r < n; r++) {
      const f = m[r * (n + 1) + col] / p;
      if (f === 0) continue;
      for (let j = col; j <= n; j++) m[r * (n + 1) + j] -= f * m[col * (n + 1) + j];
    }
  }

  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = m[i * (n + 1) + n];
    for (let j = i + 1; j < n; j++) s -= m[i * (n + 1) + j] * x[j];
    x[i] = s / m[i * (n + 1) + i];
  }
  return x;
}

/**
 * Véletlen szimmetrikus, pozitív definit mátrix: A = LᵀL + n·I.
 * A diagonális eltolás garantálja a pozitív definitséget és korlátozza a
 * kondíciószámot, hogy a teszt ne a lebegőpontos zajt mérje.
 */
export function randomSPD(n: number, rng: () => number, shift = n): DenseMatrix {
  const l = new DenseMatrix(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) l.set(i, j, rng() * 2 - 1);
  }
  const a = l.transpose().multiply(l);
  for (let i = 0; i < n; i++) a.add(i, i, shift);
  return a;
}

/** Determinisztikus álvéletlen generátor (mulberry32) — reprodukálható tesztekhez. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Relatív hiba két vektor között: ‖a − b‖ / ‖b‖. */
export function relativeError(a: Float64Array, b: Float64Array): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    num += d * d;
    den += b[i] * b[i];
  }
  return den === 0 ? Math.sqrt(num) : Math.sqrt(num / den);
}
