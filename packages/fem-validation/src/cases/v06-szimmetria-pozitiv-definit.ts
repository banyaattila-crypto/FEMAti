/**
 * V-06 — Szimmetria + pozitív definitség (MASTER-PROMPT-TERV 3.1 táblázat).
 *
 * A kompilált szerkezeti merevségi mátrix K = Kᵀ MINDIG (a Kₑ elemi mátrixok
 * egyrangú (rᵀ·r) tagokból épülnek, ami önmagában garantálja a szimmetriát).
 * Megtámasztás után (nincs merevtest-mozgás) K-nak pozitív definitnek kell
 * lennie: az LDLᵀ faktorizáció minden pivotja pozitív (Diplomaterv 3.1.7.1,
 * 43. oldal: "ha a szerkezet mechanizmus, K szinguláris; ha valódi tartó,
 * K nem szinguláris").
 *
 * Tűrés: gépi pontosság.
 */
import { assemble, buildModel, fixed, makeMaterial, makeSection, rect, uniformMesh } from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseV06(): ValidationCase {
  const material = makeMaterial('S235', 'Acél S235', { e: 2.1e8, sigmaY: 2.35e5 });
  const section = makeSection('R', 'Téglalap', rect(0.2, 0.4));
  const mesh = uniformMesh(6, 3, { sectionId: 'R', materialId: 'S235' });
  const model = buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [section],
    boundaries: [fixed('N0')],
  });

  const system = assemble(model);
  const dense = system.k.toDense(); // faktorizálás ELŐTT — a toDense() utána tiltott
  const symmetryDefect = dense.symmetryDefect() / dense.maxAbs();

  // A faktorizáció kikényszerítése (a jobboldal tartalma közömbös).
  system.k.solve(new Float64Array(system.map.activeDofs));

  const checks: ValidationCheck[] = [
    {
      label: 'K szimmetria-hibája (relatív)',
      reference: 0,
      computed: symmetryDefect,
      tolerance: 1e-13,
      kind: 'absolute',
    },
    {
      label: 'Negatív pivotok száma (tehetetlenségi szám)',
      reference: 0,
      computed: system.k.negativePivots,
      tolerance: 0,
      kind: 'absolute',
    },
  ];

  return {
    id: 'V-06',
    title: 'Szimmetria + pozitív definitség',
    description: 'K = Kᵀ, és megtámasztás után minden LDLᵀ-pivot pozitív.',
    reference: 'Diplomaterv 3.1.7.1, 43. oldal',
    checks,
  };
}
