#!/usr/bin/env node
/**
 * Halott (sehol nem hivatkozott) CSS-osztályok ellenőrzése a `packages/ui`
 * alatt. Ld. `docs/UI-REVIEW-CHECKLIST.md` 2. pont — ez pontosan az a
 * hibaosztály, ami a `.vem-tool-groups` esetében észrevétlenül bennragadt
 * egy self-review-ig (ld. `STATUS_REPORT.md` 23. pont).
 *
 * Módszer: minden `.css` fájlból kigyűjti a `vem-` előtagú osztály-
 * SZELEKTOR-GYÖKEREKET (a `:`/`[`/térköz előtti részt — ez automatikusan
 * kizárja az álosztályokat/attribútum-szelektorokat, azok nem önálló
 * hivatkozások), majd megnézi, hogy az adott osztálynév TELJES SZÓKÉNT
 * (nem egy hosszabb, ugyanazzal kezdődő osztálynév RÉSZEKÉNT — pl.
 * `vem-toolbar` ≠ `vem-toolbar__cell`) szerepel-e bármelyik `.tsx`/`.ts`/
 * `.css` fájlban a definíciós szelektoron kívül. Ha sehol — halott.
 *
 * Miért csak a `vem-` előtagú osztályokra szűkítve? Mert a harmadik féltől
 * származó (pl. KaTeX: `.katex`, `.katex-display`) szelektorok a SAJÁT
 * osztályaink leszármazottjaiként jelennek meg (`.vem-formula .katex`), és
 * sosem szerepelnek szó szerint a mi JSX-ünkben (a KaTeX maga injektálja
 * őket) — ezek NEM halottak, csak a heurisztika téves pozitívat adna rájuk
 * `vem-` szűrés nélkül.
 *
 * Ez egy HEURISZTIKA, nem tökéletes statikus elemzés — dinamikusan
 * összefűzött osztálynevekre (pl. `` `vem-x--${variant}` ``) téves
 * pozitívat adhat. Ilyen esetben a hívó helyen a teljes literált (a
 * template literal `${}` nélküli részét) kell megkeresni, vagy a
 * konkrét változat-neveket kell közvetlenül használni.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const UI_SRC = join(ROOT, 'packages/ui/src');

function listFiles(dir, extensions) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listFiles(full, extensions));
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Hányszor szerepel `className` TELJES SZÓKÉNT (nem hosszabb név részeként) a szövegben. */
function countWholeWordOccurrences(content, className) {
  const pattern = new RegExp(`${escapeRegExp(className)}(?![A-Za-z0-9_-])`, 'g');
  return (content.match(pattern) ?? []).length;
}

const cssFiles = listFiles(UI_SRC, ['.css']);
const searchableFiles = listFiles(UI_SRC, ['.css', '.tsx', '.ts']);
const fileContents = new Map(searchableFiles.map((f) => [f, readFileSync(f, 'utf8')]));

/**
 * Osztálynév-CSALÁD-gyökerek, amiket TUDATOSAN template literallal (pl.
 * `` `vem-status--${cls}` ``) állít elő a kód — ezekre a heurisztika sosem
 * találna szó szerinti egyezést, ezért itt EXPLICIT módon kizárjuk őket az
 * ellenőrzésből. Egy ÚJ dinamikus családot csak ide felvéve szabad
 * bevezetni, a forráshelyre mutató kommenttel.
 */
const DYNAMIC_PREFIXES = [
  'vem-status--', // components/Feedback.tsx — `vem-status--${cls}`
  'vem-value--', // components/Value.tsx — `vem-value--${tone}`
  'vem-note--', // components/Feedback.tsx — `vem-note--${tone}`
  'vem-timeline__mark--', // shell/Timeline.tsx — `vem-timeline__mark--${m.kind}`
];

function isDynamicallyConstructed(className) {
  return DYNAMIC_PREFIXES.some((prefix) => className.startsWith(prefix));
}

/** Osztálynév → az őt DEFINIÁLÓ fájlok (abszolút útvonal) halmaza. */
const definedIn = new Map();

for (const file of cssFiles) {
  const content = fileContents.get(file) ?? '';
  for (const match of content.matchAll(/\.(vem-[a-zA-Z0-9_-]+)/g)) {
    const className = match[1];
    if (!definedIn.has(className)) definedIn.set(className, new Set());
    definedIn.get(className).add(file);
  }
}

const deadClasses = [];

for (const [className, definitionFiles] of definedIn) {
  if (isDynamicallyConstructed(className)) continue;
  // A `.vem-x` szelektor MAGA is egy találat abban a fájlban, ahol
  // definiálva van — ezt le kell vonni, hogy csak a TÉNYLEGES
  // hivatkozásokat (JSX className, más CSS-szelektor) számoljuk.
  let usedElsewhere = false;
  for (const [file, content] of fileContents) {
    const total = countWholeWordOccurrences(content, className);
    const definitionCount = definitionFiles.has(file) ? 1 : 0;
    if (total > definitionCount) {
      usedElsewhere = true;
      break;
    }
  }
  if (!usedElsewhere) {
    deadClasses.push({
      className,
      files: [...definitionFiles].map((f) => relative(ROOT, f).replace(/\\/g, '/')),
    });
  }
}

if (deadClasses.length > 0) {
  console.error('Feltehetően halott (sehol nem hivatkozott) CSS-osztályok:\n');
  for (const d of deadClasses) {
    console.error(`  .${d.className} — ${d.files.join(', ')}`);
  }
  console.error(
    '\nHa ez téves pozitív (pl. dinamikusan összefűzött osztálynév), ellenőrizd kézzel,' +
      '\nés ha valóban halott, töröld a CSS-szabályt. Ld. docs/UI-REVIEW-CHECKLIST.md 2. pont.',
  );
  process.exit(1);
}

console.log(`Halott CSS ellenőrzés: ${definedIn.size} egyedi .vem- osztály vizsgálva, nincs halott.`);
