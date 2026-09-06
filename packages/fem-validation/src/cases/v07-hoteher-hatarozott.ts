/**
 * V-07 — Hőteher, kéttámaszú tartó (statikailag HATÁROZOTT), egyenletes
 * ΔT_grad (MASTER-PROMPT-TERV 3.1 táblázat).
 *
 * Egy determinált szerkezetnél a hőteher szabadon felveheti a κ0 görbületet —
 * nincs kényszer, ami ezt megakadályozná —, ezért M ≡ 0 mindenütt. Ez az
 * `internalForces` ε0-korrekciójának (M = EI·(κ−κ0)) és az ADR-0006
 * előjel-döntésnek a próbája.
 *
 * Zárt alak (kézi levezetés, T≡0 ⇒ dw/dx=φ, κ=dφ/dx=κ0 állandó, w(0)=w(L)=0
 * határfeltétellel): w(x) = (κ0/2)·x·(x−L), innen |w_max| = κ0·L²/8 az
 * x=L/2 helyen.
 */
import { buildModel, makeMaterial, makeSection, pinned, rect, solveLinear, thermal, uniformMesh } from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseV07(): ValidationCase {
  const material = makeMaterial('S235T', 'Acél S235 (hőtágulással)', { e: 2.1e8, alpha: 1.2e-5, sigmaY: 2.35e5 });
  const section = makeSection('R', 'Téglalap', rect(0.2, 0.4));
  const height = 0.4;

  const L = 6;
  const tTop = 5;
  const tBottom = 25;
  const kappa0 = ((material.alpha as number) * (tBottom - tTop)) / height;
  const ei = (material.e as number) * ((0.2 * 0.4 ** 3) / 12);
  // Az M-tolerancia az EI·κ0 skálához viszonyítva — ha az ε0-korrekció
  // (M = EI·(κ−κ0)) hibás, M ~ EI·κ0 nagyságrendű lenne 0 helyett.
  const mTolerance = 1e-6 * Math.abs(ei * kappa0);

  const mesh = uniformMesh(L, 4, { sectionId: 'R', materialId: 'S235T' });
  const model = buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [section],
    boundaries: [pinned('N0'), pinned(`N${mesh.nodes.length - 1}`)],
    loads: [thermal(tTop, tBottom, 0, 'T1')],
  });

  const result = solveLinear(model);
  const mid = result.nodes.find((n) => Math.abs(n.x - L / 2) < 1e-9);
  if (mid === undefined) throw new Error('V-07: nincs középső csomópont.');

  const wRef = (kappa0 / 2) * (L / 2) * (L / 2 - L);

  const checks: ValidationCheck[] = [{ label: 'w a középső csomópontban [m]', reference: wRef, computed: mid.w, tolerance: 1e-8, kind: 'relative' }];
  for (const el of result.elements) {
    for (const gp of el.gaussPoints) {
      checks.push({
        label: `M a(z) "${el.elementId}" elem x=${gp.x.toFixed(3)} pontjában [kNm]`,
        reference: 0,
        computed: gp.m,
        tolerance: mTolerance,
        kind: 'absolute',
      });
    }
  }
  checks.push({
    label: 'egyensúly (reakciók + terhek összege, gépi pontosság)',
    reference: 0,
    computed: result.equilibrium.sumFz,
    tolerance: 1e-9,
    kind: 'absolute',
  });

  return {
    id: 'V-07',
    title: 'Hőteher, statikailag határozott (kéttámaszú)',
    description: 'M ≡ 0, w_max = κ0·L²/8 — a szerkezet szabadon felveheti a hőteher-görbületet.',
    reference: 'ADR-0006; Diplomaterv 3.1.7',
    checks,
  };
}
