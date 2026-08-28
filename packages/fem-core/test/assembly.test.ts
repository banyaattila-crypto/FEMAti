import { beforeEach, describe, expect, it } from 'vitest';
import {
  assemble,
  buildDofMap,
  buildLoadVector,
  buildModel,
  distributedForce,
  distributedMoment,
  elementDofs,
  fixed,
  foundation,
  foundationMatrix,
  makeMaterial,
  makeSection,
  nodalForce,
  nodalMoment,
  parabolicForce,
  pinned,
  rect,
  resetLoadIds,
  sectionStiffness,
  selfWeight,
  springSupport,
  supportDisplacement,
  thermal,
  uniformMesh,
  type Model,
} from '../src/index.js';
import { mustGet } from './helpers/assert.js';
import { simpson } from './helpers/numeric.js';
import { DimensionError, SingularMatrixError } from '../src/linalg/errors.js';

const MAT = makeMaterial('S235', 'Acél S235', { e: 2.1e8, sigmaY: 2.35e5 });
const SEC = makeSection('R', 'Téglalap', rect(0.2, 0.4));

function beam(elements: number, length = 6): Model {
  const mesh = uniformMesh(length, elements, { sectionId: 'R', materialId: 'S235' });
  return buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [MAT],
    sections: [SEC],
    boundaries: [fixed('N0')],
  });
}

beforeEach(() => resetLoadIds());

describe('buildDofMap', () => {
  it('csomópontonként 2 szabadságfokot rendel', () => {
    const m = beam(3);
    const map = buildDofMap(m);
    expect(map.nodeCount).toBe(7);
    expect(map.totalDofs).toBe(14);
  });

  it('elimination stratégiánál a megkötött DOF-ok kimaradnak az aktívból', () => {
    const m = beam(2);
    const map = buildDofMap(m, 'elimination');
    // fixed('N0'): w és φ is megkötött → 2 DOF kimarad
    expect(map.activeDofs).toBe(map.totalDofs - 2);
    expect(map.activeIndex[0]).toBe(-1);
    expect(map.activeIndex[1]).toBe(-1);
    expect(map.activeIndex[2]).toBeGreaterThanOrEqual(0);
  });

  it('penalty stratégiánál minden DOF aktív marad', () => {
    const m = beam(2);
    const map = buildDofMap(m, 'penalty');
    expect(map.activeDofs).toBe(map.totalDofs);
    expect(map.activeIndex[0]).toBeGreaterThanOrEqual(0);
  });

  it('csuklós támasz csak a w DOF-ot köti meg', () => {
    const mesh = uniformMesh(4, 1, { sectionId: 'R', materialId: 'S235' });
    const m = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [pinned('N0')],
    });
    const map = buildDofMap(m);
    expect(map.prescribed[0]).toBe(1);
    expect(map.prescribed[1]).toBe(0);
  });

  it('támaszmozgás előírt értéke bekerül a prescribedValue-ba', () => {
    const m = beam(2);
    const withDisp: Model = { ...m, loads: [supportDisplacement('N0', -0.01, 0.002)] };
    const map = buildDofMap(withDisp);
    expect(map.prescribed[0]).toBe(1);
    expect(map.prescribedValue[0]).toBeCloseTo(-0.01, 12);
    expect(map.prescribed[1]).toBe(1);
    expect(map.prescribedValue[1]).toBeCloseTo(0.002, 12);
  });

  it('üres modellre dimenzióhibát dob', () => {
    const m = beam(1);
    expect(() => buildDofMap({ ...m, nodes: [] })).toThrow(DimensionError);
  });

  it('elementDofs a rögzített [w,φ,w,φ,w,φ] sorrendet adja', () => {
    const dofs = elementDofs([2, 3, 4]);
    expect([...dofs]).toEqual([4, 5, 6, 7, 8, 9]);
  });
});

describe('assemble — a kompilált merevségi mátrix', () => {
  it('szimmetrikus (a globális mátrix is öröklődik az elemi mátrixokból)', () => {
    const m = beam(3);
    const sys = assemble(m);
    const dense = sys.k.toDense();
    expect(dense.symmetryDefect() / dense.maxAbs()).toBeLessThan(1e-13);
  });

  it('a profil mérete az aktív DOF-ok száma', () => {
    const m = beam(4);
    const sys = assemble(m);
    expect(sys.k.n).toBe(sys.map.activeDofs);
  });

  it('rugós támasz növeli az érintett átlós elemet', () => {
    const mesh = uniformMesh(4, 1, { sectionId: 'R', materialId: 'S235' });
    const withoutSpring = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [pinned('N0'), pinned('N2')],
    });
    const withSpring: Model = {
      ...withoutSpring,
      boundaries: [springSupport('N0', 5000), pinned('N2')],
    };
    const sysWithout = assemble(withoutSpring, { strategy: 'penalty', penalty: 0 });
    const sysWith = assemble(withSpring, { strategy: 'penalty', penalty: 0 });
    // A penalty=0 mellett a "without" esetben nincs semmilyen tag N0 w-jén,
    // a "with" esetben pontosan 5000-rel nagyobb az átlós elem.
    const wo = sysWithout.k.toDense();
    const w = sysWith.k.toDense();
    expect(w.get(0, 0) - wo.get(0, 0)).toBeCloseTo(5000, 6);
  });

  it('elimination és penalty ugyanannyi elemet tartalmaz a profilban (méret eltérő)', () => {
    const m = beam(3);
    const elim = assemble(m, { strategy: 'elimination' });
    const pen = assemble(m, { strategy: 'penalty' });
    expect(elim.k.n).toBe(pen.k.n - 2); // a penalty 2-vel több DOF-ot tart meg
  });

  it('rugalmas ágyazat csak a w-w blokkokra hat', () => {
    const mesh = uniformMesh(4, 1, { sectionId: 'R', materialId: 'S235' });
    const withFoundation = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [fixed('N0')], foundations: [foundation(0, 4, 8000)],
    });
    const without = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [fixed('N0')],
    });
    const sysF = assemble(withFoundation);
    const sys0 = assemble(without);
    const dF = sysF.k.toDense();
    const d0 = sys0.k.toDense();
    // φ-φ átlós elemek (páratlan indexek) nem változnak az ágyazattól.
    expect(dF.get(1, 1)).toBeCloseTo(d0.get(1, 1), 8);
    // w-w átlós elemek nagyobbak.
    expect(dF.get(0, 0)).toBeGreaterThan(d0.get(0, 0));
  });

  /**
   * Mutációs próba (Diplomaterv 3.28, K_ágy = ∫Nᵀ·c·N dx): mivel ΣNᵢ(ξ) ≡ 1
   * (alakfüggvény-partíció, ld. element.test.ts), a mátrix minden elemének
   * összege ∫c dx = c·L kell legyen, függetlenül a hálótól — ez zárt alakban
   * ellenőrizhető, nem csak "nagyobb, mint" jellegű összevetéssel.
   *
   * A próba: a `detJ * gp.w` szorzót `gp.w`-re cserélve (a Jacobi-transzformáció
   * elhagyása) a 2 elemes hálón az összeg felényire esik — a teszt ezt elkapja.
   * Ugyanígy elkapja, ha valaki elfelejti a `c` szorzót, vagy a súlyt duplázza.
   */
  it('K_ágy elemeinek összege zárt alakban c·L (mutációs próba: detJ vagy c kihagyása esetén elbukik)', () => {
    const c = 8000;
    const nodeXs: Array<readonly [number, number, number]> = [
      [0, 2, 4],
      [0, 1, 2],
      [-3, -1, 1],
    ];
    for (const nodeX of nodeXs) {
      const length = Math.abs(nodeX[2] - nodeX[0]);
      const k = foundationMatrix(nodeX, c, 'E-mut');
      let sum = 0;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          sum += k.get(2 * i, 2 * j);
        }
      }
      expect(sum).toBeCloseTo(c * length, 10);
    }
  });

  it('ismeretlen keresztmetszetre hivatkozó elem dimenzióhibát dob', () => {
    const mesh = uniformMesh(4, 1, { sectionId: 'R', materialId: 'S235' });
    const bad = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements.map((e) => ({ ...e, sectionId: 'NINCS' as never })),
      materials: [MAT], sections: [SEC], boundaries: [fixed('N0')],
    });
    expect(() => assemble(bad)).toThrow(DimensionError);
  });

  it('mechanizmusra SingularMatrixError-t dob megoldáskor', () => {
    const mesh = uniformMesh(4, 1, { sectionId: 'R', materialId: 'S235' });
    const mechanism = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [], // nincs megtámasztás — szabad test
    });
    const sys = assemble(mechanism);
    const loads = buildLoadVector(mechanism, sys.map);
    expect(() => sys.k.solve(loads.active)).toThrow(SingularMatrixError);
  });
});

describe('buildLoadVector', () => {
  it('csomóponti erő a w komponensbe kerül', () => {
    const m = beam(2);
    const map = buildDofMap(m);
    const withLoad: Model = { ...m, loads: [nodalForce('N4', -10, 'F1')] };
    const loads = buildLoadVector(withLoad, map);
    const i = mustGet(map.nodeIndex.get('N4'));
    expect(loads.full[2 * i]).toBeCloseTo(-10, 10);
    expect(loads.full[2 * i + 1]).toBe(0);
  });

  it('csomóponti nyomaték a φ komponensbe kerül', () => {
    const m = beam(2);
    const map = buildDofMap(m);
    const withLoad: Model = { ...m, loads: [nodalMoment('N2', 15, 'M1')] };
    const loads = buildLoadVector(withLoad, map);
    const i = mustGet(map.nodeIndex.get('N2'));
    expect(loads.full[2 * i + 1]).toBeCloseTo(15, 10);
  });

  it('a teherszorzó (λ) skálázza a terhet', () => {
    const m = beam(1);
    const map = buildDofMap(m);
    const withLoad: Model = { ...m, loads: [nodalForce('N2', -10, 'F1')] };
    const loads = buildLoadVector(withLoad, map, 0.5);
    const i = mustGet(map.nodeIndex.get('N2'));
    expect(loads.full[2 * i]).toBeCloseTo(-5, 10);
  });

  it('támaszmozgás nem kerül a tehervektorba (azt az assembler kezeli)', () => {
    const m = beam(1);
    const map = buildDofMap(m);
    const withDisp: Model = { ...m, loads: [supportDisplacement('N0', -0.01)] };
    const loads = buildLoadVector(withDisp, map);
    expect([...loads.full].every((v) => v === 0)).toBe(true);
  });
});

/** A w-sorok (páros index) összege és elsőrendű nyomatéka (Σ xᵢ·wᵢ) a full-vektorból. */
function forceResultant(full: Float64Array, nodeX: Float64Array): { sum: number; moment: number } {
  let sum = 0;
  let moment = 0;
  for (let i = 0; i < nodeX.length; i++) {
    const f = full[2 * i] ?? 0;
    sum += f;
    moment += f * (nodeX[i] ?? 0);
  }
  return { sum, moment };
}

/** A φ-sorok (páratlan index) összege a full-vektorból. */
function momentResultant(full: Float64Array, nodeX: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < nodeX.length; i++) sum += full[2 * i + 1] ?? 0;
  return sum;
}

describe('P5 — megoszló erő redukciója', () => {
  it('lineáris, elemhatárokat átlépő teher: a redukált eredő és nyomaték egyezik az integrállal', () => {
    const m = beam(4, 6); // 4 elem, 1.5 m/elem — a teher (1.3…4.7) 3 elemhatárt is átlép
    const map = buildDofMap(m);
    const x1 = 1.3;
    const x2 = 4.7;
    const q1 = -3;
    const q2 = -8;
    const withLoad: Model = { ...m, loads: [distributedForce(x1, x2, q1, q2, 'Q1')] };
    const loads = buildLoadVector(withLoad, map);

    const q = (x: number): number => q1 + ((q2 - q1) * (x - x1)) / (x2 - x1);
    const { sum, moment } = forceResultant(loads.full, map.nodeX);

    expect(sum).toBeCloseTo(simpson(q, x1, x2), 9);
    expect(moment).toBeCloseTo(
      simpson((x) => x * q(x), x1, x2),
      8,
    );
  });

  it('parabolikus teher: a redukált eredő és nyomaték egyezik az integrállal', () => {
    const m = beam(3, 6);
    const map = buildDofMap(m);
    const x1 = 0.5;
    const x2 = 5.5;
    const q1 = -2;
    const qMid = -10;
    const q2 = -1;
    const withLoad: Model = { ...m, loads: [parabolicForce(x1, x2, q1, qMid, q2, 'QP1')] };
    const loads = buildLoadVector(withLoad, map);

    const q = (x: number): number => {
      const eta = (2 * (x - x1)) / (x2 - x1) - 1;
      const n1 = 0.5 * eta * (eta - 1);
      const n2 = 1 - eta * eta;
      const n3 = 0.5 * eta * (eta + 1);
      return n1 * q1 + n2 * qMid + n3 * q2;
    };
    const { sum, moment } = forceResultant(loads.full, map.nodeX);

    expect(sum).toBeCloseTo(simpson(q, x1, x2), 8);
    expect(moment).toBeCloseTo(
      simpson((x) => x * q(x), x1, x2),
      7,
    );
  });

  it('teljesen egy elemen belüli, részleges lefedésű teher eredője is helyes', () => {
    const m = beam(2, 4); // 2 elem, 2 m/elem
    const map = buildDofMap(m);
    const x1 = 0.3; // az első elemen belül (0…2)
    const x2 = 1.1;
    const q1 = 5;
    const q2 = 5; // egyenletes
    const withLoad: Model = { ...m, loads: [distributedForce(x1, x2, q1, q2, 'Q1')] };
    const loads = buildLoadVector(withLoad, map);
    const { sum } = forceResultant(loads.full, map.nodeX);
    expect(sum).toBeCloseTo(q1 * (x2 - x1), 10);
  });
});

describe('P5 — megoszló nyomaték redukciója', () => {
  it('a redukált φ-sorok összege egyezik a nyomaték integráljával', () => {
    const m = beam(4, 6);
    const map = buildDofMap(m);
    const x1 = 0.8;
    const x2 = 5.2;
    const m1 = 3;
    const m2 = -6;
    const withLoad: Model = { ...m, loads: [distributedMoment(x1, x2, m1, m2, 'MQ1')] };
    const loads = buildLoadVector(withLoad, map);

    const mFn = (x: number): number => m1 + ((m2 - m1) * (x - x1)) / (x2 - x1);
    const sum = momentResultant(loads.full, map.nodeX);
    expect(sum).toBeCloseTo(simpson(mFn, x1, x2), 9);

    // Nem terheli a w sorokat.
    const { sum: forceSum } = forceResultant(loads.full, map.nodeX);
    expect(forceSum).toBe(0);
  });
});

describe('P5 — önsúly', () => {
  const heavyMaterial = makeMaterial('C25/30', 'Beton', { e: 3.1e7, density: 2500 });

  it('γ·A egyenletesen megoszló teherként redukálódik — megegyezik egy azonos q-jú distributedForce-szal', () => {
    const m: Model = {
      ...beam(3, 6),
      materials: [heavyMaterial],
      elements: beam(3, 6).elements.map((e) => ({ ...e, materialId: heavyMaterial.id })),
    };
    const map = buildDofMap(m);

    const withSelfWeight: Model = { ...m, loads: [selfWeight(1, 'G1')] };
    const loadsA = buildLoadVector(withSelfWeight, map);

    const stiffness = sectionStiffness(SEC, heavyMaterial);
    const pz = (heavyMaterial.gamma as number) * stiffness.area;
    const withEquivalent: Model = { ...m, loads: [distributedForce(0, 6, pz, pz, 'QEQ')] };
    const loadsB = buildLoadVector(withEquivalent, map);

    for (let i = 0; i < loadsA.full.length; i++) {
      expect(loadsA.full[i]).toBeCloseTo(loadsB.full[i] ?? 0, 10);
    }
  });

  it('a szorzótényező (factor) lineárisan skálázza az önsúlyt', () => {
    const m: Model = {
      ...beam(2, 4),
      materials: [heavyMaterial],
      elements: beam(2, 4).elements.map((e) => ({ ...e, materialId: heavyMaterial.id })),
    };
    const map = buildDofMap(m);
    const full1 = buildLoadVector({ ...m, loads: [selfWeight(1, 'G1')] }, map).full;
    const full2 = buildLoadVector({ ...m, loads: [selfWeight(2.5, 'G2')] }, map).full;
    for (let i = 0; i < full1.length; i++) {
      expect(full2[i]).toBeCloseTo(2.5 * (full1[i] ?? 0), 10);
    }
  });
});

describe('P5 — hőteher tehervektora', () => {
  // MAT-nak nincs hőtágulási együtthatója (alpha=0 alapértelmezés) — a
  // hőteher teszteléséhez explicit alpha kell.
  const THERMAL_MAT = makeMaterial('S235T', 'Acél S235 (hőtágulással)', { e: 2.1e8, alpha: 1.2e-5 });

  function thermalBeam(elements: number, length: number): Model {
    const base = beam(elements, length);
    return {
      ...base,
      materials: [THERMAL_MAT],
      elements: base.elements.map((e) => ({ ...e, materialId: THERMAL_MAT.id })),
    };
  }

  it('κ0 = α·(t_alsó − t_felső)/h — a φ-sorok zárt alakban ellenőrizhetők', () => {
    const m = thermalBeam(1, 4);
    const map = buildDofMap(m);
    const alpha = THERMAL_MAT.alpha as number;
    const stiffness = sectionStiffness(SEC, THERMAL_MAT);
    const tTop = 10;
    const tBottom = 30;
    const kappa0 = (alpha * (tBottom - tTop)) / stiffness.height;
    const ei = stiffness.ei;

    const withThermal: Model = { ...m, loads: [thermal(tTop, tBottom, 0, 'T1')] };
    const loads = buildLoadVector(withThermal, map);

    // Zárt alak (∫dNᵢ/dx dx = Nᵢ(x2)−Nᵢ(x1) = [-1, 0, 1]), független a Gauss-kvadratúrától.
    // A tehervektor +∫BᵀDε0 dx (ld. ADR-0006 az előjelről a loadVector.ts fejlécében).
    expect(loads.full[1]).toBeCloseTo(-ei * kappa0, 6);
    expect(loads.full[3]).toBeCloseTo(0, 8);
    expect(loads.full[5]).toBeCloseTo(ei * kappa0, 6);
    // A hőteher nem terheli a w sorokat.
    expect(loads.full[0]).toBe(0);
    expect(loads.full[2]).toBe(0);
    expect(loads.full[4]).toBe(0);
  });

  it('az elementIds szűrő csak a megjelölt elemekre alkalmazza a hőterhet', () => {
    const m = thermalBeam(2, 4); // N0-N2-N4 csomópontok, 2 elem
    const map = buildDofMap(m);
    const firstElementId = m.elements[0]?.id as string;
    const loadWithFilter: Model = {
      ...m,
      loads: [{ ...thermal(10, 30, 0, 'T1'), elementIds: [firstElementId] } as never],
    };
    const loads = buildLoadVector(loadWithFilter, map);
    // A távoli végponti csomópont (N4, DOF-index 9) φ-je KIZÁRÓLAG a MÁSODIK
    // elemtől kapna járulékot — ha az nincs a szűrőben, pontosan nullának
    // kell maradnia. (N2, DOF-index 5, viszont az ELSŐ elem jobb csomópontja
    // is, ezért attól kap járulékot — az helyesen nem nulla.)
    expect(loads.full[9]).toBe(0);
    expect(loads.full[5]).not.toBe(0);
  });
});
