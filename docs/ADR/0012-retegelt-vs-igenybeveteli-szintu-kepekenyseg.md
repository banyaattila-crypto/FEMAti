# ADR-0012 — Rétegelt (fiber) modell a fő út, igénybevétel-szintű modell megtartva

**Dátum:** 2026-08-22 · **Státusz:** elfogadva · **Érinti:** P9, P10, P12

## Kontextus

A diplomaterv (és vele a MASTER-PROMPT-TERV 1.7 pontja) **két**
rugalmas–képlékeny anyagmodellt ír le:

- **A) Nem-rétegelt (igénybevétel-szintű), 3.4.2** — a teljes keresztmetszet
  állapotát egyetlen `M`–`κ` (nyomaték–görbület) párral írja le, zárt alakú
  folyási feltétellel (`f = M² − M0²`) és zárt alakú (radial-return)
  visszavetítéssel.
- **B) Rétegelt (fiber), 3.4.3** — a keresztmetszetet `nL` rétegre bontja,
  minden réteg saját, egytengelyű `σ`–`ε` állapotot tart fenn (folyáshatár,
  keményedés, R-faktoros REFORB-visszavetítés), és a keresztmetszeti `M`/`Q`
  ezek összegzéséből adódik.

A diplomaterv és a mesterterv is **explicit kimondja: "B) ez a fő modell"**
(MASTER-PROMPT-TERV 1.7 pont, 189. sor) — a nem-rétegelt modell egy
egyszerűbb, korábban (történetileg is, a fejlesztés sorrendjében is: P9
előbb készült, mint P10) bevezetett, önmagában is validált alternatíva.

## Döntés

A **rétegelt (fiber) modell** (`material/layeredSection.ts`,
`material/elastoPlastic1D.ts`) a tényleges, éles út: ezt használja a UI
(`compileLayeredModel()`), a P12 validációs suite (P-03…P-11 minden esete),
és a P15/A levezetés-modul. A **nem-rétegelt (igénybevétel-szintű) modell**
(`material/resultantPlastic.ts`) megmarad a kódban, önálló, teljes
tesztlefedettséggel, de a UI-ból NEM érhető el.

## Indoklás

1. **A rétegelt modell pontosabb és általánosabb.** Tetszőleges
   keresztmetszet-alakot (nem csak téglalapot) kezel egységesen, mert a
   `generateLayers()` bármilyen `SectionShape`-ből réteg-listát generál — a
   nem-rétegelt modell zárt alakú `M0 = σY·Kp` képlete csak akkor egyszerű,
   ha a képlékeny keresztmetszeti modulus (`Kp = 2·S0`) analitikusan
   ismert, ami bonyolultabb szelvényeknél (I-szelvény, körgyűrű) már nem
   triviális.
2. **A rétegelt modell finomabb állapotteret ad**: rétegenkénti
   folyás-nyomon-követés lehetővé teszi a képlékeny zóna KERESZTMETSZETEN
   BELÜLI terjedésének megjelenítését (P13 UI: "részben képlékeny" vs.
   "teljes képlékeny csukló" vizuális állapot) — a nem-rétegelt modellnél ez
   a részlet definíció szerint nem létezik (a keresztmetszet egyetlen
   bináris `yielded` állapotot kap).
3. **A két modell EGYMÁS FÜGGETLEN ellenőrzése.** A P9 (nem-rétegelt) és
   P10/P12 (rétegelt) implementáció egymástól függetlenül készült, majd a
   P-09 validációs eset (`M/Mp = 1.5·[1−(1/3)(κe/κ)²]`, zárt alakú,
   téglalap-szelvényre mindkét modellből levezethető képlet) mindkettőt
   ugyanahhoz a referenciához méri — ez erősebb hitelesítés, mintha csak
   egy modell léteznék.
4. **A nem-rétegelt modell megtartása NEM holt kód**: teljes, önálló
   tesztlefedettséggel rendelkezik (`resultantPlastic.test.ts`), és a
   diplomaterv 3.4.2 pontjának hű, önmagában is helyes megvalósítása — a
   projekt "ne találj ki formulát, amit a forrás nem ír le" elve szerint
   ha a diplomaterv leír egy modellt, az implementálva és tesztelve marad,
   akkor is, ha a UI a fejlettebb alternatívát választja alapértelmezettnek.

## Következmények

- A `material/index.ts` mindkét modellt exportálja; az API-k tudatosan
  egységes nevezéktant használnak (`kappaPEff` ↔ `epsPEff`, ld.
  `CONVENTIONS.md` 8/A–8/B pont), hogy a két modell összevethető maradjon.
- Ha egy jövőbeli fázis a nem-rétegelt modellt is elérhetővé tenné a
  UI-ból (pl. gyorsabb, "előzetes becslés" módként nagy modelleknél), az
  külön ADR-t igényel — jelenleg nincs ütemezve.
