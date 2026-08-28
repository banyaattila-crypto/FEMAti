# UI-REVIEW-CHECKLIST — önellenőrzés minden nagyobb UI-batch commit előtt

**Miért létezik ez a dokumentum:** az önellenőrzés ("nézzük át sorról-sorra
a saját kódunkat") eddig mindig KÉRÉSRE, utólag történt — ld.
`STATUS_REPORT.md` 23. pont. Ez a lista a FOLYAMATOT teszi tervezetté, nem
csak a végeredményt: minden nagyobb UI-módosítást tartalmazó commit előtt
végig kell menni rajta (Claude-nak magától, kérés nélkül is), nem csak
amikor a felhasználó külön kéri.

**Mi számít "nagyobb UI-batch"-nek?** Több fájlt érintő, vagy vizuálisan
érdemi (új komponens, layout-váltás, szín-/tipográfia-módosítás) commit a
`packages/ui` alatt. Egy elgépelés-javítás vagy egyetlen szöveg módosítása
nem igényli a teljes listát.

---

## 1. Nyers hex-szín ellenőrzése

- **Automatikus:** `pnpm lint:tokens` (a `pnpm lint` és a CI része is).
- Ha buktat: vagy `var(--token)`-re kell cserélni, vagy — ha tudatos
  kivétel — fel kell venni a `scripts/check-design-tokens.mjs`
  `ALLOWED_FILES` listájára, indoklással (ld. `docs/UI-CONVENTIONS.md` 1.
  pont).

## 2. Halott CSS ellenőrzése

- **Automatikus:** `pnpm lint:dead-css` (a `pnpm lint` és a CI része is) —
  `scripts/check-dead-css.mjs`, minden `.vem-`-előtagú osztályra.
- **Fontos korlát:** heurisztika, nem tökéletes statikus elemzés — a
  dinamikusan összefűzött osztálynevekre (pl. `` `vem-status--${cls}` ``)
  téves pozitívat adna; ezeket a `scripts/check-dead-css.mjs`
  `DYNAMIC_PREFIXES` listája zárja ki explicit módon. Egy ÚJ dinamikus
  családot csak ide felvéve szabad bevezetni.
- Ha buktat, és NEM dinamikus konstrukcióról van szó: a szabály valóban
  halott — töröld. (Első futáskor 3 valódi holt osztályt és 2 hibásan
  megírt szelektort talált — ld. `STATUS_REPORT.md` 32. pont.)

## 3. Token-lefedettség (ami az 1. pontnál TÖBB)

A nyers hex-ellenőrzés csak a `#rrggbb` alakot fogja. Kézzel is nézd át:

- Van-e **nyers `rgb(...)`/`hsl(...)`** literál, ami valójában egy
  meglévő tokennek felelne meg (pl. `rgba(0, 0, 0, 0.45)` helyett
  `var(--shadow-flood)`)? Kivétel: az overlay-panelek háttér-elhalványítása
  (`rgba(20, 20, 20, 0.55)`) — ez SZÁNDÉKOSAN nem token, mert minden
  overlay ugyanazt az egyedi, csak erre a célra használt értéket ismétli
  (ld. `docs/UI-CONVENTIONS.md` 3. pont, overlay-minta).
- Ha egy ÚJ szín/méret 2+ helyen ismétlődik, vagy UI-jelentést hordoz →
  vedd fel tokenként (ld. `docs/UI-CONVENTIONS.md` 1. pont "Mikor kell új
  tokent felvenni").

## 4. Kontraszt (manuális — nincs automatizálva)

- Minden ÚJ szöveg/felszín-párra: a szöveg olvasható-e a sötét alapon?
  Ökölszabály — `--text-muted`/`--text-faint` KIZÁRÓLAG másodlagos
  (címke, jegyzet) szövegre, sosem elsődleges tartalomra.
- Ha egy új dekoratív elem (gradiens, árnyék) szöveg FÖLÉ kerül
  (`background-clip: text` + `text-shadow`/`filter`), böngészőben
  ellenőrizd (DOM `getComputedStyle`, ha screenshot nem elérhető), hogy a
  szöveg ténylegesen olvasható marad — ld. a "dombornyomott felirat"
  körüli iterációt (STATUS_REPORT.md 27. pont: az első próbálkozás túl
  zsúfolt lett, csak élő ellenőrzéssel derült ki).

## 5. Egyéb, gyors átfutásra érdemes pontok

- Új overlay/modális nézet? → követi-e a `docs/UI-CONVENTIONS.md` 3.
  pontjában leírt mintát (Escape a központi listenerben, `onPointerDown`
  stop-propagation, `historical/HistoricalView.tsx` mint referencia)?
- Új megjelenő szám? → `format/numbers.ts`-en át megy, nem közvetlen
  `toFixed()`?
- CSS-osztály `className`-ként ténylegesen ARRA az elemre kerül, amire a
  szelektor íródott — a `.vem-meshconv td--error`-hibát (hiányzó pont a
  `td--error` elől, ami egy nemlétező HTML-tagot célzott, sosem a
  `<td className="...">`-t) épp a 2. pont automatikus ellenőrzése fogta
  meg, de ez jó emlékeztető: egy MANUÁLISAN átírt osztálynév-string
  könnyen elgépelhető anélkül, hogy bármi hibát dobna.

---

## Frissítési napló

| Dátum | Változás |
|---|---|
| 2026-08-25 | Létrehozva — `scripts/check-dead-css.mjs` automatikus ellenőrzéssel egyidejűleg. Az első futás 3 valódi holt osztályt (`.vem-field`, `.vem-sr-only`, `.vem-panel__body`) és 2 hibásan megírt szelektort (`.vem-meshconv td--error`/`td--rel-ok`, hiányzó pont) talált — mindegyik javítva. |
