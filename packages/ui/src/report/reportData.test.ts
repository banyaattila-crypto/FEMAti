import { beforeEach, describe, expect, it } from 'vitest';
import { PRESETS } from '../data/catalog.js';
import { presetToEditable, resetEntityIds } from '../model/editable.js';
import { runNonlinearEditableModel } from '../model/nonlinear.js';
import { buildHingeReport } from './reportData.js';

beforeEach(() => resetEntityIds());

const OPTIONS = {
  algorithm: 'newton' as const,
  tolerancePercent: 1e-3,
  initialSteps: 20,
  peakLambda: 30,
  unload: false,
};

describe('buildHingeReport', () => {
  it('minden bejegyzéshez a MEGFELELŐ lépés λ-ját és az elem x-koordinátáját rendeli', () => {
    const preset = PRESETS.find((p) => p.id === 'cantilever');
    if (preset === undefined) throw new Error('cantilever preset hiányzik');
    const editable = presetToEditable(preset, 'cantilever', 4, 8, 'RECT', 'S235', false, 'selective');
    const outcome = runNonlinearEditableModel(editable, OPTIONS);
    const run = outcome.run;
    if (run === null) throw new Error('nincs futási eredmény');

    const hinges = buildHingeReport(run);
    expect(hinges.length).toBeGreaterThan(0);

    // A step-index szerinti sorrend monoton nem csökkenő — az események
    // időrendben szerepelnek a jegyzőkönyvi táblázatban.
    for (let i = 1; i < hinges.length; i++) {
      expect(hinges[i]?.stepIndex).toBeGreaterThanOrEqual(hinges[i - 1]?.stepIndex ?? 0);
    }

    for (const h of hinges) {
      expect(h.xApprox).not.toBeNull();
      expect(h.xApprox ?? -1).toBeGreaterThanOrEqual(0);
      expect(h.xApprox ?? Infinity).toBeLessThanOrEqual(editable.span);
      // A λ MEGEGYEZIK az adott lépés (nem valamelyik szomszédos lépés) λ-jával.
      expect(h.lambda).toBeGreaterThan(0);
    }

    // A konzol befogásához legközelebbi elem folyik meg elsőként (a rugalmas
    // nyomaték ott a legnagyobb) — az első bejegyzés x-koordinátája a
    // fesztáv elejéhez essen közel.
    const first = hinges[0];
    expect(first?.xApprox ?? Infinity).toBeLessThan(editable.span / 2);
  });

  it('a "full-hinge" esemény sosem előzi meg a hozzá tartozó elem "first-yield" eseményét', () => {
    const preset = PRESETS.find((p) => p.id === 'cantilever');
    if (preset === undefined) throw new Error('cantilever preset hiányzik');
    const editable = presetToEditable(preset, 'cantilever', 4, 8, 'RECT', 'S235', false, 'selective');
    const outcome = runNonlinearEditableModel(editable, OPTIONS);
    const run = outcome.run;
    if (run === null) throw new Error('nincs futási eredmény');

    const hinges = buildHingeReport(run);
    const firstYieldStep = new Map<string, number>();
    for (const h of hinges) {
      if (h.kind === 'first-yield' && !firstYieldStep.has(h.elementId)) {
        firstYieldStep.set(h.elementId, h.stepIndex);
      }
    }
    for (const h of hinges) {
      if (h.kind !== 'full-hinge') continue;
      const yieldStep = firstYieldStep.get(h.elementId);
      expect(yieldStep).toBeDefined();
      expect(h.stepIndex).toBeGreaterThanOrEqual(yieldStep ?? Infinity);
    }
  });
});
