# ADR-0010 — TypeScript a mag nyelve, Rust/WASM tudatosan nyitva hagyva

**Dátum:** 2026-08-22 · **Státusz:** elfogadva · **Érinti:** P0, P16

## Kontextus

A MASTER-PROMPT-TERV (2.1 pont) a projekt indulásakor két életképes utat
vázolt fel a `fem-core` nyelvére: egy TypeScript-alapú monorepót (pnpm
workspace, Zod séma-validáció, böngészőben futó UI), vagy natív numerikus
teljesítményt igénylő nagy modellekhez a mag Rust→WASM portolását, azonos
interfésszel. A terv (2.1, 64. sor) kifejezetten úgy készült, hogy **ez a
döntés később is meghozható legyen** — azaz a P0 fázisban nem kellett
véglegesen lezárni a kérdést, csak olyan architektúrát választani, amely nem
zárja ki a WASM-utat.

## Döntés

A `fem-core` (és az összes csomag: `fem-db`, `fem-validation`, `ui`)
**TypeScript**-ben készül, pnpm workspace monorepóban. A Rust/WASM-portolás
NEM indul el ebben a projektben — sem P0-ban, sem a P16
teljesítmény-fázisban (ld. [ADR-0009](0009-p16-teljesitmeny-profilozas.md)).

## Indoklás

1. **A célközönség és a fő elfogadási kritérium mérnöki hitelesség, nem
   nyers teljesítmény.** A projekt egy 1996-os diplomaterv szoftverének
   rekonstrukciója — a hangsúly a numerikus eredmények bizonyítható
   helyességén (validációs suite, 1e−9…1e−12 relatív tűrések) és a
   diplomatervvel való megfeleltethetőségen van, nem a nagy modellek
   feldolgozási sebességén.
2. **A böngészőben futó, kliens-oldali UI** (nincs backend, a számítás a
   felhasználó gépén, a `useLiveResult` hook-on keresztül fut) TypeScript-tel
   egyetlen nyelven, egyetlen build-lánccal valósítható meg — a Zod-sémák
   (`model/schema.ts`) egyszerre adnak futásidejű validációt ÉS statikus
   típust, amit egy Rust/WASM határ (FFI, szerializáció) csak
   többletköltséggel tudna reprodukálni.
3. **A P16 fázis MÉRÉSSEL igazolta, hogy a WASM ma nem indokolt** (ld.
   ADR-0009): a szélsőséges, stressz-teszt méretskálán (5000 DOF, 32 réteg,
   100 lépés) is csak ~10.5 s a futásidő, miközben a ténylegesen az UI-ból
   elérhető legnagyobb modell (48 elem, 16 réteg) ~300 ms alatt fut le — a
   felhasználó a gyakorlatban SOSEM találkozik a WASM-ot indokoló méretű
   modellel.
4. **Az architektúra nem zárja ki a WASM-utat**, ha a jövőben mégis
   szükségessé válna: a `fem-core` publikus API-ja (tiszta függvények,
   `Model`/`LinearResult`/`NonlinearRun` típusok, nincs mutáció, nincs
   osztályhierarchia a határfelületen) olyan, hogy egy jövőbeli WASM-port
   (pl. a REFORB réteg-visszavetítő hurokra, ami tisztán skaláris,
   elágazásos aritmetika — jó WASM-jelölt) a jelenlegi TypeScript-függvények
   drop-in cseréjeként illeszthető be, a hívó kód (UI, validáció) érintése
   nélkül.

## Alternatíva, amit tudatosan NEM választottunk

Rust→WASM a `fem-core` teljes magjára, JS/TS csak a UI rétegben. Elvetve,
mert: (a) a P16 mérés szerint nincs teljesítmény-kényszer erre; (b) egy
FFI-határ (JS↔WASM adatátadás minden `solveLinear`/`runLoadStepper`
híváskor) fejlesztési és tesztelési komplexitást adna hozzá anélkül, hogy
mérhető hasznot hozna a jelenlegi méretskálán; (c) a diplomaterv eredeti
1996-os megvalósítása is egyetlen nyelven (feltehetően Pascal/Fortran/C,
nem több nyelvű rendszer) készült — a TypeScript-only architektúra ennek a
egyszerűségnek felel meg jobban.

## Következmények

- A `fem-core` marad tisztán TypeScript, nincs natív függőség, nincs
  build-lánc-bővítés (`wasm-pack`, `wasm-bindgen` stb.).
- Egy jövőbeli WASM-port explicit, nyitott tételként szerepel a
  STATUS_REPORT.md-ben (ld. ADR-0009 Következmények) — nem hallgatjuk el,
  de nem is erőltetjük bele ebbe a projektbe.
- Ha a jövőben mégis felmerülne, a belépési pont egyértelmű: a
  `solver/materialState.ts` `updateGaussPointState()`/`updateLayerPlasticState()`
  hívási lánc — ez a P16 mérés szerint a domináns költség, és tisztán
  szkalár-aritmetikai, WASM-barát kód.
