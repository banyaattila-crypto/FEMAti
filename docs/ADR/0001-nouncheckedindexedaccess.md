# ADR-0001 — A `noUncheckedIndexedAccess` kikapcsolása a `fem-core`-ban

**Dátum:** 2026-08-20 (2026-08-21-i kiegészítéssel) · **Státusz:** elfogadva · **Érinti:** P0, minden numerikus modul, P7 (ui)

## Kontextus

A MASTER-PROMPT-TERV P0 prompt előírja a `noUncheckedIndexedAccess` bekapcsolását, és
ugyanott tiltja a non-null assertion (`!`) operátort.

A két előírás a numerikus magban **kizárja egymást**. A flag a `Float64Array`
indexelést is `number | undefined` típusúvá teszi, így egy tipikus belső hurok

```ts
for (let i = 0; i < n; i++) s += a[i] * b[i];
```

fordítási hibát ad. A feloldás vagy `a[i]!` (tiltott), vagy elágazás minden
elemhozzáférésnél (a hot path-on értelmetlen), vagy getter-metódus (a JIT-nek
átlátszó, de a kódot olvashatatlanná teszi).

## Döntés

A `noUncheckedIndexedAccess` **ki van kapcsolva a `fem-core` és a `fem-validation`
csomagban**, és **be van kapcsolva az `ui` csomagban**.

Cserébe a magban:

1. Minden publikus belépési pont explicit dimenzió-ellenőrzést végez
   (`assertDim`, `assertIndex` a `linalg/errors.ts`-ben).
2. A skyline profilon kívüli írás `DimensionError`-t dob, nem ír némán rossz helyre.
3. A szinguláris pivot `SingularMatrixError`-t dob, nem `NaN`-t propagál.
4. Ezt teszt fedi (`linalg-skyline.test.ts` → „profil-tárolás", „szinguláris és
   indefinit esetek").

## Következmények

- **Előny:** a numerikus kód olvasható marad, és a hibakezelés ott van, ahol a
  hiba keletkezhet (a belépési pontokon), nem szétszórva minden elemhozzáférésnél.
- **Hátrány:** egy magon belüli indexhibát a fordító nem fog el. Ezt a
  mutációs próbával ellensúlyozzuk: öt szándékos LDLᵀ-hiba mindegyike elbukik a
  teszteken (2026-08-20-i mérés).
- **Az `ui` csomagban a flag EREDETILEG be volt kapcsolva** (2026-08-20), mert
  ott tömb- és objektumhozzáférés dominál, ahol a védelem valódi értéket ad.
  Ez a P7 fázisban (2026-08-21), amikor az `ui` ténylegesen importálni kezdte
  a `@femati/fem-core`-t, **helyesbítésre szorult**: a `fem-core` `package.json`-ja
  a NYERS forrást exportálja (`"types": "./src/index.ts"`, nincs épített
  `dist/*.d.ts` a monorepóban), ezért a TypeScript ugyanazzal a programmal
  fordítja a `fem-core` kódját is, mint az `ui`-t. Egy program compiler
  optionjei GLOBÁLISAK — nem fájlonkéntiek —, így az `ui`-ban bekapcsolt
  `noUncheckedIndexedAccess` a `fem-core` (ADR-0001 szerint SZÁNDÉKOSAN `!`
  nélkül, explicit `assertDim`-re építő) kódját is ez alá vonta, tucatnyi
  ál-hibát okozva (`packages/ui/tsconfig.json`, lásd az ott hagyott
  kommentet). **Az `ui` mostantól szintén `false`-ra állítja a flaget** — az
  UI SAJÁT kódja továbbra is védekezően ír (`?? `, explicit
  undefined-ellenőrzés), csak a fordító nem kényszeríti ki mindenhol.
