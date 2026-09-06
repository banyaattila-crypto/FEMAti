/**
 * Modális (sajátfrekvencia) analízis, élő újraszámolással — a `useLiveResult`
 * mintájára (ADR-0016). A `enabled` kapcsoló (alapértelmezés `true`) azért
 * kell, mert a modális futás egy dense sajátérték-feladatot old meg — a
 * `DiagramPanel.tsx` `false`-t ad át, amíg a "Modális" fül nincs aktív, hogy
 * ez a (drágább) számítás NE fusson le minden modellváltozásnál, csak amikor
 * ténylegesen látszik az eredménye.
 */
import { useMemo } from 'react';
import { compileModel, solveModalModel, type ModalOutcome } from '../model/compile.js';
import type { EditableModel } from '../model/editable.js';

export function useModalResult(model: EditableModel, enabled = true): ModalOutcome {
  return useMemo(() => (enabled ? solveModalModel(model) : { model: compileModel(model), modal: null, error: null }), [model, enabled]);
}
