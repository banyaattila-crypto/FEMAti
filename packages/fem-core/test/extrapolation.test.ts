import { describe, expect, it } from 'vitest';
import { averageAtNodes, extrapolateElementToNodes, lagrangeAt } from '../src/post/extrapolation.js';

const GAUSS_XI: readonly [number, number, number] = [-Math.sqrt(0.6), 0, Math.sqrt(0.6)];

describe('lagrangeAt', () => {
  it('egzaktul reprodukál egy másodfokú függvényt (f(ξ)=ξ²)', () => {
    const values: readonly [number, number, number] = GAUSS_XI.map((xi) => xi * xi) as [number, number, number];
    expect(lagrangeAt(values, GAUSS_XI, -1)).toBeCloseTo(1, 12);
    expect(lagrangeAt(values, GAUSS_XI, 0)).toBeCloseTo(0, 12);
    expect(lagrangeAt(values, GAUSS_XI, 1)).toBeCloseTo(1, 12);
  });

  it('egzaktul reprodukál egy lineáris függvényt (f(ξ)=ξ)', () => {
    const values: readonly [number, number, number] = [GAUSS_XI[0], GAUSS_XI[1], GAUSS_XI[2]];
    expect(lagrangeAt(values, GAUSS_XI, -1)).toBeCloseTo(-1, 12);
    expect(lagrangeAt(values, GAUSS_XI, 0)).toBeCloseTo(0, 12);
    expect(lagrangeAt(values, GAUSS_XI, 1)).toBeCloseTo(1, 12);
  });

  it('a ξ=0 Gauss-pont saját értékét adja vissza extrapoláció nélkül', () => {
    const values: readonly [number, number, number] = [3, 7, -2];
    expect(lagrangeAt(values, GAUSS_XI, 0)).toBeCloseTo(7, 12);
  });
});

describe('extrapolateElementToNodes', () => {
  it('konstans mezőre a 3 csomópont mindegyike ugyanazt az értéket kapja', () => {
    const [left, mid, right] = extrapolateElementToNodes([5, 5, 5], GAUSS_XI);
    expect(left).toBeCloseTo(5, 12);
    expect(mid).toBeCloseTo(5, 12);
    expect(right).toBeCloseTo(5, 12);
  });
});

describe('averageAtNodes', () => {
  it('a belső (megosztott) csomópontnál a két elem értékének átlagát adja', () => {
    // 2 elem, 5 csomópont: [0,1,2] és [2,3,4] — a 2. csomópont MEGOSZTOTT.
    const elementNodeIndices: readonly [number, number, number][] = [
      [0, 1, 2],
      [2, 3, 4],
    ];
    // Elem A saját extrapolált értéke a jobb végén (2. csp): 10.
    // Elem B saját extrapolált értéke a bal végén (2. csp): 20.
    const elementNodalValues: readonly [number, number, number][] = [
      [0, 1, 10],
      [20, 3, 4],
    ];
    const { nodal, contributingElements } = averageAtNodes(elementNodeIndices, elementNodalValues, 5);
    expect(nodal[2]).toBeCloseTo(15, 12); // (10+20)/2
    expect(contributingElements[2]).toBe(2);
    // A szélső csomópontokat csak egy elem érinti.
    expect(contributingElements[0]).toBe(1);
    expect(contributingElements[4]).toBe(1);
    expect(nodal[0]).toBeCloseTo(0, 12);
    expect(nodal[4]).toBeCloseTo(4, 12);
  });
});
