import { beforeEach, describe, expect, it } from 'vitest';
import { PRESETS } from '../data/catalog.js';
import { presetToEditable, resetEntityIds } from './editable.js';
import { solveEditableModel } from './compile.js';
import { computeUtilizations } from './designChecks.js';

beforeEach(() => resetEntityIds());

describe('computeUtilizations', () => {
  it('a lehajlás-kihasználtság mindig számítható, és megegyezik a "governing" értékkel egyszerű acél gerendánál', () => {
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = presetToEditable(preset, 'simple', 6, 8, 'IPE300', 'S235', false, 'selective');

    const { result } = solveEditableModel(editable);
    if (result === null) throw new Error('a modellnek meg kellett volna oldódnia');
    const utils = computeUtilizations(editable, result);

    expect(utils.deflection).not.toBeNull();
    expect(utils.mv).not.toBeNull();
    expect(utils.rc).toBeNull(); // acél, nincs bekapcsolt vasalás
    expect(utils.governing).toBe(Math.max(utils.mv as number, utils.deflection as number));
  });

  it('kisebb szelvényen ugyanannál a tehernél nagyobb a kihasználtság', () => {
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const small = presetToEditable(preset, 'simple', 6, 8, 'IPE100', 'S235', false, 'selective');
    const large = { ...small, sectionId: 'IPE300' };

    const smallResult = solveEditableModel(small).result;
    const largeResult = solveEditableModel(large).result;
    if (smallResult === null || largeResult === null) throw new Error('mindkét modellnek meg kellett volna oldódnia');

    const smallUtil = computeUtilizations(small, smallResult).governing;
    const largeUtil = computeUtilizations(large, largeResult).governing;
    expect(smallUtil).not.toBeNull();
    expect(largeUtil).not.toBeNull();
    expect(smallUtil as number).toBeGreaterThan(largeUtil as number);
  });
});
