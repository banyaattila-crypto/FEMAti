/**
 * Rugalmas–képlékeny anyagmodell — NEM-RÉTEGELT (igénybevétel-szintű),
 * Diplomaterv 3.4.2 (MASTER-PROMPT-TERV 1.7/A pont).
 *
 * A keresztmetszetet EGYETLEN M–κ (nyomaték–görbület) rugóként kezeli —
 * nincs rétegenkénti feszültségeloszlás (az a rétegelt modell, P10, 3.4.3
 * dolga). A folyási felület: `|M| = M0 + H'·κ_p_eff`, lineáris (izotróp)
 * keményedéssel.
 *
 *   M0 = ∫∫ σ0·z dz dy = σ0·Kp                          (3.47), 62. oldal
 *   dε = dε_e + dε_p                                     (3.48), 62. oldal
 *   H' = (dM/dε)_(f=0, terhelés)                         (3.49), 62. oldal
 *   H' = EI·EI_T/(EI−EI_T)  ⇔  EI_T = EI·H'/(EI+H')       (3.50)/(3.51), 63. oldal
 *   dQ = GAs·dγ  (a nyírás MINDIG rugalmas marad)         (3.52), 63. oldal
 *
 * A `updateResultantPlasticState` egy STANDARD, zárt alakú (nem iteratív)
 * 1D radial-return leképezés — lineáris keményedésnél ez EGZAKT (nem
 * közelítés), és pontosan a (3.47)–(3.52) fizikát valósítja meg. A
 * diplomaterv 3.4.4 pontjának R-faktoros visszavetítése a RÉTEGELT modellre
 * vonatkozik (P10, ahol rétegenként külön σ-ε állapotot kell kezelni); az
 * itteni, egyetlen M–κ rugóra egyszerűsödő eset a standard számítási
 * plaszticitás-elmélet (pl. Simo–Hughes) zárt alakú megoldásával egzaktul
 * leírható, ezért NEM az R-faktoros közelítést használja.
 */

export interface ResultantPlasticState {
  /** Felhalmozott (mindig ≥0) effektív képlékeny görbület [1/m]. */
  readonly kappaPEff: number;
  /** Igaz, ha az UTOLSÓ lépés képlékeny volt (a keresztmetszet a folyási felületen van). */
  readonly yielded: boolean;
}

/** Kezdeti (terheletlen, rugalmas) állapot. */
export const INITIAL_RESULTANT_PLASTIC_STATE: ResultantPlasticState = {
  kappaPEff: 0,
  yielded: false,
};

/** M0 = σY·Kp — a teljesen képlékeny nyomatéki teherbírás (3.47). */
export function plasticMomentCapacity(sigmaY: number, plasticModulus: number): number {
  return sigmaY * plasticModulus;
}

/**
 * Folyási függvény `f = M² − M0²` (MASTER-PROMPT-TERV 1.7/A, szó szerint).
 * `f < 0`: rugalmas: `f ≥ 0`: a keresztmetszet elérte (vagy túllépné) a
 * folyási felületet — ez utóbbi esetben `updateResultantPlasticState`
 * visszavetíti a nyomatékot a felületre.
 */
export function yieldFunction(m: number, m0: number): number {
  return m * m - m0 * m0;
}

/**
 * Tangens hajlítómerevség: `EI_T = EI·H'/(EI+H')` (3.51). `H' ≤ 0` esetén
 * (tökéletesen képlékeny, `H'=0`) `EI_T = 0`.
 */
export function tangentBendingStiffness(ei: number, hPrime: number): number {
  if (hPrime <= 0) return 0;
  return (ei * hPrime) / (ei + hPrime);
}

export interface ResultantPlasticStepResult {
  readonly state: ResultantPlasticState;
  /** Az új nyomaték [kNm]. */
  readonly m: number;
  /** Az új nyíróerő [kN] — mindig rugalmas (3.52). */
  readonly t: number;
  /** A LÉPÉS tangens hajlítómerevsége: `EI`, ha a lépés rugalmas volt; `EI_T`, ha képlékeny. */
  readonly tangentEI: number;
}

/**
 * Egy állapotfrissítési lépés: rugalmas próba (`M_trial = M_prev + EI·dκ`),
 * majd — ha a próba túllépné a (esetlegesen már kitágult) folyási
 * felületet — zárt alakú visszavetítés rá.
 *
 * Levezetés (standard 1D radial return, lineáris keményedésre egzakt):
 *   f_trial = |M_trial| − (M0 + H'·κ_p_eff)
 *   ha f_trial ≤ 0:  rugalmas lépés, M = M_trial
 *   ha f_trial > 0:  dκ_p = f_trial / (EI + H')
 *                    M = sign(M_trial)·(M0 + H'·(κ_p_eff + dκ_p))
 * — ez PONTOSAN kielégíti az M = M_trial − EI·dκ_p·sign(M_trial) rugalmas
 * visszavételi egyenletet is (a két kifejezés algebrailag ekvivalens).
 *
 * Tehermentesítés (dκ ellentétes előjelű, mint M_prev) mindig a `f_trial≤0`
 * ágra fut — ezért az EI (nem EI_T) meredekséggel tér vissza rugalmasan,
 * ahogy a diplomaterv (3-9. ábra) is mutatja.
 */
export function updateResultantPlasticState(
  state: ResultantPlasticState,
  mPrev: number,
  tPrev: number,
  ei: number,
  gas: number,
  m0: number,
  hPrime: number,
  dKappa: number,
  dGamma: number,
): ResultantPlasticStepResult {
  const t = tPrev + gas * dGamma;
  const mTrial = mPrev + ei * dKappa;

  const currentLimit = m0 + hPrime * state.kappaPEff;
  const fTrial = Math.abs(mTrial) - currentLimit;

  if (fTrial <= 0) {
    return {
      state: { kappaPEff: state.kappaPEff, yielded: false },
      m: mTrial,
      t,
      tangentEI: ei,
    };
  }

  const dKappaP = fTrial / (ei + hPrime);
  const kappaPEff = state.kappaPEff + dKappaP;
  const sign = mTrial >= 0 ? 1 : -1;
  const m = sign * (m0 + hPrime * kappaPEff);

  return {
    state: { kappaPEff, yielded: true },
    m,
    t,
    tangentEI: tangentBendingStiffness(ei, hPrime),
  };
}
