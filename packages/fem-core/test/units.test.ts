import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  areaFromCm2,
  areaToCm2,
  degToRad,
  densityFromSpecificWeight,
  inertiaFromCm4,
  inertiaToCm4,
  lengthFromMm,
  lengthToMm,
  modulusFromKNPerCm2,
  modulusToKNPerCm2,
  radToDeg,
  specificWeightFromDensity,
} from '../src/units/index.js';

const finite = () => fc.double({ min: -1e9, max: 1e9, noNaN: true, noDefaultInfinity: true });

describe('units — konverziók a diplomaterv 3. táblázata szerint', () => {
  it('terület: 1 cm² = 1e-4 m²', () => {
    expect(areaFromCm2(1)).toBeCloseTo(1e-4, 15);
    expect(areaFromCm2(100)).toBeCloseTo(1e-2, 15);
  });

  it('inercia: 1 cm⁴ = 1e-8 m⁴', () => {
    expect(inertiaFromCm4(1)).toBeCloseTo(1e-8, 20);
  });

  it('modulus: 21000 kN/cm² (acél) = 2.1e8 kN/m²', () => {
    expect(modulusFromKNPerCm2(21000)).toBeCloseTo(2.1e8, 2);
  });

  it('EI helyesen áll elő SI-ben: E=21000 kN/cm², I=1000 cm⁴ → 2100 kNm²', () => {
    const E = modulusFromKNPerCm2(21000) as number;
    const I = inertiaFromCm4(1000) as number;
    expect(E * I).toBeCloseTo(2100, 6);
  });

  it('eltolódás: 1 mm = 1e-3 m', () => {
    expect(lengthFromMm(1)).toBeCloseTo(1e-3, 15);
  });

  it('sűrűség → fajsúly: acél 7850 kg/m³ ≈ 76.98 kN/m³', () => {
    expect(specificWeightFromDensity(7850) as number).toBeCloseTo(76.98, 2);
  });

  it('vasbeton 2500 kg/m³ ≈ 24.52 kN/m³', () => {
    expect(specificWeightFromDensity(2500) as number).toBeCloseTo(24.52, 2);
  });
});

describe('units — oda-vissza konverzió veszteségmentes (property)', () => {
  it('terület', () => {
    fc.assert(
      fc.property(finite(), (v) => {
        expect(areaToCm2(areaFromCm2(v))).toBeCloseTo(v, 6);
      }),
    );
  });

  it('inercia', () => {
    fc.assert(
      fc.property(finite(), (v) => {
        expect(inertiaToCm4(inertiaFromCm4(v))).toBeCloseTo(v, 6);
      }),
    );
  });

  it('modulus', () => {
    fc.assert(
      fc.property(finite(), (v) => {
        expect(modulusToKNPerCm2(modulusFromKNPerCm2(v))).toBeCloseTo(v, 6);
      }),
    );
  });

  it('hossz', () => {
    fc.assert(
      fc.property(finite(), (v) => {
        expect(lengthToMm(lengthFromMm(v))).toBeCloseTo(v, 6);
      }),
    );
  });

  it('szög', () => {
    fc.assert(
      fc.property(fc.double({ min: -720, max: 720, noNaN: true }), (v) => {
        expect(radToDeg(degToRad(v))).toBeCloseTo(v, 9);
      }),
    );
  });

  it('sűrűség ↔ fajsúly', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e5, noNaN: true }), (v) => {
        expect(densityFromSpecificWeight(specificWeightFromDensity(v)) as number).toBeCloseTo(v, 6);
      }),
    );
  });
});
