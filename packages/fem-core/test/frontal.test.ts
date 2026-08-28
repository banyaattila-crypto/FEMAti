/**
 * P17 elfogadási teszt: a frontális megoldó (`solveFrontal`, Diplomaterv
 * 3.1.7.3) eredménye 1e−10 relatív pontossággal egyezzen a produkciós
 * Skyline-LDLᵀ megoldáséval (`solveLinear`, ADR-0002) — MINDKETTŐ ugyanazt a
 * Kv=q rendszert oldja meg, csak más eliminációs sorrendben.
 */
import { describe, expect, it } from 'vitest';
import {
  buildModel,
  distributedForce,
  fixed,
  makeMaterial,
  makeSection,
  nodalForce,
  nodalMoment,
  pinned,
  rect,
  resetLoadIds,
  roller,
  selfWeight,
  solveFrontal,
  solveLinear,
  springSupport,
  uniformMesh,
} from '../src/index.js';
import type { Model } from '../src/index.js';

const RELATIVE_TOLERANCE = 1e-10;

function expectFrontalMatchesSkyline(model: Model, label: string): void {
  const skyline = solveLinear(model);
  const frontal = solveFrontal(model);

  expect(frontal.displacements.length, label).toBe(skyline.displacements.length);

  const scale = Math.max(...Array.from(skyline.displacements, Math.abs), 1e-12);
  for (let d = 0; d < skyline.displacements.length; d++) {
    const expected = skyline.displacements[d] ?? 0;
    const actual = frontal.displacements[d] ?? 0;
    const relError = Math.abs(actual - expected) / scale;
    expect(relError, `${label} — dof ${d}: skyline=${expected}, frontal=${actual}`).toBeLessThan(
      RELATIVE_TOLERANCE,
    );
  }
}

function baseModel(overrides: Partial<Parameters<typeof buildModel>[0]> = {}): Model {
  const mat = makeMaterial('S235', 'Acél S235', { e: 2.1e8, density: 7850 });
  const section = makeSection('R30x50', 'Téglalap 30/50', rect(0.3, 0.5));
  const mesh = uniformMesh(6, 6, { sectionId: 'R30x50', materialId: 'S235' });
  return buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [mat],
    sections: [section],
    boundaries: [fixed('N0')],
    loads: [distributedForce(0, 6, -10, -10, 'Q1')],
    ...overrides,
  });
}

describe('solveFrontal — Diplomaterv 3.1.7.3 frontális algoritmus', () => {
  it('konzol, végponti koncentrált teherrel (V-01 jellegű elrendezés)', () => {
    resetLoadIds();
    const model = baseModel({
      boundaries: [fixed('N0')],
      loads: [nodalForce('N6', -50)],
    });
    expectFrontalMatchesSkyline(model, 'konzol koncentrált teher');
  });

  it('kéttámaszú tartó, megoszló teherrel (V-02 jellegű elrendezés)', () => {
    resetLoadIds();
    const model = baseModel({
      boundaries: [pinned('N0'), roller('N6')],
      loads: [distributedForce(0, 6, -10, -10, 'Q1')],
    });
    expectFrontalMatchesSkyline(model, 'kéttámaszú megoszló teher');
  });

  it('mindkét végén befogott tartó, koncentrált nyomatékkal', () => {
    resetLoadIds();
    const model = baseModel({
      boundaries: [fixed('N0'), fixed('N6')],
      loads: [nodalMoment('N3', 30)],
    });
    expectFrontalMatchesSkyline(model, 'befogott-befogott nyomaték');
  });

  it('rugalmas (rugós) végtámasszal', () => {
    resetLoadIds();
    const model = baseModel({
      boundaries: [fixed('N0'), springSupport('N6', 5000)],
      loads: [distributedForce(0, 6, -10, -10, 'Q1')],
    });
    expectFrontalMatchesSkyline(model, 'rugós támasz');
  });

  it('önsúly-teher (elosztott tehervektor-hozzájárulás)', () => {
    resetLoadIds();
    const model = baseModel({
      boundaries: [fixed('N0'), pinned('N6')],
      loads: [selfWeight()],
    });
    expectFrontalMatchesSkyline(model, 'önsúly');
  });

  it('finomabb hálón (24 elem) is megegyezik', () => {
    resetLoadIds();
    const mat = makeMaterial('S235', 'Acél S235', { e: 2.1e8, density: 7850 });
    const section = makeSection('R30x50', 'Téglalap 30/50', rect(0.3, 0.5));
    const mesh = uniformMesh(10, 24, { sectionId: 'R30x50', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [mat],
      sections: [section],
      boundaries: [pinned('N0'), roller('N24')],
      loads: [distributedForce(0, 10, -15, -5, 'Q1'), nodalForce('N12', -80)],
    });
    expectFrontalMatchesSkyline(model, '24 elemes háló');
  });

  it('a front szélessége minden lépésben legalább 1, és a lépések száma megegyezik az elemek számával', () => {
    resetLoadIds();
    const model = baseModel();
    const result = solveFrontal(model);
    expect(result.steps.length).toBe(model.elements.length);
    for (const step of result.steps) {
      expect(step.frontWidthAfterAssembly).toBeGreaterThan(0);
    }
    expect(result.maxFrontWidth).toBeGreaterThan(0);
    expect(result.skylineMeanBandwidth).toBeGreaterThan(0);
  });

  it('mechanizmus (egyetlen csuklós támasz — szabad merevtest-elfordulás) esetén szinguláris hibát dob', () => {
    resetLoadIds();
    const mat = makeMaterial('S235', 'Acél S235', { e: 2.1e8, density: 7850 });
    const section = makeSection('R30x50', 'Téglalap 30/50', rect(0.3, 0.5));
    const mesh = uniformMesh(6, 6, { sectionId: 'R30x50', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [mat],
      sections: [section],
      boundaries: [pinned('N0')],
      loads: [distributedForce(0, 6, -10, -10, 'Q1')],
    });
    expect(() => solveFrontal(model)).toThrow();
  });
});
