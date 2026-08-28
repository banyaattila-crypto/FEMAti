/**
 * Tranziens (időlépéses) dinamikai válasz — Newmark-β integrátor.
 * ADR-0017.
 *
 * Az egyenlet: M·ü + C·u̇ + K·u = F(t). A Newmark-β módszer (átlagos
 * gyorsulás: β=1/4, γ=1/2 — FELTÉTEL NÉLKÜL stabil, ez az alapértelmezés)
 * minden lépésben egy EFFEKTÍV, statikus egyenletrendszert old meg:
 *
 *   K_eff·u_{n+1} = F_eff,   K_eff = K + a0·M + a1·C
 *
 * ahol a0=1/(β·Δt²), a1=γ/(β·Δt) állandó (Δt fix lépésköznél), ezért
 * `K_eff` Cholesky-felbontása CSAK EGYSZER készül el, és minden lépésben
 * újrafelhasználódik (`choleskySolve`) — ugyanaz a minta, mint a
 * `generalizedSymmetricEigen`-nél (`linalg/eigen.ts`).
 *
 * Forrás: klasszikus szerkezetdinamikai eredmény (Newmark 1959; a konkrét
 * együttható-alak Bathe, *Finite Element Procedures* jelöléséhez igazodik),
 * NEM ennek a projektnek a saját levezetése — a validáció (ld.
 * `test/transient.test.ts`) éppen ezért zárt alakú referenciával
 * (csillapítatlan/csillapított szabadrezgés) történik, nem csak a kód
 * belső konzisztenciájával.
 */
import { DenseMatrix } from '../linalg/dense.js';
import { cholesky, choleskySolve } from '../linalg/eigen.js';
import { assemble } from '../assembly/assembler.js';
import { assembleMass } from '../assembly/massAssembler.js';
import { isRunnable, validateModel } from '../model/validate.js';
import { InvalidModelError } from './linearSolver.js';
import { dampingMatrix, type RayleighDamping } from './damping.js';
import type { Model } from '../model/types.js';

export interface TransientStep {
  readonly t: number;
  /** TELJES (megkötöttekkel együtt) elmozdulásvektor, mint `LinearResult.displacements`. */
  readonly displacement: Float64Array;
  readonly velocity: Float64Array;
  readonly acceleration: Float64Array;
}

export interface TransientOptions {
  /** Időlépés [s]. */
  readonly dt: number;
  /** Lépések száma (a `steps+1`. állapot is benne van, t=0-tól). */
  readonly steps: number;
  /** Newmark-β paraméter (alapértelmezés 1/4 — átlagos gyorsulás, feltétel nélkül stabil). */
  readonly beta?: number;
  /** Newmark-γ paraméter (alapértelmezés 1/2). */
  readonly gamma?: number;
  /** Rayleigh-csillapítás; hiányzó esetén C = 0 (csillapítatlan). */
  readonly damping?: RayleighDamping;
  /** Kezdeti elmozdulás, TELJES DOF vektor. Alapértelmezés: 0. */
  readonly initialDisplacement?: Float64Array;
  /** Kezdeti sebesség, TELJES DOF vektor. Alapértelmezés: 0. */
  readonly initialVelocity?: Float64Array;
  /** Külső gerjesztő erő időfüggvénye, TELJES DOF vektor. Alapértelmezés: 0. */
  readonly force?: (t: number) => Float64Array;
}

export interface TransientResult {
  readonly steps: readonly TransientStep[];
  readonly dofCount: number;
  readonly activeDofCount: number;
}

/**
 * @throws InvalidModelError ha a modell validációja hibát talál
 * @throws NotPositiveDefiniteError ha a tömegmátrix vagy az effektív
 *         merevségi mátrix nem pozitív definit
 */
export function solveTransient(model: Model, options: TransientOptions): TransientResult {
  const diagnostics = validateModel(model);
  if (!isRunnable(diagnostics)) throw new InvalidModelError(diagnostics);

  const beta = options.beta ?? 0.25;
  const gamma = options.gamma ?? 0.5;
  const dt = options.dt;

  const system = assemble(model, { strategy: 'elimination' });
  const k = system.k.toDense();
  const m = assembleMass(model, system.map, system.elements);
  const c =
    options.damping !== undefined
      ? dampingMatrix(k, m, options.damping)
      : DenseMatrix.zeros(k.rows, k.cols);

  const n = system.map.activeDofs;

  const reduce = (full: Float64Array | undefined): Float64Array => {
    const out = new Float64Array(n);
    if (full === undefined) return out;
    for (let d = 0; d < system.map.totalDofs; d++) {
      const a = system.map.activeIndex[d] ?? -1;
      if (a >= 0) out[a] = full[d] ?? 0;
    }
    return out;
  };
  const expand = (active: Float64Array): Float64Array => {
    const out = new Float64Array(system.map.totalDofs);
    for (let d = 0; d < system.map.totalDofs; d++) {
      const a = system.map.activeIndex[d] ?? -1;
      out[d] = a >= 0 ? (active[a] ?? 0) : 0;
    }
    return out;
  };

  const u0 = reduce(options.initialDisplacement);
  const v0 = reduce(options.initialVelocity);
  const f0 = options.force !== undefined ? reduce(options.force(0)) : new Float64Array(n);

  // Kezdeti gyorsulás: M·a₀ = F₀ − C·v₀ − K·u₀
  const mChol = cholesky(m);
  const kU0 = k.multiplyVector(u0);
  const cV0 = c.multiplyVector(v0);
  const rhs0 = new Float64Array(n);
  for (let i = 0; i < n; i++) rhs0[i] = (f0[i] ?? 0) - (cV0[i] ?? 0) - (kU0[i] ?? 0);
  const a0State = choleskySolve(mChol, rhs0);

  // Newmark-β állandók (Bathe-jelölés).
  const c0 = 1 / (beta * dt * dt);
  const c1 = gamma / (beta * dt);
  const c2 = 1 / (beta * dt);
  const c3 = 1 / (2 * beta) - 1;
  const c4 = gamma / beta - 1;
  const c5 = (dt / 2) * (gamma / beta - 2);
  const c6 = dt * (1 - gamma);
  const c7 = dt * gamma;

  const kEff = DenseMatrix.zeros(n, n);
  kEff.addScaled(1, k);
  kEff.addScaled(c0, m);
  kEff.addScaled(c1, c);
  const kEffChol = cholesky(kEff);

  let u = u0;
  let v = v0;
  let a = a0State;

  const steps: TransientStep[] = [
    { t: 0, displacement: expand(u), velocity: expand(v), acceleration: expand(a) },
  ];

  for (let step = 1; step <= options.steps; step++) {
    const t = step * dt;
    const fNext = options.force !== undefined ? reduce(options.force(t)) : new Float64Array(n);

    const mTerm = new Float64Array(n);
    const cTerm = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      mTerm[i] = c0 * (u[i] ?? 0) + c2 * (v[i] ?? 0) + c3 * (a[i] ?? 0);
      cTerm[i] = c1 * (u[i] ?? 0) + c4 * (v[i] ?? 0) + c5 * (a[i] ?? 0);
    }
    const mContribution = m.multiplyVector(mTerm);
    const cContribution = c.multiplyVector(cTerm);
    const fEff = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      fEff[i] = (fNext[i] ?? 0) + (mContribution[i] ?? 0) + (cContribution[i] ?? 0);
    }

    const uNext = choleskySolve(kEffChol, fEff);
    const aNext = new Float64Array(n);
    const vNext = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      aNext[i] = c0 * ((uNext[i] ?? 0) - (u[i] ?? 0)) - c2 * (v[i] ?? 0) - c3 * (a[i] ?? 0);
      vNext[i] = (v[i] ?? 0) + c6 * (a[i] ?? 0) + c7 * aNext[i];
    }

    u = uNext;
    v = vNext;
    a = aNext;
    steps.push({ t, displacement: expand(u), velocity: expand(v), acceleration: expand(a) });
  }

  return { steps, dofCount: system.map.totalDofs, activeDofCount: n };
}
