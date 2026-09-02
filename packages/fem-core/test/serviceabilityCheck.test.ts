import { describe, expect, it } from 'vitest';
import { crackingMomentUtilization, deflectionUtilization } from '../src/index.js';

/**
 * ADR-0021: SLS-jellegű, UTÓLAGOS ellenőrzések (lehajlás-korlát, beton
 * repedési nyomaték) — tisztán matematikai formulák, a `shearMomentInteraction.
 * test.ts` mintáját követve (nem szükséges hozzájuk FE-modell).
 */

describe('deflectionUtilization', () => {
  const span = 6; // m

  it('a megengedett arányon (1/250) belüli lehajlás kihasználtsága 1 alatt van', () => {
    const wMax = span / 500; // fele a megengedettnek
    expect(deflectionUtilization(wMax, span)).toBeCloseTo(0.5, 10);
  });

  it('a pontosan L/250 lehajlás kihasználtsága 1', () => {
    const wMax = span / 250;
    expect(deflectionUtilization(wMax, span)).toBeCloseTo(1, 10);
  });

  it('a megengedett fölötti lehajlás kihasználtsága 1 fölött van', () => {
    const wMax = span / 100;
    expect(deflectionUtilization(wMax, span)).toBeGreaterThan(1);
  });

  it('előjelfüggetlen: negatív lehajlásra ugyanazt adja, mint a pozitívra', () => {
    const wMax = span / 300;
    expect(deflectionUtilization(-wMax, span)).toBeCloseTo(deflectionUtilization(wMax, span), 12);
  });

  it('span=0 esetén végtelen kihasználtságot ad, nem hibát dob', () => {
    expect(deflectionUtilization(0.01, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('egyedi limitRatio megadható', () => {
    const wMax = span / 200;
    expect(deflectionUtilization(wMax, span, 1 / 200)).toBeCloseTo(1, 10);
  });
});

describe('crackingMomentUtilization', () => {
  const mcr = 40; // kNm

  it('M_max < M_cr esetén a kihasználtság 1 alatt van', () => {
    expect(crackingMomentUtilization(20, mcr)).toBeCloseTo(0.5, 10);
  });

  it('M_max = M_cr esetén a kihasználtság pontosan 1', () => {
    expect(crackingMomentUtilization(mcr, mcr)).toBeCloseTo(1, 10);
  });

  it('M_max > M_cr esetén a kihasználtság 1 fölött van (a keresztmetszet elméletileg berepedt)', () => {
    expect(crackingMomentUtilization(mcr * 1.5, mcr)).toBeGreaterThan(1);
  });

  it('előjelfüggetlen: |M| számít, nem az előjel', () => {
    expect(crackingMomentUtilization(-20, mcr)).toBeCloseTo(crackingMomentUtilization(20, mcr), 12);
  });

  it('mcr=0 esetén végtelen kihasználtságot ad, nem hibát dob', () => {
    expect(crackingMomentUtilization(10, 0)).toBe(Number.POSITIVE_INFINITY);
  });
});
