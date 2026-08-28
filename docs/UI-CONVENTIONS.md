# UI-CONVENTIONS — a `packages/ui` rögzített felületi konvenciói

**Státusz:** utólag pótolva, egy self-review-n talált hiányosság nyomán (ld.
`STATUS_REPORT.md` 23. pont: egy nyers `#000` észrevétlenül bekerült a
`marks.tsx`-be, mert ez a szabály eddig csak szóban/session-emlékezetben
élt, nem volt sem leírva, sem gépileg kikényszerítve).

Ez a dokumentum a `docs/CONVENTIONS.md` UI-megfelelője: az a `fem-core`
mérnöki/matematikai konvencióit rögzíti, ez a felület vizuális/architekturális
konvencióit.

**Kapcsolódó dokumentum:** [`docs/UI-REVIEW-CHECKLIST.md`](UI-REVIEW-CHECKLIST.md)
— a folyamat, ami minden nagyobb UI-batch commit előtt végigmegy ezen a
szabálykészleten (automatikus + manuális pontok).

---

## 1. Design-tokenek — nincs nyers hex

**A komponensek soha nem írnak be nyers hex-értéket.** Minden szín a
[`design/tokens.css`](../packages/ui/src/design/tokens.css) CSS custom
property-in (`var(--...)`) keresztül érkezik — a szín JELENTÉSE egy helyen
van definiálva, nem szétszórva.

Ez **SVG presentation attribútumokra is** vonatkozik (`fill`, `stroke`,
`flood-color`, `stop-color` stb.) — ezek modern böngészőkben helyesen
feloldják a `var(--token)`-t, ld. `canvas/marks.tsx`.

### Dokumentált kivételek

Egy ÚJ kivételt csak explicit módon, indoklással szabad bevezetni — ehhez a
fájlt fel kell venni a [`scripts/check-design-tokens.mjs`](../scripts/check-design-tokens.mjs)
`ALLOWED_FILES` listájára is, KOMMENTTEL, hogy miért indokolt. Jelenlegi
kivételek:

| Fájl | Miért kivétel |
|---|---|
| `design/tokens.css` | Ez maga a tokenek DEFINÍCIÓS helye. |
| `derivation/derivation.css`, `report/report.css` | Önálló, papírra szánt fekete-fehér nyomtatási stílusok — SZÁNDÉKOSAN NEM a munkaasztal sötét CAE-palettáját használják (egy nyomtatott/PDF oldalnak a témától függetlenül olvashatónak kell maradnia). Saját, helyi (`--der-*`/`--report-*`) custom property-kben rögzítve. |
| `charts/Beam3DStress.tsx` | Numerikus "jet" kontúr-színskála — a hex értékeket a kód `hexToRgb()`-vel PARSZOLJA lineáris interpolációhoz, ezért matematikailag nem lehetnek `var()` string-ek. |

- **Automatikus ellenőrzés:** `pnpm lint:tokens` (a `pnpm lint` és a CI
  "Design-token ellenőrzés" lépésének is része) — végigfut a
  `packages/ui/src` minden `.css`/`.tsx`/`.ts` fájlján, és hibával bukik,
  ha nem-engedélyezett fájlban nyers hex-mintát talál (`#rgb`, `#rgba`,
  `#rrggbb`, `#rrggbbaa`).
- **Teszt:** nincs dedikált Vitest-teszt — ez egy build-idejű/CI-szkript,
  nem futásidejű logika; a `pnpm check`/CI önmagában a bizonyíték.

### Elnevezési konvenció

A [`design/tokens.css`](../packages/ui/src/design/tokens.css) prefix szerint
csoportosít, mindegyik EGY jelentés-kategóriát fed — új tokent mindig a
megfelelő csoportba, a meglévő elnevezési mintát követve kell felvenni:

| Prefix | Jelentés | Példa |
|---|---|---|
| `--surface-*` | Háttérfelületek (app, chrome, panel, canvas, hover...). | `--surface-panel` |
| `--border-*` | Szegélyek, elválasztó vonalak. | `--border-subtle` |
| `--text-*` | Szövegszínek — `-on-chrome`/`-on-accent` az adott felületre kontraszt-optimalizált változat. | `--text-muted` |
| `--accent-*` | Az app EGYETLEN "élő", állapotfüggetlen UI-kiemelő színe (türkiz) — interaktív elemek, fókusz, "kész" állapot. | `--accent-hover` |
| `--brand-gold-*` | KIZÁRÓLAG márka-/hero-kiemelésre fenntartott arany-család (elsődleges gomb, dísz cím-tipográfia) — "ez fontos, ide nézz", NEM UI-állapot. | `--brand-gold-2` |
| `--sem-*` | SZEMANTIKUS, MECHANIKAI jelentéssel bíró színek (rugalmas/részben képlékeny/képlékeny, teher, támasz...) — ha egy szín egy mechanikai állapotot kódol, mindig ide tartozik, soha nem `surface-*`/`accent-*`. | `--sem-plastic` |
| `--catalog-*` | Dekoratív, VALÓDI ANYAGOT idéző színek a Szelvény/Anyag katalógus-combobox opcióihoz (acél/alumínium/beton/fa) — NEM mechanikai állapot, ezért nem `--sem-*`, még akkor sem, ha egy érték véletlenül közel esne egy szemantikus tónushoz. | `--catalog-steel` |
| `--font-*` | Betűcsaládok. | `--font-serif` |
| `--type-*` | Tipográfiai méret/súly/tracking-lépték. | `--type-body-size` |
| `--space-*` | Térköz-lépték (1–8, NEM px-ben gondolkodunk, hanem lépcsőben). | `--space-5` |
| `--radius-*` | Sarok-lekerekítés. | `--radius-md` |
| `--shadow-*` | Árnyékok — `box-shadow`-érték ÉS SVG `flood-color` (önálló szín, mert a `flood-color` attribútum csak egy színt fogad, nem teljes `box-shadow`-t) külön tokenben. | `--shadow-flood` |
| `--motion-*`, `--ease` | Animáció-időzítés/görbe. | `--motion-panel` |
| `--h-*`, `--w-*` | Fix layout-méretek (panel szélesség, fejléc magasság). | `--w-panel-left` |

### Mikor kell új tokent felvenni

1. **Nézd át előbb, van-e már szemantikailag megfelelő token.** Ne hozz
   létre közel-duplikátumot (pl. ne vegyél fel egy `--accent-2`-t, ha az
   `--accent-hover` ugyanazt a szerepet töltené be) — ez pont az a
   szétforgácsolódás, amit a tokenrendszer meg akar előzni.
2. **Új globális token akkor indokolt**, ha egy szín/méret UI-JELENTÉST
   hordoz, és több komponensben használatos vagy ésszerűen újrafelhasználható
   — ilyenkor a megfelelő prefix-családba, a `tokens.css` megfelelő
   kommentezett blokkjába kerül.
3. **NEM globális token, hanem dokumentált kivétel**, ha az érték
   kizárólag egyetlen, jól indokolt, ÖNÁLLÓ kontextushoz kötött (pl. egy
   nyomtatási stílus saját, helyi `--der-*`/`--report-*` custom
   property-je, vagy egy numerikus, kódban parszolt színskála) — ez esetben
   a fenti "Dokumentált kivételek" táblázat és a
   `scripts/check-design-tokens.mjs` `ALLOWED_FILES` listája a helyes hely,
   NEM a globális `tokens.css`.
4. **Szemantikus (`--sem-*`) szín soha nem UI-dekoráció** — ha egy adott
   szín egy mechanikai állapotot (rugalmas/képlékeny/teher/támasz) kódol,
   mindig `--sem-*`-ként kerül be, még akkor is, ha vizuálisan egyezne egy
   meglévő `--accent-*`/`--brand-gold-*` értékkel — a kettő JELENTÉSBEN tér
   el, nem csak színben (ld. `--sem-deformed` és `--accent` jelenleg azonos
   hex-értéke: ez véletlen egybeesés, nem ok arra, hogy összevonjuk őket).

---

## 2. Egyetlen, fix sötét paletta

A `DESIGN-TERV.md` 2. fejezete szerint a UI EGYETLEN palettát használ (B —
Sötét CAE-munkaasztal). **Nincs témaváltás, nincs `prefers-color-scheme`
ág.** Ha valaha felmerül a világos téma igénye, az külön ADR-t igényel — nem
egyszerű token-átírás, mert a jelenlegi kontraszt-arányok (szöveg/felszín)
kifejezetten a sötét háttérre vannak hangolva.

---

## 3. Overlay-panel architektúra

A modális/overlay nézetek (Jegyzőkönyv, Levezetés, Történelmi mód, Elmélet,
Hálófüggetlenségi vizsgálat) mind UGYANAZT a mintát követik:

- `<div className="vem-X-overlay" onPointerDown={close}>` — teljes képernyős,
  félig áttetsző (`rgba(20, 20, 20, 0.55)`) háttér, kattintásra bezár.
- `<div className="vem-X" onPointerDown={(e) => e.stopPropagation()}>` — a
  tényleges panel, `width: min(<Npx>, calc(100vw - 32px))`, `background:
  var(--surface-raised)`, `box-shadow: var(--shadow-menu)`.
- Nyitás/zárás állapota a `state/appStore.ts`-ben (`XOpen: boolean` +
  `setXOpen`), Escape-kezelés az `App.tsx` egyetlen központi
  `keydown`-listenerében (nem a panel komponensében).
- A legegyszerűbb, másolható referenciapélda: `historical/HistoricalView.tsx`
  + `historical.css`.

---

## 3/A. Mikor `Select` (natív), mikor `Combobox` (saját)?

Két legördülő-komponens létezik ([`components/Field.tsx`](../packages/ui/src/components/Field.tsx)
`Select` és [`components/Combobox.tsx`](../packages/ui/src/components/Combobox.tsx)
`Combobox`) — TUDATOSAN nem egyesítve:

- **`Select` (natív `<select>`)**: az alapértelmezett. Egyszerű, sok
  elemet olvasó képernyőolvasóval is jól kezelhető, nulla saját
  billentyűzet-logika. Használd, ha az opcióknak NINCS szükségük valódi
  ikonra/színre (csak szöveg, esetleg `SelectOption.group`/`color`, amit a
  natív `<optgroup>`/`style.color` már fed).
- **`Combobox` (saját `role="listbox"` widget)**: KIZÁRÓLAG akkor, ha
  valódi grafikai elem (SVG-ikon, színes swatch) kell opciónként — ezt a
  natív `<option>` NEM tudja megjeleníteni. A felhasználó kifejezett
  visszajelzése után jött létre: az első próbálkozás a `Select`-et
  Unicode-glifás szöveg-előtaggal próbálta "ikonossá" tenni, ami
  "kézzel rajzoltnak" hatott (ld. STATUS_REPORT.md 33-34. pont) — a
  natív widget ezt a problémát ELVBEN nem tudja megoldani, ezért kellett
  saját komponens.
  - Ára: saját billentyűzet-kezelés (nyilak, Enter, Escape — ld.
    `Combobox.tsx`, a `MenuBar.tsx` mintáját követve), saját ARIA
    (`role="listbox"`/`"option"`, `aria-selected`, `aria-expanded`).
  - Jelenlegi használat: `Toolbar.tsx` Szelvény/Anyag mezői
    (`data/catalogIcons.tsx` — alak szerinti SVG-ikon szelvénynél, valódi
    anyagszínű kör-swatch anyagnál).
  - ÚJ `Combobox`-használat előtt mérlegeld, tényleg kell-e a grafika —
    ha nem, marad a natív `Select`.

---

## 4. Számformázás

**Egyetlen hely, ahol szám szöveggé alakul:** [`format/numbers.ts`](../packages/ui/src/format/numbers.ts).
A komponensek nem hívnak `toFixed`-et közvetlenül — minden megjelenő
mennyiséghez (`fmt.deflection`, `fmt.moment`, `fmt.percent` stb.) itt van a
szabály, a diplomaterv 3. táblázata (mértékegység-választás) szerint.

---

## 5. Frissítési napló

| Dátum | Változás |
|---|---|
| 2026-08-25 | Létrehozva — a design-token szabály leírása + `scripts/check-design-tokens.mjs` automatikus ellenőrzés (korábban csak szóban élt a szabály). |
| 2026-08-25 | Kiegészítve: elnevezési konvenció (prefix-táblázat) + "mikor kell új tokent felvenni" iránymutatás — az eredeti terv (design-pontszám 8→9.5 beszélgetés) e két pontja korábban lemaradt. |
