/**
 * Anyag- és szelvényadatbázis — Diplomaterv 3.1.6.3.1-3.1.6.3.2,
 * MASTER-PROMPT-TERV P14 prompt.
 *
 * A diplomaterv SZÓ SZERINTI figyelmeztetése (42. oldal): "Az adatbázisban
 * megtalálható keresztmetszetek jellemzőinek értékei TÁJÉKOZTATÓ jellegűek,
 * az értékeket az első felhasználás előtt ELLENŐRIZNI KELL!" — ugyanez a
 * szelvényekre ÉS az anyagokra is érvényes, ezért minden rekordnak van
 * `source` és `verified` mezője, és a `verified: false` rekordokat a
 * felület KÜLÖN meg kell jelenítse (nem elég a puszta jelenlétük).
 */
import materialsData from './materials.json' with { type: 'json' };
import sectionsData from './sections.json' with { type: 'json' };
import type { MaterialEntry, MaterialFamily, SectionEntry, SectionKind } from './types.js';

export type { MaterialEntry, MaterialFamily, SectionEntry, SectionKind };

// A JSON-importok mezőtípusait (pl. `kind: string`) a `resolveJsonModule`
// nem szűkíti a szakszerű union-típusra — az adatok forrása (`materials.json`,
// `sections.json`) maga a "séma", ezért itt egyszeri, indokolt típusállítás
// történik, nem tetszőleges adatra.
export const MATERIALS: readonly MaterialEntry[] = materialsData as readonly MaterialEntry[];
export const SECTIONS: readonly SectionEntry[] = sectionsData as readonly SectionEntry[];

export const DEFAULT_MATERIAL_ID = 'S235';
export const DEFAULT_SECTION_ID = 'IPE300';

/**
 * A diplomaterv szó szerinti figyelmeztetése (3.1.6.3.2, 42. oldal) — a
 * felület ezt jeleníti meg minden `verified: false` rekordnál.
 */
export const UNVERIFIED_WARNING =
  'Az adatbázisban megtalálható keresztmetszetek jellemzőinek értékei ' +
  'tájékoztató jellegűek, az értékeket az első felhasználás előtt ellenőrizni kell!';
