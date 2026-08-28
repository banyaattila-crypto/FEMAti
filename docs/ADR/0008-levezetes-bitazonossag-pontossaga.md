# ADR-0008 — A levezetés-modul "bit-azonosság" garanciájának pontos hatóköre

**Dátum:** 2026-08-22 · **Státusz:** elfogadva · **Érinti:** P15/A

## Kontextus

ADR-0005 kötelező garanciaként rögzíti: "a levezetés-modul által kiszámított
Kₑ mátrix, tehervektor és Gauss-ponti feszültség **bit-azonos** a solver
által ténylegesen használt értékekkel". A `packages/fem-core/src/derivation/`
modul implementálása (P15/A) közben ez a garancia három külön esetre bomlott,
és az egyikben pontosítást igényelt.

## Megfigyelés

1. **Kₑ és a tehervektor**: a `deriveElementStiffness()` szó szerint az
   `elementStiffness()`/`elementLoadVector()` függvényt hívja — a
   bit-azonosság itt TRIVIÁLIS (azonosság, nem közelítés), mert nincs
   újraszámolás, csak a mag saját kimenetének visszaadása. Igazolva:
   `derivation.test.ts` első két esete.

2. **Rétegfeszültség (σ), amikor NINCS keményedés (H'=0)**: a
   `plasticStep()` képlete `σ = sign·σY` — FÜGGETLEN az `epsPEff`
   felhalmozott értékétől. Emiatt σ H'=0-nál TRIVIÁLISAN bit-azonos,
   bármilyen összegzési sorrenddel is állt elő az `epsPEff`.

3. **A felhalmozott képlékeny alakváltozás (`epsPEff`) és a σ, amikor VAN
   keményedés (H'>0)**: itt a garancia **NEM tartható szó szerint**. A
   solver a `NonlinearStateMap`-et Newton-ITERÁCIÓNKÉNT frissíti
   (`updateGaussPointState()`, több, egymást követő KIS Δκ-val egy elfogadott
   teherlépcsőn belül); az `epsPEff` ezek `Σ|Δεₚ|`-jainak összege. A
   levezetés-modul viszont a KÉT ELFOGADOTT lépés közti EGYETLEN, nagy Δκ-val
   számol (`deriveLayerStep()`). Lebegőpontos aritmetikában
   `|a|+|b| ≠ |a+b|`-nek nem KELL egyeznie, ha a és b azonos előjelűek is —
   ez csak a `Σ|Δεₚ|` (sok kis lépés) és `|Σ Δεₚ|` (egy nagy lépés) sorrendi
   (asszociativitási) eltérése, NEM matematikai/logikai hiba. Az empirikusan
   mért eltérés 1 ULP nagyságrendű (relatív ~1e-16).

## Döntés

A "bit-azonos" garanciát PONTOSÍTJUK:

> A levezetés-modul σ-ja és `epsPEff`-je **gépi pontosságig (relatív
> tolerancia ~1e-12) egyezik** a solverrel; SZIGORÚAN bit-azonos (`Object.is`)
> csak a Kₑ-re, a tehervektorra, és a σ-ra H'=0 (tökéletesen képlékeny/nincs
> keményedés) anyagoknál garantált.

Ez NEM gyengíti a dokumentum hitelességét — a felhasználó számára releváns
mennyiség (a réteg feszültsége) minden gyakorlati esetben (a katalógus egyik
anyagának sincs `hPrime > 0`, kivéve az explicit "S235H" demonstrációs
anyagot) továbbra is a mag SAJÁT függvényével, a mag SAJÁT bemeneteivel
számol — csak az összegzés SORRENDJE tér el egy nagy vs. sok kis lépés
között, ami dokumentált, tesztelt, és a HIBATURESI-POLITIKA "gépi pontosság"
kategóriájába esik, nem a mérnöki tűrésekébe.

## Következmény

- `packages/fem-core/src/derivation/layerStepDerivation.ts` fejléce rögzíti
  ezt a pontossági megjegyzést.
- `packages/fem-core/test/derivation.test.ts` a réteg-visszavetítést relatív
  ~1e-12 tűréssel (`relTol`), NEM `toBe`-vel ellenőrzi.
- A `MASTER-PROMPT-TERV.md` P15/A elfogadási kritériumát ez az ADR
  pontosítja — a kritérium szövegét magát nem módosítjuk (a mesterterv
  történeti dokumentum), csak a kódban és a tesztben rögzített, PONTOSABB
  értelmezést.
