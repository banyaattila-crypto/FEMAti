/**
 * P-16 — Reziduum-monotonitás (MASTER-PROMPT-TERV P11 prompt "Elfogadás").
 *
 * Teljes Newton–Raphson mellett egy KÉPLÉKENY teherlépcsőn belül a reziduum
 * MONOTON csökken iterációról iterációra (docs/HIBATURESI-POLITIKA.md
 * 5. pont: "a megoldónak a konvergencia rendjét is naplóznia kell"). Ha a
 * tangenciális merevségi mátrix hibás, ez a monotonitás jellemzően megtörik.
 */
import { buildModel, fixed, makeMaterial, makeSection, nodalForce, rect, runLoadStepper, uniformMesh } from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseP16(): ValidationCase {
  const material = makeMaterial('S1', 'Acél', { e: 2.1e8, sigmaY: 2.35e5, hPrime: 5e7 });
  const section = makeSection('R', 'Téglalap', rect(0.2, 0.4));
  const L = 4;
  const mp = (2.35e5 * (0.2 * 0.4 ** 2)) / 4;
  const mesh = uniformMesh(L, 4, { sectionId: 'R', materialId: 'S1' });
  const model = buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [section],
    boundaries: [fixed('N0')],
    loads: [nodalForce('N8', -1.1 * (mp / L), 'F1')],
  });

  const result = runLoadStepper(model, {
    algorithm: 'newton',
    iterMax: 30,
    iterMin: 3,
    tolerancePercent: 1e-4,
    initialSteps: 3,
  });

  const plasticStep = result.steps.find((s) => s.iterations.length > 2);
  const violations = plasticStep
    ? plasticStep.iterations.slice(1).reduce((count, cur, i) => {
        const prev = plasticStep.iterations[i];
        return prev !== undefined && cur.residualPercent >= prev.residualPercent ? count + 1 : count;
      }, 0)
    : Number.NaN;

  const checks: ValidationCheck[] = [
    {
      label: 'a futás konvergál',
      reference: 1,
      computed: result.status === 'converged' ? 1 : 0,
      tolerance: 0,
      kind: 'absolute',
    },
    {
      label: 'van legalább egy többiterációs (képlékeny) lépés a futásban',
      reference: 1,
      computed: plasticStep !== undefined ? 1 : 0,
      tolerance: 0,
      kind: 'absolute',
    },
    {
      label: 'a reziduum monoton csökken a képlékeny lépésen belül (0 megszegés)',
      reference: 0,
      computed: violations,
      tolerance: 0,
      kind: 'absolute',
    },
  ];

  return {
    id: 'P-16',
    title: 'Reziduum-monotonitás teljes Newtonnál',
    description:
      'Egy képlékeny teherlépcsőn belül a reziduum-mérőszám (CONUND) iterációról ' +
      'iterációra monoton csökken — a helyes tangenciális merevségi mátrix jele.',
    reference: 'MASTER-PROMPT-TERV P11 prompt, "Elfogadás" (P-16); HIBATURESI-POLITIKA.md 5. pont',
    checks,
  };
}
