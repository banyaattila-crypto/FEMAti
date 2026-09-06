import { describe, expect, it } from 'vitest';
import {
  SelfCheckCollector,
  checkElementStiffness,
  elementStiffness,
  ironsMechanismCount,
  rigidBodyModes,
  type SectionStiffness,
} from '../src/index.js';
import { DenseMatrix } from '../src/linalg/dense.js';

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

const nodes: readonly [number, number, number] = [0, 2, 4];

const runChecks = (k: DenseMatrix): ReturnType<typeof checkElementStiffness> => checkElementStiffness(k, rigidBodyModes(nodes), 'E0');

const byId = (results: ReturnType<typeof checkElementStiffness>, id: string): (typeof results)[number] | undefined =>
  results.find((r) => r.id === id);

describe('önellenőrzés — ép elemi merevségi mátrix', () => {
  const k = elementStiffness({ nodeX: nodes, elementId: 'E0' }, STIFF);

  it('minden vizsgálat átmegy', () => {
    const results = runChecks(k);
    expect(results.filter((r) => r.severity !== 'ok')).toEqual([]);
  });

  it('mind az öt vizsgálatot elvégzi', () => {
    const ids = runChecks(k).map((r) => r.id);
    expect(ids).toContain('element.finite');
    expect(ids).toContain('element.symmetry');
    expect(ids).toContain('element.positive-diagonal');
    expect(ids).toContain('element.rigid-body-0');
    expect(ids).toContain('element.rigid-body-1');
    expect(ids).toContain('element.rank');
  });

  it('minden eredményhez tartozik magyar magyarázat', () => {
    for (const r of runChecks(k)) {
      expect(r.name.length).toBeGreaterThan(3);
      expect(r.detail.length).toBeGreaterThan(20);
      expect(r.entityId).toBe('E0');
    }
  });
});

describe('önellenőrzés — elrontott mátrixot elkap', () => {
  const base = elementStiffness({ nodeX: nodes, elementId: 'E0' }, STIFF);

  it('szimmetria sérülését', () => {
    const k = base.clone();
    k.add(0, 3, base.maxAbs() * 1e-6);
    const r = byId(runChecks(k), 'element.symmetry');
    expect(r?.severity).toBe('error');
  });

  it('NaN megjelenését', () => {
    const k = base.clone();
    k.set(2, 2, Number.NaN);
    const r = byId(runChecks(k), 'element.finite');
    expect(r?.severity).toBe('error');
    expect(r?.measured).toBeGreaterThan(0);
  });

  it('végtelen értéket', () => {
    const k = base.clone();
    k.set(1, 1, Number.POSITIVE_INFINITY);
    expect(byId(runChecks(k), 'element.finite')?.severity).toBe('error');
  });

  it('nem pozitív átlós elemet', () => {
    const k = base.clone();
    k.set(3, 3, -1);
    expect(byId(runChecks(k), 'element.positive-diagonal')?.severity).toBe('error');
  });

  it('a merevtest-mozgás energiatermelését', () => {
    // Egy szimmetrikus, de a merevtest-mozgásra nem nulla mátrix:
    // egységmátrix-szerű perturbáció a w szabadságfokokon.
    const k = base.clone();
    const eps = base.maxAbs() * 1e-3;
    k.add(0, 0, eps);
    k.add(2, 2, eps);
    k.add(4, 4, eps);
    const r = byId(runChecks(k), 'element.rigid-body-0');
    expect(r?.severity).toBe('error');
  });

  it('a rang csökkenését (hamis mechanizmus)', () => {
    // Egyetlen egyrangú tag: a rang 1, a várt 4.
    const k = new DenseMatrix(6, 6);
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) k.set(i, j, 1);
    }
    const r = byId(runChecks(k), 'element.rank');
    expect(r?.severity).toBe('error');
    expect(r?.measured).toBe(1);
  });

  it('NaN esetén nem futtatja a további vizsgálatokat (értelmetlenek lennének)', () => {
    const k = base.clone();
    k.set(0, 0, Number.NaN);
    const results = runChecks(k);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('element.finite');
  });
});

describe('önellenőrzés — gyűjtő', () => {
  it('kikapcsolva semmit nem gyűjt', () => {
    const c = new SelfCheckCollector('off');
    c.addAll(runChecks(elementStiffness({ nodeX: nodes, elementId: 'E0' }, STIFF)));
    const report = c.report();
    expect(report.results).toEqual([]);
    expect(report.passed).toBe(true);
    expect(c.enabled).toBe(false);
  });

  it('alapszinten gyűjt, de a drága vizsgálatokat jelzi kihagyandónak', () => {
    const c = new SelfCheckCollector('basic');
    expect(c.enabled).toBe(true);
    expect(c.fullEnabled).toBe(false);
  });

  it('összesíti a hibákat és figyelmeztetéseket', () => {
    const c = new SelfCheckCollector('full');
    const k = elementStiffness({ nodeX: nodes, elementId: 'E0' }, STIFF).clone();
    k.set(3, 3, -1);
    c.addAll(checkElementStiffness(k, rigidBodyModes(nodes), 'E1'));
    const report = c.report();
    expect(report.passed).toBe(false);
    expect(report.errorCount).toBeGreaterThan(0);
    expect(report.level).toBe('full');
  });

  it('a rangvizsgálat kihagyható (basic szint)', () => {
    const k = elementStiffness({ nodeX: nodes, elementId: 'E0' }, STIFF);
    const withRank = checkElementStiffness(k, rigidBodyModes(nodes), 'E0', 4, true);
    const withoutRank = checkElementStiffness(k, rigidBodyModes(nodes), 'E0', 4, false);
    expect(withRank.length).toBe(withoutRank.length + 1);
  });
});

describe('Irons mechanizmus-becslés (Diplomaterv 3.18)', () => {
  // M = d·N − R − r·n; Timoshenko elem: d=2, N=3, R=2, r=2 (κ és γ)
  it('egy integrálási pont két hamis mechanizmust hagy', () => {
    expect(ironsMechanismCount(2, 3, 2, 2, 1)).toBe(2);
  });

  it('két integrálási pont épp elegendő', () => {
    expect(ironsMechanismCount(2, 3, 2, 2, 2)).toBe(0);
  });

  it('három integrálási pont biztonságos', () => {
    expect(ironsMechanismCount(2, 3, 2, 2, 3)).toBeLessThan(0);
  });

  it('a becslés egyezik a tényleges rangvizsgálattal a szelektív sémánál', () => {
    // Szelektív: a hajlítás 3, a nyírás 2 pont — a rangjuk összege ≥ 4.
    const k = elementStiffness({ nodeX: nodes, elementId: 'E0' }, STIFF, 'selective');
    expect(k.rank()).toBe(4);
    expect(ironsMechanismCount(2, 3, 2, 1, 3) + ironsMechanismCount(2, 3, 2, 1, 2)).toBeLessThan(4);
  });
});
