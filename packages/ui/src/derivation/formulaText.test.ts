import { describe, expect, it } from 'vitest';
import { deriveElementInternalForces, deriveElementLoadVector, deriveElementStiffness, solveLinear } from '@femati/fem-core';
import { PRESETS } from '../data/catalog.js';
import { presetToEditable, resetEntityIds } from '../model/editable.js';
import { compileLayeredModel } from '../model/nonlinear.js';
import {
  bendingGaussBlock,
  convergenceBlock,
  distributedLoadGaussBlock,
  extrapolationBlock,
  internalForceBlock,
  keDiagonalDemo,
  nodalLoadLine,
  shapeDerivativeLines,
  shapeFunctionLines,
  shearGaussBlock,
} from './formulaText.js';

describe('formulaText', () => {
  it('a képletsorok utolsó száma megegyezik a ténylegesen kiszámolt N/dN értékkel', () => {
    resetEntityIds();
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = presetToEditable(preset, 'simple', 6, 4, 'IPE300', 'S235', false, 'selective');
    const model = compileLayeredModel(editable);
    const elementId = model.elements[0]?.id as unknown as string;
    const derived = deriveElementStiffness(model, elementId);
    const gp = derived.bendingPoints[0];
    if (gp === undefined) throw new Error('nincs Gauss-pont');

    const nLines = shapeFunctionLines(gp.xi, gp.n);
    expect(nLines).toContain(gp.n[0].toFixed(4));
    expect(nLines).toContain(gp.n[1].toFixed(4));
    expect(nLines).toContain(gp.n[2].toFixed(4));

    const dnLines = shapeDerivativeLines(gp.xi, gp.dn);
    expect(dnLines).toContain(gp.dn[0].toFixed(4));

    const block = bendingGaussBlock(gp, 0, derived.stiffness.ei);
    expect(block).toContain('κ-sor');
    expect(block).toContain('Hajlítási hozzájárulás');

    const shearGp = derived.shearPoints[0];
    if (shearGp === undefined) throw new Error('nincs nyírási Gauss-pont');
    const shearBlock = shearGaussBlock(shearGp, 0, derived.stiffness.gas);
    expect(shearBlock).toContain('γ-sor');
  });

  it('a Kₑ[1,1] tagonkénti összege PONTOSAN a mátrix tényleges [1,1] elemét adja', () => {
    resetEntityIds();
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = presetToEditable(preset, 'simple', 6, 4, 'IPE300', 'S235', false, 'selective');
    const model = compileLayeredModel(editable);
    const elementId = model.elements[0]?.id as unknown as string;
    const derived = deriveElementStiffness(model, elementId);

    const keValue = derived.ke.get(1, 1);
    const text = keDiagonalDemo(derived.bendingPoints, derived.shearPoints, derived.stiffness.ei, derived.stiffness.gas, keValue);
    expect(text).toContain(keValue.toFixed(2));

    // A demo-ban számolt összegnek (a szöveg utolsó sorában szereplő "Összeg
    // = X" érték) numerikusan is meg kell egyeznie a valódi Kₑ[1,1]-gyel.
    const bendingSum = derived.bendingPoints.reduce((s, gp) => {
      const b = gp.bRows.kappa[1] ?? 0;
      return s + derived.stiffness.ei * gp.jacobian.detJ * gp.w * b * b;
    }, 0);
    const shearSum = derived.shearPoints.reduce((s, gp) => {
      const b = gp.bRows.gamma[1] ?? 0;
      return s + derived.stiffness.gas * gp.jacobian.detJ * gp.w * b * b;
    }, 0);
    expect(bendingSum + shearSum).toBeCloseTo(keValue, 6);
  });

  it('a terhervektor és igénybevétel-visszaszámítás szöveges blokkjai a mag SZÁMAIT tartalmazzák (5→6→7 pont)', () => {
    resetEntityIds();
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = presetToEditable(preset, 'simple', 6, 4, 'IPE300', 'S235', false, 'selective');
    const model = compileLayeredModel(editable);
    const elementId = model.elements[0]?.id as unknown as string;
    const derived = deriveElementStiffness(model, elementId);

    const loadDerivation = deriveElementLoadVector(model, elementId);
    if (loadDerivation === undefined) throw new Error('nincs elem');
    const distributed = loadDerivation.distributed[0];
    if (distributed === undefined) throw new Error('a "simple" preset megoszló terhet ad');
    const distGp = distributed.points[0];
    if (distGp === undefined) throw new Error('nincs Gauss-pont');
    const block = distributedLoadGaussBlock(distGp, 0, 'kN/m');
    expect(block).toContain(distGp.value.toFixed(3));

    expect(nodalLoadLine(0, 0, -12.5, 'kN')).toContain('-12.500');

    const linear = solveLinear(model);
    const internalForceDerivation = deriveElementInternalForces(model, elementId, linear.displacements);
    if (internalForceDerivation === undefined) throw new Error('nincs elem');
    const forceGp = internalForceDerivation.points[0];
    if (forceGp === undefined) throw new Error('nincs Gauss-pont');
    const forceBlock = internalForceBlock(
      0,
      forceGp.xi,
      forceGp.x,
      forceGp.bKappa,
      forceGp.bGamma,
      forceGp.kappa,
      forceGp.gamma,
      forceGp.m,
      forceGp.t,
      derived.stiffness.ei,
      derived.stiffness.gas,
      internalForceDerivation.kappa0,
    );
    expect(forceBlock).toContain(forceGp.m.toFixed(3));
    expect(forceBlock).toContain(forceGp.t.toFixed(3));
  });

  it('az extrapolációs és konvergencia-blokkok a helyes, kézzel ellenőrizhető számokat adják (6.3/7 pont)', () => {
    const xis: readonly [number, number, number] = [-0.7745966692414834, 0, 0.7745966692414834];
    const mValues: readonly [number, number, number] = [10.5, 22.3, 8.1];
    // ξ=0 extrapoláció triviálisan a középső Gauss-pont saját értéke.
    const midBlock = extrapolationBlock('M', mValues, xis, 0, 'ξ=0', 'kNm');
    expect(midBlock).toContain('22.300');

    const leftBlock = extrapolationBlock('M', mValues, xis, -1, 'ξ=-1', 'kNm');
    const weights = xis.map((xii, i) => {
      let w = 1;
      for (let j = 0; j < 3; j++) {
        if (j === i) continue;
        const xij = xis[j] ?? 0;
        w *= (-1 - xij) / (xii - xij);
      }
      return w;
    });
    const expected = weights.reduce((s, w, i) => s + w * (mValues[i] ?? 0), 0);
    expect(leftBlock).toContain(expected.toFixed(3));

    const convergedBlock = convergenceBlock(1.2e-6, 45.6, 2.6e-6, 1e-4, true);
    expect(convergedBlock).toContain('KONVERGÁLT');
    expect(convergedBlock).toContain((2.6e-6).toFixed(4));

    const notConvergedBlock = convergenceBlock(1.2e-3, 45.6, 2.63e-1, 1e-4, false);
    expect(notConvergedBlock).toContain('további iteráció szükséges');
  });
});
