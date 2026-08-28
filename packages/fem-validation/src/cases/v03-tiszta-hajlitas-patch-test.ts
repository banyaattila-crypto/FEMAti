/**
 * V-03 — Tiszta hajlítás patch-test (MASTER-PROMPT-TERV 3.1 táblázat).
 *
 * Konzol, befogva x=0-nál, koncentrált végnyomatékkal terhelve: a nyíróerő
 * MINDENÜTT zérus, a nyomaték M(x) = M0 állandó, ezért κ(x) = M0/EI is
 * állandó, φ(x) = M0·x/EI pontosan lineáris. Ez a klasszikus "patch test":
 * a végeselem-térnek tartalmaznia kell egy állandó görbületi állapotot
 * hibamentesen — ha nem, az az alakfüggvények vagy a B-mátrix hibája.
 *
 * Tűrés: gépi pontosság (1e−12), mert az állapot egzaktul benne van az
 * elem interpolációs terében.
 */
import {
  buildModel,
  fixed,
  makeMaterial,
  makeSection,
  nodalMoment,
  rect,
  solveLinear,
  uniformMesh,
  type LinearResult,
} from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseV03(): ValidationCase {
  const E = 2.1e8;
  const b = 0.2;
  const h = 0.4;
  const inertia = (b * h ** 3) / 12;
  const ei = E * inertia;

  const L = 4;
  const M0 = 20;

  const material = makeMaterial('S235', 'Acél S235', { e: E, sigmaY: 2.35e5 });
  const section = makeSection('R', 'Téglalap', rect(b, h));
  const mesh = uniformMesh(L, 4, { sectionId: 'R', materialId: 'S235' });
  const model = buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [section],
    boundaries: [fixed('N0')],
    loads: [nodalMoment(`N${mesh.nodes.length - 1}`, M0, 'M1')],
  });

  const result: LinearResult = solveLinear(model);

  const checks: ValidationCheck[] = [];

  // κ állandó = M0/EI minden Gauss-pontban, minden elemben.
  const kappaRef = M0 / ei;
  for (const el of result.elements) {
    for (const gp of el.gaussPoints) {
      checks.push({
        label: `κ a(z) "${el.elementId}" elem x=${gp.x.toFixed(3)} pontjában [1/m]`,
        reference: kappaRef,
        computed: gp.kappa,
        tolerance: 1e-12,
        kind: 'relative',
      });
      checks.push({
        label: `T (nyíróerő) a(z) "${el.elementId}" elem x=${gp.x.toFixed(3)} pontjában [kN]`,
        reference: 0,
        computed: gp.t,
        tolerance: 1e-9 * Math.abs(M0 / L),
        kind: 'absolute',
      });
    }
  }

  // φ(x) = M0·x/EI pontosan lineáris minden csomópontban.
  for (const n of result.nodes) {
    checks.push({
      label: `φ a(z) "${n.nodeId}" csomópontban (x=${n.x} m) [rad]`,
      reference: (M0 * n.x) / ei,
      computed: n.phi,
      tolerance: 1e-11,
      kind: 'relative',
    });
  }

  return {
    id: 'V-03',
    title: 'Tiszta hajlítás patch-test',
    description: 'Konstans M → konstans κ, lineáris φ, nulla nyíróerő — mindenütt egzakt.',
    reference: 'Diplomaterv (3.30)–(3.31), 45. oldal; MASTER-PROMPT-TERV 3.1 táblázat',
    checks,
  };
}
