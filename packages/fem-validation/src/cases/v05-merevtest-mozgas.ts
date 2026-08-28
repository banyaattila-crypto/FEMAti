/**
 * V-05 — Merevtest-mozgás (MASTER-PROMPT-TERV 3.1 táblázat).
 *
 * Egy szabad (megtámasztás nélküli) elem merevtest-mozgásra (tiszta eltolás,
 * illetve merev elfordulás) nem termelhet belső erőt: Kₑ·u_rigid = 0. Ez a
 * legalapvetőbb ellenőrzés — ha itt hiba van, a merevségi mátrix hibás,
 * függetlenül attól, hogy bármelyik terhelt eset "jó" számot ad-e.
 *
 * Tűrés: gépi pontosság (1e−12, a Kₑ normájához skálázva).
 */
import { elementStiffness, makeMaterial, makeSection, rect, rigidBodyModes, sectionStiffness } from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseV05(): ValidationCase {
  const material = makeMaterial('S235', 'Acél S235', { e: 2.1e8, sigmaY: 2.35e5 });
  const section = makeSection('R', 'Téglalap', rect(0.2, 0.4));
  const stiffness = sectionStiffness(section, material);

  // Szándékosan NEM egyenközű csomópontok, hogy a próba ne csak a
  // "szép" esetre igazolja a merevtest-mozgást.
  const nodeX: readonly [number, number, number] = [0, 1.7, 5];
  const ke = elementStiffness({ nodeX, elementId: 'V05' }, stiffness);
  const kNorm = ke.maxAbs();

  const checks: ValidationCheck[] = [];
  const [translation, rotation] = rigidBodyModes(nodeX);
  const modes = { eltolás: translation, 'merev elfordulás': rotation };

  for (const [label, mode] of Object.entries(modes)) {
    const f = ke.multiplyVector(mode);
    for (let i = 0; i < f.length; i++) {
      checks.push({
        label: `Kₑ·u_${label} — ${i}. komponens`,
        reference: 0,
        computed: f[i] ?? 0,
        tolerance: 1e-12 * kNorm,
        kind: 'absolute',
      });
    }
  }

  return {
    id: 'V-05',
    title: 'Merevtest-mozgás',
    description: 'Kₑ·u_rigid = 0 tiszta eltolásra és merev elfordulásra egyaránt.',
    reference: 'Diplomaterv (3.11), 3.1.5, 38. oldal',
    checks,
  };
}
