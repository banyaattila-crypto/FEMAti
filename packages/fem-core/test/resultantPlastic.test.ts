import { describe, expect, it } from 'vitest';
import {
  INITIAL_RESULTANT_PLASTIC_STATE,
  plasticMomentCapacity,
  tangentBendingStiffness,
  updateResultantPlasticState,
  yieldFunction,
} from '../src/material/resultantPlastic.js';

describe('plasticMomentCapacity', () => {
  it('M0 = σY·Kp', () => {
    expect(plasticMomentCapacity(23.5e4, 0.006)).toBeCloseTo(23.5e4 * 0.006, 10);
  });
});

describe('yieldFunction', () => {
  it('f = M² − M0² — negatív rugalmas tartományban, nulla a folyási felületen', () => {
    expect(yieldFunction(50, 100)).toBeLessThan(0);
    expect(yieldFunction(100, 100)).toBeCloseTo(0, 10);
    expect(yieldFunction(-100, 100)).toBeCloseTo(0, 10); // szimmetrikus M0-ra
    expect(yieldFunction(150, 100)).toBeGreaterThan(0);
  });
});

describe('tangentBendingStiffness', () => {
  it("EI_T = EI·H'/(EI+H')", () => {
    const ei = 20000;
    const hPrime = 5000;
    expect(tangentBendingStiffness(ei, hPrime)).toBeCloseTo((ei * hPrime) / (ei + hPrime), 10);
  });

  it("H'=0 (tökéletesen képlékeny) esetén EI_T=0", () => {
    expect(tangentBendingStiffness(20000, 0)).toBe(0);
  });

  it("nagyon nagy H' esetén EI_T közelít EI-hez (a keményedés elhanyagolható)", () => {
    const ei = 20000;
    expect(tangentBendingStiffness(ei, 1e9)).toBeCloseTo(ei, -1);
  });
});

describe("updateResultantPlasticState — terhelés-tehermentesítés, H'=0 (tökéletesen képlékeny)", () => {
  const ei = 20000; // kNm²
  const gas = 8000; // kN
  const m0 = 100; // kNm
  const hPrime = 0;

  it('rugalmas tartományban M = EI·κ, T = GAs·γ, yielded=false', () => {
    const r = updateResultantPlasticState(INITIAL_RESULTANT_PLASTIC_STATE, 0, 0, ei, gas, m0, hPrime, 0.002, 0.001);
    expect(r.m).toBeCloseTo(ei * 0.002, 10);
    expect(r.t).toBeCloseTo(gas * 0.001, 10);
    expect(r.state.yielded).toBe(false);
    expect(r.tangentEI).toBe(ei);
  });

  it('a folyási nyomatékot (M0) elérve a nyomaték a plafonon marad (tökéletesen képlékeny fennsík)', () => {
    // κ_yield = M0/EI = 100/20000 = 0.005; jóval túllépjük.
    const r = updateResultantPlasticState(INITIAL_RESULTANT_PLASTIC_STATE, 0, 0, ei, gas, m0, hPrime, 0.02, 0);
    expect(r.m).toBeCloseTo(m0, 8);
    expect(r.state.yielded).toBe(true);
    expect(r.tangentEI).toBe(0);
  });

  it('teljes terhelés–tehermentesítési ciklus: a görbe PONTOSAN a lineárisan rugalmas – tökéletesen képlékeny alakot adja', () => {
    let state = INITIAL_RESULTANT_PLASTIC_STATE;
    let m = 0;
    let t = 0;
    const path: { kappa: number; m: number }[] = [];
    let kappaTotal = 0;

    // 6 lépés terhelés (κ: 0→0.006, a folyás κ=0.005-nél kezdődik), majd
    // 5 lépés tehermentesítés (Δκ=-0.005 pontosan M0/EI-t tesz ki, tehát az
    // utolsó lépés után M≡0-nál áll meg — zárt alakban ellenőrizhető útvonal).
    const steps = [0.001, 0.001, 0.001, 0.001, 0.001, 0.001, -0.001, -0.001, -0.001, -0.001, -0.001];
    for (const dKappa of steps) {
      const r = updateResultantPlasticState(state, m, t, ei, gas, m0, hPrime, dKappa, 0);
      state = r.state;
      m = r.m;
      t = r.t;
      kappaTotal += dKappa;
      path.push({ kappa: kappaTotal, m });
    }

    // A TERHELÉSI szakasz (az első 6 lépés, index 0..5) — a többi már
    // tehermentesítés, ahol κ≤0.005 önmagában nem különbözteti meg a két
    // ágat, ezért indexre, nem κ-értékre szűrünk.
    const loadingPath = path.slice(0, 6);

    // 1) A folyási görbületig (κ ≤ 0.005) egzakt lineáris: M = EI·κ.
    const beforeYield = loadingPath.filter((p) => p.kappa <= 0.005 + 1e-12);
    for (const p of beforeYield) {
      expect(p.m).toBeCloseTo(ei * p.kappa, 6);
    }

    // 2) A folyás után (κ > 0.005), amíg a terhelés folytatódik, M ≡ M0 (fennsík).
    const plateauLoading = loadingPath.slice(beforeYield.length);
    for (const p of plateauLoading) {
      expect(p.m).toBeCloseTo(m0, 8);
    }

    // 3) Tehermentesítéskor (a 6. lépéstől) a válasz AZONNAL rugalmas
    //    meredekségűre vált (EI), NEM marad a fennsíkon.
    const unloadStart = path[6];
    const unloadNext = path[7];
    if (unloadStart === undefined || unloadNext === undefined) throw new Error('hiányzó lépés');
    const slope = (unloadNext.m - unloadStart.m) / (unloadNext.kappa - unloadStart.kappa);
    expect(slope).toBeCloseTo(ei, 6);

    // 4) A teljes tehermentesítés után marad vissza képlékeny görbület
    //    (a keresztmetszet nem tér vissza κ=0-ba, M=0-nál) — ez a
    //    diplomaterv (3-9. ábra) jellemzője: "tehermentesítés után relatív
    //    elfordulás (görbület) marad vissza".
    const last = path[path.length - 1];
    if (last === undefined) throw new Error('üres útvonal');
    expect(last.m).toBeCloseTo(0, 6);
    expect(last.kappa).toBeGreaterThan(0); // maradó (képlékeny) görbület
  });
});

describe("updateResultantPlasticState — keményedés (H'>0)", () => {
  const ei = 20000;
  const gas = 8000;
  const m0 = 100;
  const hPrime = 5000;

  it('a folyás után a meredekség EI_T, és a nyomaték M0 fölé emelkedik', () => {
    const step1 = updateResultantPlasticState(INITIAL_RESULTANT_PLASTIC_STATE, 0, 0, ei, gas, m0, hPrime, 0.006, 0);
    expect(step1.m).toBeGreaterThan(m0);
    expect(step1.state.yielded).toBe(true);

    const step2 = updateResultantPlasticState(step1.state, step1.m, step1.t, ei, gas, m0, hPrime, 0.001, 0);
    const slope = (step2.m - step1.m) / 0.001;
    expect(slope).toBeCloseTo(tangentBendingStiffness(ei, hPrime), 4);
  });

  it('tehermentesítés a keményedési ágról is EI meredekséggel indul', () => {
    const loaded = updateResultantPlasticState(INITIAL_RESULTANT_PLASTIC_STATE, 0, 0, ei, gas, m0, hPrime, 0.01, 0);
    const unloaded = updateResultantPlasticState(loaded.state, loaded.m, loaded.t, ei, gas, m0, hPrime, -0.0001, 0);
    const slope = (unloaded.m - loaded.m) / -0.0001;
    expect(slope).toBeCloseTo(ei, 4);
    expect(unloaded.state.yielded).toBe(false);
  });
});

describe('updateResultantPlasticState — nyírás mindig rugalmas', () => {
  it('T = GAs·Δγ akkumulálva, függetlenül attól, hogy M képlékeny-e', () => {
    const ei = 20000;
    const gas = 8000;
    const m0 = 100;
    const plastic = updateResultantPlasticState(INITIAL_RESULTANT_PLASTIC_STATE, 0, 0, ei, gas, m0, 0, 0.02, 0.0025);
    expect(plastic.state.yielded).toBe(true);
    expect(plastic.t).toBeCloseTo(gas * 0.0025, 8);
  });
});
