/**
 * P-15 — Newton vs. módosított Newton (MASTER-PROMPT-TERV P11 prompt
 * "Elfogadás"; a diplomaterv lábjegyzete, 10. oldal).
 *
 * A két algoritmusnak UGYANAHHOZ a konvergált végállapothoz kell jutnia
 * (csak az iterációs/K_T-újraépítési profiljuk tér el) — a "modified-newton"
 * lépésenként LEGFELJEBB egyszer épít tangenciális merevségi mátrixot, a
 * teljes Newton minden (nem utolsó) iterációban.
 */
import {
  buildModel,
  fixed,
  makeMaterial,
  makeSection,
  nodalForce,
  rect,
  runLoadStepper,
  uniformMesh,
} from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseP15(): ValidationCase {
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
    loads: [nodalForce('N8', -0.9 * (mp / L), 'F1')],
  });

  const full = runLoadStepper(model, {
    algorithm: 'newton',
    iterMax: 30,
    iterMin: 3,
    tolerancePercent: 1e-4,
    initialSteps: 4,
  });
  const modified = runLoadStepper(model, {
    algorithm: 'modified-newton',
    iterMax: 60,
    iterMin: 3,
    tolerancePercent: 1e-4,
    initialSteps: 4,
  });

  const fullTipW = full.steps.at(-1)?.u.at(-2) ?? 0;
  const modifiedTipW = modified.steps.at(-1)?.u.at(-2) ?? 0;

  const fullRebuilds = full.steps.flatMap((s) => s.iterations).filter((it) => it.stiffnessRebuilt).length;
  const modifiedRebuilds = modified.steps.flatMap((s) => s.iterations).filter((it) => it.stiffnessRebuilt).length;

  const checks: ValidationCheck[] = [
    {
      label: 'teljes Newton konvergál',
      reference: 1,
      computed: full.status === 'converged' ? 1 : 0,
      tolerance: 0,
      kind: 'absolute',
    },
    {
      label: 'módosított Newton konvergál',
      reference: 1,
      computed: modified.status === 'converged' ? 1 : 0,
      tolerance: 0,
      kind: 'absolute',
    },
    {
      label: 'a végponti lehajlás a két algoritmusnál egyezik',
      reference: fullTipW,
      computed: modifiedTipW,
      tolerance: 1e-3,
      kind: 'relative',
    },
    {
      label: 'a módosított Newton lépésenként LEGFELJEBB egyszer épít K_T-t',
      reference: modified.steps.length,
      computed: modifiedRebuilds,
      tolerance: 0,
      kind: 'range',
      range: { min: 0, max: modified.steps.length },
    },
    {
      label: 'a módosított Newton SOSEM épít több K_T-t, mint a teljes Newton',
      reference: fullRebuilds,
      computed: modifiedRebuilds,
      tolerance: 0,
      kind: 'range',
      range: { min: 0, max: fullRebuilds },
    },
  ];

  return {
    id: 'P-15',
    title: 'Newton vs. módosított Newton',
    description:
      'A teljes és a módosított Newton–Raphson ugyanahhoz a végállapothoz konvergál, ' +
      'de a módosított séma lépésenként legfeljebb egyszer építi újra a tangenciális merevségi mátrixot.',
    reference: 'MASTER-PROMPT-TERV P11 prompt, "Elfogadás" (P-15); diplomaterv lábjegyzet, 10. oldal',
    checks,
  };
}
