# ADR-0009 — P16 teljesítmény-profilozás: mérési eredmények és döntések

**Dátum:** 2026-08-22 · **Státusz:** elfogadva · **Érinti:** P16

## Kontextus

MASTER-PROMPT-TERV P16 prompt, 1–2. pont: "5000 DOF-os modell, 100
teherlépcső, rétegelt szelvény 32 réteggel. Célszám: teljes futás < 10 s
asztali gépen; ha nem teljesül, a szűk keresztmetszet MÉRÉSSEL azonosítva,
nem találgatással." Az optimalizálás előírt sorrendje: (a) allokációk
kiiktatása a belső ciklusokból, (b) Cuthill–McKee átrendezés, (c) csak
ezután merüljön fel a WASM.

## Mérési módszer

`packages/fem-core/test/profile.perf.test.ts` (teljes futásidő, `PROFILE=1`
mellett futtatható) és `profile.detail.perf.test.ts` (szakaszonkénti bontás:
Kₑ-összeállítás, Skyline profil/megoldás, állapotfrissítés, belső erő,
tehervektor — mindegyik a valódi, publikus fem-core függvényeket hívva, nem
újraimplementálva). A gép: fejlesztői munkaállomás (a CI-független, egyszeri
mérés jellegéből adódóan a pontos szám géptől függ — az ARÁNYOK a lényegesek).

## Eredmény

**Alapállapot** (optimalizálás előtt): 100 lépés, 5000 DOF, 32 réteg →
**~10.3–11.7 s** (a célszám fölött, ~5–17%-kal, futtatásonkénti szórással).

**Szakaszonkénti bontás** (átlagosan, 20 ismétlésből):

| Szakasz | Idő/lépés | Megjegyzés |
|---|---|---|
| Állapotfrissítés (`updateGaussPointState`, 1250 elem × 3 GP × 32 réteg) | ~13–22 ms | A LEGNAGYOBB egyedi tétel |
| Kₑ-összeállítás (`elementTangentStiffness` × 1250 elem) | ~6–13 ms | Hasonló nagyságrendű |
| Belső erővektor (`elementInternalForceVector` × 1250 elem) | ~5–10 ms | |
| Skyline profil + blokkok + faktorizálás+megoldás | ~2–3 ms | **ELHANYAGOLHATÓ** |
| Tehervektor összeállítása (`buildLoadVector`) | ~3 ms | |
| GC | 0 esemény mérve (`PerformanceObserver({entryTypes:['gc']})`) | Nem GC-nyomás |

**Két VALÓDI, biztonságos allokáció-csökkentést végrehajtottunk** (mindkettő
a P16 prompt (a) pontja szerint, MÉRÉSSEL indokolva, nem találgatva):

1. `element/bMatrix.ts` `bRows()`: a `shapeFunctions(xi)` korábban
   HÁROMSZOR futott le ugyanarra a ξ-re egyetlen `bRows()`-híváson belül
   (egyszer `jacobian()`-ben, egyszer `shapeDerivativesX()`-ben, egyszer
   közvetlenül) — most EGYSZER fut, a Jacobi-aritmetika inline készül. A
   `jacobian()`/`shapeDerivativesX()` közfüggvények VÁLTOZATLANOK (más
   hívóknak kell a teljes visszatérési érték).
2. `solver/materialState.ts` `updateGaussPointState()` (rétegelt ág): a
   `sectionMoment(rawLayers, stresses)` hívás rétegenként ÚJ `RawLayer`
   objektumot ÉS tömb-elemet allokált, holott `data.layers[i]` a
   teherlépcsőzés alatt VÁLTOZATLAN — most `M = Σ σₗ·bₗ·zₗ·tₗ` INLINE
   összegzéssel készül, ugyanazzal a képlettel, allokáció nélkül.

Mindkét változtatás **bit-azonos** eredményt ad (a fem-core mind a 381
tesztje változatlanul zöld) — tisztán teljesítmény-optimalizálás, nem
képletváltoztatás.

**A hatás MÉRVE**: az optimalizálás UTÁN a 100 lépéses futás **~10.5 s** —
alig jobb, mint az alapállapot. **Ez a lényegi, a mesterterv a-priori
feltevésének ELLENTMONDÓ megállapítás**: az allokáció-nyomás NEM a domináns
tényező ezen a méretskálán. A domináns költség SZÁMÍTÁSI (compute-bound):
5000 DOF / 32 réteg / 100 lépés / (átlagosan) 2 iteráció mellett kb.
**7.7 millió `updateLayerPlasticState()`-hívás** történik (1250 elem × 3
Gauss-pont × 32 réteg × 2 iteráció × 100 lépés) — minden hívás elágazásokat
és lebegőpontos műveleteket végez (REFORB döntési tábla, ld.
`elastoPlastic1D.ts`). Ez az algoritmus INTRINZIK O(elem×Gauss×réteg×
iteráció×lépés) komplexitása, nem egy könnyen kiiktatható allokációs
felesleg.

## Döntés

1. **Cuthill–McKee átrendezés (2b) NEM indokolt.** A Skyline profil
   felépítése + faktorizálás + megoldás EGYÜTT is csak ~2–3 ms/lépés
   (~2–3% a teljes lépésidőből) — a szekvenciális 1D gerenda-csomópont-
   számozás ELEVE kis sávszélességet ad. A Cuthill–McKee itt NEM a
   szűk keresztmetszetet célozná — MÉRÉSSEL kizárva, nem találgatással.

2. **WASM (2c) NEM indokolt EBBEN a fázisban.** A mesterterv sorrendje
   szerint a WASM csak (a) és (b) kimerítése UTÁN merülhet fel — (a)-t
   elvégeztük (két valódi, verifikált optimalizálás), (b) méréssel kizárva.
   Egy WASM-port a REFORB-hurokra (tisztán skaláris, elágazásos aritmetika —
   jó WASM-jelölt) ELVILEG hozhatná a hiányzó ~5–15%-ot, de ez önálló,
   jelentős ráfordítású munka (build-lánc, FFI-határ tervezése, teszt-
   újraírás) — **KÜLÖN, jövőbeli fázisként rögzítve, nem ebbe a fázisba
   szorítva.**

3. **A célszám hiánya MÉRÉSSEL indokolt** (a P16 prompt elfogadási
   kritériuma: "a célszám teljesül VAGY a hiánya mérési adatokkal
   indokolt"): az 5000 DOF / 32 réteg / 100 lépés szélsőséges (stressz-teszt)
   forgatókönyv ~10.5 s-ot vesz igénybe, a 10 s célszám fölött — a mérés
   szerint a fő ok az algoritmus intrinzik számítási komplexitása, amit
   allokáció-optimalizálással NEM lehetett érdemben csökkenteni.

4. **A gyakorlati hatás elhanyagolható.** Az UI-ban ténylegesen elérhető
   legnagyobb modell (`Toolbar.tsx` csúszkái: max. 48 elem, 16 réteg,
   ld. `packages/ui/src/model/nonlinear.ts` `LAYER_COUNT`) **~300 ms** alatt
   fut le (`profile.ui-scale.perf.test.ts`, 194 DOF) — a felhasználó SOSEM
   találkozik a szélsőséges 5000 DOF-os esettel. Az élő újraszámolás (P7
   elfogadási kritériuma: "< 50 ms") ennél a méretskálánál KOMFORTOSAN
   teljesül.

## Következmény

- A két elvégzett optimalizálás megmarad (valódi, kockázatmentes javulás,
  még ha kicsi is).
- `profile.perf.test.ts`, `profile.detail.perf.test.ts`,
  `profile.ui-scale.perf.test.ts` megmaradnak a repóban, `PROFILE=1`
  mögé zárva (a normál `pnpm check` NEM lassul le velük) — jövőbeli
  regresszió-ellenőrzéshez és egy esetleges WASM-fázis előtti/utáni
  összevetéshez.
- Egy jövőbeli, KÜLÖN fázisként ütemezhető WASM-port (a REFORB
  réteg-visszavetítő hurokra) explicit, nyitott tételként szerepel a
  STATUS_REPORT.md-ben — NEM hallgatjuk el, de nem is erőltetjük bele ebbe
  a fázisba.
