import { describe, expect, it } from 'vitest';
import {
  INITIAL_LAYER_PLASTIC_STATE,
  updateLayerPlasticState,
} from '../src/material/elastoPlastic1D.js';

describe('updateLayerPlasticState — rugalmas tartomány', () => {
  it('még nem folyt, NEM lépi át a folyási határt: σ = E·ε, R=0, yielded=false', () => {
    const e = 2e8; // kN/m²
    const sigmaY = 2.35e5;
    const r = updateLayerPlasticState(INITIAL_LAYER_PLASTIC_STATE, e, sigmaY, 0, 1e-4);
    expect(r.sigma).toBeCloseTo(e * 1e-4, 6);
    expect(r.r).toBe(0);
    expect(r.state.yielded).toBe(false);
    expect(r.tangentE).toBe(e);
  });
});

describe('updateLayerPlasticState — még nem folyt, ÁTLÉPI a folyási határt (R = a folyás UTÁNI hányad)', () => {
  const e = 2e8;
  const sigmaY = 2.35e5;
  const hPrime = 0;

  it('a folyási határig lineáris, azon túl a fennsíkra vetít vissza', () => {
    const epsY = sigmaY / e; // 1.175e-3
    // Kétszer akkora alakváltozás-növekmény, mint az, ami épp a folyásig vinné.
    const dEps = 2 * epsY;
    const r = updateLayerPlasticState(INITIAL_LAYER_PLASTIC_STATE, e, sigmaY, hPrime, dEps);
    expect(r.state.yielded).toBe(true);
    expect(r.sigma).toBeCloseTo(sigmaY, 4);
    // R = a folyás UTÁNI hányad = (dEps − epsY) / dEps = 0.5 (itt a
    // szimmetrikus eset: a rugalmas és a képlékeny szakasz éppen egyenlő).
    expect(r.r).toBeCloseTo(0.5, 6);
  });

  it('a próba-feszültség PONTOSAN a folyási határra esik: R → 0 (a teljes növekmény MÉG rugalmas)', () => {
    // Ez az ASZIMMETRIKUS határeset: a próba-feszültség éppen csak eléri a
    // folyási határt, túllépés (a folyás UTÁNI rész) nélkül — ezért R = 0,
    // NEM 1. (Egy korábbi, hibás `R = AB/AC` — a folyás ELŐTTI hányad —
    // implementáció itt R ≈ 1-et adott volna; ezt a szimmetrikus 2×epsY-os
    // eset fentebb NEM tudta megkülönböztetni a helyes képlettől, mert ott
    // AB = AC/2, tehát AB/AC = (AC−AB)/AC = 0.5 mindkét képlettel — ez a
    // teszt viszont igen, ld. a P-11 fem-validation eset felfedezését.)
    const epsY = sigmaY / e;
    const r = updateLayerPlasticState(INITIAL_LAYER_PLASTIC_STATE, e, sigmaY, hPrime, epsY);
    expect(r.sigma).toBeCloseTo(sigmaY, 4);
    expect(r.r).toBeCloseTo(0, 6);
  });

  it('ASZIMMETRIKUS átlépés H\'>0-nál: a végeredmény a zárt alakú radial-return képlettel egyezik', () => {
    // Ez a regressziós teszt közvetlenül a P-11 fem-validation eset által
    // felfedezett hibát célozza: H'=0-nál a σ a fennsíkra vetül R-től
    // FÜGGETLENÜL (ezért az a teszt nem tudta megkülönböztetni a hibás és a
    // helyes R képletet) — H'>0-nál viszont a σ KÖZVETLENÜL R-től (és ezen
    // keresztül `epsPEff`-től) függ, ezért itt a hibás képlet MÁS (hibás)
    // számértéket adna.
    const hPrimeHardening = 5e7;
    const epsY = sigmaY / e;
    const dEps = 1.3 * epsY; // aszimmetrikus: AB ≠ AC/2
    const r = updateLayerPlasticState(INITIAL_LAYER_PLASTIC_STATE, e, sigmaY, hPrimeHardening, dEps);

    const dSigmaTrial = e * dEps;
    const fTrialExpected = dSigmaTrial - sigmaY; // a folyás UTÁNI (képlékeny) rész
    const epsPEffExpected = fTrialExpected / (e + hPrimeHardening);
    const sigmaExpected = sigmaY + hPrimeHardening * epsPEffExpected;

    expect(r.state.epsPEff).toBeCloseTo(epsPEffExpected, 10);
    expect(r.sigma).toBeCloseTo(sigmaExpected, 4);
  });
});

describe('updateLayerPlasticState — már megfolyt, terhelés folytatódik (R=1)', () => {
  it('a teljes növekmény képlékeny, tökéletesen képlékenynél a feszültség a fennsíkon marad', () => {
    const e = 2e8;
    const sigmaY = 2.35e5;
    const epsY = sigmaY / e;
    const first = updateLayerPlasticState(INITIAL_LAYER_PLASTIC_STATE, e, sigmaY, 0, 2 * epsY);
    expect(first.state.yielded).toBe(true);

    const second = updateLayerPlasticState(first.state, e, sigmaY, 0, epsY);
    expect(second.r).toBe(1);
    expect(second.sigma).toBeCloseTo(sigmaY, 4);
    expect(second.state.yielded).toBe(true);
  });

  it('keményedésnél (H\'>0) a feszültség a tangens modulussal nő tovább', () => {
    const e = 2e8;
    const sigmaY = 2.35e5;
    const hPrime = 5e7;
    const epsY = sigmaY / e;
    const first = updateLayerPlasticState(INITIAL_LAYER_PLASTIC_STATE, e, sigmaY, hPrime, 2 * epsY);
    const second = updateLayerPlasticState(first.state, e, sigmaY, hPrime, epsY);
    const slope = (second.sigma - first.sigma) / epsY;
    const expectedTangent = (e * hPrime) / (e + hPrime);
    expect(slope).toBeCloseTo(expectedTangent, -1);
    expect(second.tangentE).toBeCloseTo(expectedTangent, 6);
  });
});

describe('updateLayerPlasticState — már megfolyt, tehermentesítés (elágazás rugalmasra)', () => {
  it('a tehermentesítés AZONNAL E meredekségűre vált, yielded=false, epsPEff megmarad', () => {
    const e = 2e8;
    const sigmaY = 2.35e5;
    const epsY = sigmaY / e;
    const loaded = updateLayerPlasticState(INITIAL_LAYER_PLASTIC_STATE, e, sigmaY, 0, 2 * epsY);
    const epsPEffAtYield = loaded.state.epsPEff;

    const unloaded = updateLayerPlasticState(loaded.state, e, sigmaY, 0, -1e-5);
    expect(unloaded.r).toBe(0);
    expect(unloaded.state.yielded).toBe(false);
    expect(unloaded.sigma).toBeCloseTo(loaded.sigma - e * 1e-5, 6);
    // A felhalmozott képlékeny alakváltozás tehermentesítéskor NEM csökken.
    expect(unloaded.state.epsPEff).toBe(epsPEffAtYield);
  });
});

describe('updateLayerPlasticState — nulla alakváltozás-növekmény, pontosan a folyási határon', () => {
  it('dEps=0, state.sigma pontosan σY-on (yielded=false bemenettel): nem oszt nullával (Δσ_trial=0 → R=1 védelmi ág)', () => {
    // Ez a réteg egy KORÁBBI lépésben pontosan a folyási határra állt be,
    // de a hívó (pl. újraszámolás ugyanarra a lépésre) `yielded: false`
    // állapotot ad át — dEps=0 mellett Δσ_trial=0, ezért a normál
    // R = fTrial/Δσ_trial osztás nullával osztana; ilyenkor R a védelmi
    // ág szerint 1-re esik vissza (ld. a forráskód 130. sorának `?? `
    // helyett `!== 0 ? … : 1` védelme).
    const e = 2e8;
    const sigmaY = 2.35e5;
    const stateAtYield = { sigma: sigmaY, epsPEff: 0, yielded: false };
    const r = updateLayerPlasticState(stateAtYield, e, sigmaY, 0, 0);
    expect(r.r).toBe(1);
    expect(r.sigma).toBeCloseTo(sigmaY, 10);
    expect(r.state.yielded).toBe(true);
  });
});

describe("updateLayerPlasticState — degenerált eset: H' ≤ -E (lágyulás, E+H'≤0)", () => {
  it('nem osztunk nullával/negatívval: a képlékeny alakváltozás-növekmény ilyenkor R·Δε', () => {
    const e = 2e8;
    const sigmaY = 2.35e5;
    const hPrime = -e; // szélsőséges, fizikailag instabil lágyulás — védelmi ág
    const epsY = sigmaY / e;
    const r = updateLayerPlasticState(INITIAL_LAYER_PLASTIC_STATE, e, sigmaY, hPrime, 2 * epsY);
    expect(r.state.yielded).toBe(true);
    expect(Number.isFinite(r.sigma)).toBe(true);
  });
});

describe('updateLayerPlasticState — teljes ciklus zárt alakú ellenőrzése (H\'=0)', () => {
  it('terhelés-tehermentesítés-újraterhelés a rugalmas–tökéletesen képlékeny modellt adja vissza', () => {
    const e = 2e8;
    const sigmaY = 2.35e5;
    const epsY = sigmaY / e;

    let state = INITIAL_LAYER_PLASTIC_STATE;

    // Terhelés messze a folyás fölé.
    const loaded = updateLayerPlasticState(state, e, sigmaY, 0, 5 * epsY);
    expect(loaded.sigma).toBeCloseTo(sigmaY, 4);
    state = loaded.state;

    // Teljes tehermentesítés nulla feszültségig.
    const unloaded = updateLayerPlasticState(state, e, sigmaY, 0, -loaded.sigma / e);
    expect(unloaded.sigma).toBeCloseTo(0, 6);
    expect(unloaded.state.yielded).toBe(false);
    state = unloaded.state;

    // Újraterhelés: a rugalmas szakasz MOST a nagyobb (maradó alakváltozás
    // miatt eltolt) tartományban ismétlődik, de a folyási határ (σY,
    // H'=0 → nincs kitágulás) VÁLTOZATLAN.
    const reloaded = updateLayerPlasticState(state, e, sigmaY, 0, 0.5 * epsY);
    expect(reloaded.sigma).toBeCloseTo(e * 0.5 * epsY, 4);
    expect(reloaded.state.yielded).toBe(false);
  });
});
