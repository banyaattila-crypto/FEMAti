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
  generateLayers,
  iProfile,
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

  it('vastagságosztályos anyagnál (fy1/fy2/thicknessThreshold) a rétegek a saját plateThickness-ük szerint kapnak folyáshatárt', () => {
    // E) fázis: a réteg SAJÁT szeletvastagsága (t=0.1/0.2/0.1) itt SZÁNDÉKOSAN
    // különbözik a plateThickness-től (0.03/0.05) — pontosan ez a lényeg,
    // hogy a kettő független (ld. docs/ADR).
    const classedSteel = makeMaterial('S2', 'Osztályos acél', {
      e: 2.1e8,
      sigmaY: 2.0e5, // egységes érték — CSAK akkor érvényesülne, ha nincs fy1/fy2
      fy1: 2.35e5,
      fy2: 2.15e5,
      thicknessThreshold: 0.04,
    });
    const layered = makeLayeredSection('L3', 'Vastagságosztályos', [
      { b: 0.2, t: 0.1, z: -0.1, plateThickness: 0.03 }, // vékony (≤40mm) → fy1
      { b: 0.2, t: 0.1, z: 0.1, plateThickness: 0.05 }, // vastag (>40mm) → fy2
    ]);
    const mesh = uniformMesh(4, 1, { sectionId: 'L3', materialId: 'S2' });
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [classedSteel],
      sections: [layered],
      boundaries: [fixed('N0')],
      loads: [nodalForce('N2', -10, 'F1')],
    });
    const el = model.elements[0];
    if (el === undefined) throw new Error('hiányzó elem');
    const data = elementMaterialData(model, el);
    if (data.kind !== 'layered') throw new Error('layered várt');
    expect(data.layers[0]?.sigmaY).toBeCloseTo(2.35e5, 6);
    expect(data.layers[1]?.sigmaY).toBeCloseTo(2.15e5, 6);
  });

  it('vastagságosztály nélküli anyagnál (fy1/fy2 hiányzik) az egységes sigmaY érvényes minden rétegre, plateThickness-től függetlenül', () => {
    const layered = makeLayeredSection('L4', 'Egységes', [
      { b: 0.2, t: 0.1, z: -0.1, plateThickness: 0.03 },
      { b: 0.2, t: 0.1, z: 0.1, plateThickness: 0.05 },
    ]);
    const mesh = uniformMesh(4, 1, { sectionId: 'L4', materialId: 'S1' });
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
    if (data.kind !== 'layered') throw new Error('layered várt');
    expect(data.layers[0]?.sigmaY).toBeCloseTo(STEEL.sigmaY as number, 6);
    expect(data.layers[1]?.sigmaY).toBeCloseTo(STEEL.sigmaY as number, 6);
  });

  it('valódi I-szelvényből generált rétegzésnél az öv-rétegek tf-et, a gerinc-rétegek tw-t kapnak plateThickness gyanánt', () => {
    // Mesterségesen szélsőséges (nem valós katalógus-) I-alak: tf=0.05 (a
    // küszöb FÖLÉ), tw=0.02 (a küszöb ALÁ) esik — hogy a két osztály
    // egyértelműen szétváljon.
    const shape = iProfile(0.3, 0.15, 0.02, 0.05);
    const rawLayers = generateLayers(shape, 16);
    const flangeLayer = rawLayers.find((l) => Math.abs(l.z) > 0.12); // hw/2 = (0.3-0.1)/2=0.1, öv ezen kívül
    const webLayer = rawLayers.find((l) => Math.abs(l.z) < 0.08);
    if (flangeLayer === undefined || webLayer === undefined) throw new Error('hiányzó réteg');
    expect(flangeLayer.plateThickness).toBeCloseTo(0.05, 12);
    expect(webLayer.plateThickness).toBeCloseTo(0.02, 12);
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

describe('updateGaussPointState — beton (EC2 parabola-téglalap) réteg, F) fázis', () => {
  // Vasalatlan (csak beton) téglalap keresztmetszet, C30/37-szerű, kerek
  // paraméterekkel — a hajlítás alatt a húzott oldal REPEDT (σ=0), a teljes
  // nyomatékot a nyomott oldal adja. Ez egy modell-szintű, "a repedt
  // keresztmetszet feltételezése ténylegesen érvényesül" ellenőrzés — nem
  // hajlítási teherbírás-számítás (ahhoz vasalás kellene).
  const CONCRETE = makeMaterial('C30', 'C30/37-szerű', {
    e: 3.284e7, // kN/m² (Ecm, C30/37-hez közeli kerekített érték)
    fck: 3.0e4, // 30 MPa
    epsC2: 0.002,
    epsCu2: 0.0035,
    n: 2,
  });
  const shape = rect(0.3, 0.5);
  const rawLayers = generateLayers(shape, 40);
  const section = makeLayeredSection(
    'CRECT',
    'Beton téglalap',
    rawLayers.map((l) => ({ b: l.b, t: l.t, z: l.z })),
  );
  const mesh = uniformMesh(4, 1, { sectionId: 'CRECT', materialId: 'C30' });
  const model = buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [CONCRETE],
    sections: [section],
    boundaries: [fixed('N0')],
    loads: [nodalForce('N2', -10, 'F1')],
  });
  const el = model.elements[0];
  if (el === undefined) throw new Error('hiányzó elem');
  const data = elementMaterialData(model, el);

  it('a rétegek beton-paramétereket kapnak (a "concrete" ág aktiválódik)', () => {
    if (data.kind !== 'layered') throw new Error('layered várt');
    for (const layer of data.layers) {
      expect(layer.concrete?.fck).toBeCloseTo(3.0e4, 6);
    }
  });

  it('pozitív κ-nál (z>0 = húzott oldal, a projekt előjelkonvenciója szerint) a húzott rétegek feszültsége PONTOSAN 0 — a repedt keresztmetszet feltételezése ténylegesen érvényesül', () => {
    if (data.kind !== 'layered') throw new Error('layered várt');
    const states = initialNonlinearState([el.id], new Map([[el.id, data]]));
    const st = states.get(el.id);
    if (st === undefined) throw new Error('hiányzó állapot');
    const gp0 = st.gaussPoints[0];
    if (gp0 === undefined) throw new Error('hiányzó GP');
    const updated = updateGaussPointState(data, gp0, 0.01);
    if (updated.kind !== 'layered') throw new Error('layered várt');
    for (let i = 0; i < data.layers.length; i++) {
      const layer = data.layers[i];
      const layerState = updated.layers[i];
      if (layer === undefined || layerState === undefined) continue;
      if (layer.z > 0) expect(layerState.sigma).toBe(0);
    }
  });

  it('a görbület növelésével a nyomatéki válasz nagysága nő (nyomott oldal fokozódó igénybevétele), amíg zúzódás nem lép fel', () => {
    if (data.kind !== 'layered') throw new Error('layered várt');
    const states = initialNonlinearState([el.id], new Map([[el.id, data]]));
    const st = states.get(el.id);
    if (st === undefined) throw new Error('hiányzó állapot');
    const gp0 = st.gaussPoints[0];
    if (gp0 === undefined) throw new Error('hiányzó GP');
    const small = updateGaussPointState(data, gp0, 0.005);
    const larger = updateGaussPointState(data, gp0, 0.012);
    expect(Math.abs(larger.m)).toBeGreaterThan(Math.abs(small.m));
  });
});
