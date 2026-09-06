# Contributing to FEM@ti

*[Magyarul lentebb](#közreműködés-magyarul)*

Thanks for looking. A few honest notes before you invest time.

## What this project is

A single-developer reimplementation of a 1996 BME structural-engineering thesis as a
modern, browser-based finite element program. The bar for changes to the mechanical
core is deliberately high: **every formula must be traceable to a source**, and every
mechanical claim must be backed by a test against a closed-form or hand-calculated
reference. See [`docs/THEORY.md`](docs/THEORY.md) and
[`docs/VALIDATION-SCOPE.md`](docs/VALIDATION-SCOPE.md).

Most of the deeper documentation and the source comments are in **Hungarian**. The
application UI and the main README are bilingual (HU/EN).

## Getting set up

Requirements: **Node.js ≥ 20**, **pnpm 10** (after `corepack enable` the pinned version
is picked up automatically).

```bash
pnpm install
pnpm --filter @femati/ui dev     # dev server on http://localhost:5173
pnpm check                       # typecheck + lint + tests, all 4 packages
pnpm build                       # production build
```

`pnpm check` is what CI runs. If it passes locally, CI should pass too.

## Before you open a pull request

1. **`pnpm check` must pass.** No exceptions.
2. **Add a test for behavior you change.** For a bug fix, write the test that *fails*
   before your fix first — that proves the test actually guards the behavior.
3. **Don't raise a tolerance to make a test pass.** This is explicitly forbidden by
   [`docs/HIBATURESI-POLITIKA.md`](docs/HIBATURESI-POLITIKA.md). If a numerical test
   fails, the number is telling you something.
4. **Touching the mechanics?** Cite your source (standard, paper, textbook, page and
   equation). "It looks right" is not a source. If you deliberately depart from the
   thesis, add an ADR under [`docs/ADR/`](docs/ADR).
5. **Keep the diff focused.** Don't reformat unrelated files.

## Conventions worth knowing

- **Design tokens:** no raw hex colors in components — `pnpm lint` enforces this
  (`scripts/check-design-tokens.mjs`), as does a dead-CSS check.
- **i18n:** user-facing strings live in `packages/ui/src/i18n/` as `Record<Lang, T>`
  dictionaries, so TypeScript refuses to compile if a translation is missing. Don't
  hardcode display text (including `aria-label`s) in components.
- **`STATUS_REPORT.md`** is the running development log. It goes in its **own commit**,
  never bundled with a feature commit.
- **`docs/VALIDATION.md` is generated** — regenerate with
  `pnpm --filter @femati/fem-validation test`, never edit by hand.

## Reporting a bug

Open an [issue](https://github.com/banyaattila-crypto/FEMAti/issues) with what you did,
what happened, what you expected — and if it's a numerical result, the model (the
`.femati.json` file) and the number you expected instead.

**A wrong engineering result is the highest-priority bug class in this project.**

For security problems, see [`SECURITY.md`](SECURITY.md) — please don't use a public issue.

## Realistic expectations

This is maintained by one person alongside a full-time job. Issues and PRs may take a
while. Large unsolicited PRs that redesign core architecture are unlikely to be merged —
please open an issue to discuss first.

---

# Közreműködés (magyarul)

## Mi ez a projekt

Egy 1996-os BME diplomaterv egyszemélyes újraimplementációja modern, böngészőben futó
végeselemes programként. A mechanikai magot érintő változtatás mércéje szándékosan
magas: **minden képletnek forrásra visszavezethetőnek kell lennie**, és minden
mechanikai állítást zárt alakú vagy kézzel számolt referencia elleni teszt támaszt alá.
Ld. [`docs/THEORY.md`](docs/THEORY.md) és
[`docs/VALIDATION-SCOPE.hu.md`](docs/VALIDATION-SCOPE.hu.md).

## Indulás

Követelmény: **Node.js ≥ 20**, **pnpm 10** (`corepack enable` után a rögzített verzió
automatikusan érvényesül).

```bash
pnpm install
pnpm --filter @femati/ui dev     # dev szerver: http://localhost:5173
pnpm check                       # típusellenőrzés + lint + tesztek, mind a 4 csomag
pnpm build                       # produkciós build
```

A CI pontosan a `pnpm check`-et futtatja.

## Pull request előtt

1. **A `pnpm check` menjen át.** Kivétel nincs.
2. **Írj tesztet arra, amit megváltoztatsz.** Hibajavításnál ELŐBB írd meg azt a
   tesztet, ami a javítás nélkül **bukik** — ez bizonyítja, hogy a teszt tényleg őrzi a
   viselkedést.
3. **Ne emelj toleranciát azért, hogy egy teszt átmenjen.** Ezt a
   [`docs/HIBATURESI-POLITIKA.md`](docs/HIBATURESI-POLITIKA.md) kifejezetten tiltja.
4. **Mechanikához nyúlsz?** Hivatkozz forrást (szabvány, cikk, tankönyv, oldal- és
   egyenletszámmal). Ha tudatosan eltérsz a diplomatervtől, írj ADR-t a
   [`docs/ADR/`](docs/ADR) alá.
5. **Tartsd fókuszáltan a diffet.** Ne formázz át nem érintett fájlokat.

## Konvenciók

- **Design tokenek:** nincs nyers hex-szín a komponensekben — a `pnpm lint` ezt
  gépiesen ellenőrzi, ahogy a halott CSS-t is.
- **i18n:** a felhasználónak szóló szövegek a `packages/ui/src/i18n/`-ben élnek
  `Record<Lang, T>` szótárakként, így a TypeScript nem fordít le hiányzó fordítást. Ne
  égess be megjelenő szöveget (`aria-label`-t sem) komponensbe.
- **`STATUS_REPORT.md`**: a fejlesztési napló, mindig **külön commitban** megy.
- **`docs/VALIDATION.md` generált** — `pnpm --filter @femati/fem-validation test`
  állítja elő, kézzel ne szerkeszd.

## Hibabejelentés

Nyiss [issue-t](https://github.com/banyaattila-crypto/FEMAti/issues): mit csináltál, mi
történt, mit vártál — numerikus eredménynél a modellel (`.femati.json`) és a várt
számmal együtt. **A téves mérnöki eredmény ebben a projektben a legmagasabb prioritású
hibaosztály.** Biztonsági problémára ld. [`SECURITY.md`](SECURITY.md).
