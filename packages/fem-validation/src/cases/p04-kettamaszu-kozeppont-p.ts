/**
 * P-04 — Kéttámaszú tartó, középen P, határteher (MASTER-PROMPT-TERV 3.2
 * táblázat).
 *
 * Statikailag határozott: a középső csomópontnál M = P·L/4, egyetlen
 * képlékeny csukló elég a mechanizmushoz. Zárt alak: `Pu = 4·Mp/L`.
 */
import { buildModel, makeMaterial, makeSection, nodalForce, pinned, rect, runLoadStepper, uniformMesh } from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseP04(): ValidationCase {
  const material = makeMaterial('S1', 'Acél', { e: 2.1e8, sigmaY: 2.35e5, hPrime: 0 });
  const section = makeSection('R', 'Téglalap', rect(0.2, 0.4));
  const L = 4;
  const mp = (2.35e5 * (0.2 * 0.4 ** 2)) / 4;
  const pu = (4 * mp) / L;

  const elementCount = 32;
  const appliedForce = -1.3 * pu;
  const mesh = uniformMesh(L, elementCount, { sectionId: 'R', materialId: 'S1' });
  const midNode = `N${elementCount}`;
  const endNode = `N${2 * elementCount}`;
  const model = buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [section],
    boundaries: [pinned('N0'), pinned(endNode)],
    loads: [nodalForce(midNode, appliedForce, 'F1')],
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
      label: 'a teher-vezérelt eljárás a határteher közelében leáll',
      reference: 1,
      computed: result.status === 'limit-load-reached' ? 1 : 0,
      tolerance: 0,
      kind: 'absolute',
    },
    {
      label: 'Pu = 4·Mp/L',
      reference: pu,
      computed: computedPu,
      tolerance: 0.02,
      kind: 'relative',
    },
  ];

  return {
    id: 'P-04',
    title: 'Kéttámaszú tartó, középen P — határteher',
    description:
      'Statikailag határozott kéttámaszú tartó, egyetlen képlékeny csukló a teher alatt. ' +
      'A számított határteher az utolsó konvergált teherlépcsőből.',
    reference: 'MASTER-PROMPT-TERV 3.2 táblázat (P-04)',
    checks,
  };
}
