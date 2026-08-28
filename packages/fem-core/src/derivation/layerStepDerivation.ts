/**
 * Egy réteg EGY teherlépcsőbeli feszültség-visszavetítésének levezetése
 * (ADR-0005, MASTER-PROMPT-TERV P15/A prompt, 7. pont: "a próbafeszültség, az
 * R redukciós tényező, a visszavetítés").
 *
 * A próbafeszültség (`sigmaTrial = sigmaPrev + E·Δε`) triviális, egylépéses
 * behelyettesítés — nem a REFORB-algoritmus RÉSZE, ezért nincs saját
 * fem-core függvénye; a tényleges döntést (rugalmas/képlékeny ág, R-faktor,
 * visszavetített feszültség) VÁLTOZATLANUL a mag `updateLayerPlasticState()`
 * függvénye hozza — ugyanazokkal a bemenetekkel, mint amit a megoldó a
 * teherlépcső alatt ténylegesen használt.
 *
 * PONTOSSÁGI MEGJEGYZÉS: a `prevState` itt az ELFOGADOTT (konvergált) előző
 * teherlépcső állapota, és a `dKappa` a KÉT ELFOGADOTT lépés közti teljes
 * görbület-növekmény — a solver ugyanide TÖBB Newton-iteráción keresztül, kis
 * lépésekben jut el (`updateGaussPointState()` iterációnként hívódik). Emiatt
 * a visszaadott `σ` numerikusan (gépi pontosságig) egyezik a solver által
 * ténylegesen tárolt értékkel, de az `epsPEff` UTOLSÓ BITJE eltérhet (Σ|Δεₚ|
 * összegzési sorrendje más egy nagy lépésben, mint sok kicsiben) — ez a
 * lebegőpontos összeadás asszociativitás-hiánya, NEM hiba (ld.
 * `derivation.test.ts`, ahol a tűrés emiatt ~1e-12 relatív, nem `toBe`).
 */
import { updateLayerPlasticState, type LayerPlasticState, type LayerPlasticStepResult } from '../material/elastoPlastic1D.js';

export interface LayerStepDerivation {
  readonly layerIndex: number;
  readonly z: number;
  readonly e: number;
  readonly sigmaY: number;
  readonly hPrime: number;
  readonly prevState: LayerPlasticState;
  readonly dKappa: number;
  /** Δε = Δκ·z — a réteg alakváltozás-növekménye a görbület-növekményből. */
  readonly dEps: number;
  /** σ_trial = σ_{r-1} + E·Δε — a rugalmas próba-feszültség. */
  readonly sigmaTrial: number;
  /** `updateLayerPlasticState(...)` eredménye — bit-azonos a solverrel. */
  readonly step: LayerPlasticStepResult;
}

/**
 * Egy réteg egy lépésének levezetése a görbület-növekményből.
 *
 * @param prevState a réteg állapota a lépés ELŐTT (az előző, elfogadott teherlépcsőből)
 * @param dKappa a Gauss-pont görbület-növekménye ebben a lépésben (κ_új − κ_előző)
 */
export function deriveLayerStep(
  layerIndex: number,
  z: number,
  e: number,
  sigmaY: number,
  hPrime: number,
  prevState: LayerPlasticState,
  dKappa: number,
): LayerStepDerivation {
  const dEps = dKappa * z;
  const sigmaTrial = prevState.sigma + e * dEps;
  const step = updateLayerPlasticState(prevState, e, sigmaY, hPrime, dEps);
  return { layerIndex, z, e, sigmaY, hPrime, prevState, dKappa, dEps, sigmaTrial, step };
}
