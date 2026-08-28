/**
 * V-08 — Hőteher, mindkét végén befogott tartó (MASTER-PROMPT-TERV 3.1 táblázat).
 *
 * A teljes végbefogás (w ÉS φ mindkét végén) egyetlen — a teljes hosszon —
 * egyenletes κ0 görbület esetén KIZÁRJA a szabad hőgörbület felvételét:
 * kézi levezetéssel (κ_mech=dφ/dx, φ(0)=φ(L)=0 ⇒ ∫κ_mech dx=0 a teljes
 * hosszon; ha κ_mech állandó, ez csak κ_mech≡0-nál teljesül; ekkor T=dM/dx=0
 * is állandó M-et ad, és dw/dx=φ−γ=0−0=0 ⇒ w≡0 az egész tartón, w(0)=0-val
 * összhangban) az EGYEDÜLI kompatibilis megoldás κ_mech ≡ 0, w ≡ 0, φ ≡ 0
 * mindenütt, és M = EI·(0−κ0) = −EI·κ0 állandó (ld. ADR-0006 előjel-konvenció).
 */
import { buildModel, fixed, makeMaterial, makeSection, rect, solveLinear, thermal, uniformMesh } from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseV08(): ValidationCase {
  const material = makeMaterial('S235T', 'Acél S235 (hőtágulással)', { e: 2.1e8, alpha: 1.2e-5, sigmaY: 2.35e5 });
  const section = makeSection('R', 'Téglalap', rect(0.2, 0.4));
  const height = 0.4;

  const L = 6;
  const tTop = 5;
  const tBottom = 25;
  const kappa0 = ((material.alpha as number) * (tBottom - tTop)) / height;
  const ei = (material.e as number) * ((0.2 * 0.4 ** 3) / 12);
  const mRef = -ei * kappa0;

  const mesh = uniformMesh(L, 4, { sectionId: 'R', materialId: 'S235T' });
  const model = buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [section],
    boundaries: [fixed('N0'), fixed(`N${mesh.nodes.length - 1}`)],
    loads: [thermal(tTop, tBottom, 0, 'T1')],
  });

  const result = solveLinear(model);

  const checks: ValidationCheck[] = [];
  for (const n of result.nodes) {
    checks.push({ label: `w a(z) "${n.nodeId}" csomópontban [m]`, reference: 0, computed: n.w, tolerance: 1e-9, kind: 'absolute' });
    checks.push({ label: `φ a(z) "${n.nodeId}" csomópontban [rad]`, reference: 0, computed: n.phi, tolerance: 1e-9, kind: 'absolute' });
  }
  for (const el of result.elements) {
    for (const gp of el.gaussPoints) {
      checks.push({
        label: `M a(z) "${el.elementId}" elem x=${gp.x.toFixed(3)} pontjában [kNm]`,
        reference: mRef,
        computed: gp.m,
        tolerance: 1e-8,
        kind: 'relative',
      });
    }
  }

  return {
    id: 'V-08',
    title: 'Hőteher, mindkét végén befogott tartó',
    description: 'w ≡ 0, φ ≡ 0, M = −EI·κ0 állandó mindenütt — a teljes befogás megakadályozza a szabad hőgörbületet.',
    reference: 'ADR-0006; Diplomaterv 3.1.7',
    checks,
  };
}
