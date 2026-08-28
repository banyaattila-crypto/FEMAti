import { describe, expect, it } from 'vitest';
import katex from 'katex';
import { deriveElementInternalForces, deriveElementLoadVector, deriveElementMass, deriveElementStiffness, solveLinear } from '@femati/fem-core';
import { PRESETS } from '../data/catalog.js';
import { presetToEditable, resetEntityIds } from '../model/editable.js';
import { compileLayeredModel } from '../model/nonlinear.js';
import {
  bendingGaussTex,
  convergenceTex,
  distributedLoadGaussTex,
  extrapolationTex,
  jacobianTex,
  keDiagonalTex,
  massDiagonalTex,
  massGaussTex,
  meMpTex,
  nodalLoadTex,
  shearGaussTex,
  thermalLoadGaussTex,
} from './formulaLatex.js';

function renderAll(lines: readonly string[]): void {
  for (const tex of lines) {
    // throwOnError:true — egy szintaktikailag hibás LaTeX-sor itt buknia kell.
    expect(() => katex.renderToString(tex, { throwOnError: true, strict: 'ignore' })).not.toThrow();
  }
}

describe('formulaLatex', () => {
  it('minden generált LaTeX-sor érvényes KaTeX-szintaxis, és a végső szám szerepel benne', () => {
    resetEntityIds();
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = presetToEditable(preset, 'simple', 6, 4, 'IPE300', 'S235', false, 'selective');
    const model = compileLayeredModel(editable);
    const elementId = model.elements[0]?.id as unknown as string;
    const derived = deriveElementStiffness(model, elementId);

    const bendingGp = derived.bendingPoints[0];
    const shearGp = derived.shearPoints[0];
    if (bendingGp === undefined || shearGp === undefined) throw new Error('nincs Gauss-pont');

    const bendingLines = bendingGaussTex(bendingGp, 0, derived.stiffness.ei);
    renderAll(bendingLines);
    expect(bendingLines.join('\n')).toContain(bendingGp.n[0].toFixed(4));

    const shearLines = shearGaussTex(shearGp, 0, derived.stiffness.gas);
    renderAll(shearLines);

    const jacLines = jacobianTex(bendingGp.dn, derived.nodeX, bendingGp.jacobian.j, bendingGp.jacobian.invJ);
    renderAll(jacLines);

    const keValue = derived.ke.get(1, 1);
    const keLines = keDiagonalTex(derived.bendingPoints, derived.shearPoints, derived.stiffness.ei, derived.stiffness.gas, keValue);
    renderAll(keLines);
    expect(keLines.at(-1)).toContain(keValue.toFixed(2));

    const meMpLines = meMpTex(23.5, 800, 900, 188, 211.5, 1.125);
    renderAll(meMpLines);

    const loadDerivation = deriveElementLoadVector(model, elementId);
    if (loadDerivation === undefined) throw new Error('nincs elem');
    const distributed = loadDerivation.distributed[0];
    if (distributed === undefined) throw new Error('a "simple" preset megoszló terhet ad — ennek jelen kell lennie');
    const distGp = distributed.points[0];
    if (distGp === undefined) throw new Error('nincs Gauss-pont a megoszló teherhez');
    renderAll(distributedLoadGaussTex(distGp, 0, '\\text{kN/m}'));

    renderAll(nodalLoadTex(0, 0, -12.5, '\\text{kN}'));

    const linear = solveLinear(model);
    const internalForceDerivation = deriveElementInternalForces(model, elementId, linear.displacements);
    if (internalForceDerivation === undefined) throw new Error('nincs elem');
    const forceGp = internalForceDerivation.points[0];
    if (forceGp === undefined) throw new Error('nincs Gauss-pont');
    renderAll(
      thermalLoadGaussTex(
        { xi: forceGp.xi, w: 1, detJ: 1, bKappa: forceGp.bKappa, contribution: [0, 0, 0, 0, 0, 0] },
        0,
        derived.stiffness.ei,
        1e-4,
      ),
    );

    const xis: readonly [number, number, number] = [
      derived.bendingPoints[0]?.xi ?? 0,
      derived.bendingPoints[1]?.xi ?? 0,
      derived.bendingPoints[2]?.xi ?? 0,
    ];
    const mValues: readonly [number, number, number] = [10.5, 22.3, 8.1];
    const extrapLines = extrapolationTex('M', mValues, xis, -1, '\\xi{=}{-}1', '\\text{kNm}');
    renderAll(extrapLines);
    // A ξ=−1 extrapoláció zárt alakja L1=1, L2=0, L3=0 helyett a valódi
    // (nem ekvidisztáns GAUSS_3) súlyokkal számol — igazoljuk, hogy a
    // behelyettesített eredmény megegyezik a kézzel számolt Lagrange-
    // interpolációval.
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
    expect(extrapLines.at(-1)).toContain(expected.toFixed(3));

    renderAll(convergenceTex(1.2e-3, 45.6, 0.00263, 1e-4, false));
  });

  it('a tömegmátrix-levezetés (ADR-0016) LaTeX-sorai is érvényes szintaxisúak, és a végső Mₑ-értéket tartalmazzák', () => {
    resetEntityIds();
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = presetToEditable(preset, 'simple', 6, 4, 'IPE300', 'S235', false, 'selective');
    const model = compileLayeredModel(editable);
    const elementId = model.elements[0]?.id as unknown as string;
    const massDerived = deriveElementMass(model, elementId);

    const gp0 = massDerived.points[0];
    if (gp0 === undefined) throw new Error('nincs Gauss-pont');
    const gaussLines = massGaussTex(gp0, 0, massDerived.mass.massPerLength, massDerived.mass.rotaryInertiaPerLength);
    renderAll(gaussLines);
    expect(gaussLines.join('\n')).toContain(gp0.n[0].toFixed(4));

    const meW = massDerived.me.get(0, 0);
    const mePhi = massDerived.me.get(1, 1);
    const diagLines = massDiagonalTex(massDerived.points, massDerived.mass.massPerLength, massDerived.mass.rotaryInertiaPerLength, meW, mePhi);
    renderAll(diagLines);
    // A w-blokk összegző sorának tartalmaznia kell a tényleges Mₑ[0,0] négy tizedesjegyre kerekített értékét.
    const wSumLine = diagLines.find((l) => l.startsWith('\\sum') && l.includes('M_e[1,1]'));
    expect(wSumLine).toContain(meW.toFixed(4));
    // A φ-blokk összegző sorának (az utolsó sor) tartalmaznia kell a tényleges Mₑ[1,1] hat tizedesjegyre kerekített értékét.
    expect(diagLines.at(-1)).toContain(mePhi.toFixed(6));
  });
});
