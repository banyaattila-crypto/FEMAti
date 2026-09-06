/**
 * V-09 — Támaszsüllyedés, kétnyílású (kéttámaszközös) folytatólagos tartó
 * (MASTER-PROMPT-TERV 3.1 táblázat).
 *
 * Két egyenlő (L hosszú) mezőből álló, három csuklós/görgős támaszú tartó
 * (x=0, x=L, x=2L), a KÖZÉPSŐ támasz δ értékkel süllyed, más teher nincs.
 * Erőmódszeres levezetés (a redundáns X_B a középső támasz reakciója):
 *
 *   Elsődleges szerkezet: egyetlen 2L hosszú, csak a két végén megtámasztott
 *   gerenda. A δ süllyedés kompatibilitása: X_B · f_BB = δ, ahol f_BB a 2L
 *   hosszú egyszerű tartó KÖZÉPRE ható egységerőből származó lehajlása
 *   (Timoshenko-formula, MEGEGYEZIK a codebase már tesztelt középre ható
 *   koncentrált teher képletével — ld. `packages/fem-core/test/solver.test.ts`
 *   „kéttámaszú tartó középen ható teherrel"):
 *     f_BB = (2L)³/(48·EI) + (2L)/(4·GAs) = L³/(6EI) + L/(2GAs)
 *
 *   ⇒ X_B = δ / f_BB                         (a középső reakció)
 *     R_A = R_C = −X_B / 2                    (statikai egyensúlyból, szimmetria)
 *     M(L) = X_B · (L/2)                      (a primér tartó középre ható
 *                                               egységteherből származó nyomatéka
 *                                               M_unit(L) = 1·(2L)/4 = L/2)
 *
 *   Ellenőrzés (határeset, nyírás nélkül, GAs→∞): X_B → 6EIδ/L³,
 *   M(L) → 3EIδ/L² — ez a klasszikus háromnyomatéki egyenlet jól ismert
 *   eredménye egyenlő mezőkre, egyetlen támaszsüllyedésre (magnitúdóban
 *   egyezik számos tankönyvi forrással).
 */
import { buildModel, makeMaterial, makeSection, pinned, rect, solveLinear, supportDisplacement, uniformMesh } from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseV09(): ValidationCase {
  const E = 2.1e8;
  const nu = 0.3;
  const G = E / (2 * (1 + nu));
  const b = 0.2;
  const h = 0.4;
  const area = b * h;
  const inertia = (b * h ** 3) / 12;
  const ei = E * inertia;
  const gas = (5 / 6) * G * area;

  const L = 5;
  const delta = 0.008; // m, a középső támasz süllyedése

  const fBB = L ** 3 / (6 * ei) + L / (2 * gas);
  const xB = delta / fBB;
  const rEnd = -xB / 2;

  const material = makeMaterial('S235', 'Acél S235', { e: E, sigmaY: 2.35e5 });
  const section = makeSection('R', 'Téglalap', rect(b, h));
  const mesh = uniformMesh(2 * L, 8, { sectionId: 'R', materialId: 'S235' });
  const midNodeId = `N${(mesh.nodes.length - 1) / 2}`; // 17 csomópont (8 elem) ⇒ közép index 8
  const lastNodeId = `N${mesh.nodes.length - 1}`;
  const model = buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [section],
    boundaries: [pinned('N0'), pinned(midNodeId), pinned(lastNodeId)],
    loads: [supportDisplacement(midNodeId, delta)],
  });

  const result = solveLinear(model);
  const rA = result.reactions.find((r) => r.nodeId === 'N0');
  const rB = result.reactions.find((r) => r.nodeId === midNodeId);
  const rC = result.reactions.find((r) => r.nodeId === lastNodeId);
  if (rA === undefined || rB === undefined || rC === undefined) {
    throw new Error('V-09: hiányzó reakció valamelyik támasznál.');
  }

  const checks: ValidationCheck[] = [
    { label: 'reakció a bal végtámasznál [kN]', reference: rEnd, computed: rA.fz, tolerance: 1e-6, kind: 'relative' },
    { label: 'reakció a jobb végtámasznál [kN]', reference: rEnd, computed: rC.fz, tolerance: 1e-6, kind: 'relative' },
    { label: 'reakció a középső (süllyedő) támasznál [kN]', reference: xB, computed: rB.fz, tolerance: 1e-6, kind: 'relative' },
    {
      label: 'globális egyensúly (reakciók összege, gépi pontosság)',
      reference: 0,
      computed: rA.fz + rB.fz + rC.fz,
      tolerance: 1e-9,
      kind: 'absolute',
    },
  ];

  return {
    id: 'V-09',
    title: 'Támaszsüllyedés, kétnyílású folytatólagos tartó',
    description: 'Erőmódszeres (kompatibilitási) zárt alak a középső támasz reakciójára és nyomatékára.',
    reference: 'Diplomaterv 3.1.6.5, 3.1.7; MASTER-PROMPT-TERV 3.1 táblázat',
    checks,
  };
}
