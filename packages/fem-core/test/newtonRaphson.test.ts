/**
 * Célzott tesztek a `newtonRaphson.ts` addig lefedetlen ÁGAIRA (nem csak
 * a "boldog úthoz" — konvergált lépés — kapcsolódó statement-ekre): az
 * `initial-stiffness` algoritmus-ág, az iterMax-on belül nem konvergáló
 * lépés ága, és a `SingularMatrixError` elkapási ága.
 *
 * `runNewtonRaphsonStep`-et KÖZVETLENÜL hívjuk (nem `runLoadStepper`-en
 * keresztül), hogy pontosan a kívánt ágat célozzuk meg egyetlen hívással,
 * a `loadStepper.ts` saját retry/felezés-logikája nélkül.
 */
import { describe, expect, it } from 'vitest';
import {
  assemble,
  buildLoadVector,
  buildModel,
  elementMaterialData,
  fixed,
  foundation,
  initialNonlinearState,
  makeMaterial,
  makeSection,
  nodalForce,
  rect,
  resetLoadIds,
  runNewtonRaphsonStep,
  SingularMatrixError,
  uniformMesh,
  type ElementMaterialData,
  type Model,
} from '../src/index.js';

const SEC = makeSection('R', 'Téglalap', rect(0.2, 0.4));
const L = 4;

function cantileverModel(material: ReturnType<typeof makeMaterial>, force: number, elementCount = 4): Model {
  resetLoadIds();
  const mesh = uniformMesh(L, elementCount, { sectionId: 'R', materialId: material.id as string });
  const tipNode = `N${2 * elementCount}`;
  return buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [SEC],
    boundaries: [fixed('N0')],
    loads: [nodalForce(tipNode, force, 'F1')],
  });
}

function setup(model: Model) {
  const system = assemble(model, { strategy: 'elimination' });
  const k0 = system.k;
  k0.factorize();
  const materialData = new Map<string, ElementMaterialData>();
  for (const element of model.elements) {
    materialData.set(element.id as string, elementMaterialData(model, element));
  }
  const states = initialNonlinearState(
    system.elements.map((e) => e.id),
    materialData,
  );
  const u = new Float64Array(system.map.activeDofs);
  return { system, k0, materialData, states, u };
}

describe('runNewtonRaphsonStep — "initial-stiffness" algoritmus-ág', () => {
  it('konzisztensen konvergál egy rugalmas terhelésre (a K_T mindig a KEZDETI, k0 mátrix)', () => {
    const elastic = makeMaterial('EL-IS', 'Rugalmas', { e: 2.1e8 });
    const model = cantileverModel(elastic, -5);
    const { system, k0, materialData, states, u } = setup(model);

    const loads = buildLoadVector(model, system.map, 1);
    const fTarget = new Float64Array(system.map.activeDofs);
    for (let a = 0; a < fTarget.length; a++) fTarget[a] = (loads.active[a] ?? 0) + (system.constraintLoad[a] ?? 0);

    const result = runNewtonRaphsonStep(system, model, materialData, k0, u, states, fTarget, {
      algorithm: 'initial-stiffness',
      iterMax: 30,
      tolerancePercent: 1e-4,
    });

    expect(result.converged).toBe(true);
    // Rugalmas anyagnál a kezdeti (és minden további) merevség UGYANAZ —
    // az `initial-stiffness` mód így ELMÉLETBEN 1 iterációban konvergál.
    expect(result.iterations.length).toBeLessThanOrEqual(2);
  });
});

describe('runNewtonRaphsonStep — iterMax elérése konvergencia nélkül', () => {
  it('túl kevés megengedett iterációnál (egy valóban képlékeny lépésnél) converged=false-t ad, és az utolsó iteráció száma == iterMax', () => {
    const plastic = makeMaterial('PL-ITMAX', 'Képlékeny', { e: 2.1e8, sigmaY: 2.35e5 });
    // Nagy erő — messze a rugalmas tartományon túl, sok Newton-iterációt igényelne.
    const model = cantileverModel(plastic, -60);
    const { system, k0, materialData, states, u } = setup(model);

    const loads = buildLoadVector(model, system.map, 1);
    const fTarget = new Float64Array(system.map.activeDofs);
    for (let a = 0; a < fTarget.length; a++) fTarget[a] = (loads.active[a] ?? 0) + (system.constraintLoad[a] ?? 0);

    const result = runNewtonRaphsonStep(system, model, materialData, k0, u, states, fTarget, {
      algorithm: 'newton',
      iterMax: 1,
      tolerancePercent: 1e-6,
    });

    expect(result.converged).toBe(false);
    expect(result.iterations).toHaveLength(1);
    expect(result.iterations[0]?.iteration).toBe(1);
  });
});

describe('runNewtonRaphsonStep — rugalmas ágyazat (Winkler) az internal-force összegzésben', () => {
  it('diszkrét támasz nélkül, csak ágyazattal is konvergál (a `foundationC > 0` ág ténylegesen lefut)', () => {
    const material = makeMaterial('EL-FOUND', 'Rugalmas', { e: 2.1e8 });
    resetLoadIds();
    const mesh = uniformMesh(L, 6, { sectionId: 'R', materialId: 'EL-FOUND' });
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [material],
      sections: [SEC],
      boundaries: [],
      foundations: [foundation(0, L, 8000)],
      loads: [nodalForce('N6', -20, 'F1')],
    });
    const { system, k0, materialData, states, u } = setup(model);

    const loads = buildLoadVector(model, system.map, 1);
    const fTarget = new Float64Array(system.map.activeDofs);
    for (let a = 0; a < fTarget.length; a++) fTarget[a] = (loads.active[a] ?? 0) + (system.constraintLoad[a] ?? 0);

    const result = runNewtonRaphsonStep(system, model, materialData, k0, u, states, fTarget, {
      algorithm: 'newton',
      iterMax: 30,
      tolerancePercent: 1e-4,
    });

    expect(result.converged).toBe(true);
  });
});

describe('runNewtonRaphsonStep — SingularMatrixError elkapása (mechanizmus)', () => {
  it('megtámasztás nélküli (szabad test) modellnél converged=false-t ad kivétel helyett, displacementIncrementNorm=Infinity jelzéssel', () => {
    resetLoadIds();
    const material = makeMaterial('EL-SING', 'Rugalmas', { e: 2.1e8 });
    const mesh = uniformMesh(L, 2, { sectionId: 'R', materialId: 'EL-SING' });
    const mechanism = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [material],
      sections: [SEC],
      boundaries: [], // NINCS megtámasztás — szabad test, K_T szinguláris.
      loads: [nodalForce(`N${mesh.nodes.length - 1}`, -1, 'F1')],
    });

    const system = assemble(mechanism, { strategy: 'elimination' });
    // A kezdeti k0-t NEM faktorizáljuk (mechanizmusnál ez maga is
    // SingularMatrixError-t dobna) — `algorithm: 'newton'` esetén a
    // `runNewtonRaphsonStep` k0-t nem használja közvetlenül, csak a
    // Gauss-elimináció alapjául szolgáló TANGENS mátrixot építi újra és
    // AZT próbálja megoldani, ami szintén szinguláris.
    const materialData = new Map<string, ElementMaterialData>();
    for (const element of mechanism.elements) {
      materialData.set(element.id as string, elementMaterialData(mechanism, element));
    }
    const states = initialNonlinearState(
      system.elements.map((e) => e.id),
      materialData,
    );
    const u = new Float64Array(system.map.activeDofs);

    const loads = buildLoadVector(mechanism, system.map, 1);
    const fTarget = new Float64Array(system.map.activeDofs);
    for (let a = 0; a < fTarget.length; a++) fTarget[a] = (loads.active[a] ?? 0) + (system.constraintLoad[a] ?? 0);

    let result: ReturnType<typeof runNewtonRaphsonStep> | undefined;
    expect(() => {
      result = runNewtonRaphsonStep(system, mechanism, materialData, system.k, u, states, fTarget, {
        algorithm: 'newton',
        iterMax: 30,
        tolerancePercent: 1e-4,
      });
    }).not.toThrow(SingularMatrixError);

    expect(result?.converged).toBe(false);
    expect(result?.iterations.at(-1)?.displacementIncrementNorm).toBe(Number.POSITIVE_INFINITY);
  });
});
