import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { DenseMatrix, axpy, dot, maxAbsDiff, norm2, scale, zeros } from '../src/linalg/dense.js';
import { DimensionError } from '../src/linalg/errors.js';
import { makeRng, randomSPD } from './helpers/denseSolve.js';

describe('vektorműveletek', () => {
  it('skaláris szorzat', () => {
    expect(dot(Float64Array.from([1, 2, 3]), Float64Array.from([4, 5, 6]))).toBe(32);
  });

  it('euklideszi norma', () => {
    expect(norm2(Float64Array.from([3, 4]))).toBeCloseTo(5, 15);
  });

  it('axpy: y ← y + α·x', () => {
    const y = Float64Array.from([1, 1, 1]);
    axpy(2, Float64Array.from([1, 2, 3]), y);
    expect([...y]).toEqual([3, 5, 7]);
  });

  it('scale', () => {
    expect([...scale(3, Float64Array.from([1, 2]))]).toEqual([3, 6]);
  });

  it('eltérő hosszúságra dimenzióhibát dob', () => {
    expect(() => dot(zeros(2), zeros(3))).toThrow(DimensionError);
    expect(() => axpy(1, zeros(2), zeros(3))).toThrow(DimensionError);
    expect(() => maxAbsDiff(zeros(2), zeros(3))).toThrow(DimensionError);
  });

  it('a norma sosem negatív és nulla vektorra zérus (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.double({ min: -1e6, max: 1e6, noNaN: true }), { maxLength: 40 }), (xs) => {
        const v = Float64Array.from(xs);
        expect(norm2(v)).toBeGreaterThanOrEqual(0);
      }),
    );
    expect(norm2(zeros(10))).toBe(0);
  });
});

describe('DenseMatrix', () => {
  it('sorokból építve helyesen indexel', () => {
    const a = DenseMatrix.fromRows([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expect(a.rows).toBe(2);
    expect(a.cols).toBe(3);
    expect(a.get(1, 2)).toBe(6);
    expect(a.at(0, 1)).toBe(2);
  });

  it('egyenetlen sorhosszra hibát dob', () => {
    expect(() => DenseMatrix.fromRows([[1, 2], [3]])).toThrow(DimensionError);
  });

  it('határon kívüli index az at()-ben hibát ad', () => {
    const a = DenseMatrix.identity(2);
    expect(() => a.at(2, 0)).toThrow(DimensionError);
    expect(() => a.at(0, -1)).toThrow(DimensionError);
  });

  it('transzponálás kétszer az eredetit adja', () => {
    const a = DenseMatrix.fromRows([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expect(a.transpose().transpose().toRows()).toEqual(a.toRows());
  });

  it('szorzás: A·I = A', () => {
    const a = DenseMatrix.fromRows([
      [1, 2],
      [3, 4],
    ]);
    expect(a.multiply(DenseMatrix.identity(2)).toRows()).toEqual(a.toRows());
  });

  it('szorzás ismert eredménnyel', () => {
    const a = DenseMatrix.fromRows([
      [1, 2],
      [3, 4],
    ]);
    const b = DenseMatrix.fromRows([
      [5, 6],
      [7, 8],
    ]);
    expect(a.multiply(b).toRows()).toEqual([
      [19, 22],
      [43, 50],
    ]);
  });

  it('nem illeszkedő méretekre hibát dob', () => {
    expect(() => DenseMatrix.zeros(2, 3).multiply(DenseMatrix.zeros(2, 2))).toThrow(DimensionError);
    expect(() => DenseMatrix.zeros(2, 3).multiplyVector(zeros(2))).toThrow(DimensionError);
  });

  it('mátrix-vektor szorzás', () => {
    const a = DenseMatrix.fromRows([
      [1, 2],
      [3, 4],
    ]);
    expect([...a.multiplyVector(Float64Array.from([1, 1]))]).toEqual([3, 7]);
  });

  it('(A·B)ᵀ = Bᵀ·Aᵀ (property)', () => {
    const rng = makeRng(7);
    for (let trial = 0; trial < 20; trial++) {
      const n = 2 + Math.floor(rng() * 4);
      const a = randomSPD(n, rng);
      const b = randomSPD(n, rng);
      const lhs = a.multiply(b).transpose();
      const rhs = b.transpose().multiply(a.transpose());
      expect(maxAbsDiff(lhs.data, rhs.data)).toBeLessThan(1e-9);
    }
  });

  it('szimmetria-eltérés: SPD mátrixra gyakorlatilag nulla', () => {
    const a = randomSPD(6, makeRng(11));
    expect(a.symmetryDefect()).toBeLessThan(1e-12);
  });

  it('szimmetria csak négyzetes mátrixra értelmezett', () => {
    expect(() => DenseMatrix.zeros(2, 3).symmetryDefect()).toThrow(DimensionError);
  });
});

describe('DenseMatrix.rank — a P3 mechanizmus-vizsgálat alapja', () => {
  it('egységmátrix rangja n', () => {
    expect(DenseMatrix.identity(6).rank()).toBe(6);
  });

  it('nulla mátrix rangja 0', () => {
    expect(DenseMatrix.zeros(4, 4).rank()).toBe(0);
  });

  it('lineárisan függő sorok esetén csökken', () => {
    const a = DenseMatrix.fromRows([
      [1, 2, 3],
      [2, 4, 6], // az első kétszerese
      [1, 0, 1],
    ]);
    expect(a.rank()).toBe(2);
  });

  it('egy 6×6 mátrix két merevtest-móddal rangja 4', () => {
    // Két nulltér-vektort tartalmazó mátrix: A = Σ vᵢvᵢᵀ négy független v-vel.
    const n = 6;
    const a = DenseMatrix.zeros(n, n);
    const vecs = [
      [1, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
      [0, 0, 0, 1, 0, 0],
    ];
    for (const v of vecs) {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) a.add(i, j, (v[i] ?? 0) * (v[j] ?? 0));
      }
    }
    expect(a.rank()).toBe(4);
  });

  it('a rang nem függ a mátrix skálázásától', () => {
    const a = DenseMatrix.fromRows([
      [1e-6, 2e-6],
      [2e-6, 4e-6],
    ]);
    expect(a.rank()).toBe(1);
  });
});
