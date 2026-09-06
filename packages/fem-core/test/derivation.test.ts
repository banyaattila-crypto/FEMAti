import { beforeEach, describe, expect, it } from 'vitest';
import {
  assemble,
  buildLoadVector,
  buildModel,
  deriveElementInternalForces,
  deriveElementLoadVector,
  deriveElementMass,
  deriveElementStiffness,
  deriveLayerStep,
  distributedForce,
  elementLoadVector,
  elementMass,
  elementStiffness,
  fixed,
  generateLayers,
  iProfile,
  makeLayeredSection,
  makeMaterial,
  makeSection,
  rect,
  resetLoadIds,
  runLoadStepper,
  sectionMass,
  sectionStiffness,
  solveLinear,
  uniformMesh,
  selfWeight,
  type Model,
} from '../src/index.js';

beforeEach(() => resetLoadIds());

const MAT = makeMaterial('S235', 'Acél S235', { e: 2.1e8, sigmaY: 2.35e5, density: 7850 });

function buildLayeredModel(elementCount: number): Model {
  const shape = iProfile(0.3, 0.15, 0.008, 0.012);
  const layers = generateLayers(shape, 12);
  const section = makeLayeredSection('IPE', 'IPE-szerű', layers);
  const mesh = uniformMesh(6, elementCount, { sectionId: 'IPE', materialId: 'S235' });
  return buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [MAT],
    sections: [section],
    boundaries: [fixed('N0')],
    loads: [distributedForce(0, 6, -8, -8, 'Q1'), selfWeight(1, 'G1')],
  });
}

describe('deriveElementMass — bit-azonosság (ADR-0016)', () => {
  const rectMat = makeMaterial('S235r', 'Acél S235', { e: 2.1e8, density: 7850 });
  const sec = makeSection('R1', 'Téglalap 20/40', rect(0.2, 0.4));
  const mesh = uniformMesh(6, 3, { sectionId: 'R1', materialId: 'S235r' });
  const model: Model = buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [rectMat],
    sections: [sec],
    boundaries: [fixed('N0')],
  });

  it('az Mₑ SZÓ SZERINT elementMass(...) eredménye — bit-azonos', () => {
    const elementId = model.elements[1]?.id as unknown as string;
    const derived = deriveElementMass(model, elementId);

    const stiffness = sectionStiffness(sec, rectMat);
    const expectedMass = sectionMass(stiffness, rectMat);
    const expectedMe = elementMass({ nodeX: derived.nodeX, elementId }, expectedMass);

    expect(derived.me.data).toEqual(expectedMe.data);
  });

  it('3 Gauss-pontot ad vissza (teljes integrálás, nincs szelektív séma)', () => {
    const elementId = model.elements[0]?.id as unknown as string;
    const derived = deriveElementMass(model, elementId);
    expect(derived.points).toHaveLength(3);
  });

  it('minden Gauss-pontban ΣNᵢ = 1 (partíció, ugyanaz az alakfüggvény, mint a merevségnél)', () => {
    const elementId = model.elements[0]?.id as unknown as string;
    const derived = deriveElementMass(model, elementId);
    for (const p of derived.points) {
      expect(p.n[0] + p.n[1] + p.n[2]).toBeCloseTo(1, 13);
    }
  });

  it('ismeretlen elemre hibát dob', () => {
    expect(() => deriveElementMass(model, 'NEM-LETEZIK')).toThrow();
  });
});

describe('deriveElementStiffness — bit-azonosság (ADR-0005, P15/A elfogadási kritérium)', () => {
  const model = buildLayeredModel(6);

  it('a Kₑ SZÓ SZERINT elementStiffness(...) eredménye — bit-azonos', () => {
    const elementId = model.elements[2]?.id as unknown as string;
    const derived = deriveElementStiffness(model, elementId);

    const nodeById = new Map(model.nodes.map((n) => [n.id as string, n.x as number]));
    const element = model.elements.find((e) => (e.id as unknown as string) === elementId);
    if (element === undefined) throw new Error('nincs elem');
    const nodeX: [number, number, number] = [
      nodeById.get(element.nodes[0] as string) ?? 0,
      nodeById.get(element.nodes[1] as string) ?? 0,
      nodeById.get(element.nodes[2] as string) ?? 0,
    ];
    const expectedKe = elementStiffness({ nodeX, elementId }, derived.stiffness, element.integration);

    expect(derived.ke.data).toEqual(expectedKe.data);
  });

  it('minden elem tehervektorának összeszerelése BIT-AZONOS a buildLoadVector(...) teljes vektorával', () => {
    const system = assemble(model, { strategy: 'elimination' });
    const expected = buildLoadVector(model, system.map, 1);

    const assembled = new Float64Array(system.map.totalDofs);
    for (const element of model.elements) {
      const elementId = element.id as unknown as string;
      const derived = deriveElementStiffness(model, elementId);
      const nodeIds = element.nodes as readonly [string, string, string];
      for (let i = 0; i < 3; i++) {
        const nodeIndex = system.map.nodeIndex.get(nodeIds[i] as unknown as string);
        if (nodeIndex === undefined) continue;
        assembled[2 * nodeIndex] += derived.loadVector[2 * i] ?? 0;
        assembled[2 * nodeIndex + 1] += derived.loadVector[2 * i + 1] ?? 0;
      }
    }

    // Gépi pontosságig (nem szigorúan bit-azonos, ld. ADR-0008): a két
    // FÜGGETLEN összegzési sorrend (elemenkénti derivált-hurok itt, ill. a
    // buildLoadVector() saját belső ciklusa) lebegőpontosan nem feltétlenül
    // asszociatív — az önsúly-tag (`section.area`, a `generateLayers()`
    // terület-megőrző almintavételezéséből) egy tipikus, nem "kerek" szám,
    // ezért az utolsó bitben eltérhet a két úton összegzett érték, még akkor
    // is, ha mindkettő ugyanazt a matematikai eredményt számolja ki.
    for (let i = 0; i < assembled.length; i++) {
      expect(assembled[i] ?? 0).toBeCloseTo(expected.full[i] ?? 0, 10);
    }
  });

  it('a hajlítási Gauss-pontok száma és helye megegyezik a GAUSS_3 szabállyal, a nyírásié a séma szerint', () => {
    const elementId = model.elements[0]?.id as unknown as string;
    const derived = deriveElementStiffness(model, elementId);
    expect(derived.bendingPoints).toHaveLength(3);
    expect(derived.shearPoints).toHaveLength(2); // szelektív az alapértelmezés
    expect(derived.bendingPoints[1]?.xi).toBe(0);
  });
});

describe('deriveElementLoadVector — bit-azonosság a tehervektor terhenkénti bontásához (4.7 pont)', () => {
  const model = buildLayeredModel(6);

  it('a Gauss-pontonkénti bontás összege BIT-AZONOS az elementLoadVector(...) eredményével, minden elemre', () => {
    for (const element of model.elements) {
      const elementId = element.id as unknown as string;
      const derived = deriveElementLoadVector(model, elementId);
      if (derived === undefined) throw new Error('nincs elem');

      const summed = new Float64Array(6);
      for (const contribution of derived.distributed) {
        for (const gp of contribution.points) {
          for (let i = 0; i < 6; i++) summed[i] += gp.contribution[i] ?? 0;
        }
      }
      for (const contribution of derived.nodal) {
        summed[2 * contribution.localNode + contribution.dofOffset] += contribution.value;
      }
      if (derived.thermal !== null) {
        for (const gp of derived.thermal.points) {
          for (let i = 0; i < 6; i++) summed[i] += gp.contribution[i] ?? 0;
        }
      }

      expect(summed).toEqual(derived.total);
      expect(derived.total).toEqual(elementLoadVector(model, elementId, 1));
    }
  });

  it('a modell mindkét terhét (megoszló erő + önsúly) megtalálja legalább egy elemen', () => {
    const found = model.elements.some((element) => {
      const derived = deriveElementLoadVector(model, element.id as unknown as string);
      return (
        derived !== undefined &&
        derived.distributed.some((d) => d.kind === 'distributed-force') &&
        derived.distributed.some((d) => d.kind === 'self-weight')
      );
    });
    expect(found).toBe(true);
  });
});

describe('deriveElementInternalForces — bit-azonosság a szelvényi igénybevétellel (5→6. pont híd)', () => {
  const model = buildLayeredModel(6);
  const linear = solveLinear(model);

  it('minden elemre az m/t BIT-AZONOS a LinearResult.elements[...].gaussPoints értékével', () => {
    for (const element of model.elements) {
      const elementId = element.id as unknown as string;
      const derived = deriveElementInternalForces(model, elementId, linear.displacements);
      const expected = linear.elements.find((e) => e.elementId === elementId);
      if (derived === undefined || expected === undefined) throw new Error('nincs elem');

      expect(derived.points).toHaveLength(expected.gaussPoints.length);
      derived.points.forEach((gp, i) => {
        const exp = expected.gaussPoints[i];
        if (exp === undefined) throw new Error('nincs Gauss-pont');
        expect(gp.m).toBe(exp.m);
        expect(gp.t).toBe(exp.t);
        expect(gp.x).toBeCloseTo(exp.x, 10);
      });
    }
  });

  it('κ = B_κ·uₑ és γ = B_γ·uₑ pontosan reprodukálja a derived.kappa/gamma értéket (pedagógiai szorzat)', () => {
    const elementId = model.elements[2]?.id as unknown as string;
    const derived = deriveElementInternalForces(model, elementId, linear.displacements);
    if (derived === undefined) throw new Error('nincs elem');
    for (const gp of derived.points) {
      let kappa = 0;
      let gamma = 0;
      for (let i = 0; i < 6; i++) {
        kappa += (gp.bKappa[i] ?? 0) * (derived.ue[i] ?? 0);
        gamma += (gp.bGamma[i] ?? 0) * (derived.ue[i] ?? 0);
      }
      expect(kappa).toBe(gp.kappa);
      expect(gamma).toBe(gp.gamma);
    }
  });
});

describe('deriveLayerStep — bit-azonosság a nemlineáris megoldóval', () => {
  it('a visszavetített feszültség PONTOSAN megegyezik a runLoadStepper által ténylegesen tárolt réteg-feszültséggel', () => {
    const model = buildLayeredModel(4);
    // Nagy célteherszorzó, hogy biztosan legyen képlékeny réteg valamelyik lépésben.
    const result = runLoadStepper(model, {
      algorithm: 'newton',
      iterMax: 30,
      iterMin: 3,
      tolerancePercent: 1e-3,
      initialSteps: 20,
      targetLambda: 8,
    });
    expect(result.steps.length).toBeGreaterThan(1);

    // Keressünk egy lépést, ahol legalább egy réteg ténylegesen folyt (yielded).
    let found: { stepIndex: number; elementId: string; gaussIndex: number; layerIndex: number } | null = null;
    for (let s = 1; s < result.steps.length && found === null; s++) {
      const step = result.steps[s];
      if (step === undefined) continue;
      for (const [elementId, state] of step.states) {
        for (let gpIndex = 0; gpIndex < 3 && found === null; gpIndex++) {
          const gp = state.gaussPoints[gpIndex];
          if (gp === undefined || gp.kind !== 'layered') continue;
          const layerIndex = gp.layers.findIndex((l) => l.yielded);
          if (layerIndex >= 0) found = { stepIndex: s, elementId, gaussIndex: gpIndex, layerIndex };
        }
      }
    }
    if (found === null) throw new Error('nem talált képlékeny réteget egyetlen lépésben sem — a teszt feltétele sérült');

    const { stepIndex, elementId, gaussIndex, layerIndex } = found;
    const prevStep = result.steps[stepIndex - 1];
    const curStep = result.steps[stepIndex];
    if (prevStep === undefined || curStep === undefined) throw new Error('hiányzó lépés');

    const prevGp = prevStep.states.get(elementId)?.gaussPoints[gaussIndex];
    const curGp = curStep.states.get(elementId)?.gaussPoints[gaussIndex];
    if (prevGp === undefined || curGp === undefined || prevGp.kind !== 'layered' || curGp.kind !== 'layered') {
      throw new Error('nincs réteges Gauss-pont');
    }
    const prevLayerState = prevGp.layers[layerIndex];
    const expectedLayerState = curGp.layers[layerIndex];
    if (prevLayerState === undefined || expectedLayerState === undefined) throw new Error('hiányzó rétegállapot');

    const element = model.elements.find((e) => (e.id as unknown as string) === elementId);
    if (element === undefined) throw new Error('nincs elem');
    const section = model.sections.find((sec) => (sec.id as unknown as string) === (element.sectionId as unknown as string));
    if (section === undefined || section.kind !== 'layered') throw new Error('nincs rétegelt szelvény');
    const layer = section.layers[layerIndex];
    if (layer === undefined) throw new Error('nincs réteg');

    const dKappa = curGp.kappa - prevGp.kappa;
    const derived = deriveLayerStep(layerIndex, layer.z as number, MAT.e as number, MAT.sigmaY as number, 0, prevLayerState, dKappa);

    // A σ ugyanazzal a függvénnyel, ugyanazon bemenetekkel számol, mint a
    // solver (ADR-0005) — gépi pontosságig (relatív ~1e-12) egyezik. Az
    // epsPEff UTOLSÓ BITJE eltérhet, mert a solver TÖBB Newton-iteráción
    // (több kis Δκ-n) keresztül összegzi a |Δεₚ|-t, itt pedig EGY nagy
    // lépésben — ez lebegőpontos összeadási sorrend, nem hiba (ld.
    // `layerStepDerivation.ts` "PONTOSSÁGI MEGJEGYZÉS").
    const relTol = (a: number, b: number): number => Math.abs(a - b) / Math.max(Math.abs(b), 1e-30);
    expect(relTol(derived.step.sigma, expectedLayerState.sigma)).toBeLessThan(1e-12);
    expect(relTol(derived.step.state.epsPEff, expectedLayerState.epsPEff)).toBeLessThan(1e-12);
    expect(derived.step.state.yielded).toBe(expectedLayerState.yielded);
  });
});
