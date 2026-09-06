/**
 * P16 profilozás — RÉSZLETES, szakaszonkénti mérés (MÉRÉSSEL azonosítva a
 * szűk keresztmetszetet, nem találgatással). A `profile.perf.test.ts`
 * teljes-futásidőt mér; ez a fájl ugyanazon modellen KÜLÖN méri a Kₑ-
 * összeállítást (elemenkénti `elementTangentStiffness` hívások + a Skyline
 * profil felépítése), és a Skyline-megoldást (faktorizálás+visszahelyettesítés)
 * — mindkettő PONTOSAN azokat a publikus fem-core függvényeket hívja, amiket
 * a valódi `runNewtonRaphsonStep()` (ld. `newtonRaphson.ts`
 * `buildTangentMatrix()`) — csak külön mérve.
 *
 * `PROFILE=1 npx vitest run test/profile.detail.perf.test.ts`
 */
import { describe, it } from 'vitest';
import {
  assemble,
  buildLoadVector,
  buildModel,
  distributedForce,
  elementInternalForceVector,
  elementTangentStiffness,
  fixed,
  generateLayers,
  initialNonlinearState,
  iProfile,
  makeLayeredSection,
  makeMaterial,
  elementMaterialData,
  resetLoadIds,
  uniformMesh,
  updateGaussPointState,
  strains,
  SkylineMatrix,
} from '../src/index.js';

const RUN = process.env.PROFILE === '1';
const REPS = 20;

describe.skipIf(!RUN)('P16 profilozás — szakaszonkénti bontás', () => {
  it('méri a Kₑ-összeállítás és a Skyline-megoldás külön idejét', () => {
    resetLoadIds();
    const ELEMENT_COUNT = 1250;
    const SPAN = 50;

    const mat = makeMaterial('S235', 'Acél S235', { e: 2.1e8, density: 7850 });
    const shape = iProfile(0.4, 0.2, 0.01, 0.016);
    const layers = generateLayers(shape, 32);
    const section = makeLayeredSection('PROF', 'Profilozó szelvény', layers);
    const mesh = uniformMesh(SPAN, ELEMENT_COUNT, { sectionId: 'PROF', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [mat],
      sections: [section],
      boundaries: [fixed('N0')],
      loads: [distributedForce(0, SPAN, -10, -10, 'Q1')],
    });

    const system = assemble(model, { strategy: 'elimination' });

    const materialData = new Map(model.elements.map((e) => [e.id as string, elementMaterialData(model, e)]));
    const states = initialNonlinearState(
      system.elements.map((e) => e.id),
      materialData,
    );

    const rhs = new Float64Array(system.map.activeDofs).fill(1);
    const connectivity = system.elements.map((e) => e.activeDofs);

    let tKeLoop = 0;
    let tProfile = 0;
    let tAddBlock = 0;
    let tSolve = 0;

    for (let r = 0; r < REPS; r++) {
      const t0 = performance.now();
      const keList = system.elements.map((e) => {
        const st = states.get(e.id);
        if (st === undefined) throw new Error('hiányzó állapot');
        return elementTangentStiffness(e.nodeX, e.id, st.gaussPoints, e.stiffness.gas, 'selective');
      });
      tKeLoop += performance.now() - t0;

      const t1 = performance.now();
      const k = SkylineMatrix.fromConnectivity(system.map.activeDofs, connectivity);
      tProfile += performance.now() - t1;

      const t2 = performance.now();
      system.elements.forEach((e, i) => {
        const ke = keList[i];
        if (ke !== undefined) k.addBlock(e.activeDofs, ke);
      });
      tAddBlock += performance.now() - t2;

      const t3 = performance.now();
      k.solve(rhs);
      tSolve += performance.now() - t3;
    }

    // ── Állapotfrissítés (updateAllStates): elemenként 3 Gauss-pont × 32 réteg ──
    let tUpdateStates = 0;
    const ue = new Float64Array(6);
    for (let r = 0; r < REPS; r++) {
      const t0 = performance.now();
      for (const e of system.elements) {
        const data = materialData.get(e.id);
        const prev = states.get(e.id);
        if (data === undefined || prev === undefined) continue;
        for (let i = 0; i < 6; i++) ue[i] = 0;
        for (let gi = 0; gi < 3; gi++) {
          const xi = gi === 0 ? -Math.sqrt(0.6) : gi === 1 ? 0 : Math.sqrt(0.6);
          const { kappa } = strains(e.nodeX, ue, xi, e.id);
          const prevGp = prev.gaussPoints[gi];
          if (prevGp === undefined) continue;
          updateGaussPointState(data, prevGp, kappa);
        }
      }
      tUpdateStates += performance.now() - t0;
    }

    // ── Belső erővektor (assembleInternalForce): elementInternalForceVector ──
    let tInternalForce = 0;
    for (let r = 0; r < REPS; r++) {
      const t0 = performance.now();
      for (const e of system.elements) {
        const st = states.get(e.id);
        if (st === undefined) continue;
        elementInternalForceVector(e.nodeX, e.id, ue, st.gaussPoints, e.stiffness.gas, 'selective');
      }
      tInternalForce += performance.now() - t0;
    }

    // ── Tehervektor összeállítása (buildLoadVector) — MINDEN próbálkozásnál lefut ──
    let tLoadVector = 0;
    for (let r = 0; r < REPS; r++) {
      const t0 = performance.now();
      buildLoadVector(model, system.map, 1);
      tLoadVector += performance.now() - t0;
    }

    const perStep = (tKeLoop + tProfile + tAddBlock + tSolve) / REPS;
    const perIteration = tUpdateStates / REPS + tInternalForce / REPS;
    const perLoadVector = tLoadVector / REPS;
    // Egy lépés jellemzően 2 iteráció (1. build+solve, 2. csak ellenőrzés) —
    // mindkettő elején fut updateAllStates+assembleInternalForce — PLUSZ a
    // tehervektor összeállítása a lépés elején, egyszer.
    const estimatedStepTotal = perStep + 2 * perIteration + perLoadVector;

    console.log(
      `\n[P16 RÉSZLETES PROFIL] (${REPS} ismétlés átlaga, DOF=${system.map.activeDofs}, elem=${system.elements.length}, réteg/elem=32)\n` +
        `  Kₑ-összeállítás (elementTangentStiffness × ${system.elements.length} elem): ${(tKeLoop / REPS).toFixed(2)} ms\n` +
        `  Skyline profil felépítése (fromConnectivity): ${(tProfile / REPS).toFixed(2)} ms\n` +
        `  Blokkok beillesztése (addBlock × ${system.elements.length}): ${(tAddBlock / REPS).toFixed(2)} ms\n` +
        `  Skyline faktorizálás+megoldás (solve): ${(tSolve / REPS).toFixed(2)} ms\n` +
        `  → K_T-építés+megoldás ÖSSZESEN: ${perStep.toFixed(2)} ms\n` +
        `  Állapotfrissítés (updateGaussPointState × ${system.elements.length} elem × 3 GP × 32 réteg): ${(tUpdateStates / REPS).toFixed(2)} ms\n` +
        `  Belső erővektor (elementInternalForceVector × ${system.elements.length} elem): ${(tInternalForce / REPS).toFixed(2)} ms\n` +
        `  → EGY Newton-iteráció eleje (állapot+belső erő) ÖSSZESEN: ${perIteration.toFixed(2)} ms\n` +
        `  Tehervektor összeállítása (buildLoadVector, MINDEN próbálkozásnál lefut): ${perLoadVector.toFixed(2)} ms\n` +
        `  BECSÜLT EGY TEHERLÉPCSŐ (2 iteráció + 1 tehervektor): ${estimatedStepTotal.toFixed(2)} ms\n` +
        `  100 lépésre extrapolálva: ${(estimatedStepTotal * 100).toFixed(0)} ms (${((estimatedStepTotal * 100) / 1000).toFixed(2)} s)\n`,
    );
  }, 60_000);
});
