/**
 * Globális szabadságfok-kiosztás.
 *
 * Diplomaterv 3.1.7: a szerkezet merevségi mátrixa a csomóponti
 * elmozdulásjellemzők és a csomóponti (vagy oda redukált) terhek közti
 * kapcsolatot írja le: K·v = q.
 *
 * Csomópontonként két szabadságfok, rögzített sorrendben: [w, φ].
 * A globális index: 2·i és 2·i+1, ahol i a csomópont sorszáma a modellben.
 */

import { DimensionError } from '../linalg/errors.js';
import { DOF_PER_NODE } from '../element/bMatrix.js';
import type { Model, NodeId } from '../model/types.js';

/** Egy szabadságfok szerepe. */
export type DofKind = 'w' | 'phi';

export interface DofMap {
  /** Csomópontok száma. */
  readonly nodeCount: number;
  /** Összes szabadságfok (megkötöttekkel együtt). */
  readonly totalDofs: number;
  /** Aktív (ismeretlen) szabadságfokok száma. */
  readonly activeDofs: number;
  /**
   * Globális index → aktív index. A megkötött szabadságfokoknál −1.
   * Elimination stratégiánál ez szűkíti a megoldandó rendszert; penalty
   * stratégiánál minden bejegyzés aktív.
   */
  readonly activeIndex: Int32Array;
  /** Igaz, ha az adott globális szabadságfok elmozdulása előírt. */
  readonly prescribed: Uint8Array;
  /** Az előírt elmozdulás értéke (0, ha nincs támaszmozgás). */
  readonly prescribedValue: Float64Array;
  /** Csomópont-azonosító → sorszám. */
  readonly nodeIndex: ReadonlyMap<string, number>;
  /** A csomópontok x koordinátája, sorszám szerint [m]. */
  readonly nodeX: Float64Array;
  /** A csomópontok azonosítója, sorszám szerint. */
  readonly nodeIds: readonly NodeId[];
}

/** A `w` szabadságfok globális indexe. */
export const wDof = (nodeIndex: number): number => DOF_PER_NODE * nodeIndex;
/** A `φ` szabadságfok globális indexe. */
export const phiDof = (nodeIndex: number): number => DOF_PER_NODE * nodeIndex + 1;

/** Egy globális szabadságfok szerepe és csomópontja. */
export const describeDof = (dof: number): { nodeIndex: number; kind: DofKind } => ({
  nodeIndex: Math.floor(dof / DOF_PER_NODE),
  kind: dof % DOF_PER_NODE === 0 ? 'w' : 'phi',
});

export type ConstraintStrategy = 'elimination' | 'penalty';

/**
 * A szabadságfok-térkép felépítése a modellből.
 *
 * @param strategy `elimination` (alapértelmezett) esetén a megkötött
 *        szabadságfokok kikerülnek az egyenletrendszerből; `penalty` esetén
 *        minden szabadságfok aktív marad, és a megkötést nagy rugóállandó
 *        érvényesíti (Diplomaterv 3.1.7.3).
 */
export function buildDofMap(model: Model, strategy: ConstraintStrategy = 'elimination'): DofMap {
  const nodeCount = model.nodes.length;
  if (nodeCount === 0) throw new DimensionError('A modell nem tartalmaz csomópontot.');

  const totalDofs = DOF_PER_NODE * nodeCount;
  const nodeIndex = new Map<string, number>();
  const nodeX = new Float64Array(nodeCount);
  const nodeIds: NodeId[] = [];

  for (const [i, node] of model.nodes.entries()) {
    nodeIndex.set(node.id as string, i);
    nodeX[i] = node.x as number;
    nodeIds.push(node.id);
  }

  const prescribed = new Uint8Array(totalDofs);
  const prescribedValue = new Float64Array(totalDofs);

  // Megtámasztások
  for (const b of model.boundaries) {
    const i = nodeIndex.get(b.nodeId as string);
    if (i === undefined) continue;
    if (b.wFixed) prescribed[wDof(i)] = 1;
    if (b.phiFixed) prescribed[phiDof(i)] = 1;
  }

  // Előírt támaszmozgások (Diplomaterv 3.1.6.5)
  for (const load of model.loads) {
    if (load.kind !== 'support-displacement') continue;
    const i = nodeIndex.get(load.nodeId as string);
    if (i === undefined) continue;
    if (load.dz !== undefined) {
      prescribed[wDof(i)] = 1;
      prescribedValue[wDof(i)] = load.dz as number;
    }
    if (load.dPhi !== undefined) {
      prescribed[phiDof(i)] = 1;
      prescribedValue[phiDof(i)] = load.dPhi as number;
    }
  }

  const activeIndex = new Int32Array(totalDofs);
  let active = 0;
  for (let d = 0; d < totalDofs; d++) {
    if (strategy === 'penalty' || prescribed[d] === 0) {
      activeIndex[d] = active++;
    } else {
      activeIndex[d] = -1;
    }
  }

  return {
    nodeCount,
    totalDofs,
    activeDofs: active,
    activeIndex,
    prescribed,
    prescribedValue,
    nodeIndex,
    nodeX,
    nodeIds,
  };
}

/** Az elem hat globális szabadságfoka, a [w₁, φ₁, w₂, φ₂, w₃, φ₃] sorrendben. */
export function elementDofs(nodeIndices: readonly [number, number, number]): Int32Array {
  const dofs = new Int32Array(6);
  for (let i = 0; i < 3; i++) {
    dofs[2 * i] = wDof(nodeIndices[i]);
    dofs[2 * i + 1] = phiDof(nodeIndices[i]);
  }
  return dofs;
}

/** Az elem hat AKTÍV szabadságfok-indexe (−1 a megkötöttekre). */
export function elementActiveDofs(map: DofMap, nodeIndices: readonly [number, number, number]): Int32Array {
  const global = elementDofs(nodeIndices);
  const out = new Int32Array(6);
  for (let i = 0; i < 6; i++) out[i] = map.activeIndex[global[i]] ?? -1;
  return out;
}
