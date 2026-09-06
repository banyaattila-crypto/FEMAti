/**
 * P-05 — Kéttámaszú tartó, egyenletes q, határteher (MASTER-PROMPT-TERV 3.2
 * táblázat).
 *
 * Statikailag határozott: a középső keresztmetszetnél M = q·L²/8, egyetlen
 * képlékeny csukló elég a mechanizmushoz. Zárt alak: `qu = 8·Mp/L²`.
 */
import { buildModel, distributedForce, makeMaterial, makeSection, pinned, rect, runLoadStepper, uniformMesh } from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseP05(): ValidationCase {
  const material = makeMaterial('S1', 'Acél', { e: 2.1e8, sigmaY: 2.35e5, hPrime: 0 });
  const section = makeSection('R', 'Téglalap', rect(0.2, 0.4));
  const L = 4;
  const mp = (2.35e5 * (0.2 * 0.4 ** 2)) / 4;
  const qu = (8 * mp) / L ** 2;

  const elementCount = 32;
  const appliedQ = -1.3 * qu;
  const mesh = uniformMesh(L, elementCount, { sectionId: 'R', materialId: 'S1' });
  const endNode = `N${2 * elementCount}`;
  const model = buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [section],
    boundaries: [pinned('N0'), pinned(endNode)],
    loads: [distributedForce(0, L, appliedQ, appliedQ, 'Q1')],
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
  const computedQu = Math.abs(appliedQ) * reachedLambda;

  const checks: ValidationCheck[] = [
    {
      label: 'a teher-vezérelt eljárás a határteher közelében leáll',
      reference: 1,
      computed: result.status === 'limit-load-reached' ? 1 : 0,
      tolerance: 0,
      kind: 'absolute',
    },
    {
      label: 'qu = 8·Mp/L²',
      reference: qu,
      computed: computedQu,
      tolerance: 0.02,
      kind: 'relative',
    },
  ];

  return {
    id: 'P-05',
    title: 'Kéttámaszú tartó, egyenletes q — határteher',
    description: 'Statikailag határozott kéttámaszú tartó egyenletes megoszló teherrel, egyetlen ' + 'képlékeny csukló a középső keresztmetszetnél.',
    reference: 'MASTER-PROMPT-TERV 3.2 táblázat (P-05)',
    checks,
  };
}
