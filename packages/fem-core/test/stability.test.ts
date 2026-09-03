import { describe, expect, it } from 'vitest';
import { buildModel, makeMaterial, makeSection, nodalForce, pinned, rect, solveLinear, uniformMesh, type Model } from '../src/index.js';

/**
 * Másodrendű (P-Δ) hatás — 2026-09-04. A modellnek NINCS axiális
 * szabadságfoka (ld. `element/timoshenko3.ts` `elementGeometricStiffness()`
 * fejléce) — az `axialForce` egy KÜLSŐLEG megadott referenciaérték, nem
 * megoldott mennyiség. Ez a teszt a `solveLinear(model, { axialForce })`
 * bekötést ellenőrzi FIZIKAI szanitással, nem zárt alakú egzakt egyeztetéssel
 * (a modell nyírásra hajlékony, ezért a valódi kritikus teher kissé eltér a
 * klasszikus Euler-Bernoulli értéktől).
 */

const STEEL = makeMaterial('S235', 'Acél S235', { e: 2.1e8, sigmaY: 2.35e5 });
const SEC = makeSection('R1', 'Téglalap 20/40', rect(0.2, 0.4));
const EI = (STEEL.e as number) * ((0.2 * 0.4 ** 3) / 12);

function simplySupported(length: number, elementCount: number, midSpanLoad: number): Model {
  const mesh = uniformMesh(length, elementCount, { sectionId: 'R1', materialId: 'S235' });
  const lastNode = `N${2 * elementCount}`;
  const midNode = `N${elementCount}`;
  return buildModel({
    name: 'Kéttámaszú (stabilitás)',
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [STEEL],
    sections: [SEC],
    boundaries: [pinned('N0'), pinned(lastNode)],
    loads: [nodalForce(midNode, midSpanLoad, 'P1')],
  });
}

describe('solveLinear — axialForce (P-Δ)', () => {
  it('axialForce=0 (vagy hiányzó opció) esetén bájtra ugyanazt adja, mint eddig (regresszió)', () => {
    const model = simplySupported(6, 8, -10);
    const withoutOption = solveLinear(model);
    const withZero = solveLinear(model, { axialForce: 0 });
    expect(withZero.extremes.w.value).toBe(withoutOption.extremes.w.value);
    expect(withZero.extremes.m.value).toBe(withoutOption.extremes.m.value);
  });

  it('nyomóerő növeli, húzóerő csökkenti a lehajlást/nyomatékot ugyanarra a keresztteherre, az egyensúly mindkét esetben teljesül', () => {
    const model = simplySupported(6, 8, -10);
    const nEuler = (Math.PI ** 2 * EI) / 6 ** 2; // Ncr, klasszikus Euler-Bernoulli, csuklós-csuklós

    const neutral = solveLinear(model);
    const compressed = solveLinear(model, { axialForce: 0.3 * nEuler });
    const tensioned = solveLinear(model, { axialForce: -0.3 * nEuler });

    expect(neutral.equilibrium.satisfied).toBe(true);
    expect(compressed.equilibrium.satisfied).toBe(true);
    expect(tensioned.equilibrium.satisfied).toBe(true);

    const wNeutral = Math.abs(neutral.extremes.w.value);
    const wCompressed = Math.abs(compressed.extremes.w.value);
    const wTensioned = Math.abs(tensioned.extremes.w.value);
    expect(wCompressed).toBeGreaterThan(wNeutral);
    expect(wTensioned).toBeLessThan(wNeutral);
  });

  it('az amplifikáció monoton nő, ahogy a nyomóerő közelít a klasszikus Euler-kritikus teherhez (nagyságrendi szanitás)', () => {
    const model = simplySupported(6, 8, -10);
    const nEuler = (Math.PI ** 2 * EI) / 6 ** 2;
    const w0 = Math.abs(solveLinear(model).extremes.w.value);

    const ratios = [0.5, 0.7, 0.9].map(
      (frac) => Math.abs(solveLinear(model, { axialForce: frac * nEuler }).extremes.w.value) / w0,
    );

    expect(ratios[0]).toBeGreaterThan(1);
    expect(ratios[1]).toBeGreaterThan(ratios[0] as number);
    expect(ratios[2]).toBeGreaterThan(ratios[1] as number);
    // 90%-os Euler-teher közelében az amplifikáció már jelentős (a klasszikus
    // 1/(1−N/Ncr)≈10 nagyságrendjébe esik) — laza, nagyságrendi ellenőrzés.
    expect(ratios[2]).toBeGreaterThan(3);
  });
});
