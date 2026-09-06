/**
 * Teljesítmény-profilozás (MASTER-PROMPT-TERV P16 prompt, 1. pont):
 * "5000 DOF-os modell, 100 teherlépcső, rétegelt szelvény 32 réteggel.
 * Célszám: teljes futás < 10 s asztali gépen; ha nem teljesül, a szűk
 * keresztmetszet MÉRÉSSEL azonosítva, nem találgatással."
 *
 * ALAPÉRTELMEZÉSBEN KIHAGYVA (a normál `pnpm check`/`pnpm test` ne lassuljon
 * le egy profilozó futással) — csak `PROFILE=1` környezeti változóval fut:
 *
 *   PROFILE=1 npx vitest run test/profile.perf.test.ts
 *
 * Ez a fájl NEM állít semmit (nem `expect`-el a célszámra) — csak MÉR és
 * kiír, a P16 elfogadási kritériumának megfelelően ("MÉRÉSSEL, nem
 * találgatással"). A tényleges elfogadás/optimalizálás-döntés a mérési
 * eredmény alapján, külön (docs/ADR és STATUS_REPORT.md) történik.
 */
import { PerformanceObserver } from 'node:perf_hooks';
import { describe, it } from 'vitest';
import {
  buildModel,
  distributedForce,
  fixed,
  generateLayers,
  iProfile,
  makeLayeredSection,
  makeMaterial,
  resetLoadIds,
  runLoadStepper,
  uniformMesh,
} from '../src/index.js';

const RUN = process.env.PROFILE === '1';

describe.skipIf(!RUN)('P16 profilozás — 5000 DOF, 100 teherlépcső, 32 réteg', () => {
  it('méri a teljes futásidőt és a fő szakaszok idejét', () => {
    resetLoadIds();

    const ELEMENT_COUNT = 1250; // DOF = 2*(2*1250+1) = 5002
    const SPAN = 50;
    const LAYER_COUNT = 32;

    let gcTimeMs = 0;
    let gcCount = 0;
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        gcTimeMs += entry.duration;
        gcCount += 1;
      }
    });
    obs.observe({ entryTypes: ['gc'] });

    const t0 = performance.now();

    // Szándékosan NINCS σY: a cél a 100-lépéses futás NYERS teljesítménye
    // (Kₑ-összeállítás + Newton-megoldás minden lépésben), rugalmas
    // (sosem folyó) anyaggal — így a lépésszám PONTOSAN 100 marad (nincs
    // Δλ-felezés/-növelés a folyás hiánya miatt), ami a P16 prompt "100
    // teherlépcső" előírásának kontrollált, zajmentes mérését adja.
    const mat = makeMaterial('S235', 'Acél S235', { e: 2.1e8, density: 7850 });
    const shape = iProfile(0.4, 0.2, 0.01, 0.016);
    const layers = generateLayers(shape, LAYER_COUNT);
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

    const tBuild = performance.now();

    const stepTimes: number[] = [];
    let lastT = performance.now();
    const result = runLoadStepper(model, {
      algorithm: 'newton',
      iterMax: 30,
      iterMin: 3,
      tolerancePercent: 0.5,
      initialSteps: 100,
      targetLambda: 1,
      deltaLambdaMax: 1 / 100, // ne engedje a lépésnövelést — kb. 100 lépés maradjon
      onProgress: () => {
        const now = performance.now();
        stepTimes.push(now - lastT);
        lastT = now;
      },
    });

    const tSolve = performance.now();
    obs.disconnect();

    const totalSteps = result.steps.length + result.rejectedAttempts.length;
    const totalMs = tSolve - t0;

    console.log(
      `\n[P16 PROFIL]\n` +
        `  DOF: ${model.nodes.length * 2}\n` +
        `  elemek: ${model.elements.length}\n` +
        `  rétegek/elem: ${LAYER_COUNT}\n` +
        `  státusz: ${result.status}\n` +
        `  elfogadott lépések: ${result.steps.length}, elvetett próbálkozások: ${result.rejectedAttempts.length}\n` +
        `  modellépítés: ${(tBuild - t0).toFixed(1)} ms\n` +
        `  megoldás (${totalSteps} próbálkozás): ${(tSolve - tBuild).toFixed(1)} ms\n` +
        `  GC: ${gcCount} esemény, összesen ${gcTimeMs.toFixed(1)} ms (${((gcTimeMs / (tSolve - tBuild)) * 100).toFixed(1)}% a megoldási időből)\n` +
        `  TELJES: ${totalMs.toFixed(1)} ms (${(totalMs / 1000).toFixed(2)} s)\n` +
        `  célszám (<10s): ${totalMs < 10000 ? 'TELJESÜL' : 'NEM TELJESÜL'}\n` +
        `  lépésidők (ms): első 5: [${stepTimes
          .slice(0, 5)
          .map((v) => v.toFixed(1))
          .join(', ')}]` +
        ` · középső 5 (45-50): [${stepTimes
          .slice(45, 50)
          .map((v) => v.toFixed(1))
          .join(', ')}]` +
        ` · utolsó 5: [${stepTimes
          .slice(-5)
          .map((v) => v.toFixed(1))
          .join(', ')}]\n`,
    );
  }, 120_000);
});
