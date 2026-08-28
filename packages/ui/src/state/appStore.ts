/**
 * A felület ÁLTALÁNOS (nem a modellhez kötött) állapota — DESIGN-TERV.md 7.1.
 *
 * A modell (fesztáv, elemszám, szelvény, anyag, támaszok, terhek) a
 * `state/modelStore.ts`-be költözött (P7), mert az immer-alapú
 * módosításokat és undo/redo-t igényel, és a vászon szerkeszti. Itt a
 * megoldó-beállítások (P13-tól aktívak — ld. `model/nonlinear.ts`) és a
 * tisztán felületi állapot (aktív diagram, futás státusza, teherlépcső-
 * idővonal pozíciója) marad. A tényleges nemlineáris EREDMÉNY (nagy,
 * változatlan payload) a `state/nonlinearStore.ts`-ben van, külön.
 *
 * FONTOS SZABÁLY: a modell bármely módosítása azonnal érvényteleníti a
 * nemlineáris eredményt (`status: 'editing'`) — ezt az `App.tsx` egy
 * `useModelStore.subscribe()` hívással érvényesíti. Az elavult eredmény nem
 * maradhat érvényesként a képernyőn.
 */

import { create } from 'zustand';
import type { SolverStatus } from '../components/Feedback.js';

export type SolverAlgorithm = 'newton' | 'modified-newton';
export type LoadHistoryMode = 'monotonic' | 'unloading';
export type DiagramTab = 'M' | 'T' | 'w' | 'phi' | 'load-displacement' | 'convergence' | 'stress3d' | 'modal';
export type TheoryTopic = 'thesis96' | 'timoshenko' | 'integration' | 'reforb' | 'about';
/** <768px-nél melyik panel látszik (DESIGN-TERV 3.3: "egy oszlop, fülekkel"). */
export type MobileTab = 'model' | 'canvas' | 'results';

/** A keresztmetszet-inspektor (P13 #4) kiválasztott Gauss-pontja. */
export interface InspectorSelection {
  readonly elementId: string;
  /** 0..2 — a 3 hajlítási Gauss-pont indexe (`GAUSS_3`/`STRESS_POINTS` sorrendje). */
  readonly gaussIndex: 0 | 1 | 2;
}

export interface AppState {
  // ── Megoldó ───────────────────────────────────────────────────────────
  algorithm: SolverAlgorithm;
  loadHistory: LoadHistoryMode;
  /** Teherlépcső Δλ */
  loadStep: number;
  /** Konvergencia-tolerancia [%] */
  tolerance: number;
  /** A tehermentesítés csúcsértéke (λ → λpeak → 0) */
  peakLambda: number;

  // ── Futás ─────────────────────────────────────────────────────────────
  status: SolverStatus;
  statusDetail: string;

  // ── Nézet ─────────────────────────────────────────────────────────────
  activeDiagram: DiagramTab;
  /** Az idővonalon éppen megjelenített teherlépcső indexe */
  activeStep: number;
  /** A "Modális" fülön éppen megjelenített módus indexe (ADR-0016). */
  activeMode: number;
  showGaussPoints: boolean;
  /** M diagram a húzott oldalra rajzolva (DESIGN-TERV 5.4, kapcsolható konvenció). */
  momentTensionSide: boolean;
  /** A keresztmetszet-inspektor (P13 #4) nyitott panelje; `null` = zárva. */
  inspector: InspectorSelection | null;
  /** A számítási jegyzőkönyv (P15) nyitva van-e. */
  reportOpen: boolean;
  /** A levezetés-nézet (P15/A) nyitva van-e. */
  derivationOpen: boolean;
  /** A „Történelmi mód" (P17, frontális megoldó) nyitva van-e. */
  historicalOpen: boolean;
  /** Az „Elmélet" nézet (P18, dokumentáció az appban) nyitva van-e, és melyik témát mutatja. */
  theoryOpen: boolean;
  theoryTopic: TheoryTopic;
  /** A hálófüggetlenségi (h-konvergencia) vizsgálat nyitva van-e. */
  meshConvergenceOpen: boolean;
  /** Csak <768px-nél releváns — melyik panel aktív. */
  mobileTab: MobileTab;

  // ── Műveletek ─────────────────────────────────────────────────────────
  setAlgorithm: (v: SolverAlgorithm) => void;
  setLoadHistory: (v: LoadHistoryMode) => void;
  setLoadStep: (v: number) => void;
  setTolerance: (v: number) => void;
  setPeakLambda: (v: number) => void;
  setActiveDiagram: (v: DiagramTab) => void;
  setActiveStep: (v: number) => void;
  setActiveMode: (v: number) => void;
  setShowGaussPoints: (v: boolean) => void;
  setMomentTensionSide: (v: boolean) => void;
  setStatus: (status: SolverStatus, detail?: string) => void;
  openInspector: (selection: InspectorSelection) => void;
  closeInspector: () => void;
  setReportOpen: (v: boolean) => void;
  setDerivationOpen: (v: boolean) => void;
  setHistoricalOpen: (v: boolean) => void;
  openTheory: (topic: TheoryTopic) => void;
  setTheoryOpen: (v: boolean) => void;
  setMeshConvergenceOpen: (v: boolean) => void;
  setMobileTab: (v: MobileTab) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  algorithm: 'newton',
  loadHistory: 'monotonic',
  loadStep: 0.1,
  tolerance: 0.5,
  peakLambda: 1.2,

  status: 'idle',
  statusDetail: '',

  activeDiagram: 'M',
  activeStep: 0,
  activeMode: 0,
  showGaussPoints: false,
  momentTensionSide: true,
  inspector: null,
  reportOpen: false,
  derivationOpen: false,
  historicalOpen: false,
  theoryOpen: false,
  theoryTopic: 'timoshenko',
  meshConvergenceOpen: false,
  mobileTab: 'canvas',

  setAlgorithm: (v) => set({ algorithm: v }),
  setLoadHistory: (v) => set({ loadHistory: v }),
  setLoadStep: (v) => set({ loadStep: v }),
  setTolerance: (v) => set({ tolerance: v }),
  setPeakLambda: (v) => set({ peakLambda: v }),

  setActiveDiagram: (v) => set({ activeDiagram: v }),
  setActiveStep: (v) => set({ activeStep: v }),
  setActiveMode: (v) => set({ activeMode: v }),
  setShowGaussPoints: (v) => set({ showGaussPoints: v }),
  setMomentTensionSide: (v) => set({ momentTensionSide: v }),
  setStatus: (status, detail = '') => set({ status, statusDetail: detail }),
  openInspector: (selection) => set({ inspector: selection }),
  closeInspector: () => set({ inspector: null }),
  setReportOpen: (v) => set({ reportOpen: v }),
  setDerivationOpen: (v) => set({ derivationOpen: v }),
  setHistoricalOpen: (v) => set({ historicalOpen: v }),
  openTheory: (topic) => set({ theoryOpen: true, theoryTopic: topic }),
  setTheoryOpen: (v) => set({ theoryOpen: v }),
  setMeshConvergenceOpen: (v) => set({ meshConvergenceOpen: v }),
  setMobileTab: (v) => set({ mobileTab: v }),
}));
