import { beforeEach, describe, expect, it } from 'vitest';
import { PRESETS } from '../data/catalog.js';
import { presetToEditable, resetEntityIds } from './editable.js';
import { compileModel, solveEditableModel } from './compile.js';

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
});
