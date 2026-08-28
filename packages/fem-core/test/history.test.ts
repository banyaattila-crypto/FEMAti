import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildModel,
  fixed,
  makeMaterial,
  makeSection,
  nodalForce,
  rect,
  resetLoadIds,
  solveLinear,
  uniformMesh,
} from '../src/index.js';
import { computeLoadHistory, displacementsAtStep } from '../src/post/history.js';

const MAT = makeMaterial('S235', 'Acél S235', { e: 2.1e8, sigmaY: 2.35e5 });
const SEC = makeSection('R', 'Téglalap', rect(0.2, 0.4));

beforeEach(() => resetLoadIds());

describe('computeLoadHistory', () => {
  it('lépésenként a solveLinear(scale=lambda) eredményét tárolja', () => {
    const mesh = uniformMesh(4, 2, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [MAT],
      sections: [SEC],
      boundaries: [fixed('N0')],
      loads: [nodalForce('N4', -10, 'F1')],
      history: { lambdaTargets: [0.5, 1.0], stepsPerTarget: 1 },
    });

    const history = computeLoadHistory(model);
    expect(history.lambdas).toEqual([0.5, 1.0]);
    expect(history.dofCount).toBe(model.nodes.length * 2);

    const half = solveLinear(model, { scale: 0.5 });
    const full = solveLinear(model, { scale: 1.0 });

    const step0 = displacementsAtStep(history, 0);
    const step1 = displacementsAtStep(history, 1);
    for (let i = 0; i < history.dofCount; i++) {
      expect(step0[i]).toBeCloseTo(half.displacements[i] ?? 0, 12);
      expect(step1[i]).toBeCloseTo(full.displacements[i] ?? 0, 12);
    }

    expect(history.extremeW[0]).toBeCloseTo(half.extremes.w.value, 12);
    expect(history.extremeW[1]).toBeCloseTo(full.extremes.w.value, 12);
  });

  it('a válasz lineáris a teherszorzóban: a 2× lambda 2× elmozdulást ad', () => {
    const mesh = uniformMesh(4, 2, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [MAT],
      sections: [SEC],
      boundaries: [fixed('N0')],
      loads: [nodalForce('N4', -10, 'F1')],
      history: { lambdaTargets: [0.5, 1.0], stepsPerTarget: 1 },
    });

    const history = computeLoadHistory(model);
    const step0 = displacementsAtStep(history, 0);
    const step1 = displacementsAtStep(history, 1);
    for (let i = 0; i < history.dofCount; i++) {
      expect(step1[i]).toBeCloseTo(2 * (step0[i] ?? 0), 10);
    }
  });

  it('displacementsAtStep nézetet ad vissza (subarray), nem másolatot', () => {
    const mesh = uniformMesh(2, 1, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [MAT],
      sections: [SEC],
      boundaries: [fixed('N0')],
      loads: [nodalForce('N2', -5, 'F1')],
      history: { lambdaTargets: [1.0], stepsPerTarget: 1 },
    });

    const history = computeLoadHistory(model);
    const view = displacementsAtStep(history, 0);
    expect(view.buffer).toBe(history.displacements.buffer);
  });
});
