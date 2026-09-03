/**
 * Közös "futtatás-eredmény" store-alak — a nemlineáris (`nonlinearStore.ts`)
 * és a dinamikai (`dynamicStore.ts`) futtatás eredménye ugyanazt a mintát
 * követi (run/error, setRun/setError/clear), csak a payload típusa tér el.
 * Kivonva ide (2026-09-04, ponytail-audit), hogy a két store ne duplikálja
 * bájtra ugyanazt az implementációt — a KÜLÖN store mögötti indoklás (miért
 * nem egy közös állapotban élnek) változatlanul a két fájl saját
 * fejléc-kommentjében marad, mert az a `state/appStore.ts`-hez való
 * viszonyukról szól, nem egymáshoz.
 */
import { create } from 'zustand';

export interface RunState<T> {
  readonly run: T | null;
  readonly error: string | null;
  setRun: (run: T) => void;
  setError: (error: string) => void;
  clear: () => void;
}

export function createRunStore<T>() {
  return create<RunState<T>>()((set) => ({
    run: null,
    error: null,
    setRun: (run: T) => set({ run, error: null }),
    setError: (error: string) => set({ run: null, error }),
    clear: () => set({ run: null, error: null }),
  }));
}
