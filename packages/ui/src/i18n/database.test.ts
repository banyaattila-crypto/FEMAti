import { describe, expect, it } from 'vitest';
import { MATERIALS, SECTIONS } from '../data/catalog.js';
import { catalogName, NAME_PHRASE_EN, NOTE_EN, SOURCE_EN } from './database.js';

/**
 * 2026-09-06 — a katalógus `.source`/`.note` mezőinek magyar → angol
 * fordítása (`SOURCE_EN`/`NOTE_EN`) lookup-táblákkal megy, KULCSOLVA a
 * pontos magyar szövegre — ha egy jövőbeli katalógus-bővítés egy ÚJ,
 * eddig nem látott szöveget vezet be, a UI csendben visszaesik az eredeti
 * magyarra (nem törik el), DE ez a teszt figyelmeztet rá, hogy pótolni
 * kellene a fordítást.
 *
 * `CODE_ONLY_SOURCES`: a jelenleg előforduló `source`-szövegek közül azok,
 * amik PUSZTA szabványkódok, nincs bennük magyar szó — ezeket szándékosan
 * NEM tartalmazza `SOURCE_EN` (nincs mit fordítani rajtuk), ld.
 * `database.ts` fejléce. Ha ez a lista elavul (egy szövege már NEM
 * szerepel a katalógusban), a teszt szintén jelzi.
 */
const CODE_ONLY_SOURCES: ReadonlySet<string> = new Set(['MSZ EN 10025-2', 'MSZ EN 1999-1-1', 'MSZ EN 14080']);

describe('katalógus source/note fordítás — teljesség-ellenőrzés', () => {
  const allEntries = [...MATERIALS, ...SECTIONS];
  const usedSources = new Set(allEntries.map((e) => e.source).filter((s): s is string => s !== undefined));
  // Csak a MaterialEntry-nek van `note` mezője (ld. `fem-db/src/types.ts`) — SectionEntry-nek nincs (jelenleg egyetlen szelvény-rekordnak sincs note-ja).
  const usedNotes = new Set(MATERIALS.map((e) => e.note).filter((n): n is string => n !== undefined));

  it('minden jelenleg használt source-szöveg vagy angolra fordított, vagy szerepel a CODE_ONLY_SOURCES kivétellistán', () => {
    const missing = [...usedSources].filter((s) => SOURCE_EN[s] === undefined && !CODE_ONLY_SOURCES.has(s));
    expect(missing).toEqual([]);
  });

  it('a CODE_ONLY_SOURCES lista minden eleme ténylegesen előfordul a katalógusban (nincs elavult bejegyzés)', () => {
    const stale = [...CODE_ONLY_SOURCES].filter((s) => !usedSources.has(s));
    expect(stale).toEqual([]);
  });

  it('minden jelenleg használt note-szöveghez van angol fordítás', () => {
    const missing = [...usedNotes].filter((n) => NOTE_EN[n] === undefined);
    expect(missing).toEqual([]);
  });
});

describe('katalógus name szórész-fordítás (NAME_PHRASE_EN) — teljesség-ellenőrzés', () => {
  const allEntries = [...MATERIALS, ...SECTIONS];

  it('egyik katalógus-névben sem marad ismert magyar szórész angol nyelvre fordítás után', () => {
    // Ha ez elbukik: vagy egy ÚJ magyar szórész jelent meg egy katalógus-névben
    // (pótolni kell NAME_PHRASE_EN-ben), vagy a helyettesítési sorrend hibás
    // (pl. "Kör" előbb cserélődik, mint "Körgyűrű").
    const leftovers = allEntries
      .map((e) => catalogName(e.name, 'en'))
      .filter((translated) => NAME_PHRASE_EN.some(([hu]) => translated.includes(hu)));
    expect(leftovers).toEqual([]);
  });
});
