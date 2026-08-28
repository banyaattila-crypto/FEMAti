# ADR-0003 — A mag SI-ben számol, a fájl mérnöki egységekben tárol

**Dátum:** 2026-08-20 · **Státusz:** elfogadva · **Érinti:** P1, minden modul

## Kontextus

A diplomaterv 3. táblázata (3.1.8 pont) mérnöki egységeket ír elő: terület
[cm²], inercia [cm⁴], modulus [kN/cm²], eltolódás [mm]. Ezeket a mérnök írja be
és olvassa le.

Ha a mag is ezekben számolna, minden képletbe átváltási tényezők kerülnének
(pl. `EI` = [kN/cm²]·[cm⁴] = kN·cm², ami nem illeszkedik a [kNm] nyomatékhoz).
Ez a leggyakoribb és legnehezebben észrevehető hibaforrás egy statikai
programban: az eredmény hihetőnek látszik, csak 10⁴-szer nagyobb.

## Döntés

**Két réteg, egyetlen átváltási ponttal:**

| Réteg | Egységek | Hol |
|---|---|---|
| `.femati.json` fájl | mérnöki (cm, cm², cm⁴, kN/cm², mm) | `model/schema.ts` |
| `Model` és a teljes mag | SI (m, m², m⁴, kN, kNm, kN/m²) | mindenhol máshol |
| Megjelenítés | mérnöki | `ui/format/numbers.ts` |

Az átváltás **kizárólag** a `units/convert.ts`-ben van implementálva, és
kizárólag két helyen hívódik: a séma be/kimenetén és a felület formázójában.

A mag mennyiségei **márkázott típusúak** (`Brand<number, 'kN'>`), így a
fordító megakadályozza a keveredést.

## Következmények

- A `.femati.json` ember számára olvasható és kézzel szerkeszthető marad.
- A körút nem bit-pontos (0.025 · 100 · 0.01 ≠ 0.025), csak 1e−12 relatív
  pontosságú. Ezt a teszt tudatosan tűréssel ellenőrzi, és külön teszt igazolja,
  hogy a **második** körút már bit-azonos (idempotencia).
- A `raw()` függvény kilépteti a márkázást — csak határfelületen használható.
