import { describe, expect, it } from 'vitest';
import { buildModel, fixed, isRunnable, makeMaterial, makeSection, rect, uniformMesh, validateModel } from '@femati/fem-core';

/**
 * Smoke-teszt: a validációs csomag eléri a magot a workspace-hivatkozáson át.
 *
 * Az érdemi validációs esetek (V-01…V-12, P-01…P-16) a P4 fázistól kerülnek
 * ide, ahogy a megoldó elkészül.
 */
describe('fem-validation ↔ fem-core kapcsolat', () => {
  it('a mag importálható és működőképes modellt tud validálni', () => {
    const material = makeMaterial('S235', 'Acél S235', { e: 2.1e8, sigmaY: 2.35e5 });
    const section = makeSection('R', 'Téglalap', rect(0.2, 0.4));
    const mesh = uniformMesh(5, 2, { sectionId: 'R', materialId: 'S235' });

    const model = buildModel({
      name: 'Smoke — konzol',
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [material],
      sections: [section],
      boundaries: [fixed('N0')],
    });

    expect(isRunnable(validateModel(model))).toBe(true);
  });
});
