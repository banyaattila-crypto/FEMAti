import { afterEach, describe, expect, it } from 'vitest';
import * as fmt from './numbers.js';
import { useAppStore } from '../state/appStore.js';

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

describe('mértékegység-váltó — SI ↔ US customary, csak kijelzés (2026-09-04)', () => {
  afterEach(() => useAppStore.setState({ unitSystem: 'si' }));

  // Egzakt, a modultól FÜGGETLENÜL levezetett átváltási tényezők (ld.
  // `format/numbers.ts` fejléce) — ha ezek eltérnének a modul belső
  // konstansaitól, a lenti egyenlőség-ellenőrzés bukna.
  const M_TO_IN = 1 / 0.0254;
  const M_TO_FT = 1 / 0.3048;
  const KN_TO_KIP = 1 / 4.4482216152605;
  const KPA_TO_KSI = 1 / 6894.757;

  it('si módban minden konvertálható formázó VÁLTOZATLAN marad (regresszió)', () => {
    useAppStore.setState({ unitSystem: 'si' });
    expect(fmt.deflection(0.013434)).toEqual({ value: '13.434', unit: 'mm' });
    expect(fmt.moment(132.5)).toEqual({ value: '132.50', unit: 'kNm' });
    expect(fmt.area(51.88e-4)).toEqual({ value: '51.88', unit: 'cm²' });
    expect(fmt.inertia(7995e-8)).toEqual({ value: '7995', unit: 'cm⁴' });
    expect(fmt.stress(2.35e5)).toEqual({ value: '23.50', unit: 'kN/cm²' });
  });

  it('imperial módban a konvertálható mennyiségek US customary egységre és a megfelelő átváltott értékre váltanak', () => {
    useAppStore.setState({ unitSystem: 'imperial' });

    expect(fmt.deflection(0.1)).toEqual({ value: (0.1 * M_TO_IN).toFixed(3), unit: 'in' });
    expect(fmt.moment(100)).toEqual({ value: (100 * KN_TO_KIP * M_TO_FT).toFixed(2), unit: 'kip·ft' });
    expect(fmt.shear(10)).toEqual({ value: (10 * KN_TO_KIP).toFixed(2), unit: 'kip' });
    expect(fmt.force(10)).toEqual({ value: (10 * KN_TO_KIP).toFixed(2), unit: 'kip' });
    expect(fmt.acceleration(1)).toEqual({ value: M_TO_FT.toFixed(3), unit: 'ft/s²' });
    expect(fmt.bendingStiffness(1000)).toEqual({ value: (1000 * KN_TO_KIP * M_TO_FT * M_TO_FT).toFixed(0), unit: 'kip·ft²' });
    expect(fmt.shearStiffness(1000)).toEqual({ value: (1000 * KN_TO_KIP).toFixed(0), unit: 'kip' });
    expect(fmt.area(0.01)).toEqual({ value: (0.01 * M_TO_IN * M_TO_IN).toFixed(2), unit: 'in²' });
    expect(fmt.inertia(1e-6)).toEqual({ value: (1e-6 * M_TO_IN ** 4).toFixed(1), unit: 'in⁴' });
    expect(fmt.stress(1e5)).toEqual({ value: (1e5 * KPA_TO_KSI).toFixed(2), unit: 'ksi' });
    expect(fmt.length(6)).toEqual({ value: (6 * M_TO_FT).toFixed(2), unit: 'ft' });
  });

  it('a rendszer-független mennyiségek (rotation/frequencyHz/angularFrequency/modeShape/time/lambda/shapeFactor/percent/count) imperial módban is VÁLTOZATLANOK maradnak', () => {
    useAppStore.setState({ unitSystem: 'imperial' });
    expect(fmt.rotation(0.008235)).toEqual({ value: '8.235', unit: '×10⁻³ rad' });
    expect(fmt.frequencyHz(12.5)).toEqual({ value: '12.500', unit: 'Hz' });
    expect(fmt.angularFrequency(78.5)).toEqual({ value: '78.50', unit: 'rad/s' });
    expect(fmt.modeShape(0.5)).toEqual({ value: '0.5000', unit: '' });
    expect(fmt.time(1.234)).toEqual({ value: '1.234', unit: 's' });
    expect(fmt.lambda(1.647)).toEqual({ value: '1.647', unit: '' });
    expect(fmt.shapeFactor(1.15)).toEqual({ value: '1.150', unit: '' });
    expect(fmt.percent(50)).toEqual({ value: '50.00', unit: '%' });
    expect(fmt.count(4)).toEqual({ value: '4', unit: '' });
  });

  it('imperial módban sem ad vissza NaN-t tartalmazó szöveget hiányzó/nem véges értékre', () => {
    useAppStore.setState({ unitSystem: 'imperial' });
    const formatters = [fmt.deflection, fmt.moment, fmt.shear, fmt.force, fmt.area, fmt.inertia, fmt.stress, fmt.length];
    for (const f of formatters) {
      expect(f(Number.NaN).value).toBe(fmt.MISSING);
      expect(f(null).value).toBe(fmt.MISSING);
    }
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
