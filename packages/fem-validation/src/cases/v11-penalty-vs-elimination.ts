/**
 * V-11 — Penalty vs. elimináció (MASTER-PROMPT-TERV 3.1 táblázat).
 *
 * A két peremfeltétel-kezelési stratégiának (Diplomaterv 3.1.7.3, 44. oldal)
 * azonos elmozdulásmezőt kell adnia. A penalty rosszabbul kondicionált
 * (nagy rugóállandó a diagonálison), ezért a tűrés lazább, mint egy elvileg
 * egzakt azonosságnál: 1e−6 relatív.
 */
import { buildModel, DEFAULT_PENALTY, fixed, makeMaterial, makeSection, nodalForce, pinned, rect, solveLinear, uniformMesh } from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseV11(): ValidationCase {
  const material = makeMaterial('S235', 'Acél S235', { e: 2.1e8, sigmaY: 2.35e5 });
  const section = makeSection('R', 'Téglalap', rect(0.2, 0.4));
  const mesh = uniformMesh(6, 4, { sectionId: 'R', materialId: 'S235' });
  const model = buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [section],
    boundaries: [pinned('N0'), fixed('N8')],
    loads: [nodalForce('N4', -20, 'F1')],
  });

  const elim = solveLinear(model, { strategy: 'elimination' });
  const pen = solveLinear(model, { strategy: 'penalty' });

  // A csomóponti értékek egy része (pl. w/φ a támasz mellett) közel nullára
  // adódik — ott az EGYEDI relatív hiba félrevezető (kis nevező felnagyítja).
  // Ezért a teljes mező jellemző nagyságához (a szélsőértékhez) viszonyítunk,
  // ahogy a HIBATURESI-POLITIKA is előírja diszkretizációs/kondicionáltsági
  // eltéréseknél. A megkötött DOF-oknál EZEN FELÜL a penalty-módszer saját,
  // fizikai pontossági korlátja is számít: a maradék elmozdulás nagyságrendje
  // (reakcióerő)/penalty — ez a lágyabb padló akadályozza meg, hogy egy
  // elvileg nullára adódó érték (ahol a relatív hiba nevezője kicsi) hamis
  // bukást okozzon.
  const wScale = Math.max(Math.abs(elim.extremes.w.value), 1e-12);
  const phiScale = Math.max(Math.abs(elim.extremes.phi.value), 1e-12);
  const maxReaction = Math.max(...elim.reactions.map((r) => Math.abs(r.fz)), 1);
  const penaltyFloor = (10 * maxReaction) / DEFAULT_PENALTY;

  const checks: ValidationCheck[] = [];
  for (let i = 0; i < elim.nodes.length; i++) {
    const e = elim.nodes[i];
    const p = pen.nodes[i];
    if (e === undefined || p === undefined) continue;
    checks.push({
      label: `w a(z) "${e.nodeId}" csomópontban [m]`,
      reference: e.w,
      computed: p.w,
      tolerance: Math.max(1e-6 * wScale, penaltyFloor),
      kind: 'absolute',
    });
    checks.push({
      label: `φ a(z) "${e.nodeId}" csomópontban [rad]`,
      reference: e.phi,
      computed: p.phi,
      tolerance: Math.max(1e-6 * phiScale, penaltyFloor),
      kind: 'absolute',
    });
  }

  return {
    id: 'V-11',
    title: 'Penalty vs. elimináció',
    description: 'A két peremfeltétel-kezelési stratégia azonos elmozdulásmezőt ad.',
    reference: 'Diplomaterv 3.1.7.3, 44. oldal',
    checks,
  };
}
