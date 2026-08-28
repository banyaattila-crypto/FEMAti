/**
 * Modális analízis: sajátfrekvenciák és módalakok — ADR-0016 (javasolt, még
 * el nem fogadott bővítés).
 *
 * A megoldandó általánosított sajátérték-feladat: K·φ = ω²·M·φ, ahol K a
 * MEGLÉVŐ statikus merevségi mátrix (`assembler.ts`), M az ÚJ tömegmátrix
 * (`massAssembler.ts`), mindkettő ugyanazzal a `DofMap`-pel, ugyanazokon az
 * aktív szabadságfokokon. Csak `elimination` peremfeltétel-stratégiát
 * támogat — a `penalty` (rugóval közelített megkötés) dinamikailag más
 * jelentésű lenne (a nagy penalty-rugó saját, hamis magas frekvenciájú
 * módust vinne be), ezért egyelőre tudatosan KIZÁRT.
 *
 * NINCS csillapítás, NINCS tranziens válasz — ld. ADR-0016 hatókör-döntése.
 */

import { generalizedSymmetricEigen } from '../linalg/eigen.js';
import { assemble } from '../assembly/assembler.js';
import { assembleMass } from '../assembly/massAssembler.js';
import { isRunnable, validateModel, type Diagnostic } from '../model/validate.js';
import { InvalidModelError } from './linearSolver.js';
import type { Model } from '../model/types.js';

export interface ModeShape {
  /** Sajátkörfrekvencia ω [rad/s]. */
  readonly omega: number;
  /** Sajátfrekvencia f = ω/2π [Hz]. */
  readonly frequencyHz: number;
  /**
   * A teljes módalak-vektor, [w, φ] párokban, csomópont-sorrendben (mint a
   * `LinearResult.displacements`) — a megkötött szabadságfokok 0-k. Az
   * amplitúdó ÖNKÉNYES (M-ortonormált: φᵢᵀ·M·φⱼ = δᵢⱼ), fizikai
   * elmozdulásként NEM értelmezhető közvetlenül.
   */
  readonly shape: Float64Array;
}

export interface ModalResult {
  readonly modes: readonly ModeShape[];
  readonly dofCount: number;
  readonly activeDofCount: number;
  readonly diagnostics: readonly Diagnostic[];
}

export interface ModalOptions {
  /** Hány legkisebb frekvenciájú módust adjon vissza (alapértelmezés: mind). */
  readonly modeCount?: number;
}

/**
 * @throws InvalidModelError ha a modell validációja hibát talál
 * @throws NotPositiveDefiniteError ha a tömegmátrix nem pozitív definit
 *         (pl. egy aktív szabadságfokhoz nulla fajsúlyú anyag tartozik)
 */
export function solveModal(model: Model, options: ModalOptions = {}): ModalResult {
  const diagnostics = validateModel(model);
  if (!isRunnable(diagnostics)) throw new InvalidModelError(diagnostics);

  const system = assemble(model, { strategy: 'elimination' });
  const kDense = system.k.toDense();
  const mDense = assembleMass(model, system.map, system.elements);

  const eig = generalizedSymmetricEigen(kDense, mDense);

  const count = Math.min(options.modeCount ?? eig.values.length, eig.values.length);
  const modes: ModeShape[] = [];
  for (let c = 0; c < count; c++) {
    // Numerikus zaj a merevtest-közeli/zérus módusoknál apró negatív λ-t is
    // adhat — fizikailag ω ≥ 0, ezért 0-ra vágjuk, NEM dobjuk el a módust.
    const lambda = Math.max(eig.values[c] ?? 0, 0);
    const omega = Math.sqrt(lambda);

    const shape = new Float64Array(system.map.totalDofs);
    for (let d = 0; d < system.map.totalDofs; d++) {
      const a = system.map.activeIndex[d] ?? -1;
      shape[d] = a >= 0 ? eig.vectors.get(a, c) : 0;
    }

    modes.push({ omega, frequencyHz: omega / (2 * Math.PI), shape });
  }

  return {
    modes,
    dofCount: system.map.totalDofs,
    activeDofCount: system.map.activeDofs,
    diagnostics,
  };
}
