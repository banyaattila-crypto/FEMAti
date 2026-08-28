/**
 * P-06 — Kétoldalt befogott tartó, egyenletes q, határteher
 * (MASTER-PROMPT-TERV 3.2 táblázat).
 *
 * Statikailag HATÁROZATLAN: a mechanizmushoz HÁROM képlékeny csukló kell
 * (mindkét befogásnál + a nyíláson belül) — ezek a diplomaterv-modellben
 * NEM egyszerre, hanem FOKOZATOSAN alakulnak ki (előbb a befogásoknál, ahol
 * a rugalmas nyomaték nagyobb, majd a nyílásban). Zárt alak: `qu = 16·Mp/L²`.
 */
import { buildModel, distributedForce, fixed, makeMaterial, makeSection, rect, runLoadStepper, uniformMesh } from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseP06(): ValidationCase {
  const material = makeMaterial('S1', 'Acél', { e: 2.1e8, sigmaY: 2.35e5, hPrime: 0 });
  const section = makeSection('R', 'Téglalap', rect(0.2, 0.4));
  const L = 4;
  const mp = (2.35e5 * (0.2 * 0.4 ** 2)) / 4;
  const qu = (16 * mp) / L ** 2;

  const elementCount = 64;
  const appliedQ = -1.3 * qu;
  const mesh = uniformMesh(L, elementCount, { sectionId: 'R', materialId: 'S1' });
  const endNode = `N${2 * elementCount}`;
  const model = buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [section],
    boundaries: [fixed('N0'), fixed(endNode)],
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
      label: 'qu = 16·Mp/L²',
      reference: qu,
      computed: computedQu,
      tolerance: 0.03,
      kind: 'relative',
    },
  ];

  return {
    id: 'P-06',
    title: 'Kétoldalt befogott tartó, egyenletes q — határteher',
    description:
      'Statikailag határozatlan (3 csuklós mechanizmus: mindkét befogás + a nyílás közepe), ' +
      'a csuklók fokozatosan alakulnak ki — előbb a befogásoknál.',
    reference: 'MASTER-PROMPT-TERV 3.2 táblázat (P-06)',
    checks,
  };
}
