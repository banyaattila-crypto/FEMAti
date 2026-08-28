/**
 * Élő újraszámolás — MASTER-PROMPT-TERV P7 prompt, 2. interakció
 * (DESIGN-TERV 7.2 #2): minden modellváltozás után azonnal újra fut a
 * lineáris megoldás, szinkron (a P7 elfogadási kritériuma szerint ez a
 * modellméret mellett < 50 ms — Web Worker-kiszervezés csak ennél nagyobb
 * modellekre indokolt, ami az itt kezelhető elemszám-tartományban nem
 * fordul elő).
 */
import { useMemo } from 'react';
import { solveEditableModel, type SolveOutcome } from '../model/compile.js';
import type { EditableModel } from '../model/editable.js';

export function useLiveResult(model: EditableModel): SolveOutcome {
  return useMemo(() => solveEditableModel(model), [model]);
}
