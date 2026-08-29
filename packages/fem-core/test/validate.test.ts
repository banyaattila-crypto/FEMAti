import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildModel,
  circle,
  distributedForce,
  elementId,
  fixed,
  foundation,
  iProfile,
  isRunnable,
  makeLayeredSection,
  makeMaterial,
  makeSection,
  nodalMoment,
  nodeId,
  parabolicForce,
  pinned,
  rect,
  resetLoadIds,
  rhs,
  sectionId,
  springSupport,
  supportDisplacement,
  thermal,
  tube,
  uniformMesh,
  validateModel,
  type Load,
  type Model,
  type Section,
} from '../src/index.js';

const MAT = makeMaterial('S235', 'Acél S235', { e: 2.1e8, sigmaY: 2.35e5, hPrime: 0 });
const SEC = makeSection('R1', 'Téglalap', rect(0.2, 0.4));

function base(elements = 2, span = 6): Model {
  const mesh = uniformMesh(span, elements, { sectionId: 'R1', materialId: 'S235' });
  return buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [MAT],
    sections: [SEC],
    boundaries: [fixed('N0')],
  });
}

const codes = (m: Model): string[] => validateModel(m).map((d) => d.code);

beforeEach(() => resetLoadIds());

describe('azonosítók és hivatkozások', () => {
  it('ismétlődő csomópont-azonosítót jelez', () => {
    const m = base();
    const dup: Model = { ...m, nodes: [...m.nodes, m.nodes[0]] };
    expect(codes(dup)).toContain('DUPLICATE_ID');
  });

  it('ismétlődő anyag-azonosítót jelez', () => {
    const m = base();
    expect(codes({ ...m, materials: [MAT, MAT] })).toContain('DUPLICATE_ID');
  });

  it('nem létező keresztmetszetre hivatkozó elemet jelez', () => {
    const m = base();
    const bad: Model = {
      ...m,
      elements: m.elements.map((e) => ({ ...e, sectionId: sectionId('NINCS') })),
    };
    expect(codes(bad)).toContain('MISSING_SECTION');
  });

  it('nem létező csomóponton lévő megtámasztást jelez', () => {
    const m = base();
    expect(codes({ ...m, boundaries: [fixed('NINCS')] })).toContain('MISSING_NODE');
  });

  it('hőteher nem létező elemre hivatkozva hibát ad', () => {
    const m = base();
    const t = { ...thermal(10, 30, 0, 'T1'), elementIds: [elementId('NINCS')] };
    expect(codes({ ...m, loads: [t] })).toContain('MISSING_ELEMENT');
  });

  it('csomóponti nyomaték nem létező csomóponton', () => {
    const m = base();
    expect(codes({ ...m, loads: [nodalMoment('NINCS', 10)] })).toContain('MISSING_NODE');
  });
});

describe('elemgeometria', () => {
  it('ismétlődő csomópontú elemet degeneráltnak jelöl', () => {
    const m = base(1);
    const bad: Model = {
      ...m,
      elements: [{ ...m.elements[0], nodes: [nodeId('N0'), nodeId('N0'), nodeId('N2')] }],
    };
    expect(codes(bad)).toContain('DEGENERATE_ELEMENT');
  });

  it('zérus hosszúságú elemet jelez', () => {
    const m = base(1);
    const nodes = m.nodes.map((n) => (n.id === 'N2' ? { ...n, x: m.nodes[0].x } : n));
    expect(codes({ ...m, nodes })).toContain('ZERO_LENGTH_ELEMENT');
  });
});

describe('hálófolytonosság', () => {
  it('elem nélküli modellt elutasít', () => {
    const m = base();
    expect(codes({ ...m, elements: [] })).toContain('NO_ELEMENTS');
  });

  /**
   * Két elem, amelyek NEM osztoznak csomóponton — csak így keletkezhet
   * hézag vagy átfedés. (Közös csomópont esetén a folytonosság a topológiából
   * automatikusan következik.)
   */
  const disjointPair = (secondStart: number): Model => {
    const xs = [0, 1, 2, secondStart, secondStart + 1, secondStart + 2];
    return buildModel({
      nodes: xs.map((x, i) => ({ id: nodeId(`M${i}`), x: x as never })),
      elements: [
        {
          id: elementId('E0'),
          nodes: [nodeId('M0'), nodeId('M1'), nodeId('M2')],
          sectionId: sectionId('R1'),
          materialId: MAT.id,
          integration: 'selective',
        },
        {
          id: elementId('E1'),
          nodes: [nodeId('M3'), nodeId('M4'), nodeId('M5')],
          sectionId: sectionId('R1'),
          materialId: MAT.id,
          integration: 'selective',
        },
      ],
      materials: [MAT],
      sections: [SEC],
      boundaries: [fixed('M0')],
    });
  };

  it('hézagot jelez a hálóban', () => {
    // E0: 0…2, E1: 3…5 → 1 m hézag
    expect(codes(disjointPair(3))).toContain('MESH_GAP');
  });

  it('átfedést jelez a hálóban', () => {
    // E0: 0…2, E1: 1…3 → 1 m átfedés
    expect(codes(disjointPair(1))).toContain('MESH_OVERLAP');
  });

  it('összeérő, csomóponton osztozó elemeket nem kifogásol', () => {
    expect(codes(base(4, 8))).not.toContain('MESH_GAP');
    expect(codes(base(4, 8))).not.toContain('MESH_OVERLAP');
  });
});

describe('kinematikai határozottság — a merevtest-mozgás elfojtása', () => {
  it('rugalmas támasz is megköti az eltolódást', () => {
    const m = base();
    const withSprings: Model = {
      ...m,
      boundaries: [springSupport('N0', 1e5), springSupport('N4', 1e5)],
    };
    expect(codes(withSprings)).not.toContain('MECHANISM');
  });

  it('zérus merevségű rugó nem számít megtámasztásnak', () => {
    const m = base();
    const withSprings: Model = {
      ...m,
      boundaries: [springSupport('N0', 0), springSupport('N4', 0)],
    };
    expect(codes(withSprings)).toContain('MECHANISM');
  });

  it('folytonos rugalmas ágyazat önmagában elegendő', () => {
    const m = base();
    const onFoundation: Model = { ...m, boundaries: [], foundations: [foundation(0, 6, 5000)] };
    expect(codes(onFoundation)).not.toContain('MECHANISM');
  });

  it('két azonos helyű görgő nem elég', () => {
    const m = base();
    expect(codes({ ...m, boundaries: [pinned('N0'), pinned('N0')] })).toContain('MECHANISM');
  });
});

describe('anyagjellemzők', () => {
  const withMaterial = (props: Parameters<typeof makeMaterial>[2]): Model => {
    const m = base();
    return { ...m, materials: [makeMaterial('S235', 'Teszt', props)] };
  };

  it('nem pozitív rugalmassági modulust elutasít', () => {
    expect(codes(withMaterial({ e: 0 }))).toContain('INVALID_E');
  });

  it('nem pozitív nyírási modulust elutasít', () => {
    expect(codes(withMaterial({ e: 2.1e8, g: 0 }))).toContain('INVALID_G');
  });

  it('szokatlan Poisson-tényezőre figyelmeztet', () => {
    const d = validateModel(withMaterial({ e: 2.1e8, nu: 0.6 }));
    const w = d.find((x) => x.code === 'UNUSUAL_NU');
    expect(w?.severity).toBe('warning');
  });

  it('nem pozitív folyáshatárt elutasít', () => {
    expect(codes(withMaterial({ e: 2.1e8, sigmaY: 0 }))).toContain('INVALID_SIGMA_Y');
  });

  it('negatív keményedést (lágyulást) elutasít', () => {
    expect(codes(withMaterial({ e: 2.1e8, hPrime: -100 }))).toContain('NEGATIVE_HARDENING');
  });

  it('a sűrűségből számított fajsúly helyes', () => {
    const m = makeMaterial('X', 'Acél', { e: 2.1e8, density: 7850 });
    expect(m.gamma as number).toBeCloseTo(76.98, 2);
  });
});

describe('keresztmetszet-geometria', () => {
  const withSection = (s: Section): Model => {
    const m = base();
    return { ...m, sections: [{ ...s, id: sectionId('R1') }] };
  };

  it('nem pozitív téglalap-méretet elutasít', () => {
    expect(codes(withSection(makeSection('R1', 'Rossz', rect(0, 0.4))))).toContain(
      'INVALID_DIMENSION',
    );
  });

  it('nem pozitív átmérőt elutasít', () => {
    expect(codes(withSection(makeSection('R1', 'Rossz kör', circle(-1))))).toContain(
      'INVALID_DIMENSION',
    );
  });

  it('a cső falvastagsága nem lehet a sugárnál nagyobb', () => {
    expect(codes(withSection(makeSection('R1', 'Rossz cső', tube(0.2, 0.15))))).toContain(
      'INVALID_DIMENSION',
    );
  });

  it('érvényes csövet elfogad', () => {
    const d = validateModel(withSection(makeSection('R1', 'Cső', tube(0.2, 0.01))));
    expect(d.filter((x) => x.severity === 'error')).toEqual([]);
  });

  it('a zárt szelvény (RHS) falvastagsága nem töltheti ki a belső üreget', () => {
    expect(codes(withSection(makeSection('R1', 'Rossz RHS', rhs(0.2, 0.1, 0.06))))).toContain(
      'INVALID_DIMENSION',
    );
  });

  it('érvényes zárt szelvényt (RHS) elfogad', () => {
    const d = validateModel(withSection(makeSection('R1', 'RHS', rhs(0.2, 0.1, 0.008))));
    expect(d.filter((x) => x.severity === 'error')).toEqual([]);
  });

  it('az I-szelvény övei nem fedhetik el a gerincet', () => {
    expect(
      codes(withSection(makeSection('R1', 'Rossz I', iProfile(0.2, 0.1, 0.006, 0.12)))),
    ).toContain('INVALID_DIMENSION');
  });

  it('érvényes I-szelvényt elfogad', () => {
    const d = validateModel(withSection(makeSection('R1', 'IPE 300', iProfile(0.3, 0.15, 0.0071, 0.0107))));
    expect(d.filter((x) => x.severity === 'error')).toEqual([]);
  });

  it('tartományon kívüli nyírási alaktényezőt elutasít', () => {
    expect(codes(withSection(makeSection('R1', 'Rossz κs', rect(0.2, 0.4), 1.5)))).toContain(
      'INVALID_SHEAR_FACTOR',
    );
  });
});

describe('rétegelt keresztmetszet', () => {
  const withLayers = (s: Section): Model => {
    const m = base();
    return { ...m, sections: [{ ...s, id: sectionId('R1') }] };
  };

  it('üres rétegzést elutasít', () => {
    expect(codes(withLayers(makeLayeredSection('R1', 'Üres', [])))).toContain('EMPTY_SECTION');
  });

  it('nem pozitív rétegméretet elutasít', () => {
    expect(
      codes(withLayers(makeLayeredSection('R1', 'Rossz', [{ b: 0.2, t: 0, z: 0 }]))),
    ).toContain('INVALID_LAYER');
  });

  it('hézagra figyelmeztet, de nem utasítja el', () => {
    const s = makeLayeredSection('R1', 'Hézagos', [
      { b: 0.2, t: 0.1, z: -0.1 },
      { b: 0.2, t: 0.1, z: 0.1 }, // 0.1 m hézag
    ]);
    const d = validateModel(withLayers(s));
    expect(d.map((x) => x.code)).toContain('LAYER_GAP');
    expect(d.find((x) => x.code === 'LAYER_GAP')?.severity).toBe('warning');
  });

  it('nem súlyponti rétegzésre figyelmeztet', () => {
    const s = makeLayeredSection('R1', 'Eltolt', [
      { b: 0.2, t: 0.1, z: 0.05 },
      { b: 0.2, t: 0.1, z: 0.15 },
    ]);
    expect(codes(withLayers(s))).toContain('LAYERS_NOT_CENTROIDAL');
  });

  it('anyagonként eltérő réteget (kompozit) elfogad', () => {
    const s = makeLayeredSection('R1', 'Kompozit', [
      { b: 0.2, t: 0.1, z: -0.05, materialId: 'S235' },
      { b: 0.2, t: 0.1, z: 0.05, materialId: 'S235' },
    ]);
    const d = validateModel(withLayers(s));
    expect(d.filter((x) => x.severity === 'error')).toEqual([]);
  });
});

describe('terhek', () => {
  it('fordított megoszló teher határait elutasítja', () => {
    const m = base();
    expect(codes({ ...m, loads: [distributedForce(5, 2, 10)] })).toContain('INVALID_LOAD_RANGE');
  });

  it('a szerkezetből kilógó terhet elutasítja', () => {
    const m = base(2, 6);
    expect(codes({ ...m, loads: [distributedForce(0, 9, 10)] })).toContain('LOAD_OUT_OF_RANGE');
  });

  it('parabolikus tehernél kötelező a felezőponti intenzitás', () => {
    const m = base(2, 6);
    const p = parabolicForce(0, 6, 10, 15, 10, 'QP');
    // A qMid mező elhagyása (nem `undefined`-ra állítása) — exactOptionalPropertyTypes
    // mellett ez a helyes mód a hiányzó opcionális mező előállítására.
    const { qMid: _omitted, ...withoutMid } = p as Extract<Load, { kind: 'distributed-force' }>;
    expect(codes({ ...m, loads: [withoutMid] })).toContain('MISSING_QMID');
  });

  it('teljes parabolikus terhet elfogad', () => {
    const m = base(2, 6);
    const d = validateModel({ ...m, loads: [parabolicForce(0, 6, 10, 15, 10, 'QP')] });
    expect(d.filter((x) => x.severity === 'error')).toEqual([]);
  });

  it('üres támaszmozgásra figyelmeztet', () => {
    const m = base();
    expect(codes({ ...m, loads: [supportDisplacement('N0')] })).toContain(
      'EMPTY_SUPPORT_DISPLACEMENT',
    );
  });

  it('valós támaszmozgást elfogad', () => {
    const m = base();
    const d = validateModel({ ...m, loads: [supportDisplacement('N0', -0.01, 0.001)] });
    expect(d.filter((x) => x.severity === 'error')).toEqual([]);
  });
});

describe('tehertörténet', () => {
  it('üres tehertörténetet elutasít', () => {
    const m = base();
    expect(codes({ ...m, history: { lambdaTargets: [], stepsPerTarget: 1 } })).toContain(
      'EMPTY_HISTORY',
    );
  });

  it('érvénytelen lépésszámot elutasít', () => {
    const m = base();
    expect(codes({ ...m, history: { lambdaTargets: [1], stepsPerTarget: 0 } })).toContain(
      'INVALID_STEPS',
    );
  });
});

describe('isRunnable', () => {
  it('figyelmeztetés mellett futtatható marad', () => {
    const m = base();
    const withWarning = { ...m, loads: [thermal(20, 20, 0, 'T1')] };
    expect(isRunnable(validateModel(withWarning))).toBe(true);
  });

  it('hiba esetén nem futtatható', () => {
    const m = base();
    expect(isRunnable(validateModel({ ...m, boundaries: [] }))).toBe(false);
  });
});
