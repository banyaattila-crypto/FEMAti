#!/usr/bin/env node
/**
 * Design-token fegyelem ellenőrzése — a `packages/ui` alatt SEHOL nem
 * szerepelhet nyers hex-szín-literál (`#rgb`, `#rgba`, `#rrggbb`,
 * `#rrggbbaa`), amíg nincs KIFEJEZETTEN felvéve az alábbi
 * `ALLOWED_FILES` listára, dokumentált indoklással. Ld. `docs/UI-
 * CONVENTIONS.md` 1. pont.
 *
 * Ez a szabály korábban csak szóban/session-emlékezetben élt — pont ezért
 * csúszott be észrevétlenül egy `#000` a `marks.tsx`-be (csak külön
 * felhasználói kérésre, egy "nézd át a saját kódunkat" önellenőrzésnél
 * derült ki). Ez a szkript teszi gépileg kikényszeríthetővé, amit eddig
 * csak dokumentáció ígért.
 *
 * Miért külön szkript, nem ESLint-szabály vagy stylelint? Az ESLint
 * alapból nem elemez `.css` fájlokat, egy dedikált stylelint-függőség
 * felvétele pedig a projekt méretéhez képest túlsúlyos lenne (ld.
 * `karpathy-iranyelvek`: minimalizmus). Egy egyszerű, célzott
 * regex-ellenőrzés — függőség nélkül — elegendő.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const UI_SRC = join(ROOT, 'packages/ui/src');
const SCANNED_EXTENSIONS = ['.css', '.tsx', '.ts'];

/**
 * Fájlok, ahol a nyers hex TUDATOS, dokumentált kivétel — mindegyikhez
 * tartozik egy fejléc-komment MAGÁBAN A FÁJLBAN is, ami ugyanezt
 * elmagyarázza. Egy ÚJ kivételt csak ide, EXPLICIT módon felvéve szabad
 * bevezetni — soha nem "csak úgy" egy komponensbe írva.
 */
const ALLOWED_FILES = new Set([
  // A tokenek DEFINÍCIÓS helye — ez az egyetlen fájl, ami magát a sötét
  // CAE-munkaasztal palettáját rögzíti.
  'packages/ui/src/design/tokens.css',
  // Önálló, papírra szánt fekete-fehér nyomtatási stílusok — SZÁNDÉKOSAN
  // NEM a munkaasztal sötét palettáját használják (egy printelt/PDF
  // oldalnak a témától függetlenül olvashatónak kell maradnia). Saját,
  // helyi (`--der-*`/`--report-*`) egyedi tulajdonságokban vannak
  // rögzítve, a fájl saját fejléc-kommentje is ezt dokumentálja.
  'packages/ui/src/derivation/derivation.css',
  'packages/ui/src/report/report.css',
  // Numerikus "jet" kontúr-színskála (0=kék..1=piros) — a hex értékeket a
  // `hexToRgb()` PARSZOLJA lineáris interpolációhoz, ezért ezek
  // matematikailag nem lehetnek `var()` string-ek, csak literál hex-számok.
  // 2026-08-29: a `Beam3DStress.tsx`-ből kiemelve `colormap.ts`-be, hogy a
  // fő M/T/w/φ diagramok (`DiagramChart.tsx`) is ugyanezt a skálát
  // használhassák — a színskála MOST már innen, egyetlen helyről ered.
  'packages/ui/src/charts/colormap.ts',
]);

const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;
const VALID_LENGTHS = new Set([3, 4, 6, 8]);

function listFiles(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...listFiles(full));
    } else if (SCANNED_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

function findViolations(filePath) {
  const relPath = relative(ROOT, filePath).replace(/\\/g, '/');
  if (ALLOWED_FILES.has(relPath)) return [];

  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  lines.forEach((line, index) => {
    for (const match of line.matchAll(HEX_PATTERN)) {
      const hexDigits = match[0].length - 1;
      if (!VALID_LENGTHS.has(hexDigits)) continue;
      violations.push({ file: relPath, line: index + 1, match: match[0] });
    }
  });

  return violations;
}

const files = listFiles(UI_SRC);
const allViolations = files.flatMap(findViolations);

if (allViolations.length > 0) {
  console.error('Nyers hex-szín-literál található a design-token szabály megsértésével:\n');
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line} — ${v.match}`);
  }
  console.error(
    '\nMinden színnek a design/tokens.css CSS custom property-in (`var(--...)`) kell átfutnia.' +
      '\nHa ez egy TUDATOS kivétel (pl. nyomtatási stílus vagy numerikus színskála), vedd fel a fájlt' +
      '\na scripts/check-design-tokens.mjs ALLOWED_FILES listájára, dokumentált indoklással.',
  );
  process.exit(1);
}

console.log(`Design-token ellenőrzés: ${files.length} fájl vizsgálva, nincs nyers hex-szín.`);
