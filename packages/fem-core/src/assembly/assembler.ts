/**
 * A szerkezet merevségi mátrixának és tehervektorának kompilálása.
 *
 * Diplomaterv 3.1.7: „Az elemi merevségi mátrix meghatározása után a teljes
 * szerkezeti merevségi mátrixot és a tehervektort kompilálással kapjuk meg."
 *
 * Peremfeltétel-kezelés (3.1.7.3):
 *  - `elimination`: a megkötött szabadságfokok kimaradnak az egyenletrendszerből.
 *    Előírt támaszmozgásnál a hozzájárulás a jobboldalra kerül.
 *  - `penalty`: minden szabadságfok aktív, a megkötést nagy rugóállandó
 *    érvényesíti („a fix megtámasztásokat esetleg az elemi merevségi
 *    mátrixoknál is figyelembe lehetett volna venni egy meglehetősen nagy
 *    pl. 10¹⁰ kN/m rugóállandó hozzáadásával").
 */

import { DenseMatrix } from '../linalg/dense.js';
import { DimensionError } from '../linalg/errors.js';
import { SkylineMatrix } from '../linalg/skyline.js';
import { GAUSS_3 } from '../element/quadrature.js';
import { shapeFunctions } from '../element/shapeFunctions.js';
import { jacobian } from '../element/jacobian.js';
import { elementStiffness } from '../element/timoshenko3.js';
import { sectionStiffness, type SectionStiffness } from '../element/constitutive.js';
import {
  buildDofMap,
  elementActiveDofs,
  elementDofs,
  type ConstraintStrategy,
  type DofMap,
} from './dofMap.js';
import type { ElasticFoundation, Element, Model } from '../model/types.js';

/** A diplomaterv 3.1.7.3 pontjában javasolt penalty-rugóállandó [kN/m]. */
export const DEFAULT_PENALTY = 1e10;

/** Egy elem előkészített adatai — a megoldás és az utófeldolgozás közös bemenete. */
export interface PreparedElement {
  readonly id: string;
  readonly index: number;
  /** A három csomópont sorszáma a modellben. */
  readonly nodeIndices: readonly [number, number, number];
  /** A három csomópont x koordinátája [m]. */
  readonly nodeX: readonly [number, number, number];
  readonly stiffness: SectionStiffness;
  /** A 6×6 elemi merevségi mátrix (rugalmas ágyazat NÉLKÜL). */
  readonly ke: DenseMatrix;
  /**
   * A ténylegesen kompilált elemi mátrix: Kₑ + K_ágy.
   * A belső erők és a reakciók számításánál EZT kell használni, különben az
   * ágyazat hozzájárulása kimarad, és a globális egyensúly nem zárul.
   */
  readonly keEffective: DenseMatrix;
  /** Az elemre eső ágyazási tényező [kN/m²]; 0, ha nincs ágyazat. */
  readonly foundationC: number;
  /** A hat globális szabadságfok. */
  readonly dofs: Int32Array;
  /** A hat aktív szabadságfok-index (−1 a megkötöttekre). */
  readonly activeDofs: Int32Array;
  readonly length: number;
}

export interface AssemblyOptions {
  readonly strategy?: ConstraintStrategy;
  readonly penalty?: number;
}

export interface AssembledSystem {
  readonly map: DofMap;
  readonly elements: readonly PreparedElement[];
  /** Az aktív szabadságfokokra összeállított merevségi mátrix. */
  readonly k: SkylineMatrix;
  /**
   * A támaszmozgásból és a penalty-megkötésből származó jobboldal-hozzájárulás.
   * A külső terhek ehhez adódnak hozzá (P5).
   */
  readonly constraintLoad: Float64Array;
  readonly strategy: ConstraintStrategy;
  readonly penalty: number;
}

/** Az elemek előkészítése: geometria feloldása és a Kₑ mátrixok előállítása. */
export function prepareElements(model: Model, map: DofMap): PreparedElement[] {
  const materials = new Map(model.materials.map((m) => [m.id as string, m]));
  const sections = new Map(model.sections.map((s) => [s.id as string, s]));
  const lookup = (id: string): ReturnType<typeof materials.get> => materials.get(id);

  return model.elements.map((element: Element, index): PreparedElement => {
    const nodeIndices = element.nodes.map((id) => {
      const i = map.nodeIndex.get(id as string);
      if (i === undefined) {
        throw new DimensionError(`A(z) "${element.id}" elem ismeretlen csomópontra hivatkozik: ${id}.`);
      }
      return i;
    }) as [number, number, number];

    const material = materials.get(element.materialId as string);
    const section = sections.get(element.sectionId as string);
    if (!material || !section) {
      throw new DimensionError(
        `A(z) "${element.id}" elem anyaga vagy keresztmetszete nem oldható fel.`,
      );
    }

    const nodeX: [number, number, number] = [
      map.nodeX[nodeIndices[0]] ?? 0,
      map.nodeX[nodeIndices[1]] ?? 0,
      map.nodeX[nodeIndices[2]] ?? 0,
    ];

    const stiffness = sectionStiffness(section, material, lookup as never);
    const elementId = element.id as string;
    const ke = elementStiffness({ nodeX, elementId }, stiffness, element.integration);

    // Winkler-féle rugalmas ágyazat (Diplomaterv 3.28 és 5. fejezet)
    const foundationC = foundationFor(model.foundations, nodeX);
    const keEffective =
      foundationC > 0
        ? ke.clone().addScaled(1, foundationMatrix(nodeX, foundationC, elementId))
        : ke;

    return {
      id: elementId,
      index,
      nodeIndices,
      nodeX,
      stiffness,
      ke,
      keEffective,
      foundationC,
      dofs: elementDofs(nodeIndices),
      activeDofs: elementActiveDofs(map, nodeIndices),
      length: Math.abs(nodeX[2] - nodeX[0]),
    };
  });
}

/**
 * Winkler-féle rugalmas ágyazat elemi mátrixa (Diplomaterv 3.28):
 *   K_ágy = ∫ Nᵀ·c·N dx
 * Csak a `w` szabadságfokokra hat.
 */
export function foundationMatrix(
  nodeX: readonly [number, number, number],
  c: number,
  elementId: string,
): DenseMatrix {
  const k = new DenseMatrix(6, 6);
  for (const gp of GAUSS_3) {
    const { n } = shapeFunctions(gp.xi);
    const { detJ } = jacobian(nodeX, gp.xi, elementId);
    const factor = c * detJ * gp.w;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        k.add(2 * i, 2 * j, factor * n[i] * n[j]);
      }
    }
  }
  return k;
}

/** Az elemre eső ágyazási tényező (az ágyazat átfedő szakaszaiból). */
function foundationFor(
  foundations: readonly ElasticFoundation[],
  nodeX: readonly [number, number, number],
): number {
  const x1 = Math.min(nodeX[0], nodeX[2]);
  const x2 = Math.max(nodeX[0], nodeX[2]);
  const length = x2 - x1;
  if (length <= 0) return 0;

  let weighted = 0;
  for (const f of foundations) {
    const overlap = Math.min(x2, f.x2 as number) - Math.max(x1, f.x1 as number);
    if (overlap > 0) weighted += (f.c as number) * (overlap / length);
  }
  return weighted;
}

/**
 * A szerkezet merevségi mátrixának összeállítása.
 *
 * A profil a topológiából épül fel (skyline), majd az elemi mátrixok
 * blokkonként kerülnek be. A megkötött szabadságfokok `elimination`
 * stratégiánál kimaradnak (a `−1` aktív index révén).
 */
export function assemble(model: Model, options: AssemblyOptions = {}): AssembledSystem {
  const strategy = options.strategy ?? 'elimination';
  const penalty = options.penalty ?? DEFAULT_PENALTY;

  const map = buildDofMap(model, strategy);
  const elements = prepareElements(model, map);

  // Profil felépítése a topológiából
  const k = SkylineMatrix.fromConnectivity(
    map.activeDofs,
    elements.map((e) => e.activeDofs),
  );

  const constraintLoad = new Float64Array(map.activeDofs);

  for (const e of elements) {
    // A ténylegesen kompilált mátrix már tartalmazza az ágyazatot.
    const ke = e.keEffective;
    k.addBlock(e.activeDofs, ke);

    // Előírt támaszmozgás hatása a jobboldalra (csak elimination esetén):
    //   f_aktív ← f_aktív − Kₑ · u_előírt
    if (strategy === 'elimination') {
      for (let b = 0; b < 6; b++) {
        const globalB = e.dofs[b] ?? 0;
        if (map.prescribed[globalB] !== 1) continue;
        const value = map.prescribedValue[globalB] ?? 0;
        if (value === 0) continue;
        for (let a = 0; a < 6; a++) {
          const activeA = e.activeDofs[a] ?? -1;
          if (activeA < 0) continue;
          constraintLoad[activeA] -= ke.get(a, b) * value;
        }
      }
    }
  }

  // Rugalmas támaszok (csomóponti rugók) és penalty-megkötés
  for (const boundary of model.boundaries) {
    const i = map.nodeIndex.get(boundary.nodeId as string);
    if (i === undefined) continue;
    const wIndex = map.activeIndex[2 * i] ?? -1;
    const phiIndex = map.activeIndex[2 * i + 1] ?? -1;

    if (boundary.springW !== undefined && wIndex >= 0) {
      k.addDiagonal(wIndex, boundary.springW as number);
    }
    if (boundary.springPhi !== undefined && phiIndex >= 0) {
      k.addDiagonal(phiIndex, boundary.springPhi as number);
    }
  }

  if (strategy === 'penalty') {
    for (let d = 0; d < map.totalDofs; d++) {
      if (map.prescribed[d] !== 1) continue;
      const active = map.activeIndex[d] ?? -1;
      if (active < 0) continue;
      k.addDiagonal(active, penalty);
      // A diplomaterv 3.1.7.2 szerint: „a támasznál figyelembevett rugóállandó
      // és az előírt támaszelmozdulás szorzatát hozzáadjuk a q megfelelő eleméhez".
      constraintLoad[active] += penalty * (map.prescribedValue[d] ?? 0);
    }
  }

  return { map, elements, k, constraintLoad, strategy, penalty };
}
