import { describe, expect, it } from 'vitest';
import {
  VERTICAL_BEHAVIOR_FACTOR_MAX,
  VERTICAL_SPECTRUM_TABLE,
  verticalDampingCorrection,
  verticalDesignSpectrum,
  verticalElasticSpectrum,
  type VerticalSpectrumInput,
} from '../src/index.js';

/**
 * EN 1998-1 — függőleges válaszspektrum. A táblázatértékek és a képlet
 * forrása: Carvalho, E. (2011), "EUROCODE 8 — Background and
 * Applications" (JRC/Lisbon), 23-24. dia — ld. `verticalSeismicSpectrum.ts`
 * fejléce. Az eredeti EN 1998-1 szöveg nem volt közvetlenül elérhető,
 * ezért a validáció ezt a másodlagos, hivatalos EU JRC forrást használja.
 */

describe('EN 1998-1 3.4. táblázat — függőleges spektrum paraméterei', () => {
  it('Type 1: avg/ag=0.90, TB=0.05, TC=0.15, TD=1.0', () => {
    expect(VERTICAL_SPECTRUM_TABLE[1]).toEqual({ avgOverAg: 0.9, TB: 0.05, TC: 0.15, TD: 1.0 });
  });

  it('Type 2: avg/ag=0.45, TB=0.05, TC=0.15, TD=1.0', () => {
    expect(VERTICAL_SPECTRUM_TABLE[2]).toEqual({ avgOverAg: 0.45, TB: 0.05, TC: 0.15, TD: 1.0 });
  });
});

describe('verticalDampingCorrection — η', () => {
  it('ξ=5%-nál pontosan 1', () => {
    expect(verticalDampingCorrection(5)).toBeCloseTo(1, 12);
  });

  it('ξ=0%-nál √2', () => {
    expect(verticalDampingCorrection(0)).toBeCloseTo(Math.sqrt(2), 12);
  });

  it('nagyon nagy csillapításnál a 0.55-ös alsó korlátra vágva', () => {
    expect(verticalDampingCorrection(100)).toBe(0.55);
  });
});

describe('verticalElasticSpectrum — Sve(T)/g', () => {
  const input: VerticalSpectrumInput = { agOverG: 0.2, gammaI: 1.2, spectrumType: 1, dampingRatioPercent: 5 };
  // avg/g = 0.90 * 1.2 * 0.2 = 0.216
  const avg = 0.216;

  it('T=0-nál pontosan avg', () => {
    expect(verticalElasticSpectrum(0, input)).toBeCloseTo(avg, 12);
  });

  it('a plató (TB≤T≤TC) konstans avg·η·3.0, T-től függetlenül', () => {
    const plateau = avg * 3.0;
    expect(verticalElasticSpectrum(0.05, input)).toBeCloseTo(plateau, 10);
    expect(verticalElasticSpectrum(0.1, input)).toBeCloseTo(plateau, 10);
    expect(verticalElasticSpectrum(0.15, input)).toBeCloseTo(plateau, 10);
  });

  it('folytonos a TB, TC, TD töréspontokon (a négy ág illeszkedik)', () => {
    const { TB, TC, TD } = VERTICAL_SPECTRUM_TABLE[1];
    const eps = 1e-9;
    expect(verticalElasticSpectrum(TB - eps, input)).toBeCloseTo(verticalElasticSpectrum(TB + eps, input), 6);
    expect(verticalElasticSpectrum(TC - eps, input)).toBeCloseTo(verticalElasticSpectrum(TC + eps, input), 6);
    expect(verticalElasticSpectrum(TD - eps, input)).toBeCloseTo(verticalElasticSpectrum(TD + eps, input), 6);
  });

  it('a leszálló ágban (T>TC) monoton csökken', () => {
    const a = verticalElasticSpectrum(0.3, input);
    const b = verticalElasticSpectrum(0.6, input);
    const c = verticalElasticSpectrum(1.5, input);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it('negatív periódusra hibát dob', () => {
    expect(() => verticalElasticSpectrum(-0.1, input)).toThrow(RangeError);
  });

  it('Type 2 spektrumnál kisebb az avg/ag miatt, egyébként ugyanaz az alak', () => {
    const type2: VerticalSpectrumInput = { ...input, spectrumType: 2 };
    expect(verticalElasticSpectrum(0.1, type2)).toBeCloseTo(verticalElasticSpectrum(0.1, input) * (0.45 / 0.9), 10);
  });
});

describe('verticalDesignSpectrum — Svd(T) = Sve(T)/qv', () => {
  const input: VerticalSpectrumInput = { agOverG: 0.15, gammaI: 1.0, spectrumType: 1 };

  it('alapértelmezett qv=1.5 (EC8 4.3.3.5.2 max)', () => {
    expect(VERTICAL_BEHAVIOR_FACTOR_MAX).toBe(1.5);
    expect(verticalDesignSpectrum(0.1, input)).toBeCloseTo(verticalElasticSpectrum(0.1, input) / 1.5, 12);
  });

  it('explicit qv paraméterrel felülírható', () => {
    expect(verticalDesignSpectrum(0.1, input, 1.0)).toBeCloseTo(verticalElasticSpectrum(0.1, input), 12);
  });
});
