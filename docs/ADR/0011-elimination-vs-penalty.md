# ADR-0011 — Elimináció az alapértelmezett peremfeltétel-stratégia, penalty egyenrangú alternatíva

**Dátum:** 2026-08-22 · **Státusz:** elfogadva · **Érinti:** P2, P5

## Kontextus

A diplomaterv 3.1.7.3 pontja (44. oldal) a megkötött szabadságfokokat
elsősorban **kiküszöböléssel** (elimináció) kezeli — a megkötött DOF-ok
kimaradnak az egyenletrendszerből, a nem-nulla támaszmozgás hatása a
jobboldalra kerül át. A diplomaterv ugyanakkor megemlít egy alternatívát is:
a megkötést egy nagyon nagy rugóállandóval (**penalty**, ~10¹⁰ kN/m)
lehetne érvényesíteni anélkül, hogy a mátrix méretét/szerkezetét meg kellene
változtatni — ez a szövegben feltételes ("esetleg"), nem megerősített
implementációs részlet.

A `fem-core` mindkét stratégiát implementálja
(`assembly/assembler.ts`, `AssemblyOptions.strategy: 'elimination' | 'penalty'`),
és a P5 fázis validációs esete (V-11) kifejezetten a két stratégia
egyezőségét ellenőrzi.

## Döntés

Az **elimináció** az alapértelmezett és a produkciós stratégia (`solveLinear`,
`solveFrontal` mindkettő ezt használja alapból). A **penalty** egyenrangú,
explicit módon választható alternatívaként megmarad a kódban, elsősorban
validációs/hitelesítési célra.

## Indoklás

1. **Az elimináció numerikusan jobban kondicionált.** A penalty módszer a
   megkötés erősségét egy mesterséges, nagy diagonális taggal (`DEFAULT_PENALTY
   = 1e10` kN/m) éri el, ami a mátrix kondíciószámát rontja — a V-11 teszt
   szerint a két stratégia csak **1e−6 relatív tűréssel** egyezik (szemben az
   elimináció ÖNMAGÁBAN elérhető, gépi pontosság közeli hibájával más
   validációs eseteknél). A penalty-állandó megválasztása mindig kompromisszum
   a kondicionáltság (túl nagy érték → numerikus instabilitás) és a
   megkötés pontossága (túl kicsi érték → a "merev" támasz enged) között.
2. **Az elimináció kisebb rendszert old meg.** A megkötött DOF-ok teljesen
   kimaradnak az aktív egyenletrendszerből (`DofMap.activeIndex`) — ez
   kisebb `SkylineMatrix`-ot, gyorsabb faktorizációt jelent, különösen sok
   megtámasztású szerkezeteknél.
3. **A penalty implementációja megmarad**, mert: (a) a diplomaterv explicit
   megemlíti lehetséges alternatívaként, és a hitelesség szempontjából
   érdemes bemutatni; (b) egy KÜLÖN, független implementáció ugyanarra a
   fizikai eredményre a legjobb fajta regressziós teszt — ha a két stratégia
   szétválna, az szinte biztosan hibát jelezne valamelyik útban (ezt
   ténylegesen ki is használja a V-11 eset).

## Következmények

- `AssemblyOptions.strategy` alapértelmezése `'elimination'`
  (`assembler.ts`), a `SolveOptions.strategy` szintén.
- A V-11 validációs eset (`fem-validation/src/cases/v11-penalty-vs-elimination.ts`)
  örökre megmarad a suite-ban — ez az egyetlen hely, ahol a penalty-út
  ténylegesen le van tesztelve.
- Ha a jövőben egy harmadik stratégia (pl. Lagrange-multiplikátoros
  megkötés) merülne fel, ugyanide, a `ConstraintStrategy` unió-típushoz és
  az `assembler.ts`-hez kell csatlakoznia.
