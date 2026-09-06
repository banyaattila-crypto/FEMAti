/**
 * P-14 — Teherlépcső-függetlenség (MASTER-PROMPT-TERV P11 prompt "Elfogadás").
 *
 * MONOTON terhelésnél (nincs tehermentesítés a futás alatt) a rétegenkénti/
 * igénybevétel-szintű radial-return anyagmodell (P9/P10) az adott VÉGSŐ κ-hoz
 * tartozó M-et a TERHELÉSI ÚTTÓL FÜGGETLENÜL, egyértelműen adja vissza — a
 * folyási felület csak egy irányban tágul, nincs útfüggő elágazás. Ezért a
 * λ=1-nél kapott végállapotnak a kezdeti lépésszámtól (2 vagy 20 lépés)
 * GYAKORLATILAG függetlennek kell lennie — csak a Newton-tolerancia szintjén
 * térhet el.
 */
import { buildModel, fixed, makeMaterial, makeSection, nodalForce, rect, runLoadStepper, uniformMesh } from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseP14(): ValidationCase {
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

  const commonOptions = { algorithm: 'newton' as const, iterMax: 30, iterMin: 3, tolerancePercent: 1e-4 };
  const coarse = runLoadStepper(model, { ...commonOptions, initialSteps: 2 });
  const fine = runLoadStepper(model, { ...commonOptions, initialSteps: 20 });

  const coarseTipW = coarse.steps.at(-1)?.u.at(-2) ?? 0;
  const fineTipW = fine.steps.at(-1)?.u.at(-2) ?? 0;

  const checks: ValidationCheck[] = [
    {
      label: 'mindkét lépésszám konvergál λ=1-ig (2 lépés)',
      reference: 1,
      computed: coarse.status === 'converged' ? 1 : 0,
      tolerance: 0,
      kind: 'absolute',
    },
    {
      label: 'mindkét lépésszám konvergál λ=1-ig (20 lépés)',
      reference: 1,
      computed: fine.status === 'converged' ? 1 : 0,
      tolerance: 0,
      kind: 'absolute',
    },
    {
      label: 'a végponti lehajlás lépésszám-független (2 vs. 20 lépés)',
      reference: fineTipW,
      computed: coarseTipW,
      tolerance: 1e-4,
      kind: 'relative',
    },
  ];

  return {
    id: 'P-14',
    title: 'Teherlépcső-függetlenség',
    description:
      'Monoton terhelésnél a végállapot (λ=1) gyakorlatilag független a kezdeti ' +
      'lépésszámtól (2 vs. 20 lépés) — a radial-return anyagmodell útfüggetlensége.',
    reference: 'MASTER-PROMPT-TERV P11 prompt, "Elfogadás" (P-14)',
    checks,
  };
}
