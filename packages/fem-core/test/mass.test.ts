import { describe, expect, it } from 'vitest';
import {
  DOF_PER_ELEMENT,
  assemble,
  assembleMass,
  buildModel,
  elementMass,
  fixed,
  makeMaterial,
  makeSection,
  rect,
  sectionMass,
  uniformMesh,
  type SectionStiffness,
} from '../src/index.js';

/**
 * ADR-0016 (javasolt, tervezési vázlat): konzisztens tömegmátrix a
 * 3-csomópontos Timoshenko-elemre. Ezek a tesztek az ADR 1. nyitott
 * kérdésének ELSŐ, önállóan validálható lépését ellenőrzik — a
 * `elementStiffness`-hez hasonló minta szerint (ld. `element.test.ts`).
 */

const STIFF: SectionStiffness = {
  ei: 1000,
  gas: 50000,
  area: 0.08,
  inertia: 1.0667e-3,
  height: 0.4,
  elasticModulus: 5.333e-3,
  plasticModulus: 8e-3,
  shapeFactor: 1.5,
};

const STEEL = makeMaterial('S235', 'Acél S235', { e: 2.1e8, density: 7850 });

const uniformNodes = (l: number, x0 = 0): readonly [number, number, number] => [
  x0,
  x0 + l / 2,
  x0 + l,
];

function expectRelative(actual: number, expected: number, tol: number): void {
  const denom = Math.abs(expected) > 0 ? Math.abs(expected) : 1;
  expect(Math.abs(actual - expected) / denom).toBeLessThan(tol);
}

describe('sectionMass — tömeg a fajsúlyból (ADR-0016)', () => {
  it('a vonalmenti tömeg m\' = γ·A/g', () => {
    const mass = sectionMass(STIFF, STEEL);
    const gamma = STEEL.gamma as number; // kN/m³
    expectRelative(mass.massPerLength, (gamma * STIFF.area) / 9.80665, 1e-12);
  });

  it('a forgási tehetetlenség m\'ᵩ = γ·I/g', () => {
    const mass = sectionMass(STIFF, STEEL);
    const gamma = STEEL.gamma as number;
    expectRelative(mass.rotaryInertiaPerLength, (gamma * STIFF.inertia) / 9.80665, 1e-12);
  });

  it('mindkét tag pozitív valódi (pozitív fajsúlyú) anyagnál', () => {
    const mass = sectionMass(STIFF, STEEL);
    expect(mass.massPerLength).toBeGreaterThan(0);
    expect(mass.rotaryInertiaPerLength).toBeGreaterThan(0);
  });
});

describe('elemi tömegmátrix (ADR-0016)', () => {
  const nodes = uniformNodes(4);
  const mass = sectionMass(STIFF, STEEL);

  it('mérete 6×6', () => {
    const m = elementMass({ nodeX: nodes, elementId: 'E0' }, mass);
    expect(m.rows).toBe(6);
    expect(m.cols).toBe(6);
  });

  it('szimmetrikus', () => {
    const m = elementMass({ nodeX: nodes, elementId: 'E0' }, mass);
    expect(m.symmetryDefect() / m.maxAbs()).toBeLessThan(1e-14);
  });

  it('nincs w–φ kereszttag (a mezők függetlenül interpolálnak)', () => {
    const m = elementMass({ nodeX: nodes, elementId: 'E0' }, mass);
    // w DOF-ok: 0,2,4 — φ DOF-ok: 1,3,5. A vegyes (w,φ) elemeknek zérusnak kell lenniük.
    const wDofs = [0, 2, 4];
    const phiDofs = [1, 3, 5];
    for (const i of wDofs) {
      for (const j of phiDofs) {
        expect(m.get(i, j)).toBe(0);
      }
    }
  });

  it('az átlós elemek pozitívak', () => {
    const m = elementMass({ nodeX: nodes, elementId: 'E0' }, mass);
    for (let i = 0; i < DOF_PER_ELEMENT; i++) expect(m.get(i, i)).toBeGreaterThan(0);
  });

  /**
   * A konzisztens tömegmátrix w-blokkjának ÖSSZES eleme összegezve a teljes
   * elemtömeget kell adja: Σᵢⱼ ∫ Nᵢ·Nⱼ·m'·|J| dξ = m'·∫(ΣNᵢ)·(ΣNⱼ)·|J| dξ =
   * m'·∫ 1·|J| dξ = m'·L, mert ΣNᵢ(ξ) ≡ 1 (partíció, ld. `element.test.ts`).
   * Ugyanez a φ-blokkra a forgási tehetetlenséggel. Ez egy a merevségi
   * mátrix `rigidBodyModes`-teszthez hasonló, formulázás-független
   * önellenőrzés — NEM függ attól, hogy a konkrét integrálási séma helyes-e,
   * csak attól, hogy a shape function-ök partíciója teljesül.
   */
  it('a w-blokk összege a teljes vonalmenti tömeg × hossz', () => {
    const l = 4;
    const m = elementMass({ nodeX: uniformNodes(l), elementId: 'E0' }, mass);
    let sum = 0;
    for (const i of [0, 2, 4]) for (const j of [0, 2, 4]) sum += m.get(i, j);
    expectRelative(sum, mass.massPerLength * l, 1e-12);
  });

  it('a φ-blokk összege a teljes forgási tehetetlenség × hossz', () => {
    const l = 4;
    const m = elementMass({ nodeX: uniformNodes(l), elementId: 'E0' }, mass);
    let sum = 0;
    for (const i of [1, 3, 5]) for (const j of [1, 3, 5]) sum += m.get(i, j);
    expectRelative(sum, mass.rotaryInertiaPerLength * l, 1e-12);
  });

  it('a tömegmátrix lineárisan skálázódik a fajsúllyal', () => {
    const heavier = makeMaterial('S235x2', 'Acél (2×γ)', { e: 2.1e8, density: 7850 * 2 });
    const m1 = elementMass({ nodeX: nodes, elementId: 'E0' }, sectionMass(STIFF, STEEL));
    const m2 = elementMass({ nodeX: nodes, elementId: 'E0' }, sectionMass(STIFF, heavier));
    for (let i = 0; i < 36; i++) expectRelative(m2.data[i], 2 * m1.data[i], 1e-13);
  });

  it('a hosszabb elem tömege arányosan nő', () => {
    const short = elementMass({ nodeX: uniformNodes(2), elementId: 'A' }, mass);
    const long = elementMass({ nodeX: uniformNodes(4), elementId: 'B' }, mass);
    let sumShort = 0;
    let sumLong = 0;
    for (const i of [0, 2, 4]) for (const j of [0, 2, 4]) {
      sumShort += short.get(i, j);
      sumLong += long.get(i, j);
    }
    expectRelative(sumLong / sumShort, 2, 1e-12);
  });
});

describe('assembleMass — védelmi ág (a modell-validáció már kiszűrte volna)', () => {
  it('ha egy elem anyaga nem oldható fel a modellben, az elemet csendben kihagyja (nem dob, a mátrix a többi hozzájárulás nélkül épül)', () => {
    const mesh = uniformMesh(4, 2, { sectionId: 'R', materialId: 'S235' });
    const material = makeMaterial('S235', 'Acél S235', { e: 2.1e8, density: 7850 });
    const section = makeSection('R', 'Téglalap', rect(0.2, 0.4));
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [material],
      sections: [section],
      boundaries: [fixed('N0')],
    });
    const system = assemble(model, { strategy: 'elimination' });

    // Az `assembleMass` közvetlen hívásakor a model.materials ÜRES — ez a
    // `buildModel`/`validateModel` normál útján sosem fordulhatna elő, de az
    // alacsony szintű `assembleMass` saját védelmi ágát (massAssembler.ts:
    // `if (!material) continue`) közvetlenül teszteljük.
    const modelWithoutMaterials = { ...model, materials: [] };
    const m = assembleMass(modelWithoutMaterials, system.map, system.elements);
    for (let i = 0; i < system.map.activeDofs; i++) {
      for (let j = 0; j < system.map.activeDofs; j++) {
        expect(m.get(i, j)).toBe(0);
      }
    }
  });
});
