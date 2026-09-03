import { beforeEach, describe, expect, it } from 'vitest';
import { PRESETS } from '../data/catalog.js';
import { presetToEditable, resetEntityIds } from './editable.js';
import { solveEditableModel } from './compile.js';
import { scaleModelForSls, scaleModelForUls, ULS_GAMMA_Q } from './combinations.js';
import { computeUtilizations } from './designChecks.js';

beforeEach(() => resetEntityIds());

/** ULS+SLS eredménypár egyetlen modellre — a `computeUtilizations` valódi hívási mintája. */
function solveCombos(editable: ReturnType<typeof presetToEditable>) {
  const uls = solveEditableModel(scaleModelForUls(editable)).result;
  const sls = solveEditableModel(scaleModelForSls(editable)).result;
  if (uls === null || sls === null) throw new Error('mindkét kombinációnak meg kellett volna oldódnia');
  return { uls, sls };
}

describe('computeUtilizations', () => {
  it('a lehajlás-kihasználtság mindig számítható, és megegyezik a "governing" értékkel egyszerű acél gerendánál', () => {
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = presetToEditable(preset, 'simple', 6, 8, 'IPE300', 'S235', false, 'selective');

    const { uls, sls } = solveCombos(editable);
    const utils = computeUtilizations(editable, uls, sls);

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

    const smallCombos = solveCombos(small);
    const largeCombos = solveCombos(large);
    const smallUtil = computeUtilizations(small, smallCombos.uls, smallCombos.sls).governing;
    const largeUtil = computeUtilizations(large, largeCombos.uls, largeCombos.sls).governing;
    expect(smallUtil).not.toBeNull();
    expect(largeUtil).not.toBeNull();
    expect(smallUtil as number).toBeGreaterThan(largeUtil as number);
  });

  it('az ULS kombináció (γQ=1.5) a beírt (jellemző) teherhez képest nagyobb M-V kihasználtságot ad — a faktor ténylegesen érvényesül', () => {
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    // Minden teher a preset alapértelmezése szerint 'variable' (Q) — presetToEditable így jelöli.
    const editable = presetToEditable(preset, 'simple', 6, 8, 'IPE300', 'S235', false, 'selective');

    const characteristicResult = solveEditableModel(editable).result;
    const ulsResult = solveEditableModel(scaleModelForUls(editable)).result;
    if (characteristicResult === null || ulsResult === null) throw new Error('mindkét futásnak meg kellett volna oldódnia');

    expect(Math.abs(ulsResult.extremes.m.value)).toBeCloseTo(Math.abs(characteristicResult.extremes.m.value) * ULS_GAMMA_Q, 6);
  });

  it('kompozit keresztmetszeten az mv/rc "nem alkalmazható" (null), de a lehajlás-ellenőrzés továbbra is fut', () => {
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = {
      ...presetToEditable(preset, 'simple', 6, 8, 'RECT', 'S235', false, 'selective'),
      composite: { enabled: true, slabWidth: 1.0, slabThickness: 0.1, slabMaterialId: 'C25' },
    };

    const { uls, sls } = solveCombos(editable);
    const utils = computeUtilizations(editable, uls, sls);

    expect(utils.mv).toBeNull();
    expect(utils.rc).toBeNull();
    expect(utils.deflection).not.toBeNull();
    expect(utils.governing).toBe(utils.deflection);
  });
});
