import { describe, expect, it } from 'vitest';
import { clampTolerancePercent, residualPercent } from '../src/solver/convergence.js';

describe('residualPercent', () => {
  it('100·|ψ|/|f| a szokásos esetben', () => {
    const psi = Float64Array.from([3, 4]); // |psi| = 5
    const f = Float64Array.from([30, 40]); // |f| = 50
    expect(residualPercent(psi, f)).toBeCloseTo(10, 10);
  });

  it('nulla teher ÉS nulla reziduum esetén 0 (nem NaN)', () => {
    const zero = new Float64Array(3);
    expect(residualPercent(zero, zero)).toBe(0);
  });

  it('nulla teher, de nemnulla reziduum esetén +∞ (sosem szabadna előfordulnia)', () => {
    const psi = Float64Array.from([1, 0]);
    const f = new Float64Array(2);
    expect(residualPercent(psi, f)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('clampTolerancePercent', () => {
  it('a megengedett sávon belüli értéket változatlanul hagyja', () => {
    expect(clampTolerancePercent(1e-4)).toBeCloseTo(1e-4, 12);
  });

  it('a sáv alá/fölé eső értéket a határra szorítja', () => {
    expect(clampTolerancePercent(1e-12)).toBeCloseTo(1e-8, 12);
    expect(clampTolerancePercent(10)).toBeCloseTo(1e-2, 12);
  });
});
