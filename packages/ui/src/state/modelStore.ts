/**
 * A szerkeszthető modell állapota — immer-alapú módosításokkal és undo/redo-val
 * (MASTER-PROMPT-TERV P7 prompt). Ez az EGYETLEN forrás, amiből a vászon
 * rajzol ÉS amiből a mag a `Model`-t fordítja (`model/compile.ts`).
 */
import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import { DEFAULT_MATERIAL_ID, DEFAULT_PRESET_ID, DEFAULT_SECTION_ID, findPreset } from '../data/catalog.js';
import {
  nextEntityId,
  presetToEditable,
  snapToNode,
  type EditableLoad,
  type EditableModel,
  type EditableSupport,
  type IntegrationScheme,
  type SupportType,
} from '../model/editable.js';

export type Selection = { readonly kind: 'support'; readonly id: string } | { readonly kind: 'load'; readonly id: string };

const HISTORY_LIMIT = 50;

export interface ModelState {
  readonly model: EditableModel;
  readonly selection: Selection | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;

  readonly loadPreset: (id: string) => void;
  readonly setSpan: (v: number) => void;
  readonly setElementCount: (v: number) => void;
  readonly setSectionId: (id: string) => void;
  readonly setMaterialId: (id: string) => void;
  readonly setSelfWeight: (v: boolean) => void;
  readonly setIntegration: (v: IntegrationScheme) => void;

  readonly select: (selection: Selection | null) => void;
  readonly addSupport: (x: number, type: SupportType) => void;
  readonly moveSupport: (id: string, x: number) => void;
  readonly setSupportType: (id: string, type: SupportType) => void;
  readonly addPointLoad: (x: number, p: number) => void;
  readonly addMomentLoad: (x: number, m: number) => void;
  readonly addDistributedLoad: (x1: number, x2: number, q1: number, q2: number) => void;
  readonly moveLoad: (id: string, deltaX: number) => void;
  readonly setLoadMagnitude: (id: string, value: number) => void;
  readonly setDistributedLoadMagnitudes: (id: string, q1: number, q2: number) => void;
  readonly removeSelected: () => void;

  readonly undo: () => void;
  readonly redo: () => void;
}

function initialModel(): EditableModel {
  const preset = findPreset(DEFAULT_PRESET_ID);
  return presetToEditable(
    preset,
    DEFAULT_PRESET_ID,
    12,
    16,
    DEFAULT_SECTION_ID,
    DEFAULT_MATERIAL_ID,
    false,
    'selective',
  );
}

export const useModelStore = create<ModelState>()((set, get) => {
  let past: EditableModel[] = [];
  let future: EditableModel[] = [];

  /** Modellmódosítás immer-recepttel — a history-t is karbantartja. */
  const edit = (recipe: (draft: Draft<EditableModel>) => void): void => {
    const current = get().model;
    const next = produce(current, recipe);
    if (next === current) return; // nincs tényleges változás
    past = [...past.slice(-HISTORY_LIMIT + 1), current];
    future = [];
    set({ model: next, canUndo: true, canRedo: false });
  };

  return {
    model: initialModel(),
    selection: null,
    canUndo: false,
    canRedo: false,

    loadPreset: (id) => {
      const preset = findPreset(id);
      const current = get().model;
      const next = presetToEditable(
        preset,
        id,
        current.span,
        current.elementCount,
        current.sectionId,
        current.materialId,
        current.selfWeight,
        current.integration,
      );
      past = [...past.slice(-HISTORY_LIMIT + 1), current];
      future = [];
      set({ model: next, selection: null, canUndo: true, canRedo: false });
    },

    setSpan: (v) =>
      edit((d) => {
        const scale = v / d.span;
        d.span = v;
        // A támaszok/terhek arányosan követik a fesztáv-változást, majd a hálóra illeszkednek.
        d.supports = d.supports.map((s) => ({ ...s, x: snapToNode(s.x * scale, v, d.elementCount) }));
        d.loads = d.loads.map((l) =>
          l.kind === 'point' || l.kind === 'moment'
            ? { ...l, x: snapToNode(l.x * scale, v, d.elementCount) }
            : { ...l, x1: Math.max(0, l.x1 * scale), x2: Math.min(v, l.x2 * scale) },
        );
      }),

    setElementCount: (v) =>
      edit((d) => {
        d.elementCount = v;
        d.supports = d.supports.map((s) => ({ ...s, x: snapToNode(s.x, d.span, v) }));
        d.loads = d.loads.map((l) =>
          l.kind === 'point' || l.kind === 'moment' ? { ...l, x: snapToNode(l.x, d.span, v) } : l,
        );
      }),

    setSectionId: (id) => edit((d) => void (d.sectionId = id)),
    setMaterialId: (id) => edit((d) => void (d.materialId = id)),
    setSelfWeight: (v) => edit((d) => void (d.selfWeight = v)),
    setIntegration: (v) => edit((d) => void (d.integration = v)),

    select: (selection) => set({ selection }),

    addSupport: (x, type) =>
      edit((d) => {
        const snapped = snapToNode(x, d.span, d.elementCount);
        const id = nextEntityId('S');
        d.supports.push({ id, x: snapped, type } as EditableSupport);
      }),

    moveSupport: (id, x) =>
      edit((d) => {
        const s = d.supports.find((sup) => sup.id === id);
        if (s === undefined) return;
        s.x = snapToNode(x, d.span, d.elementCount);
      }),

    setSupportType: (id, type) =>
      edit((d) => {
        const s = d.supports.find((sup) => sup.id === id);
        if (s === undefined) return;
        s.type = type;
      }),

    addPointLoad: (x, p) =>
      edit((d) => {
        const id = nextEntityId('P');
        d.loads.push({ id, kind: 'point', x: snapToNode(x, d.span, d.elementCount), p } as EditableLoad);
      }),

    addMomentLoad: (x, m) =>
      edit((d) => {
        const id = nextEntityId('M');
        d.loads.push({ id, kind: 'moment', x: snapToNode(x, d.span, d.elementCount), m } as EditableLoad);
      }),

    addDistributedLoad: (x1, x2, q1, q2) =>
      edit((d) => {
        const id = nextEntityId('Q');
        const lo = Math.max(0, Math.min(x1, x2));
        const hi = Math.min(d.span, Math.max(x1, x2));
        if (hi - lo < 1e-6) return;
        d.loads.push({ id, kind: 'distributed', x1: lo, x2: hi, q1, q2 } as EditableLoad);
      }),

    moveLoad: (id, deltaX) =>
      edit((d) => {
        const l = d.loads.find((x) => x.id === id);
        if (l === undefined) return;
        if (l.kind === 'point' || l.kind === 'moment') {
          l.x = snapToNode(l.x + deltaX, d.span, d.elementCount);
        } else {
          const width = l.x2 - l.x1;
          const lo = Math.min(Math.max(l.x1 + deltaX, 0), d.span - width);
          l.x1 = lo;
          l.x2 = lo + width;
        }
      }),

    setLoadMagnitude: (id, value) =>
      edit((d) => {
        const l = d.loads.find((x) => x.id === id);
        if (l === undefined) return;
        if (l.kind === 'point') l.p = value;
        else if (l.kind === 'moment') l.m = value;
        else {
          l.q1 = value;
          l.q2 = value;
        }
      }),

    setDistributedLoadMagnitudes: (id, q1, q2) =>
      edit((d) => {
        const l = d.loads.find((x) => x.id === id);
        if (l === undefined || l.kind !== 'distributed') return;
        l.q1 = q1;
        l.q2 = q2;
      }),

    removeSelected: () => {
      const sel = get().selection;
      if (sel === null) return;
      edit((d) => {
        if (sel.kind === 'support') d.supports = d.supports.filter((s) => s.id !== sel.id);
        else d.loads = d.loads.filter((l) => l.id !== sel.id);
      });
      set({ selection: null });
    },

    undo: () => {
      if (past.length === 0) return;
      const current = get().model;
      const previous = past[past.length - 1];
      if (previous === undefined) return;
      past = past.slice(0, -1);
      future = [current, ...future];
      set({ model: previous, canUndo: past.length > 0, canRedo: true, selection: null });
    },

    redo: () => {
      if (future.length === 0) return;
      const current = get().model;
      const next = future[0];
      if (next === undefined) return;
      future = future.slice(1);
      past = [...past, current];
      set({ model: next, canUndo: true, canRedo: future.length > 0, selection: null });
    },
  };
});
