/**
 * A szerkezet tömegmátrixának összeállítása — ADR-0016 (modális analízis).
 *
 * A `assembler.ts` `assemble()`-jének testvér-függvénye, UGYANAZZAL a
 * `DofMap`-pel és `PreparedElement[]`-lel dolgozik, hogy a K és az M mátrix
 * garantáltan azonos szabadságfok-sorrendet és -megkötést használjon.
 *
 * Csak az elemek SAJÁT tömegét veszi figyelembe — a rugós támasz és a
 * rugalmas ágyazat statikai fogalmak, nincs hozzájuk tartozó tömeg.
 *
 * Dense (nem skyline) tárolás: ez az ELSŐ, korrektségre optimalizált lépés
 * (ADR-0016 "Haladás" szakasz) — a sajátérték-megoldó (`linalg/eigen.ts`) is
 * dense mátrixon dolgozik. Nagyobb modellekre ez egy KÉSŐBBI, méréssel
 * megalapozott optimalizálási döntés lenne (ADR-0009 mintájára).
 */

import { DenseMatrix } from '../linalg/dense.js';
import { elementMass } from '../element/timoshenko3.js';
import { sectionMass } from '../element/constitutive.js';
import type { PreparedElement } from './assembler.js';
import type { DofMap } from './dofMap.js';
import type { Model } from '../model/types.js';

/**
 * A tömegmátrix (aktív szabadságfokokra szűkítve, dense).
 *
 * @param model a szerkezeti modell (anyagok fajsúlyához, `sectionMass` ld.
 *        `element/constitutive.ts`)
 * @param map a `assemble()`-ből származó szabadságfok-térkép
 * @param elements a `assemble()`-ből származó, előkészített elemek
 */
export function assembleMass(model: Model, map: DofMap, elements: readonly PreparedElement[]): DenseMatrix {
  const materials = new Map(model.materials.map((mat) => [mat.id as string, mat]));
  const elementById = new Map(model.elements.map((e) => [e.id as string, e]));

  const m = new DenseMatrix(map.activeDofs, map.activeDofs);

  for (const e of elements) {
    const sourceElement = elementById.get(e.id);
    const material = sourceElement ? materials.get(sourceElement.materialId as string) : undefined;
    if (!material) continue; // a modell-validáció már kiszűrte volna a feloldhatatlan anyagot

    const mass = sectionMass(e.stiffness, material);
    const me = elementMass({ nodeX: e.nodeX, elementId: e.id }, mass);

    for (let a = 0; a < 6; a++) {
      const i = e.activeDofs[a] ?? -1;
      if (i < 0) continue;
      for (let b = 0; b < 6; b++) {
        const j = e.activeDofs[b] ?? -1;
        if (j < 0) continue;
        m.add(i, j, me.get(a, b));
      }
    }
  }

  return m;
}
