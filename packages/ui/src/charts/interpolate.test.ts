import { describe, expect, it } from 'vitest';
import { findExtreme, interpolateAt } from './interpolate.js';

describe('interpolateAt', () => {
  const xs = [0, 1, 2, 4];
  const ys = [0, 10, 10, -20];

  it('pontosan visszaadja az ismert pontokat', () => {
    expect(interpolateAt(xs, ys, 0)).toBe(0);
    expect(interpolateAt(xs, ys, 2)).toBe(10);
    expect(interpolateAt(xs, ys, 4)).toBe(-20);
  });

  it('lineárisan interpolál a pontok között', () => {
    expect(interpolateAt(xs, ys, 0.5)).toBeCloseTo(5, 10);
    expect(interpolateAt(xs, ys, 3)).toBeCloseTo(-5, 10); // 2→4 között, 10→-20, felénél -5
  });

  it('a tartományon kívüli x-et a szélső ponthoz rögzíti (clamp)', () => {
    expect(interpolateAt(xs, ys, -5)).toBe(0);
    expect(interpolateAt(xs, ys, 100)).toBe(-20);
  });

  it('üres tömbre null-t ad', () => {
    expect(interpolateAt([], [], 1)).toBeNull();
  });

  it('egyetlen pontra azt az értéket adja mindenütt', () => {
    expect(interpolateAt([5], [42], 5)).toBe(42);
  });
});

describe('findExtreme', () => {
  it('a legnagyobb abszolút értékű pontot adja vissza, előjellel', () => {
    const xs = [0, 1, 2, 3];
    const ys = [3, -10, 8, 2];
    expect(findExtreme(xs, ys)).toEqual({ value: -10, x: 1 });
  });

  it('üres tömbre null-t ad', () => {
    expect(findExtreme([], [])).toBeNull();
  });
});
