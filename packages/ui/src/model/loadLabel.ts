/**
 * Egy teher rövid, egysoros címkéje — a `panels/LeftPanel.tsx` "Terhek"
 * listája és a `panels/RightPanel.tsx` "vezető teher" kijelzése (ULS 6.10
 * envelope, `model/combinations.ts` `ulsVariantLeadingLoadIds`) UGYANEZT
 * használja, hogy a megjelenítés ne csúszhasson szét egymástól.
 */
import type { EditableLoad } from './editable.js';
import * as fmt from '../format/numbers.js';

const categoryTag = (load: EditableLoad): string => (load.category === 'permanent' ? 'G' : 'Q');

export function loadRowLabel(load: EditableLoad): { readonly label: string; readonly value: string } {
  const L = fmt.editableLength();
  const F = fmt.editableForce();
  const M = fmt.editableMoment();
  const Q = fmt.editableLinearLoad();
  const MPL = fmt.editableMomentPerLength();
  const x = (v: number): string => `${L.toDisplay(v).toFixed(2)} ${L.unit}`;

  if (load.kind === 'point') return { label: `${categoryTag(load)} · x = ${x(load.x)}`, value: `P = ${F.toDisplay(load.p).toFixed(0)} ${F.unit}` };
  if (load.kind === 'moment') return { label: `${categoryTag(load)} · x = ${x(load.x)}`, value: `M = ${M.toDisplay(load.m).toFixed(0)} ${M.unit}` };
  if (load.kind === 'distributed') {
    const q1 = Q.toDisplay(load.q1).toFixed(0);
    const q2 = Q.toDisplay(load.q2).toFixed(0);
    const qLabel = load.q1 === load.q2 ? `q = ${q1} ${Q.unit}` : `q = ${q1}→${q2} ${Q.unit}`;
    return { label: `${categoryTag(load)} · ${x(load.x1)}–${x(load.x2)}`, value: qLabel };
  }
  const m1 = MPL.toDisplay(load.m1).toFixed(1);
  const m2 = MPL.toDisplay(load.m2).toFixed(1);
  const mLabel = load.m1 === load.m2 ? `m = ${m1} ${MPL.unit}` : `m = ${m1}→${m2} ${MPL.unit}`;
  return { label: `${categoryTag(load)} · ${x(load.x1)}–${x(load.x2)}`, value: mLabel };
}
