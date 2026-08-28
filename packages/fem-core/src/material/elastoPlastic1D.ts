/**
 * Egytengelyű rugalmas–képlékeny anyagtörvény, rétegenkénti állapottal
 * (Diplomaterv 3.4.4 — "REFORB", R-faktoros feszültség-visszavetítés,
 * 66–68. oldal; MASTER-PROMPT-TERV 1.7/B és 1.8 pont).
 *
 * A REFORB eljárás az r. Newton–Raphson-iteráció próba- (rugalmas)
 * feszültségnövekményéből (`Δσ_re = E·Δε_r`) és az előző állapotból dönti
 * el, hogy a réteg rugalmas marad-e, folytatja-e a már megkezdett képlékeny
 * alakváltozást, vagy ÉPP EBBEN a lépésben lépi át a folyási felületet —
 * PONTOSAN a MASTER-PROMPT-TERV 1.8 döntési táblázatának négy esete szerint:
 *
 *   | Előző állapot  | Vizsgálat                          | R            |
 *   |----------------|-------------------------------------|--------------|
 *   | már megfolyt   | `|σ_trial| > |σ_{r-1}|` (terhelés)   | 1            |
 *   | már megfolyt   | `|σ_trial| ≤ |σ_{r-1}|` (mentesítés) | — (rugalmas) |
 *   | még nem folyt  | `|σ_trial| ≥` folyási határ          | AB/AC ∈(0,1) |
 *   | még nem folyt  | `|σ_trial| <` folyási határ          | — (rugalmas) |
 *
 * `R` a próba-feszültségnövekmény azon hányada, amely a folyási felület
 * ÁTLÉPÉSÉRE esik (68. oldal, 5–6. lépés): `Δε_p = R·Δε_r·E/(E+H')`. Lineáris
 * keményedésnél ez az R-faktoros bontás ALGEBRAILAG EGYENÉRTÉKŰ a standard
 * zárt alakú (nem iteratív) radial-return leképezéssel — ugyanaz a
 * bizonyítás, mint a nem-rétegelt modellnél
 * ([`resultantPlastic.ts`](./resultantPlastic.ts)), csak itt
 * feszültség–alakváltozás szinten, rétegenként. A kód ezért az explicit NÉGY
 * ÁGAT valósítja meg (a táblázat szerint, egyenként tesztelhetően), de a
 * végeredményt zárt alakban számítja (nem iterál magára a folyási felületre).
 *
 * FONTOS KORLÁT: az elágazás az (r-1). és az r. ITERÁCIÓ közti (jellemzően
 * kicsi) alakváltozás-növekményre vonatkozik — a diplomaterv algoritmusa
 * (3.4.4) is ebben a körben mozog (a Newton–Raphson iterációk kicsi
 * lépéseket tesznek). Egyetlen lépésben a folyási felület MINDKÉT oldalát
 * átlépő, nagy, hirtelen alakváltozás-növekmény nem PONTOS (ez a forrás
 * algoritmusának is korlátja, nem ennek a portnak a hibája).
 */

export interface LayerPlasticState {
  /** Feszültség [kN/m²]. */
  readonly sigma: number;
  /** Felhalmozott (mindig ≥0) effektív képlékeny alakváltozás. */
  readonly epsPEff: number;
  /** Igaz, ha az UTOLSÓ lépés képlékeny volt (a réteg a folyási felületen van). */
  readonly yielded: boolean;
}

/** Kezdeti (terheletlen, rugalmas) rétegállapot. */
export const INITIAL_LAYER_PLASTIC_STATE: LayerPlasticState = {
  sigma: 0,
  epsPEff: 0,
  yielded: false,
};

export interface LayerPlasticStepResult {
  readonly state: LayerPlasticState;
  /** Az új feszültség [kN/m²]. */
  readonly sigma: number;
  /** R-faktor [0,1]: 0 = rugalmas lépés, 1 = folytatódó folyás, (0,1) = most lép át. */
  readonly r: number;
  /** A LÉPÉS tangens modulusa: `E`, ha rugalmas volt; `E_T = E·H'/(E+H')`, ha képlékeny. */
  readonly tangentE: number;
}

function elasticStep(state: LayerPlasticState, sigmaTrial: number, e: number): LayerPlasticStepResult {
  return {
    state: { sigma: sigmaTrial, epsPEff: state.epsPEff, yielded: false },
    sigma: sigmaTrial,
    r: 0,
    tangentE: e,
  };
}

function plasticStep(
  state: LayerPlasticState,
  e: number,
  sigmaY: number,
  hPrime: number,
  dEps: number,
  sigmaTrial: number,
  r: number,
): LayerPlasticStepResult {
  // Δε_p = R·Δε_r·E/(E+H') — (68. oldal, 5–6. lépés; H'=0-nál E/(E+H')=1.
  const denom = e + hPrime;
  const dEpsP = denom > 0 ? (r * dEps * e) / denom : r * dEps;
  const epsPEff = state.epsPEff + Math.abs(dEpsP);
  const sign = sigmaTrial >= 0 ? 1 : -1;
  const sigma = sign * (sigmaY + hPrime * epsPEff);
  const tangentE = hPrime <= 0 ? 0 : (e * hPrime) / (e + hPrime);
  return { state: { sigma, epsPEff, yielded: true }, sigma, r, tangentE };
}

/**
 * Egy réteg állapotfrissítése egy (Newton–Raphson-)lépésben, a MASTER-PROMPT-TERV
 * 1.8 döntési táblázatának négy ága szerint (ld. a fájl fejlécét).
 */
export function updateLayerPlasticState(
  state: LayerPlasticState,
  e: number,
  sigmaY: number,
  hPrime: number,
  dEps: number,
): LayerPlasticStepResult {
  const dSigmaTrial = e * dEps;
  const sigmaTrial = state.sigma + dSigmaTrial;
  const currentLimit = sigmaY + hPrime * state.epsPEff;

  if (state.yielded) {
    if (Math.abs(sigmaTrial) <= Math.abs(state.sigma)) {
      // Már megfolyt, de MOST tehermentesít → rugalmas (7. lépés).
      return elasticStep(state, sigmaTrial, e);
    }
    // Már megfolyt, a terhelés folytatódik → R = 1 (a teljes növekmény képlékeny).
    return plasticStep(state, e, sigmaY, hPrime, dEps, sigmaTrial, 1);
  }

  if (Math.abs(sigmaTrial) < currentLimit) {
    // Még nem folyt, és ennél a lépésnél sem folyik meg → rugalmas (7. lépés).
    return elasticStep(state, sigmaTrial, e);
  }

  // Még nem folyt, de ÁTLÉPI a folyási határt: R = a próba-növekmény folyás
  // UTÁNI hányada (67. oldal, 3-10. ábra). Az AB szakasz (az előző
  // feszültségtől a folyási határig, MÉG RUGALMAS rész) `AB = currentLimit −
  // |σ_{r-1}|`; a teljes próba-növekmény `AC = Δσ_trial`; a folyás UTÁNI
  // (képlékeny) rész `AC − AB`, ezért `R = (AC−AB)/AC = fTrial/Δσ_trial` —
  // NEM `AB/AC` (a kettő csak a szimmetrikus AB=AC/2 esetben esik egybe,
  // ezért egy korábbi, hibás `R = AB/AC` implementáció csak az aszimmetrikus
  // — pl. a próba-feszültség ÉPP a folyási határra esik — esetben buktatta
  // volna le magát; ld. a mutációs próbát és a hozzá tartozó tesztet lent).
  const fTrial = Math.abs(sigmaTrial) - currentLimit; // AC − AB
  const r = dSigmaTrial !== 0 ? fTrial / Math.abs(dSigmaTrial) : 1;
  return plasticStep(state, e, sigmaY, hPrime, dEps, sigmaTrial, r);
}
