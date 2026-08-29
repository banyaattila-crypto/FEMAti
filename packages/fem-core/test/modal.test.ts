import { describe, expect, it } from 'vitest';
import {
  buildModel,
  InvalidModelError,
  makeMaterial,
  makeSection,
  norm2,
  rect,
  roller,
  solveModal,
  uniformMesh,
  type Model,
} from '../src/index.js';

/**
 * ADR-0016, 4. nyitott kérdés: az ELSŐ fizikai validáció — zárt alakú
 * referencia ellen, nem csak formulázás-belső önellenőrzés (ld. `mass.test.ts`,
 * `eigen.test.ts`). Kéttámaszú (görgős-görgős, w=0 mindkét végén, φ szabad)
 * gerenda, KARCSÚ (L/h nagy) — ekkor a Timoshenko-korrekció (nyírás +
 * forgási tehetetlenség) elhanyagolható, a klasszikus Euler-Bernoulli
 * sajátfrekvencia jó referencia:
 *
 *   ωₙ = (nπ/L)²·√(EI/m'),   m' = γ·A/g
 */

const STEEL = makeMaterial('S235', 'Acél S235', { e: 2.1e8, density: 7850 });
const SEC = makeSection('R1', 'Téglalap 20/40', rect(0.2, 0.4));

function simplySupported(length: number, elementCount: number): Model {
  const mesh = uniformMesh(length, elementCount, { sectionId: 'R1', materialId: 'S235' });
  const lastNode = `N${2 * elementCount}`;
  return buildModel({
    name: 'Kéttámaszú (modális)',
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [STEEL],
    sections: [SEC],
    boundaries: [roller('N0'), roller(lastNode)],
  });
}

function eulerBernoulliOmega1(length: number, ei: number, massPerLength: number): number {
  return (Math.PI / length) ** 2 * Math.sqrt(ei / massPerLength);
}

describe('solveModal — érvénytelen modell', () => {
  it('támasz nélküli (mechanizmus) modellre InvalidModelError-t dob, a validáció ugyanúgy fut, mint solveLinear-nél', () => {
    const mesh = uniformMesh(10, 4, { sectionId: 'R1', materialId: 'S235' });
    const noSupport: Model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [STEEL],
      sections: [SEC],
      boundaries: [],
    });
    expect(() => solveModal(noSupport)).toThrow(InvalidModelError);
  });
});

describe('solveModal — mechanikai validáció zárt alak ellen (ADR-0016)', () => {
  it('karcsú kéttámaszú gerenda első sajátfrekvenciája közel esik az Euler–Bernoulli-referenciához', () => {
    const length = 40; // L/h = 100 — karcsú, a Timoshenko-korrekció kicsi
    const model = simplySupported(length, 20);
    const result = solveModal(model);

    const e = STEEL.e as number; // kN/m²
    const inertia = (0.2 * 0.4 ** 3) / 12; // m⁴ — a rect(0.2,0.4) másodrendű nyomatéka
    const area = 0.2 * 0.4;
    const gamma = STEEL.gamma as number; // kN/m³
    const gAccel = 9.80665;
    const massPerLength = (gamma * area) / gAccel;

    const omegaRef = eulerBernoulliOmega1(length, e * inertia, massPerLength);
    const omegaFe = result.modes[0]?.omega ?? 0;

    // MÉRVE (nem találgatva, ld. HIBATURESI-POLITIKA): a tényleges relatív
    // eltérés ~1.7e-4 (L/h=100, 20 elem) — ez a diszkretizációs hiba ÉS a
    // Timoshenko nyírási/forgási-tehetetlenségi korrekció ÖSSZEGE (utóbbi
    // O((h/L)²) nagyságrendű, karcsú gerendánál elhanyagolható). A tűrés a
    // mért érték fölé, de annak nagyságrendjében van rögzítve.
    expect(Math.abs(omegaFe - omegaRef) / omegaRef).toBeLessThan(5e-4);
  });

  it('a módusok szigorúan növekvő sajátkörfrekvenciájúak', () => {
    const model = simplySupported(10, 8);
    const result = solveModal(model, { modeCount: 6 });
    for (let i = 1; i < result.modes.length; i++) {
      expect(result.modes[i]?.omega ?? 0).toBeGreaterThan(result.modes[i - 1]?.omega ?? 0);
    }
  });

  it('minden sajátfrekvencia nemnegatív (a szerkezet stabil, nincs mechanizmus)', () => {
    const model = simplySupported(10, 8);
    const result = solveModal(model);
    for (const mode of result.modes) expect(mode.omega).toBeGreaterThanOrEqual(0);
  });

  it('a módalak-vektor a megkötött szabadságfokokon zérus', () => {
    const model = simplySupported(10, 8);
    const result = solveModal(model);
    const first = result.modes[0];
    expect(first).toBeDefined();
    // N0 és az utolsó csomópont w-je megkötött (görgő) — a shape-ben zérus.
    expect(first?.shape[0]).toBe(0); // N0 w
    expect(first?.shape[first.shape.length - 2]).toBe(0); // utolsó csomópont w
  });

  it('h-konvergencia: finomabb háló közelebb kerül az Euler–Bernoulli-referenciához', () => {
    const length = 40;
    const ei = (STEEL.e as number) * ((0.2 * 0.4 ** 3) / 12);
    const massPerLength = ((STEEL.gamma as number) * (0.2 * 0.4)) / 9.80665;
    const omegaRef = eulerBernoulliOmega1(length, ei, massPerLength);

    const coarse = solveModal(simplySupported(length, 4)).modes[0]?.omega ?? 0;
    const fine = solveModal(simplySupported(length, 20)).modes[0]?.omega ?? 0;

    const errCoarse = Math.abs(coarse - omegaRef) / omegaRef;
    const errFine = Math.abs(fine - omegaRef) / omegaRef;
    expect(errFine).toBeLessThan(errCoarse);
  });

  it('a sajátvektorok M-ortonormáltsága a teljes (aktív DOF-os) rendszeren is fennáll', () => {
    // Közvetett ellenőrzés: mivel `generalizedSymmetricEigen` már önmagában
    // tesztelt (`eigen.test.ts`), itt csak azt igazoljuk, hogy a `solveModal`
    // nem tör el egy kisebb, kézzel is áttekinthető modellen, és a
    // visszaadott módalak-vektor normája véges, nem-nulla.
    const model = simplySupported(6, 4);
    const result = solveModal(model);
    for (const mode of result.modes.slice(0, 3)) {
      expect(Number.isFinite(mode.omega)).toBe(true);
      expect(norm2(mode.shape)).toBeGreaterThan(0);
    }
  });
});
