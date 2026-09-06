/**
 * V-02 — Kéttámaszú tartó, egyenletesen megoszló teherrel (MASTER-PROMPT-TERV
 * 3.1 táblázat).
 *
 * Referencia: w_max = 5·q·L⁴/(384·EI) + q·L²/(8·GAs). A megoszló teher a
 * kvadratikus elemtérben NEM nodálisan pontos (ellentétben a koncentrált
 * teherrel, V-01), ezért ez DISZKRETIZÁCIÓS hiba — a tűrés ezért lazább
 * (1e−4, 8 elemmel), a táblázat szerint.
 */
import { buildModel, distributedForce, makeMaterial, makeSection, pinned, rect, solveLinear, uniformMesh } from '@femati/fem-core';
import type { ValidationCase } from '../types.js';

export function caseV02(): ValidationCase {
  const E = 2.1e8;
  const nu = 0.3;
  const G = E / (2 * (1 + nu));
  const b = 0.2;
  const h = 0.4;
  const area = b * h;
  const inertia = (b * h ** 3) / 12;
  const ei = E * inertia;
  const gas = (5 / 6) * G * area;

  const L = 6;
  const q = -8;

  const material = makeMaterial('S235', 'Acél S235', { e: E, sigmaY: 2.35e5 });
  const section = makeSection('R', 'Téglalap', rect(b, h));
  const mesh = uniformMesh(L, 8, { sectionId: 'R', materialId: 'S235' });
  const model = buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [section],
    boundaries: [pinned('N0'), pinned(`N${mesh.nodes.length - 1}`)],
    loads: [distributedForce(0, L, q, q, 'Q1')],
  });

  const result = solveLinear(model);
  const mid = result.nodes.find((n) => Math.abs(n.x - L / 2) < 1e-9);
  if (mid === undefined) throw new Error('V-02: nincs középső csomópont — páros elemszám kell.');

  const wRef = (5 * q * L ** 4) / (384 * ei) + (q * L ** 2) / (8 * gas);

  return {
    id: 'V-02',
    title: 'Kéttámaszú tartó, egyenletesen megoszló teherrel',
    description: 'w_max = 5qL⁴/(384EI) + qL²/(8GAs) — diszkretizációs hiba, 8 elemmel.',
    reference: 'Diplomaterv (3.19)–(3.23), 40–42. oldal; MASTER-PROMPT-TERV 3.1 táblázat',
    checks: [{ label: 'w a középső csomópontban [m]', reference: wRef, computed: mid.w, tolerance: 1e-4, kind: 'relative' }],
  };
}
