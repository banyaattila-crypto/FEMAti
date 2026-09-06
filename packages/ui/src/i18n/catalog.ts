/**
 * A `data/catalog.ts` UI-oldali csoportosító feliratai (`SECTION_KIND_GROUP`,
 * `MATERIAL_FAMILY_GROUP`) és a mintafeladat-katalógus (`PRESETS`) neve — a
 * teljes UI i18n (2026-09-05) 4. fázisa. Szándékosan KÜLÖN a `data/catalog.ts`
 * saját (magyar-only) konstansaitól: az a fájl "tisztán adat" marad (saját
 * fejléc-kommentje szerint), a nyelvfüggő megjelenítést innen kapja.
 *
 * A `fem-db` katalógus-adattartalom (anyag-/szelvénynevek, forrás-idézetek —
 * `material.name`/`section.name`/`*.source`/`*.note`) NEM ebbe a fájlba
 * tartozik — az `i18n/database.ts` `catalogName()`/`catalogText()`
 * fordítja (2026-09-06), a `fem-db` JSON-adat maga TOVÁBBRA IS magyar-only
 * marad (ld. memória: `project-femati-i18n-progress`).
 */
import type { Lang } from '../state/appStore.js';
import type { MaterialFamily, SectionKind } from '@femati/fem-db';
import { MATERIAL_FAMILY_GROUP, PRESETS, SECTION_KIND_GROUP } from '../data/catalog.js';

const SECTION_KIND_GROUP_EN: Record<SectionKind, string> = {
  I: 'I-sections (IPE / HEA / HEB)',
  U: 'U-sections (UPN)',
  circle: 'Circular sections',
  tube: 'Tube (annular) sections',
  rect: 'Rectangular sections',
  rhs: 'Closed sections (RHS / SHS)',
  t: 'T-sections',
};

const MATERIAL_FAMILY_GROUP_EN: Record<MaterialFamily, string> = {
  steel: 'Structural steel',
  stainless: 'Stainless steel',
  castiron: 'Cast iron',
  aluminum: 'Aluminum',
  concrete: 'Concrete',
  timber: 'Timber',
};

export function sectionKindGroupLabel(kind: SectionKind, lang: Lang): string {
  return lang === 'en' ? SECTION_KIND_GROUP_EN[kind] : SECTION_KIND_GROUP[kind];
}

export function materialFamilyGroupLabel(family: MaterialFamily, lang: Lang): string {
  return lang === 'en' ? MATERIAL_FAMILY_GROUP_EN[family] : MATERIAL_FAMILY_GROUP[family];
}

/** A `PresetEntry.name` angol fordítása, `id` szerint — a `PresetEntry.name` mező maga marad a magyar kanonikus érték (ld. `data/catalog.ts`), ugyanaz a minta, mint a `ModelFileError`/`i18n/errors.ts` kettőssége. */
const PRESET_NAME_EN: Record<string, string> = {
  cantilever: 'Cantilever, tip load P',
  simple: 'Simply supported, uniform q',
  simpleP: 'Simply supported, midspan P',
  clamped: 'Fixed at both ends, uniform q',
  twospan: 'Two-span continuous beam, uniform q',
  proppedCantilever: 'Propped cantilever, uniform q',
  overhang: 'Beam with overhangs, uniform q',
  momentLoad: 'Simply supported beam, moment load',
  trapezoid: 'Simply supported beam, trapezoidal load',
  cantileverCombined: 'Cantilever, distributed and tip load',
};

export function presetDisplayName(id: string, lang: Lang): string {
  const preset = PRESETS.find((p) => p.id === id);
  if (lang === 'en') {
    const en = PRESET_NAME_EN[id];
    if (en !== undefined) return en;
  }
  return preset?.name ?? id;
}
