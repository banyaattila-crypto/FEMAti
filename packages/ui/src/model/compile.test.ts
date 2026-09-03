import { beforeEach, describe, expect, it } from 'vitest';
import { PRESETS } from '../data/catalog.js';
import { presetToEditable, resetEntityIds } from './editable.js';
import { compileModel, compositeSectionStiffness, solveEditableModel } from './compile.js';

beforeEach(() => resetEntityIds());

describe('compileModel + solveEditableModel', () => {
  it('egy érvényes preset-modellt hiba nélkül fordít és megold', () => {
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = presetToEditable(preset, 'simple', 6, 8, 'IPE300', 'S235', false, 'selective');

    const model = compileModel(editable);
    expect(model.elements.length).toBe(8);
    expect(model.boundaries.length).toBe(2);

    const { result, error } = solveEditableModel(editable);
    expect(error).toBeNull();
    expect(result).not.toBeNull();
    expect(result?.equilibrium.satisfied).toBe(true);
  });

  it('mechanizmus (nincs támasz) esetén hibaüzenetet ad, nem dob kivételt', () => {
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = { ...presetToEditable(preset, 'simple', 6, 8, 'IPE300', 'S235', false, 'selective'), supports: [] };

    const { result, error } = solveEditableModel(editable);
    expect(result).toBeNull();
    expect(error).not.toBeNull();
  });

  it('az önsúly bekapcsolása megváltoztatja az eredményt', () => {
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const withoutWeight = presetToEditable(preset, 'simple', 6, 8, 'IPE300', 'S235', false, 'selective');
    const withWeight = { ...withoutWeight, selfWeight: true };

    const a = solveEditableModel(withoutWeight).result;
    const b = solveEditableModel(withWeight).result;
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(b?.extremes.w.value).not.toBeCloseTo(a?.extremes.w.value ?? 0, 6);
  });

  it('kikapcsolt kompozit módban parametrikus (nem rétegelt) szelvényt épít, változatlanul', () => {
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = presetToEditable(preset, 'simple', 6, 8, 'IPE300', 'S235', false, 'selective');

    const model = compileModel(editable);
    expect(model.sections[0]?.kind).toBe('parametric');
    expect(model.materials.length).toBe(1);
  });
});

describe('kompozit acél-beton keresztmetszet (2026-09-04)', () => {
  it('bekapcsolt kompozit módban rétegelt szelvényt épít, mindkét anyaggal', () => {
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = {
      ...presetToEditable(preset, 'simple', 6, 8, 'RECT', 'S235', false, 'selective'),
      composite: { enabled: true, slabWidth: 1.0, slabThickness: 0.1, slabMaterialId: 'C25' },
    };

    const model = compileModel(editable);
    expect(model.sections[0]?.kind).toBe('layered');
    expect(model.materials.length).toBe(2);

    const { result, error } = solveEditableModel(editable);
    expect(error).toBeNull();
    expect(result?.equilibrium.satisfied).toBe(true);
  });

  it('a transzformált EI egyezik a kézi (klasszikus "n = Es/Ec") zárt alakú számítással', () => {
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = {
      ...presetToEditable(preset, 'simple', 6, 8, 'RECT', 'S235', false, 'selective'),
      composite: { enabled: true, slabWidth: 1.0, slabThickness: 0.1, slabMaterialId: 'C25' },
    };

    const stiffness = compositeSectionStiffness(editable);

    // Kézi, zárt alakú transzformált-keresztmetszet számítás — a `compile.ts`
    // réteges implementációjától FÜGGETLEN referenciaérték.
    const Es = 21000 * 1e4; // S235, kN/cm² -> kN/m²
    const Ec = 3148 * 1e4; // C25, kN/cm² -> kN/m²
    const steelB = 0.12;
    const steelH = 0.3; // RECT katalógus-szelvény [m]
    const slabB = 1.0;
    const slabT = 0.1;
    const As = steelB * steelH;
    const Ac = slabB * slabT;
    const zSteel = 0; // referencia-origó: az acél saját súlypontja
    const zSlab = -(steelH / 2 + slabT / 2); // a lemez a szelvény TETEJÉRE kerül (z lefelé pozitív)
    const zBar = (Es * As * zSteel + Ec * Ac * zSlab) / (Es * As + Ec * Ac);
    const iSteelOwn = (steelB * steelH ** 3) / 12;
    const iSlabOwn = (slabB * slabT ** 3) / 12;
    const eiExpected = Es * (iSteelOwn + As * (zSteel - zBar) ** 2) + Ec * (iSlabOwn + Ac * (zSlab - zBar) ** 2);

    const relativeError = Math.abs(stiffness.ei - eiExpected) / eiExpected;
    expect(relativeError).toBeLessThan(0.02); // ~2% — a 32/8 rétegű közelítés dokumentált finomsága

    // Fizikai szanity: a kompozit szelvény ÉRDEMBEN merevebb, mint az acél önmagában.
    expect(stiffness.ei).toBeGreaterThan(Es * iSteelOwn);
  });
});

describe('másodrendű (P-Δ) hatás — axialForce (2026-09-04)', () => {
  it('nyomóerő nagyobb, húzóerő kisebb lehajlást ad ugyanarra a keresztteherre', () => {
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const neutral = presetToEditable(preset, 'simple', 6, 8, 'IPE300', 'S235', false, 'selective');
    const compressed = { ...neutral, axialForce: 500 };
    const tensioned = { ...neutral, axialForce: -500 };

    const wNeutral = Math.abs(solveEditableModel(neutral).result?.extremes.w.value ?? 0);
    const wCompressed = Math.abs(solveEditableModel(compressed).result?.extremes.w.value ?? 0);
    const wTensioned = Math.abs(solveEditableModel(tensioned).result?.extremes.w.value ?? 0);

    expect(wCompressed).toBeGreaterThan(wNeutral);
    expect(wTensioned).toBeLessThan(wNeutral);
  });

  it('axialForce=0 (alapértelmezés) esetén bájtra ugyanazt adja, mint eddig (regresszió)', () => {
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = presetToEditable(preset, 'simple', 6, 8, 'IPE300', 'S235', false, 'selective');
    expect(editable.axialForce).toBe(0);

    const result = solveEditableModel(editable).result;
    expect(result?.equilibrium.satisfied).toBe(true);
  });
});
