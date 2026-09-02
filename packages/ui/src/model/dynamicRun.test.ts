import { describe, expect, it } from 'vitest';
import { PRESETS } from '../data/catalog.js';
import { presetToEditable, resetEntityIds } from './editable.js';
import { compileModel } from './compile.js';
import { solveLinear } from '@femati/fem-core';
import { DEFAULT_DYNAMIC_SETTINGS, runDynamicEditableModel, type DynamicSettings } from './dynamicRun.js';

resetEntityIds();

function cantileverModel() {
  const preset = PRESETS.find((p) => p.id === 'cantilever');
  if (preset === undefined) throw new Error('cantilever preset hiányzik a katalógusból');
  return presetToEditable(preset, 'cantilever', 4, 8, 'IPE300', 'S235', false, 'selective');
}

describe('runDynamicEditableModel', () => {
  it('lépcsőgerjesztésnél véges eredményt ad minden lépésre, és a referencia-csomópont érvényes', () => {
    const editable = cantileverModel();
    const settings: DynamicSettings = { ...DEFAULT_DYNAMIC_SETTINGS, steps: 100, dt: 0.005 };
    const outcome = runDynamicEditableModel(editable, settings);
    expect(outcome.error).toBeNull();
    expect(outcome.run).not.toBeNull();
    if (outcome.run === null) return;

    expect(outcome.run.result.steps.length).toBe(settings.steps + 1);
    expect(outcome.run.referenceNodeIndex).toBeGreaterThanOrEqual(0);
    expect(outcome.run.referenceNodeIndex).toBeLessThan(outcome.run.result.dofCount / 2);

    for (const step of outcome.run.result.steps) {
      for (const v of step.displacement) expect(Number.isFinite(v)).toBe(true);
      for (const v of step.velocity) expect(Number.isFinite(v)).toBe(true);
      for (const v of step.acceleration) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('csillapítatlan lépcsőgerjesztésnél a csúcs-lehajlás közelítőleg a statikus érték kétszerese (klasszikus lépés-válasz felnagyítás)', () => {
    const editable = { ...cantileverModel(), loads: [{ id: 'P1', kind: 'point' as const, x: 4, p: 20 }] };
    const model = compileModel(editable);
    const staticResult = solveLinear(model);
    const staticTipW = Math.abs(staticResult.extremes.w.value);

    const settings: DynamicSettings = { ...DEFAULT_DYNAMIC_SETTINGS, steps: 800, dt: 0.001, dampingAlpha: 0, dampingBeta: 0 };
    const outcome = runDynamicEditableModel(editable, settings);
    if (outcome.run === null) throw new Error('nincs futási eredmény');

    const refDof = 2 * outcome.run.referenceNodeIndex;
    const peakW = Math.max(...outcome.run.result.steps.map((s) => Math.abs(s.displacement[refDof] ?? 0)));

    // Az elmélet (csillapítatlan SDOF hirtelen ráterhelésnél) pontosan 2x-et
    // adna; egy folytonos gerenda diszkretizált első módusa csak KÖZELÍTI
    // ezt — tág, de érdemi (1.5x–2.5x) sávban ellenőrizzük.
    expect(peakW).toBeGreaterThan(1.5 * staticTipW);
    expect(peakW).toBeLessThan(2.5 * staticTipW);
  });

  it('a csillapítás ténylegesen csökkenti a válasz későbbi (beállt) ingását a csillapítatlan esethez képest', () => {
    const editable = { ...cantileverModel(), loads: [{ id: 'P1', kind: 'point' as const, x: 4, p: 20 }] };
    const baseSettings: DynamicSettings = { ...DEFAULT_DYNAMIC_SETTINGS, steps: 800, dt: 0.001 };

    const undamped = runDynamicEditableModel(editable, { ...baseSettings, dampingAlpha: 0, dampingBeta: 0 });
    const damped = runDynamicEditableModel(editable, { ...baseSettings, dampingAlpha: 2, dampingBeta: 0.01 });
    if (undamped.run === null || damped.run === null) throw new Error('nincs futási eredmény');

    const tailAmplitude = (steps: typeof undamped.run.result.steps, dof: number): number => {
      const tail = steps.slice(-100);
      const values = tail.map((s) => s.displacement[dof] ?? 0);
      return Math.max(...values) - Math.min(...values);
    };

    const refDof = 2 * undamped.run.referenceNodeIndex;
    const undampedTail = tailAmplitude(undamped.run.result.steps, refDof);
    const dampedTail = tailAmplitude(damped.run.result.steps, refDof);

    expect(dampedTail).toBeLessThan(undampedTail);
  });

  it('hibás (nem futtatható) modellnél hibaüzenetet ad, nem dob kivételt', () => {
    const editable = { ...cantileverModel(), supports: [] };
    const outcome = runDynamicEditableModel(editable, DEFAULT_DYNAMIC_SETTINGS);
    expect(outcome.run).toBeNull();
    expect(outcome.error).not.toBeNull();
  });
});
