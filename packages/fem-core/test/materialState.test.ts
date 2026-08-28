import { describe, expect, it } from 'vitest';
import {
  elementMaterialData,
  initialNonlinearState,
  isGaussPointYielded,
  updateGaussPointState,
} from '../src/solver/materialState.js';
import {
  buildModel,
  fixed,
  makeLayeredSection,
  makeMaterial,
  makeSection,
  nodalForce,
  rect,
  uniformMesh,
} from '../src/index.js';

const STEEL = makeMaterial('S1', 'Acél', { e: 2.1e8, sigmaY: 2.35e5, hPrime: 5e7 });
const ELASTIC = makeMaterial('S0', 'Rugalmas', { e: 2.1e8 });
const SEC = makeSection('R', 'Téglalap', rect(0.2, 0.4));

function simpleCantilever(material = STEEL): ReturnType<typeof buildModel> {
  const mesh = uniformMesh(4, 1, { sectionId: 'R', materialId: material.id as string });
  return buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [SEC],
    boundaries: [fixed('N0')],
    loads: [nodalForce('N2', -10, 'F1')],
  });
}

describe('elementMaterialData', () => {
  it('parametrikus szelvénynél "resultant" adatot ad, a helyes M0-lal', () => {
    const model = simpleCantilever();
    const el = model.elements[0];
    if (el === undefined) throw new Error('hiányzó elem');
    const data = elementMaterialData(model, el);
    expect(data.kind).toBe('resultant');
    if (data.kind !== 'resultant') return;
    expect(data.ei).toBeCloseTo((STEEL.e as number) * ((0.2 * 0.4 ** 3) / 12), 4);
    expect(data.m0).toBeCloseTo((STEEL.sigmaY as number) * ((0.2 * 0.4 ** 2) / 4), 4);
    expect(data.hPrime).toBe(STEEL.hPrime as number);
  });

  it('folyáshatár nélküli anyagnál m0 = +∞ (sosem folyik meg)', () => {
    const model = simpleCantilever(ELASTIC);
    const el = model.elements[0];
    if (el === undefined) throw new Error('hiányzó elem');
    const data = elementMaterialData(model, el);
    if (data.kind !== 'resultant') throw new Error('resultant várt');
    expect(data.m0).toBe(Number.POSITIVE_INFINITY);
  });

  it('rétegelt szelvénynél "layered" adatot ad, rétegenkénti anyaggal', () => {
    const layered = makeLayeredSection('L1', 'Rétegelt', [
      { b: 0.2, t: 0.1, z: -0.15 },
      { b: 0.2, t: 0.2, z: 0 },
      { b: 0.2, t: 0.1, z: 0.15 },
    ]);
    const mesh = uniformMesh(4, 1, { sectionId: 'L1', materialId: 'S1' });
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [STEEL],
      sections: [layered],
      boundaries: [fixed('N0')],
      loads: [nodalForce('N2', -10, 'F1')],
    });
    const el = model.elements[0];
    if (el === undefined) throw new Error('hiányzó elem');
    const data = elementMaterialData(model, el);
    expect(data.kind).toBe('layered');
    if (data.kind !== 'layered') return;
    expect(data.layers).toHaveLength(3);
    expect(data.layers[1]?.t).toBeCloseTo(0.2, 12);
  });
});

describe('initialNonlinearState / updateGaussPointState — "resultant" eset', () => {
  const model = simpleCantilever();
  const el = model.elements[0];
  if (el === undefined) throw new Error('hiányzó elem');
  const data = elementMaterialData(model, el);

  it('a kezdeti állapot terheletlen (m=0, kappa=0, nem folyt)', () => {
    const states = initialNonlinearState([el.id], new Map([[el.id, data]]));
    const st = states.get(el.id);
    if (st === undefined) throw new Error('hiányzó állapot');
    for (const gp of st.gaussPoints) {
      expect(gp.kappa).toBe(0);
      expect(gp.m).toBe(0);
      expect(isGaussPointYielded(gp)).toBe(false);
    }
  });

  it('kis Δκ-ra rugalmas marad, M = EI·κ', () => {
    if (data.kind !== 'resultant') throw new Error('resultant várt');
    const states = initialNonlinearState([el.id], new Map([[el.id, data]]));
    const st = states.get(el.id);
    if (st === undefined) throw new Error('hiányzó állapot');
    const gp0 = st.gaussPoints[0];
    if (gp0 === undefined) throw new Error('hiányzó GP');
    const updated = updateGaussPointState(data, gp0, 0.0001);
    expect(updated.m).toBeCloseTo(data.ei * 0.0001, 6);
    expect(isGaussPointYielded(updated)).toBe(false);
  });

  it('nagy Δκ-ra folyóvá válik, M a folyási plafon közelébe kerül', () => {
    if (data.kind !== 'resultant') throw new Error('resultant várt');
    const states = initialNonlinearState([el.id], new Map([[el.id, data]]));
    const st = states.get(el.id);
    if (st === undefined) throw new Error('hiányzó állapot');
    const gp0 = st.gaussPoints[0];
    if (gp0 === undefined) throw new Error('hiányzó GP');
    const kappaY = data.m0 / data.ei;
    const updated = updateGaussPointState(data, gp0, 5 * kappaY);
    expect(isGaussPointYielded(updated)).toBe(true);
    expect(updated.m).toBeGreaterThan(data.m0 * 0.99);
  });
});

describe('initialNonlinearState / updateGaussPointState — "layered" eset', () => {
  const layered = makeLayeredSection('L2', 'Rétegelt', [
    { b: 0.2, t: 0.1, z: -0.15 },
    { b: 0.2, t: 0.2, z: 0 },
    { b: 0.2, t: 0.1, z: 0.15 },
  ]);
  const mesh = uniformMesh(4, 1, { sectionId: 'L2', materialId: 'S1' });
  const model = buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [STEEL],
    sections: [layered],
    boundaries: [fixed('N0')],
    loads: [nodalForce('N2', -10, 'F1')],
  });
  const el = model.elements[0];
  if (el === undefined) throw new Error('hiányzó elem');
  const data = elementMaterialData(model, el);

  it('kis Δκ-ra minden réteg rugalmas marad, M = EI·κ', () => {
    if (data.kind !== 'layered') throw new Error('layered várt');
    const states = initialNonlinearState([el.id], new Map([[el.id, data]]));
    const st = states.get(el.id);
    if (st === undefined) throw new Error('hiányzó állapot');
    const gp0 = st.gaussPoints[0];
    if (gp0 === undefined) throw new Error('hiányzó GP');
    const updated = updateGaussPointState(data, gp0, 0.0001);
    expect(isGaussPointYielded(updated)).toBe(false);
    expect(updated.m).toBeCloseTo(gp0.tangentEi * 0.0001, 4);
  });

  it('nagy Δκ-ra a szélső rétegek folyóvá válnak, a tangens EI csökken', () => {
    if (data.kind !== 'layered') throw new Error('layered várt');
    const states = initialNonlinearState([el.id], new Map([[el.id, data]]));
    const st = states.get(el.id);
    if (st === undefined) throw new Error('hiányzó állapot');
    const gp0 = st.gaussPoints[0];
    if (gp0 === undefined) throw new Error('hiányzó GP');
    const updated = updateGaussPointState(data, gp0, 0.01);
    expect(isGaussPointYielded(updated)).toBe(true);
    expect(updated.tangentEi).toBeLessThan(gp0.tangentEi);
  });
});
