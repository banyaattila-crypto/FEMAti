import { describe, expect, it } from 'vitest';
import {
  buildModel,
  fixed,
  makeLayeredSection,
  makeMaterial,
  makeSection,
  nodalForce,
  rect,
  resetLoadIds,
  solveLinear,
  thermal,
  uniformMesh,
} from '../src/index.js';
import { runLoadStepper, type LoadStepperOptions } from '../src/solver/loadStepper.js';
import { mustGet } from './helpers/assert.js';

const SEC = makeSection('R', 'Téglalap', rect(0.2, 0.4));
const L = 4;
const MP = (2.35e5 * (0.2 * 0.4 ** 2)) / 4; // Mp = σY·Kp, téglalap 0.2×0.4, σY=2.35e5

function cantileverModel(material: ReturnType<typeof makeMaterial>, force: number, elementCount = 4) {
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

const DEFAULT_OPTIONS: Omit<LoadStepperOptions, 'targetLambda'> = {
  algorithm: 'newton',
  iterMax: 30,
  iterMin: 3,
  tolerancePercent: 1e-4,
};

describe('runLoadStepper — rugalmas konzisztencia', () => {
  it('tisztán rugalmas anyagnál λ=1-nél megegyezik a solveLinear eredményével', () => {
    const elastic = makeMaterial('EL', 'Rugalmas', { e: 2.1e8 });
    const model = cantileverModel(elastic, -10);
    const linear = solveLinear(model);

    const result = runLoadStepper(model, { ...DEFAULT_OPTIONS, initialSteps: 3 });
    expect(result.status).toBe('converged');
    const lastStep = mustGet(result.steps.at(-1));

    // Az aktív szabadságfok-vektor összevetése a solveLinear TELJES vektorával:
    // a befogott csomópont 2 szabadságfoka hiányzik az aktív vektorból, ezért
    // az elemek dofjain keresztül hasonlítjuk (activeDofs > 0 mindenhol, ahol
    // a solveLinear is nemtriviális értéket ad).
    for (const e of result.system.elements) {
      for (let i = 0; i < 6; i++) {
        const active = e.activeDofs[i] ?? -1;
        if (active < 0) continue;
        const global = e.dofs[i] ?? 0;
        expect(lastStep.u[active]).toBeCloseTo(linear.displacements[global] ?? 0, 8);
      }
    }
  });
});

describe("runLoadStepper — rugalmas-képlékeny konzol, tökéletesen képlékeny (H'=0)", () => {
  const plastic = makeMaterial('PL', 'Rug.-kepl.', { e: 2.1e8, sigmaY: 2.35e5, hPrime: 0 });

  it('a zárt alakú határteher (P=Mp/L) ALATT végig konvergál λ=1-ig', () => {
    const safeForce = -0.7 * (MP / L); // 70%-os biztonsági tartalék
    const model = cantileverModel(plastic, safeForce, 8);
    const result = runLoadStepper(model, { ...DEFAULT_OPTIONS, initialSteps: 5 });
    expect(result.status).toBe('converged');
  });

  it('a zárt alakú határteher (P=Mp/L) FÖLÖTT nem éri el λ=1-et — "limit-load-reached"', () => {
    const overForce = -1.3 * (MP / L); // 30%-kal a határteher fölött
    const model = cantileverModel(plastic, overForce, 8);
    const result = runLoadStepper(model, { ...DEFAULT_OPTIONS, initialSteps: 5, minStepFraction: 1 / 4096 });
    expect(result.status).toBe('limit-load-reached');
    const lastAccepted = result.steps.at(-1);
    const reachedLambda = lastAccepted?.lambda ?? 0;
    expect(reachedLambda).toBeLessThan(1);

    // A megközelített λ a zárt alakú (Mp/L)/|overForce| értékhez közel essen
    // — véges elemes diszkretizációnál ez NEM egzakt (a képlékeny "csukló"
    // véges Gauss-pont-tartományra terjed ki, nem nulla hosszra), ezért
    // nagyvonalú (15%) tűrés indokolt (HIBATURESI-POLITIKA 4. pont:
    // diszkretizációs hiba, nem egyetlen szám a követelmény).
    const closedFormLambda = MP / L / Math.abs(overForce);
    expect(Math.abs(reachedLambda - closedFormLambda) / closedFormLambda).toBeLessThan(0.15);
  });
});

describe('runLoadStepper — rétegelt (fiber) szelvény, teljes megoldás', () => {
  it('a réteges szelvényű konzol is konvergál, és a szélső rétegek folynak a folyási határ fölött', () => {
    const steel = makeMaterial('S1', 'Acél', { e: 2.1e8, sigmaY: 2.35e5, hPrime: 5e7 });
    const layered = makeLayeredSection('LX', 'Rétegelt', [
      { b: 0.2, t: 0.1, z: -0.15 },
      { b: 0.2, t: 0.2, z: 0 },
      { b: 0.2, t: 0.1, z: 0.15 },
    ]);
    resetLoadIds();
    const mesh = uniformMesh(L, 4, { sectionId: 'LX', materialId: 'S1' });
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [steel],
      sections: [layered],
      boundaries: [fixed('N0')],
      loads: [nodalForce('N8', -500, 'F1')],
    });

    const result = runLoadStepper(model, { ...DEFAULT_OPTIONS, initialSteps: 5 });
    expect(result.status).toBe('converged');
    const lastStep = mustGet(result.steps.at(-1));
    const firstElementState = mustGet(lastStep.states.get(mustGet(result.system.elements[0]).id));
    const someLayerYielded = firstElementState.gaussPoints.some((gp) => gp.kind === 'layered' && gp.layers.some((l) => l.yielded));
    expect(someLayerYielded).toBe(true);
  });
});

describe('runLoadStepper — Newton vs. módosított Newton (P-15)', () => {
  it('mindkét algoritmus ugyanoda konvergál, de eltérő iterációs/újraépítési profillal', () => {
    const hardening = makeMaterial('HD', 'Keményedő', { e: 2.1e8, sigmaY: 2.35e5, hPrime: 5e7 });
    const model = cantileverModel(hardening, -0.9 * (MP / L));

    const full = runLoadStepper(model, { ...DEFAULT_OPTIONS, algorithm: 'newton', initialSteps: 4 });
    const modified = runLoadStepper(model, {
      ...DEFAULT_OPTIONS,
      algorithm: 'modified-newton',
      initialSteps: 4,
      iterMax: 60,
    });

    expect(full.status).toBe('converged');
    expect(modified.status).toBe('converged');

    const fullLast = mustGet(full.steps.at(-1));
    const modifiedLast = mustGet(modified.steps.at(-1));
    for (let a = 0; a < fullLast.u.length; a++) {
      expect(modifiedLast.u[a]).toBeCloseTo(fullLast.u[a] ?? 0, 4);
    }

    const fullRebuilds = full.steps.flatMap((s) => s.iterations).filter((it) => it.stiffnessRebuilt).length;
    const modifiedRebuilds = modified.steps.flatMap((s) => s.iterations).filter((it) => it.stiffnessRebuilt).length;
    // Módosított Newton lépésenként LEGFELJEBB egyszer épít K_T-t — SOSEM
    // több, mint a teljes Newton (amely minden NEM utolsó iterációban újraépít).
    expect(modifiedRebuilds).toBeLessThanOrEqual(modified.steps.length);
    expect(modifiedRebuilds).toBeLessThanOrEqual(fullRebuilds);
  });
});

describe('runLoadStepper — reziduum-monotonitás teljes Newtonnál (P-16)', () => {
  it('egy képlékeny lépésen belül a reziduum monoton csökken', () => {
    const hardening = makeMaterial('HD2', 'Keményedő', { e: 2.1e8, sigmaY: 2.35e5, hPrime: 5e7 });
    const model = cantileverModel(hardening, -1.1 * (MP / L));
    const result = runLoadStepper(model, { ...DEFAULT_OPTIONS, algorithm: 'newton', initialSteps: 3 });
    expect(result.status).toBe('converged');

    const plasticStep = result.steps.find((s) => s.iterations.length > 2);
    if (plasticStep === undefined) throw new Error('nincs többiterációs (képlékeny) lépés a tesztben');
    for (let i = 1; i < plasticStep.iterations.length; i++) {
      const prev = plasticStep.iterations[i - 1];
      const cur = plasticStep.iterations[i];
      if (prev === undefined || cur === undefined) throw new Error('hiányzó iteráció');
      expect(cur.residualPercent).toBeLessThan(prev.residualPercent);
    }
  });
});

describe('runLoadStepper — hőteher/támaszmozgás hatókörön kívül (dokumentált korlát)', () => {
  it('hőteherrel a modellen hibát dob', () => {
    const elastic = makeMaterial('EL2', 'Rugalmas', { e: 2.1e8, alpha: 1.2e-5 });
    resetLoadIds();
    const mesh = uniformMesh(L, 2, { sectionId: 'R', materialId: 'EL2' });
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [elastic],
      sections: [SEC],
      boundaries: [fixed('N0')],
      loads: [thermal(10, 0)],
    });
    expect(() => runLoadStepper(model, DEFAULT_OPTIONS)).toThrow();
  });
});

describe('runLoadStepper — ‖ψ‖/‖f‖ (a levezetés 7. pontjának konvergencia-képletéhez)', () => {
  it('minden iterációs naplóbejegyzésnél 100·psiNorm/fNorm PONTOSAN a tárolt residualPercent-et adja', () => {
    const elastic = makeMaterial('EL4', 'Rugalmas', { e: 2.1e8 });
    const model = cantileverModel(elastic, -10);
    const result = runLoadStepper(model, { ...DEFAULT_OPTIONS, initialSteps: 3 });
    expect(result.steps.length).toBeGreaterThan(0);

    for (const step of result.steps) {
      for (const iter of step.iterations) {
        if (iter.fNorm === 0) continue;
        expect((100 * iter.psiNorm) / iter.fNorm).toBeCloseTo(iter.residualPercent, 8);
      }
    }
  });
});

describe('runLoadStepper — megszakíthatóság (AbortSignal)', () => {
  it('már megszakított jelre azonnal "aborted" státusszal tér vissza, elfogadott lépés nélkül', () => {
    const elastic = makeMaterial('EL3', 'Rugalmas', { e: 2.1e8 });
    const model = cantileverModel(elastic, -10);
    const controller = new AbortController();
    controller.abort();
    const result = runLoadStepper(model, { ...DEFAULT_OPTIONS, signal: controller.signal });
    expect(result.status).toBe('aborted');
    expect(result.steps).toHaveLength(0);
  });
});
