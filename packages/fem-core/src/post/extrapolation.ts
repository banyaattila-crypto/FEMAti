/**
 * Gauss-ponti igénybevételek extrapolálása a csomópontokba, és elemhatáron
 * a csomóponti átlagolás.
 *
 * Diplomaterv 3.1.7.4, 46. oldal: „valamilyen módon (másodfokú parabola
 * fektetés) a Gauss-ponti feszültségeket kell extrapolálni a csomópontokba.
 * Az elemek csatlakozásainál a pontra vonatkozóan 2 különböző feszültség-
 * értéket kapunk az eltérő merevségek és az extrapolálás miatt. Ezt a
 * program egyszerűen a 2 érték átlagával helyettesíti."
 *
 * A 3 pontos Gauss-séma (STRESS_POINTS) abszcisszáin átmenő másodfokú
 * (Lagrange-) polinomot a csomóponti helyeken (ξ = −1, 0, +1) kiértékelve
 * kapjuk az extrapolált értéket. A ξ = 0 Gauss-pont ÉPPEN egybeesik a
 * középső csomóponttal, ezért ott az "extrapoláció" triviálisan a Gauss-
 * pont saját értéke — csak az elem VÉGpontjaiban van tényleges extrapoláció,
 * és csak ott lehet ugrás két elem között (ld. `errorEstimator.ts`).
 */

/** Lagrange-interpoláció/extrapoláció 3 (xi, érték) párból egy tetszőleges ξ helyre. */
export function lagrangeAt(values: readonly [number, number, number], xis: readonly [number, number, number], xi: number): number {
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    let term = values[i] ?? 0;
    for (let j = 0; j < 3; j++) {
      if (j === i) continue;
      const xii = xis[i] ?? 0;
      const xij = xis[j] ?? 0;
      term *= (xi - xij) / (xii - xij);
    }
    sum += term;
  }
  return sum;
}

/** Egy elem Gauss-ponti értékeinek extrapolációja a saját 3 csomópontjába (ξ = −1, 0, +1). */
export function extrapolateElementToNodes(
  gaussValues: readonly [number, number, number],
  gaussXi: readonly [number, number, number],
): readonly [number, number, number] {
  return [lagrangeAt(gaussValues, gaussXi, -1), lagrangeAt(gaussValues, gaussXi, 0), lagrangeAt(gaussValues, gaussXi, 1)];
}

export interface AveragedField {
  /** Csomóponti (átlagolt) érték minden csomópontra, sorszám szerint. */
  readonly nodal: Float64Array;
  /** Hány elem adott járulékot az adott csomóponthoz (1 = szélső, 2 = belső határ). */
  readonly contributingElements: Int32Array;
}

/**
 * A csomópontonként extrapolált (de MÉG NEM átlagolt) elemi értékek
 * csomóponti átlagolása. A `contributingElements` a hibabecslőhöz kell.
 *
 * @param elementNodeIndices elemenként a 3 csomópont globális sorszáma [bal, közép, jobb]
 * @param elementNodalValues elemenként a saját (extrapolált) 3 csomóponti értéke
 * @param nodeCount a modell csomópontjainak száma
 */
export function averageAtNodes(
  elementNodeIndices: readonly (readonly [number, number, number])[],
  elementNodalValues: readonly (readonly [number, number, number])[],
  nodeCount: number,
): AveragedField {
  const sum = new Float64Array(nodeCount);
  const contributingElements = new Int32Array(nodeCount);

  for (let e = 0; e < elementNodeIndices.length; e++) {
    const indices = elementNodeIndices[e];
    const values = elementNodalValues[e];
    if (indices === undefined || values === undefined) continue;
    for (let k = 0; k < 3; k++) {
      const node = indices[k];
      sum[node] = (sum[node] ?? 0) + (values[k] ?? 0);
      contributingElements[node] = (contributingElements[node] ?? 0) + 1;
    }
  }

  const nodal = new Float64Array(nodeCount);
  for (let i = 0; i < nodeCount; i++) {
    const c = contributingElements[i] ?? 0;
    nodal[i] = c > 0 ? (sum[i] ?? 0) / c : 0;
  }

  return { nodal, contributingElements };
}
