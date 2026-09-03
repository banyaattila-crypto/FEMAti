/**
 * A nemlineáris (rugalmas-képlékeny) futtatás EREDMÉNYE — MASTER-PROMPT-TERV
 * P13 prompt. Külön store-ban van a `state/appStore.ts`-től, mert nagy,
 * változatlan (immutable) payloadot tart (`Float64Array`-ek, `Map`-ek
 * lépésenként) — ezt NEM akarjuk immer-proxyzni vagy re-renderelni minden
 * apró UI-állapotváltozásnál (pl. hover), csak akkor, amikor VALÓBAN új
 * futás történt.
 *
 * FONTOS SZABÁLY (appStore.ts-ből átvéve): a modell BÁRMELY módosítása
 * azonnal érvényteleníti ezt az eredményt — ezt az `App.tsx` egy
 * `useModelStore.subscribe()` hívással érvényesíti (`clear()` hívásával).
 */
import { createRunStore } from './createRunStore.js';
import type { NonlinearRun } from '../model/nonlinear.js';

export const useNonlinearStore = createRunStore<NonlinearRun>();
