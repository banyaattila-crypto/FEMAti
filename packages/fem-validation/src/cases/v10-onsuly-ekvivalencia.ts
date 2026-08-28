/**
 * V-10 — Önsúly = ekvivalens megoszló teher, két úton azonos (MASTER-PROMPT-TERV
 * 3.1 táblázat).
 *
 * Az önsúly (`selfWeight`) belsőleg egy `p_z = γsúly·A` intenzitású, a teljes
 * hosszra kiterjedő egyenletesen megoszló teherré redukálódik. Ez a validációs
 * eset EGY MÁSIK, FÜGGETLENÜL megadott `distributedForce`-szal (ugyanazzal a
 * `p_z` intenzitással) hasonlítja össze a TELJES megoldást (nem csak a
 * tehervektort, ld. `packages/fem-core/test/assembly.test.ts` P5 önsúly
 * tesztjeit) — ha a két modell eltérő eredményt adna, az önsúly redukciója
 * hibás lenne, függetlenül attól, hogy a tehervektor-szintű teszt zöld.
 */
import {
  buildModel,
  distributedForce,
  fixed,
  makeMaterial,
  makeSection,
  rect,
  sectionStiffness,
  selfWeight,
  solveLinear,
  uniformMesh,
} from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseV10(): ValidationCase {
  const material = makeMaterial('C25/30', 'Vasbeton', { e: 3.1e7, density: 2500, sigmaY: 2.5e4 });
  const section = makeSection('R', 'Téglalap', rect(0.3, 0.5));
  const L = 5;

  const mesh = uniformMesh(L, 4, { sectionId: 'R', materialId: material.id as string });
  const base = {
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [section],
    boundaries: [fixed('N0')],
  };

  const withSelfWeight = solveLinear(buildModel({ ...base, loads: [selfWeight(1, 'G1')] }));

  const stiffness = sectionStiffness(section, material);
  const pz = (material.gamma as number) * stiffness.area;
  const withEquivalent = solveLinear(buildModel({ ...base, loads: [distributedForce(0, L, pz, pz, 'QEQ')] }));

  const checks: ValidationCheck[] = [];
  for (let i = 0; i < withSelfWeight.nodes.length; i++) {
    const a = withSelfWeight.nodes[i];
    const b = withEquivalent.nodes[i];
    if (a === undefined || b === undefined) continue;
    checks.push({
      label: `w a(z) "${a.nodeId}" csomópontban [m]`,
      reference: b.w,
      computed: a.w,
      tolerance: 1e-10,
      kind: 'relative',
    });
    checks.push({
      label: `φ a(z) "${a.nodeId}" csomópontban [rad]`,
      reference: b.phi,
      computed: a.phi,
      tolerance: 1e-10,
      kind: 'relative',
    });
  }
  checks.push({
    label: 'befogási reakció (Fz) [kN]',
    reference: withEquivalent.reactions[0]?.fz ?? 0,
    computed: withSelfWeight.reactions[0]?.fz ?? 0,
    tolerance: 1e-10,
    kind: 'relative',
  });

  return {
    id: 'V-10',
    title: 'Önsúly = ekvivalens megoszló teher',
    description: 'A selfWeight és egy azonos p_z intenzitású distributedForce TELJES megoldása egyezik.',
    reference: 'Diplomaterv (3.23); MASTER-PROMPT-TERV 3.1 táblázat',
    checks,
  };
}
