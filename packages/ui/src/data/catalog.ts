/**
 * Katalógus — az anyag- és szelvényadatbázis a `@femati/fem-db` csomagból
 * (P14 fázis), a mintafeladat-katalógus (`PRESETS`) pedig ITT marad, mert az
 * UI-specifikus (statikai vázak, nem "adatbázis" a diplomaterv 3.1.6.3
 * értelmében).
 */
import {
  MATERIALS,
  SECTIONS,
  DEFAULT_MATERIAL_ID,
  DEFAULT_SECTION_ID,
  UNVERIFIED_WARNING,
  type MaterialEntry,
  type MaterialFamily,
  type SectionEntry,
  type SectionKind,
} from '@femati/fem-db';
export { MATERIALS, SECTIONS, DEFAULT_MATERIAL_ID, DEFAULT_SECTION_ID, UNVERIFIED_WARNING };
export type { MaterialEntry, MaterialFamily, SectionEntry, SectionKind };

/**
 * A Szelvény/Anyag combobox csoport-címkéi (típus/családszerint) — az
 * ikon- és színleképezés (valódi SVG-k/anyagszínek, NEM Unicode-glifák)
 * a `catalogIcons.tsx`-ben van, mert az JSX-et igényel, ez a fájl pedig
 * szándékosan tisztán adat (`.ts`, nem `.tsx`).
 */
export const SECTION_KIND_GROUP: Record<SectionKind, string> = {
  I: 'I-szelvények (IPE / HEA / HEB)',
  U: 'U-szelvények (UPN)',
  circle: 'Kör keresztmetszetek',
  tube: 'Körgyűrű (cső) keresztmetszetek',
  rect: 'Téglalap keresztmetszetek',
  rhs: 'Zárt szelvények (RHS / SHS)',
  t: 'T-szelvények',
};

export const MATERIAL_FAMILY_GROUP: Record<MaterialFamily, string> = {
  steel: 'Szerkezeti acél',
  stainless: 'Rozsdamentes acél',
  castiron: 'Öntöttvas',
  aluminum: 'Alumínium',
  concrete: 'Beton',
  timber: 'Fa',
};

/** Az egyetlen `SupportType` forrás `model/editable.ts`-ben van (2026-08-30 előtt itt is önállóan deklarálva volt, ami szétcsúszás-veszélyt jelentett) — itt csak re-export. */
import type { SupportType } from '../model/editable.js';
export type { SupportType };

export interface PresetSupport {
  /** Relatív hely a tartó hosszán: 0 … 1 */
  readonly r: number;
  readonly type: SupportType;
}

/**
 * Kiegészítő teher (trapéz megoszló vagy koncentrált nyomaték) — a `q`/`p`/`xp`
 * mezők csak EGY egyenletes megoszlót és EGY koncentrált erőt fejeznek ki;
 * ha egy mintának ennél többre (trapéz alak, nyomatékteher) van szüksége, azt
 * ide kell felvenni.
 */
export type PresetExtraLoad =
  | { readonly kind: 'moment'; readonly r: number; readonly value: number }
  | { readonly kind: 'distributed'; readonly r1: number; readonly r2: number; readonly q1: number; readonly q2: number };

export interface PresetEntry {
  readonly id: string;
  readonly name: string;
  readonly supports: readonly PresetSupport[];
  /** Egyenletes megoszló teher [kN/m] */
  readonly q: number;
  /** Koncentrált erő [kN] */
  readonly p: number;
  /** A koncentrált erő relatív helye */
  readonly xp: number;
  /** A kapcsolódó validációs eset(ek) a MASTER-PROMPT-TERV 3. fejezetéből — „—", ha nincs hozzá dedikált zárt alakú validációs eset. */
  readonly ref: string;
  /** Trapéz megoszló teher és/vagy nyomatékteher, ha a minta ilyet is bemutat. */
  readonly extraLoads?: readonly PresetExtraLoad[];
}

export const PRESETS: readonly PresetEntry[] = [
  {
    id: 'cantilever',
    name: 'Konzol, végponti P',
    supports: [{ r: 0, type: 'fixed' }],
    q: 0,
    p: 20,
    xp: 1,
    ref: 'V-01 / P-03',
  },
  {
    id: 'simple',
    name: 'Kéttámaszú, egyenletes q',
    supports: [
      { r: 0, type: 'pinned' },
      { r: 1, type: 'roller' },
    ],
    q: 20,
    p: 0,
    xp: 0.5,
    ref: 'V-02 / P-05',
  },
  {
    id: 'simpleP',
    name: 'Kéttámaszú, középen P',
    supports: [
      { r: 0, type: 'pinned' },
      { r: 1, type: 'roller' },
    ],
    q: 0,
    p: 60,
    xp: 0.5,
    ref: 'P-04',
  },
  {
    id: 'clamped',
    name: 'Kétoldalt befogott, q',
    supports: [
      { r: 0, type: 'fixed' },
      { r: 1, type: 'fixed' },
    ],
    q: 40,
    p: 0,
    xp: 0.5,
    ref: 'P-06',
  },
  {
    id: 'twospan',
    name: 'Kétnyílású folytatólagos, q',
    supports: [
      { r: 0, type: 'pinned' },
      { r: 0.5, type: 'roller' },
      { r: 1, type: 'roller' },
    ],
    q: 30,
    p: 0,
    xp: 0.25,
    ref: 'P-08',
  },
  {
    id: 'proppedCantilever',
    name: 'Befogott-csuklós tartó, q',
    supports: [
      { r: 0, type: 'fixed' },
      { r: 1, type: 'pinned' },
    ],
    q: 35,
    p: 0,
    xp: 0.5,
    ref: '—',
  },
  {
    id: 'overhang',
    name: 'Kinyúlásos tartó, q',
    supports: [
      { r: 0.15, type: 'pinned' },
      { r: 0.85, type: 'roller' },
    ],
    q: 25,
    p: 0,
    xp: 0.5,
    ref: '—',
  },
  {
    id: 'momentLoad',
    name: 'Kéttámaszú tartó, nyomatékteherrel',
    supports: [
      { r: 0, type: 'pinned' },
      { r: 1, type: 'roller' },
    ],
    q: 0,
    p: 0,
    xp: 0.5,
    ref: '—',
    extraLoads: [{ kind: 'moment', r: 0.5, value: 40 }],
  },
  {
    id: 'trapezoid',
    name: 'Kéttámaszú tartó, trapéz teherrel',
    supports: [
      { r: 0, type: 'pinned' },
      { r: 1, type: 'roller' },
    ],
    q: 0,
    p: 0,
    xp: 0.5,
    ref: '—',
    extraLoads: [{ kind: 'distributed', r1: 0, r2: 1, q1: 10, q2: 40 }],
  },
  {
    id: 'cantileverCombined',
    name: 'Konzol, megoszló és végponti teherrel',
    supports: [{ r: 0, type: 'fixed' }],
    q: 15,
    p: 15,
    xp: 1,
    ref: '—',
  },
];

export const DEFAULT_PRESET_ID = 'twospan';

function firstOr<T>(list: readonly T[], fallback: T): T {
  const [head] = list;
  return head ?? fallback;
}

const FALLBACK_MATERIAL: MaterialEntry = {
  id: 'S235',
  name: 'S235 szerkezeti acél',
  family: 'steel',
  e: 21000,
  nu: 0.3,
  sigmaY: 23.5,
  alpha: 1.2e-5,
  density: 7850,
  hPrime: 0,
  plastic: true,
  source: 'MSZ EN 10025-2',
  verified: true,
};

const FALLBACK_SECTION: SectionEntry = {
  id: 'RECT',
  name: 'Téglalap 120×300',
  kind: 'rect',
  h: 300,
  b: 120,
  source: 'paraméteres alak — nincs gyártói katalógus, a téglalap A/I egzakt zárt alakból számol',
  verified: true,
};

const FALLBACK_PRESET: PresetEntry = {
  id: 'simple',
  name: 'Kéttámaszú, egyenletes q',
  supports: [
    { r: 0, type: 'pinned' },
    { r: 1, type: 'roller' },
  ],
  q: 20,
  p: 0,
  xp: 0.5,
  ref: 'V-02 / P-05',
};

export const findMaterial = (id: string): MaterialEntry =>
  MATERIALS.find((m) => m.id === id) ?? firstOr(MATERIALS, FALLBACK_MATERIAL);

export const findSection = (id: string): SectionEntry =>
  SECTIONS.find((s) => s.id === id) ?? firstOr(SECTIONS, FALLBACK_SECTION);

export const findPreset = (id: string): PresetEntry =>
  PRESETS.find((p) => p.id === id) ?? firstOr(PRESETS, FALLBACK_PRESET);
