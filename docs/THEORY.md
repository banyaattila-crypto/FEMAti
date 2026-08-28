# THEORY — képlet ↔ kód ↔ diplomaterv-oldalszám

**Cél:** egy kívülálló mérnök ebből a dokumentumból állapítsa meg, melyik
diplomaterv-képlet hol van implementálva, és mi bizonyítja a helyességét.
Az oldalszámok a [`Diplomaterv (BME).pdf`](../Diplomaterv%20(BME).pdf) tényleges
lapszámozására mutatnak (nem a nyomtatott fejlécre) — a projekt gyökerében lévő
PDF `pdftotext`/PyMuPDF-fel ellenőrizve, egyenletszámonként.

**Fázis-lefedettség:** P0–P6 (alapozás, domain-modell, lineáris algebra, elem,
kompilálás, tehervektorok, utófeldolgozás), P9 (rugalmas–képlékeny anyagmodell,
nem rétegelt, 13. pont), P10 (rétegelt/fiber keresztmetszet, 14. pont), P11
(nemlineáris megoldó, 15. pont), P12 (képlékeny validációs suite, 16. pont).
A P13-tól kezdődő képletek a további fázisok THEORY.md-kiegészítéseiben
kerülnek ide. A P15 (számítási jegyzőkönyv) NEM vezet be új mechanikai
képletet — a `packages/ui/src/report/ReportView.tsx` kizárólag a fent
dokumentált eredményeket (lineáris `LinearResult`, nemlineáris `NonlinearRun`)
jeleníti meg nyomtatható formában, ugyanazokkal a `fmt.*` formázókkal, mint a
munkaasztal panel-jei — ezért a jegyzőkönyv elméleti hivatkozásai erre a
dokumentumra mutatnak (ld. a jegyzőkönyv 7. pontja).

A P15/A (levezetés, `packages/fem-core/src/derivation/`) SZINTÉN nem vezet be
új képletet — az ADR-0005 (b) útja szerint ÚJRASZÁMOLÁSSAL, a fenti pontokban
már dokumentált mag-függvények (`shapeFunctions`, `jacobian`, `bRows`,
`elementStiffness`, `elementLoadVector`, `updateLayerPlasticState`)
lépésenkénti hívásával készül. A "bit-azonosság" garancia pontos hatókörét
(Kₑ/tehervektor/σ H'=0-nál szigorúan bit-azonos; σ/epsPEff H'>0-nál gépi
pontosságig) ld. [ADR-0008](ADR/0008-levezetes-bitazonossag-pontossaga.md).

---

## 1. Anyagmodell — `element/constitutive.ts`

| Képlet | Diplomaterv | Kód |
|---|---|---|
| `{κ,γ} = H·{M,T}`, `H = diag(1/EI, 1/GAs)` | (2.1)–(2.3), **15. oldal** | `constitutiveMatrix()` |
| `D = H⁻¹ = diag(EI, GAs)` | (2.3), **15. oldal** | `constitutiveMatrix()` |
| Rétegelt szelvény: `EI = Σ Eₗ·bₗ·zₗ²·tₗ`, `GA = Σ Gₗ·bₗ·tₗ` | (3.54), 3.4.3, **64. oldal** | `sectionStiffness()` (rétegelt ág) |

**Teszt:** `element.test.ts` (anyagmátrix), `section.test.ts` (rétegelt EI/GA).

---

## 2. Alakfüggvények és izoparametrikus leképezés — `element/shapeFunctions.ts`, `element/jacobian.ts`

| Képlet | Diplomaterv | Kód |
|---|---|---|
| `N₁(ξ)=½ξ(ξ−1)`, `N₂(ξ)=1−ξ²`, `N₃(ξ)=½ξ(ξ+1)` | (3.4)–(3.6), 3.1.4, **37. oldal** | `shapeFunctions()` |
| `x(ξ) = Σ Nᵢ(ξ)·xᵢ` (izoparametria) | (3.10), **38. oldal** | `jacobian()` → `x` mező |
| `J = dx/dξ = Σ (dNᵢ/dξ)·xᵢ`, invertálhatóság: `det J ≠ 0` | (3.7)–(3.9), **37. oldal** | `jacobian()` |
| `dNᵢ/dx = (dNᵢ/dξ)·J⁻¹` (láncszabály) | (3.12)–(3.13), **38. oldal** | `shapeDerivativesX()` |

**Teszt:** `element.test.ts` — alakfüggvény-partíció (`ΣNᵢ(ξ)=1`), Kronecker-tulajdonság
(`Nᵢ(ξⱼ)=δᵢⱼ`), egyenközű hálón `|J| = Lₑ/2` analitikus egyezés.

---

## 3. B mátrix (alakváltozás) — `element/bMatrix.ts`

| Képlet | Diplomaterv | Kód |
|---|---|---|
| `γ = φ − ∂w/∂x`, `κ = ∂φ/∂x` (kinematika) | (3.1), 3.1.1, **33. oldal** | `bRows()` sorai |
| `B(ξ)` 2×6 mátrix, Timoshenko-modell | (3.14)–(3.15), **39. oldal** | `bMatrix()`, `bRows()` |
| `ε = B·uₑ` | (3.30), **45. oldal** | `strains()` |

Az előjel-konvenció (γ = φ − dw/dx) rögzítve: [CONVENTIONS.md §2](CONVENTIONS.md#2-előjel-konvenció).

**Teszt:** `element.test.ts` — a B mátrix soronkénti értékei zárt alakban ellenőrizve
kis elemszámon; a γ-sor előjelfüggetlensége a merevségi mátrixban, de a T
nyíróerő előjelfüggése külön tesztelve.

---

## 4. Gauss–Legendre kvadratúra — `element/quadrature.ts`

| Képlet | Diplomaterv | Kód |
|---|---|---|
| `∫f(ξ)dξ ≈ Σ aᵢ·f(ξᵢ)` a `[−1,1]` intervallumon | (3.16)–(3.17), **39. oldal** | `GAUSS_1`, `GAUSS_2`, `GAUSS_3` |
| 2 és 3 pontos súlytáblázat (1. táblázat) | **40. oldal** | `GAUSS_2 = [∓√(1/3), w=1]`, `GAUSS_3 = [∓√0.6 w=5/9; 0 w=8/9]` |
| Szelektív redukált integrálás (hajlítás 3 pont, nyírás 2 pont) | 3.1.4 szöveges indoklás | `quadratureFor('selective' \| 'full')` |

**Teszt:** `fem-validation/src/cases/v04-locking.ts` — a V-04 locking-teszt:
`selective` sémánál a relatív hiba karcsúsággal (L/h) NEM nő (gépi pontosság
marad, ~1e−15…1e−8), `full` sémánál NEM tűnik el, hanem nemnulla platón marad
(~12–20%) — ez maga bizonyítja a záródást. (2026-08-23: korábban ez a
hivatkozás egy sosem létezett `element.test.ts` fájlra mutatott, és a
validációs eset maga sem létezett — a `STATUS_REPORT.md` ennek ellenére
"kész, zöld"-ként tartotta nyilván. A hiba egy külső forrás — a MathWorks
Symbolic Math Toolbox Timoshenko-cikke — alapján végzett önreflektív
áttekintés során derült ki, ld. `STATUS_REPORT.md` 23–24. pont.)

---

## 5. Elemi merevségi mátrix — `element/timoshenko3.ts`

| Képlet | Diplomaterv | Kód |
|---|---|---|
| `Kₑ = ∫ Bᵀ·D·B dx = ∫₋₁¹ Bᵀ·D·B·\|J\| dξ` | (3.11), 3.1.5, **38. oldal** | `elementStiffness()` |
| Mátrixos kifejtés, Timoshenko-modell | (3.24)–(3.26), 3.1.7, **43. oldal** | `elementStiffness()` (két külön ciklus: hajlítás/nyírás) |
| `K·v = q` (szerkezeti szint) | (3.27), **43. oldal** | `assembler.ts` → `assemble()` |
| `σ = D·ε` → `M = EI·κ`, `T = GAs·γ` | (3.30)–(3.31), 3.1.7.4, **45. oldal** | `internalForces()` |

**Mutációs próba (P3):** `element.test.ts` — a tiszta nyírási energia teszt
(`½·GAs·γ²·L`) egy valódi mutációs próba nyomán született: a nyírási Gauss-súly
elhagyása a szelektív sémánál (véletlenül) láthatatlan marad, a teljes sémánál
viszont 1.5-szörös hibát okoz — ezért mindkét séma ellenőrzött.

**Merevtest-mozgás (nulltér):** `rigidBodyModes()` — `Kₑ·u_rigid = 0`
(eltolás `w=1,φ=0` és merev elfordulás `w=x,φ=1`), rangvizsgálattal (`rank(Kₑ)=4`).
Teszt: `element.test.ts`.

---

## 6. Globális kompilálás — `assembly/assembler.ts`, `assembly/dofMap.ts`

| Képlet | Diplomaterv | Kód |
|---|---|---|
| Szabadságfok-kiosztás: csomópontonként `[w,φ]`, globális index `2i, 2i+1` | 3.1.7, **43. oldal** | `buildDofMap()` |
| `K` szimmetrikus, szinguláris ⇔ mechanizmus | 3.1.7.1, **43. oldal** | `SkylineMatrix` (P2) + `ironsMechanismCount()` (`diagnostics/selfCheck.ts`, P3 önellenőrzés) |
| Peremfeltétel-kezelés: elimináció / nagy rugóállandó (`~10¹⁰` kN/m) | 3.1.7.3, **44. oldal** | `assemble()` — `strategy: 'elimination' \| 'penalty'`, `DEFAULT_PENALTY = 1e10` |
| Winkler-féle rugalmas ágyazat `K_ágy = ∫ Nᵀ·c·N dx` | (3.28), 3.1.7.2, **44. oldal**; ld. még 5. fejezet, **70. oldal** | `foundationMatrix()` |
| Frontális elimináció (a mai skyline+LDLT megfelelője) | 3.1.7.3/3.1.7.5, **44./47. oldal** | `linalg/skyline.ts` (`SkylineMatrix`, [ADR-0002](ADR/0002-skyline-vs-frontalis.md)) |

**Mutációs próba (P4):** `assembly.test.ts` → *"K_ágy elemeinek összege zárt
alakban c·L"*. Az alakfüggvény-partíció (`ΣNᵢ(ξ)≡1`) miatt a `foundationMatrix`
minden elemének összege zárt alakban `c·L`, hálótól függetlenül — ez egy szoros,
analitikus ellenőrzés, nem csak "nagyobb, mint" jellegű. A próba: a `detJ`
tényezőt (a Jacobi-transzformációt) szándékosan kihagyva a `factor = c·detJ·gp.w`
szorzatból, a teszt azonnal elbukik (a mért összeg felényire esik egy 2 elemű
hálón) — ez igazolja, hogy a teszt valóban a képletet őrzi, nem csak a kódlefutást.

---

## 7. Tehervektorok — `assembly/loadVector.ts`

| Képlet | Diplomaterv | Kód |
|---|---|---|
| Kezdeti alakváltozásból: `qₑ = ∫Bᵀ·D·ε0 dV` | (3.19), 3.1.6, **40. oldal** | `reduceThermal()`, `elementKappa0()` |
| Erőjellegű terhekből: `qₑ = ∫Nᵀ·p dV` | (3.20), **40. oldal** | `reduceDistributed()` |
| Összevont alak: `qₑ = ∫Bᵀ·D·ε0 dV + ∫Nᵀ·p dV + ∫Nᵀ·p dS` | (3.21), **40. oldal** | `buildLoadVector()` |
| Koncentrált csomóponti teher: `qₑᵢ = Σ Nᵢᵀ·pᵢ` | (3.22), 3.1.6.1, **41. oldal** | `buildLoadVector()` — `nodal-force`/`nodal-moment` ág |
| Megoszló teher (lineáris/parabolikus `q(x)`) | 3.1.6.2, **41. oldal** | `reduceDistributed()`, `distributedValueAt()` |
| Önsúly: `p_z = γ·A` (Gauss-ponti bázisfüggvény-összeg alakban) | (3.23), 3.1.6.3, **42. oldal** | `buildLoadVector()` — `self-weight` ág |
| Hőteher: `κ0 = α·(t_alsó−t_felső)/h`, `ε0=[κ0,0]ᵀ` | 3.1.6.4, **42. oldal** | `elementKappa0()` |
| Támaszmozgás (nem tehervektor-tag, a peremfeltétel-kezelésbe épül) | 3.1.6.5, **42. oldal** | `assembler.ts` — `constraintLoad` |

**Előjel-eltérés a MASTER-PROMPT-TERV 1.4 pontjától:** a diplomaterv EREDETI
(3.19) képlete — a fenti oldalkivonat szerint — **pozitív** előjellel adja meg
az `∫BᵀDε0` tagot; a MASTER-PROMPT-TERV 1.4 pontja tévesen negatív előjellel
írta át. A kód a diplomaterv eredetijét követi (pozitív előjel), a
`σ = D·(ε−ε0)` (1.6 pont) konvencióval párban — ld. [ADR-0006](ADR/0006-hoteher-elojel.md)
a teljes levezetéssel és a numerikus igazolással (V-07 zárt alak).

**Validáció (fem-validation, P5):** V-02 (kéttámaszú, egyenletes q — diszkretizációs
tűrés), V-07 (hőteher, statikailag határozott — `M≡0`), V-08 (hőteher, befogott —
`w≡0`, `M=−EI·κ0`), V-09 (támaszsüllyedés, kétnyílású — erőmódszeres zárt alak),
V-10 (önsúly = ekvivalens megoszló teher, két úton azonos).

---

## 8. Lineáris megoldás és reakciók — `solver/linearSolver.ts`

| Képlet | Diplomaterv | Kód |
|---|---|---|
| `K·v = q` megoldása (LDLᵀ, skyline) | 3.1.7.3, **44. oldal** | `solveLinear()` → `system.k.solve(rhs)` (P2: `linalg/skyline.ts`) |
| Reakcióerő: minden támasztípusra egységes `reakció[d] = elemek_belső_ereje[d] − külső_teher[d]` | 3.1.7 (levezetve, numerikusan igazolva) | `solveLinear()` — a fejléc-kommentben teljes levezetéssel |
| Globális egyensúly `ΣFz=0`, `ΣMy=0` | 3.1.7 elve, gépi pontossággal (HIBATURESI-POLITIKA 3. pont) | `checkEquilibrium()` |
| Igénybevétel hőteherrel: `M = EI·(κ−κ0)` (`σ=D·(ε−ε0)`) | 3.1.7.4/1.6 pont, **45. oldal** | `internalForces(..., kappa0)` |

**Validáció (fem-validation, P4):** V-01 (konzol, végponti P), V-03 (tiszta
hajlítás patch-test), V-05 (merevtest-mozgás), V-06 (szimmetria + pozitív
definitség), V-11 (penalty vs. elimináció). A `packages/
fem-validation/src/cases/` alatt esetenként egy fájl; a csomag tesztfutása
(`pnpm --filter @femati/fem-validation test`) egyben generálja a
[`docs/VALIDATION.md`](VALIDATION.md) jegyzőkönyvet (3.3 pont).

**Szervezési megjegyzés:** a MASTER-PROMPT-TERV P6 promptja egy önálló
`post/internalForces.ts` fájlt írt elő az `M`/`T` Gauss-ponti számításához.
Ez a logika ténylegesen a `element/timoshenko3.ts` (`internalForces()`) és a
`solver/linearSolver.ts` (`elementResults()`) között oszlik meg — mert
szorosan együtt jár a `PreparedElement`/`ElementResult` típusokkal és a
megoldási hurokkal, amelyek csak `linearSolver.ts`-ben léteznek. Külön
`post/`-modulba (ld. 9. pont) csak azok a lépések kerültek, amelyek
VALÓBAN szétválaszthatók a megoldási hurоktól: az extrapoláció, a
hibabecslés és a teherlépcső-history — ezek nem igényelnek hozzáférést az
`AssembledSystem`-hez, csak a már kiszámított Gauss-ponti eredményekhez.

---

## 9. Utófeldolgozás — `post/extrapolation.ts`, `post/errorEstimator.ts`, `post/history.ts`

| Képlet | Diplomaterv | Kód |
|---|---|---|
| Gauss-ponti extrapoláció a csomópontokba (másodfokú parabola-illesztés) | 3.1.7.4, **46. oldal** | `extrapolateElementToNodes()`, `lagrangeAt()` |
| Elemhatáron a két érték átlagolása | 3.1.7.4, **46. oldal**: „a program egyszerűen a 2 érték átlagával helyettesíti" | `averageAtNodes()` |
| Hibabecslő: az átlagolás ELŐTTI ugrás, a mező szélsőértékére normálva [%] | MODERN kiegészítés (nincs a diplomatervben) — MASTER-PROMPT-TERV P6 prompt | `estimateElementError()` |
| Teherlépcsőnkénti pillanatképek (egyparaméteres terhelés) | 3.2.1, **49. oldal**: „Terhelés: egyparaméteres" | `computeLoadHistory()`, `displacementsAtStep()` |

**A `lagrangeAt()` extrapolációs mátrixa zárt alakban:** mivel a 3 Gauss-pont
(ξ=∓√0.6, 0) és a 3 csomópont (ξ=−1,0,+1) EGYARÁNT csak 3 hely, a
másodfokú Lagrange-polinom a csomópontokban kiértékelve egy fix (3×3-as
elforgatás nélküli) lineáris leképezés — a kódban NEM hardkódolt konstansként,
hanem a Lagrange-képlettel futásidőben számolva (így bármely jövőbeli
kvadratúra-változtatás mellett is helyes marad).

**Mutációs próbák (P6):** ld. 12. pont.

**Validáció (fem-validation, P6):** V-12 (h-konvergencia tanulmány) — mivel a
kvadratikus Timoshenko-elem CSOMÓPONTI válasza egyenletesen megoszló teherre
gépi pontossággal EGZAKT (szuperkonvergencia), a konvergencia-vizsgálat egy
FIX FIZIKAI (nem csomóponti) pontban, alakfüggvénnyel interpolált értéket
használ — ott már valódi, hálófüggő diszkretizációs hiba mérhető, és annak
log–log meredeksége esik a 2.8–3.2 sávba.

---

## 10. Keresztmetszeti jellemzők — `section/properties.ts`

| Képlet | Diplomaterv | Kód |
|---|---|---|
| Rugalmas keresztmetszeti modulus `Kₑ = I/y_max` | (3.37), **53–54. oldal** | `geometricProperties()` |
| Képlékeny keresztmetszeti modulus `Kp = 2·S₀` | (3.39), **53–54. oldal** | `geometricProperties()` |
| Alaki tényező `c = Kp/Kₑ` (4. táblázat: téglalap 1.50, kör 1.70, körgyűrű 1.27, I-szelvény 1.14–1.16) | 4. táblázat, **54. oldal** | `geometricProperties()` |

**Teszt:** `section.test.ts` — a számított `c` tényezők a 4. táblázat értékeit adják
vissza (1–2%-os tűréssel); a P-01/P-02 validációs esetek (P9) kötik be a teljes
láncot (`geometricProperties()` → `c`). **Figyelem:** a 4. táblázat I-szelvény
1.14–1.16 sávja a diplomaterv-korabeli, ZÖMÖK gerincű szelvényekre vonatkozott —
egy mai karcsú IPE/HEB gerinc `c`-je ez alá esik (ld. `section.test.ts` "minél
nagyobb az övek aránya..." teszt); a P-02 eset ezért egy INP300-stílusú, vastag
gerincű I-szelvényt (`iProfile(0.3, 0.125, 0.009, 0.015)`) használ, nem egy mai
katalógusszelvényt.

### 10.1 Nyírási korrekciós tényező (κs, `shearFactor`)

A `GAs = κs·G·A` nyírási merevségben szereplő κs (Diplomaterv (2.2), a
`SectionStiffness.gas` mezője, ld. 1. pont) a modellben `Section.shearFactor`
néven szerepel. A `model/builder.ts` `makeSection()`/`makeLayeredSection()`
API-jának alapértelmezése (ha a hívó nem ad meg mást) VÁLTOZATLANUL a
konstans

```
RECT_SHEAR_FACTOR = 5/6   (model/builder.ts)
```

de a felület (`ui/model/compile.ts` — lineáris/parametrikus út — és
`ui/model/nonlinear.ts` — rétegelt/nemlineáris út) MOST MÁR explicit,
alak- és Poisson-tényező-specifikus értéket ad át
(`section/properties.ts` `recommendedShearFactor(shape, nu)`, ld. lent) —
tehát a ténylegesen futtatott modellekben (mindkét analízis-úton) a
finomabb Cowper-formula érvényesül, nem a konstans 5/6.

Ez a klasszikus, konstans (Poisson-tényezőtől FÜGGETLEN) téglalap-
keresztmetszeti érték — forrás: **Newlin, J. A. & Trayer, G. W., "Deflection
of Beams with Special Reference to Shear Deformations"**, National Advisory
Committee for Aeronautics jelentés (ld. Ahmed, A. M. & Rifai, A. M. (2021),
["Euler-Bernoulli and Timoshenko Beam Theories: Analytical and Numerical
Comprehensive Revision"](http://dx.doi.org/10.24018/ejers.2021.6.7.2626),
European Journal of Engineering and Technology Research, 6(7), 20–32,
amely a κ pontos eredetét referenciánként szétválasztva tárgyalja).

**PONTOSÍTÁS (a korábbi, pontatlan hivatkozás javítása):** az 5/6 érték NEM
Cowper (1966) saját eredménye — Cowper, G. R. ("The Shear Coefficient in
Timoshenko's Beam Theory", Journal of Applied Mechanics, Vol. 33, No. 2,
pp. 335–340) egy ENNÉL FINOMABB, Poisson-tényezőtől FÜGGŐ formulát vezetett
le téglalap keresztmetszetre:

```
κ_Cowper = 10·(1+ν) / (12+11·ν)
```

amely ν=0-nál pontosan 5/6-ra egyszerűsödik, de pl. acélra (ν≈0.3) κ≈0.850-et
ad, nem 0.833-at (~2%-os eltérés). A κ „helyes" értéke a mai napig nem
egyértelmű, alak- és Poisson-tényező-függő konszenzus nélküli kérdés a
szakirodalomban (ld. összefoglalóan [Timoshenko beam theory — Encyclopedia
MDPI](https://encyclopedia.pub/entry/34559): Mindlin–Deresiewicz 1953,
Roark 1954, Stephen 1980, Hutchinson 1981 további, egymástól eltérő
közelítéseket adnak).

**MEGVALÓSÍTVA (2026-08-29):** `recommendedShearFactor(shape, nu)` —
Cowper-formulák téglalapra, körre és vékonyfalú csőre:

```
téglalap:       κ = 10·(1+ν) / (12+11·ν)
kör:            κ = 6·(1+ν)  / (7+6·ν)
vékonyfalú cső: κ = 2·(1+ν)  / (4+3·ν)
```

Mindhárom ν=0-nál a korábbi, konstans érték határesetét adja vissza
(téglalap: 5/6; cső: 1/2, ami egybeesett a korábbi, hardcodeolt
konstanssal is). **Az I-szelvényre (és U-szelvényre) VÁLTOZATLANUL** a
korábbi, egyszerűbb "a nyírást gyakorlatilag a gerinc veszi fel" közelítés
(Aweb/A) marad érvényben — Cowper saját I-szelvény formulája jóval
bonyolultabb (öv/gerinc arányoktól függő), ennek levezetése/validálása egy
KÉSŐBBI, külön lépés lenne.

A `nu` paraméter KÖTELEZŐ (nincs hallgatólagos alapértelmezés) —
`recommendedShearFactor(shape, nu)` szignatúrával, hogy a hívó ne
felejtse el megadni a tényleges anyag Poisson-tényezőjét (ADR-0001 elve:
explicit dimenzió-/paraméter-ellenőrzés a publikus belépési pontokon).

**Teszt:** `section.test.ts` "nyírási alaktényező" leírásblokk — a ν=0
határeset egyezése a korábbi konstansokkal, a ν=0.3 Cowper-érték,
és minden alak/ν-kombinációra a (0,1] tartományba esés.

---

## 11. Egységek — `units/brands.ts`, `units/convert.ts`

| Tétel | Diplomaterv | Kód |
|---|---|---|
| Belső (SI) vs. felhasználói egységrendszer, 3. táblázat | 3.1.8, **48. oldal** | `units/brands.ts`, `units/convert.ts` |

Részletek: [CONVENTIONS.md §3](CONVENTIONS.md#3-egységek).

---

## 12. A diplomaterv modulábrája → mai megfelelők

(MASTER-PROMPT-TERV.md 2.3 pontja, a diplomaterv 3.1.7.5 / 3.4.1 modulábrája
alapján, **47. oldal**.)

| Eredeti modul (3.1.7.5 / 3.4.1) | Mai megfelelő |
|---|---|
| `SFR1` (N(ξ) mátrix) | `element/shapeFunctions.ts` |
| `JACOBI` (J, J⁻¹) | `element/jacobian.ts` |
| `MODB` (D mátrix) | `element/constitutive.ts` → `constitutiveMatrix()` |
| `BMATB`, `DBE` | `element/bMatrix.ts` |
| `STIFFB` / `STIFF1..3`, `ASTIF1` | `element/timoshenko3.ts` → `elementStiffness(geom, stiffness, scheme)` |
| `LOADB` | `assembly/loadVector.ts` |
| `FRONT` / `ASSEMB`+`GREDUC`+`BAKSUB` | `assembly/assembler.ts` + `solver/linearSolver.ts` (+ `frontal.ts`, P17) |
| `STREB` | `element/timoshenko3.ts` → `internalForces()` + `solver/linearSolver.ts` → `elementResults()` (ld. 9. pont „szervezési megjegyzés") |
| „Igénybevételek, elmozdulások extrapolálása" (3-4. ábra) | `post/extrapolation.ts` → `extrapolateElementToNodes()`, `averageAtNodes()` |
| `INITAL`, `INCREM` | `post/history.ts` → `computeLoadHistory()` (lineáris fázisban); `solver/loadStepper.ts` (P9+, nemlineáris) |
| `NONAL` | `solver/newtonRaphson.ts` (P9+) |
| `REFORB` | `material/resultantPlastic.ts` → `updateResultantPlasticState()` / `material/elastoPlastic1D.ts` → `updateLayerPlasticState()` + `solver/nonlinearElement.ts` → `elementInternalForceVector()` (P9+) |
| `CONUND` | `solver/convergence.ts` (P9+) |
| `OUTPUT` | `post/*` + `ui/charts/*` (P6, P8) |

---

## 13. Rugalmas–képlékeny anyagmodell (nem rétegelt) — `material/resultantPlastic.ts`

| Képlet | Diplomaterv | Kód |
|---|---|---|
| Teljesen képlékeny nyomatéki teherbírás `M0 = σ0·Kp` | (3.47), 3.4.2, **62. oldal** | `plasticMomentCapacity()` |
| Alakváltozás felbontása `dε = dε_e + dε_p` | (3.48), **62. oldal** | `updateResultantPlasticState()` (implicit, a próba-visszavetítés lépésein keresztül) |
| Keményedési modulus `H' = (dM/dε)_(f=0, terhelés)` | (3.49), **62. oldal** | `updateResultantPlasticState()` — `hPrime` paraméter |
| Tangens hajlítómerevség `EI_T = EI·H'/(EI+H')` | (3.50)–(3.51), **63. oldal** | `tangentBendingStiffness()` |
| Nyírás mindig rugalmas: `dQ = GAs·dγ` | (3.52), **63. oldal** | `updateResultantPlasticState()` — a `t` mező számítása, a folyási feltételtől függetlenül |

**Modellezési döntés:** a keresztmetszetet EGYETLEN M–κ rugóként kezeli (nem
rétegenkénti σ-ε állapot — az a rétegelt modell, P10, 3.4.3 dolga). A folyási
felület `f = M² − M0²` (MASTER-PROMPT-TERV 1.7/A). Az állapotfrissítés egy
STANDARD, zárt alakú (nem iteratív) 1D radial-return leképezés — lineáris
keményedésnél ez EGZAKT, és pontosan a (3.47)–(3.52) fizikát valósítja meg. A
diplomaterv 3.4.4 pontjának R-faktoros visszavetítése a RÉTEGELT modellre
vonatkozik (P10); az itteni egyrugós esetre a standard számítási plaszticitás
zárt alakú megoldása (pl. Simo–Hughes) egzaktul alkalmazható, ezért nem az
R-faktoros közelítést használja — indoklás a fájl fejlécében.

**Teszt:** `resultantPlastic.test.ts` — 11 teszt: `plasticMomentCapacity`,
`yieldFunction`, `tangentBendingStiffness` (zárt alak + `H'=0`/nagy-`H'`
határesetek), rugalmas tartomány, plató `H'=0`-nál, teljes terhelés-tehermentesítés
ciklus `H'=0`-nál (a kritikus elfogadási kritérium — tehermentesítéskor vissza
kell térni az `EI` meredekségre, nem `EI_T`-re), keményedő ág (`H'>0`),
tehermentesítés a keményedő ágról, nyírás mindig rugalmas.

**Mutációs próba (P9):** `updateResultantPlasticState()` — a `dKappaP = fTrial /
(ei + hPrime)` nevezőjéből a `hPrime` tag szándékos kihagyása
(`fTrial / ei`) a keményedő ág tesztjét elbuktatja (`expected 5000 to be
close to 4000`) — igazolva, hogy a teszt valóban a (3.49)–(3.51) H'-függést
őrzi, nem csak a kódlefutást.

**Validáció (fem-validation, P9):** P-01 (téglalap, `c=1.50`, zárt alak), P-02
(kör `c=1.70`, körgyűrű `c=1.27` vékonyfalú határesetben, I-szelvény `c∈[1.14,1.16]`
zömök gerinccel), P-12 (`EI_T` egytengelyű ellenőrzés három `H'` értékre, gépi
pontossággal).

---

## 14. Rétegelt (fiber) keresztmetszet — `material/layeredSection.ts`, `material/elastoPlastic1D.ts`

| Képlet | Diplomaterv | Kód |
|---|---|---|
| Rétegzési merevségek `EI = Σ Eₗ·bₗ·zₗ²·tₗ`, `GA = Σ Gₗ·bₗ·tₗ` | (3.53)–(3.54), 3.4.3, **64. oldal** | `sectionStiffness()` (P0-tól meglévő, `LayeredSection` ág) |
| Nemlineáris egyenletrendszer (virtuális munka) | (3.55)–(3.58), 3.4.3.1, **64. oldal** | (a globális egyensúlyi hurok, P11) |
| Rétegenkénti feszültségekből: `M = Σ σxl·bl·zl·tl` (a diplomaterv `Q = Σ τxzl·bl·tl`-t is definiál, de ez NINCS implementálva — a nyírás a rétegelt modellben is MINDIG rugalmas marad, `T = GAs·γ`) | (3.59), 3.4.3.2, **65. oldal** | `sectionMoment()` (csak az `M`-tag) |
| Rétegelt algoritmus (1–7. lépés, megegyezik a nem-rétegelttel az 5. pont kivételével) | 3.4.3.2, **65. oldal** | `solver/newtonRaphson.ts` (P11) |
| REFORB — feszültség-visszavetítés döntési táblázata (négy eset) | 3.4.4, **66–67. oldal** | `updateLayerPlasticState()` — a négy ág explicit if-ággá fordítva |
| `R` redukciós tényező — HELYES képlet: `R = fTrial/Δσ_trial = (AC−AB)/AC` (**NEM** az `AB/AC` arány — az egy korai, javított hiba volt, ld. [ADR-0007](ADR/0007-r-faktor-elojel-hiba.md) és a 16-17. pont) | 3.4.4, 3-10. ábra, **67. oldal** | `updateLayerPlasticState()` — `r` mező |
| `Δσ_ep = R·Δσ_r·E/(E+H')`, `Δε_p = R·Δε_r·E/(E+H')` | 3.4.4, 5–6. lépés, **68. oldal** | `updateLayerPlasticState()` → `plasticStep()` |
| Kiegyensúlyozott csomóponti erő `f = ∫Bᵀσ_r dx` (3 pontos Gauss) | (3.60), **68. oldal** | `solver/nonlinearElement.ts` → `elementInternalForceVector()` (P11) |

**Rétegzés-generálás (`generateLayers`):** a parametrikus szelvényekből (rect,
circle, tube, i-profile) `layerCount` egyenlő vastagságú, vízszintes csík
generálódik. A csík `z` (középvonal) mezője a geometriai középpont marad; a
`b` (szélesség) viszont **terület-megőrző almintavételezéssel** (200
alpont/réteg, `A_l=Σb(zk)·Δz`, `b_l=A_l/t`) adódik — ld.
[ADR-0014](ADR/0014-fiber-reteg-szelesseg-hiba.md). **Fontos, ellenőrzött
részlet:** téglalapnál a `Kp` (`∫|z|dz`, szakaszonként LINEÁRIS integrandus)
a középponti szabállyal EGZAKT bármely rétegszámnál, de az `EI` (`∫z²dz`,
MÁSODFOKÚ integrandus) NEM — a diszkrét összeg zárt alakban levezethetően
`EI_zárt·(1−1/n²)` (ld. `layeredSection.test.ts`). Ez a különbség a P-13
rétegszám-konvergencia vizsgálat alapja.

**VALÓDI hiba, felhasználó jelentette (ADR-0014):** a `b` KÖZÉPPONTI (nem
terület-megőrző) mintavétele TÖRÉSPONTOS kontúrnál (`i-profile` gerinc/öv
átmenet) durván félrevezető, ha egy réteg éppen átnyúlik a törésponton — a
teljes réteg-vastagsághoz a középpontban mért, esetleg a szélesebb
tartományból vett szélesség rendelődik. Egy IPE300-ra, 16 réteggel (a régi
kóddal) a terület ~39-44%-kal, az inercia ~46-52%-kal volt túlbecsülve — ezt
egy külső felülvizsgálat MÉRÉSSEL találta meg (a levezetés-dokumentumban
számolt A/I érték jelentősen eltért a szelvénytáblázatétól). A meglévő
tesztkészletnek volt egy vak foltja: az egyetlen korábbi I-szelvényes teszt
szándékosan (bár nem tudatosan) olyan rétegszámot használt, amely pontosan
illeszkedik a gerinc/öv határra, így a hibás (átnyúló réteges) eset sosem
futott le. A javítás (terület-megőrző almintavételezés) a mért hibát
0,07%-ra (terület), illetve 4,6%-ra (inercia, másodrendű, az
`includeLayerOwnInertia`-val rokon maradék hatás) csökkentette.

**Modellezési döntés (REFORB port):** a döntési táblázat négy ágát explicit
elágazásként valósítja meg a kód (nem összevont zárt alakú képletként), mert
a MASTER-PROMPT-TERV 1.8 pontja kifejezetten "PONTOSAN... a négy eset"
szerinti implementációt kér, egyenként tesztelhetően. Algebrailag igazolható
(és a `elastoPlastic1D.test.ts`-ben ellenőrzött), hogy lineáris keményedésnél
ez a bontás pontosan a nem-rétegelt modell zárt alakú radial-return
eredményét adja vissza.

**Teszt:** `layeredSection.test.ts` (rétegzés-generálás, rétegszám-konvergencia,
`sectionMoment`), `elastoPlastic1D.test.ts` (a négy döntési ág, keményedés,
tehermentesítés, teljes ciklus, degenerált `H'≤−E` eset).

**Mutációs próba (P10):** `updateLayerPlasticState()` → `plasticStep()` — a
`denom = e + hPrime` helyett `denom = e` (a `hPrime` tag szándékos kihagyása)
a keményedő ág tesztjét elbuktatja (`50000000` a várt `40000000` helyett) —
igazolva, hogy a teszt valóban a (3.49)-höz hasonló `H'`-függést őrzi.

**Validáció (fem-validation, P10):** P-09 (rétegelt M–κ görbe zárt megoldással,
rugalmas–tökéletesen képlékeny téglalap, 5 görbületi szinten, 64 réteggel,
1%-on belül), P-13 (Mp rétegszám-konvergencia a zárt alakú M0-hoz, ÉS a
semleges tengely elmozdulásának kimutatása egy aszimmetrikus 3-blokkos
szelvénynél: a rugalmas súlyponton az axiális erő ERŐSEN nullától eltérő,
az egyenlő-terület tengelyen viszont ≈0 — ez maga a bizonyíték, hogy a
képlékeny semleges tengely nem a rugalmas súlyponton van).

---

## 15. Nemlineáris megoldó — `solver/newtonRaphson.ts`, `solver/loadStepper.ts`, `solver/convergence.ts`, `solver/materialState.ts`, `solver/nonlinearElement.ts`

| Képlet | Diplomaterv | Kód |
|---|---|---|
| Az algoritmus 1–7. lépése (tehernövekmény, K_T, Δu, frissítés, belső erő, konvergencia) | 3.4.2.1/3.4.3.2, **65. oldal** | `runNewtonRaphsonStep()` |
| Belső erővektor `p = ∫Bᵀσ dx` (3 pontos Gauss) | (3.60), **68. oldal** | `nonlinearElement.ts` → `elementInternalForceVector()` |
| Tangenciális merevségi mátrix `K_T` (2. lépés) | 3.4.2.1/2, **65. oldal** | `nonlinearElement.ts` → `elementTangentStiffness()` |
| Konvergencia (CONUND): `100·√(Σψᵢ²)/√(Σfᵢ²) ≤ Tolerancia` | 3.4.2.1/6, **65. oldal** | `convergence.ts` → `residualPercent()` |
| Algoritmusválasztás (NONAL: teljes/módosított Newton, kezdeti merevség) | MASTER-PROMPT-TERV 1.8 | `newtonRaphson.ts` → `NonlinearAlgorithm` |
| Adaptív teherlépcső (félig/duplázás) | MASTER-PROMPT-TERV 1.8 "Modern kiegészítések" | `loadStepper.ts` → `runLoadStepper()` |

**Tolerancia-politika:** az ALAPÉRTELMEZETT tolerancia `1e−4 %` (= `1e−6`
relatív), NEM a diplomaterv 0.5%-a — ld. [HIBATURESI-POLITIKA.md 5.
pont](../docs/HIBATURESI-POLITIKA.md#5-iterációs-hiba--a-nemlineáris-megoldó-leállása)
a teljes indoklással. A diplomaterv eredeti értéke (`HISTORICAL_TOLERANCE_PERCENT
= 0.5`) explicit paraméterként elérhető marad ("történelmi mód").

**Gauss-ponti állapot (`materialState.ts`):** minden elem 3 hajlítási
Gauss-pontján (`GAUSS_3`, ugyanaz a 3 pont, mint a `STRESS_POINTS`) tárol egy
anyagállapotot: `resultant` (P9, egyetlen M–κ rugó) vagy `layered` (P10,
rétegenkénti állapotok tömbje). A nyírás VÁLTOZATLANUL rugalmas marad
(`T = GAs·γ`, közvetlenül a teljes `γ`-ból számolva minden hívásnál — nincs
hozzá tárolt állapot, mert path-független).

**A REFORB (3.4.4) per-iterációs sémája:** az állapotfrissítés (`Δκ`) mindig
az ELŐZŐ ITERÁCIÓ κ-jához képesti növekményből számol (nem a lépés elejéhez
képest) — ez pontosan a diplomaterv 5. lépésének ("minden Gauss pontban
meghatározzuk...") a leírása. A `updateGaussPointState()` a P9/P10 zárt alakú
(nem R-faktoros iteratív) radial-return függvényeit hívja — az egyenértékűség
indoklása a `material/resultantPlastic.ts` és `material/elastoPlastic1D.ts`
fejlécében található.

**Az állapot-visszaállítás AUTOMATIKUS (nincs explicit bookkeeping):** a
`runNewtonRaphsonStep()` funkcionális — sosem módosítja a bemenetét, mindig
ÚJ `u`/állapot-térképet ad vissza. Egy nem konvergált próbálkozás után a
`loadStepper.ts` egyszerűen NEM fogadja el a visszaadott értékeket, ezért a
következő próbálkozás a VÁLTOZATLAN (utoljára konvergált) állapotból indul —
ez a MASTER-PROMPT-TERV 1.8 pontjának "a visszaállításnak TELJESNEK kell
lennie: minden Gauss-pont minden rétegének állapota" követelményét
konstrukció szerint, hiba nélkül teljesíti.

**Szinguláris `K_T` a határteher közelében:** a `runNewtonRaphsonStep()`
elkapja a `SingularMatrixError`-t, és EGYSZERŰ nem-konvergenciaként kezeli
(nem dobja tovább) — ez a MASTER-PROMPT-TERV 1.8 "FIGYELEM" pontjának
("a teher-vezérelt eljárás a határteher közelében DEFINÍCIÓ SZERINT
DIVERGÁL — ez fizikai eredmény, nem szoftverhiba") kódszintű megfelelője; a
`loadStepper.ts` ezt `'limit-load-reached'` státusszal jelzi.

**Dokumentált hatókör-korlátok (P11):** a nemlineáris megoldó jelenleg NEM
kezeli (a) a hőteher és a rugalmas-képlékeny anyagmodell együttesét (a κ0
eltolás a folyási feltételben külön levezetést igényelne), (b) a nemnulla
támaszmozgást rugalmas-képlékeny futásnál, (c) a `penalty`
peremfeltétel-stratégiát. Mindhárom explicit `NonlinearModelError`-t dob,
NEM hallgatja el (HIBATURESI-POLITIKA 7. pont elve) — ezek dokumentált,
jövőbeli kiterjesztési pontok, nem hiányzó ellenőrzések.

**Teszt:** `convergence.test.ts`, `materialState.test.ts`,
`loadStepper.test.ts` (rugalmas konzisztencia a `solveLinear`-lal, zárt alakú
konzol-határteher, Newton vs. módosított Newton, reziduum-monotonitás,
rétegelt szelvény, megszakíthatóság, hatókör-korlátok).

**Mutációs próba (P11):** `nonlinearElement.ts` → `elementInternalForceVector()`
— a hajlítási tag `gp.w` Gauss-súlyának szándékos kihagyása 5/6 tesztet
elbuktat (a belső erő — és ezáltal a reziduum-alapú konvergencia-kritérium —
helytelenné válik). Megjegyzendő: ugyanez a mutáció az
`elementTangentStiffness()`-ben (a K_T-ben) NEM buktat el tesztet — a Newton-
módszer a hibás Jacobi-mátrixtól még konvergál (csak lassabban/más úton), az
IGAZI hibát mindig a belső erő (a konvergencia-kritérium alapja) őrzi, nem a
tangens. Ez maga egy tanulság: a mutációs próbákat a KONVERGENCIA-KRITÉRIUMOT
tápláló kódra kell célozni, nem a segédmátrixra.

**Validáció (fem-validation, P11):** P-14 (teherlépcső-függetlenség: 2 vs.
20 kezdeti lépés ugyanoda konvergál), P-15 (Newton vs. módosított Newton:
azonos végállapot, eltérő K_T-újraépítési profil), P-16 (reziduum-
monotonitás egy képlékeny lépésen belül, teljes Newtonnál).

---

## 16. Képlékeny validációs suite — `fem-validation/src/cases/p03…p11-*.ts`

| Eset | Diplomaterv/mesterterv referencia | Módszertan |
|---|---|---|
| P-03 | Konzol, végponti P: `Pu=Mp/L` | statikailag határozott, 1 csukló a befogásnál |
| P-04 | Kéttámaszú, középen P: `Pu=4Mp/L` | statikailag határozott, 1 csukló a teher alatt |
| P-05 | Kéttámaszú, egyenletes q: `qu=8Mp/L²` | statikailag határozott, 1 csukló középen |
| P-06 | Kétoldalt befogott, egyenletes q: `qu=16Mp/L²` | statikailag határozatlan, 3 csuklós mechanizmus |
| P-07 | Kétoldalt befogott, középen P: `Pu=8Mp/L` | statikailag határozatlan, 3 csuklós mechanizmus |
| P-08 | Kétnyílású folytatólagos, mindkét mezőben q: `qu=(6+4√2)Mp/L²` | **szimmetria-modellezés** (ld. lent) |
| P-10 | Tehermentesítés → sajátfeszültségek: `∫σ dA=0`, `∫σ·z dA=0` | keresztmetszet-szintű (nem beam-FE), zárt alakú unload-lépés |
| P-11 | Beállás (shakedown): újraterhelés a korábbi M-ig, `Δε_p<1e-10` | keresztmetszet-szintű, közvetlenül folytatja P-10-et |

**A határteher meghatározása (P-03…P-08):** MASTER-PROMPT-TERV P12 prompt
"az utolsó konvergált teherlépcső" módszerét használja — a `runLoadStepper()`
a `minStepFraction`-ig felezi `Δλ`-t, mielőtt `'limit-load-reached'`-et
jelezne, ezért az utolsó elfogadott `λ·teher` tetszőlegesen közelít a valódi
határteherhez. A diszkretizációs hiba forrása: a befogáshoz/csuklóhoz
legközelebbi Gauss-pont SOSEM esik pontosan a kritikus keresztmetszetre (a
3 pontos Gauss-séma miatt) — ez a hiba `~1/n` ütemben csökken a
rétegszámmal/elemszámmal (numerikusan igazolva, ld. `p03` esetnél 16→32 elem
1.75%→0.86% hibacsökkenést ad), ezért a táblázat 2–3%-os tűrése bőséges
tartalékkal teljesül 32–64 eleműek hálón.

**P-08 — szimmetria-modellezés (kritikus felfedezés):** a kétnyílású,
szimmetrikus terhelésű folytatólagos gerenda TELJES (2 nyílásos) modellje a
Newton-iterációban NUMERIKUSAN erősen rosszul kondicionálttá vált, amint a
középső támasz KÉT oldalán, szimmetrikusan, EGYIDEJŰLEG kezdett folyni két
Gauss-pont (H'=0-nál mindkettő tangens-hozzájárulása egyszerre tűnik el egy
kis, néhány eleműnyi tartományban) — a teherlépcsőző jóval a zárt alakú
határteher ALATT (~q≈970, a zárt ~1370 helyett) `'limit-load-reached'`-et
jelzett, holott a fizikai szerkezetnek MÉG NEM kellett volna összeomlania
(a támasz-csukló önmagában csak 1×-esre csökkenti a határozatlanságot, nem
teszi mechanizmussá a szerkezetet). **A megoldás:** mivel a geometria ÉS a
teher mindkét mezőben PONTOSAN azonos, a középső támasz elfordulása
(`φ`) MINDEN terhelési szinten — rugalmasan ÉS képlékenyen is — PONTOSAN
nulla (szimmetria: a lehajlásgörbe páros, a szög — az első derivált —
páratlan, tehát a szimmetriatengelyben nulla). Ez azt jelenti, hogy a
középső támasz PONTOSAN egyenértékű egy `fixed()` befogással — a modell
ezért EGYETLEN mezőre (befogott-csuklós, "propped cantilever" elrendezésre)
redukálható, ami numerikusan jól kondicionált (nincs szimmetrikus,
egyidejű, kétoldali folyás egy csomópont körül) ÉS pontosan ugyanazt a zárt
alakú `qu=(6+4√2)·Mp/L²` eredményt adja (0.86%-os hibával, 64 elemen) —
ez EGYBEN annak is a magyarázata, hogy a diplomaterv és a klasszikus
képlékenységtan miért UGYANAZT a formulát adja a kétnyílású folytatólagos
gerendára és a befogott-csuklós (propped cantilever) tartóra: a kettő
szimmetrikus terhelés esetén MECHANIKAILAG EKVIVALENS.

**A képlékeny csuklók kialakulásának sorrendje (P-08, a mesterterv
kifejezett kérése):** a `caseP08()` a tehertörténetből TÉNYLEGESEN
megfigyeli (nem feltételezi) a sorrendet — a `firstNearYieldEvent()`
segédfüggvény a Gauss-ponti nyomaték `|M|≥0.99·Mp` küszöbét figyeli (NEM a
diszkrét `yielded` állapotjelzőt, mert az utolsó elfogadott teherlépcső a
`minStepFraction` szerinti felezés miatt sosem lép át PONTOSAN a folyási
határon — a nyomaték-küszöb robusztusabb "gyakorlatilag megfolyt" jelző). A
futás mindig azt mutatja, hogy a támasz-csukló ELŐBB alakul ki (a rugalmas
nyomaték ott nagyobb), majd a mezőn belüli csukló a befogástól ≈0.375L-re
(a propped-cantilever klasszikus eredménye) — ezt a sorrendet a kód egy
KÜLÖN ellenőrzésként (nem csak narratívaként) is igazolja.

**P-10/P-11 — keresztmetszet-szintű (nem teljes gerenda-FE) validáció:**
mivel a tehermentesítés `updateLayerPlasticState()`-ben MINDEN rétegnél
(a korábbi folyási állapottól függetlenül) a rugalmas `E` meredekséggel tér
vissza, a TELJES keresztmetszet tehermentesítési válasza EGZAKTUL LINEÁRIS
a teljes elasztikus `EI`-vel — ezért a nulla nyomatékhoz tartozó `Δκ` zárt
alakban, EGYETLEN lépésben számítható (`Δκ=−M₁/EI`), a teljes nemlineáris
beam-FE megoldó (`runLoadStepper`) nélkül. Ez a P10/P11 eseteket sokkal
egyszerűbbé és gyorsabbá teszi, mint egy full-beam szimulációt igényelne.

**Az R-faktor előjel-/tört-hibája (P10, a P-11 eset által felfedezve, ld.
[ADR-0007](ADR/0007-r-faktor-elojel-hiba.md)):** a P-11 (beállás) eset
kidolgozása közben kiderült, hogy `updateLayerPlasticState()` "még nem
folyt, átlépi a határt" ága a folyás ELŐTTI (`AB/AC`), nem a folyás UTÁNI
(`fTrial/Δσ`) hányadot számolta `R`-ként — ezt a P10 fázis eredeti,
KIZÁRÓLAG szimmetrikus (`AB=AC/2`) eseteket lefedő tesztjei NEM tudták
megkülönböztetni a helyes képlettől. A hibát a P-11 eset ASZIMMETRIKUS
(a próba-feszültség a lépés VÉGÉN éri el a — akkor még "még nem folyt"
állapotú — folyási határt) újraterhelési forgatókönyve fedte fel, mert
H'=0-nál a σ értéke R-től FÜGGETLEN (a fennsíkra vetül mindenképp), de az
`epsPEff` NEM — ez adta a "beállás" tétel (nincs új képlékeny alakváltozás)
0.0014-es (nem lebegőpontos zaj méretű) megsértését. Javítva, regressziós
teszttel ellátva (`elastoPlastic1D.test.ts`, aszimmetrikus `H'>0` eset).

---

## 17. Mutációs próbák jegyzéke (fázisonként legalább egy, DoD 2. pont)

| Fázis | Képlet | Teszt | Az elrontás módja és hatása |
|---|---|---|---|
| P3 | Nyírási tag Gauss-súlya (`elementStiffness`) | `element.test.ts` — tiszta nyírási energia | A súly elhagyása szelektív sémánál láthatatlan, teljes sémánál 1.5× hibát okoz |
| P4 | Winkler-ágyazat `K_ágy = ∫Nᵀ·c·N dx` (`foundationMatrix`) | `assembly.test.ts` — "K_ágy elemeinek összege zárt alakban c·L" | A `detJ` (Jacobi-transzformáció) kihagyása a mátrixösszeget felényire csökkenti egy 2 elemű hálón; a teszt elbukik |
| P5 | Megoszló teher/nyomaték al-intervallum Jacobi-tényezője (`reduceDistributed`) | `assembly.test.ts` — 4 property-teszt (eredő erő/nyomaték egyezése az integrállal) | A `xiHalf` (a `[-1,1]→[ξLo,ξHi]` átskálázás) kihagyása mind a 4 érintett tesztet elbuktatja |
| P5 | Hőteher ε0-korrekció `M = EI·(κ−κ0)` (`internalForces`) | `solver.test.ts` — "P5 — hőteher (V-07 jellegű...)" | A `−κ0` levonás kihagyása `M ≈ −2·EI·κ0`-t ad a helyes `M≡0` helyett |
| P6 | Lagrange-extrapoláció nevezője (`lagrangeAt`) | `extrapolation.test.ts` — 4 teszt (lineáris/másodfokú egzakt reprodukció) | `xii − xij` helyett `xii + xij` mind a 4 tesztet elbuktatja (végtelen/NaN eredmény) |
| P6 | Hibabecslő ugrás-szorzója (`estimateElementError`) | `errorEstimator.test.ts` — 2 teszt (zárt alakú ugrás-számítás) | A `2 ×` szorzó kihagyása a felére csökkenti a jelzett hibát a helyes érték helyett |
| P9 | Keményedési tag a visszavetítésben (`updateResultantPlasticState`) | `resultantPlastic.test.ts` — keményedő ág tesztje | A `dKappaP` nevezőjéből a `hPrime` kihagyása (`fTrial/ei`) a tesztet elbuktatja (`5000` a várt `4000` helyett) |
| P10 | Keményedési tag a rétegenkénti visszavetítésben (`updateLayerPlasticState` → `plasticStep`) | `elastoPlastic1D.test.ts` — keményedő ág tesztje | A `denom = e + hPrime` helyett `denom = e` a tesztet elbuktatja (`50000000` a várt `40000000` helyett) |
| P11 | Belső erővektor hajlítási tagjának Gauss-súlya (`elementInternalForceVector`) | `loadStepper.test.ts` — 5/6 teszt (rugalmas konzisztencia, határteher, Newton-összevetés, reziduum-monotonitás) | A `gp.w` kihagyása a hajlítási tagból a reziduum-alapú konvergencia-kritériumot hibássá teszi; a `K_T`-ben (`elementTangentStiffness`) UGYANEZ a mutáció NEM buktat el tesztet — a Newton-módszer hibás Jacobi-mátrixtól is konvergál, csak a belső erő hibája számít |
| P12 | R-faktor tört a rétegenkénti visszavetítésben (`updateLayerPlasticState`) — **VALÓDI hiba, nem szintetikus mutáció** | P-11 fem-validation eset ("beállás") + `elastoPlastic1D.test.ts` új aszimmetrikus `H'>0` regressziós teszt | `AB/AC` (a folyás ELŐTTI hányad) szerepelt `R` gyanánt a folyás UTÁNI hányad (`fTrial/Δσ`) helyett — a P10 eredeti, kizárólag szimmetrikus eseteket lefedő tesztjei ezt NEM buktatták el; a P-11 aszimmetrikus forgatókönyve igen (`epsPEff` hamis, 0.0014-es növekedést mutatott a várt 0 helyett). Ld. [ADR-0007](ADR/0007-r-faktor-elojel-hiba.md) |
| P17 | Visszahelyettesítés iránya (`solveFrontal`) — **VALÓDI hiba, első implementációnál** | `frontal.test.ts` — mechanizmus-eset (`pinned('N0')` egyetlen görgős/csuklós támasszal) | A pivot-tűrés kezdetben ABSZOLÚT (`1e-9`) volt, nem a mátrix skálájához (`diagScale`) VISZONYÍTOTT relatív tűrés — ~1e8 nagyságrendű merevségi együtthatók mellett egy ~1e-4-es (ténylegesen szinguláris irányból eredő) pivot simán átcsúszott a küszöbön, és a hiba csak SOKKAL később, felnagyítva (~1e9-es álelmozdulásként) jelentkezett ahelyett, hogy `SingularMatrixError`-t dobott volna. Javítva: a `SkylineMatrix.factorize()`-zal azonos elvű, az eredeti átló legnagyobb eleméhez viszonyított relatív tűrés (`SINGULAR_REL_TOL = 1e-12`) |
| — | Fiber-réteg szélesség (`generateLayers`) — **VALÓDI hiba, felhasználó (külső felülvizsgálat) jelentette** | `layeredSection.test.ts` — "I-szelvénynél, ha egy réteg ÁTNYÚLIK a gerinc/öv határon" (nem illeszkedő rétegszám) | A csík szélessége (`b`) KÖZÉPPONTI mintavétellel adódott — töréspontos kontúrnál (I-szelvény gerinc/öv átmenete) ez durván túlbecsül, ha a csík átnyúlik a törésponton (IPE300, 16 réteg: terület +39-44%, inercia +46-52%, MÉRVE, nem elméletben). Javítva: terület-megőrző almintavételezés (`SUBSAMPLES=200`, ld. [ADR-0014](ADR/0014-fiber-reteg-szelesseg-hiba.md)) — a hiba 0,07%-ra (terület) / 4,6%-ra (inercia) csökkent. Mutációs próba: `SUBSAMPLES=1`-re visszaállítva a teszt 44,3%-os hibát mér és elbukik |

Minden mutációs próba **kézzel elvégzett**, egyszeri ellenőrzés volt fejlesztés
közben (a forráskód szándékosan elrontva, a teszt elbukása megfigyelve, majd a
forrás visszaállítva) — nem automatizált mutation-testing eszköz (Stryker stb.)
futtatja folyamatosan. A jegyzék a próba megismételhetőségét dokumentálja.

---

## 18. „Történelmi mód" — frontális megoldó — `solver/frontal.ts`

| Képlet/algoritmus | Diplomaterv referencia | Kód |
|---|---|---|
| Elem- (NEM csomópont-) sorszámozás vezérli a számítás időigényét; az együtthatómátrix előállítása és az egyenletrendszer megoldása NEM válik szét | 3.1.7.3, **44. oldal** | `solveFrontal()` — az `elements.forEach` ciklusban egy elem beépítése (`ke`-blokk hozzáadása a "front"-hoz) és az utolsó hivatkozás utáni azonnali kiküszöbölés EGYETLEN lépésben történik |
| Egy csomópont akkor küszöbölhető ki, ha nincs hozzá kapcsolódó, nagyobb sorszámú rúd | 3.1.7.3, **44. oldal** | `computeLastElementForDof()` — minden szabad DOF-hoz megkeresi az őt érintő LEGNAGYOBB elemsorszámot; a DOF csak AKKOR küszöbölődik ki, amikor az elemfeldolgozás elér eddig |
| Változó méretű "front", Gauss-elimináció: `a'ᵢⱼ = aᵢⱼ − aᵢₖ·aₖⱼ/aₖₖ` | 3.1.7.3, **44. oldal** | `eliminate()` — a pivot sor/oszlop `splice`-szal kikerül a "front"-ból, a fennmaradó elemek a fenti formula szerint módosulnak |
| Visszahelyettesítés FORDÍTOTT kiküszöbölési sorrendben (egy DOF egyenlete csak vele egyidőben vagy nála később kiküszöbölt DOF-okra hivatkozik) | 3.1.7.3 (levezetve — a diplomaterv nem részletezi explicit módon, de az algoritmus szerkezetéből következik) | `solveFrontal()` végén az `eliminationLog` VISSZAFELÉ bejárása |

**Cél és korlátok (P17, MASTER-PROMPT-TERV):** ez a modul NEM a produkciós
megoldó — az a Skyline-LDLᵀ (`linalg/skyline.ts`, [ADR-0002](ADR/0002-skyline-vs-frontalis.md)).
A frontális megoldó KIZÁRÓLAG hitelesség és didaktika céljából létezik: az
1996-os eredeti algoritmust mutatja be, ugyanarra a `K·v=q` rendszerre, csak
más eliminációs sorrenddel (a front szélessége az ELEM-sorszámozástól függ,
nem a Cuthill–McKee-szerű csomópont-sorszámozástól, amit a Skyline profilja
kihasznál). Az elfogadási kritérium (`frontal.test.ts`, 8 teszt, köztük egy
kéttámaszú/megoszló-teher, egy rugós támaszú, egy önsúly-teheres és egy
finomabb hálós eset): a két megoldó eredménye 1e−10 relatív pontossággal
egyezik. A `FrontalResult.steps` tömb (elemenkénti front-szélesség
belépés/kilépés előtt-után) és a `skylineMeanBandwidth` mező a P17 UI
"front kialakulása és mozgása" animációjához és a Skyline-profillal való
összevetéshez készült.
