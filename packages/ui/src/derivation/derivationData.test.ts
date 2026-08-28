import { beforeEach, describe, expect, it } from 'vitest';
import { PRESETS } from '../data/catalog.js';
import { presetToEditable, resetEntityIds } from '../model/editable.js';
import { runNonlinearEditableModel } from '../model/nonlinear.js';
import { buildDerivationData, pickDefaultPlasticSample, pickMaxMomentElement } from './derivationData.js';

beforeEach(() => resetEntityIds());

describe('buildDerivationData', () => {
  it('a kiválasztott elem a legnagyobb |M|-hez tartozik a saját lineáris megoldásban', () => {
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = presetToEditable(preset, 'simple', 6, 8, 'IPE300', 'S235', false, 'selective');
    const data = buildDerivationData(editable);

    expect(data.elementIds).toContain(data.defaultElementId);
    const check = pickMaxMomentElement(data.model, data.linear);
    expect(data.defaultElementId).toBe(check);

    // Kéttámaszú, egyenletes teher, PÁROS elemszám: az M max a fesztáv
    // KÖZEPÉN van, ami pontosan a két középső elem HATÁRÁRA esik — a
    // szimmetria miatt a két elem Gauss-ponti |M|-je (elméletileg) egyenlő,
    // a tényleges "nyertes" a lebegőpontos kerekítés whiskerén (pl. a
    // rétegszámtól függő EI-n) múlik. Ezért mindkét középső elem elfogadott,
    // nem csak az egyik önkényes convention szerinti.
    const midElementIndex = Math.floor(data.model.elements.length / 2) - 1;
    const midElementId = data.model.elements[midElementIndex]?.id as unknown as string;
    const midElementId2 = data.model.elements[midElementIndex + 1]?.id as unknown as string;
    expect([midElementId, midElementId2]).toContain(data.defaultElementId);
  });
});

describe('pickDefaultPlasticSample', () => {
  it('null-t ad, ha sehol nem folyt meg semmi (kis teher)', () => {
    const preset = PRESETS.find((p) => p.id === 'cantilever');
    if (preset === undefined) throw new Error('cantilever preset hiányzik');
    const editable = presetToEditable(preset, 'cantilever', 4, 8, 'RECT', 'S235', false, 'selective');
    const outcome = runNonlinearEditableModel(editable, {
      algorithm: 'newton',
      tolerancePercent: 1e-3,
      initialSteps: 10,
      peakLambda: 0.1,
      unload: false,
    });
    const run = outcome.run;
    if (run === null) throw new Error('nincs futási eredmény');
    expect(pickDefaultPlasticSample(run)).toBeNull();
  });

  it('egy VALÓS megfolyt réteget ad vissza nagy teherszorzónál', () => {
    const preset = PRESETS.find((p) => p.id === 'cantilever');
    if (preset === undefined) throw new Error('cantilever preset hiányzik');
    const editable = presetToEditable(preset, 'cantilever', 4, 8, 'RECT', 'S235', false, 'selective');
    const outcome = runNonlinearEditableModel(editable, {
      algorithm: 'newton',
      tolerancePercent: 1e-3,
      initialSteps: 20,
      peakLambda: 30,
      unload: false,
    });
    const run = outcome.run;
    if (run === null) throw new Error('nincs futási eredmény');
    const sample = pickDefaultPlasticSample(run);
    expect(sample).not.toBeNull();
    if (sample === null) return;

    const steps = [...run.loadingSteps, ...run.unloadSteps];
    const state = steps[sample.stepIndex]?.states.get(sample.elementId);
    const gp = state?.gaussPoints[sample.gaussIndex];
    if (gp === undefined || gp.kind !== 'layered') throw new Error('nincs réteges Gauss-pont');
    expect(gp.layers[sample.layerIndex]?.yielded).toBe(true);
  });
});
