/**
 * A dinamikai válasz (tranziens, Newmark-β) futtatás EREDMÉNYE — a
 * `state/nonlinearStore.ts` mintája. Külön store-ban van, mert nagy,
 * változatlan (immutable) payloadot tart (lépésenként teljes DOF-vektorok)
 * — ezt NEM akarjuk re-renderelni minden apró UI-állapotváltozásnál, csak
 * akkor, amikor VALÓBAN új futás történt.
 *
 * FONTOS SZABÁLY (a nemlineáris store mintájára): a modell BÁRMELY
 * módosítása azonnal érvényteleníti ezt az eredményt — ezt az `App.tsx`
 * ugyanaz a `useModelStore.subscribe()` hívás érvényesíti, ami a
 * nemlineáris store-t is törli.
 */
import { createRunStore } from './createRunStore.js';
import type { DynamicRun } from '../model/dynamicRun.js';

export const useDynamicStore = createRunStore<DynamicRun>();
