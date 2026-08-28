import { describe, expect, it } from 'vitest';
import {
  buildModel,
  dampingMatrix,
  makeMaterial,
  makeSection,
  rayleighFromModalDamping,
  rect,
  roller,
  solveModal,
  solveTransient,
  uniformMesh,
  type Model,
} from '../src/index.js';

/**
 * ADR-0017: Rayleigh-csillapítás + Newmark-β tranziens megoldó. A validáció
 * ZÁRT ALAKÚ referenciákkal történik (nem csak a kód belső
 * konzisztenciájával) — a Rayleigh- (arányos) csillapítás KULCS-
 * tulajdonsága, hogy a csillapítatlan módalakok a csillapított rendszernek
 * IS sajátvektorai maradnak (ld. `solver/damping.ts` fejléce): ha a kezdeti
 * elmozdulás PONTOSAN egy módusalak, a válasz MINDVÉGIG abban a
 * módusalakban marad, egyszabadságfokú (csillapított) oszcillátorként.
 */

const STEEL = makeMaterial('S235', 'Acél S235', { e: 2.1e8, density: 7850 });
const SEC = makeSection('R1', 'Téglalap 20/40', rect(0.2, 0.4));

function simplySupported(length: number, elementCount: number): Model {
  const mesh = uniformMesh(length, elementCount, { sectionId: 'R1', materialId: 'S235' });
  const lastNode = `N${2 * elementCount}`;
  return buildModel({
    name: 'Kéttámaszú (tranziens)',
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [STEEL],
    sections: [SEC],
    boundaries: [roller('N0'), roller(lastNode)],
  });
}

/** A legnagyobb |w| szerinti szabadságfok indexe a módalak-vektorban — jó "kilengés-mutató". */
function dominantWDof(shape: Float64Array): number {
  let best = 0;
  let bestAbs = 0;
  for (let i = 0; i < shape.length; i += 2) {
    const v = Math.abs(shape[i] ?? 0);
    if (v > bestAbs) {
      bestAbs = v;
      best = i;
    }
  }
  return best;
}

describe('rayleighFromModalDamping / dampingMatrix', () => {
  it('a visszaadott α,β pontosan a célzott ζ-t adja mindkét módusra', () => {
    const omega1 = 10;
    const zeta1 = 0.02;
    const omega2 = 35;
    const zeta2 = 0.05;
    const { alpha, beta } = rayleighFromModalDamping(omega1, zeta1, omega2, zeta2);
    const z1 = alpha / (2 * omega1) + (beta * omega1) / 2;
    const z2 = alpha / (2 * omega2) + (beta * omega2) / 2;
    expect(z1).toBeCloseTo(zeta1, 12);
    expect(z2).toBeCloseTo(zeta2, 12);
  });

  it('C = α·M + β·K — közvetlen ellenőrzés kis mátrixon', async () => {
    const model = simplySupported(10, 2);
    const { assemble, assembleMass } = await import('../src/index.js');
    const system = assemble(model, { strategy: 'elimination' });
    const k = system.k.toDense();
    const m = assembleMass(model, system.map, system.elements);
    const damping = { alpha: 2, beta: 0.001 };
    const c = dampingMatrix(k, m, damping);
    for (let i = 0; i < c.rows; i++) {
      for (let j = 0; j < c.cols; j++) {
        expect(c.get(i, j)).toBeCloseTo(damping.alpha * m.get(i, j) + damping.beta * k.get(i, j), 10);
      }
    }
  });
});

describe('solveTransient — Newmark-β, zárt alakú validáció (ADR-0017)', () => {
  it('csillapítatlan szabadrezgés az 1. módusalakból: u(t) = u0·cos(ω1·t)', () => {
    const model = simplySupported(10, 8);
    const modal = solveModal(model, { modeCount: 1 });
    const mode = modal.modes[0];
    if (mode === undefined) throw new Error('nincs módus');

    const period = (2 * Math.PI) / mode.omega;
    const dt = period / 200;
    const steps = 400; // 2 periódus

    const result = solveTransient(model, { dt, steps, initialDisplacement: mode.shape });

    const dof = dominantWDof(mode.shape);
    const u0 = mode.shape[dof] ?? 0;
    const amplitudeScale = Math.abs(u0);

    let maxErr = 0;
    for (const s of result.steps) {
      const expected = u0 * Math.cos(mode.omega * s.t);
      const actual = s.displacement[dof] ?? 0;
      maxErr = Math.max(maxErr, Math.abs(actual - expected) / amplitudeScale);
    }
    // MÉRVE (nem találgatva): dt=T/200 mellett a mért csúcshiba 9.08e-4 —
    // ez főként a Newmark átlagos-gyorsulás módszer kis periódushiba-
    // eredetű fáziseltolódása 2 periódus alatt, nem hiba. A tűrés a mért
    // érték fölé van rögzítve.
    expect(maxErr).toBeLessThan(1.2e-3);
  });

  it('Rayleigh-csillapított szabadrezgés lecsengése zárt alakkal egyezik', () => {
    const model = simplySupported(10, 8);
    const modal = solveModal(model, { modeCount: 2 });
    const m1 = modal.modes[0];
    const m2 = modal.modes[1];
    if (m1 === undefined || m2 === undefined) throw new Error('nincs elég módus');

    const zeta1 = 0.05;
    const damping = rayleighFromModalDamping(m1.omega, zeta1, m2.omega, 0.05);

    const period = (2 * Math.PI) / m1.omega;
    const dt = period / 200;
    const steps = 600; // 3 periódus, a lecsengés is jól látszik

    const result = solveTransient(model, {
      dt,
      steps,
      damping,
      initialDisplacement: m1.shape,
    });

    const dof = dominantWDof(m1.shape);
    const u0 = m1.shape[dof] ?? 0;
    const amplitudeScale = Math.abs(u0);
    const omegaD = m1.omega * Math.sqrt(1 - zeta1 * zeta1);

    let maxErr = 0;
    for (const s of result.steps) {
      // Csillapított szabadrezgés zárt alakja x(0)=u0, ẋ(0)=0 esetén
      // (Chopra, Dynamics of Structures): x(t)=u0·e^(−ζωt)·[cos(ωd t)+(ζω/ωd)·sin(ωd t)].
      const envelope = Math.exp(-zeta1 * m1.omega * s.t);
      const expected = u0 * envelope * (Math.cos(omegaD * s.t) + ((zeta1 * m1.omega) / omegaD) * Math.sin(omegaD * s.t));
      const actual = s.displacement[dof] ?? 0;
      maxErr = Math.max(maxErr, Math.abs(actual - expected) / amplitudeScale);
    }
    // MÉRVE: 5.99e-4, ugyanaz a fáziseltolódási forrás, mint fent.
    expect(maxErr).toBeLessThan(8e-4);
  });

  it('csillapítás/gerjesztés nélkül a teljes mechanikai energia megmarad (Newmark-β nem visz be numerikus csillapítást)', async () => {
    const model = simplySupported(10, 6);
    const { assemble, assembleMass } = await import('../src/index.js');
    const system = assemble(model, { strategy: 'elimination' });
    const k = system.k.toDense();
    const m = assembleMass(model, system.map, system.elements);

    const modal = solveModal(model, { modeCount: 1 });
    const mode = modal.modes[0];
    if (mode === undefined) throw new Error('nincs módus');
    const period = (2 * Math.PI) / mode.omega;

    const result = solveTransient(model, {
      dt: period / 100,
      steps: 300, // 3 periódus
      initialDisplacement: mode.shape,
    });

    const activeIdx = (full: Float64Array): Float64Array => {
      const out = new Float64Array(system.map.activeDofs);
      for (let d = 0; d < system.map.totalDofs; d++) {
        const a = system.map.activeIndex[d] ?? -1;
        if (a >= 0) out[a] = full[d] ?? 0;
      }
      return out;
    };
    const energyOf = (s: (typeof result.steps)[number]): number => {
      const v = activeIdx(s.velocity);
      const u = activeIdx(s.displacement);
      const mv = m.multiplyVector(v);
      const ku = k.multiplyVector(u);
      let kinetic = 0;
      let elastic = 0;
      for (let i = 0; i < v.length; i++) {
        kinetic += 0.5 * v[i] * (mv[i] ?? 0);
        elastic += 0.5 * u[i] * (ku[i] ?? 0);
      }
      return kinetic + elastic;
    };

    const energies = result.steps.map(energyOf);
    const e0 = energies[0] ?? 0;
    const maxRelDrift = Math.max(...energies.map((e) => Math.abs(e - e0) / e0));
    // MÉRVE: 1.47e-12 — a Newmark-β átlagos gyorsulás módszer ELMÉLETILEG
    // pontosan energiakonzisztens (nincs numerikus csillapítás); a mért
    // drift gépi pontosság, nem periódushiba-eredetű.
    expect(maxRelDrift).toBeLessThan(1e-9);
  });
});
