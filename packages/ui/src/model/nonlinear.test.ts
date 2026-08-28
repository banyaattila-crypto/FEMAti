import { beforeEach, describe, expect, it } from 'vitest';
import { PRESETS } from '../data/catalog.js';
import { presetToEditable, resetEntityIds } from './editable.js';
import {
  combinedSteps,
  computeHingeMarkers,
  elementPlasticity,
  nodalDisplacements,
  runNonlinearEditableModel,
} from './nonlinear.js';

beforeEach(() => resetEntityIds());

const OPTIONS = {
  algorithm: 'newton' as const,
  tolerancePercent: 1e-3,
  initialSteps: 10,
  peakLambda: 1.5,
  unload: false,
};

describe('runNonlinearEditableModel', () => {
  it('egy mérsékelt terhelésű presetre konvergál, réteges anyagadattal', () => {
    const preset = PRESETS.find((p) => p.id === 'simpleP');
    if (preset === undefined) throw new Error('simpleP preset hiányzik');
    // Kisebb teher, mint a katalógus alapértéke, hogy biztosan konvergáljon λ_cél-ig.
    const editable = { ...presetToEditable(preset, 'simpleP', 6, 8, 'IPE300', 'S235', false, 'selective'), loads: [] };
    const withLoad = { ...editable, loads: preset.p > 0 ? [{ id: 'P1', kind: 'point' as const, x: 3, p: 10 }] : [] };

    const outcome = runNonlinearEditableModel(withLoad, OPTIONS);
    expect(outcome.error).toBeNull();
    expect(outcome.run).not.toBeNull();
    if (outcome.run === null) return;

    expect(outcome.run.status).toBe('converged');
    expect(outcome.run.loadingSteps.length).toBeGreaterThan(0);
    const firstElementId = outcome.run.system.elements[0]?.id;
    if (firstElementId === undefined) throw new Error('nincs elem');
    const materialData = outcome.run.materialData.get(firstElementId);
    expect(materialData?.kind).toBe('layered');
  });

  it('túlterhelésnél "limit-load-reached" státuszt ad, nem dob kivételt', () => {
    const preset = PRESETS.find((p) => p.id === 'cantilever');
    if (preset === undefined) throw new Error('cantilever preset hiányzik');
    const editable = presetToEditable(preset, 'cantilever', 4, 8, 'RECT', 'S235', false, 'selective');
    // Nagy csúcs-teherszorzó — a konzol biztosan a folyás fölé jut.
    const outcome = runNonlinearEditableModel(editable, { ...OPTIONS, peakLambda: 30, initialSteps: 20 });
    expect(outcome.error).toBeNull();
    expect(outcome.run).not.toBeNull();
    expect(outcome.run?.status).toBe('limit-load-reached');
  });

  it('tehermentesítési módban a lépéssorozat λ=0-ig fut, és marad rétegenkénti feszültség', () => {
    const preset = PRESETS.find((p) => p.id === 'cantilever');
    if (preset === undefined) throw new Error('cantilever preset hiányzik');
    const editable = presetToEditable(preset, 'cantilever', 4, 8, 'RECT', 'S235', false, 'selective');
    const outcome = runNonlinearEditableModel(editable, { ...OPTIONS, peakLambda: 8, initialSteps: 10, unload: true });
    expect(outcome.error).toBeNull();
    const run = outcome.run;
    if (run === null) throw new Error('nincs futási eredmény');
    expect(run.unloadSteps.length).toBeGreaterThan(0);
    const lastUnload = run.unloadSteps.at(-1);
    expect(lastUnload?.lambda).toBeCloseTo(0, 6);

    const firstElementId = run.system.elements[0]?.id;
    if (firstElementId === undefined) throw new Error('nincs elem');
    const state = lastUnload?.states.get(firstElementId);
    const gp0 = state?.gaussPoints[0];
    if (gp0 === undefined || gp0.kind !== 'layered') throw new Error('nincs réteges Gauss-pont');
    const anyResidual = gp0.layers.some((l) => Math.abs(l.sigma) > 1);
    expect(anyResidual).toBe(true);
  });

  it('combinedSteps, elementPlasticity és computeHingeMarkers konzisztens eredményt adnak', () => {
    const preset = PRESETS.find((p) => p.id === 'cantilever');
    if (preset === undefined) throw new Error('cantilever preset hiányzik');
    const editable = presetToEditable(preset, 'cantilever', 4, 8, 'RECT', 'S235', false, 'selective');
    const outcome = runNonlinearEditableModel(editable, { ...OPTIONS, peakLambda: 30, initialSteps: 20 });
    const run = outcome.run;
    if (run === null) throw new Error('nincs futási eredmény');

    const steps = combinedSteps(run);
    expect(steps.length).toBe(run.loadingSteps.length + run.unloadSteps.length);

    const markers = computeHingeMarkers(run);
    expect(markers.length).toBeGreaterThan(0);
    expect(markers.some((m) => m.kind === 'first-yield')).toBe(true);

    const lastStep = steps.at(-1);
    if (lastStep === undefined) throw new Error('üres lépéssorozat');
    const fixedElementId = run.system.elements[0]?.id;
    if (fixedElementId === undefined) throw new Error('nincs elem');
    const kind = elementPlasticity(lastStep, fixedElementId);
    expect(['elastic', 'partial', 'plastic']).toContain(kind);
  });

  it('nodalDisplacements a teljes csomópontszámnak megfelelő listát ad, előírt DOF-oknál 0-val', () => {
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = presetToEditable(preset, 'simple', 6, 4, 'IPE300', 'S235', false, 'selective');
    const outcome = runNonlinearEditableModel(editable, OPTIONS);
    const run = outcome.run;
    if (run === null) throw new Error('nincs futási eredmény');
    const lastStep = run.loadingSteps.at(-1);
    if (lastStep === undefined) throw new Error('nincs lépés');
    const nodal = nodalDisplacements(run.system, lastStep.u);
    expect(nodal.length).toBe(run.system.map.nodeCount);
    // A bal (x=0) csuklós támasz w-je pontosan 0 (előírt DOF).
    const first = nodal[0];
    expect(first?.w).toBe(0);
  });
});
