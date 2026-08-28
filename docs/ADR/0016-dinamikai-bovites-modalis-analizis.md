# ADR-0016 — Dinamikai bővítés: modális analízis (sajátfrekvencia)

**Dátum:** 2026-08-28 · **Státusz:** ELFOGADVA és MEGVALÓSÍTVA — a `fem-core`
numerikus mag (tömegmátrix, sajátérték-megoldó, modális megoldó), az
irodalmi hivatkozások, az elem-szintű levezetés-modul, a felületi
integráció ÉS a `deriveElementMass()` LaTeX/`.docx` megjelenítése is kész és
validált (ld. "Haladás" / "UI-integráció" / "A tömegmátrix-levezetés UI-
megjelenítése" szakaszok). Nyitva marad: egy jövőbeli csillapítás/tranziens-
válasz bővítés (külön ADR).
· **Érinti:** `fem-core` (`element`, `assembly`, `linalg`, `solver`,
`derivation`), `fem-validation`, `ui` (`state`, `model`, `solve`, `charts`,
`format`, `derivation`), `docs/THEORY.md`

## Kontextus

A P0–P18 mesterterv (ld. `STATUS_REPORT.md` 3. pont) lezárta a diplomaterv
**statikus** (lineáris + rugalmas-képlékeny) modelljének hű rekonstrukcióját.
2026-08-28-án a felhasználó explicit döntést hozott: a projekt a
diplomaterv-hűség keretét lezárt alapnak tekinti, és egy **professzionálisabb
irányba** fejleszti tovább a szoftvert — külső szakirodalom immár legitim
forrás, nem csak a diplomaterv (ld. memória: `project-femati-scope-pivot`).

A közvetlen kiváltó ok egy külső forrás áttekintése volt: [TUM ModSim wiki —
"Timoshenko Beam Element for Dynamic Analysis"](https://collab.dvb.bayern/spaces/TUMmodsim/pages/71122833/Timoshenko+Beam+Element+for+Dynamic+Analysis).
Az oldal egy redukált integrációs elem (RIE) **dinamikai** formulázását
ismerteti: tömegmátrix, sajátfrekvencia-számítás, shear locking kezelése —
módszertanilag rokon a meglévő `timoshenko3.ts` szelektív redukált
integrációjával, de a projekt eddig KIZÁRÓLAG statikus analízist végzett,
tömegmátrix és sajátérték-megoldó egyáltalán nincs a kódbázisban.

Ez a dokumentum NEM implementációs döntés, hanem **tervezési vázlat**: hova
illeszkedne a modális analízis a meglévő `fem-core` struktúrába, mit kell
előtte tisztázni, és milyen hatókörrel induljon az első lépés.

## Javasolt hatókör (P19 jelölt)

**Csak modális analízis** (sajátfrekvenciák + módalakok), csillapítás és
tranziens válasz NÉLKÜL. Indoklás: ez a legkisebb, önmagában lezárható,
validálható egység — a meglévő projektkultúra (minden fázis = önálló,
validált, ADR-dokumentált lépés) szerint ez a helyes első szelet, nem a teljes
dinamika egyben.

Kifejezetten HATÓKÖrÖN KÍVÜL marad ebben a lépésben:
- Csillapítás (Rayleigh vagy egyéb) — a TUM oldal sem tárgyalja.
- Időlépéses integrálás (Newmark-béta, HHT-α stb.) — külön ADR-t igényelne.
- Kényszerrezgés / harmonikus válasz.

## Architektúra-illesztés a meglévő `fem-core` struktúrába

| Réteg | Meglévő minta | Javasolt kiegészítés |
|---|---|---|
| `element/timoshenko3.ts` | `elementStiffness()` — hajlítási/nyírási tag külön Gauss-integrálással, `quadratureFor(scheme)` | ÚJ `elementMass()` — a tömegmátrix (transzlációs + forgási tehetetlenségi tag) valószínűleg **teljes** integrálást igényel (a tömeg nem szenved shear lockingtól, ellentétben a merevséggel) — ezt a `quadrature.ts` sémáival kell tisztázni, NEM feltételezni |
| `assembly/assembler.ts`, `dofMap.ts` | globális `K` összeállítása a meglévő DOF-térképpel | a globális `M` összeállítása UGYANAZZAL a DOF-térképpel — feltehetően `assembleMass()` néven, az `assembleStiffness()` melletti testvér-függvényként |
| `linalg/dense.ts`, `skyline.ts` | `DenseMatrix`, `SkylineMatrix` + LDLᵀ faktorizáció | HIÁNYZIK: általánosított sajátérték-feladat (`K·φ = ω²·M·φ`) megoldója — ez ÚJ numerikus komponens, nincs rá meglévő minta a kódbázisban. Legegyszerűbb út: `M` Cholesky-faktorizációja → standard szimmetrikus sajátérték-feladatra transzformálás → (kis DOF-számnál) direkt/QL-algoritmus. Ez a legnagyobb tervezési kockázat, ld. lent. |
| `solver/` | `linearSolver.ts`, `newtonRaphson.ts` mintájára önálló belépési pont | ÚJ `solver/modal.ts` — `solveEigenfrequencies(model): { frequencies, modeShapes }` |
| `fem-validation/` | zárt alakú/kézi referenciák (V-01…V-13 minta) | ÚJ modális esetek: kéttámaszú és befogott-szabad Timoshenko-gerenda ismert zárt alakú első néhány sajátfrekvenciája ellen (a szakirodalomban jól dokumentált esetek) |
| `docs/THEORY.md` | minden képlethez kód-hivatkozás ÉS forrás-oldalszám | ÚJ szakasz, forrásként a TUM oldal + a benne hivatkozott irodalom — DE csak TELJES bibliográfiai adatokkal (ld. nyitott kérdés #3) |

## Nyitott kérdések — implementáció ELŐTT tisztázandók

1. **Tömegmátrix típusa:** konzisztens (a merevségi mátrixszal koherens
   alakfüggvényekből származtatott) vagy lumped (diagonális, koncentrált
   tömegű)? A TUM oldal szerint az RIE tömegmátrixa "egyszerűbb szerkezetű" —
   ezt pontosan meg kell érteni (levezetéssel, nem átvétellel), mielőtt kód
   lesz belőle. Forgási tehetetlenség (rotary inertia) tagját a Timoshenko-
   modellnél NEM szabad elhagyni (ellentétben az Euler-Bernoulli-val).
2. **Sajátérték-megoldó algoritmusa:** a projektben eddig nincs semmilyen
   sajátérték-numerika. Kis DOF-számra (néhány száz) egy dense generalizált
   szimmetrikus sajátérték-megoldó (pl. Cholesky-transzformáció + QL/QR)
   elegendő lehet, de ez ÚJ, önállóan validálandó numerikus komponens — külön
   figyelmet igényel (kondíciószám, szimmetria-őrzés), hasonlóan ahhoz, ahogy
   a `SkylineMatrix.factorize()` is saját, dokumentált tűrés-politikával
   készült (ld. P17 tanulsága, STATUS_REPORT.md 6. pont).
3. **Forrás-hitelesség:** a TUM oldal 3 irodalmi hivatkozást említ (Fogang
   2020, Peuscher et al. 2009, Reedy) TELJES bibliográfiai adatok NÉLKÜL. A
   projekt megőrzött elve (minden mechanikai állítás ellenőrzött forráshoz
   kötött, csak most már nem kizárólag a diplomatervhez) megköveteli, hogy
   ezeket a hivatkozásokat pontos bibliográfiai adatokkal (szerző, cím,
   folyóirat/konferencia, év, DOI ha van) azonosítsuk, mielőtt bármely
   képletet belőlük átveszünk — vagy helyettük egy önállóan levezetett és
   validált formulázást használjunk.
4. **Validációs referencia:** melyik zárt alakú Timoshenko-sajátfrekvencia
   képletet használjuk validációs alapnak (pl. Han et al. összefoglaló
   irodalma), és milyen karcsúsági tartományban várható egyezés (a
   Timoshenko-korrekció a rövid/vastag gerendáknál jelentős, karcsúnál az
   Euler-Bernoulli-hoz tart — ez maga is egy validálandó állítás).

## Döntés

Ez az ADR egy JAVASLAT, nem elfogadott architektúra. A tényleges implementáció
megkezdése előtt a fenti 4 nyitott kérdést külön kell lezárni — javasolt
sorrend: (1) tömegmátrix levezetése és validálása kis, kézzel ellenőrizhető
esetre; (2) sajátérték-megoldó kiválasztása és önálló numerikus tesztelése;
(3) irodalmi hivatkozások pontosítása; (4) az első modális validációs eset
(egyszerű kéttámaszú gerenda) megírása — ezután lehet ADR-t "elfogadott"
státuszra váltani és a `STATUS_REPORT.md`-be új fázisként (P19) felvenni.

### Haladás (2026-08-28)

**1. nyitott kérdés (tömegmátrix) — ELSŐ LÉPÉS KÉSZ, formulázás rögzítve:**

- `element/constitutive.ts`: ÚJ `sectionMass()` — a tömeget a MEGLÉVŐ `gamma`
  (fajsúly) anyagjellemzőből származtatja, `G_ACCEL`-lel (9.80665 m/s²,
  `units/convert.ts`, EN 1990) osztva. **Nem kellett új `Material` mező** —
  ugyanaz az állandó, amit a `makeMaterial()` builder már használ
  `density` → `gamma` irányban (`specificWeightFromDensity`), csak fordítva.
- `element/bMatrix.ts`: ÚJ `nRows()` — a `bRows()` mintájára, de a NEM
  deriválT alakfüggvényeket szórja a w/φ DOF-helyekre (a tömegmátrixhoz
  Nᵢ·Nⱼ kell, nem dNᵢ/dx·dNⱼ/dx).
- `element/timoshenko3.ts`: ÚJ `elementMass()` — konzisztens tömegmátrix,
  w és φ egymástól FÜGGETLEN interpolációval (nincs kereszttag), TELJES
  (3 pontos Gauss) integrálással mindkét tagra — indoklás a függvény
  dokumentációjában.
- `test/mass.test.ts` (11 teszt, mind zöld, `pnpm check` tiszta): méret,
  szimmetria, zérus w–φ kereszttag, pozitív átló, lineáris skálázás a
  fajsúllyal/hosszal, és egy formulázás-független önellenőrzés — a w-blokk
  (és a φ-blokk) összes elemének összege pontosan `m'·L` (ill. `m'ᵩ·L`), a
  `ΣNᵢ(ξ) ≡ 1` partíció-tulajdonságból következően (ld. `element.test.ts`
  "partíció" tesztje) — ez a `rigidBodyModes` merevségi önellenőrzés
  tömegmátrix-megfelelője.

**2. nyitott kérdés (sajátérték-megoldó) — KÉSZ:**

- `linalg/eigen.ts`: ÚJ `cholesky()` (alsó háromszög felbontás, dedikált
  `NotPositiveDefiniteError`-ral), `jacobiEigenSymmetric()` (ciklikus
  Jacobi-forgatás standard szimmetrikus sajátérték-feladatra), és
  `generalizedSymmetricEigen()` (K·φ=λ·M·φ, a kongruens L⁻¹·K·L⁻ᵀ
  transzformáción keresztül).
- **Egy valódi implementációs hiba a fejlesztés közben:** az első Jacobi-
  forgatás a p/q diagonális elemeket KÉT, egymásnak ellentmondó ciklusban
  írta felül (egyszer az oszlop-, egyszer a sor-frissítő lépésben) — a
  `test/eigen.test.ts` "A·v=λ·v" tesztje azonnal elkapta (norm-relatív hiba
  0.34, nem gépi pontosság). Javítva: a p,q bejegyzések a rotáció
  DEFINÍCIÓJA szerint, egyetlen, explicit lépésben állnak be, a többi
  (i≠p,q) elem pedig a RÉGI oszlopértékekből, egy konzisztens ciklusban.
- `test/eigen.test.ts` (10 teszt): Cholesky helyesség + hibakezelés, Jacobi
  A·v=λ·v és ortonormáltás, általánosított feladat K·x=λ·M·x, M-ortonormáltás,
  M=I esetén a standard esettel való egyezés.
- **Egy tesztezési tanulság:** az A·v=λ·v ellenőrzést KOMPONENSENKÉNTI
  relatív hibával írtam először — ez hamis hibát adott egy numerikusan
  zérushoz közeli sajátvektor-komponensnél (a nevező is zérushoz tartott).
  Javítva: VEKTOR-normás reziduum-arány, ugyanaz az elv, mint a meglévő
  `rigidBodyModes` merevségi önellenőrzésnél (`element.test.ts`).

**3. nyitott kérdés (irodalmi hivatkozások) — LEZÁRVA (2026-08-28):**

A TUM oldal References szakaszát SZÓ SZERINT kikérve, majd mindhárom
hivatkozást önállóan (web-keresés útján) ellenőrizve:

1. **Fogang, V. (2020).** *Timoshenko Beam Theory Exact Solution For
   Bending, Second-Order Analysis, and Stability.* Preprints.org.
   [10.20944/preprints202011.0457.v1](https://doi.org/10.20944/preprints202011.0457.v1)
   — publikálatlan preprint (nem lektorált), zárt alakú Timoshenko-megoldás
   hajlításra/másodrendű hatásra/stabilitásra. A projekt jelen lépése
   (tömegmátrix + modális analízis) NEM merít belőle közvetlenül — a
   hajlítási-nyírási anyagtörvény már a meglévő `constitutive.ts`-ben megvan
   (Diplomaterv (2.1)–(2.3) alapján), ez a hivatkozás inkább egy jövőbeli
   másodrendű (geometriai nemlinearitás/stabilitás) bővítéshez releváns.

2. **Peuscher, H., Hubele, J., Eid, R., Lohmann, B. (2009).** *Generating a
   Parametric Finite Element Model of a 3D Cantilever Timoshenko Beam Using
   MATLAB.* Technical Reports on Automatic Control, Vol. TRAC-4, Institute
   of Automatic Control, TU München. **ELLENTMONDÁS a keresési találatok
   közt:** az egyik forrás az első szerzőt "Heiko Panzer"-ként, a TUM oldal
   viselkedik ugyanerre "Peuscher, Heiko"-ként hivatkozik — ez vagy egy
   névtévesztés a keresőmotor AI-összefoglalójában (nem elsődleges forrás),
   vagy a TUM oldal íróinak elírása. A projekt EZT a forrást a jelen
   tömegmátrix-formulázáshoz NEM használta fel közvetlenül (a levezetés
   önálló, ld. lent), ezért ez a bizonytalanság nem befolyásolja a már
   elkészült kódot — de egy PONTOSABB hivatkozáshoz a TRAC-4 jelentés
   eredeti PDF-jét kellene közvetlenül ellenőrizni, ha ez a forrás valaha
   ténylegesen idézésre kerül.

3. **Reddy, J. N. (1999).** *On the dynamic behaviour of the Timoshenko beam
   finite elements.* Sādhanā, 24(3), 175–198.
   [DOI: 10.1007/BF02745800](https://doi.org/10.1007/BF02745800) (a TUM
   oldalon "Reedy" — elírás, a helyes név Reddy). **KÖZVETLEN megerősítés a
   projekt saját eredményéhez:** a cikk kimutatja, hogy "a redukált
   integrációjú elem PONTOSAN előrejelzi a sajátfrekvenciákat, HA elegendő
   számú elemet használunk" — ez SZÓ SZERINT az, amit a `modal.test.ts`
   "h-konvergencia" tesztje méréssel igazolt (a finomabb háló közelebb kerül
   az Euler–Bernoulli-referenciához). A projekt szelektív redukált
   integrációjú eleme (`timoshenko3.ts`, már a P0–P4 fázis óta megvan) éppen
   ez a fajta elem — a modális eredmény tehát NEM csak a saját belső
   validációnkkal, hanem a szakirodalom egy független, lektorált
   eredményével is összhangban van.

**Következtetés:** a tömegmátrix-formulázás ÖNÁLLÓAN lett levezetve (a
meglévő alakfüggvényekből, ld. fent) és zárt alakú referenciával validálva —
egyik fenti forrásból SEM vettünk át képletet közvetlenül. A Reddy (1999)
hivatkozás ennek ellenére értékes: FÜGGETLEN, lektorált megerősítés arra,
hogy a projekt választása (redukált integrációjú elem, kellő elemszámmal) a
helyes irány modális analízisre.

### Levezetés-modul (fem-core adatréteg) — KÉSZ (2026-08-28)

A P15/A mintáját követve (`derivation/elementDerivation.ts`,
`deriveElementStiffness`): ÚJ `deriveElementMass()` — a `sectionMass()` és a
`elementMass()` UGYANAZON, publikus, finom szemcsézetű függvényeit hívja meg
lépésenként (nem "kézzel" számol újra), és Gauss-pontonként rögzíti az N
alakfüggvény-értékeket, a Jacobi-t és a w/φ DOF-sorokat (`nRows`), majd a
végső `me` mezőt — ami BIT-AZONOS a `massAssembler.ts` által ténylegesen
összeadott elemi mátrixszal (`test/derivation.test.ts`, 4 új teszt: bit-
azonosság, 3 Gauss-pont a teljes integrálás miatt, ΣNᵢ=1 partíció-ellenőrzés
minden pontban, hibakezelés ismeretlen elemre).

**MI MARADT NYITVA (LEZÁRVA, ld. lent):** a P15/A-hoz hasonló LaTeX-es/
`.docx`-es megjelenítés a `deriveElementMass()`-hoz
(`ui/src/derivation/DerivationView.tsx` bővítéseként) — ELKÉSZÜLT, ld. "A
tömegmátrix-levezetés UI-megjelenítése" szakasz.

### UI-integráció — KÉSZ (2026-08-28), CSAK VÉGEREDMÉNY (nincs Jacobi-animáció)

A felhasználóval egyeztetve: a sajátérték-megoldás (Jacobi-forgatás)
NEM kap lépésenkénti animált nézetet (ellentétben a "Történelmi mód"
frontális front-lejátszásával) — a UI csak a végeredményt (ω, f, módalak)
mutatja, a K/M Gauss-pontonkénti összeállítása viszont (ha majd a
`deriveElementMass` UI-ja is elkészül) ugyanolyan részletes lenne, mint a
statikus Kₑ-é.

Megvalósítva:

- `state/appStore.ts`: `DiagramTab` ÚJ `'modal'` értékkel, ÚJ `activeMode`
  állapot (a Timeline `activeStep` mintájára).
- `model/compile.ts`: ÚJ `solveModalModel()` — a `solveEditableModel()`
  testvér-függvénye, ugyanazzal a hibatűrő mintával
  (`InvalidModelError`/`NotPositiveDefiniteError` sosem omlasztja össze a
  felületet).
- `solve/useModalResult.ts`: ÚJ hook, `enabled` kapcsolóval — a
  (drágább, dense sajátérték-) számítás CSAK akkor fut, ha a "modális" fül
  ténylegesen aktív, nem minden modellváltozásnál (a `useLiveResult`-tal
  ellentétben, ami mindig fut).
- `charts/ModalPanel.tsx`: ÚJ komponens — a meglévő `SegmentedControl` a
  módusválasztáshoz, a meglévő `DiagramChart` a módalak (w-komponens)
  ábrázolásához. ÚJ `format/numbers.ts` formázók: `frequencyHz`,
  `angularFrequency`, és egy dimenziótlan `modeShape` (a módalak-amplitúdó
  M-ortonormált, NEM fizikai lehajlás — ezt a formázó explicit jelzi: nincs
  mértékegysége).
- `App.tsx`/`DiagramPanel.tsx`: a "modális" fül a meglévő diagram-fül-
  mechanizmusba illesztve (`DIAGRAM_TABS`), minimális beavatkozással.

**Böngészőben ellenőrizve** (kétnyílású folytatólagos tartó, IPE 300, 16
elem, 66 DOF): 8 sajátfrekvencia jelenik meg (27.8–441.0 Hz, monoton nő),
módusváltás helyesen frissíti az ω/f readout-ot és a diagramot (1. módus
csúcsa −2.02 @ x=9.00 m, 2. módusé +2.15 @ x=2.63 m — fizikailag értelmes,
más csomóponti szerkezet, ahogy egy kétnyílású tartónál elvárható), nincs
konzolhiba. `pnpm check` (typecheck+lint+teszt mind a 4 csomagra) tiszta.

**4. nyitott kérdés (fizikai validáció) — ELSŐ ESET KÉSZ:**

- `solver/modal.ts`: ÚJ `solveModal()` — `assemble()` (K) + `assembleMass()`
  (M, ÚJ `assembly/massAssembler.ts`) + `generalizedSymmetricEigen()`. Csak
  `elimination` stratégiát támogat (indoklás a modul fejlécében: a `penalty`
  hamis, magas frekvenciájú módust vinne be).
- `test/modal.test.ts` (6 teszt): egy karcsú (L/h=100), kéttámaszú
  (görgő-görgő) gerenda ELSŐ sajátfrekvenciája a zárt alakú Euler–Bernoulli
  referenciával MÉRVE 1.7e-4 relatív eltérésen belül egyezik (20 elemmel) —
  ez a diszkretizációs hiba ÉS a Timoshenko-korrekció (nyírás + forgási
  tehetetlenség, karcsú gerendánál elhanyagolható) összege. TOVÁBBÁ:
  h-konvergencia (finomabb háló közelebb kerül a referenciához), monoton
  növekvő sajátfrekvenciák, megkötött DOF-ok zérus módalak-értéke, végesség.

**MI MARADT NYITVA:** a 3. nyitott kérdés (a TUM oldalon hivatkozott
irodalom pontos bibliográfiai adatai) — ez NEM blokkolta az implementációt,
mert a tömegmátrix formulázását ÖNÁLLÓAN, a meglévő alakfüggvényekből
vezettük le és validáltuk (nem a hivatkozott cikkekből vettük át), de az ADR
véglegesítése ("elfogadott" státusz) előtt még pontosítandó, ha a projekt a
formulázást a szélesebb szakirodalomhoz is kötni akarja (ld. a projekt
forrás-hitelességi elve, [[project-femati-scope-pivot]]).

### A tömegmátrix-levezetés UI-megjelenítése — KÉSZ (2026-08-28)

A "MI MARADT NYITVA" pont lezárása: a `deriveElementMass()` (fem-core,
változatlan — ld. fenti "Levezetés-modul" szakasz) LaTeX/`.docx`
megjelenítése a `ui/src/derivation/` rétegben, PONTOSAN a meglévő
`deriveElementStiffness()`-minta szerint (ADR-0005 (b) útja: a felület csak
a mag már kiszámított értékeit rendezi "képlet = behelyettesített számok =
eredmény" alakba, semmit nem számol újra saját maga).

- `derivation/formulaLatex.ts`: ÚJ `massGaussTex()` (egy tömegmátrix
  Gauss-pont teljes, behelyettesített LaTeX-levezetése — N alakfüggvények,
  a w/φ DOF-helyekre szórt `nRows()` sorok, majd az m'·|J|·w és m'ᵩ·|J|·w
  tényezők) és `massDiagonalTex()` (a Mₑ[w₁,w₁] ÉS Mₑ[φ₁,φ₁] főátló-elemek
  tagonkénti összegzése — KÉT KÜLÖN taglistából, mert a w-sor és a φ-sor a
  `nRows()` szerkezete miatt sosem csatolt, ellentétben a `keDiagonalTex()`
  egyetlen közös hajlítás+nyírás összegével).
- `derivation/formulaText.ts`: ÚJ `massGaussBlock()` és `massDiagonalDemo()`
  — a fenti kettő szöveges (monospace, Unicode) párja, kizárólag a `.docx`
  exporthoz (ADR-0005: "a .docx-be a szöveges forma kerül").
- `derivation/DerivationView.tsx`: ÚJ "4A. A(z) {elem} elem
  tömegmátrix-levezetése (ADR-0016)" szakasz, KÖZVETLENÜL a meglévő
  "4. Egy választott elem teljes levezetése" (merevség) UTÁN, UGYANARRA az
  `elementId`-ra (a felhasználó által kiválasztott elemre) — nincs külön
  elem-kiválasztás, mert a tömegmátrix ugyanahhoz az elemhez tartozik, mint
  a merevségi mátrix, ezért `derivationData.ts` selection logikája
  VÁLTOZATLAN maradt (a feladatleírás megengedte ezt az egyszerűsítést, ha
  konzisztensebb — itt az). A szakasz al-pontjai (4A.1 Gauss-pontok
  táblázat + soronkénti LaTeX-blokk, 4A.2 Mₑ integrálás konkrét példa két
  mátrixelemre, 4A.3 a 6×6 Mₑ mátrix végső alakja) a 4.2/4.5/4.6 pontok
  mintáját követik. A szakasz FELTÉTEL NÉLKÜL jelenik meg (nincs kapcsolva a
  "modális" diagram-fülhöz) — a levezetés-overlay (`s.derivationOpen`)
  önmagában is teljes, önálló nézet.
- `derivation/derivationExportData.ts`: `DerivationExportContext` ÚJ
  `massDerivation: ElementMassDerivation` mezővel, `DerivationExportData` ÚJ
  mezőkkel (`massPerLength`, `rotaryInertiaPerLength`, `massRows`,
  `massFormulas`, `massDiagonalFormula`, `meRows`) — a meglévő
  `bendingRows`/`bendingFormulas`/`keDiagonalFormula`/`keRows` mintáját
  követve.
- `derivation/docxExport.ts`: ÚJ "4A" heading-blokk a "4" ÉS "5" szakasz
  KÖZÖTT, ugyanazzal a `mono()`/`table()`/`heading()` építőkészlettel, mint a
  4. pont többi al-szakasza.
- Tesztek: `formulaLatex.test.ts` (+1 teszt: minden generált tömegmátrix-
  LaTeX-sor érvényes KaTeX-szintaxis, ÉS a `massDiagonalTex()` w-/φ-blokk
  összegző sora numerikusan egyezik a valódi Mₑ[0,0]/Mₑ[1,1] mátrixelemmel),
  `formulaText.test.ts` (+1 teszt: a szöveges blokkok tartalmazzák a mag
  számait, ÉS a demo-összeg — a `keDiagonalDemo` tesztjének mintájára —
  önállóan újraszámolva 1e-8/1e-12 relatív pontossággal egyezik a tényleges
  `me.get(0,0)`/`me.get(1,1)` értékkel), `docxExport.test.ts` (bővítve: az
  export-adat új mezői nem üresek, és a `.docx` Blob ezekkel együtt is
  sikeresen elkészül). Összesen `packages/ui` teszt: 55 → 58 (mind zöld).
- **Egy tesztezési csapda, amit elkerültünk:** a `massDiagonalTex()`
  kimenete KÉT különálló taglistát ad vissza (w-blokk, majd φ-blokk) — egy
  első tesztváltozat FIX indexszel (`diagLines[2]`) próbálta ellenőrizni az
  összegző sort, ami hibás volt, mert a w-blokk 3 Gauss-pontos taglistája
  miatt az összegző sor a 4. (nem a 3.) index. Javítva: a teszt a sort
  TARTALOM alapján keresi (`.find(l => l.includes('M_e[1,1]'))`), nem fix
  pozíció szerint — így nem törik el, ha a Gauss-pontok száma valaha
  megváltozna.
- `pnpm check` (typecheck + lint + teszt mind a 4 csomagra) TISZTA a
  bővítés után.

## Következmények

- A `fem-core` "nincs DOM-függősége, önmagában is használható" tulajdonsága
  változatlan marad — a modális modul is tisztán numerikus.
- A meglévő statikus/nemlineáris kód (P0–P18) NEM módosul ennek a bővítésnek
  a hatására — a tömegmátrix/sajátérték-megoldó additív, nem invazív bővítés.
- A projekt forrás-hitelességi elve (minden állítás ellenőrzött forráshoz
  kötött) VÁLTOZATLAN marad — csak a megengedett forráskör bővül a
  diplomatervről a szélesebb szakirodalomra.
