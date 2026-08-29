import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildModel,
  distributedForce,
  fixed,
  foundation,
  makeMaterial,
  makeSection,
  nodalForce,
  nodalMoment,
  pinned,
  rect,
  resetLoadIds,
  solveLinear,
  springSupport,
  thermal,
  uniformMesh,
  InvalidModelError,
  type Model,
} from '../src/index.js';
import {
  cantileverPointLoad,
  cantileverPointMoment,
  proppedCantileverPointLoad,
} from './helpers/timoshenkoBeam.js';
import { mustGet } from './helpers/assert.js';

const MAT = makeMaterial('S235', 'Acél S235', { e: 2.1e8, sigmaY: 2.35e5 });
const SEC = makeSection('R', 'Téglalap', rect(0.2, 0.4));
const EI = (MAT.e as number) * ((0.2 * 0.4 ** 3) / 12);
const GAS = (5 / 6) * ((MAT.e as number) / 2.6) * (0.2 * 0.4);

/**
 * A csomópont-relatív hiba mértéke — a HIBATURESI-POLITIKA szerint a nodálisan
 * pontos esetekben (1. kategória) ennek gépi pontosság alattinak kell lennie.
 */
function relErr(actual: number, expected: number): number {
  const denom = Math.abs(expected) > 0 ? Math.abs(expected) : 1;
  return Math.abs(actual - expected) / denom;
}

beforeEach(() => resetLoadIds());

// ─── V-01: konzol, koncentrált végteher ───────────────────────────────────────

describe('V-01 — konzol koncentrált végteherrel', () => {
  const L = 4;
  const P = -10;
  const exact = cantileverPointLoad(EI, GAS, P, L, L);

  it.each([1, 2, 4, 8])(
    'a lehajlás és elfordulás gépi pontossággal egyezik, %i elemmel (nodálisan pontos)',
    (n) => {
      const mesh = uniformMesh(L, n, { sectionId: 'R', materialId: 'S235' });
      const model = buildModel({
        nodes: mesh.nodes,
        elements: mesh.elements,
        materials: [MAT],
        sections: [SEC],
        boundaries: [fixed('N0')],
        loads: [nodalForce(`N${2 * n}`, P, 'F1')],
      });
      const result = solveLinear(model);
      const tip = mustGet(result.nodes.at(-1));
      // A pontosság a mátrix méretével (elemszámmal) enyhén romlik a
      // kondicionáltság miatt (HIBATURESI-POLITIKA 3. pont) — a korlát ezért
      // n-nel skálázva, nem rögzített abszolút számmal.
      expect(relErr(tip.w, exact.w)).toBeLessThan(1e-11 * n);
      expect(relErr(tip.phi, exact.phi)).toBeLessThan(1e-11 * n);
    },
  );

  it('a globális egyensúly gépi pontossággal zárul', () => {
    const mesh = uniformMesh(L, 3, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [fixed('N0')], loads: [nodalForce('N6', P, 'F1')],
    });
    const result = solveLinear(model);
    expect(result.equilibrium.satisfied).toBe(true);
    expect(result.equilibrium.relativeFz).toBeLessThan(1e-9);
    expect(result.equilibrium.relativeMy).toBeLessThan(1e-9);
  });

  it('a befogási reakció pontosan ellensúlyozza a terhet', () => {
    const mesh = uniformMesh(L, 2, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [fixed('N0')], loads: [nodalForce('N4', P, 'F1')],
    });
    const result = solveLinear(model);
    const reaction = mustGet(result.reactions.find((r) => r.nodeId === 'N0'));
    expect(reaction.fz).toBeCloseTo(-P, 8);
    expect(reaction.my).toBeCloseTo(-P * L, 6);
  });

  it('az önellenőrzés hibátlan (errorCount = 0)', () => {
    const mesh = uniformMesh(L, 4, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [fixed('N0')], loads: [nodalForce('N8', P, 'F1')],
    });
    const result = solveLinear(model);
    expect(result.selfCheck.errorCount).toBe(0);
  });
});

// ─── V-02: konzol, koncentrált végnyomaték ────────────────────────────────────

describe('V-02 — konzol koncentrált végnyomatékkal', () => {
  const L = 4;
  const M0 = 20;
  const exact = cantileverPointMoment(EI, M0, L, L);

  it.each([1, 3])('gépi pontossággal egyezik, %i elemmel', (n) => {
    const mesh = uniformMesh(L, n, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [fixed('N0')], loads: [nodalMoment(`N${2 * n}`, M0, 'M1')],
    });
    const result = solveLinear(model);
    const tip = mustGet(result.nodes.at(-1));
    expect(relErr(tip.w, exact.w)).toBeLessThan(1e-10);
    expect(relErr(tip.phi, exact.phi)).toBeLessThan(1e-10);
  });

  it('tiszta nyomatéki tehernél a nyíróerő minden Gauss-pontban zérus', () => {
    const mesh = uniformMesh(L, 2, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [fixed('N0')], loads: [nodalMoment('N4', M0, 'M1')],
    });
    const result = solveLinear(model);
    for (const el of result.elements) {
      for (const gp of el.gaussPoints) {
        expect(Math.abs(gp.t) / Math.abs(M0 / L)).toBeLessThan(1e-9);
      }
    }
  });
});

// ─── V-03: kéttámaszú tartó, középen koncentrált teher ────────────────────────

describe('V-03 — kéttámaszú tartó középen ható teherrel', () => {
  const L = 6;
  const P = -20;
  // Zárt alak (szimmetria + Timoshenko nyírás): w_mid = P·L³/(48EI) + P·L/(4·GAs)
  const exactWmid = (P * L ** 3) / (48 * EI) + (P * L) / (4 * GAS);

  it.each([2, 4, 6])('a középső lehajlás gépi pontossággal egyezik, %i elemmel', (n) => {
    const mesh = uniformMesh(L, n, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [pinned('N0'), pinned(`N${2 * n}`)], loads: [nodalForce(`N${n}`, P, 'F1')],
    });
    const result = solveLinear(model);
    const mid = mustGet(result.nodes.find((x) => x.nodeId === `N${n}`));
    expect(relErr(mid.w, exactWmid)).toBeLessThan(1e-10 * n);
  });

  it('a két reakció egyenlő és összegük a terhet ellensúlyozza', () => {
    const mesh = uniformMesh(L, 4, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [pinned('N0'), pinned('N8')], loads: [nodalForce('N4', P, 'F1')],
    });
    const result = solveLinear(model);
    const r0 = mustGet(result.reactions.find((r) => r.nodeId === 'N0'));
    const r8 = mustGet(result.reactions.find((r) => r.nodeId === 'N8'));
    expect(r0.fz).toBeCloseTo(r8.fz, 8);
    expect(r0.fz + r8.fz).toBeCloseTo(-P, 8);
    expect(result.equilibrium.satisfied).toBe(true);
  });

  it('az elfordulás a tartó két felén ellentétes előjelű (antimetria)', () => {
    const mesh = uniformMesh(L, 4, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [pinned('N0'), pinned('N8')], loads: [nodalForce('N4', P, 'F1')],
    });
    const result = solveLinear(model);
    const left = mustGet(result.nodes.find((x) => x.nodeId === 'N2')).phi;
    const right = mustGet(result.nodes.find((x) => x.nodeId === 'N6')).phi;
    expect(left).toBeCloseTo(-right, 10);
  });
});

// ─── V-04: befogott-görgős tartó (statikailag határozatlan) ───────────────────

describe('V-04 — befogott-görgős tartó, statikailag határozatlan', () => {
  const L = 6;
  const a = 3;
  const P = -15;
  const { r: exactR, at } = proppedCantileverPointLoad(EI, GAS, L, P, a);

  it('a lehajlás minden pontban gépi pontossággal egyezik az erőmódszerrel', () => {
    const n = 6;
    const mesh = uniformMesh(L, n, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [fixed('N0'), pinned(`N${2 * n}`)], loads: [nodalForce(`N${n}`, P, 'F1')],
    });
    const result = solveLinear(model);
    for (const node of result.nodes) {
      const idx = Number(node.nodeId.slice(1));
      const x = idx * (L / (2 * n));
      const exact = at(x);
      expect(relErr(node.w, exact.w)).toBeLessThan(1e-9);
    }
  });

  it('a görgő reakciója egyezik az erőmódszer redundáns reakciójával', () => {
    const n = 6;
    const mesh = uniformMesh(L, n, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [fixed('N0'), pinned(`N${2 * n}`)], loads: [nodalForce(`N${n}`, P, 'F1')],
    });
    const result = solveLinear(model);
    const rGorgo = mustGet(result.reactions.find((r) => r.nodeId === `N${2 * n}`));
    expect(relErr(rGorgo.fz, exactR)).toBeLessThan(1e-10);
  });

  it('a globális egyensúly zárul, és a két reakció összege a terhet adja', () => {
    const n = 4;
    const mesh = uniformMesh(L, n, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [fixed('N0'), pinned(`N${2 * n}`)], loads: [nodalForce(`N${n}`, P, 'F1')],
    });
    const result = solveLinear(model);
    expect(result.equilibrium.satisfied).toBe(true);
    const sumFz = result.reactions.reduce((s, r) => s + r.fz, 0);
    expect(sumFz).toBeCloseTo(-P, 8);
  });
});

// ─── V-05: rugalmasan megtámasztott tartó ─────────────────────────────────────

describe('V-05 — rugós támasz: egyensúly és a reakció előjele', () => {
  it('a rugóerő és a merev reakció együtt zárja az egyensúlyt', () => {
    const L = 4;
    const k = 5000;
    const P = -10;
    const mesh = uniformMesh(L, 2, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [springSupport('N0', k), pinned('N4')], loads: [nodalForce('N2', P, 'F1')],
    });
    const result = solveLinear(model);
    expect(result.equilibrium.satisfied).toBe(true);

    const springReaction = mustGet(result.reactions.find((r) => r.nodeId === 'N0'));
    const springNode = mustGet(result.nodes.find((n) => n.nodeId === 'N0'));
    // A rugóerő az elmozdulással ELLENTÉTES előjelű (visszatérítő hatás):
    // ez a regressziós teszt pontosan az egyszer már elrontott előjelre őrködik.
    expect(springReaction.fz).toBeCloseTo(-k * springNode.w, 6);
    // Lefelé ható teher esetén a rugó felfelé (pozitív) reakciót ad.
    expect(springReaction.fz).toBeGreaterThan(0);
  });

  it('nagyon merev rugó a merev támasz határesetéhez tart', () => {
    const L = 4;
    const P = -10;
    const mesh = uniformMesh(L, 2, { sectionId: 'R', materialId: 'S235' });
    const rigid = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [pinned('N0'), pinned('N4')], loads: [nodalForce('N2', P, 'F1')],
    });
    const softSpring = buildModel({
      ...rigid,
      boundaries: [springSupport('N0', 1e14), pinned('N4')],
    });
    const rigidResult = solveLinear(rigid);
    const springResult = solveLinear(softSpring);
    const rigidMid = mustGet(rigidResult.nodes.find((n) => n.nodeId === 'N2')).w;
    const springMid = mustGet(springResult.nodes.find((n) => n.nodeId === 'N2')).w;
    expect(relErr(springMid, rigidMid)).toBeLessThan(1e-6);
  });
});

// ─── V-06: rugalmas ágyazat (Winkler) — globális egyensúly ────────────────────

describe('V-06 — rugalmas ágyazat: az ágyazat felveszi a teljes terhet', () => {
  it('diszkrét támasz nélkül is zárul az egyensúly, és a reakciók összege a terhet adja', () => {
    const L = 6;
    const P = -20;
    const mesh = uniformMesh(L, 6, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [], foundations: [foundation(0, L, 8000)], loads: [nodalForce('N6', P, 'F1')],
    });
    const result = solveLinear(model);
    expect(result.equilibrium.satisfied).toBe(true);
    expect(result.selfCheck.errorCount).toBe(0);
    const sumFz = result.reactions.reduce((s, r) => s + r.fz, 0);
    expect(relErr(sumFz, -P)).toBeLessThan(1e-9);
  });

  it('merev támasz és ágyazat együtt is helyesen zár', () => {
    const L = 6;
    const P = -20;
    const mesh = uniformMesh(L, 6, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [fixed('N0')], foundations: [foundation(0, L, 8000)], loads: [nodalForce('N12', P, 'F1')],
    });
    const result = solveLinear(model);
    expect(result.equilibrium.satisfied).toBe(true);
    expect(result.selfCheck.errorCount).toBe(0);
  });
});

// ─── Peremfeltétel-stratégiák összevetése ─────────────────────────────────────

describe('elimination vs penalty — konzisztencia', () => {
  it('a két stratégia gyakorlatilag azonos elmozdulást ad (a penalty véges merevsége határáig)', () => {
    const mesh = uniformMesh(4, 2, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [fixed('N0')], loads: [nodalForce('N4', -10, 'F1'), nodalMoment('N2', 5, 'M1')],
    });
    const elim = solveLinear(model, { strategy: 'elimination' });
    const pen = solveLinear(model, { strategy: 'penalty' });
    for (let i = 0; i < elim.nodes.length; i++) {
      // relErr önmaga véd a nulla nevező ellen (a megkötött N0 w=0 pontosan
      // elimination-nél); a `||` trükk itt hibás lenne, mert 0 falsy JS-ben.
      expect(relErr(mustGet(pen.nodes[i]).w, mustGet(elim.nodes[i]).w)).toBeLessThan(1e-4);
    }
  });

  it('mindkét stratégia egyensúlya gépi pontossággal zár, önellenőrzés hibátlan', () => {
    const mesh = uniformMesh(4, 2, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [fixed('N0')], loads: [nodalForce('N4', -10, 'F1')],
    });
    for (const strategy of ['elimination', 'penalty'] as const) {
      const result = solveLinear(model, { strategy });
      expect(result.equilibrium.satisfied).toBe(true);
      expect(result.selfCheck.errorCount).toBe(0);
    }
  });
});

// ─── Hibakezelés és önellenőrzés ───────────────────────────────────────────────

describe('érvénytelen modell és mechanizmus', () => {
  it('validáció szerint hibás modellre InvalidModelError-t dob', () => {
    const mesh = uniformMesh(4, 1, { sectionId: 'R', materialId: 'S235' });
    const noSupport: Model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [],
    });
    expect(() => solveLinear(noSupport)).toThrow(InvalidModelError);
  });

  it('egyetlen csuklós támasz (nincs elforduláskorlátozás) mechanizmust jelez', () => {
    const mesh = uniformMesh(4, 1, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [pinned('N0')],
    });
    try {
      solveLinear(model);
      expect.fail('InvalidModelError-t vártunk');
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidModelError);
      expect((e as InvalidModelError).diagnostics.map((d) => d.code)).toContain('MECHANISM');
    }
  });

  /**
   * A nyers SingularMatrixError (dof-leíró üzenettel) az `assemble()`+
   * `k.solve()` alacsonyabb szintjén tesztelt (assembly.test.ts) — ott
   * közvetlenül, a validateModel megkerülésével előállítható egy valódi
   * mechanizmus. A `solveLinear` MINDIG validál előbb, ezért ugyanezt a
   * hibaágat innen csak mesterségesen (validátort megkerülő modellel)
   * lehetne elérni, ami nem reprezentatív valós használatot.
   */
});

describe('P5 — hőteher (V-07 jellegű, statikailag határozott eset)', () => {
  /**
   * Kéttámaszú (csuklós-görgős) tartó, egyenletes ΔT_grad, más teher nincs.
   * Statikailag HATÁROZOTT szerkezetnél a hőteher szabadon felveheti a κ0
   * görbületet, ezért M ≡ 0 (nincs kényszer, ami ezt megakadályozná) — ez a
   * `internalForces` ε0-korrekciójának (M = EI·(κ−κ0)) közvetlen próbája.
   *
   * Zárt alak (kézi levezetés, T≡0 ⇒ dw/dx=φ, κ=dφ/dx=κ0 állandó,
   * w(0)=w(L)=0 határfeltétellel): w(x) = (κ0/2)·x·(x−L),
   * innen |w_max| = κ0·L²/8 az x=L/2 helyen — ez a MASTER-PROMPT-TERV
   * 3.1 táblázatának V-07 képlete.
   */
  const THERMAL_MAT = makeMaterial('S235T', 'Acél S235 (hőtágulással)', { e: 2.1e8, alpha: 1.2e-5 });

  it('M ≡ 0 mindenütt, és w_max = κ0·L²/8', () => {
    const L = 6;
    const tTop = 5;
    const tBottom = 25;
    const mesh = uniformMesh(L, 4, { sectionId: 'R', materialId: THERMAL_MAT.id as string });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [THERMAL_MAT], sections: [SEC],
      boundaries: [pinned('N0'), pinned(`N${mesh.nodes.length - 1}`)],
      loads: [thermal(tTop, tBottom, 0, 'T1')],
    });
    const result = solveLinear(model);

    const height = 0.4; // SEC = rect(0.2, 0.4)
    const alpha = THERMAL_MAT.alpha as number;
    const kappa0 = (alpha * (tBottom - tTop)) / height;

    for (const el of result.elements) {
      for (const gp of el.gaussPoints) {
        expect(gp.m).toBeCloseTo(0, 6);
        expect(gp.kappa).toBeCloseTo(kappa0, 9);
      }
    }

    const mid = mustGet(result.nodes.find((n) => Math.abs(n.x - L / 2) < 1e-9));
    expect(mid.w).toBeCloseTo((kappa0 / 2) * (L / 2) * (L / 2 - L), 8);

    // Tiszta hőteher (nincs valódi külső erő) esetén a reakcióknak is
    // gépi pontossággal nullának kell lenniük — a relatív egyensúly-mérték
    // itt (mindkét oldal ~0) nem informatív, ezért az ABSZOLÚT reziduumot
    // ellenőrizzük a `checkEquilibrium` gépi-pontosság tűrésével összhangban.
    // Tiszta hőteher (nincs valódi külső erő) esetén a reakcióknak is
    // gépi pontossággal nullának kell lenniük.
    expect(result.equilibrium.satisfied).toBe(true);
    expect(result.selfCheck.errorCount).toBe(0);
    for (const r of result.reactions) {
      expect(r.fz).toBeCloseTo(0, 8);
      expect(r.my).toBeCloseTo(0, 8);
    }
  });
});

describe('P5 — nincs figyelmeztetés támogatott terheknél', () => {
  it('megoszló teher esetén NINCS figyelmeztetés (a P5 óta támogatott)', () => {
    const mesh = uniformMesh(4, 2, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [fixed('N0')],
      loads: [distributedForce(0, 4, -5, -5, 'Q1')],
    });
    const result = solveLinear(model);
    expect(result.warnings).toEqual([]);
  });

  it('csak támogatott terheknél nincs figyelmeztetés', () => {
    const mesh = uniformMesh(4, 2, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [fixed('N0')], loads: [nodalForce('N4', -10, 'F1')],
    });
    const result = solveLinear(model);
    expect(result.warnings).toEqual([]);
  });
});

describe('keresztmetszeti jellemzők a kimenetben (SectionProps)', () => {
  it('Mₑ és Mp a σY-ból számítódik', () => {
    const mesh = uniformMesh(4, 1, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [fixed('N0')], loads: [nodalForce('N2', -1, 'F1')],
    });
    const result = solveLinear(model);
    const sigmaY = MAT.sigmaY as number;
    expect(result.props.me).toBeCloseTo(sigmaY * result.props.elasticModulus, 6);
    expect(result.props.mp).toBeCloseTo(sigmaY * result.props.plasticModulus, 6);
  });

  it('σY nélküli anyagnál Mₑ és Mp null', () => {
    const mesh = uniformMesh(4, 1, { sectionId: 'R', materialId: 'S235' });
    const noYield = makeMaterial('X', 'Rugalmas', { e: 2.1e8 });
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements.map((e) => ({ ...e, materialId: 'X' as never })),
      materials: [noYield], sections: [SEC], boundaries: [fixed('N0')], loads: [nodalForce('N2', -1, 'F1')],
    });
    const result = solveLinear(model);
    expect(result.props.me).toBeNull();
    expect(result.props.mp).toBeNull();
  });

  it('Vpl = κs·A·σY/√3 a kimenetben (ADR-0018)', () => {
    const mesh = uniformMesh(4, 1, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes, elements: mesh.elements, materials: [MAT], sections: [SEC],
      boundaries: [fixed('N0')], loads: [nodalForce('N2', -1, 'F1')],
    });
    const result = solveLinear(model);
    const sigmaY = MAT.sigmaY as number;
    const g = MAT.g as number;
    const effectiveShearArea = result.props.gas / g; // = κs·A
    expect(result.props.vpl).toBeCloseTo((effectiveShearArea * sigmaY) / Math.sqrt(3), 6);
  });

  it('σY nélküli anyagnál Vpl null', () => {
    const mesh = uniformMesh(4, 1, { sectionId: 'R', materialId: 'S235' });
    const noYield = makeMaterial('X', 'Rugalmas', { e: 2.1e8 });
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements.map((e) => ({ ...e, materialId: 'X' as never })),
      materials: [noYield], sections: [SEC], boundaries: [fixed('N0')], loads: [nodalForce('N2', -1, 'F1')],
    });
    const result = solveLinear(model);
    expect(result.props.vpl).toBeNull();
  });
});
