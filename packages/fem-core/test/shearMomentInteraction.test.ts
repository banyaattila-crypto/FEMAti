import { describe, expect, it } from 'vitest';
import { plasticShearCapacity, shearMomentInteraction } from '../src/index.js';

/**
 * ADR-0018, A) út: EN 1993-1-1 6.2.8 stílusú, utólagos M-V teherbírás-
 * ellenőrzés. NEM módosítja a radial-return-t — önálló, tisztán
 * matematikai formula, ezért a validáció a szabvány saját, jól ismert
 * határeseteire épül (nem szükséges FE-modell hozzá).
 */

describe('plasticShearCapacity', () => {
  it('Vpl = A_eff·σY/√3', () => {
    const sigmaY = 23.5e4; // kN/m²
    const aEff = 0.006; // m²
    expect(plasticShearCapacity(sigmaY, aEff)).toBeCloseTo((aEff * sigmaY) / Math.sqrt(3), 6);
  });

  it('zérus effektív terület zérus teherbírást ad', () => {
    expect(plasticShearCapacity(23.5e4, 0)).toBe(0);
  });
});

describe('shearMomentInteraction — EN 1993-1-1 6.2.8 stílusú ellenőrzés', () => {
  const mpl = 141.5; // kNm
  const vpl = 500; // kN

  it('V=0 esetén nincs redukció: Mv,Rd = Mpl,Rd', () => {
    const r = shearMomentInteraction(100, 0, mpl, vpl);
    expect(r.rho).toBe(0);
    expect(r.mvRd).toBeCloseTo(mpl, 10);
  });

  it('V ≤ 0.5·Vpl esetén NINCS redukció (a szabvány küszöbe)', () => {
    const r = shearMomentInteraction(100, 0.5 * vpl, mpl, vpl);
    expect(r.rho).toBe(0);
    expect(r.mvRd).toBeCloseTo(mpl, 10);
  });

  it('V = Vpl esetén teljes redukció: Mv,Rd → 0', () => {
    const r = shearMomentInteraction(0, vpl, mpl, vpl);
    expect(r.rho).toBeCloseTo(1, 10);
    expect(r.mvRd).toBeCloseTo(0, 8);
  });

  it('V = 0.75·Vpl esetén a redukció a képlet szerint számolható', () => {
    // ρ = (2·0.75 − 1)² = 0.5² = 0.25
    const v = 0.75 * vpl;
    const r = shearMomentInteraction(100, v, mpl, vpl);
    expect(r.rho).toBeCloseTo(0.25, 10);
    expect(r.mvRd).toBeCloseTo(0.75 * mpl, 10);
  });

  it('a kihasználtság |M|/Mv,Rd — 1 alatt megfelel, fölötte túllépés', () => {
    const r1 = shearMomentInteraction(100, 0, mpl, vpl);
    expect(r1.utilization).toBeCloseTo(100 / mpl, 10);
    expect(r1.utilization).toBeLessThan(1);

    const r2 = shearMomentInteraction(mpl * 1.1, 0, mpl, vpl);
    expect(r2.utilization).toBeGreaterThan(1);
  });

  it('a redukció előjelfüggetlen: |M| és |V| számít, nem az előjel', () => {
    const a = shearMomentInteraction(-100, -0.75 * vpl, mpl, vpl);
    const b = shearMomentInteraction(100, 0.75 * vpl, mpl, vpl);
    expect(a.rho).toBeCloseTo(b.rho, 12);
    expect(a.utilization).toBeCloseTo(b.utilization, 12);
  });

  it('Vpl=0 esetén (nincs nyírási teherbírás) végtelen kihasználtságot ad, nem hibát dob', () => {
    const r = shearMomentInteraction(10, 5, mpl, 0);
    expect(r.utilization).toBe(Number.POSITIVE_INFINITY);
  });
});
