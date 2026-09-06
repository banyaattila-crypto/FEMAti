/**
 * Elemenkénti hibajelző az extrapoláció előtti csomóponti ugrásból.
 *
 * MASTER-PROMPT-TERV P6 prompt: „az átlagolás ELŐTTI ugrás nagysága
 * elemhatáronként, normálva a mező szélsőértékére → százalékos hibajelző
 * elemenként." Ez MODERN kiegészítés (nem a diplomaterv része) a
 * hálósűrítés vezérléséhez — a diplomaterv (3.1.7.4, 46. oldal) csak az
 * átlagolást írja le, a rá épülő hibabecslést nem.
 *
 * Két szomszédos elem az őket összekötő csomóponton két, ÁLTALÁBAN eltérő
 * extrapolált értéket ad (eltérő merevség/hálósűrűség miatt); az `averageAtNodes`
 * ezt egyetlen közös értékre egyszerűsíti. A hibajelző ennek az egyszerűsítésnek
 * a "árát" méri: mekkora volt az elhagyott ugrás.
 */
import type { AveragedField } from './extrapolation.js';

/**
 * Elemenkénti hibabecslő [%]: a csomópont-átlagolás ELŐTTI ugrás nagysága
 * az elem két végpontján, a mező globális szélsőértékére normálva. Az elem
 * belső (közép-) csomópontján nincs ugrás — az kizárólag az adott elemé,
 * ott mindig `contributingElements = 1`.
 *
 * Két elem átlaga esetén `|A − B| = 2·|saját − átlag|` — nincs szükség arra,
 * hogy explicit módon megkeressük a szomszédos elem saját értékét.
 *
 * @param elementNodeIndices elemenként a 3 csomópont globális sorszáma [bal, közép, jobb]
 * @param elementNodalValues elemenként a saját (extrapolált, még nem átlagolt) 3 csomóponti értéke
 * @param averaged az `averageAtNodes()` eredménye ugyanerre a mezőre
 * @param fieldExtreme a mező globális szélsőértéke (a normalizáláshoz)
 */
export function estimateElementError(
  elementNodeIndices: readonly (readonly [number, number, number])[],
  elementNodalValues: readonly (readonly [number, number, number])[],
  averaged: AveragedField,
  fieldExtreme: number,
): Float64Array {
  const elementCount = elementNodeIndices.length;
  const errorEstimate = new Float64Array(elementCount);
  const scale = Math.abs(fieldExtreme) > 0 ? Math.abs(fieldExtreme) : 1;

  for (let e = 0; e < elementCount; e++) {
    const indices = elementNodeIndices[e];
    const values = elementNodalValues[e];
    if (indices === undefined || values === undefined) continue;

    const leftNode = indices[0];
    const rightNode = indices[2];
    const leftOwn = values[0];
    const rightOwn = values[2];

    const jumpLeft = (averaged.contributingElements[leftNode] ?? 0) > 1 ? 2 * Math.abs(leftOwn - (averaged.nodal[leftNode] ?? 0)) : 0;
    const jumpRight = (averaged.contributingElements[rightNode] ?? 0) > 1 ? 2 * Math.abs(rightOwn - (averaged.nodal[rightNode] ?? 0)) : 0;

    errorEstimate[e] = (Math.max(jumpLeft, jumpRight) / scale) * 100;
  }

  return errorEstimate;
}
