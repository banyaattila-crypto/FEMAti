/**
 * Valódi (SVG) ikonok a Szelvény/Anyag `Combobox`-hoz — a korábbi Unicode-
 * glifás megoldás (ld. STATUS_REPORT.md 33. pont) a felhasználó szerint
 * "kézzel rajzoltnak" hatott, mert egy natív `<select>`/`<option>` valóban
 * csak szöveget tud megjeleníteni. A `Combobox.tsx` viszont saját,
 * `role="listbox"` widget, ezért itt már tetszőleges React-node (SVG,
 * színes swatch) megengedett.
 *
 * SZELVÉNY: a keresztmetszet ALAKJÁT ábrázoló, egyszerű vonalas ikon
 * (`currentColor`, `stroke`, `fill="none"`) — ugyanaz a letisztult,
 * finom vonalvezetésű stílus, mint a `canvas/marks.tsx` jelöléseinél.
 * ANYAG: a felhasználó kifejezett kérésére VALÓDI anyagszínű, kitöltött
 * kör-swatch (`--catalog-*` tokenek, `docs/UI-CONVENTIONS.md` 1. pont) —
 * nem szöveg-szín, hanem egy tényleges kitöltött SVG-kör.
 */
import { useId, type ReactNode } from 'react';
import {
  MATERIALS,
  MATERIAL_FAMILY_GROUP,
  PRESETS,
  SECTIONS,
  SECTION_KIND_GROUP,
  type MaterialFamily,
  type PresetEntry,
  type SectionKind,
} from './catalog.js';
import type { ComboboxOption } from '../components/Combobox.js';
import { LOAD_COLOR, SUPPORT_COLOR, arrowMarkerId } from '../canvas/marks.js';

function Icon({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const SECTION_ICON: Record<SectionKind, JSX.Element> = {
  I: (
    <Icon>
      <path d="M4 2.5h8M4 13.5h8M8 2.5v11" />
    </Icon>
  ),
  U: (
    <Icon>
      <path d="M5.5 3v8a1.5 1.5 0 0 0 1.5 1.5h2A1.5 1.5 0 0 0 10.5 11V3" />
    </Icon>
  ),
  circle: (
    <Icon>
      <circle cx="8" cy="8" r="5.3" />
    </Icon>
  ),
  tube: (
    <Icon>
      <circle cx="8" cy="8" r="5.3" />
      <circle cx="8" cy="8" r="2.4" />
    </Icon>
  ),
  rect: (
    <Icon>
      <rect x="3" y="5" width="10" height="6" rx="0.6" />
    </Icon>
  ),
  rhs: (
    <Icon>
      <rect x="2.5" y="4" width="11" height="8" rx="0.6" />
      <rect x="4.5" y="6" width="7" height="4" rx="0.4" />
    </Icon>
  ),
  t: (
    <Icon>
      <path d="M3.5 2.5h9M8 2.5v11" />
    </Icon>
  ),
};

export const MATERIAL_COLOR: Record<MaterialFamily, string> = {
  steel: 'var(--catalog-steel)',
  aluminum: 'var(--catalog-aluminum)',
  concrete: 'var(--catalog-concrete)',
  timber: 'var(--catalog-timber)',
};

/**
 * Anyagcsaládonként ELTÉRŐ, "élethű" kitöltés — nem csak egy szín, hanem az
 * anyag TAPINTÁSÁT idéző mintázat (2026-08-29, felhasználói visszajelzés:
 * a korábbi sima színes kör nem volt eléggé "élethű"). A fém családok
 * (acél/alumínium) ugyanazt a "mély fém" színátmenet-receptet kapják, mint
 * a szelvényrajz (`SectionShapeDiagram.tsx`) — közös vizuális nyelv —, a
 * beton finom szemcsés (aggregátum-) mintázatot, a fa pedig évgyűrű-íveket.
 */
function MaterialFill({ family, defsId }: { readonly family: MaterialFamily; readonly defsId: string }): JSX.Element {
  const base = MATERIAL_COLOR[family];
  switch (family) {
    case 'steel':
    case 'aluminum':
      return (
        <linearGradient id={defsId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`color-mix(in srgb, ${base} 45%, white)`} />
          <stop offset="0.5" stopColor={base} />
          <stop offset="1" stopColor={`color-mix(in srgb, ${base} 55%, black)`} />
        </linearGradient>
      );
    case 'concrete':
      return (
        <pattern id={defsId} width="5" height="5" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill={base} />
          <circle cx="1.2" cy="1.4" r="0.55" fill={`color-mix(in srgb, ${base} 55%, black)`} />
          <circle cx="3.6" cy="2.6" r="0.45" fill={`color-mix(in srgb, ${base} 40%, black)`} />
          <circle cx="2.4" cy="4.2" r="0.5" fill={`color-mix(in srgb, ${base} 60%, white)`} />
        </pattern>
      );
    case 'timber':
      return (
        <linearGradient id={defsId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`color-mix(in srgb, ${base} 70%, white)`} />
          <stop offset="1" stopColor={`color-mix(in srgb, ${base} 80%, black)`} />
        </linearGradient>
      );
  }
}

/** A fa családnál a kitöltés fölé rajzolt évgyűrű-ívek (a `defsId` gradiensen felül). */
function TimberGrain({ base }: { readonly base: string }): JSX.Element | null {
  const stroke = `color-mix(in srgb, ${base} 45%, black)`;
  return (
    <g stroke={stroke} strokeWidth="0.5" fill="none" opacity="0.55">
      <path d="M2 6 Q8 4.2 14 6" />
      <path d="M2 9 Q8 7.5 14 9" />
      <path d="M2 12 Q8 10.8 14 12" />
    </g>
  );
}

export function MaterialSwatch({ family, size = 16 }: { readonly family: MaterialFamily; readonly size?: number }): JSX.Element {
  const defsId = `material-fill-${useId()}`;
  const clipId = `material-clip-${useId()}`;
  const base = MATERIAL_COLOR[family];
  return (
    <svg viewBox="0 0 16 16" width={size} height={size}>
      <defs>
        <MaterialFill family={family} defsId={defsId} />
        <clipPath id={clipId}>
          <circle cx="8" cy="8" r="6" />
        </clipPath>
      </defs>
      <circle cx="8" cy="8" r="6" fill={`url(#${defsId})`} stroke="var(--border-strong)" strokeWidth="0.75" />
      {family === 'timber' ? (
        <g clipPath={`url(#${clipId})`}>
          <TimberGrain base={base} />
        </g>
      ) : null}
    </svg>
  );
}

/** A "Szelvény" combobox opciói, típus szerint csoportosítva, alak-ikonnal. */
export function sectionComboOptions(): readonly ComboboxOption[] {
  return SECTIONS.map((s) => ({
    value: s.id,
    label: s.name,
    group: SECTION_KIND_GROUP[s.kind],
    icon: SECTION_ICON[s.kind],
  }));
}

/** Az "Anyag" combobox opciói, anyagcsalád szerint csoportosítva, anyagszínű swatch-csal. */
export function materialComboOptions(): readonly ComboboxOption[] {
  return MATERIALS.map((m) => ({
    value: m.id,
    label: m.name,
    group: MATERIAL_FAMILY_GROUP[m.family],
    icon: <MaterialSwatch family={m.family} />,
  }));
}

// ─── Szerkezet (statikai váz) — séma-ikon ──────────────────────────────────
//
// A "Szerkezet" combobox (`Toolbar.tsx`) opciói a `PRESETS` katalógusból
// (`catalog.ts`) jönnek — mindegyik egy teljes statikai vázat ír le
// (támaszok relatív pozícióval/típussal, megoszló/koncentrált teher,
// esetleges extra teher). A séma-ikon ADATVEZÉRELT (a `SectionShapeDiagram`/
// `MaterialSwatch` mintáját követve): NEM 10 kézzel rajzolt ikon, hanem a
// `PresetEntry` mezőiből számolt kis vonalas rajz — így minden jövőbeli új
// preset AUTOMATIKUSAN kap sémát, nem maradhat le róla.

const PRESET_X0 = 2;
const PRESET_X1 = 42;
const PRESET_BEAM_Y = 7;

function presetX(r: number): number {
  return PRESET_X0 + r * (PRESET_X1 - PRESET_X0);
}

/** Egy támasz kis jele a séma-ikonban — ugyanaz a forma-nyelv, mint a `canvas/marks.tsx` `SupportMark`-jáé, csak 16×16-nál is kisebb léptékben. */
function PresetSupportMark({ x, type }: { readonly x: number; readonly type: PresetEntry['supports'][number]['type'] }): JSX.Element {
  const color = SUPPORT_COLOR[type];
  if (type === 'fixed') {
    return <rect x={x - 2.5} y={PRESET_BEAM_Y} width={5} height={2.2} fill={color} />;
  }
  const tri = `${x},${PRESET_BEAM_Y} ${x - 3},${PRESET_BEAM_Y + 4.5} ${x + 3},${PRESET_BEAM_Y + 4.5}`;
  return (
    <g>
      <polygon points={tri} fill="none" stroke={color} strokeWidth={1} />
      {type === 'roller' ? <circle cx={x} cy={PRESET_BEAM_Y + 5.6} r={0.9} fill={color} /> : null}
    </g>
  );
}

/**
 * Kis lefelé mutató teher-nyíl a séma-ikonban, a gerenda fölött — a
 * nyílhegy a `canvas/marks.tsx` `CanvasDefs`-ében MÁR definiált,
 * típusonkénti markert használja újra (ott mindig jelen van a DOM-ban,
 * amíg a `ModelCanvas` fut — ami mindig fut, amíg ez a combobox
 * megjeleníthető), nem definiál sajátot.
 */
function PresetLoadTick({ x, kind, color }: { readonly x: number; readonly kind: 'point' | 'distributed'; readonly color: string }): JSX.Element {
  return (
    <line x1={x} y1={PRESET_BEAM_Y - 5} x2={x} y2={PRESET_BEAM_Y - 0.6} stroke={color} strokeWidth={1} markerEnd={`url(#${arrowMarkerId(kind)})`} />
  );
}

/** Egy statikai váz kis sémarajza: gerenda + támaszok a valós relatív pozíciójukon, terhek a fajtájuknak megfelelő jellel. */
export function PresetIcon({ preset }: { readonly preset: PresetEntry }): JSX.Element {
  const loadTicks: number[] = [];
  if (preset.q > 0) loadTicks.push(0.2, 0.5, 0.8);
  for (const extra of preset.extraLoads ?? []) {
    if (extra.kind === 'distributed') loadTicks.push(extra.r1 * 0.34 + extra.r2 * 0.66, extra.r1 * 0.66 + extra.r2 * 0.34);
  }

  return (
    <svg width="32" height="16" viewBox="0 0 44 16" aria-hidden="true">
      <line x1={PRESET_X0} y1={PRESET_BEAM_Y} x2={PRESET_X1} y2={PRESET_BEAM_Y} stroke="var(--text-secondary)" strokeWidth={1.3} />
      {loadTicks.map((r, i) => (
        <PresetLoadTick key={`q${i}`} x={presetX(r)} kind="distributed" color={LOAD_COLOR.distributed} />
      ))}
      {preset.p > 0 ? <PresetLoadTick x={presetX(preset.xp)} kind="point" color={LOAD_COLOR.point} /> : null}
      {(preset.extraLoads ?? []).map((extra, i) =>
        extra.kind === 'moment' ? (
          <path
            key={`m${i}`}
            d={`M${(presetX(extra.r) + 3).toFixed(1)},${(PRESET_BEAM_Y - 3).toFixed(1)} A3,3 0 1 1 ${presetX(extra.r).toFixed(1)},${(PRESET_BEAM_Y - 6).toFixed(1)}`}
            fill="none"
            stroke={LOAD_COLOR.moment}
            strokeWidth={1}
          />
        ) : null,
      )}
      {preset.supports.map((s, i) => (
        <PresetSupportMark key={i} x={presetX(s.r)} type={s.type} />
      ))}
    </svg>
  );
}

/** A "Szerkezet" combobox opciói — minden statikai vázhoz a fenti sémarajz. */
export function presetComboOptions(): readonly ComboboxOption[] {
  return PRESETS.map((p) => ({
    value: p.id,
    label: p.name,
    icon: <PresetIcon preset={p} />,
  }));
}
