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
  type CompositeState,
  type EditableFoundation,
  type EditableLoad,
  type EditableModel,
  type EditableSupport,
  type IntegrationScheme,
  type LoadCategory,
  type RebarState,
  type SupportType,
  type ThermalLoadState,
} from '../model/editable.js';

export type Selection =
  | { readonly kind: 'support'; readonly id: string }
  | { readonly kind: 'load'; readonly id: string }
  | { readonly kind: 'foundation'; readonly id: string };

const HISTORY_LIMIT = 50;

export interface ModelState {
  readonly model: EditableModel;
  readonly selection: Selection | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;

  readonly loadPreset: (id: string) => void;
  /** Teljes modell betöltése (Fájl → Betöltés, `.femati.json`) — a `loadPreset` mintájára, de a kész `EditableModel`-t veszi át. */
  readonly loadModel: (model: EditableModel) => void;
  readonly setSpan: (v: number) => void;
  readonly setElementCount: (v: number) => void;
  readonly setSectionId: (id: string) => void;
  readonly setMaterialId: (id: string) => void;
  readonly setSelfWeight: (v: boolean) => void;
  readonly setAxialForce: (v: number) => void;
  readonly setThermalLoad: (v: ThermalLoadState) => void;
  readonly setRebar: (v: RebarState) => void;
  readonly setComposite: (v: CompositeState) => void;
  readonly setIntegration: (v: IntegrationScheme) => void;

  readonly select: (selection: Selection | null) => void;
  readonly addSupport: (x: number, type: SupportType, k?: number) => void;
  readonly moveSupport: (id: string, x: number) => void;
  readonly setSupportType: (id: string, type: SupportType) => void;
  readonly setSpringStiffness: (id: string, k: number) => void;
  readonly setSupportDisplacement: (id: string, dz: number | undefined, dPhi: number | undefined) => void;
  readonly addPointLoad: (x: number, p: number) => void;
  readonly addMomentLoad: (x: number, m: number) => void;
  readonly addDistributedLoad: (x1: number, x2: number, q1: number, q2: number) => void;
  readonly addDistributedMomentLoad: (x1: number, x2: number, m1: number, m2: number) => void;
  /** Teher kategóriájának (állandó/esetleges) beállítása — ld. `model/combinations.ts`. */
  readonly setLoadCategory: (id: string, category: LoadCategory) => void;
  readonly moveLoad: (id: string, deltaX: number) => void;
  /** Pont-/nyomatékteher ABSZOLÚT pozíciójának pontos beállítása (pl. begépelt érték) — a hálócsomópontra illesztve, mint a `moveSupport`. */
  readonly setLoadPosition: (id: string, x: number) => void;
  /** Megoszló teher/nyomaték szakaszhatárainak (x1/x2) pontos, FÜGGETLEN beállítása — nincs hálóra illesztve (ld. `editable.ts` fejléce: a megoszló teher szabadon állítható). */
  readonly setLoadRange: (id: string, x1: number, x2: number) => void;
  readonly setLoadMagnitude: (id: string, value: number) => void;
  readonly setDistributedLoadMagnitudes: (id: string, q1: number, q2: number) => void;
  readonly setDistributedMomentMagnitudes: (id: string, m1: number, m2: number) => void;
  readonly addFoundation: (x1: number, x2: number, c: number) => void;
  readonly moveFoundation: (id: string, deltaX: number) => void;
  /** Ágyazat szakaszhatárainak pontos, független beállítása — ld. `setLoadRange`. */
  readonly setFoundationRange: (id: string, x1: number, x2: number) => void;
  readonly setFoundationStiffness: (id: string, c: number) => void;
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

    loadModel: (model) => {
      const current = get().model;
      past = [...past.slice(-HISTORY_LIMIT + 1), current];
      future = [];
      set({ model, selection: null, canUndo: true, canRedo: false });
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
        d.foundations = d.foundations.map((f) => ({ ...f, x1: Math.max(0, f.x1 * scale), x2: Math.min(v, f.x2 * scale) }));
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
    setAxialForce: (v) => edit((d) => void (d.axialForce = v)),
    setThermalLoad: (v) => edit((d) => void (d.thermalLoad = v)),
    setRebar: (v) => edit((d) => void (d.rebar = v)),
    setComposite: (v) => edit((d) => void (d.composite = v)),
    setIntegration: (v) => edit((d) => void (d.integration = v)),

    select: (selection) => set({ selection }),

    addSupport: (x, type, k) =>
      edit((d) => {
        const snapped = snapToNode(x, d.span, d.elementCount);
        const id = nextEntityId('S');
        d.supports.push({ id, x: snapped, type, ...(k !== undefined ? { k } : {}) } as EditableSupport);
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

    setSpringStiffness: (id, k) =>
      edit((d) => {
        const s = d.supports.find((sup) => sup.id === id);
        if (s === undefined) return;
        s.k = k;
      }),

    setSupportDisplacement: (id, dz, dPhi) =>
      edit((d) => {
        const s = d.supports.find((sup) => sup.id === id);
        if (s === undefined) return;
        s.dz = dz;
        s.dPhi = dPhi;
      }),

    addPointLoad: (x, p) =>
      edit((d) => {
        const id = nextEntityId('P');
        d.loads.push({ id, kind: 'point', x: snapToNode(x, d.span, d.elementCount), p, category: 'variable' } as EditableLoad);
      }),

    addMomentLoad: (x, m) =>
      edit((d) => {
        const id = nextEntityId('M');
        d.loads.push({ id, kind: 'moment', x: snapToNode(x, d.span, d.elementCount), m, category: 'variable' } as EditableLoad);
      }),

    addDistributedLoad: (x1, x2, q1, q2) =>
      edit((d) => {
        const id = nextEntityId('Q');
        const lo = Math.max(0, Math.min(x1, x2));
        const hi = Math.min(d.span, Math.max(x1, x2));
        if (hi - lo < 1e-6) return;
        d.loads.push({ id, kind: 'distributed', x1: lo, x2: hi, q1, q2, category: 'variable' } as EditableLoad);
      }),

    addDistributedMomentLoad: (x1, x2, m1, m2) =>
      edit((d) => {
        const id = nextEntityId('MQ');
        const lo = Math.max(0, Math.min(x1, x2));
        const hi = Math.min(d.span, Math.max(x1, x2));
        if (hi - lo < 1e-6) return;
        d.loads.push({ id, kind: 'distributed-moment', x1: lo, x2: hi, m1, m2, category: 'variable' } as EditableLoad);
      }),

    setLoadCategory: (id, category) =>
      edit((d) => {
        const l = d.loads.find((x) => x.id === id);
        if (l === undefined) return;
        l.category = category;
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

    setLoadPosition: (id, x) =>
      edit((d) => {
        const l = d.loads.find((ld) => ld.id === id);
        if (l === undefined || (l.kind !== 'point' && l.kind !== 'moment')) return;
        l.x = snapToNode(x, d.span, d.elementCount);
      }),

    setLoadRange: (id, x1, x2) =>
      edit((d) => {
        const l = d.loads.find((ld) => ld.id === id);
        if (l === undefined || (l.kind !== 'distributed' && l.kind !== 'distributed-moment')) return;
        const lo = Math.max(0, Math.min(x1, x2));
        const hi = Math.min(d.span, Math.max(x1, x2));
        if (hi - lo < 1e-6) return;
        l.x1 = lo;
        l.x2 = hi;
      }),

    setLoadMagnitude: (id, value) =>
      edit((d) => {
        const l = d.loads.find((x) => x.id === id);
        if (l === undefined) return;
        if (l.kind === 'point') l.p = value;
        else if (l.kind === 'moment') l.m = value;
        else if (l.kind === 'distributed') {
          l.q1 = value;
          l.q2 = value;
        } else {
          l.m1 = value;
          l.m2 = value;
        }
      }),

    setDistributedLoadMagnitudes: (id, q1, q2) =>
      edit((d) => {
        const l = d.loads.find((x) => x.id === id);
        if (l === undefined || l.kind !== 'distributed') return;
        l.q1 = q1;
        l.q2 = q2;
      }),

    setDistributedMomentMagnitudes: (id, m1, m2) =>
      edit((d) => {
        const l = d.loads.find((x) => x.id === id);
        if (l === undefined || l.kind !== 'distributed-moment') return;
        l.m1 = m1;
        l.m2 = m2;
      }),

    addFoundation: (x1, x2, c) =>
      edit((d) => {
        const id = nextEntityId('W');
        const lo = Math.max(0, Math.min(x1, x2));
        const hi = Math.min(d.span, Math.max(x1, x2));
        if (hi - lo < 1e-6) return;
        d.foundations.push({ id, x1: lo, x2: hi, c } as EditableFoundation);
      }),

    moveFoundation: (id, deltaX) =>
      edit((d) => {
        const f = d.foundations.find((x) => x.id === id);
        if (f === undefined) return;
        const width = f.x2 - f.x1;
        const lo = Math.min(Math.max(f.x1 + deltaX, 0), d.span - width);
        f.x1 = lo;
        f.x2 = lo + width;
      }),

    setFoundationRange: (id, x1, x2) =>
      edit((d) => {
        const f = d.foundations.find((fd) => fd.id === id);
        if (f === undefined) return;
        const lo = Math.max(0, Math.min(x1, x2));
        const hi = Math.min(d.span, Math.max(x1, x2));
        if (hi - lo < 1e-6) return;
        f.x1 = lo;
        f.x2 = hi;
      }),

    setFoundationStiffness: (id, c) =>
      edit((d) => {
        const f = d.foundations.find((x) => x.id === id);
        if (f === undefined) return;
        f.c = c;
      }),

    removeSelected: () => {
      const sel = get().selection;
      if (sel === null) return;
      edit((d) => {
        if (sel.kind === 'support') d.supports = d.supports.filter((s) => s.id !== sel.id);
        else if (sel.kind === 'load') d.loads = d.loads.filter((l) => l.id !== sel.id);
        else d.foundations = d.foundations.filter((f) => f.id !== sel.id);
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
