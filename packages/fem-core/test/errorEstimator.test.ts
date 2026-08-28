import { describe, expect, it } from 'vitest';
import { averageAtNodes } from '../src/post/extrapolation.js';
import { estimateElementError } from '../src/post/errorEstimator.js';

describe('estimateElementError', () => {
  const elementNodeIndices: readonly [number, number, number][] = [
    [0, 1, 2],
    [2, 3, 4],
  ];

  it('nulla, ha a két elem pontosan egyezik a közös csomóponton (nincs ugrás)', () => {
    const elementNodalValues: readonly [number, number, number][] = [
      [0, 1, 10],
      [10, 3, 4],
    ];
    const averaged = averageAtNodes(elementNodeIndices, elementNodalValues, 5);
    const error = estimateElementError(elementNodeIndices, elementNodalValues, averaged, 100);
    expect(error[0]).toBeCloseTo(0, 12);
    expect(error[1]).toBeCloseTo(0, 12);
  });

  it('az ugrás nagysága |A−B|/skála·100 — zárt alakban ellenőrizve', () => {
    // Elem A jobb vége: 10; Elem B bal vége: 20 → |10-20|=10 az ugrás.
    const elementNodalValues: readonly [number, number, number][] = [
      [0, 1, 10],
      [20, 3, 4],
    ];
    const fieldExtreme = 50;
    const averaged = averageAtNodes(elementNodeIndices, elementNodalValues, 5);
    const error = estimateElementError(elementNodeIndices, elementNodalValues, averaged, fieldExtreme);
    const expectedPercent = (10 / 50) * 100; // 20%
    expect(error[0]).toBeCloseTo(expectedPercent, 10);
    expect(error[1]).toBeCloseTo(expectedPercent, 10);
  });

  it('a modell szélén (nem megosztott csomópont) nincs ugrás, még eltérő szomszédos érték esetén sem', () => {
    // Csak 1 elem — a bal és jobb csomópontja is a modell széle.
    const singleElement: readonly [number, number, number][] = [[0, 1, 2]];
    const nodalValues: readonly [number, number, number][] = [[100, 1, -100]];
    const averaged = averageAtNodes(singleElement, nodalValues, 3);
    const error = estimateElementError(singleElement, nodalValues, averaged, 100);
    expect(error[0]).toBe(0);
  });

  it('nulla szélsőérték esetén az 1-es padlóra normál (nem oszt nullával)', () => {
    const elementNodalValues: readonly [number, number, number][] = [
      [0, 1, 3],
      [7, 3, 4],
    ];
    const averaged = averageAtNodes(elementNodeIndices, elementNodalValues, 5);
    const error = estimateElementError(elementNodeIndices, elementNodalValues, averaged, 0);
    expect(Number.isFinite(error[0])).toBe(true);
    expect(error[0]).toBeCloseTo(400, 10); // |3-7|=4, /1*100=400%
  });
});
