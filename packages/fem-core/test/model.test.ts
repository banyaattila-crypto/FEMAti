import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildModel,
  distributedForce,
  fixed,
  isRunnable,
  makeLayeredSection,
  makeMaterial,
  makeSection,
  nodalForce,
  parseModelFile,
  pinned,
  rect,
  resetLoadIds,
  serializeModel,
  thermal,
  uniformMesh,
  validateModel,
  FEMAti_SCHEMA_VERSION,
  type Model,
} from '../src/index.js';

const STEEL = makeMaterial('S235', 'Acél S235', {
  e: 2.1e8, // 21000 kN/cm²
  nu: 0.3,
  alpha: 1.2e-5,
  density: 7850,
  sigmaY: 2.35e5, // 23.5 kN/cm²
  hPrime: 0,
});

const SEC = makeSection('R1', 'Téglalap 20/40', rect(0.2, 0.4));

function cantilever(elements = 4): Model {
  const mesh = uniformMesh(5, elements, { sectionId: 'R1', materialId: 'S235' });
  return buildModel({
    name: 'Konzol',
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [STEEL],
    sections: [SEC],
    boundaries: [fixed('N0')],
    loads: [nodalForce(`N${2 * elements}`, 10, 'F1')],
  });
}

beforeEach(() => {
  resetLoadIds();
});

/**
 * Mély összehasonlítás lebegőpontos tűréssel.
 * A cm ↔ m átváltás az utolsó biten nem inverz (0.025 · 100 · 0.01 ≠ 0.025),
 * ezért a körút veszteségmentességét relatív tűréssel ellenőrizzük, nem
 * bit-azonossággal. A mérnöki jelentés szempontjából 1e-12 relatív hiba
 * nagyságrendekkel a modellezési pontosság alatt van.
 */
function roundDeep(value: unknown, digits = 12): unknown {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value === 0) return value;
    const factor = 10 ** (digits - Math.ceil(Math.log10(Math.abs(value))));
    return Math.round(value * factor) / factor;
  }
  if (Array.isArray(value)) return value.map((v) => roundDeep(v, digits));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, roundDeep(v, digits)]),
    );
  }
  return value;
}

const expectRoundTrip = (model: Model): void => {
  expect(roundDeep(parseModelFile(serializeModel(model)))).toEqual(roundDeep(model));
};

describe('uniformMesh', () => {
  it('n elemhez 2n+1 csomópontot generál', () => {
    const { nodes, elements } = uniformMesh(6, 3, { sectionId: 'R1', materialId: 'S235' });
    expect(nodes).toHaveLength(7);
    expect(elements).toHaveLength(3);
  });

  it('a középső csomópont pontosan az elem felezőpontjában van', () => {
    const { nodes } = uniformMesh(6, 3, { sectionId: 'R1', materialId: 'S235' });
    // E0: N0(0) N1(1) N2(2) → a felezőpont 1
    expect(nodes[1].x as number).toBeCloseTo(1, 12);
    expect(nodes[3].x as number).toBeCloseTo(3, 12);
  });

  it('érvénytelen elemszámra hibát dob', () => {
    expect(() => uniformMesh(5, 0, { sectionId: 'R1', materialId: 'S235' })).toThrow(RangeError);
    expect(() => uniformMesh(0, 2, { sectionId: 'R1', materialId: 'S235' })).toThrow(RangeError);
  });
});

describe('validateModel — érvényes modellek', () => {
  it('a konzol hibátlan és futtatható', () => {
    const d = validateModel(cantilever());
    expect(d.filter((x) => x.severity === 'error')).toEqual([]);
    expect(isRunnable(d)).toBe(true);
  });

  it('a kéttámaszú tartó hibátlan', () => {
    const mesh = uniformMesh(6, 4, { sectionId: 'R1', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [STEEL],
      sections: [SEC],
      boundaries: [pinned('N0'), pinned('N8')],
      loads: [distributedForce(0, 6, 10)],
    });
    expect(isRunnable(validateModel(model))).toBe(true);
  });
});

describe('validateModel — kinematikai határozottság', () => {
  it('megtámasztás nélkül mechanizmust jelez', () => {
    const mesh = uniformMesh(5, 2, { sectionId: 'R1', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [STEEL],
      sections: [SEC],
      boundaries: [],
    });
    expect(validateModel(model).map((d) => d.code)).toContain('MECHANISM');
  });

  it('egyetlen görgős támasz nem elég (az elfordulás szabad marad)', () => {
    const mesh = uniformMesh(5, 2, { sectionId: 'R1', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [STEEL],
      sections: [SEC],
      boundaries: [pinned('N0')],
    });
    expect(validateModel(model).map((d) => d.code)).toContain('MECHANISM');
  });

  it('két, különböző helyen lévő görgős támasz elég', () => {
    const mesh = uniformMesh(5, 2, { sectionId: 'R1', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [STEEL],
      sections: [SEC],
      boundaries: [pinned('N0'), pinned('N4')],
    });
    expect(validateModel(model).map((d) => d.code)).not.toContain('MECHANISM');
  });

  it('egyetlen befogás elég (konzol)', () => {
    expect(validateModel(cantilever()).map((d) => d.code)).not.toContain('MECHANISM');
  });
});

describe('validateModel — hivatkozási hibák', () => {
  it('nem létező anyagra hivatkozó elemet jelez', () => {
    const base = cantilever();
    const model: Model = {
      ...base,
      elements: base.elements.map((e) => ({ ...e, materialId: 'NINCS' as typeof e.materialId })),
    };
    expect(validateModel(model).map((d) => d.code)).toContain('MISSING_MATERIAL');
  });

  it('nem létező csomóponton lévő terhet jelez', () => {
    const base = cantilever();
    const model: Model = { ...base, loads: [nodalForce('NINCS_ILYEN', 5)] };
    expect(validateModel(model).map((d) => d.code)).toContain('MISSING_NODE');
  });
});

describe('validateModel — elemgeometria', () => {
  it('az elem belsejéből kilógó középső csomópontot jelez', () => {
    const base = cantilever(1);
    const nodes = base.nodes.map((n) => (n.id === 'N1' ? { ...n, x: 9 as typeof n.x } : n));
    expect(validateModel({ ...base, nodes }).map((d) => d.code)).toContain('MIDNODE_OUTSIDE');
  });

  it('erősen eltolt középső csomópontra figyelmeztet', () => {
    const base = cantilever(1);
    // Elem: 0…5, felezőpont 2.5; a 4.0 eltolás 30% → figyelmeztetés.
    const nodes = base.nodes.map((n) => (n.id === 'N1' ? { ...n, x: 4 as typeof n.x } : n));
    const d = validateModel({ ...base, nodes });
    expect(d.map((x) => x.code)).toContain('DISTORTED_ELEMENT');
    expect(isRunnable(d)).toBe(true);
  });
});

describe('validateModel — rétegelt keresztmetszet', () => {
  it('átfedő rétegeket hibaként jelez', () => {
    const bad = makeLayeredSection('L1', 'Rossz rétegzés', [
      { b: 0.2, t: 0.2, z: -0.1 },
      { b: 0.2, t: 0.2, z: 0.0 }, // átfedés
    ]);
    const base = cantilever();
    const d = validateModel({ ...base, sections: [SEC, bad] });
    expect(d.map((x) => x.code)).toContain('LAYER_OVERLAP');
  });

  it('helyes, súlyponti rétegzést elfogad', () => {
    const good = makeLayeredSection(
      'L1',
      'Téglalap 20/40, 4 réteg',
      Array.from({ length: 4 }, (_, i) => ({ b: 0.2, t: 0.1, z: -0.15 + i * 0.1 })),
    );
    const base = cantilever();
    const d = validateModel({ ...base, sections: [SEC, good] });
    expect(d.filter((x) => x.severity === 'error')).toEqual([]);
    expect(d.map((x) => x.code)).not.toContain('LAYERS_NOT_CENTROIDAL');
  });
});

describe('validateModel — hőteher', () => {
  it('gradiens nélküli hőteherre figyelmeztet, de futtathatónak hagyja', () => {
    const base = cantilever();
    const d = validateModel({ ...base, loads: [thermal(20, 20, 0, 'T1')] });
    const w = d.find((x) => x.code === 'THERMAL_NO_GRADIENT');
    expect(w?.severity).toBe('warning');
    expect(w?.message).toContain('tengelyirányú szabadságfok');
    expect(isRunnable(d)).toBe(true);
  });

  it('gradienses hőteherre nem figyelmeztet', () => {
    const base = cantilever();
    const d = validateModel({ ...base, loads: [thermal(10, 30, 0, 'T1')] });
    expect(d.map((x) => x.code)).not.toContain('THERMAL_NO_GRADIENT');
  });
});

describe('.femati.json séma', () => {
  it('a szerializálás → deszerializálás azonos modellt ad', () => {
    expectRoundTrip(cantilever(3));
  });

  it('a körút idempotens (a második kör már bit-azonos)', () => {
    const once = parseModelFile(serializeModel(cantilever(3)));
    const twice = parseModelFile(serializeModel(once));
    expect(twice).toEqual(once);
  });

  it('rétegelt keresztmetszet is túléli a körutat', () => {
    const layered = makeLayeredSection(
      'L1',
      'Rétegelt',
      Array.from({ length: 8 }, (_, i) => ({ b: 0.2, t: 0.05, z: -0.175 + i * 0.05 })),
    );
    const base = cantilever(2);
    const model: Model = {
      ...base,
      sections: [layered],
      elements: base.elements.map((e) => ({ ...e, sectionId: layered.id })),
    };
    expectRoundTrip(model);
  });

  it('minden tehertípus túléli a körutat', () => {
    const base = cantilever(2);
    const model: Model = {
      ...base,
      loads: [
        nodalForce('N4', 12.5, 'F1'),
        distributedForce(0, 5, 3, 7, 'Q1'),
        thermal(5, 25, 10, 'T1'),
      ],
    };
    expectRoundTrip(model);
  });

  it('a séma verziószámot ír ki', () => {
    expect(serializeModel(cantilever()).schemaVersion).toBe(FEMAti_SCHEMA_VERSION);
  });

  it('hibás szerkezetre kivételt dob', () => {
    expect(() => parseModelFile({ schemaVersion: 1 })).toThrow();
    expect(() => parseModelFile({ schemaVersion: 99, nodes: [] })).toThrow();
  });

  it('a mérnöki egységek helyesen váltódnak át', () => {
    const file = serializeModel(cantilever());
    expect(file.materials[0].E).toBeCloseTo(21000, 6); // kN/cm²
    expect(file.materials[0].density).toBeCloseTo(7850, 6); // kg/m³
    expect(file.sections[0].kind).toBe('parametric');
    if (file.sections[0].kind === 'parametric' && file.sections[0].shape.kind === 'rect') {
      expect(file.sections[0].shape.b).toBeCloseTo(20, 9); // cm
      expect(file.sections[0].shape.h).toBeCloseTo(40, 9); // cm
    }
  });
});
