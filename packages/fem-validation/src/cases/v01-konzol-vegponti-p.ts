/**
 * V-01 — Konzol, végponti P (MASTER-PROMPT-TERV 3.1 táblázat).
 *
 * Analitikus referencia (Timoshenko-gerenda, befogva x=0-nál, P a szabad
 * végen): w = P·L³/(3·EI) + P·L/(GAs).
 *
 * A kvadratikus (3 csomópontos) elem ezt a terhelést NODÁLISAN PONTOSAN
 * visszaadja (a köbös lehajlásfüggvény benne van a kvadratikus elem terében
 * a nyírási résszel együtt) — ezért a tűrés szigorú (1e−8 relatív), jóval
 * szorosabb, mint egy diszkretizációs hibával terhelt esetnél lenne.
 */
import {
  buildModel,
  fixed,
  makeMaterial,
  makeSection,
  nodalForce,
  rect,
  solveLinear,
  uniformMesh,
} from '@femati/fem-core';
import type { ValidationCase } from '../types.js';

export function caseV01(): ValidationCase {
  const E = 2.1e8; // kN/m²
  const nu = 0.3;
  const G = E / (2 * (1 + nu));
  const b = 0.2;
  const h = 0.4;
  const area = b * h;
  const inertia = (b * h ** 3) / 12;
  const ei = E * inertia;
  const gas = (5 / 6) * G * area;

  const L = 4;
  const P = -10;

  const material = makeMaterial('S235', 'Acél S235', { e: E, sigmaY: 2.35e5 });
  const section = makeSection('R', 'Téglalap', rect(b, h));
  const mesh = uniformMesh(L, 2, { sectionId: 'R', materialId: 'S235' });
  const model = buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [section],
    boundaries: [fixed('N0')],
    loads: [nodalForce('N4', P, 'F1')],
  });

  const result = solveLinear(model);
  const tip = result.nodes.at(-1);
  if (tip === undefined) throw new Error('V-01: a modellnek üresnek kellene lennie, de nincs csomópontja.');

  const wRef = (P * L ** 3) / (3 * ei) + (P * L) / gas;

  return {
    id: 'V-01',
    title: 'Konzol, végponti P',
    description: 'w = P·L³/(3·EI) + P·L/(GAs) — a kvadratikus elem itt nodálisan pontos.',
    reference: 'Diplomaterv 3.1.7 (3.11)/(3.24)–(3.26), 38./43. oldal; MASTER-PROMPT-TERV 3.1 táblázat',
    checks: [{ label: 'w a szabad végen [m]', reference: wRef, computed: tip.w, tolerance: 1e-8, kind: 'relative' }],
  };
}
