import { beforeEach, describe, expect, it } from 'vitest';
import { PRESETS } from '../data/catalog.js';
import { presetToEditable, resetEntityIds } from './editable.js';
import { scaleModelForSls, scaleModelForUls, scaleModelForUlsVariants, ULS_GAMMA_G, ULS_GAMMA_Q, ULS_PSI0 } from './combinations.js';

beforeEach(() => resetEntityIds());

/** Egy megoszló (állandó) és egy pontteher (esetleges) — hogy a két kategória eltérő skálázása ellenőrizhető legyen. */
function baseModel() {
  const preset = PRESETS.find((p) => p.id === 'simple');
  if (preset === undefined) throw new Error('simple preset hiányzik');
  const model = presetToEditable(preset, 'simple', 6, 8, 'IPE300', 'S235', true, 'selective');
  const loads = [
    { id: 'Q1', kind: 'distributed' as const, x1: 0, x2: model.span, q1: 20, q2: 20, category: 'permanent' as const },
    { id: 'P1', kind: 'point' as const, x: model.span / 2, p: 15, category: 'variable' as const },
  ];
  return { ...model, loads, thermalLoad: { enabled: true, tRef: 10, tTop: 30, tBottom: -5 } };
}

describe('scaleModelForUls', () => {
  it('a "permanent" terhet γG-vel, a "variable" terhet γQ-val skálázza', () => {
    const model = baseModel();
    const scaled = scaleModelForUls(model);

    const permanentBefore = model.loads[0];
    const permanentAfter = scaled.loads[0];
    if (permanentBefore?.kind !== 'distributed' || permanentAfter?.kind !== 'distributed') {
      throw new Error('az első tehernek megoszló terhernek kell lennie');
    }
    expect(permanentAfter.q1).toBeCloseTo(permanentBefore.q1 * ULS_GAMMA_G, 9);

    const variableBefore = model.loads[1];
    const variableAfter = scaled.loads[1];
    if (variableBefore?.kind !== 'point' || variableAfter?.kind !== 'point') {
      throw new Error('a második tehernek pontteherének kell lennie');
    }
    expect(variableAfter.p).toBeCloseTo(variableBefore.p * ULS_GAMMA_Q, 9);
  });

  it('a hőterhet változatlanul hagyja', () => {
    const model = baseModel();
    const scaled = scaleModelForUls(model);
    expect(scaled.thermalLoad).toEqual(model.thermalLoad);
  });

  it('az önsúly-szorzót γG-re állítja', () => {
    const model = baseModel();
    expect(scaleModelForUls(model).selfWeightFactor).toBe(ULS_GAMMA_G);
  });
});

describe('scaleModelForUlsVariants', () => {
  it('0 vagy 1 db változó teherre egyetlen változatot ad, ami megegyezik a scaleModelForUls eredményével', () => {
    const model = baseModel(); // 1 db permanent + 1 db variable
    const variants = scaleModelForUlsVariants(model);
    expect(variants).toEqual([scaleModelForUls(model)]);
  });

  it('2 db változó teherre 2 változatot ad, mindegyikben pontosan egy teher kapja a teljes γQ-t, a többi γQ·ψ₀-t', () => {
    const model = baseModel();
    const secondVariable = { id: 'P2', kind: 'point' as const, x: model.span / 4, p: 10, category: 'variable' as const };
    const twoVariable = { ...model, loads: [...model.loads, secondVariable] };

    const variants = scaleModelForUlsVariants(twoVariable);
    expect(variants).toHaveLength(2);

    for (const variant of variants) {
      const p1 = variant.loads[1];
      const p2 = variant.loads[2];
      if (p1?.kind !== 'point' || p2?.kind !== 'point') throw new Error('a 2. és 3. teher pontteher kell legyen');
      const scaledByFullGammaQ = [p1.p, p2.p].filter((v) => Math.abs(v - 15 * ULS_GAMMA_Q) < 1e-9 || Math.abs(v - 10 * ULS_GAMMA_Q) < 1e-9);
      const scaledByPsi0 = [p1.p, p2.p].filter(
        (v) => Math.abs(v - 15 * ULS_GAMMA_Q * ULS_PSI0) < 1e-9 || Math.abs(v - 10 * ULS_GAMMA_Q * ULS_PSI0) < 1e-9,
      );
      expect(scaledByFullGammaQ).toHaveLength(1);
      expect(scaledByPsi0).toHaveLength(1);
    }
  });
});

describe('scaleModelForSls', () => {
  it('identitás — a terhek nem változnak, az önsúly-szorzó 1', () => {
    const model = baseModel();
    const scaled = scaleModelForSls(model);
    expect(scaled.loads).toEqual(model.loads);
    expect(scaled.selfWeightFactor).toBe(1);
  });
});
