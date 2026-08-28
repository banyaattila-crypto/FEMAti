import { describe, expect, it } from 'vitest';
import * as fmt from './numbers.js';

/**
 * A DESIGN-TERV.md 6.1 formázási táblázatának tesztjei.
 *
 * Ez nem formalitás: a felület minden számának formátuma innen származik,
 * és a 6.3 pont szerint a hibás vagy hiányzó érték SOHA nem jelenhet meg
 * `NaN`-ként.
 */

describe('mértékegység-váltás és tizedesek', () => {
  it('lehajlás: [m] → mm, 3 tizedes', () => {
    expect(fmt.deflection(0.013434)).toEqual({ value: '13.434', unit: 'mm' });
  });

  it('elfordulás: [rad] → ×10⁻³, 3 tizedes', () => {
    expect(fmt.rotation(0.008235)).toEqual({ value: '8.235', unit: '×10⁻³ rad' });
  });

  it('nyomaték: kNm, 2 tizedes', () => {
    expect(fmt.moment(132.5)).toEqual({ value: '132.50', unit: 'kNm' });
  });

  it('terület: [m²] → cm², 2 tizedes', () => {
    expect(fmt.area(51.88e-4)).toEqual({ value: '51.88', unit: 'cm²' });
  });

  it('inercia: [m⁴] → cm⁴, egész', () => {
    expect(fmt.inertia(7995e-8)).toEqual({ value: '7995', unit: 'cm⁴' });
  });

  it('feszültség: [kN/m²] → kN/cm², 2 tizedes', () => {
    expect(fmt.stress(2.35e5)).toEqual({ value: '23.50', unit: 'kN/cm²' });
  });

  it('teherszorzó: dimenziótlan, 3 tizedes', () => {
    expect(fmt.lambda(1.647)).toEqual({ value: '1.647', unit: '' });
  });
});

describe('hiányzó és nem véges értékek (DESIGN-TERV 6.3)', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['NaN', Number.NaN],
    ['végtelen', Number.POSITIVE_INFINITY],
  ])('%s helyén gondolatjel áll, nem NaN', (_label, input) => {
    expect(fmt.deflection(input as number | null | undefined).value).toBe(fmt.MISSING);
    expect(fmt.moment(input as number | null | undefined).value).toBe(fmt.MISSING);
    expect(fmt.percent(input as number | null | undefined).value).toBe(fmt.MISSING);
  });

  it('egyetlen formázó sem ad vissza NaN-t tartalmazó szöveget', () => {
    const formatters = [
      fmt.deflection,
      fmt.rotation,
      fmt.moment,
      fmt.shear,
      fmt.force,
      fmt.bendingStiffness,
      fmt.area,
      fmt.inertia,
      fmt.stress,
      fmt.lambda,
      fmt.percent,
    ];
    for (const f of formatters) {
      expect(f(Number.NaN).value).not.toContain('NaN');
    }
  });
});

describe('előjelkezelés', () => {
  it('a negatív nulla nullaként jelenik meg', () => {
    expect(fmt.moment(-0).value).toBe('0.00');
  });

  it('a negatív értékek előjele megmarad', () => {
    expect(fmt.moment(-27.56).value).toBe('-27.56');
  });
});

describe('eltérés minősítése (DESIGN-TERV 6.2)', () => {
  it('a tűrésen belül rendben', () => {
    expect(fmt.deviationTone(1.5, 2)).toBe('ok');
  });

  it('a tűrés 1–3-szorosa között figyelmeztet', () => {
    expect(fmt.deviationTone(4, 2)).toBe('warn');
  });

  it('a tűrés háromszorosa fölött hibát jelez', () => {
    expect(fmt.deviationTone(7, 2)).toBe('error');
  });

  it('az előjel nem számít, csak a nagyság', () => {
    expect(fmt.deviationTone(-4, 2)).toBe('warn');
  });
});

describe('deformációs lépték', () => {
  it('a nagyítás mértéke kiírható alakban áll elő', () => {
    expect(fmt.scaleFactor(4317)).toMatch(/^×4/);
  });
});
