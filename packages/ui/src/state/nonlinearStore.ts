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
import { create } from 'zustand';
import type { NonlinearRun } from '../model/nonlinear.js';

interface NonlinearState {
  readonly run: NonlinearRun | null;
  readonly error: string | null;
  setRun: (run: NonlinearRun) => void;
  setError: (error: string) => void;
  clear: () => void;
}

export const useNonlinearStore = create<NonlinearState>()((set) => ({
  run: null,
  error: null,
  setRun: (run) => set({ run, error: null }),
  setError: (error) => set({ run: null, error }),
  clear: () => set({ run: null, error: null }),
}));
