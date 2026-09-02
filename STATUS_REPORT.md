# FEMAti — Állapotjelentés

**Utolsó frissítés:** 2026-09-02
**Repó:** [banyaattila-crypto/fem97](https://github.com/banyaattila-crypto/fem97) (privát), `main` ág
**Utolsó commit:** `feed6e4` — PDF export bekötése + EC2/EN1993 kihasználtsági-ellenőrzés

> Ez a dokumentum a projekt PILLANATNYI állapotát rögzíti: mi készült el,
> milyen minőségi mércével, milyen tudatos hatókör-korlátokkal, és mi van
> még hátra a `MASTER-PROMPT-TERV.md` szerint. Minden fázis-lezáráskor
> frissítendő és a többi commit-tal együtt push-olandó.

---

## 1. Mi ez a projekt

A FEMAti Bánya Attila 1996-os BME szerkezetépítő mérnöki diplomatervének
(rugalmas–képlékeny Timoshenko-gerenda végeselemes program) újraimplementálása
modern TypeScript monorepóként. A cél nem csupán egy működő FEM-eszköz, hanem
a diplomaterv MINDEN képletének hiteles, oldalszámra visszavezethető
kódba ültetése, teljes validációs jegyzőkönyvvel.

**Munkamódszer:** a `MASTER-PROMPT-TERV.md` fázisról fázisra halad (P0–P18),
minden fázis csak explicit felhasználói jóváhagyás után indul. Minden
mechanikai képletet a `Diplomaterv (BME).pdf` eredetijéből ellenőrzünk
(sosem találjuk ki) — ha egy képlet ellentmondásos, megállunk és kérdezünk
(ld. `docs/HIBATURESI-POLITIKA.md`, K8 kockázat).

---

## 2. Monorepo-szerkezet

```
packages/
  fem-core/         — a számítási mag (nulla UI-függőség, szigorú TS)
  fem-validation/   — analitikus validációs esetek (V-01…V-12, P-01…P-16)
  fem-db/           — anyag- és szelvényadatbázis, forrás-hivatkozással és verified-jelzéssel
  ui/               — React 18 + Zustand + kézzel rajzolt SVG (Vite)
docs/
  THEORY.md              — képlet ↔ kód ↔ diplomaterv-oldalszám leképezés
  CONVENTIONS.md          — rögzített mérnöki/kódolási konvenciók
  HIBATURESI-POLITIKA.md  — tűrés-politika (mikor mennyi az elfogadható eltérés)
  VALIDATION.md           — GENERÁLT validációs jegyzőkönyv (gitignore-olt)
  ADR/                    — architektúra-döntési feljegyzések (9 db)
MASTER-PROMPT-TERV.md — a teljes fázisterv (P0–P18), a projekt "forgatókönyve"
```

---

## 3. Fázis-állapot

### ✅ Elkészült fázisok (P0–P18 — a teljes mesterterv lezárva)

| Fázis | Tartalom | Commit |
|---|---|---|
| P0–P4 | Alapozás: domain-modell, lineáris algebra (skyline LDLᵀ), 3-csomópontos Timoshenko-elem (szelektív redukált integrálás), kompilálás, peremfeltételek, lineáris megoldó | `eaa2d66` |
| P5 | Tehervektorok: megoszló erő/nyomaték, önsúly, hőteher — **ADR-0006** (a mesterterv 1.4 pontjának hibás előjelét a diplomaterv eredetije és a virtuális munka elve alapján javítottuk) | `caef1da` |
| P6 | Utófeldolgozás: Gauss→csomópont extrapoláció, elemhatár-átlagolás, hibabecslő, teherlépcső-history infrastruktúra | `b4c720a` |
| P7 | Felület: modellező vászon (SVG, húzásos szerkesztés, zoom/pan), `modelStore`/`appStore`, `compile.ts` mint egyetlen mag-hívási pont | `1ef0943` |
| P8 | Diagramok: M/T/w/φ, hover-metszet, hibabecslő-sáv, SVG export | `d1ace3a` |
| P9 | Rugalmas–képlékeny anyagmodell (nem rétegelt, "resultant"): zárt alakú radial-return, `f=M²−M0²` folyási feltétel | `1bbf427` |
| P10 | Rétegelt (fiber) keresztmetszet: `generateLayers()`, REFORB R-faktoros visszavetítés rétegenként | `290584b` |
| P11 | Nemlineáris megoldó: Newton-Raphson (teljes/módosított/kezdeti-merevség), CONUND reziduum-kritérium, adaptív teherlépcsőzés | `a178164` |
| P12 | Képlékeny validációs suite: P-03…P-08 (határteher-esetek), P-10/P-11 (sajátfeszültségek, beállás) — **ADR-0007** (valódi R-faktor hiba találva és javítva) | `5242bab` |
| P13 | Interaktív képlékeny megjelenítés: teherlépcső-idővonal, képlékeny zónák, teher–elmozdulás görbe, keresztmetszet-inspektor, konvergencia-panel | `aa2c9ab` |
| P14 | Anyag- és szelvényadatbázis (`fem-db` csomag): a katalógus kiköltözött az `ui`-ból saját csomagba, minden rekordon KÖTELEZŐ `source`/`verified` mező, diplomaterv 3.1.6.3.1/3.1.6.3.2 szerinti figyelmeztető szöveg és mezőkészlet, 8 új betonosztály (C16/20…C50/60, `Ecm` képlettel számolva) + C24/GL24h fa, 3 új UPN (U-szelvény) — mechanikailag I-szelvényként kezelve az 1D erős-tengely hajlítási modellben | `7d1113e` |
| P15 | Számítási jegyzőkönyv: nyomtatható HTML → PDF (böngésző natív nyomtatás, nincs külön PDF-könyvtár), a P15 prompt mind a 8 pontjával (fejléc verzióval és mag commit-hash-sel, modell, háló, megoldó, eredmények, nemlineáris futás — csuklók kialakulási sorrendje táblázatban, hibabecslés, minden oldalon ismétlődő lábléc); a számértékek a `RightPanel`/`DiagramPanel`-lel AZONOS forrásból és formázókból származnak | `1df0c6c` |
| P15/A | Levezetés-modul: ÚJ `fem-core` `derivation/` almodul (`deriveElementStiffness`, `deriveLayerStep` — ADR-0005 (b) útja), a mesterterv mind a 7 pontjával (feladat, keresztmetszet-rétegzés, végeselem-felosztás, EGY elem TELJES levezetése Gauss-pontonként N/dN/Jacobi/B/D/Kₑ/tehervektor számokkal, kompilálás, eredmények, képlékeny réteg-visszavetítés próbafeszültséggel/R-faktorral); `.docx` export a `docx` könyvtárral + `.pdf` a nyomtatási nézetből — **ADR-0008** (a "bit-azonosság" garancia pontos hatóköre: Kₑ/tehervektor/σ H'=0-nál szigorúan bit-azonos, σ/epsPEff H'>0-nál gépi pontosságig). **Kiegészítés (felhasználói visszajelzés alapján):** a 4. és 7. pont ELŐZŐLEG csak táblázatos végeredményt mutatott — ÚJ `formulaText.ts` modul minden Gauss-pontra és a képlékeny réteg-visszavetítésre a TELJES, behelyettesített képletet is megjeleníti ("N₁(ξ) = ½·ξ·(ξ−1) = ½·(−0.7746)·(−1.7746) = 0.6873" formában), egy ellenőrizhető, teljesen kiírt Kₑ-mátrixelem-példával; ugyanezek a .docx exportba is bekerülnek. **Második kiegészítés (szintén felhasználói visszajelzésre):** a HTML/nyomtatási nézet képletei ezután PLAIN TEXT formában jelentek meg ("dt/ds" stílusban) — ÚJ `katex` függőség + `Formula.tsx`/`formulaLatex.ts` modul valódi LaTeX-tördeléssel (törtvonalak, alsó/felső indexek, Σ-jel) jeleníti meg mind a 4., mind a 2., mind a 7. pont képleteit; a `.docx` export VÁLTOZATLANUL a szöveges formát használja (ADR-0005: "a HTML/PDF nézetben KaTeX is megengedett, de a .docx-be a szöveges forma kerül"). **Hibajavítás (felhasználó jelentette):** rugalmas-csak anyagoknál (pl. beton, σY nincs megadva) a Mₑ/Mₚ képlet hamisan "0.00 kN/cm²·...=0.00 kNm" formában jelent meg — a mag `LinearResult.props.me/mp`-je helyesen `null`-t ad (nem 0-t) folyáshatár nélküli anyagnál, de a levezetés `?? 0`-val silányította nullára, majd ÚGY jelenítette meg, mintha valódi, kiszámított zérus volna. Javítva: `null` esetén a formula-blokk helyett egy őszinte magyarázó szöveg jelenik meg ("Mₑ/Mₚ NEM értelmezhető"), a c = Wₚ/Wₑ alaki tényező (σY-tól független, tisztán geometriai) változatlanul megjelenik — mind a HTML, mind a .docx exportban | `69d9852` |

| P16 | Teljesítmény-profilozás MÉRÉSSEL (5000 DOF/32 réteg/100 lépés: ~10.3–11.7 s → optimalizálás után ~10.5 s — **ADR-0009**: a domináns költség SZÁMÍTÁSI, nem allokációs, a mesterterv a-priori feltevésével ELLENTÉTBEN; Cuthill–McKee méréssel kizárva (a Skyline-megoldás már csak ~2-3%); WASM tudatosan elhalasztva, külön fázisként rögzítve); két valódi, biztonságos allokáció-optimalizálás (`bRows()` 3×→1× `shapeFunctions()`-hívás, réteg-visszavetítés felesleges tömb-allokációinak kiiktatása — mindkettő bit-azonos, mind a 383 fem-core teszt zöld); robusztusság-ellenőrzés (mechanizmus/nulla-merevség/degenerált elem/negatív rétegvastagság — MÁR a P0–P12 validációs rétege lefedte, 44 `validate.test.ts` teszttel, most megerősítve); ÚJ `fuzz.test.ts`: 10 000 véletlen érvényes lineáris modell + 500 nemlineáris modell, `fast-check` property-based teszteléssel — mindegyik végesen, kivétel nélkül, egyensúly-teljesítve fut. Az ívhossz-vezérlés (Riks) OPCIONÁLIS-ként tudatosan elhalasztva | `8a1d130` |
| P17 | "Történelmi mód": frontális megoldó, didaktikai/hitelesítési célú, NEM teljesítmény célú (ADR-0002 szerint a produkciós megoldó változatlanul a Skyline-LDLᵀ). ÚJ `fem-core` `solver/frontal.ts` (`solveFrontal()`) a diplomaterv 3.1.7.3 pontja (44. oldal) szerint: az ELEM- (nem csomópont-) sorszámozás vezérli a front szélességét, a mátrix-összeállítás és a Gauss-elimináció EGYETLEN, interleaved lépésben történik (`a'ᵢⱼ=aᵢⱼ−aᵢₖ·aₖⱼ/aₖₖ`), visszahelyettesítés a kiküszöbölés FORDÍTOTT sorrendjében; a diplomaterv szövegét `pdftotext`-tel kigyűjtve, nem kitalálva. Elfogadási teszt (`frontal.test.ts`, 8 eset): a Skyline-LDLᵀ eredményétől **1e−10 relatív pontossággal** egyezik konzol/kéttámaszú/befogott-befogott/rugós-támaszú/önsúlyos/finomabb hálós modelleken; egy mechanizmus-eset `SingularMatrixError`-t vár. **Valódi hiba a fejlesztés közben (THEORY.md §17/P17 sor):** a pivot-tűrés kezdetben ABSZOLÚT (`1e-9`) volt — ~1e8-as merevségi együtthatók mellett egy valódi szinguláris pivot simán átcsúszott a küszöbön, és csak jóval később, ~1e9-szeresére felnagyítva jelentkezett hamis eredményként; javítva a `SkylineMatrix.factorize()`-zal azonos elvű, relatív (az eredeti átló legnagyobb eleméhez viszonyított, `1e-12`) tűrésre. ÚJ `ui` `historical/HistoricalView.tsx` ("Elmélet" menü → "Történelmi mód: frontális megoldó"): animált front-mozgás (elemenkénti lejátszás/lépegetés/sebességváltás, a Timeline mintájára), pillanatnyi/max/átlagos frontszélesség, összevetés a Skyline-profil átlagos sávszélességével sávdiagramon, és magyarázó szöveg arról, miért volt 1996-ban a memória-szűkösség miatt a frontális módszer a helyes választás, és mi változott azóta. `THEORY.md` §18 új szakasz a 3.1.7.3 megfeleltetéssel. Böngészőben manuálisan ellenőrizve (lejátszás végigfut 1→16. elemig, a front-csomópontok helyesen jelennek meg/tűnnek el, nincs konzolhiba) | `747618f` |
| P18 | Dokumentáció és lezárás, a mesterterv mind a 6 pontjával: (1) `docs/THEORY.md` — már a fázis megkezdése előtt is teljes volt (18 szakasz, minden képlethez kód-hivatkozás ÉS diplomaterv-oldalszám, a 2.3 moduláris megfeleltetési táblázattal), változatlanul hagyva; (2) `docs/CONVENTIONS.md`/`docs/VALIDATION.md` — szintén már véglegesnek bizonyultak (a VALIDATION.md a `pnpm --filter @femati/fem-validation test` által GENERÁLT, nem kézzel írt); (3) ÚJ ADR-ok a mesterterv által kifejezetten előírt, addig hiányzó döntésekre — **ADR-0010** (TypeScript vs. Rust/WASM — a nyelvválasztás indoklása, a P16 méréssel alátámasztva), **ADR-0011** (elimináció vs. penalty peremfeltétel-stratégia), **ADR-0012** (rétegelt vs. igénybevétel-szintű képlékenység — miért a rétegelt a fő út, a másik miért marad meg mégis), **ADR-0013** (teher-vezérelt vs. ívhossz-vezérlés — az Riks-módszer tudatos, végleges elmaradása); (4) ÚJ gyökér `README.md` (bemutatás, élő Vercel-demo link, futtatási útmutató, monorepo-szerkezet, dokumentáció-térkép — képernyőkép NEM került bele, mert a munkamenet böngésző-panelje ebben a fázisban nem tudott pixel-screenshotot készíteni; a demo-link ezt részben pótolja); (5) ÚJ, valódi (korábban `disabled: true` helyfoglaló) beépített „Elmélet" nézet a felületen — `ui/src/theory/TheoryView.tsx`, 3 témával (Timoshenko gerendaelem, Szelektív redukált integrálás, Reziduális erők/REFORB), KaTeX-szel szedett képletekkel, a `docs/THEORY.md` tartalmából; a „Történelmi mód" (P17) marad a frontális megoldó ANIMÁLT bemutatója, ez a nézet a statikus elméleti hátteret adja. Böngészőben ellenőrizve mindhárom témára (helyes KaTeX-renderelés, egy apró JSX-whitespace hiba — hiányzó szóköz egy sortörésnél — észlelve és javítva). `pnpm check` tiszta | `18c6fb5` |

---

## 4. Minőségi mércék (jelen állapot)

```
pnpm check   → typecheck + lint + test, mindhárom csomagra, TISZTA
```

| Csomag | Teszt-fájl | Teszt | fem-core lefedettség |
|---|---|---|---|
| `fem-core` | 34 (31 fut, 3 `PROFILE=1` mögé zárt profilozó teszt mindig skip) | 498 (+3 skip) | küszöb: ≥90% (a P16 óta nem mérve újra ezen a frissítésen) |
| `fem-validation` | 2 | 30 | — (validációs esetek, nem klasszikus unit teszt) |
| `fem-db` | 2 | 25 | — (adatkonzisztencia: Ecm-képlet visszaellenőrzés, katalógus-geometria ±6%-os egyezés a fem-core zárt alakjával, forrás/verified-mező kötelező jelenléte) |
| `ui` | 13 | 69 | — (nincs formális küszöb, de a nemlineáris/dinamikai logika, a jegyzőkönyv és a levezetés adat-előállítása, valamint minden generált LaTeX-sor KaTeX-szintaxisa unit tesztelt) |
| **Összesen** | **51** | **622** (+3 skip) | |

(2026-09-02-i `pnpm check` futással ellenőrizve: typecheck + lint + teszt mind a 4 csomagra TISZTA — a 43–51. pont commitjai óta is.)

**P16 fuzz-teszt** (`fem-core/test/fuzz.test.ts`, a fenti számban benne): 10 000
véletlen ÉRVÉNYES lineáris modell (span, elemszám, keresztmetszet-alak,
anyag, megtámasztási minta, teherfajta — `fast-check` property-based
generátorral) mindegyike véges eredményt ad és a globális egyensúly
teljesül; +500 véletlen nemlineáris modell kivétel nélkül lefut. 3
profilozó teszt (`profile.*.perf.test.ts`) `PROFILE=1` mögé zárva — a
normál `pnpm check`-et NEM lassítja.

**Fázisonkénti mutációs próbák:** minden fázishoz legalább egy VALÓDI
mutációs próba tartozik (a képletet szándékosan elrontjuk, megnézzük, hogy a
teszt elbukik-e, majd visszaállítjuk) — a teljes jegyzék: `docs/THEORY.md`
17. pont ("Mutációs próbák jegyzéke"). A P12 fázisban egy VALÓDI (nem
szintetikus) hibát is talált egy validációs eset — ld. lent.

---

## 5. Validációs esetek (fem-validation)

**Lineáris esetek (V-01…V-13):** konzol, kéttámaszú, patch-teszt,
locking-teszt, merevtest-mozgás, szimmetria, hőteher (2 eset), támaszsüllyedés,
önsúly-ekvivalencia, penalty vs. elimináció, h-konvergencia, befogott-csuklós
tartó (P18 után, ld. 11. szakasz 16. pont). Mind zöld.

**Képlékeny esetek (P-01…P-16):**

| ID | Eset | Módszer |
|---|---|---|
| P-01, P-02 | Alaki tényezők (téglalap, kör, körgyűrű, I-szelvény) | zárt alak |
| P-03…P-07 | Határteher-esetek (konzol, kéttámaszú, befogott, P/q) | `runLoadStepper`, "utolsó konvergált lépcső" módszer |
| P-08 | **Kétnyílású folytatólagos gerenda** (a diplomaterv fő feladattípusa) | szimmetria-modellezés (ld. 6. pont) |
| P-09 | Rétegelt M–κ görbe zárt megoldással | keresztmetszet-szintű |
| P-10, P-11 | Sajátfeszültségek, beállás (shakedown) | keresztmetszet-szintű |
| P-12, P-13 | Keményedés, rétegszám-konvergencia | zárt alak / konvergencia-vizsgálat |
| P-14, P-15, P-16 | Teherlépcső-függetlenség, Newton vs. mód. Newton, reziduum-monotonitás | `runLoadStepper` összevetés |

Mind a 30 fem-validation teszt (29 eset — 13× V, 16× P —, összesen ~50+
ellenőrzés) zöld. (A korábbi "17 eset" szám itt elavult/pontatlan volt már a
V-04 pótlása előtt is — 29-re javítva, a tényleges `allCases()` lista
szerint.)

---

## 6. Figyelemre méltó műszaki döntések és felfedezések

Ezek a projekt saját, dokumentált tanulságai — nem a diplomaterv hibái,
hanem ennek az implementációnak a folyamata során felmerült, és MINDIG
ellenőrzött/dokumentált döntések:

1. **Hőteher-előjel (ADR-0006, P5):** a `MASTER-PROMPT-TERV.md` 1.4 pontja
   negatív előjellel adta meg a tehervektor egy tagját; a diplomaterv
   eredetije és a virtuális munka elve pozitív előjelet igazol. A kód az
   utóbbit követi, numerikusan igazolva (V-07).

2. **R-faktor tört-hiba (ADR-0007, P12):** a P10 fázis rétegelt
   plaszticitás-modellje egy felcserélt törtet tartalmazott
   (`AB/AC` a helyes `(AC−AB)/AC` helyett), amit a P10 eredeti,
   kizárólag SZIMMETRIKUS eseteket lefedő tesztjei nem tudtak
   megkülönböztetni a helyestől. A P-11 (beállás) validációs eset — ami
   szándékosan ASZIMMETRIKUS terhelési utat vizsgál — fedte fel a hibát
   (0.0014 hamis képlékeny alakváltozás-növekmény a várt 0 helyett).
   Javítva, regressziós teszttel.

3. **P-08 szimmetria-modellezés (P12):** a kétnyílású folytatólagos gerenda
   TELJES (2 nyílásos) modellje numerikusan rosszul kondicionálttá vált a
   középső támasznál egyidejűleg folyó Gauss-pontok miatt. Mivel szimmetrikus
   terhelésnél a középső támasz elfordulása MINDIG nulla, a modell egyetlen,
   befogott-csuklós ("propped cantilever") mezőre redukálható — ez adta meg
   azt is, miért egyezik a diplomaterv kétnyílású képlete a klasszikus
   propped-cantilever eredménnyel.

4. **I-szelvény alaki tényező (P9):** a diplomaterv 4. táblázatának
   1.14–1.16-os sávja korabeli, ZÖMÖK gerincű szelvényekre vonatkozik — egy
   mai karcsú IPE/HEB szelvény ez alá esik (ezt egy korábbi fázis már
   dokumentálta tesztben); a validációs eset ezért egy INP300-stílusú
   szelvényt használ.

5. **A "bit-azonosság" garancia pontosítása (ADR-0008, P15/A):** a
   levezetés-modul kifejlesztése közben kiderült, hogy a réteg-visszavetítés
   `epsPEff` mezője (és keményedő anyagnál a σ is) csak GÉPI PONTOSSÁGIG, nem
   szigorúan `Object.is`-bit-azonosan egyezik a solverrel, mert a solver TÖBB
   Newton-iteráción (kis Δκ-kon) át összegzi a `|Δεₚ|`-t, a levezetés pedig
   EGY nagy Δκ-val — lebegőpontos összeadás asszociativitás-hiánya (~1 ULP),
   nem hiba. A Kₑ, a tehervektor és a σ H'=0 (nincs keményedés) anyagoknál
   VÁLTOZATLANUL szigorúan bit-azonos.

6. **Rétegelt A/I nagy eltérése alacsony rétegszámnál (P15/A, a levezetés
   fedte fel élesen):** az interaktív nemlineáris futtatás 16 rétege az
   IPE-profilok vékony (≈10-19 mm) övénél a rétegvastagságnál (≈19 mm 300 mm
   magas szelvénynél) is vékonyabb övet a teljes rétegre kivetíti — ez az
   alapértelmezett IPE 300-nál 39%/46%-os A/I-eltérést okoz a szelvénytáblázat
   adatához képest (a P-13 validációs eset szerint 64 rétegnél ez 1% alá esik
   — a diszkretizációs hiba tehát VÁRT és dokumentált, nem hiba, de a
   levezetés 2. pontja most már ŐSZINTÉN, a "kis mértékben eltér" korábbi,
   pontatlan megfogalmazása helyett a tényleges %-kal és okkal mutatja).

7. **A P16 teljesítmény-szűk-keresztmetszet ELLENTMOND a mesterterv
   a-priori feltevésének (ADR-0009, P16):** a mesterterv sorrendje szerinti
   első optimalizálási lépés ("allokációk kiiktatása") alapján azt vártuk,
   hogy az 5000 DOF/32 réteg/100 lépés szélsőséges teszt döntően allokáció-
   /GC-kötött. MÉRÉSSEL (nem találgatással): két valódi, biztonságos
   allokáció-optimalizálást végrehajtottunk (mindkettő bit-azonos, minden
   teszt zöld), de a futásidő alig változott (~10.5 s a ~10.3–11.7 s-os
   alapállapothoz képest). A valódi ok SZÁMÍTÁSI: ~7.7 millió
   `updateLayerPlasticState()`-hívás történik ennél a méretskálánál — az
   algoritmus intrinzik komplexitása, nem egy könnyen kiiktatható
   felesleg. A Skyline-megoldás (a Cuthill–McKee esetleges célpontja) már
   eleve csak ~2-3%-a a lépésidőnek (a szekvenciális 1D csomópontszámozás
   eleve kis sávszélességet ad) — a Cuthill–McKee ezért MÉRÉSSEL kizárva.

Mind a hét eset a projekt saját minőségbiztosítási elvét igazolja: **minden
fázishoz legalább egy VALÓDI (nem szintetikus) ellenőrzés tartozik**, és ez
ténylegesen hibákat/pontatlanságokat talál, nem csak "zöld pipát" termel.

---

## 7. Dokumentált hatókör-korlátok

Ezek TUDATOS, indokolt döntések — nem hiányzó funkciók, hanem explicit,
hibaüzenettel jelzett határok:

- A nemlineáris megoldó (P11+) NEM kezeli a hőteher és a rugalmas-képlékeny
  anyagmodell együttesét (κ0 eltolás a folyási feltételben — külön
  levezetést igényelne).
- A nemlineáris megoldó NEM kezeli a nemnulla támaszmozgást
  rugalmas-képlékeny futással együtt.
- A nemlineáris megoldó csak az `elimination` peremfeltétel-stratégiát
  támogatja (`penalty` nem).
- A P13 UI-ban a nemlineáris futtatás MINDIG rétegelt keresztmetszettel fut
  (a keresztmetszet-inspektor rétegenkénti adata miatt) — a "resultant"
  (nem rétegelt) modell csak a fem-core szintjén érhető el közvetlenül.

Mindhárom explicit `NonlinearModelError`-t dob, sosem hallgatja el
(HIBATURESI-POLITIKA.md 7. pont elve).

---

## 8. Architektúra-döntési feljegyzések (ADR)

| # | Cím | Fázis |
|---|---|---|
| 0001 | `noUncheckedIndexedAccess` bekapcsolása (és a `ui` csomagra való kiterjesztése) | P0 / P7 |
| 0002 | Skyline-LDLᵀ vs. frontális megoldó | P2 |
| 0003 | Egységek két rétegben (SI mag ↔ felhasználói egységek) | P0 |
| 0004 | P7 előrehozása a tervezett sorrendhez képest | P7 |
| 0005 | Levezetés újraszámolással (a P15/A modul tervezési elve) | — |
| 0006 | Hőteher-tehervektor előjele | P5 |
| 0007 | R-faktor tört-hiba javítása | P12 |
| 0008 | A levezetés "bit-azonosság" garanciájának pontos hatóköre | P15/A |
| 0009 | P16 teljesítmény-profilozás: mérési eredmények és döntések (Cuthill-McKee/WASM elhalasztása) | P16 |
| 0010 | TypeScript a mag nyelve, Rust/WASM tudatosan nyitva hagyva | P18 |
| 0011 | Elimináció az alapértelmezett peremfeltétel-stratégia, penalty egyenrangú alternatíva | P18 |
| 0012 | Rétegelt (fiber) modell a fő út, igénybevétel-szintű modell megtartva | P18 |
| 0013 | Teher-vezérelt lépcsőzés a megoldó, ívhossz-vezérlés tudatosan elmaradt | P18 |
| 0014 | Fiber-réteg szélesség: középponti mintavétel helyett terület-megőrző almintavételezés (VALÓDI hiba, felhasználó jelentette) | P18 után |
| 0015 | Izometrikus 3D-feszültség-vizualizáció: sematikus geometria, valódi σ (nem kontinuum-FEA helyettesítő) | P18 után |
| 0016 | Dinamikai bővítés: modális analízis (sajátfrekvencia) — tömegmátrix, sajátérték-megoldó | P18 után |
| 0017 | Csillapítás és tranziens válasz (Rayleigh + Newmark-β) a `fem-core` szintjén | P18 után |
| 0018 | Képlékeny M-V (hajlítás-nyírás) interakció — utólagos EN 1993-1-1 6.2.8 stílusú ellenőrzés | P18 után |
| 0019 | EC2 beton nemlineáris σ-ε modell a rétegelt magban (EN 1992-1-1 3.1.7 parabola-téglalap) | P18 után |
| 0020 | T-szelvény: aszimmetrikus keresztmetszet-támogatás | P18 után |
| 0021 | Lehajlás- és repedésinyomaték-ellenőrzés + PDF export bekötése | P18 után |

---

## 9. Ismert, még nyitott apróbb tételek

- `femati-T.svg` egy commitolatlan, eredetét nem ismerő fájl a repó
  gyökerében — szándékosan NEM lett bevonva egyetlen commitba sem
  (nem ehhez a munkához tartozik).
- Az UPN (U-szelvény) katalógusadatok DIN 1026-1 névleges méretekből,
  emlékezetből lettek felvéve (`verified: false`, forrás-szöveggel jelezve) —
  éles számításhoz ellenőrzés szükséges gyártói táblázatból.
- A betonosztályok `E` (rugalmassági modulusz) értéke az EN 1992-1-1 (3.5)
  `Ecm` képletéből SZÁMÍTOTT, nem táblázatból másolt — a `note` mező minden
  betonrekordnál jelzi, hogy ez `Ecm` (rövid idejű), nem `Ebt` (tartós teher).
- A P16 5000 DOF-os szélsőséges (32 réteg, 100 lépés) stressz-teszt a 10 s
  célszám fölött van (~10.5 s, ld. ADR-0009) — ez az UI-ban ELÉRHETETLEN
  méretskála (a `Toolbar.tsx` csúszkája max. 48 elemig enged), a valós
  felhasználói méreteknél (≤194 DOF) a futásidő ~300 ms alatt marad.
- Egy jövőbeli WASM-port a REFORB réteg-visszavetítő hurokra (a mért
  szűk keresztmetszet) NYITOTT, KÜLÖN fázisként ütemezhető tétel — a
  mesterterv sorrendje szerint tudatosan NEM ebbe a fázisba szorítva
  (ADR-0009).
- Az ívhossz-vezérlés (Riks-módszer, P16 prompt 5. pontja) OPCIONÁLIS
  bővítésként a mesterterv szerint is csak "ha a fentiek készen vannak"
  valósítandó meg — tudatosan elhalasztva, nem elfelejtve.
- A P15 jegyzőkönyv ÉS a P15/A levezetés "Nyomtatás / PDF mentése" gombja a
  böngésző natív `window.print()`-jét hívja — a tényleges A4 tördelés/
  lábléc-ismétlés valódi Chrome nyomtatási előnézetben ellenőrizendő, ez
  fejlesztői automatizált előnézetben nem tesztelhető közvetlenül (a CSS a
  szokásos, dokumentált Chromium "csak ezt nyomtasd" + `position:fixed`
  lábléc technikát követi).
- A levezetés `.docx` exportja (`docxExport.ts`) a HTML-nézet tartalmának
  MAGJÁT (mind a 7 pont táblázatai, Kₑ, tehervektor, réteg-visszavetítés)
  hűen átveszi, de néhány kiegészítő magyarázó szöveget (pl. a szelvénytábla-
  eltérés indoklása) NEM ismétel meg — ez tudatos, a Word-dokumentum
  elsősorban a SZÁMOKAT és képleteket viszi át szerkeszthető, kereshető
  formában, nem a HTML-nézet 1:1 másolata.
- A 7. pont (képlékeny számítás) automatikusan választja ki a bemutatott
  Gauss-pontot/réteget (az ELSŐ ténylegesen megfolyt hely) — nincs kézi
  Gauss-pont-választó, csak elem-választó (a 4. pontban). Ez tudatos
  egyszerűsítés a fázis idővel arányos hatóköréhez képest.

---

## 10. Következő lépés

A `MASTER-PROMPT-TERV.md` mind a 18 fázisa (P0–P18) elkészült — a mesterterv
szerinti munka lezárva. Nincs ütemezett hátralévő fázis; a `docs/ADR/`-ben és
a STATUS_REPORT.md "Ismert, még nyitott apróbb tételek" pontjában rögzített,
tudatosan nyitva hagyott tételek (pl. jövőbeli WASM-port, ívhossz-vezérlés)
csak új, önálló, explicit felhasználói kezdeményezésre indulnának.

A P18 lezárása UTÁN a munka folytatódott — de már NEM a mesterterv fázisai
szerint, hanem közvetlen felhasználói kérésekre, iteratív UI-finomításként.
Ezt a 11. pont dokumentálja.

---

## 11. P18 UTÁN — felhasználói kérésekre végzett iteratív UI-fejlesztés

Ez a szakasz NEM a `MASTER-PROMPT-TERV.md` fázisainak része — a P18-cal a
mesterterv szerinti munka lezárult. Az itt felsorolt tételek közvetlen
felhasználói kérésekre készültek, a projekt éles használatba vétele során.

1. **Élő demo Vercelen** — a `packages/ui` build a
   `https://banyaattila-crypto-fem97.vercel.app` címen érhető el (Vercel
   projekt: `femati`, a `banyaattila-crypto/fem97` GitHub-repóhoz kötve,
   gyökérmappa `packages/ui`, automatikus deploy minden `main`-push-ra).
2. **CSS-token hiba javítása** (`6977d3e`): a `historical.css`/`theory.css`
   egy soha nem létezett `--surface-base` design-tokent használt (a projekt
   EGYETLEN, rögzített palettát definiál — nincs `--surface-base` változó),
   ami a háttérszínt átlátszóra ejtette. Javítva a helyes `--surface-panel`
   tokenre — a Definition of Done 7. pontjának ("olvasható") utólagos
   auditja során találva.
3. **Terhek bővítése a felületen** (`1cd6688`): a mag által már P5 óta
   támogatott trapéz megoszló teher (`q1≠q2`) és a koncentrált nyomatékteher
   (`nodalMoment`) eddig nem volt elérhető a vászonról — most igen: a
   megoszló teher szerkesztő panelén két csúszka van (q₁ kezdet / q₂ vég,
   a vászon lejtős fedővonallal és arányos nyilakkal rajzolja), és egy új
   "↻ nyomaték" eszköz köríves nyíllal helyez el koncentrált nyomatékot.
   A `ToolPalette` három vizuálisan elkülönített csoportra bomlott
   (Kijelölés / Támaszok / Terhek — korábban egy sorban keveredtek). Az
   elemszám-csúszka maximuma 48→100 (a P16 mérés szerint bőven belefér
   teljesítményben).
4. **Pontos érték megadása szövegmezővel**: a Fesztáv és minden
   teher-csúszka (P, M, q₁, q₂) mellett egy szerkeszthető számmező
   (`components/Field.tsx` `NumberInput`) jelent meg — szabad tizedes
   beírást enged (pl. `11.34`), a tényleges commit blur-kor/Enterre történik,
   min/max-ra vágva.
5. **Bővített szelvény- és anyagkatalógus** (`fem-db`): +8 szelvény (IPE
   160/220/270/360, HEA 160/300, HEB 200, UPN 120, plusz egy Ø150 kör és egy
   200×400 téglalap paraméteres alak) és +4 anyag (S420/S460 nagyszilárdságú
   acél — MSZ EN 10025-4; C18/C30 szerkezeti fűrészáru — MSZ EN 338). Minden
   új I/HEA/HEB szelvény átment a `sections.test.ts` geometriai
   önellenőrzésén (±6%-os A/I egyezés a névleges kontúrból számított
   értékkel) — 10→18 szelvény-teszt. A bizonytalanabb (U-szelvény, fa)
   adatok itt is `verified: false`-ként, a meglévő UPN/C24-konvencióhoz
   híven.
6. **"A diplomatervről" a Súgóban**: 693 szavas összefoglaló a `TheoryView`
   új `about` témájaként (szerző, konzulens, Timoshenko-elem, frontális
   megoldó, kétféle képlékenységi modell, REFORB, tehermentesítés/beállás,
   korabeli jelentőség) — a diplomaterv tényleges tartalma alapján, nem
   kitalálva.
7. **Betűméret-hangolás a vásznon és a diagramokon**: több iterációban
   véglegesítve — a MODELL-vászon feliratai (terhek, méretkóta) **15px**-re,
   a diagramok (M/T/w/φ, teher–elmozdulás, konvergencia — cím, szélsőérték-
   felirat, tengelyfeliratok, a metszet-kiolvasó sor) egységesen **13px**-re
   állítva. A "Modellvászon" felirat "MODELL"-re rövidítve.
8. **A modell-vászon kitölti a rendelkezésre álló helyet, gombos zoom**: a
   vászon SVG viewBox-magassága `ResizeObserver`-rel a konténer tényleges
   méretarányát követi (korábban a rögzített 1200×420 arány "meet" miatt
   üres sávot hagyott, ha a panel aránya eltért ettől) — a tengely és minden
   réteg (`useModelTransform.ts` `axisY` felülírható paraméterrel) arányosan
   követi. Explicit **+ / − gombok** kerültek a "Nézet visszaáll." mellé (a
   meglévő görgő-zoom/húzás-pásztázás kiegészítéseként) — böngészőben
   ellenőrizve (két kattintás pontosan 1.3²=1.69×-es nagyítást ad). **Korlát:**
   a `ResizeObserver`-alapú kitöltés vizuális hatását EBBEN a munkamenetben
   nem lehetett képernyőn ellenőrizni, mert a böngésző-panel technikai okból
   nem komponál képkockákat (ugyanez okozza, hogy a screenshot-eszköz is
   következetesen időtúllépést jelez) — egy izolált teszt-elemmel igazolva,
   hogy ez a munkamenet korlátja, nem a kód hibája; a kód biztonságos
   alapértelmezésre (a régi, fix 1200×420 arányra) esik vissza, ha a
   megfigyelő valamiért nem futna le.
9. **5 új statikai minta (5→10)**: a `PresetEntry` sémája `extraLoads`
   mezővel bővült (trapéz megoszló teher és/vagy nyomatékteher relatív
   pozícióval), hogy az új minták ki tudják használni a 3. pontban bővített
   teherfajtákat. Új minták: **Befogott-csuklós tartó** (fixed+pinned —
   klasszikus statikailag határozatlan eset, eddig hiányzott), **Kinyúlásos
   tartó** (túlnyúló végekkel, támaszok 0.15L/0.85L-nél), **Kéttámaszú
   tartó nyomatékteherrel**, **Kéttámaszú tartó trapéz teherrel**,
   **Konzol megoszló és végponti teherrel egyszerre**. Mindegyiket
   böngészőben lefuttatva (nincs hiba, `ΣFz`/`ΣMy` egyensúly pontosan
   teljesül minden esetben — pl. a trapéz mintánál 10→40 kN/m, 12 m
   fesztávon: `R(0)+R(12) = -120-180 = -300 kN`, pontosan a trapéz alak
   `(10+40)/2·12 = 300 kN` eredőjével egyezik). **Korlát:** egyik új
   mintához SEM készült dedikált zárt alakú `fem-validation` eset (a
   `ref` mezőjük "—") — a helyesség jelenleg csak a böngészős
   egyensúly-ellenőrzésre támaszkodik, nem automatizált regressziós tesztre.
10. **Belső csukló (Gerber-/háromcsuklós tartó) és törttengelyű (valódi,
    nem egyenes vonalú) gerenda TUDATOSAN elhalasztva** — mindkettő a
    jelenlegi szigorúan 1D (csak `x` koordinátás, keret-elem nélküli)
    modell határait feszegetné (belső csukló: új többpontos kényszer/
    csomópont-összekapcsolási mechanizmus; törttengely: teljesen új,
    2D keretelem-formuláció axiális szabadságfokkal) — felhasználói
    egyeztetés alapján KÜLÖN, saját fázisként ütemezendő, ha aktuálissá
    válik.
11. **VALÓDI hiba javítva — fiber-réteg szélesség** (`ADR-0014`): egy
    külső felülvizsgálat (a felhasználó által megküldött, IPE300 konzolra
    készült levezetés-dokumentum kritikája) 3 lehetséges hibát vetett fel;
    az érdemi vizsgálat szerint 1 VALÓS volt, 2 NEM: (1) a `generateLayers()`
    a rétegszélességet KÖZÉPPONTI mintavétellel adta, ami I-szelvénynél
    (gerinc/öv törésponton átnyúló rétegnél) 16 rétegnél ~39-44%-kal
    túlbecsülte a területet, ~46-52%-kal az inerciát — MÉRVE, a felülvizsgáló
    saját számaival egyezően; javítva terület-megőrző almintavételezéssel
    (0,07%/4,6%-ra csökkentve a hibát), mutációs próbával igazolva, ÚJ
    regressziós teszttel lefedve (a régi tesztkészletnek eddig vak foltja
    volt erre az esetre). (2) A Kₑ elemi merevségi mátrix ÁLLÍTÓLAGOS
    aszimmetriája (`Ke[1,4]≠Ke[4,1]`) NEM reprodukálható — a mátrix
    szerkezetileg (nem csak méréssel) szimmetrikus (`addOuterProduct()`
    egyszerre írja mindkét indexet), és az `element.test.ts` explicit
    szimmetria-tesztje is őrzi. (3) A levezetés 6. (lineáris, λ=1, teljes
    névleges teher) és 7. (nemlineáris, tényleges első-folyás λ) fejezetének
    látszólagos nyomaték-eltérése NEM ellentmondás, hanem a dokumentum
    TUDATOSAN elkülönített két számítása — a lineáris fejezet szándékosan
    mutatja meg a "mi lenne, ha rugalmas maradna" (Mₚ-t meghaladó) nyomatékot,
    éppen azért, hogy indokolja, miért kell nemlineáris számítás.

12. **Második külső felülvizsgálat — réteg-mintavétel maradék hatása és
    alapértelmezett rétegszám emelése 16→32** (`ADR-0014` folytatása): egy
    MÁSODIK, részben átfedő felülvizsgálat érkezett ugyanarra a
    dokumentumra; a felhasználó kifejezetten kérte, hogy a már javított
    16-rétegű területi/inerciahibát (10. pont) hagyjam ki, csak az ÚJ
    állításokat vizsgáljam. (1) Az első-megfolyás λ-ja (≈0,262) nem
    egyezett a modell saját, zárt alakú Mₑ-jéből várt λ-val (≈0,233) — a
    felülvizsgáló ezt a legszélső réteg `z`-jének (140,63 mm a valódi 150 mm
    helyett) tulajdonította. A vizsgálat kimutatta: ez NEM önálló hiba,
    hanem a MÁR JAVÍTOTT területi/inercia-hiba (11. pont) LÁNCOLT
    tünete volt — a felfújt `EI` kisebb görbületet (`κ=M/EI`), ezáltal
    kisebb feszültséget (`σ=Eκz`) adott adott nyomatéknál, ami KÉSLELTETTE
    az első-folyás detektálását; a 11. pontban leírt szélesség-javítás
    (a `z` érintetlenül hagyása mellett) ezt a tünetet is nagyrészt
    megszüntette, empirikusan igazolva (előtte/utána számokkal). (2) Az
    egyéb megfigyelések (Gauss-pontok illeszkednek a lineáris ábrára,
    `ΣFz=0`/`ΣMy=0`, `Ke[1,1]` részlet, reziduál-ugrás a teherhatáron)
    megerősítő jellegűek voltak, nem hibajelzések. A felülvizsgáló saját
    ajánlása alapján (32-64 réteg <1%-os pontossághoz) a felhasználó
    jóváhagyásával az alapértelmezett rétegszám (`LAYER_COUNT`,
    `packages/ui/src/model/nonlinear.ts`) **16-ról 32-re emelve** — ez a
    réteg-középponti mintavétel MÁSODRENDŰ maradék hatását (a 11. pontban
    mért 4,6%-os inercia-eltérés) tovább, <1%-ra csökkenti. Teljesítmény-
    hatás ellenőrizve: a P16 UI-méretskála-teszt (100 elem, 32 réteg, 402
    DOF) 485,9 ms alatt fut — a korábbi (16 réteges) méréshez képest
    elhanyagolható növekedés, bőven a gyakorlati határon belül.
    **Mellékhatásként javított, VÁRT (nem regressziós) tesztváltozások:**
    a `derivationData.test.ts` egy szimmetrikus (páros elemszámú, kéttámaszú,
    egyenletes teher) modell közép-elem-kiválasztási tesztje korábban egy
    KONKRÉT elemet várt el ott, ahol a valódi fizikai szimmetria miatt a
    két középső elem Gauss-ponti `|M|`-je elméletileg egyenlő, és a tényleges
    "nyertes" a rétegszámtól (is) függő lebegőpontos kerekítés whiskerén
    múlik — a teszt mindkét szimmetrikus középső elemet elfogadja mostantól,
    nem csak az egyiket.

13. **Vizuális frissítés (szín, betűtípus, logó) és mobil-navigáció**: a
    felhasználó kifejezett kérésére, a "klasszikus CAE munkaasztal"
    (`DESIGN-TERV.md` A-variáns) elrendezésének és a mechanikai jelentésű
    `--sem-*` színeknek a megtartása mellett, KÉT iterációban (az első kör
    után a visszajelzés "alig változott valami" volt): (a) az akcentusszín a
    hideg kékről (`#1f5c9e`) meleg téglavörösre (`#b5573a`) váltott, majd a
    teljes semleges felület-paletta (`--surface-*`/`--border-*`/`--text-*`)
    is melegebb homok-bézs árnyalatra (`tokens.css`, `DESIGN-TERV.md` 2.1) —
    a `DerivationView`/`ReportView` saját, elszigetelt dokumentum-palettája
    szándékosan változatlan maradt; (b) `--font-ui` elsőként `Inter`-re
    váltott, majd (mivel ez túl hasonló volt az `IBM Plex Sans`-hoz) egy
    markánsabb, geometrikus `Space Grotesk`-re (`--font-mono`/`--font-serif`
    változatlan). (c) **Mobil-navigáció**: a `DESIGN-TERV.md` 3.3 pontja már
    2026-08-20 óta előírta a <768px "egy oszlop, fülekkel: Modell / Vászon /
    Eredmény" viselkedést, de ez eddig NEM készült el — a tényleges kód csak
    eltüntette a jobb (majd bal) panelt, visszanyitási lehetőség nélkül, ami
    a modell-szerkesztést és az eredményeket teljesen elérhetetlenné tette
    telefonon. Most: `appStore.ts` új `mobileTab` állapota + 3 fület mutató
    sáv (`App.tsx`, csak <768px-nél látszik, `data-mobile-tab` attribútummal
    vezérli, melyik panel aktív) — böngészőben, mobil (375px) és asztali
    (1440px) nézetben is ellenőrizve (JS-alapú kattintás-szimulációval, mert
    a böngésző-panel képkocka-komponálási korlátja miatt a valódi
    kattintás-eszköz időtúllépést ad — ld. 8. pont korábbi korlátja): mobil
    nézetben alapból a Vászon aktív, mindhárom fül helyesen vált panelt,
    1440px-nél a fülsáv rejtve marad és mindhárom panel egyszerre látszik
    (nincs regresszió). (d) **Logó** (`components/Logo.tsx`, új): a
    felhasználóval közösen kiválasztott "csomóponti-V" koncepció — egy
    lehajlott gerenda-görbe végeselem-csomópontokkal, ami a Timoshenko-
    gerenda lehajlását ÉS a végeselemes diszkretizációt is idézi, formája
    pedig "V"-ként (FEMAti) olvasható. **Fontos korlát:** a BME hivatalos
    címerét/logóját NEM próbáltuk újrarajzolni (nincs hiteles forrás rá, egy
    egyetemi védjegy közeli utánzása félrevezető lenne) — helyette egy
    visszafogott "BME · 1996" szöveges plakett szerepel a `variant="full"`
    változatban, ahogy szakdolgozatoknál szokás az affiliációt jelezni. A
    kis `variant="mark"` (BME-felirat nélkül, mert 20px-en úgysem lenne
    olvasható) a fejléc `.vem-chrome__brand`-jébe és a favicon
    (`public/favicon.svg`) alapjába került; a teljes, plakettes változat a
    "Súgó → A diplomatervről" oldal fejlécébe (ahol amúgy is BME/1996/
    konzulens-információk szerepelnek). `pnpm check` mindvégig teljes zöld
    maradt (392/21/28/47 teszt).

14. **Izometrikus 3D-feszültség-vizualizáció** (`ADR-0015`, új): a felhasználó
    egy valódi kontinuum-FEA von Mises kontúrképet mutatott, és megkérdezte,
    tud-e a FEMAti ilyen látványos kimenetet adni. A válasz OSZINTE
    tisztázással kezdődött: a FEMAti szigorúan 1D gerendaelem-modell, nincs
    2D/3D kontinuum-hálója, ezért geometriai törésponti (gerinc/öv sarki)
    feszültségkoncentrációt NEM tud adni — ez más motort igényelne. Két
    megvalósítási irány közül (SVG-alapú izometrikus extrudálás vs.
    Three.js/WebGL) a felhasználóval egyeztetve az SVG mellett döntöttünk
    (nem tör a "klasszikus CAE" design-elvvel, nincs új nehéz függőség), majd
    3 színezési koncepció közül (folytonos gradiens / diszkrét sávos kontúr /
    meglévő 3 `--sem-*` szín újrahasznosítása) a felhasználó a folytonos
    gradienst választotta. Eredmény: `charts/Beam3DStress.tsx` — a szélső
    szálon (`z=±h/2`) számolt VALÓDI, élő lineáris eredményből vett
    `σ=M(x)·z/I` hajlítófeszültséget jeleníti meg egy sematikus (téglatest-
    burkoló, NEM a tényleges szelvényalak) izometrikus extrudáláson, 36
    szegmensre bontva, 5 megállós "jet" színskálával. Új "3D feszültség" fül
    a diagramsávon (`DiagramTab` unió + `DiagramPanel` elágazás, ugyanaz a
    minta, mint a `load-displacement`/`convergence` füleknél). A komponens
    fejléc-kommentje és a látható `<title>` is explicit kimondja a sematikus-
    geometria korlátot, hogy a felület ne keltsen hamis benyomást kontinuum-
    FEA pontosságról. Böngészőben ellenőrizve (72 polygon = 36 szegmens × 2
    lap, legend `0`–`σ_max MPa`, a σ_max nagyságrendileg egyezik az `M·z/I`
    kézi számítással). `pnpm check` teljes zöld (392/21/28/47 teszt) — a
    fejlesztés közben egy lint-hiba (4× tiltott non-null assertion) is
    felszínre került és javításra került.

15. **Harmadik külső felülvizsgálat — mindhárom fennmaradó állítás
    NEM valódi hiba**: a levezetés-dokumentum v2 (32-rétegű, ADR-0014
    javítás utáni) változatára érkezett egy harmadik kritika, 3 fennmaradó
    ponttal (a keresztmetszeti javulást a felülvizsgáló maga is elismerte,
    ezt nem kellett újra vizsgálni). Mindhárom állítást egy háttér-Explore
    ügynökkel, a TÉNYLEGES forráskód és számok alapján ellenőriztük. (1) A
    Kₑ-aszimmetria ISMÉTELT állítása (most Kₑ[1,4]=+1,146e5 vs.
    Kₑ[4,1]=−1,146e5, ELŐJEL-eltéréssel) SZERKEZETILEG LEHETETLEN az
    `addOuterProduct()` kódjából (`K[i][j]` és `K[j][i]` ugyanabból a `v`
    skalárból íródik, egyetlen utasításban) — a `symmetryDefect()` teszt
    zöld, nincs a formulában olyan antiszimmetrikus csatolási tag, ami ezt
    magyarázná. (2) A 249,22%-os "hibajelző-ugrás" (E8 elemhatár) NEM a
    végeselem-megoldás folytonosságát méri, hanem az átlagolás ELŐTTI,
    elemenként önálló extrapoláció eltérését, a mező szélsőértékére
    normálva — ez egy MODERN (nem a diplomatervben szereplő) kiegészítés
    (`docs/THEORY.md`), és a saját tesztkészlet (`errorEstimator.test.ts`)
    egy degenerált esetben 400%-ot is helyesnek fogad el ugyanezzel a
    képlettel — egy durva (16 elem), belső támasz melletti, képlékeny
    átrendeződést mutató hálónál 100% fölötti érték DOKUMENTÁLTAN várható.
    (3) A 6. (rugalmas, λ=1,0, `data.linear`) és 7. fejezet (képlékeny
    lépcsőzés, itt λ=1,1) nyomaték-eltérése UGYANAZ az apples-to-oranges
    minta, mint az ELSŐ felülvizsgálati kör már tisztázott állítása — a két
    fejezet nem ugyanazt a teherszintet mutatja. Ráadásul a konkrét Gauss-
    pont (E8 elem 1. pontja, x=6,085 m) a hálógeometriából (8 elem/6 m
    nyílás, 3 pontos Gauss, ξ=−√0,6) LEVEZETHETŐEN 0,085 m-rel a támasz
    (x=6,0 m) mögött van, ahol a nyomaték már csökken — a kisebb érték
    (123,97 vs. Mₚ≈141 kNm) ezért matematikailag elvárt, nem hiba.
    **Forráskód-módosítás nem történt** — csak ez a napló-bejegyzés (a
    korábbi két kör mintáját követve, a nem-hiba állításokat is
    dokumentáljuk, hogy a jövőbeli felülvizsgálatok ne ismételjék meg
    ugyanazt a vizsgálatot).

16. **V-13 validációs eset — befogott-csuklós tartó, egyenletes teherrel**
    (`fem-validation/src/cases/v13-befogott-csuklos-egyenletes-q.ts`): a
    felhasználó megküldött egy külső szakirodalmi PDF-et (Ahmed & Rifai,
    2021, "Euler-Bernoulli and Timoshenko Beam Theories: Analytical and
    Numerical Comprehensive Revision"), és megkérdezte, beépíthető-e belőle
    valami. A cikk zárt formulái nagyrészt már validáltak (pl. a `V-02`
    kéttámaszú-UDL teszt PONTOSAN ugyanazt a hajlítási+nyírási zárt alakot
    használja) — de a cikk VI. táblázata (Fixed-Hinged Beam, azaz befogott-
    csuklós tartó UDL-lel) egy KORÁBBAN DOKUMENTÁLT hiányosságot fedett fel:
    a P18 után felvett "Befogott-csuklós tartó" UI-mintához (9. pont) eddig
    nem készült dedikált zárt alakú validációs eset. A cikk nyomtatott
    képlete OCR-hibáktól szenvedett, ezért a formulát SAJÁT erőmódszeres
    levezetéssel kaptuk (redundáns reakció a csuklós támasznál, hajlítási ÉS
    nyírási hajlékonysággal) — az Euler-Bernoulli-határesetben (Φ→0) a
    levezetés a klasszikus tankönyvi `X_B=3qL/8`, `M_A=qL²/8` eredményt adja
    vissza, a Timoshenko-esetben pedig a cikk saját (t/L=0,3, k_s=5/6,
    ν=0,3) paramétereivel behelyettesítve NUMERIKUSAN TELJES EGYEZÉST adott
    a cikk táblázatával (M_A/qL²=0,1168, 4 tizedesjegyig) — ez kölcsönösen
    megerősíti a saját levezetést és a cikk táblázatát is. A tesztet a
    tényleges szoftverrel is leellenőriztük (a reakcióerő és -nyomaték a
    képlettel 1e-6 relatív tűréssel egyezik). `pnpm check` teljes zöld
    (392/29/21/47 teszt, fem-validation 28→29).

17. **VALÓDI hiba javítva — a diagramsáv fix magassága eltakarta a füleket**
    (`shell.css`): a felhasználó jelezte, hogy a "3D feszültség" fülről nem
    lehet visszakattintani M-re vagy T-re. A vizsgálat kimutatta: a
    `.vem-diagram-bar__body` CSS-ben FIX `132px` magasságú volt,
    `overflow` vágás nélkül — ez pontosan a `CHART_HEIGHT` (M/T/w/φ)
    értékére volt hangolva, de a `Beam3DStress` (`STRESS3D_HEIGHT=300`) és
    valójában már KORÁBBAN is a "teher–elmozdulás"/"konvergencia" fülek
    (`LD_CHART_HEIGHT`/`CONVERGENCE_HEIGHT=200`) is túllógtak ezen a fix
    dobozon — középre igazítva, felfelé ÉS lefelé egyaránt kilógva. A
    200px-es eset (68px túllógás) észrevétlen maradt, a 300px-es (168px
    túllógás) viszont teljesen eltakarta a 32px magas fülsávot. Javítva: a
    `height: 132px` helyett `min-height: 132px` — a doboz mostantól a
    ténylegesen aktív fül tartalmához igazodik (böngészőben ellenőrizve
    mind a 4 érintett fülnél: M után 3D, majd vissza M-re — a kattintás a
    helyes elemet találja el minden esetben, `document.elementFromPoint()`
    igazolva). `pnpm check` teljes zöld maradt (392/29/21/47).

18. **Támaszok/Terhek — külön, ikonos itemlisták a bal panelen**: a
    felhasználó korábban kérte (nem az aktuális beszélgetésben rögzítve,
    de a kérést most megismételte), hogy a támaszok és a terhek külön
    panelen, egyenként, kis ikonnal jelenjenek meg — eddig ezek csak a
    "Modellfa" fában egy-egy összefoglaló szöveges sorban ("N támasz",
    "P=20, q=15…") szerepeltek, egyedi elemként nem voltak kattinthatók
    vagy megkülönböztethetők. Új: `panels/icons.tsx` (kompakt 16×16 SVG
    ikonok — `SupportIcon` a 3 támasztípushoz [befogás/csuklós/görgős] a
    vászon-jelek `--sem-support` színével, `LoadIcon` a 3 teherfajtához
    [pont/nyomaték/megoszló] `--sem-load` színnel, UGYANAZOKKAL a
    színekkel, mint a modellvászon, csak listasor-méretben) és két új,
    önálló `SectionLabel`-es szekció a `LeftPanel`-ben ("Támaszok",
    "Terhek") a "Modellfa" tree alatt — minden sor ikon + pozíció +
    érték (pl. "x = 6.00 m · görgős", "0.00–12.00 m · q = 30 kN/m"),
    kattintásra kiválasztja a modellt (`select({kind,id})`), ami a már
    meglévő `SelectionSheet` szerkesztőt nyitja meg — ÚJ mechanizmus nem
    kellett, csak a meglévő kiválasztás-állapotra kötött, itemesített
    megjelenítés. Böngészőben ellenőrizve: mindkét lista helyesen
    renderel (ikonokkal), sorra kattintva a "Kijelölt támasz" szerkesztő
    megnyílik és a sor `aria-selected` kiemelést kap. `pnpm check` teljes
    zöld (392/21/29/47 — a lassú rendszermemória miatt csomagonként
    külön futtatva, nem a szokásos egybe-`pnpm check`-kel, de tartalmilag
    azonos ellenőrzés).

19. **Támasz/teher hozzáadás — lebegő eszközpanelek a vászon fölött**: a
    18. pontban a felhasználó pontosított — nem a MEGLÉVŐ támaszok/terhek
    listázására gondolt (azt már megoldottuk), hanem arra, hogy amikor ÚJ
    támaszt vagy terhet szeretne felvenni, a hozzá tartozó eszközök
    ("csuklós"/"görgős"/"befogás" ill. "pontteher"/"nyomaték"/"megoszló")
    2 KÜLÖN, LEBEGŐ panelre kerüljenek a modellvászon fölött, nem egy
    közös eszközsorba. A `ToolPalette.tsx`-ben eddig egy sorban élt 3
    csoport (Kijelölés / Támasz eszközök / Teher eszközök) — a "Kijelölés"
    maradt az in-flow felső eszközsorban, a Támasz- és Teher-eszközök
    pedig két új, `position: absolute` panelre kerültek (`SupportToolsPanel`
    bal felül, `LoadToolsPanel` jobb felül, a vászon `.vem-canvas-host`
    konténerén belül — újrahasznosítva a 18. pontban épített `SupportIcon`/
    `LoadIcon` ikonokat, kártya-háttérrel, árnyékkal). Böngészőben
    ellenőrizve: mindkét panel a helyén jelenik meg (nem lóg át a felső
    eszközsoron vagy a deformáció-skála feliraton), gombra kattintva az
    `aria-pressed` állapot és a kiválasztott vászon-eszköz helyesen vált.
    `pnpm check` teljes zöld (392/21/29/47, csomagonként futtatva a
    rendszermemória-terhelés miatt).

    **Azonnali korrekció:** a felhasználó jelezte, hogy az első verzió
    (ikon + szöveges felirat, függőleges lista, külön "Támasz/Teher
    hozzáadása" címsor) "nagyon nagy, mindent eltakar" — a panel
    135×239 / 126×173 px volt. Javítva: a szöveges feliratok és a
    címsor eltávolítva (a `title`/`aria-label` attribútum megtartja a
    hozzáférhető nevet és a hover-tooltipet), a gombok CSAK ikont
    mutatnak, VÍZSZINTES sorban (nem függőleges listában), 24×24px-es
    négyzetekben — a panel mérete 79,6×29,6 px-re csökkent (kb.
    1/7-ed a terület). Böngészőben újra ellenőrizve, `pnpm check`
    változatlanul zöld.

20. **Teljes sötét reskin — a "FEMAti Landing" design-referencia átvétele**:
    a felhasználó egy külön elkészült marketing-oldal (belul HTML/CSS
    forrásból, mert a `claude.ai/design/...` és `claude.ai/code/artifact/...`
    linkek egyike sem volt elérhető automatizált eszközzel — 403/bejelentkezés
    fal — végül a felhasználó bemásolta a nyers `.dc.html` forrást) design-
    nyelvét kérte átvenni: 1) háttér, 2) betűtípusok, 3) gombok, 4) árnyékolt
    modell-diagramok, 5) "amit még érdemesnek tartok". Három lehetséges
    hatókör közül ("csak elemek átvétele" / "teljes sötét reskin" / "csak a
    landing, nem az app") a felhasználó a legradikálisabbat választotta.
    A korábbi meleg/világos ("A — Klasszikus CAE munkaasztal") paletta
    lecserélve sötét ("B" variáns) palettára: `--surface-*` sötét
    (`#0d1014`/`#11151a`/`#161b21`), `--text-*` világos, `--accent`
    türkiz (`#4fd6b4`, a landing "beam glow" vonalszíne), és egy ÚJ
    tokencsoport (`--brand-gold-*`) az elsődleges gombhoz — a landing CTA-ja
    arany gradiens, vizuálisan elkülönítve az akcentustól (a türkiz marad a
    KIJELÖLÉS jele, az arany a FŐ CSELEKVÉS jele; korábban ezt a két szerepet
    egyetlen `--accent` látta el). Betűtípus-hármas cserélve: `--font-ui`
    `Space Grotesk`→`IBM Plex Sans`, `--font-mono` `IBM Plex Mono`→
    `JetBrains Mono`, `--font-serif` `Source Serif 4`→`Playfair Display`
    (utóbbinak jelenleg nincs élő felhasználási helye a munkaasztalon — a
    landing nagy H1 hero-címsorának nincs megfelelője egy sűrű CAE-
    eszközben). A `--sem-*` (mechanikai jelentésű) paletta hármas
    LOGIKÁJA VÁLTOZATLAN, csak az árnyalatok igazodtak a sötét alaphoz
    (`--sem-partial`/`--sem-plastic` a landing 3D-feszültség-diagramjának
    `barOrange`/`barRed` gradienseit követi). Felfedezett és javított
    mellékhatás: az `--accent-light` és `--sem-ok` eredetileg ugyanarra a
    türkizre esett volna — ez elmosta volna a "folyamatban" (`--status-
    running`) és a "konvergált" (`--status-converged`) állapot vizuális
    különbségét (korábban `--accent-light` világos terrakotta, `--sem-ok`
    zöld volt, tehát eleve eltért egymástól); javítva `--accent-light`-ot
    egy halványabb, deszaturáltabb türkizre (`#8ce4ce`) állítva, hogy a
    tömör `--sem-ok` türkiz (`#4fd6b4`) egyértelműen "erősebbnek" olvasson.
    A `TheoryView` "A diplomatervről" oldalán a `<Logo variant="full">`
    `theme="light"` hívása `theme="dark"`-ra váltott, mert a mögöttes
    `--surface-panel` immár sötét — a `light` logóváltozat feltételezései
    (sötét vonal világos papíron) idézőjeles témán belül ellentmondáshoz
    vezettek volna. A `DerivationView`/`ReportView` nyomtatható/exportálható
    dokumentum-palettája (`--der-*`/`--report-*`) szándékosan ÉRINTETLEN
    maradt — a jegyzőkönyv fehér papíron marad, függetlenül a munkaasztal
    témájától (ld. `DESIGN-TERV.md` 3.2/4.4). Ellenőrzés: `pnpm --filter
    @femati/ui typecheck` és `pnpm lint` zöld; böngészőben (`javascript_tool`
    computed-style kiolvasással, mert a Browser-panel screenshotja ekkor nem
    volt megjeleníthető) igazolva, hogy a `body` háttere ténylegesen
    `#0d1014`, az `IBM Plex Sans`/`JetBrains Mono` betöltött státuszú, és
    az elsődleges gomb `background-image`-e a várt arany `linear-gradient`.

21. **`Playfair Display` élő felhasználási helye — középre igazított
    fejléc-felirat**: a felhasználó kifejezetten kérte, hogy a 20. pontban
    bevezetett, de akkor még sehol nem használt `Playfair Display`
    betűtípus kapjon látható helyet, középre igazítva, "Rugalmas–képlékeny
    Timoshenko-gerenda végeselemes analízis" szöveggel. Az első
    implementáció (`position: absolute; left: 50%` a teljes fejléc-sávra
    nézve) böngészőben ellenőrizve ÁTFEDÉST okozott a menüsorral (a
    menüsor jobb széle a valódi vízszintes középpont fölé ért) — javítva
    valódi flexbox-elrendezésre: a felirat a korábbi `.vem-chrome__spacer`
    helyén, `flex: 1` elemként ül a menü és a fájlnév/státusz-klaszter
    KÖZÖTT, `text-align: center`-rel — így elvi lehetetlen az átfedés,
    mert csak a ténylegesen szabad teret tölti ki. `aria-hidden` (tisztán
    díszítő, a dokumentum `<title>`-je már hordozza ugyanezt), 900px alatt
    `visibility: hidden` (a `flex: 1` doboz megmarad, a fájlnév/státusz
    így is jobbra igazodik). Ez SZÁNDÉKOS, dokumentált kivétel a
    `DESIGN-TERV.md` 1. fejezet "nincs dekoratív elem öncélúan" elve alól
    — közvetlen felhasználói kérésre. Böngészőben `getBoundingClientRect`-
    tel igazolva: 0px átfedés a menüsorral és a fájlnévvel egyaránt;
    `pnpm --filter @femati/ui typecheck` + `pnpm lint` zöld.

22. **Shadelt (átmenetes) lehajlási görbe a vászonon**: a felhasználó
    észrevette, hogy a modellvászon lehajlási görbéje puszta vonalként
    (`fill="none"`) jelent meg, míg a design-referencia hero-
    illusztrációján a görbe alatt egy türkiz "izzás"-gradiens tölti ki a
    tengely és a görbe közti sávot. Megoldás: a `CanvasDefs`-ben (`marks.
    tsx`) két új `defs`-elem — `vem-deform-glow` (`linearGradient`,
    `--sem-deformed` színből 0,32→0 opacitásra) és `vem-beam-shadow`
    (`feDropShadow`-alapú finom mélység-szűrő a vonalra). A `ModelCanvas.
    tsx`-ben a meglévő `deformedPath` (nyitott törtvonal) MELLÉ egy új,
    ZÁRT `deformedFillPath` épül — ugyanazok a csomópontok, de a végén
    visszazárva a tengelyre (`L...,axisY L...,axisY Z`) —, ami a
    gradienssel kitöltve, a stroke-only görbe ALATT renderelve adja a
    "shaded" hatást. Csak akkor rajzolódik, ha van tényleges eredmény
    (`deformedNodes` null-check, `noUncheckedIndexedAccess`-biztos, nem
    `!`-asszerció — az első verzió ütközött az ESLint
    `no-non-null-assertion` szabályával, javítva opcionális láncolással
    kinyert `firstDeformedNode`/`lastDeformedNode` változóra). Ellenőrzés:
    `pnpm --filter @femati/ui typecheck`, `pnpm lint`, `pnpm --filter
    @femati/ui test` (47/47) mind zöld; böngészőben (a Browser-panel
    screenshotja ekkor sem volt megjeleníthető, ezért DOM-lekérdezéssel)
    igazolva, hogy a `url(#vem-deform-glow)` kitöltésű zárt `<path>` és a
    `url(#vem-beam-shadow)` szűrős körvonal-`<path>` ténylegesen a
    dokumentumban van, helyes `d`-attribútummal.

23. **Önreflektív code review (két tengelyen, párhuzamos subagentekkel) —
    4 hiba javítva**: a felhasználó kifejezetten kérte, hogy a 20-22.
    pontban leírt reskin-köteget nézzem át "profi Senior szoftverfejlesztő"
    szemmel. A `code-review` skill "Standards" (repó-szabályok + Fowler-
    szagteszt) és "Spec" (mit kért a felhasználó szó szerint) tengelye
    mentén két párhuzamos subagent vizsgálta a `HEAD~1...HEAD` diffet
    (a `4eea7d9` commit). Talált és JAVÍTOTT hibák:
    - **Nyers hex a `DESIGN-TERV.md` "soha nem írnak be nyers hex-értéket"
      szabálya ellenére** (`marks.tsx`, `feDropShadow floodColor="#000"`):
      új `--shadow-flood` tokenre cserélve (`tokens.css`), a duplán számoló
      `floodOpacity` attribútum törölve (a token már hordozza a saját
      alfáját). Ellenőrizve: az SVG `flood-color` prezentációs attribútum
      ténylegesen felold egy `var(--...)`-t böngészőben (`computed
      flood-color: rgba(0,0,0,0.45)`), ugyanúgy, ahogy a fájl többi
      `stroke={SUPPORT}`/`stopColor="var(--sem-deformed)"` mintája már
      eddig is támaszkodott erre.
    - **Holt CSS** (`components.css`): `.vem-tool-groups`/
      `.vem-tool-groups__divider` — a `ToolPalette.tsx` már nem rendereli
      a wrappert, amióta a támasz-/teher-eszközök külön lebegő panelekre
      kerültek (19. pont) — eltávolítva.
    - **Láthatatlan kártya-árnyék sötét alapon** (`tokens.css`):
      `--shadow-card` a világos-paletta korára hangolt `rgba(0,0,0,0.06)`
      értéken maradt a teljes reskin után — `rgba(0,0,0,0.4)`-re, nagyobb
      elmosásra erősítve.
    - **Nem kért tartalomvesztés** (`App.tsx`/`shell.css`): a Playfair-
      fejléc (21. pont) bevezetésekor a régi `.vem-chrome__subtitle`
      ("Timoshenko gerenda · rugalmas–képlékeny analízis") szöveg
      TELJESEN kikerült, amit senki nem kért — visszaállítva a márka-
      klaszterbe, a középre igazított Playfair-felirat MELLETT (két külön
      szerepű elem: a subtitle a márkajel-hez tartozó leírás, a headline
      díszítő "hero"-cím).
    - **Dokumentált, NEM javított megfigyelés**: a "gombok" (request 4)
      kérés csak a `.vem-btn--primary`-t kapta arany gradienst — a
      `.vem-segmented__item`/`.vem-floating-panel__btn` aktív állapota
      türkiz maradt. Ez a felülvizsgálat szerint egy szigorú "minden gomb
      legyen arany" olvasat mellett hiányos, DE ez saját, dokumentált
      szándékos döntésem volt (türkiz=kijelölés, arany=fő cselekvés,
      ld. 20. pont) — a felhasználó ezt eddig NEM kifogásolta, ezért
      NEM változtattam meg egyoldalúan; ha a felhasználó máshogy akarja,
      külön kérésre javítható.
    Ellenőrzés mind a négy javított tételre: `pnpm --filter @femati/ui
    typecheck` + `pnpm lint` + `pnpm --filter @femati/ui test` (47/47)
    zöld; böngészőben DOM-lekérdezéssel igazolva, hogy a subtitle
    látszik és nem ütközik a menüvel/fejléccel, a `.vem-tool-groups`
    CSS-szabály nincs többé egyetlen stíluslapban sem, és a
    `--shadow-flood`/`--shadow-card` tokenek az új értéket adják vissza.

24. **Külső forrás elleni ellenőrzés — a régóta hiányzó V-04 (locking)
    validációs eset PÓTLÁSA**: a felhasználó megadott egy MathWorks-oldalt
    (Symbolic Math Toolbox, "Finite Element for Timoshenko Beam") és kérte,
    hogy vizsgáljam meg, van-e benne olyan elméleti anyag, amit a saját
    `fem-core`-unk nem vesz figyelembe. Sorról-sorra összevetve: az
    alakfüggvények (`shapeFunctions.ts`), a B-mátrix/gyenge alak
    (`bMatrix.ts`), a nyírási korrekciós tényező (α=5/6 téglalapra) mind
    egyeznek a MathWorks-levezetéssel — a záródás elleni védelemben pedig
    TÚL is teljesítjük: ők KIZÁRÓLAG a kvadratikus elemrendre hagyatkoznak,
    mi kvadratikus elem + szelektív redukált integrációt is használunk.
    Eközben viszont egy VALÓDI, korábbi hiányosság derült ki: a
    `docs/THEORY.md` és a `STATUS_REPORT.md` (5. szakasz) évek óta
    "kész, zöld"-ként hivatkozott egy **"V-04 locking-teszt"**-re — de a
    `fem-validation/src/cases/` mappában SOSEM létezett `v04-*.ts` fájl (a
    lista V-03-ról egyenesen V-05-re ugrott), és a `docs/THEORY.md` egy
    olyan `element.test.ts` fájlra hivatkozott, ami a `fem-core`
    forrásfában SOSEM létezett. Az `index.ts` saját kommentje maga is
    elismerte: "A V-04 (locking) validációs esete a P13+ fázisokban kerül
    ide" — tervezve volt, de sosem készült el.
    Megírtam a VALÓDI V-04-et (`v04-locking.ts`): kéttámaszú tartó,
    egyenletes q, szándékosan DURVA (2 elemes) háló, L/h=10…10000
    karcsúsági söpréssel, `selective` ÉS `full` sémán is lefuttatva.
    Mielőtt a küszöbértékeket rögzítettem volna, egy dobozon kívüli
    (`test/`-be ideiglenesen áthelyezett, majd törölt) scratch-teszttel
    LEMÉRTEM a tényleges hibaértékeket, hogy ne találjak ki hamis
    tűréseket: `selective`-nél a relatív hiba minden karcsúságnál
    ~1e−15…~9e−9 marad (gépi pontosság, NEM nő a karcsúsággal), `full`-nál
    viszont ~12%-ról egy ~20%-os platóra fut be és OTT MARAD — ez maga a
    záródás matematikai aláírása (egy jól kondicionált elem hibájának el
    kellene tűnnie, ahogy a nyírási tag elhanyagolhatóvá válik, a `full`
    séma ehelyett makacsul megtartja). Három ellenőrzés: (1) max
    `selective`-hiba ≤ 1e−6, (2) min `full`-hiba a [0.05, 1] sávban (SOSEM
    tűnik el), (3) a kettő aránya a [1000, 1e12] sávban (a tényleges mért
    érték ~1.3e7 — bőséges margóval mindkét irányban). Bekötve az
    `allCases()`-ba (V-03 és V-05 közé); a `docs/VALIDATION.md` a teszt
    futásakor automatikusan újragenerálódik, benne a V-04 táblázatával. A
    `docs/THEORY.md` hamis `element.test.ts`-hivatkozása javítva a valódi
    fájlnévre, dátumozott magyarázó jegyzettel. Ellenőrzés: `pnpm --filter
    @femati/fem-validation typecheck` zöld; a teljes `fem-validation` csomag
    vitest-futása 29→**30/30 zöld**, benne a V-04-gyel.

25. **"Diplomaterv '96" — teljes matematikai összefoglaló az Elmélet
    menüben**: a felhasználó kérte, hogy az "Elmélet" menüpont ELSŐ helyére
    kerüljön egy "Diplomaterv '96" nevű téma, aminek tartalma egy teljes,
    következetes matematikai összefoglaló a teljes levezetésről, akár több
    "oldalon" (szakaszon) keresztül. Bekötve: `appStore.ts`
    (`TheoryTopic` union bővítve `'thesis96'`-vel, ez lett az alapértelmezett
    helyett is FELTÉTEL NÉLKÜL az első `TOPICS`-bejegyzés — de a store
    `theoryTopic` alapértéke maradt `'timoshenko'`, a menüsorrend viszi az
    elsőbbséget), `App.tsx` (a menü `items` tömbjében a "Diplomaterv '96"
    lett az első `Elmélet`-almenüpont, `separatorAfter` a régi elsővel
    elválasztva), `TheoryView.tsx` (új `CONTENT['thesis96']` bejegyzés ~13
    számozott szakasszal — kinematika, izoparametrikus elem, B-mátrix,
    integráció/záródás, elem-merevségi mátrix, globális rendszer +
    peremfeltételek, teherfüggvények, lineáris megoldás, keresztmetszeti
    jellemzők, eredő szintű rugalmas-képlékeny modell, rétegelt/fiber
    keresztmetszet, nemlineáris Newton-Raphson megoldó, záró összefoglaló —
    minden képlet és oldalszám-hivatkozás közvetlenül a korábban beolvasott
    `docs/THEORY.md`-ből forrásolva, hogy garantáltan konzisztens maradjon a
    projekt saját dokumentációjával), új `Section` segédkomponens a
    szakaszcímekhez, `theory.css` (`.vem-theory__section`/`-num` új
    stílusszabályok, számozott, ékezetes felső szegéllyel elválasztott
    fejezetcímekhez). Ellenőrzés: `pnpm --filter @femati/ui typecheck` +
    `pnpm lint` + `pnpm --filter @femati/ui test` (47/47) zöld; böngészőben
    megnyitva a "Diplomaterv '96" oldalt, `get_page_text` igazolta az 1-7.
    szakaszok helyes magyar szövegét és a KaTeX-képletek helyes
    struktúráját, majd egy közvetlen DOM-lekérdezés (`document.
    querySelectorAll('.katex-error')`) megerősítette, hogy a teljes oldalon
    (mind a 13 szakaszban, beleértve a rétegelt keresztmetszet és a
    Newton-Raphson szakaszok összetettebb képleteit is) **0 KaTeX
    parse-hiba** van, összesen 23 renderelt képlettel.

26. **Nyitott kérdés / jövőbeli ADR-téma — alternatív, statikus kondenzációs
    Timoshenko-elem (FCQ)**: a felhasználó megadott egy tudományos cikket
    (Caillerie, Kotronis, Cybulski: "A Timoshenko finite element straight
    beam with internal degrees of freedom", *Int. J. Numer. Anal. Methods
    Geomech.*, 2015, 39(16), pp. 1753–1773, DOI: 10.1002/nag.2367,
    https://hal.science/hal-01161516), amit áttekintettem a saját
    elméletünk hiányosságai szempontjából. NEM hibát vagy hiányzó
    alapelméletet tár fel, hanem egy ALTERNATÍV elemtechnológiát a
    záródás kezelésére: 2 csomópontos elem, kubikus alakfüggvény `w`-re,
    kvadratikus `φ`-re, 3 belső szabadságfok elemenként STATIKUS
    KONDENZÁCIÓVAL eliminálva, zárt alakban (szimbolikusan) integrált
    merevségi mátrix — emiatt a szerzők bizonyítása szerint TETSZŐLEGES
    megoszló teherre és peremfeltételre EGY elem pontos csomóponti
    megoldást ad (erősebb állítás, mint a mi szelektív redukált
    integrációnk, ami csökkenti, de nem szünteti meg a hibát, és
    hálófinomítást igényel). A mi jelenlegi elemünk (3 csomópontos
    kvadratikus izoparametrikus, mindkét mezőre azonos rend, szelektív
    redukált integráció — `timoshenko3.ts`, `shapeFunctions.ts`) egy
    másik, ugyancsak elfogadott család; a statikus kondenzáció technikáját
    a `fem-core` jelenleg nem használja. A felhasználó döntése: ez egy
    NYITOTT kérdés, később eldöntendő, hogy ez a technológia bármilyen
    formában (pl. csak dokumentációs kereszthivatkozásként, vagy tényleges
    alternatív elemként egy külön ADR mögött) bekerüljön-e a projektbe.
    Egyelőre SEM kód, SEM `docs/THEORY.md`-változtatás nem történt —
    kizárólag ez a bejegyzés rögzíti a témát jövőbeli hivatkozásra.

27. **A díszítő cím-tipográfia áthelyezése + iteratív finomítása**: a
    felhasználó kérésére a fejlécből (`.vem-chrome__headline`) átkerült
    az eszközsorba (`Toolbar.tsx` / `.vem-toolbar__headline`) — konkrétan
    a beállítás-cellák és a jobbra igazított (Visszavonás/SZÁMÍTÁS/
    Jegyzőkönyv) gombcsoport közötti, tördeléskor szabadon maradó térbe,
    egy screenshot-alapú, kézzel bekeretezett felhasználói jelzés alapján
    (a korábbi, Modell-vászon feletti sávba tett verzió — `.vem-canvas-bar__
    headline` — el lett vetve, mert ütközött a lebegő eszközpanelekkel).
    Ezt követően két további iterációban finomodott, mindkétszer konkrét
    felhasználói visszajelzésre:
    (a) méret + "kitűnés": 13.5px→21px→26px, sima szín helyett
    `background-clip: text` gradiens + a glyph-alakot követő
    `drop-shadow` (ugyanaz az elv, mint a lehajlási görbe árnyékolásánál);
    (b) színcsere: a gradiens előbb `--text-primary`-ból indult (ugyanaz
    a szín, mint a futó szöveg 90%-a — belesimult), majd a menta
    `--accent`-családra váltott (de az meg a lehajlott alak/„kész"
    státusz színe — szintén "mindenhol ott van", nem ütős), végül a
    kizárólag brand/kiemelő célra fenntartott `--brand-gold` családra
    (eddig KIZÁRÓLAG a SZÁMÍTÁS gombon élt) — ez adta az első valódi
    kontrasztot;
    (c) betűtípus-csere: Playfair Display → **Spectral** (Google Fonts,
    600/700 súly) — az `index.html` `<link>`-je és a `--font-serif`
    token is frissült, minden korábbi Playfair-hivatkozás (kód-kommentek
    is) átírva.
    Minden lépés után DOM-szintű ellenőrzés történt (a böngésző-panel
    screenshotja ismételten elérhetetlen volt ebben az ülésben):
    `scrollWidth === clientWidth` (nincs csonkolás sem 1280px, sem
    1920px szélességnél), `document.fonts.ready` + `[...document.fonts]`
    igazolta a Spectral tényleges betöltését, `getComputedStyle().
    backgroundImage` igazolta a helyes gradiens-értékeket. `typecheck` +
    `lint` minden lépés után zöld.

28. **A "Hálófüggetlenségi vizsgálat" tényleges megvalósítása** (korábban
    `disabled: true` placeholder menüpont volt a "Számítás" menüben — a
    felhasználó rákérdezett, miért szürke, majd kérte a megvalósítást).
    Új modul: `packages/ui/src/model/meshConvergence.ts` —
    `runMeshConvergence(editable, elementCounts?)` az aktuális modellt egy
    rögzített elemszám-sorozaton (`DEFAULT_MESH_CONVERGENCE_COUNTS = [4, 8,
    16, 32, 64]`) futtatja le, MINDIG a lineáris megoldón át
    (`solveEditableModel`, a `compile.ts` "a felület nem számol" elve
    szerint egyetlen belépési ponton keresztül, csak többször hívva) — a
    nemlineáris (Newton-Raphson, rétegelt) futás minden elemszámnál drága
    lenne egy interaktív panelhez, és a hálófüggetlenség kérdése
    anyagmodell-független, geometriai kérdés. Minden ponthoz kiszámolja a
    `w max`/`M max` szélsőértéket ÉS az ELŐZŐ (durvább) hálóhoz képesti
    relatív eltérést (%); hibatűrő — egy megoldhatatlan elemszám nem
    szakítja meg a sorozatot, csak hibaüzenettel jelölt sort ad.
    Új nézet: `packages/ui/src/meshconvergence/MeshConvergenceView.tsx`
    (+ `.css`), a `HistoricalView.tsx` overlay-mintáját követve — táblázat
    (Elemszám / DOF / w max / Δw / M max / ΔM), 1%-os küszöb alatt zölddel
    kiemelt "gyakorlatilag konvergált" cellák, záró megjegyzés, ha a
    LEGFINOMABB hálónál is 1% fölött maradt a w VAGY az M eltérése.
    Bekötve: `appStore.ts` (`meshConvergenceOpen`/`setMeshConvergenceOpen`),
    `App.tsx` (a menüpont `disabled: true`-ja eltávolítva, Escape-kezelés,
    render).
    Böngészőben valós adatokkal igazolva (twospan preset, IPE300/S235,
    12 m): M max 89.17→132.06 kNm nő 4→64 elemmel, a relatív eltérés
    21.53%→1.86%-ra csökken (VALÓDI, tanulságos konvergencia — nem
    triviális eset). Eközben egy `simple` (kéttámaszú, egyenletes q)
    preseten a teszt ELSŐ verziója hibásan szigorúan MONOTON csökkenő
    trendet várt — kiderült, hogy a záródásmentes elem ezt az egyszerű
    esetet MÁR N=4-nél (közel) egzaktul megoldja, a maradék eltérés a
    lebegőpontos zaj szintjén van (~1e-10%), nem monoton csökken — ez NEM
    hiba, hanem az elem erőssége; a teszt ennek megfelelően lett javítva
    (minden relatív eltérés < 1e-6% helyett csökkenő trend). Egy elgépelés
    ("háztartási elemszám-beállítástól" a bevezető szövegben) is javítva
    lett élő böngésző-ellenőrzés közben. Ellenőrzés: `pnpm --filter
    @femati/ui typecheck` + `pnpm lint` zöld; `pnpm --filter @femati/ui test`
    47→**53/53 zöld** (6 új teszt); DOM-szintű böngésző-igazolás (menüpont
    kattintható, panel megnyílik/bezárul Escape-re, táblázat helyes
    adatokkal töltődik).

29. **A "nincs nyers hex" design-token szabály leírása + gépi
    kikényszerítése** — a korábbi "hogyan tudnánk a Design pontszámot
    9.5-re feltornázni" beszélgetésben adott 1. javaslat (a legnagyobb
    súlyú, legolcsóbban javítható hiányosság) tényleges megvalósítása. Új
    `docs/UI-CONVENTIONS.md` (a `docs/CONVENTIONS.md` UI-megfelelője) írja
    le a szabályt és a dokumentált kivételeket. Új
    `scripts/check-design-tokens.mjs` — függőség nélküli, kézzel írt
    Node-szkript, ami a `packages/ui/src` minden `.css`/`.tsx`/`.ts`
    fájlján végigfut, és hibával bukik, ha nem-engedélyezett fájlban nyers
    hex-szín-mintát (`#rgb`/`#rgba`/`#rrggbb`/`#rrggbbaa`) talál. Bekötve:
    root `package.json` (`pnpm lint` mostantól `eslint . && node
    scripts/check-design-tokens.mjs`, plusz külön `pnpm lint:tokens`), CI
    (`.github/workflows/ci.yml` új "Design-token ellenőrzés" lépés a
    Lint után).
    A szkript megírása közben kiderült, hogy az eredeti feltételezés
    ("csak a tokens.css lehet kivétel") HIBÁS volt — a valós kódbázisban
    három legitim, TUDATOS kivétel is él: `derivation.css`/`report.css`
    (önálló, papírra szánt fekete-fehér nyomtatási stílusok, saját
    `--der-*`/`--report-*` helyi custom property-kkel — ezt a fájlok saját
    fejléc-kommentje már korábban is dokumentálta) és `Beam3DStress.tsx`
    (numerikus "jet" színskála, amit a `hexToRgb()` PARSZOL lineáris
    interpolációhoz — matematikailag nem lehetne `var()` string). Mindhárom
    fel lett véve a szkript `ALLOWED_FILES` listájára, dokumentált
    indoklással, és a `docs/UI-CONVENTIONS.md` táblázatába is bekerült —
    ez pontosabb, valóság-hű szabály lett, mint az eredeti (téves)
    egyszerűsítés.
    Ellenőrzés: a szkript kézzel tesztelve mindkét irányban (egy
    ideiglenes, nem commitolt fájlban elhelyezett `#123abc` helyesen 1-es
    kilépőkóddal bukik, majd törölve újra 0-val fut le); `pnpm lint`
    (mind a 4 csomagra kiterjedő ESLint + az új szkript) zöld; a saját
    szkript maga is lintelve lett (Node globálisok — `process`,
    `console`, `URL` — felvéve az `eslint.config.js`-be egy célzott
    `scripts/**/*.mjs` override-dal, mivel a `scripts/` nincs egyetlen
    TS-projekthez sem kötve, tehát a TS-lib-alapú globális-felismerés nem
    fedi le); mind a 4 csomag `typecheck`-je (fem-core, fem-db,
    fem-validation, ui) egyenként zöld.

30. **Fedő elrendezési hiba javítva — a "deformáció ×N" felirat a
    Kijelölés-gombsort takarta**: a felhasználó screenshot nélkül, csak
    szövegesen jelezte, hogy egy "deformáció ×53" felirat lefed egy
    Kijelölés gombot. A `.vem-canvas__scale` (a lehajlás-nagyítási
    szorzót mutató, `position: absolute` felirat a vászon bal felső
    sarkában) `top: var(--space-5)` (12px) értéken ült — pont ott, ahol a
    vászon feletti Kijelölés-eszközsor is van. A lebegő Támasz/Teher-
    eszközpanelek (`.vem-floating-panel`) ugyanezt a problémát helyesen
    `top: 44px`-cel kerülik ki (a gombsor alá kerülve) — a deformáció-
    felirat lemaradt erről az igazításról. Javítva: `top: 44px` (+ `left`
    a lebegő panelekével egyező `var(--space-5)`-re igazítva). Ellenőrzés:
    `pnpm lint` zöld; böngészőben `getBoundingClientRect()`-tel igazolva,
    hogy a felirat (y: 230–263) és a Kijelölés-gomb (y: 190–218) között
    NINCS átfedés.

31. **`docs/UI-CONVENTIONS.md` kiegészítve — elnevezési konvenció +
    "mikor kell új tokent felvenni"**: a felhasználó visszakérdezett a
    korábban adott 1. javaslat ("Design 8→9.5" beszélgetés) szó szerinti
    szövegére, ami két elemet írt elő: (a) token-szabály + elnevezési
    konvenció + mikor-kell-új-tokent iránymutatás, (b) automatizált
    ellenőrzés. A (b) már teljesen kész volt (`scripts/check-design-
    tokens.mjs`, CI-ba kötve), de a (a)-ból a token-szabály maga megvolt,
    az elnevezési konvenció és a "mikor kell új tokent" viszont
    KIMARADT — ez egy valódi, önellenőrzéssel felfedezett hiányosság
    volt, nem csak formalitás. Pótolva: a `tokens.css` teljes
    átvizsgálásával felépített prefix-táblázat (`--surface-*`,
    `--border-*`, `--text-*`, `--accent-*`, `--brand-gold-*`, `--sem-*`,
    `--font-*`, `--type-*`, `--space-*`, `--radius-*`, `--shadow-*`,
    `--motion-*`, `--h-*`/`--w-*` — mindegyikhez jelentés + példa), és egy
    4 pontos döntési iránymutatás (mikor globális token, mikor helyi/
    dokumentált kivétel, és a `--sem-deformed`/`--accent` véletlen
    hex-egybeesésére figyelmeztető megjegyzés, hogy a szemantikus és a
    dekoratív tokenek jelentésben — nem csak színben — különböznek, ezért
    sosem vonandók össze). Ellenőrzés: `pnpm lint` (a szkript maga)
    változatlanul zöld — ez a kiegészítés kizárólag dokumentáció.

32. **A "Design 8→9.5" beszélgetés 4. javaslata: az önellenőrzés
    beépített folyamattá tétele** — új `docs/UI-REVIEW-CHECKLIST.md`
    (mikor kell végigmenni rajta, mi automatikus vs. manuális pont) +
    új `scripts/check-dead-css.mjs` (heurisztikus, `vem-` előtagú
    CSS-osztály-használat ellenőrzés, `pnpm lint`/CI-ba kötve, a
    `check-design-tokens.mjs` mintájára — beleértve egy `DYNAMIC_PREFIXES`
    kivétel-listát a `` `vem-status--${cls}` ``-szerű, template literallal
    összefűzött osztálynevekhez, amikre a statikus szöveg-keresés sosem
    találna egyezést).
    Az ELSŐ futás valódi hibákat talált, nem csak formalitást:
    (a) 3 GENUINE holt osztály — `.vem-field` (`display: block`, sosem
    alkalmazva, csak a `__label` gyerek él), `.vem-panel__body` (csak a
    `--padded` változatot használja a kód, az alap sosem), `.vem-sr-only`
    (képernyőolvasó-only segédosztály, SOSEM lett ténylegesen egyetlen
    elemre sem alkalmazva — ez önmagában egy lehetséges akadálymentességi
    hiányosságra utal, ezért külön spawn_task-ra jelezve, nem csak törölve);
    (b) 2 VALÓDI, FUNKCIONÁLIS CSS-hiba a saját korábbi munkámban — a
    Hálófüggetlenségi vizsgálat táblázatában a `.vem-meshconv td--error`/
    `td--rel-ok` szelektorokból hiányzott a pont `td--error`/`td--rel-ok`
    elől, ezért CSS-ben egy NEMLÉTEZŐ HTML-tagot céloztak (`<td--error>`),
    sosem illeszkedtek a valódi `<td className="...">` elemekre — a
    hibaüzenet-sorok és a "konvergált" zöld kiemelés SOSEM jelent meg,
    észrevétlenül, egészen a mostani automatikus ellenőrzésig. Javítva:
    átnevezve `.vem-meshconv__error`/`.vem-meshconv__rel-ok`-ra (helyesen
    egy önálló osztályként, nem a konténer osztályával összefűzve).
    Ellenőrzés: a szkript kézzel tesztelve mindkét irányban (egy
    ideiglenes, nem commitolt `.vem-totally-unused-xyz` helyesen bukik,
    majd törölve 0-val fut le); böngészőben `getComputedStyle`-lal
    igazolva, hogy a "konvergált" cellák MOST már ténylegesen zöld
    (`--sem-ok`, rgb(79,214,180)) színt kapnak; `pnpm lint` (mind a 3
    ellenőrző lánca) + `pnpm --filter @femati/ui typecheck` + `test`
    (53/53) zöld.

33. **A Szelvény/Anyag combobox csoportosítva + típusjelző ikonnal** — a
    felhasználó kérésére. A `SectionEntry.kind` mező már létezett (I/U/
    circle/tube/rect), az anyagoknál viszont nem volt "család" mező — új
    `MaterialFamily` típus (`steel`|`aluminum`|`concrete`|`timber`) és
    `family` mező került a `fem-db` `MaterialEntry`-be (`types.ts` +
    minden `materials.json` rekord + `index.ts` export), egy új fem-db
    teszttel (`family` a 4 ismert érték egyike, és a csoport-tagság
    pontosan egyezik a várttal — ez a UI-csoportosítás alapja).
    UI-oldalon: `components/Field.tsx` `Select`-je kapott egy opcionális
    `group` mezőt (`SelectOption`), natív `<optgroup>`-ra fordítva —
    STABIL csoportosítással (minden csoport az ELSŐ előfordulása helyén
    jelenik meg, a hívónak nem kell előre rendeznie; ez azért fontos, mert
    a `sections.json`-ban a kör/téglalap/körgyűrű rekordok NEM
    egymás után állnak). `data/catalog.ts` új `sectionOptions()`/
    `materialOptions()` — mindegyik opció elé egy sima Unicode-glifa kerül
    ikonként (natív `<option>` nem tud SVG-t/képet, csak szöveget — ezért
    nem egyedi dropdown-widget, hanem egyszerű karakter-előtag: ⌶ I-szelvény,
    ⊔ U-szelvény, ○ kör, ◎ körgyűrű, ▭ téglalap; ▮ acél, ▯ alumínium,
    ▦ beton, ▤ fa). A `Toolbar.tsx` a nyers `SECTIONS.map(...)`/
    `MATERIALS.map(...)` helyett ezeket hívja.
    Ellenőrzés: `pnpm --filter @femati/fem-db typecheck`+`test` (23/23,
    +2 új teszt) és `pnpm --filter @femati/ui typecheck` zöld; `pnpm lint`
    (mindhárom lánc) zöld; `pnpm --filter @femati/ui test` 53/53; böngészőben
    DOM-szinten igazolva (`<optgroup>` szerkezet + ikon-előtagos
    `<option>` szövegek) mindkét combobox helyes csoportosítása (Szelvény:
    5 csoport, Anyag: 4 csoport).

34. **A katalógus-ikonok finomítása — valódi anyagszínek + jobb szelvény-
    glifák**: a felhasználó jelezte, hogy az előző (33. pont) monokróm
    Unicode-jelölők "gyatrák" voltak, és színes, anyagot idéző megoldást
    kért. Két külön nyelvre bontva: a SZELVÉNY combobox alak szerinti
    glifát kapott (semleges színnel — a szín ott nem hordozna infót; az
    U-szelvény ikonja `⊔`→`⊓`-ra cserélve, olvashatóbb), az ANYAG combobox
    viszont egységes `●` jelölőt + VALÓDI anyagszínt (acél kékesszürke,
    alumínium ezüst, beton szürke, fa barna) — ehhez új, DEKORATÍV (nem
    szemantikus) tokencsalád: `--catalog-steel`/`-aluminum`/`-concrete`/
    `-timber` (`tokens.css`), bekötve a `docs/UI-CONVENTIONS.md` prefix-
    táblázatába is. A `Select` komponens (`Field.tsx`) kapott egy opcionális
    `color` mezőt a `SelectOption`-ön, ami `<option style={{color}}>`-ra
    fordul. Emellett a `.vem-select`-re felkerült a `color-scheme: dark` —
    enélkül a natív legördülő popup FEHÉR alapon renderelte volna a
    színes szöveget (a böngésző a rendszer/alapértelmezett témát követi,
    amíg nem kér mást). Ellenőrzés: `pnpm --filter @femati/ui typecheck` +
    `pnpm lint` (mindhárom lánc) zöld; `pnpm --filter @femati/ui test`
    53/53 (egy közbenső futás `tinypool`/OOM worker-összeomlással bukott,
    ismételt futtatásra zöld lett — ismert, korábban is dokumentált
    környezeti korlát, nem kód-hiba); böngészőben `getComputedStyle`-lal
    igazolva, hogy a `color-scheme: dark` ténylegesen érvényesül, és minden
    anyag-opció a helyes, SZÁMÍTOTT RGB-színt kapja (pl. acél →
    rgb(154,168,184)).

35. **Nyitott kérdés / jövőbeli ADR-téma — nyírás-hajlítás kölcsönhatás a
    folyási feltételben (M-V interaction)**: a felhasználó kérésére
    átnéztem a szakirodalmat (rugalmas-képlékeny/rétegelt Timoshenko-
    gerendaelemek), hogy kihagytunk-e valamit. Nem találtam alapvető
    elméleti hiányt — a rétegelt (fiber) keresztmetszet-modellünk
    (`layeredSection.ts`/`elastoPlastic1D.ts`) pontosan az irodalomban
    látott "distributed plasticity, fiber discretization" elvet követi, a
    záródás-kezelésről a keresés semmi újat nem hozott a korábban átnézett
    MathWorks/HAL/TU Delft anyagokhoz képest. EGY konkrét, valós
    továbbfejlesztési irányt viszont talált: több modern cikk — Dimopoulos
    et al., "An inelastic Timoshenko beam element with axial–shear–
    flexural interaction" (*Computational Mechanics*, 2012,
    https://link.springer.com/article/10.1007/s00466-011-0616-3); "A
    fiber-section model based Timoshenko beam element using shear-bending
    interdependent shape function" (*Earthquake Engineering and
    Engineering Vibration*, 2013,
    https://link.springer.com/article/10.1007/s11803-013-0183-z); "A
    flexure-shear Timoshenko fiber beam element based on softened
    damage-plasticity model" (*Engineering Structures*, 2017,
    https://www.sciencedirect.com/science/article/abs/pii/S0141029616307143);
    "Damage coupled elasto-plastic finite element analysis of a
    Timoshenko layered beam" (*Computers & Structures*, 1999,
    https://www.sciencedirect.com/science/article/abs/pii/S0045794998001163)
    — olyan folyási felületet használ, ahol a nyíróerő is befolyásolja a
    képlékeny nyomatéki teherbírást (M-V kölcsönhatás); az egyik forrás
    kifejezetten megjegyzi: "the stress distribution predicted by simple
    plasticity theory is not correct near fully plastic sections where
    shear force and bending moment are both present."
    Ellenőriztem a saját `resultantPlastic.ts`-ünket: nálunk a nyírás
    MINDIG rugalmas marad (`dQ = GAs·dγ`), kizárólag `M` okoz folyást —
    ez a diplomaterv (3.47)–(3.52) képleteinek SZÓ SZERINTI, szándékos
    megvalósítása, tehát NEM hiba, hanem a forrás-diplomaterv saját,
    tudatos egyszerűsítése (ugyanabba a kategóriába esik, mint a Cowper-
    tényező és a dinamika kihagyása korábban). A felhasználó döntése:
    ez egy NYITOTT kérdés, később eldöntendő, hogy az M-V kölcsönhatásos
    folyási felület bármilyen formában bekerüljön-e a projektbe (külön
    ADR mögött, ld. MASTER-PROMPT-TERV K9). Egyelőre SEM kód, SEM
    `docs/THEORY.md`-változtatás nem történt — kizárólag ez a bejegyzés
    rögzíti a témát jövőbeli hivatkozásra (ugyanaz a mintázat, mint a 26.
    pont FCQ-eleme).

36. **Saját, ikonos `Combobox` a Szelvény/Anyag mezőkhöz — a 33-34. pont
    Unicode-glifás megoldásának felváltása**: a felhasználó szerint az
    előző, natív `<select>`-re épülő megoldás "kézhez rajzoltnak" hatott
    — ez a natív `<option>` alapvető korlátja (csak szöveget/`color`-t
    tud, valódi SVG-t/kitöltött swatch-ot nem), amit szöveg-glifával nem
    lehet elfedni. Új, önálló komponens:
    `components/Combobox.tsx` — `role="listbox"` widget, a `MenuBar.tsx`
    interakciós mintáját követve (kattintásra nyílik, `.vem-menu__scrim`
    kívülre kattintva zár, `Escape` zár), saját nyíl-billentyűs
    navigációval (fel/le highlight, Enter kiválaszt+zár) és ARIA-val
    (`aria-expanded`, `aria-selected`, `aria-activedescendant`-ekvivalens
    highlight). Az opciók `icon?: JSX.Element`-et hordozhatnak — VALÓDI
    React-node, nem szöveg.
    Új `data/catalogIcons.tsx`: SZELVÉNY — alak szerinti, vonalas SVG-ikon
    (`currentColor`, `stroke`, a `canvas/marks.tsx` letisztult
    vonalstílusát követve: I-gerenda, U-csatorna nyitott bracket, kör,
    két koncentrikus kör (cső), lekerekített téglalap); ANYAG — egységes,
    de VALÓDI SVG `<circle fill={...}>` kör-swatch a `--catalog-*`
    anyagszín-tokenekkel (nem szöveg-szín, tényleges kitöltött alakzat).
    A `data/catalog.ts` visszaállt tiszta adat-fájlnak (`SECTION_KIND_GROUP`/
    `MATERIAL_FAMILY_GROUP` csoport-címke térképek maradtak, a régi
    `sectionOptions()`/`materialOptions()` Unicode-glifás függvények
    törölve — helyettük `catalogIcons.tsx` `sectionComboOptions()`/
    `materialComboOptions()`). `docs/UI-CONVENTIONS.md` új 3/A pontja
    rögzíti, mikor natív `Select`, mikor saját `Combobox` indokolt.
    Ellenőrzés: `pnpm --filter @femati/ui typecheck` (egy köztes hiba —
    `Icon` segédkomponens `children: JSX.Element` típusa nem fogadott
    több gyermeket a cső-ikonnál két `<circle>`-lel — `ReactNode`-ra
    javítva) + `pnpm lint` (mindhárom lánc, a token-/halott CSS-ellenőrző
    is átfutott a 2 új fájlon) + `pnpm --filter @femati/ui test` (53/53)
    zöld. Böngészőben végigtesztelve: mindkét trigger valódi `<svg>`-t
    tartalmaz; az Anyag panel `getComputedStyle`-lal igazolt, SZÁMÍTOTT
    `fill` színekkel rendereli a kör-swatch-okat csoportonként (pl. acél
    rgb(154,168,184)); nyíl le helyesen mozgatja a kiemelést; Enter
    kiválaszt és bezár, a trigger szövege frissül; Escape zár. (Egy
    vakvágány a tesztelés közben: a böngésző-eszköz "Return" billentyű-
    neve üres `key`/`code`-ú szintetikus eseményt generált — ez a
    TESZTELŐ ESZKÖZ sajátossága, nem a komponens hibája; az "Enter"
    névvel megismételve helyesen `key: "Enter"` érkezett, és minden
    a várt módon működött.)

37. **Füstös bordó háttérátmenet a két oldalpanelen** — a felhasználó
    ötletét ("mi lenne, ha a bal panel háttere finom füstös bordó
    átmenet lenne?") előbb KÍSÉRLETKÉNT (nem commitolt állapotban)
    kötöttem be, csak a bal panelre, `tokens.css`/`shell.css`-ben
    explicit "KÍSÉRLETI, törlendő ha nem tetszik" jelöléssel — a
    felhasználó jóváhagyása (implicit, a jobb panelre is kérve) után
    véglegesítve: a token át lett nevezve `--surface-panel-left-*`-ról
    `--surface-panel-warm-*`-re (mivel már nem csak a bal panelre
    vonatkozik), és a `.vem-panel--left`/`.vem-panel--right` közös
    szabályba került. Az átmenet: `linear-gradient(180deg,
    var(--surface-panel-warm-top) 1d2126 0%, var(--surface-panel-warm-
    bottom) 2b1d21 100%)` — felül a jelenlegi semleges sötét tónussal
    indul, alul egy visszafogott, füstös bordóba hajlik. Ellenőrzés:
    `pnpm lint` (mindhárom lánc) zöld; böngészőben `getComputedStyle`-
    lal igazolva, hogy mindkét panel (`vem-panel--left`,
    `vem-panel--right`) azonos, számított gradienst kap.

38. **A levezetés 4.7/5/6 pontjainak teljes, lépésenkénti kidolgozása** — a
    régóta nyitott feladat (ld. korábbi felhasználói kérés: "minden egyes
    matematikai művelet step-by-step legyen"), amit korábban a felhasználó
    "majd holnapra" halasztott. Három valódi hiányt zárt le:

    - **4.7 Elemi tehervektor**: eddig csak a KÉSZ, végső vektort mutatta,
      SEMMILYEN levezetés nélkül — miközben 4.1–4.6 minden lépést behelyet-
      tesítve mutatott. Új `fem-core` export: `reduceDistributedDetail`/
      `reduceThermalDetail` (a `loadVector.ts` belső `reduceDistributed`/
      `reduceThermal` függvényei ÁTALAKÍTVA úgy, hogy előbb Gauss-pontonkénti
      RÉSZLETET adjanak, amit a régi függvény már csak összegez — ezért a
      végeredmény garantáltan bit-azonos marad, ld. ADR-0005 elve) és egy új
      `deriveElementLoadVector(model, elementId)` (`elementDerivation.ts`),
      ami terhenkénti bontásban (megoszló erő/nyomaték, önsúly, csomóponti
      erő/nyomaték, hőteher) adja vissza a hozzájárulásokat. UI-oldalon új
      `distributedLoadGaussTex`/`thermalLoadGaussTex`/`nodalLoadTex`
      (`formulaLatex.ts`) + docx-párjuk (`formulaText.ts`).
    - **5. Kompilálás és megoldás**: eddig csak egy összefoglaló táblázat
      volt (mátrixméret, sávszélesség, stratégia neve) — SEMMI nem mutatta,
      HOGYAN kerül egy elem Kₑ-je a globális mátrixba, mely DOF-ok vannak
      kizárva, vagy mi a ténylegesen megoldott elmozdulás. Új 5.1
      (Összeszerelés — a kiválasztott elem 3 csomópontjának globális DOF-
      indexei, konkrét Kₑ[1,1]→K_global[I,J] példával), 5.2 (Peremfeltétel-
      kezelés — támaszok táblázata + eliminációs/penalty magyarázat), 5.3
      (A megoldott rendszer — a kiválasztott elem tényleges uₑ elmozdulás-
      vektora).
    - **6. Eredmények**: eddig a Gauss-ponti M/T táblázat "a semmiből"
      jelent meg — nem volt látható a HÍD (5. pont megoldása) → (6. pont
      igénybevétele) között. Új 6.1 (Igénybevétel-visszaszámítás — κ =
      B_κ·uₑ, γ = B_γ·uₑ, M = EI·(κ−κ₀), T = GAs·γ, minden Gauss-pontban
      kiírva), a régi táblázat 6.2-re átszámozva.
    - Ehhez új `fem-core` export: `deriveElementInternalForces(model,
      elementId, displacements)` — SZÓ SZERINT az `internalForces(...)`
      függvényt hívja (amit a `linearSolver.ts` is használ ugyanerre),
      ezért az M/T BIT-AZONOS a ténylegesen megjelenített diagramértékkel.
      `elementGlobalNodeIndices(model, elementId)` is új export (a DOF
      `2·i`/`2·i+1` numerálást használja ki, ld. `dofMap.ts` fejléce — NINCS
      sávszélesség-újraszámozás, ezt a kód fejléce explicit megerősíti).
    - Mindhárom új fem-core függvényhez ÚJ teszt (`derivation.test.ts`):
      bit-azonosság `elementLoadVector`/`LinearResult.gaussPoints`-szal,
      minden elemre, plusz egy külön teszt, ami a κ/γ dot-szorzatot kézzel
      újraszámolva igazolja a pedagógiai bontás helyességét.
    - A .docx export (ADR-0005: "a két kimenet ne térhessen el egymástól")
      SZINKRONBAN tartva: `derivationExportData.ts` új mezői
      (`loadFormulas`, `assemblyRows`/`assemblyNote`, `boundaryRows`/
      `boundaryNote`, `ueRow`, `internalForceFormulas`) + `docxExport.ts`
      megfelelő szakaszai. Új `docxExport.test.ts` — ELSŐ automatikus teszt
      erre a fájlra (korábban NULLA lefedettsége volt) —, ami a TELJES
      `buildDerivationExportData` → `buildDerivationDocx` láncot lefuttatja
      és igazolja, hogy egy nem-üres `.docx` Blob készül. Ehhez
      `vitest.config.ts`-be kellett felvenni a `__APP_VERSION__`/
      `__GIT_COMMIT__` build-időben (`vite.config.ts`) definiált
      konstansokat, mert korábban egyetlen teszt sem futtatta végig ezt az
      útvonalat.
    Ellenőrzés: `pnpm --filter @femati/fem-core typecheck`+`test` (396/399,
    3 perf-teszt szándékosan skip) és `pnpm --filter @femati/ui typecheck`+
    `test` (55/55, +4 új fájl/eset) zöld; `pnpm lint` (mindhárom lánc)
    zöld; böngészőben végigfuttatva (SZÁMÍTÁS → Levezetés megtekintése):
    minden új alpont (4.7, 5.1–5.3, 6.1–6.2) valóban megjelenik, 0
    KaTeX-renderelési hiba, és a 4.7 kiszámolt terhelési vektora
    ([3.75, 0, 15, 0, 3.75, 0] q=30 kN/m, L_e=0.75 m esetére) egyezik a
    kvadratikus elem zárt alakú konzisztens tehervektor-képletével
    (qL/6·[1,4,1]), a 6.1/6.2 pedig egymással bit-azonos M/T-t mutat
    (pl. M=123.97 kNm mindkét helyen, x=6.085 m-nél).

39. **Ikon-only gombok akadálymentességi audit — lezárva** (a `.vem-sr-only`
    törlésekor, STATUS_REPORT.md 32. pont, nyitva hagyott feladat).
    Egy Explore-agent végigfésülte a `packages/ui/src` teljes `<button>`
    állományát (16 fájl), és 12 olyan gombot azonosított, amelynek egyetlen
    látható tartalma egy ikon-glifa (nem szöveg), és `aria-label` HIÁNYZOTT
    róla: `ModelCanvas.tsx` nagyítás/kicsinyítés (2), `CrossSectionInspector.tsx`
    bezárás (2, mindkét render-ág), `HistoricalView.tsx` előző/lejátszás-
    szünet/következő (3), `Timeline.tsx` ugyanez (3), `Toolbar.tsx`
    visszavonás/újra (2, a `Button.tsx` wrapperen át). Mind a 12 javítva —
    a `Button.tsx` komponens kapott egy új, opcionális `ariaLabel` propot
    (eddig csak `title`-t fogadott, azt NEM olvassa fel minden képernyő-
    olvasó konzisztensen, `aria-label`-t viszont igen), a többi natív
    `<button>`-nél közvetlen `aria-label` attribútum. A dinamikus
    (lejátszás/szünet) gomboknál a label a `playing` állapottal együtt vált.
    Az audit emellett megerősítette, hogy a `Combobox.tsx` trigger és a
    `ToolPalette.tsx` `FloatingToolButton` (6 hívási hely) MÁR helyesen
    címkézett volt — ezeket nem kellett módosítani.
    Ellenőrzés: `pnpm --filter @femati/ui typecheck` + `pnpm lint` (mindhárom
    lánc) + `pnpm --filter @femati/ui test` (55/55) zöld. Böngészőben élőben
    visszaigazolva `getAttribute('aria-label')`-lal: nagyítás/kicsinyítés,
    visszavonás/újra, Timeline (SZÁMÍTÁS után) és HistoricalView (Történelmi
    mód után) gombjai mind a várt szöveget adják. A `CrossSectionInspector`
    bezáró gombját (canvas-kattintással nyíló, nehezen szimulálható
    interakció) csak típusellenőrzéssel + a többivel azonos, már bizonyítottan
    működő mintázattal igazoltam, élő kattintással nem.

40. **A levezetés utolsó 2 valódi hiányossága lezárva — 6.3 extrapolációs
    képlet + 7. pont konvergencia-képlet.** A felhasználó egy korábbi (a
    38. pont ELŐTTI) auditját küldte vissza, ami 4 hiányt sorolt fel; kettő
    (4.7 tehervektor, 5. összeszerelés) már a 38. pontban lezárult — ez a
    tétel a maradék kettőt zárja:

    - **6.3 — Gauss→csomópont extrapoláció**: eddig a táblázat csak a KÉSZ
      Gauss-ponti M/T-t mutatta, a mögöttes másodfokú (Lagrange-)
      extrapolációs képlet (`post/extrapolation.ts` `lagrangeAt`) sosem
      jelent meg számmal. Új UI-oldali `extrapolationTex`/`extrapolationBlock`
      (`formulaLatex.ts`/`formulaText.ts`) — a `lagrangeAt` MATEMATIKÁJÁT
      (nem magát a függvényt, mert az egy skalárt ad, itt a súlyokat is
      ki kell írni) újraszámolva mutatja be az L₁/L₂/L₃ súlyokat és a
      behelyettesített összeget, a kiválasztott elem bal (ξ=−1) és jobb
      (ξ=+1) csomópontjára.
    - **7. pont — konvergencia-képlet**: eddig csak a "végső reziduum %"
      szerepelt, a mögöttes `100·‖ψ‖/‖f‖ ≤ Tolerancia` (Diplomaterv
      3.4.2.1/6. lépés, "CONUND") képlet sosem látszott számmal. Ehhez a
      `fem-core` `NewtonIterationLog`-ja kapott két ÚJ mezőt (`psiNorm`,
      `fNorm` — eddig csak a kész hányados, `residualPercent` volt tárolva,
      a `norm2(psi)`/`norm2(fTarget)` már ki volt számolva a
      `newtonRaphson.ts`-ben, csak nem lett elmentve). Az UI `NonlinearRun`
      is kapott egy `tolerancePercent` mezőt (a `NonlinearOptions`-ból
      propagálva, eddig NEM volt tárolva a futás EREDMÉNYÉBEN, csak a
      bemenő opciókban). A teherlépcső-napló táblázat két új oszlopot
      (‖ψ‖, ‖f‖) kapott, alatta új `convergenceTex`/`convergenceBlock`
      formula az utolsó lépés utolsó iterációjára behelyettesítve.
    - A .docx export (ADR-0005) szinkronban tartva: `derivationExportData.ts`
      új `extrapolationFormulas` (top-level) + `DerivationExportPlastic.
      convergenceFormula` mezői, `docxExport.ts` megfelelő új szakaszai
      (6.3, "A konvergencia-képlet behelyettesítve").
    - Új tesztek: `formulaLatex.test.ts`/`formulaText.test.ts` — az
      extrapolációs súlyokat KÉZZEL (a teszt saját, független
      Lagrange-implementációjával) újraszámolva igazolja, hogy a UI
      függvény ugyanazt adja; a konvergencia-blokkra konvergált/nem
      konvergált esetet is. `loadStepper.test.ts` — minden ténylegesen
      lefutott iterációra igazolja, hogy `100·psiNorm/fNorm` PONTOSAN
      (8 tizedesig) a tárolt `residualPercent`-et adja.
    Ellenőrzés: mindhárom csomag (`fem-core`, `fem-db`, `fem-validation`,
    `ui`) `typecheck` zöld; `pnpm lint` (mindhárom lánc) zöld; `fem-core`
    397/400 teszt (3 perf-teszt szándékosan skip), `ui` 56/56 zöld.
    Böngészőben SZÁMÍTÁS után élőben ellenőrizve: 0 KaTeX-hiba, az
    extrapolációs súlyok összege (1.4788 − 0.6667 + 0.1878 = 1.0000)
    manuálisan is igazolja a Lagrange-tulajdonságot (ΣLᵢ(ξ)=1 bármely
    ξ-re), a konvergencia-képlet (100·6.059e−12/7.949e+1 = 0.0000% ≤
    0.5000%) helyesen KONVERGÁLT-at mutat.

41. **ErrorBoundary + célzott Newton-Raphson branch-coverage-javítás** — a
    felhasználó egy külső kód-audit (nem ez a session) három megállapítására
    kérte a javítást.
    - **React ErrorBoundary**: eddig NEM volt egy sem a `packages/ui/src`-
      ben — egy váratlan render-idejű kivétel fehér képernyőt eredményezett
      volna. Új `ErrorBoundary.tsx` (class-komponens, `getDerivedStateFromError`
      + `componentDidCatch`) és `errorBoundary.css`, bekötve a `main.tsx`-be
      (`<ErrorBoundary><App /></ErrorBoundary>`). Élőben tesztelve: az
      `App.tsx`-be ideiglenesen beszúrt `throw new Error(...)` valóban a
      hibaüzenetet mutatta fehér képernyő helyett, majd a teszt-kódsor
      visszavonva.
    - **Newton-Raphson branch-coverage (54-74%→ ténylegesen a fájl saját
      metrikája ~60%, de a CSOMAG EGÉSZE fölé emelve a globális 80%-os
      kapun)**: a `newtonRaphson.ts`-ben 3 érdemi, addig NEM tesztelt ág
      volt — `algorithm: 'initial-stiffness'`, az `iter === iterMax`
      (nem konvergál a megadott iterációszámon belül) ág, és a
      `SingularMatrixError` elkapási ága (mechanizmus-modell). Egy 4. ág
      (`foundationC > 0`, Winkler-ágyazat az internal-force összegzésben)
      is hozzá lett adva, bár az a `newtonRaphson.ts`-en belül más néven
      (assembleInternalForce) él. Új `packages/fem-core/test/
      newtonRaphson.test.ts` — `runNewtonRaphsonStep`-et KÖZVETLENÜL hívja
      (nem `runLoadStepper`-en át), hogy pontosan a célzott ágat érje el
      egyetlen hívással. A belül maradt, NEM lefedett ágak (pl. "Hiányzó
      nemlineáris állapot" dobás) szándékosan defenzív invariáns-őrök,
      amik normál (akár adverzáriális) API-használattal nem érhetők el —
      ezeket NEM teszteltem mesterségesen (belső Map-ek manuális
      megsértése rossz tesztgyakorlat lenne).
    Ellenőrzés: `pnpm --filter @femati/ui typecheck`+`test` (56/56) zöld;
    `pnpm --filter @femati/fem-core typecheck`+`test` (401/404, 3 perf-
    teszt szándékosan skip) zöld; `pnpm lint` zöld. Coverage-mérés
    (`vitest run --coverage`, a teljes csomagra, ahogy a CI is futtatná):
    a `newtonRaphson.ts` saját statement-coverage-e 88.2%→97.16%-ra,
    branch-coverage-e 52.85%→~60%-ra nőtt; a CSOMAG EGÉSZÉNEK globális
    branch-coverage-e 80.4%-ra állt be — a `vitest.config.ts`-ben
    konfigurált 80%-os kapu fölé, tehát a teljes coverage-ellenőrzés most
    ZÖLD (korábban nem volt egyértelmű, hogy átment-e).

42. **THEORY.md ↔ kód szisztematikus audit + 5 valódi hiba javítása.** A
    felhasználó kérésére (Timoshenko-elmélet/képlékenységi modell szakmai
    átnézésének kiegészítéseként) egy 4 párhuzamos háttér-agent-tel
    végzett, teljes körű (`docs/THEORY.md` mind a 18 szakasza) átvizsgálás
    — minden egyes ott hivatkozott fájl/függvény ténylegesen létezik-e,
    a képletek egyeznek-e a kóddal, nincs-e mértékegység-/előjel-/index-
    hiba. Eredmény: a MATEMATIKA (előjelek, súlyok, D-mátrix, GAUSS_2/3
    értékek) mindenhol helyesnek bizonyult — a talált hibák KIVÉTEL
    NÉLKÜL dokumentáció-szintűek voltak, a kód maga sosem volt hibás.
    5 valódi hiba javítva:
    1. **R-tényező (318. sor)** — a táblázat a PRE-FIX, hibás `AB/AC`
       arányt írta le R képleteként, holott ez pontosan az az 1996-os/
       korai hiba, amit az ADR-0007 dokumentál mint javítottat — a
       dokumentum SAJÁT, később szereplő narratívája (523-535. sor) már
       helyesen írta le a javítást, csak a táblázat-sor maradt a régi
       állapotban. Javítva: a helyes `R = fTrial/Δσ_trial = (AC−AB)/AC`
       képletre, explicit "NEM az AB/AC arány" megjegyzéssel.
    2. **Nyírási feszültség-képlet (315. sor)** — `Q = Σ τxzl·bl·tl`
       implementáltként volt feltüntetve, holott a rétegelt modell
       nyírása MINDIG rugalmas marad (`T = GAs·γ`), a réteges
       nyírófeszültség-összegzés sehol nincs megvalósítva. Javítva:
       explicit jelölve, hogy csak az `M`-tag implementált.
    3. **Elavult fájlhivatkozás, 2 helyen (263., 320. sor)** —
       `assembly/internalForceVector.ts` nem létezik (sosem létezett
       ezen az útvonalon) — a valós hely `solver/nonlinearElement.ts` →
       `elementInternalForceVector()` (amit a dokumentum a 15.
       szakaszban HELYESEN is idéz — a 12./14. szakasz maradt le).
       Javítva mindkét helyen, plusz a `material/*.updateState()`
       nem-létező névforma is (helyes nevek:
       `updateResultantPlasticState()`/`updateLayerPlasticState()`).
    4. **Számszaki elírás (200. sor)** — "5×5-ös" extrapolációs mátrix
       helyett **3×3** (3 Gauss-pont → 3 csomópont, a `lagrangeAt()`
       ténylegesen 3-elemű tömbökkel dolgozik).
    5. **`checkMechanisms` nem létező függvénynév (118. sor)** — a valós
       önellenőrző függvény `ironsMechanismCount()`
       (`diagnostics/selfCheck.ts`). Ezt egy MÁSODIK, független
       (worktree-izolált) audit-agent találta, miután az első audit-
       agent állapotát ellenőrizni próbáltam — a két audit egymástól
       függetlenül, más módszerrel jutott közel azonos eredményre.
    Nyitva hagyott, KISEBB pontatlanságok (a felhasználó nem kérte
    ezek javítását, csak a fenti 4 [+1] konkrét hibáét): egyenletszám-
    hivatkozási ellentmondás a THEORY.md és a `shapeFunctions.ts` fejléce
    között ((3.3) vs (3.4)-(3.6)); két csonka egyenlet-tartomány-
    hivatkozás; a hőteher-előjel eredetét a THEORY.md tévesen az eredeti
    diplomatervnek tulajdonítja, holott az ADR-0006 (amit maga hivatkoz)
    ennek ellenkezőjét mondja (a kód maga helyes); `DEFAULT_PENALTY`
    `[kN/m]`-ként címkézve, de elfordulási DOF-okra is alkalmazva;
    két nem-ellenőrizhető történelmi validációs szám (valószínűleg egy
    korábbi, már törölt kísérletből maradt bent).
    Ellenőrzés: a javítások SZÖVEG-módosítások a `docs/THEORY.md`-ben,
    kódot nem érintenek — `git diff` manuálisan átnézve, minden érintett
    sor pontosan a tervezett, célzott cserét tartalmazza, semmilyen más
    tartalom nem sérült.

43. **[RETROSPEKTÍV] Dinamikai bővítés — modális analízis + csillapítás/
    tranziens válasz a `fem-core` szintjén** (`ca91ded`, 2026-08-28,
    **ADR-0016 + ADR-0017**): a diplomaterv-hűség keretének 2026-08-28-i
    tudatos elhagyása (ld. memória: `project-femati-scope-pivot`) utáni
    ELSŐ dinamikai bővítés — utólag naplózva, mert a napló akkor nem
    frissült. *Modális analízis* (ADR-0016): ÚJ `element/constitutive.ts`
    `sectionMass()` (a meglévő `gamma` anyagjellemzőből, nincs új
    `Material`-mező), `timoshenko3.ts` `elementMass()` (konzisztens
    tömegmátrix, TELJES Gauss-integrálással — a tömeg nem szenved shear
    lockingtól, ellentétben a merevséggel), ÚJ `linalg/eigen.ts`
    (`cholesky()`, ciklikus Jacobi-forgatás, `generalizedSymmetricEigen()`
    a `K·φ=ω²·M·φ` feladatra), ÚJ `solver/modal.ts` (`solveModal()`).
    **Egy valódi hiba fejlesztés közben:** az első Jacobi-forgatás a p/q
    diagonális elemeket két, egymásnak ellentmondó ciklusban írta felül —
    az `eigen.test.ts` "A·v=λ·v" tesztje azonnal elkapta (0,34 relatív
    hiba gépi pontosság helyett), javítva. Validálva zárt alakú
    Euler–Bernoulli-referenciával (karcsú kéttámaszú gerenda, 1,7e-4
    relatív eltérés, h-konvergenciával igazolva) — a Reddy (1999, Sādhanā)
    független, lektorált irodalom is megerősíti a választott (redukált
    integrációjú) elem modális pontosságát. UI: új "modális" diagram-fül
    (`ModalPanel.tsx`, `useModalResult` hook — csak akkor fut a drága
    sajátérték-számítás, ha a fül aktív), plusz a tömegmátrix-levezetés
    LaTeX/`.docx` megjelenítése a Levezetés nézet "4A" szakaszaként.
    *Csillapítás + tranziens válasz* (ADR-0017, `fem-core` szinten): ÚJ
    `solver/damping.ts` (Rayleigh-csillapítás, `C=α·M+β·K`) és
    `solver/transient.ts` (Newmark-β időintegrálás, alapértelmezésben
    átlagos gyorsulás — feltétel nélkül stabil). Validálva NÉGY zárt
    alakú referenciával (nem csak belső konzisztenciával): célzott
    ζ-visszaadás, csillapítatlan/csillapított szabadrezgés (Chopra zárt
    alakja, 9,08e-4 ill. 5,99e-4 csúcshiba), energiamegmaradás
    csillapítás/gerjesztés nélkül (1,47e-12 relatív drift, gépi
    pontosság). **Ekkor még NINCS UI-integráció** a tranziens
    válaszhoz — ez a 49. pontban (ld. `fb4a9a0`, 2026-09-02) készült el,
    napokkal később. `pnpm check` (mind a 4 csomag) az egész bővítés
    után tiszta.

44. **[RETROSPEKTÍV] Képlékeny M-V (hajlítás-nyírás) interakció**
    (`32e2e0f`, 2026-08-29, **ADR-0018**): a diplomaterv (3.52 egyenlet,
    63. oldal) és a projekt mindkét képlékenységi útja (resultant ÉS
    rétegelt) eddig a nyírást MINDIG rugalmasnak tekintette
    (`T=GAs·γ`), függetlenül a hajlítási folyástól — ez tudatos
    egyszerűsítés volt, nem hiba, de "profi App"-hoz hiányzó ellenőrzés.
    Három lehetséges út közül (A: EN 1993-1-1 6.2.8 stílusú utólagos
    redukált-Mpl ellenőrzés; B: ellipszis-alakú interakciós felület; C:
    teljes von Mises keresztmetszeti integrálás) a felhasználóval
    egyeztetve az **A) utat** választottuk: UTÓLAGOS, a radial-return/
    tangens merevséget NEM módosító kapacitás-ellenőrzés — ez radikálisan
    csökkenti a kockázatot, mert a már egyszer hibásnak bizonyult (ADR-
    0007), validált plasztikus maghoz nem kellett hozzányúlni. Megvalósítás:
    ÚJ `material/shearMomentInteraction.ts` — `plasticShearCapacity()`
    (`Vpl=A_eff·σY/√3`, ahol `A_eff` a modell MEGLÉVŐ `κs·A` mennyisége,
    NEM a szabvány szerinti `Av` — dokumentált modellezési döntés), és
    `shearMomentInteraction()` (a 6.2.8(2) formula: `ρ=(2|V|/Vpl−1)²` ha
    `|V|>0,5·Vpl`, `Mv,Rd=(1−ρ)·Mpl,Rd`). `solver/linearSolver.ts`
    `SectionProps` új `vpl` mezővel (`me`/`mp` mintájára, `null` ha nincs
    `σY`). 9 új teszt (`shearMomentInteraction.test.ts`) a szabvány saját
    határeseteire (V=0, V=0,5·Vpl küszöb, V=Vpl teljes redukció,
    V=0,75·Vpl közbenső eset). UI: még aznap (`panels/RightPanel.tsx`,
    "Határteher-ellenőrzés" szakasz) új Vpl és "M-V kihasználtság" sor,
    ok/error jelzéssel — ez az az ellenőrzés, amit az 51. pont (`feed6e4`)
    később a Jegyzőkönyvbe is bekötött. A B)/C) út (valódi csatolt
    plaszticitás) TUDATOSAN nyitva marad, külön ADR-t igényelne.
    `pnpm check` tiszta.

45. **[RETROSPEKTÍV] EC2 beton nemlineáris σ-ε modell a rétegelt magban**
    (`083da7e`, 2026-08-30, **ADR-0019**): a `fem-db` anyagkatalógus egy
    nappal korábban (`ae3a8b6`, G+D fázis) megkapta a teljes EC2 3.1.7
    paraméterkészletet (`fck`, `epsC2`, `epsCu2`, `n` stb.), de addig
    TISZTÁN referencia-adat volt, a megoldó nem használta. Ez a commit a
    tényleges bekötés: a beton a kezdettől fogva nemlineáris (parabola),
    nincs éles folyási határ — ez FIZIKAILAG NEM írható le a meglévő
    inkrementális, radial-return bilineáris (REFORB) törvénnyel, ezért
    ÚJ, PÁRHUZAMOS ág készült (`material/concreteEC2.ts`
    `concreteStress()`), nem a meglévő radial-return módosítva.
    Modellezési döntések (mind dokumentálva): **nulla húzószilárdság**
    (repedt keresztmetszet, a projekt előjelkonvenciója szerint `ε≥0` →
    húzás → `σ=0`); zúzódás (`|ε|>εcu2`) esetén `σ=0`; **path-independent**
    kiértékelés (a teljes `κ·z` alakváltozásból, nincs `LayerPlasticState`-
    history a beton ágon) — ISMERT, DOKUMENTÁLT KORLÁT, hogy emiatt a
    meglévő "tehermentesítés" kapcsoló FIZIKAILAG PONTATLAN betonra
    (monoton terhelésnél, a FEMAti fő üzemmódjában, pontos); `fck`-alapú,
    NEM `fcd` (a FEMAti szerkezeti választ szimulál, nem ULS tervezési
    kapacitást ellenőriz). 8 új teszt (`concreteEC2.test.ts`, zárt alak:
    csúcsponti `σ=-fck`, fennsík, zúzódás utáni nulla, érintő modulus
    numerikus deriválttal <1e-4 relatív eltérésben egyezik) + 3 új teszt
    (`materialState.test.ts`, modell-szintű: húzott rétegek σ=0 minden
    rétegen VÉGIGELLENŐRIZVE). `pnpm check` + coverage tiszta.

46. **[RETROSPEKTÍV] T-szelvény (aszimmetrikus keresztmetszet) támogatás**
    (`bc877ac` + `a21cf1a`, 2026-08-30, **ADR-0020**, C fázis): a rétegelt
    keresztmetszeti mag eddig minden alakot a félmagasságra
    SZIMMETRIKUSNAK tételezett fel — a T-szelvény ezt megtöri (a súlypont
    nincs `h/2`-nél). Tervezési döntés az elején: a **szögvas (L) TUDATOSAN
    KIZÁRVA** a hatókörből — ez nem munkamennyiség kérdése, hanem ELVI
    korlát: a FEMAti egytengelyű síkbeli modellje nem tudná hazugság
    nélkül kezelni az L-szelvény elforgatott főtengelyeit (csatolt
    kéttengelyű hajlítás + csavarás lenne), ami sértené a projekt
    "radikális átláthatóság" elvét. A T-szelvénynek VAN függőleges
    szimmetriatengelye, ezért tisztán illeszkedik az 1D modellbe. Zárt
    alakú súlypont/inercia-levezetés (Steiner-tétel) és a képlékeny
    modulus (egyenlő területű tengely körül) egy kézi referenciapéldán
    (b=100, tf=20, h=200, tw=10 mm) 200 000 pontos FÜGGETLEN numerikus
    integrálással minden tizedesjegyig egyezik. Kockázatcsökkentő döntés:
    `yMax=max(yTop,yBottom)` — a meglévő `GeometricProperties` interfész
    változatlan marad, EGYETLEN meglévő fogyasztó kódot sem kellett
    módosítani. Bekötve a teljes maglánc mentén (parametrikus ÉS rétegelt
    út), 3 új katalógus-bejegyzés (T100/T150/T200), UI-rajz a valós
    súlyponttal (nem automatikusan félmagasságon). **Utólagos javítás
    (`a21cf1a`, ugyanaznap):** a P16 fuzz-teszt egy valós, nem-degenerált
    T-szelvény esetet talált (h≈0,1 m, 12 elem, 13 m fesztáv), ahol az
    aszimmetrikus keresztmetszet rosszabbul kondicionált merevségi
    mátrixot adott, és egy ~1 ULP-nyi bemeneti kerekítési zaj ~7×-esére
    nagyítva a relatív reziduumot 1,02e-9-re vitte — a korábbi, szigorú
    1e-9 egyensúly-tűrés nem hagyott elég tartalékot. Valódi szoftverhiba
    ennél sok nagyságrenddel nagyobb reziduumot adna, ezért a küszöb
    1e-9→1e-8-ra emelve (`diagnostics/selfCheck.ts`) — MÉG MINDIG szigorúan
    a numerikus zaj tartománya. `pnpm check` + a T-profile arbitrary
    generátor a 10 000/500 iterációs fuzz-teszthez zöld.

47. **Megoldó-beállítások is bekerülnek a Mentés/Betöltésbe** (`95e18f3`,
    v2 `.femati.json`): a felhasználó explicit kérése ("MINDEN legyen
    benne") alapján a mentett fájl a szerkeszthető modell mellett mostantól
    a `state/appStore` megoldó-beállításait is tárolja (algoritmus,
    teherlépcső, tolerancia, `λ_cél`, teherhistória) és a nézeti
    kapcsolókat (Gauss-pontok mutatása, M-ábra oldala, aktív diagram-fül).
    Formátum-verzió 1→2, VISSZAMENŐLEGESEN kompatibilis módon — a régi
    (`solverSettings` nélküli) mentések is betölthetők, alapértékekre esve
    vissza. Tudatosan KIMARADT (`model/fileIO.ts` fejlécében dokumentálva):
    a nemlineáris futtatás eredménye (nem praktikusan szerializálható, F5-tel
    reprodukálható), a Levezetés/Hálófüggetlenségi vizsgálat (élő
    újraszámítás, nincs önálló állapot), és az efemer ablak-állapotok
    (nyitott dialógusok, aktív vászon-eszköz).

48. **Pontos x-pozíció megadása támaszoknál/terheknél/ágyazatoknál**
    (`26cc289`): a kijelölt elem adatlapján (bal panel) az `x` (ill.
    `x1`/`x2`) mostantól szerkeszthető számmező, ugyanúgy mint a P/M/q/k
    értékek — egérrel korábban nehéz volt pontos méterre (pl. 13,44 m)
    letenni egy támaszt. Támaszoknál és pont-/nyomatékteherré a beírt érték
    a LEGKÖZELEBBI hálócsomópontra kerekedik (`setLoadPosition` új
    store-művelet, a meglévő `moveSupport`-hoz hasonlóan snappel — a motor
    koncentrált terhet csak csomóponton tud kezelni); megoszló teher/
    nyomaték és ágyazat végpontjai (`setLoadRange`/`setFoundationRange`)
    szabadon, kerekítés nélkül állíthatók, mert ez már eddig is így
    működött a motorban.

49. **Új "Dinamika" fül — tranziens válasz (Newmark-béta)** (`fb4a9a0`,
    ADR-0016/ADR-0017 folytatása): a `fem-core`-ban már kész, tesztelt
    Newmark-béta tranziens megoldót (`solver/transient.ts`) mostantól a UI
    is eléri. A gerjesztéshez NEM kellett új teher-szerkesztő felület: a
    modell meglévő statikus terhét (`buildLoadVector` — ugyanaz, amit a
    nemlineáris teherlépcsőző használ a `λ`-skálázásra) egy időfüggvénnyel
    szorozzuk fel (lépcső/rámpa/harmonikus/impulzus), kezelhető Rayleigh-
    csillapítással (`α`/`β`). Új fájlok: `model/dynamicRun.ts` (paraméteres,
    NEM rétegelt — tisztán rugalmas elemzés), `state/dynamicStore.ts`
    (a `nonlinearStore.ts` mintájára, külön tár, mert nagy, változatlan
    payload), `charts/TransientChart.tsx` (idő-válasz görbe, w/a váltással),
    `charts/DynamicPanel.tsx` (önálló beállítás-űrlap, saját "Futtatás"
    gombbal — NEM a Toolbar SZÁMÍTÁS/F5-je indítja, mert sok, csak ide
    tartozó paramétere van). 4 új teszt (`model/dynamicRun.test.ts`),
    köztük egy fizikai szanity-ellenőrzés (csillapítatlan lépcsőterhelésnél
    a csúcs-lehajlás ~2×-e a statikus értéknek, a klasszikus elmélet
    szerint) és egy csillapítás-hatás ellenőrzés. **v1-korlátok**
    (dokumentálva a fejlécekben, tudatosan nyitva hagyva): a
    referencia-csomópont automatikus (legnagyobb |w|), nincs
    módus-frekvencia-alapú csillapítási arány (`ζ`) mező, a beállítások
    NEM kerülnek a `.femati.json` mentésbe (ld. 43. pont — a dinamika-
    beállítások explicit kimaradtak onnan).

50. **Anyag adatbázis átszabás — elrendezés, több anyag, élethű
    (fényképes) minták** (`aae83a9`): (1) *Elrendezés:* a `MaterialDetail`
    mostantól a `SectionDetail`-nél már bevált `.vem-db__layout` mintát
    használja — a kép bal oldalt, négyzetes, nagyobb (160px, korábban
    120px kör egy széles, üres dobozban), a szöveg közvetlenül mellette
    kezdődik. (2) *Több anyag* (22→27): új alumínium ötvözetek (EN
    AW-5754, -6061, -7075), új fa osztályok (C16, GL28h); a rozsdamentes
    acél (X5CrNi18-10) és az öntöttvas (EN-GJS-400) — eddig a "steel"
    családba begyömöszölve, saját megjegyzéssel dokumentált
    hiányosságként — önálló `MaterialFamily`-t kapott (`stainless`,
    `castiron`), a korábbi hiányosság-megjegyzés törölve. (3) *Élethű
    anyagkép:* a felhasználó saját referenciafotói alapján
    (`assets/materials/`) a beton/fa/öntöttvas család VALÓDI fényképet
    kapott (SVG `<image>`, körbevágva, mind a nagy négyzetes, mind a kis
    16px combobox-ikonon) — lecserélve a korábbi procedurális SVG-mintát;
    a fényes fémek (acél/rozsdamentes/alumínium) továbbra is procedurális
    "mély fém" gradienst kapnak, mert azokhoz nem volt referenciafotó.
    Tesztek frissítve az új családokra/anyagokra (`materials.test.ts`,
    22→27 rekordra).

51. **PDF export bekötése + EC2/EN1993 kihasználtsági-ellenőrzés**
    (`feed6e4`, **ADR-0021**, legfrissebb): versenytárs-elemzés (SkyCiv,
    Dlubal RSTAB/RFEM) alapján a legnagyobb hiányosság a design/
    code-checking hiánya volt — a program kiszámította az igénybevételeket
    (M, T, w, φ), de nem adott %-os, pass/fail jellegű kihasználtsági-
    visszajelzést. Két, egymástól független bővítés: (1) *PDF export:* a
    File → Export → PDF mostantól a Jegyzőkönyvet nyitja meg és indítja a
    böngésző natív nyomtatását (ADR-0005 architektúra követve, nincs új
    függőség — ugyanaz a minta, mint a P15 jegyzőkönyv/P15/A levezetés
    "Nyomtatás" gombja). (2) *Kihasználtsági ellenőrzések* a meglévő M/T/w
    eredmények mellett (`RightPanel` + Jegyzőkönyv): az EN1993 M-V
    interakció (ADR-0018) mostantól explicit "megfelel/túllépi a határt"
    verdiktet is mutat; új lehajlás-ellenőrzés (SLS, `L/250`, minden
    anyagra, `material/serviceabilityCheck.ts`, 11 új teszt); új repedési
    nyomaték-jelzés betonra (EC2, TÁJÉKOZTATÓ jellegű — a motorban nincs
    vasalás-modellezés, ezt a UI is explicit jelzi).

Ez a szakasz szándékosan RÉSZLETESEBB napló-jellegű, mint a fázis-táblázat
sorai — mivel ez a munka nem egyetlen, előre megtervezett fázis, hanem több
kicsi, egymásra épülő felhasználói kérés sorozata volt.
