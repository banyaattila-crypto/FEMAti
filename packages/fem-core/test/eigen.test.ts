import { describe, expect, it } from 'vitest';
import { DenseMatrix, NotPositiveDefiniteError, cholesky, generalizedSymmetricEigen, jacobiEigenSymmetric, norm2 } from '../src/index.js';

/**
 * ADR-0016, 2. nyitott kérdés: sajátérték-megoldó a modális analízishez.
 * Ezek a tesztek a `linalg/eigen.ts` NUMERIKUS helyességét igazolják,
 * FÜGGETLENÜL a mechanikai (Timoshenko-elem) formulázástól — ld.
 * `modal.test.ts` a mechanikai validációhoz.
 */

function expectRelative(actual: number, expected: number, tol: number): void {
  const denom = Math.abs(expected) > 0 ? Math.abs(expected) : 1;
  expect(Math.abs(actual - expected) / denom).toBeLessThan(tol);
}

describe('cholesky', () => {
  it('L·Lᵀ visszaadja az eredeti mátrixot', () => {
    const a = DenseMatrix.fromRows([
      [4, 2, -2],
      [2, 5, 1],
      [-2, 1, 6],
    ]);
    const l = cholesky(a);
    const reconstructed = l.multiply(l.transpose());
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) expectRelative(reconstructed.get(i, j), a.get(i, j), 1e-12);
    }
  });

  it('L alsó háromszög (a felső rész zérus)', () => {
    const a = DenseMatrix.fromRows([
      [4, 2],
      [2, 5],
    ]);
    const l = cholesky(a);
    expect(l.get(0, 1)).toBe(0);
  });

  it('nem pozitív definit mátrixra NotPositiveDefiniteError-t dob', () => {
    const a = DenseMatrix.fromRows([
      [1, 2],
      [2, 1], // determináns negatív → nem PD
    ]);
    expect(() => cholesky(a)).toThrow(NotPositiveDefiniteError);
  });
});

describe('jacobiEigenSymmetric', () => {
  it('diagonális mátrixra a sajátértékek maguk az átlós elemek, növekvő sorrendben', () => {
    const a = DenseMatrix.fromRows([
      [5, 0, 0],
      [0, 1, 0],
      [0, 0, 3],
    ]);
    const { values } = jacobiEigenSymmetric(a);
    expect(Array.from(values).map((v) => Math.round(v * 1e10) / 1e10)).toEqual([1, 3, 5]);
  });

  /**
   * A·v = λ·v ellenőrzése VEKTOR-normával, nem komponensenkénti relatív
   * eltéréssel — a `v` néhány komponense a másodfokú (3-módusú) rendszerben
   * numerikusan zérushoz közeli (pl. a középső módus szimmetriája miatt),
   * és egy zérushoz közeli VÁRT érték mellett a komponensenkénti relatív
   * hiba önmagában félrevezető (a nevező is zérushoz tart) — ugyanez az elv,
   * mint a `rigidBodyModes` merevségi önellenőrzésnél (`element.test.ts`).
   */
  it('A·v = λ·v minden sajátpárra (3×3 szimmetrikus)', () => {
    const a = DenseMatrix.fromRows([
      [2, 1, 0],
      [1, 2, 1],
      [0, 1, 2],
    ]);
    const { values, vectors } = jacobiEigenSymmetric(a);
    for (let c = 0; c < 3; c++) {
      const v = Float64Array.from({ length: 3 }, (_, i) => vectors.get(i, c));
      const av = a.multiplyVector(v);
      const residual = Float64Array.from(av, (x, i) => x - (values[c] ?? 0) * (v[i] ?? 0));
      expect(norm2(residual) / (a.maxAbs() * norm2(v))).toBeLessThan(1e-12);
    }
  });

  it('a sajátvektorok ortonormáltak', () => {
    const a = DenseMatrix.fromRows([
      [4, 1, 1],
      [1, 3, 0.5],
      [1, 0.5, 2],
    ]);
    const { vectors } = jacobiEigenSymmetric(a);
    const vtv = vectors.transpose().multiply(vectors);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) expectRelative(vtv.get(i, j), i === j ? 1 : 0, 1e-10);
    }
  });
});

describe('generalizedSymmetricEigen', () => {
  it('M = I esetén ugyanazt adja, mint a standard Jacobi', () => {
    const k = DenseMatrix.fromRows([
      [2, 1, 0],
      [1, 2, 1],
      [0, 1, 2],
    ]);
    const identity = DenseMatrix.identity(3);
    const gen = generalizedSymmetricEigen(k, identity);
    const std = jacobiEigenSymmetric(k);
    for (let i = 0; i < 3; i++) expectRelative(gen.values[i] ?? 0, std.values[i] ?? 0, 1e-10);
  });

  it('K·x = λ·M·x minden sajátpárra (nemtriviális M)', () => {
    const k = DenseMatrix.fromRows([
      [8, -2, 0],
      [-2, 6, -2],
      [0, -2, 4],
    ]);
    const m = DenseMatrix.fromRows([
      [2, 0.2, 0],
      [0.2, 3, 0.1],
      [0, 0.1, 1],
    ]);
    const { values, vectors } = generalizedSymmetricEigen(k, m);
    for (let c = 0; c < 3; c++) {
      const x = Float64Array.from({ length: 3 }, (_, i) => vectors.get(i, c));
      const kx = k.multiplyVector(x);
      const mx = m.multiplyVector(x);
      const residual = Float64Array.from(kx, (v, i) => v - (values[c] ?? 0) * (mx[i] ?? 0));
      expect(norm2(residual) / (k.maxAbs() * norm2(x))).toBeLessThan(1e-9);
    }
  });

  it('a sajátvektorok M-ortonormáltak: φᵢᵀ·M·φⱼ = δᵢⱼ', () => {
    const k = DenseMatrix.fromRows([
      [8, -2, 0],
      [-2, 6, -2],
      [0, -2, 4],
    ]);
    const m = DenseMatrix.fromRows([
      [2, 0.2, 0],
      [0.2, 3, 0.1],
      [0, 0.1, 1],
    ]);
    const { vectors } = generalizedSymmetricEigen(k, m);
    const mPhi = m.multiply(vectors);
    const phiTMPhi = vectors.transpose().multiply(mPhi);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) expectRelative(phiTMPhi.get(i, j), i === j ? 1 : 0, 1e-9);
    }
  });

  it('a sajátértékek mind pozitívak, ha K is pozitív definit', () => {
    const k = DenseMatrix.fromRows([
      [8, -2, 0],
      [-2, 6, -2],
      [0, -2, 4],
    ]);
    const m = DenseMatrix.identity(3);
    const { values } = generalizedSymmetricEigen(k, m);
    for (const v of values) expect(v).toBeGreaterThan(0);
  });
});
