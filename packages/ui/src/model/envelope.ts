/**
 * Mozgó teher — burkolóábra (2026-09-04). A `movingLoad.magnitude` nagyságú
 * pontteher VÉGIGSÉTÁL a tartó minden hálócsomópontján (a koncentrált teher
 * ma is csomópontra illeszkedik, ld. `model/editable.ts` fejléce), a
 * MEGLÉVŐ terhekre SZUPERPONÁLVA — minden keresztmetszetre a lehetséges
 * legnagyobb/legkisebb M/T-t adja vissza.
 *
 * CSAK a jellemző (nem faktorozott) teherre — az ULS/SLS tervezési
 * ellenőrzéseket (`model/designChecks.ts`) ez a kör nem érinti, ugyanúgy,
 * ahogy a fő M/T/w/φ diagramok is a jellemző terhet mutatják.
 */
import { solveEditableModel } from './compile.js';
import type { EditableModel } from './editable.js';

export interface EnvelopeResult {
  readonly xs: readonly number[];
  readonly mMax: readonly number[];
  readonly mMin: readonly number[];
  readonly tMax: readonly number[];
  readonly tMin: readonly number[];
}

/** `null`, ha a mozgó teher ki van kapcsolva, vagy az alap modell nem futtatható. */
export function computeEnvelope(editable: EditableModel): EnvelopeResult | null {
  if (!editable.movingLoad.enabled) return null;

  const base = solveEditableModel(editable).result;
  if (base === null) return null;

  const xs = base.nodes.map((n) => n.x);
  const mMax = base.nodes.map((n) => n.m);
  const mMin = base.nodes.map((n) => n.m);
  const tMax = base.nodes.map((n) => n.t);
  const tMin = base.nodes.map((n) => n.t);

  for (const loadX of xs) {
    const withMoving: EditableModel = {
      ...editable,
      loads: [...editable.loads, { id: '__moving__', kind: 'point', x: loadX, p: editable.movingLoad.magnitude, category: 'variable' }],
    };
    const result = solveEditableModel(withMoving).result;
    if (result === null) continue; // egy adott pozíció mechanizmust okozhat (pl. teher pont a támaszon) — kihagyva, nem hibáztatva az egészet
    result.nodes.forEach((n, i) => {
      mMax[i] = Math.max(mMax[i] ?? n.m, n.m);
      mMin[i] = Math.min(mMin[i] ?? n.m, n.m);
      tMax[i] = Math.max(tMax[i] ?? n.t, n.t);
      tMin[i] = Math.min(tMin[i] ?? n.t, n.t);
    });
  }

  return { xs, mMax, mMin, tMax, tMin };
}
