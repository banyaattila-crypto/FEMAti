/**
 * P16 kontroll-mérés: a TÉNYLEGESEN használt UI-méretű modell teljesítménye
 * (`packages/ui/src/shell/Toolbar.tsx` elemszám-csúszkája 4–100 elem között
 * mozog, `LAYER_COUNT = 32` — ld. `packages/ui/src/model/nonlinear.ts`; a
 * rétegszámot 16-ról 32-re emeltük, ld. ADR-0014 — a réteg-középponti
 * mintavétel másodrendű hatása 16 rétegnél még ~4-5%-os Mₑ-eltérést adott,
 * 32-nél <1%-ra csökken). Ez a szám adja a viszonyítási alapot az 5000
 * DOF-os szélsőséges (stressz-teszt) eredményhez.
 *
 * `PROFILE=1 npx vitest run test/profile.ui-scale.perf.test.ts`
 */
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

describe.skipIf(!RUN)('P16 kontroll — UI-méretű modell (100 elem, 32 réteg)', () => {
  it('méri a valós felhasználói méretskálán a teljes futásidőt', () => {
    resetLoadIds();
    const ELEMENT_COUNT = 100; // a Toolbar csúszka maximuma
    const SPAN = 16; // a Toolbar csúszka maximuma [m]

    const t0 = performance.now();
    const mat = makeMaterial('S235', 'Acél S235', { e: 2.1e8, sigmaY: 2.35e5, density: 7850 });
    const shape = iProfile(0.3, 0.15, 0.008, 0.012);
    const section = makeLayeredSection('PROF', 'UI-méretű szelvény', generateLayers(shape, 32));
    const mesh = uniformMesh(SPAN, ELEMENT_COUNT, { sectionId: 'PROF', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [mat],
      sections: [section],
      boundaries: [fixed('N0')],
      loads: [distributedForce(0, SPAN, -10, -10, 'Q1')],
    });

    const result = runLoadStepper(model, {
      algorithm: 'newton',
      iterMax: 30,
      iterMin: 3,
      tolerancePercent: 0.5,
      initialSteps: 20,
      targetLambda: 1.2,
    });
    const totalMs = performance.now() - t0;

    console.log(
      `\n[P16 UI-MÉRETŰ KONTROLL]\n` +
        `  DOF: ${model.nodes.length * 2}, elemek: ${model.elements.length}\n` +
        `  státusz: ${result.status}, elfogadott lépések: ${result.steps.length}\n` +
        `  TELJES: ${totalMs.toFixed(1)} ms\n`,
    );
  }, 30_000);
});
