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
import type { ReactNode } from 'react';
import { MATERIALS, MATERIAL_FAMILY_GROUP, SECTIONS, SECTION_KIND_GROUP, type MaterialFamily, type SectionKind } from './catalog.js';
import type { ComboboxOption } from '../components/Combobox.js';

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
};

function MaterialSwatch({ color }: { readonly color: string }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16">
      <circle cx="8" cy="8" r="6" fill={color} stroke="var(--border-strong)" strokeWidth="0.75" />
    </svg>
  );
}

const MATERIAL_COLOR: Record<MaterialFamily, string> = {
  steel: 'var(--catalog-steel)',
  aluminum: 'var(--catalog-aluminum)',
  concrete: 'var(--catalog-concrete)',
  timber: 'var(--catalog-timber)',
};

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
    icon: <MaterialSwatch color={MATERIAL_COLOR[m.family]} />,
  }));
}
