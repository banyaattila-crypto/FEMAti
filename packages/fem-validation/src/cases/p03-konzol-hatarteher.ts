/**
 * P-03 — Konzol, végponti P, határteher (MASTER-PROMPT-TERV 3.2 táblázat).
 *
 * Statikailag határozott: a befogásnál M = P·L, a szerkezet mechanizmussá
 * válik, amint ott M = Mp (egyetlen képlékeny csukló). Zárt alak: `Pu = Mp/L`.
 *
 * A számított határteher az UTOLSÓ KONVERGÁLT teherlépcső (MASTER-PROMPT-TERV
 * P12 prompt: "az utolsó konvergált teherlépcső") — a `runLoadStepper` Δλ-t
 * a `minStepFraction`-ig felezi, ezért ez tetszőlegesen közelít a valódi
 * határteherhez. A maradék eltérés diszkretizációs: a befogáshoz legközelebbi
 * Gauss-pont NEM pontosan a befogásnál van (a 3 pontos Gauss-séma miatt),
 * ezért a számított határteher kissé a zárt érték FÖLÉ esik — ez a
 * HIBATURESI-POLITIKA 4. pontja szerinti diszkretizációs hiba, a táblázat
 * szerinti 2%-os tűréssel.
 */
import { buildModel, fixed, makeMaterial, makeSection, nodalForce, rect, runLoadStepper, uniformMesh } from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseP03(): ValidationCase {
  const material = makeMaterial('S1', 'Acél', { e: 2.1e8, sigmaY: 2.35e5, hPrime: 0 });
  const section = makeSection('R', 'Téglalap', rect(0.2, 0.4));
  const L = 4;
  const mp = (2.35e5 * (0.2 * 0.4 ** 2)) / 4;
  const pu = mp / L;

  const elementCount = 32;
  const appliedForce = -1.3 * pu;
  const mesh = uniformMesh(L, elementCount, { sectionId: 'R', materialId: 'S1' });
  const tipNode = `N${2 * elementCount}`;
  const model = buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [section],
    boundaries: [fixed('N0')],
    loads: [nodalForce(tipNode, appliedForce, 'F1')],
  });

  const result = runLoadStepper(model, {
    algorithm: 'newton',
    iterMax: 30,
    iterMin: 3,
    tolerancePercent: 1e-4,
    initialSteps: 8,
    minStepFraction: 1 / 2048,
  });
  const reachedLambda = result.steps.at(-1)?.lambda ?? 0;
  const computedPu = Math.abs(appliedForce) * reachedLambda;

  const checks: ValidationCheck[] = [
    {
      label: 'a teher-vezérelt eljárás a határteher közelében leáll ("limit-load-reached")',
      reference: 1,
      computed: result.status === 'limit-load-reached' ? 1 : 0,
      tolerance: 0,
      kind: 'absolute',
    },
    {
      label: 'Pu = Mp/L',
      reference: pu,
      computed: computedPu,
      tolerance: 0.02,
      kind: 'relative',
    },
  ];

  return {
    id: 'P-03',
    title: 'Konzol, végponti P — határteher',
    description:
      'Statikailag határozott konzol, egyetlen képlékeny csukló a befogásnál. ' + 'A számított határteher az utolsó konvergált teherlépcsőből.',
    reference: 'MASTER-PROMPT-TERV 3.2 táblázat (P-03)',
    checks,
  };
}
