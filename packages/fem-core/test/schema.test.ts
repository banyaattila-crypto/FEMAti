import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildModel,
  circle,
  distributedForce,
  elementId,
  fixed,
  foundation,
  iProfile,
  kNm,
  kNpm,
  makeLayeredSection,
  makeMaterial,
  makeSection,
  nodalForce,
  nodalMoment,
  nodeId,
  parabolicForce,
  parseModelFile,
  parseModelJson,
  rect,
  resetLoadIds,
  selfWeight,
  serializeModel,
  serializeModelJson,
  springSupport,
  supportDisplacement,
  thermal,
  tube,
  uniformMesh,
  type Load,
  type Model,
} from '../src/index.js';

/** Mély összehasonlítás lebegőpontos tűréssel (a cm ↔ m átváltás miatt). */
function roundDeep(value: unknown, digits = 12): unknown {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value === 0) return value;
    const f = 10 ** (digits - Math.ceil(Math.log10(Math.abs(value))));
    return Math.round(value * f) / f;
  }
  if (Array.isArray(value)) return value.map((v) => roundDeep(v, digits));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, roundDeep(v, digits)]));
  }
  return value;
}

const expectRoundTrip = (m: Model): void => {
  expect(roundDeep(parseModelFile(serializeModel(m)))).toEqual(roundDeep(m));
};

const MAT = makeMaterial('S235', 'Acél S235', {
  e: 2.1e8,
  nu: 0.3,
  alpha: 1.2e-5,
  density: 7850,
  sigmaY: 2.35e5,
  hPrime: 4.2e6,
});

function withLoads(loads: readonly Load[]): Model {
  const mesh = uniformMesh(6, 2, { sectionId: 'R1', materialId: 'S235' });
  return buildModel({
    name: 'Séma-teszt',
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [MAT],
    sections: [makeSection('R1', 'Téglalap', rect(0.2, 0.4))],
    boundaries: [fixed('N0')],
    loads,
  });
}

beforeEach(() => resetLoadIds());

describe('.femati.json — minden tehertípus túléli a körutat', () => {
  it('koncentrált erő és nyomaték', () => {
    expectRoundTrip(withLoads([nodalForce('N4', -12.5, 'F1'), nodalMoment('N2', 8.25, 'M1')]));
  });

  it('lineárisan megoszló (trapéz) teher', () => {
    expectRoundTrip(withLoads([distributedForce(0, 6, 3, 7, 'Q1')]));
  });

  it('parabolikus megoszló teher', () => {
    expectRoundTrip(withLoads([parabolicForce(1, 5, 2, 9, 4, 'QP1')]));
  });

  it('megoszló nyomaték', () => {
    const m: Load = {
      id: 'DM1' as never,
      kind: 'distributed-moment',
      x1: 0 as never,
      x2: 6 as never,
      m1: kNm(2) as never,
      m2: kNm(5) as never,
    };
    expectRoundTrip(withLoads([m]));
  });

  it('önsúly tehernövelő tényezővel', () => {
    expectRoundTrip(withLoads([selfWeight(1.35, 'G1')]));
  });

  it('hőteher elemlistával', () => {
    const t = { ...thermal(5, 25, 10, 'T1'), elementIds: [elementId('E0')] };
    expectRoundTrip(withLoads([t]));
  });

  it('hőteher elemlista nélkül (minden elemre)', () => {
    expectRoundTrip(withLoads([thermal(5, 25, 10, 'T2')]));
  });

  it('támaszmozgás csak eltolódással', () => {
    expectRoundTrip(withLoads([supportDisplacement('N0', -0.012, undefined, 'D1')]));
  });

  it('támaszmozgás csak elfordulással', () => {
    expectRoundTrip(withLoads([supportDisplacement('N0', undefined, 0.0015, 'D2')]));
  });

  it('támaszmozgás mindkét komponenssel', () => {
    expectRoundTrip(withLoads([supportDisplacement('N0', -0.012, 0.0015, 'D3')]));
  });
});

describe('.femati.json — megtámasztások és ágyazat', () => {
  it('rugós támasz mindkét rugóállandóval', () => {
    const m = withLoads([]);
    expectRoundTrip({
      ...m,
      boundaries: [{ nodeId: nodeId('N0'), wFixed: false, phiFixed: false, springW: kNpm(5000), springPhi: kNm(1200) }],
    });
  });

  it('rugós támasz csak eltolódási rugóval', () => {
    const m = withLoads([]);
    expectRoundTrip({ ...m, boundaries: [springSupport('N0', 5000), fixed('N4')] });
  });

  it('rugalmas ágyazat', () => {
    const m = withLoads([]);
    expectRoundTrip({ ...m, foundations: [foundation(0, 6, 8000)] });
  });
});

describe('.femati.json — keresztmetszet-típusok', () => {
  const withSection = (s: ReturnType<typeof makeSection>): Model => {
    const m = withLoads([]);
    return { ...m, sections: [s], elements: m.elements.map((e) => ({ ...e, sectionId: s.id })) };
  };

  it('kör', () => expectRoundTrip(withSection(makeSection('C1', 'Kör ⌀200', circle(0.2)))));

  it('cső', () => expectRoundTrip(withSection(makeSection('T1', 'Cső ⌀200×10', tube(0.2, 0.01)))));

  it('I-szelvény', () => expectRoundTrip(withSection(makeSection('I1', 'IPE 300', iProfile(0.3, 0.15, 0.0071, 0.0107)))));

  it('rétegelt, anyaghivatkozással', () => {
    const layered = makeLayeredSection(
      'L1',
      'Kompozit',
      [
        { b: 0.2, t: 0.1, z: -0.05, materialId: 'S235' },
        { b: 0.2, t: 0.1, z: 0.05 },
      ],
      5 / 6,
      true,
    );
    const m = withLoads([]);
    expectRoundTrip({
      ...m,
      sections: [layered],
      elements: m.elements.map((e) => ({ ...e, sectionId: layered.id })),
    });
  });
});

describe('.femati.json — anyagvariánsok', () => {
  it('folyáshatár és keményedés nélküli (csak rugalmas) anyag', () => {
    const m = withLoads([]);
    expectRoundTrip({ ...m, materials: [makeMaterial('C25', 'Beton', { e: 3.1e7, nu: 0.2, density: 2500 })] });
  });

  it('csak folyáshatárral megadott anyag', () => {
    const m = withLoads([]);
    expectRoundTrip({
      ...m,
      materials: [makeMaterial('S355', 'Acél', { e: 2.1e8, sigmaY: 3.55e5, density: 7850 })],
    });
  });

  it('csak keményedéssel megadott anyag', () => {
    const m = withLoads([]);
    expectRoundTrip({
      ...m,
      materials: [makeMaterial('X', 'Kísérleti', { e: 2.1e8, hPrime: 1e6, density: 7850 })],
    });
  });
});

describe('.femati.json — metaadatok és tehertörténet', () => {
  it('leírás és létrehozási dátum megmarad', () => {
    const m = withLoads([]);
    expectRoundTrip({
      ...m,
      meta: { name: 'Kétnyílású', description: 'P-08 validációs eset', createdAt: '2026-08-20' },
    });
  });

  it('többlépcsős tehertörténet (tehermentesítéssel)', () => {
    const m = withLoads([]);
    expectRoundTrip({ ...m, history: { lambdaTargets: [1.2, 0], stepsPerTarget: 12 } });
  });

  it('teljes integrálású elem', () => {
    const m = withLoads([]);
    expectRoundTrip({ ...m, elements: m.elements.map((e) => ({ ...e, integration: 'full' as const })) });
  });
});

describe('.femati.json — JSON szöveges út', () => {
  it('a szöveggé alakítás és visszaolvasás körútja is zárt', () => {
    const m = withLoads([nodalForce('N4', -10, 'F1'), thermal(0, 20, 0, 'T1')]);
    const text = serializeModelJson(m);
    expect(text).toContain('"schemaVersion": 1');
    expect(roundDeep(parseModelJson(text))).toEqual(roundDeep(m));
  });

  it('a kiírt JSON érvényes és beolvasható', () => {
    const m = withLoads([]);
    expect(() => JSON.parse(serializeModelJson(m)) as unknown).not.toThrow();
  });
});

describe('.femati.json — hibás bemenet', () => {
  it('hiányzó kötelező mezőkre kivételt dob', () => {
    expect(() => parseModelFile({ schemaVersion: 1 })).toThrow();
  });

  it('ismeretlen sémaverzióra kivételt dob', () => {
    const m = serializeModel(withLoads([]));
    expect(() => parseModelFile({ ...m, schemaVersion: 2 })).toThrow();
  });

  it('üres csomópontlistára kivételt dob', () => {
    const m = serializeModel(withLoads([]));
    expect(() => parseModelFile({ ...m, nodes: [] })).toThrow();
  });

  it('nem véges számra kivételt dob', () => {
    const m = serializeModel(withLoads([]));
    const broken = { ...m, nodes: [{ id: 'N0', x: Number.NaN }] };
    expect(() => parseModelFile(broken)).toThrow();
  });

  it('nem pozitív rugalmassági modulusra kivételt dob', () => {
    const m = serializeModel(withLoads([]));
    const broken = { ...m, materials: m.materials.map((x) => ({ ...x, E: -1 })) };
    expect(() => parseModelFile(broken)).toThrow();
  });

  it('érvénytelen integrálási sémára kivételt dob', () => {
    const m = serializeModel(withLoads([]));
    const broken = { ...m, elements: m.elements.map((e) => ({ ...e, integration: 'reduced' })) };
    expect(() => parseModelFile(broken)).toThrow();
  });
});

describe('.femati.json — alapértelmezések', () => {
  it('a hiányzó opcionális mezők a séma alapértelmezéseit veszik fel', () => {
    const minimal = {
      schemaVersion: 1,
      meta: { name: 'Minimális' },
      nodes: [
        { id: 'N0', x: 0 },
        { id: 'N1', x: 1 },
        { id: 'N2', x: 2 },
      ],
      materials: [{ id: 'M', name: 'Anyag', E: 21000 }],
      sections: [{ kind: 'parametric', id: 'S', name: 'Sz', shape: { kind: 'rect', b: 20, h: 40 } }],
      elements: [{ id: 'E0', nodes: ['N0', 'N1', 'N2'], sectionId: 'S', materialId: 'M' }],
    };
    const model = parseModelFile(minimal);
    expect(model.elements[0]?.integration).toBe('selective');
    expect(model.materials[0]?.nu as number).toBe(0.3);
    // G = E / (2(1+ν)) automatikusan
    expect(model.materials[0]?.g as number).toBeCloseTo(2.1e8 / 2.6, 0);
    expect(model.history.lambdaTargets).toEqual([1]);
    expect(model.loads).toEqual([]);
  });
});
