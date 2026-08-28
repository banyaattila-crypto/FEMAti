# CONVENTIONS — a `fem-core` rögzített mérnöki és kódolási konvenciói

**Státusz:** a P0–P6 fázisok alapján, utólag pótolva. **Ez a mag konvenciója SOHA nem
változik** — a felület kapcsolhat megjelenítési (pl. nyomatéki ábra oldala) konvenciót,
de a mag belső előjel- és sorrend-szerződése rögzített, és mindenhol teszt őrzi.

> A táblázatok "Teszt" oszlopa a `packages/fem-core/test/` alatti fájlokra mutat —
> ha egy konvenció megsértődik, ott kell (és ott is fog) elbukni egy teszt.

---

## 1. Szabadságfok-sorrend

Csomópontonként **2 szabadságfok**, rögzített sorrendben: **`[w, φ]`**.

Globális index: a `d`-edik csomópont szabadságfokai `2·d` (w) és `2·d + 1` (φ).

Egy elem (3 csomópontos, kvadratikus) 6 szabadságfoka:

```
u = [w₁, φ₁, w₂, φ₂, w₃, φ₃]ᵀ
```

- Kód: [`element/bMatrix.ts`](../packages/fem-core/src/element/bMatrix.ts) (`DOF_PER_ELEMENT = 6`),
  [`assembly/dofMap.ts`](../packages/fem-core/src/assembly/dofMap.ts) (`DOF_PER_NODE`, globális index).
- Teszt: `assembly.test.ts` → `elementDofs a rögzített [w,φ,w,φ,w,φ] sorrendet adja`.

---

## 2. Előjel-konvenció

- **z lefelé pozitív** (a diplomaterv építőmérnöki hagyománya szerint).
- **Nyírási torzulás:** `γ = φ − dw/dx` (Diplomaterv (3.1), 33. oldal).
- **Görbület:** `κ = dφ/dx`.
- A `K` merevségi mátrix **invariáns** a γ sor előjelválasztására (a sor kétszer
  szerepel a `BᵀDB` szorzatban), de a belőle számított **nyíróerő `T` előjele NEM**
  — ezért ezt a konvenciót egyszer, itt rögzítjük, és a `bMatrix.ts` fejléce is
  erre a fájlra hivatkozik vissza.
- **Nyomatéki ábra:** a mag mindig `M = EI·κ` előjellel számol; a "húzott oldalra
  rajzolás" (magyar mérnöki konvenció) KIZÁRÓLAG felületi megjelenítési döntés
  (P8), a magban nincs jelen.
- **Hőteher (P5):** `κ0 = α·(t_alsó − t_felső)/h`. A pozitív `dT = T − Tref`
  a rúdelem FELMELEGEDÉSÉT jelenti (Diplomaterv 3.1.6.4, 42. oldal). A
  tehervektor előjele `+∫Bᵀ·D·ε0 dx` — ez a diplomaterv EREDETI (3.19)
  képletét követi, és ELTÉR a MASTER-PROMPT-TERV 1.4 pontjának (hibás,
  negatív előjelű) átírásától. Ld. [ADR-0006](ADR/0006-hoteher-elojel.md).
- **`kappa`/`gamma` vs. `M`/`T` (P5):** a `GaussPointResult.kappa`/`.gamma`
  mindig a TELJES geometriai alakváltozás (`ε = B·uₑ`, eeltekintve ε0-tól);
  az `M`/`T` viszont a MECHANIKAI (feszültséget okozó) alakváltozásból számol:
  `M = EI·(κ−κ0)`, `T = GAs·γ` (a modellben `γ0` mindig 0). Ez azt jelenti,
  hogy statikailag határozott szerkezetnél tiszta hőteherre `κ` NEM nulla
  (ez a szabad hőgörbület), de `M` igen.

- Kód: [`element/bMatrix.ts`](../packages/fem-core/src/element/bMatrix.ts),
  [`element/timoshenko3.ts`](../packages/fem-core/src/element/timoshenko3.ts) (`internalForces`),
  [`assembly/loadVector.ts`](../packages/fem-core/src/assembly/loadVector.ts) (`elementKappa0`, `reduceThermal`).
- Teszt: `element.test.ts` → a tiszta nyírási/hajlítási energia tesztek (ld. THEORY.md 3. pont);
  `solver.test.ts` → „P5 — hőteher (V-07 jellegű...)”.

---

## 3. Egységek

A mag **kizárólag SI-alapú belső egységekben** számol:

| Mennyiség | Belső (mag) egység | Felhasználói (`.femati.json`, UI) egység |
|---|---|---|
| Hossz | m | m |
| Terület | m² | cm² |
| Másodrendű nyomaték | m⁴ | cm⁴ |
| Erő | kN | kN |
| Nyomaték | kNm | kNm |
| Megoszló erő | kN/m | kN/m |
| Megoszló nyomaték | kNm/m | kNm/m |
| Rugalmassági/nyírási modulus | kN/m² | kN/cm² |
| Szög | rad | rad |
| Hőmérséklet | °C | °C |
| Sűrűség | kg/m³ | kg/m³ |
| Fajsúly | kN/m³ | kN/m³ |
| Hőtágulási együttható | 1/°C | 1/°C |
| Eltolódás (megjelenítés) | m | mm |

Az átváltás **kizárólag** a [`units/convert.ts`](../packages/fem-core/src/units/convert.ts)
modulban történik (Diplomaterv 3.1.8, 3. táblázat, 48. oldal). Vegyes egységű
aritmetika a magban tilos — ezt a márkázott (branded) típusok (`units/brands.ts`)
fordítási időben kizárják.

- Teszt: `units.test.ts` — property-teszt: az oda-vissza konverzió veszteségmentes.

---

## 4. Integrálási sémák

- **Gauss–Legendre kvadratúra** a `[−1, 1]` paraméteres tartományon (Diplomaterv
  (3.16)–(3.21), 39–40. oldal, 1. táblázat).
- A hajlítási tag **mindig 3 pontos**.
- A nyírási tag:
  - `selective` (alapértelmezett): **2 pontos** — megszünteti a záródást (shear locking).
  - `full`: **3 pontos** — didaktikai/összehasonlító célra, a locking bemutatására.
- Kód: [`element/quadrature.ts`](../packages/fem-core/src/element/quadrature.ts),
  [`element/timoshenko3.ts`](../packages/fem-core/src/element/timoshenko3.ts).
- Teszt: `element.test.ts` → a V-04 locking-teszt (a hiba `full` sémánál nő L/h-val,
  `selective`-nél nem).

---

## 5. Peremfeltétel-stratégiák

Két, egyenrangú stratégia (Diplomaterv 3.1.7.3, 44. oldal):

| Stratégia | Leírás | Alapértelmezett |
|---|---|---|
| `elimination` | A megkötött DOF-ok kimaradnak az egyenletrendszerből; támaszmozgásnál a hozzájárulás a jobboldalra kerül. | igen |
| `penalty` | Minden DOF aktív; a megkötést egy nagy rugóállandó (`DEFAULT_PENALTY = 1e10` kN/m) érvényesíti. | — |

A két stratégiának **azonos elmozdulást** kell adnia (1e−6 relatív tűréssel — a
penalty rosszabbul kondicionált, ezért nem gépi pontosság).

- Kód: [`assembly/assembler.ts`](../packages/fem-core/src/assembly/assembler.ts).
- Teszt: `solver.test.ts` → V-11 (`Penalty vs. elimináció`).

---

## 6. Reakcióerő-formula

Minden támasztípusra (merev, penalty, rugós, rugalmas ágyazat) **egységes** képlet:

```
reakció[d] = elemek_belső_ereje[d] − külső_teher[d]
```

A levezetés és a numerikus igazolás a
[`solver/linearSolver.ts`](../packages/fem-core/src/solver/linearSolver.ts) fájl
`internalElementForces` / reakció-számítás részének fejléc-kommentjében található.

**Relatív egyensúly-mérték abszolút padlóval (P5):** a `checkEquilibrium()`
relatív hibája (`|ΣFz|/skála`) hamis, ~100%-os hibát jelezne, ha a skála maga
is a lebegőpontos zaj szintjén van (pl. TISZTA hőteher — nincs valódi külső
erő, minden reakció ~1e−12). Ezért a nevező csak akkor "valódi" (a relatív
mérték csak akkor érvényes), ha `skála > SELF_CHECK_TOLERANCE.equilibrium`;
alatta a mérték az ABSZOLÚT reziduumra esik vissza (ami ilyenkor önmagában is
elhanyagolható).

- Teszt: `solver.test.ts` — minden V-eset globális egyensúly-ellenőrzése
  (`result.equilibrium.satisfied === true`, < 1e−9 relatív); a padló-eset:
  „P5 — hőteher (V-07 jellegű...)”.

---

## 7. Hibakezelés

- `DimensionError` — méret-/hivatkozási inkonzisztencia (pl. ismeretlen csomópont).
- `DegenerateElementError` — elfajult elem (`|J| ≤ 0`).
- `SingularMatrixError` — szinguláris (mechanizmus) szerkezet; **soha nem `NaN`**.
- `InvalidModelError` — a modell nem futtatható (a `validateModel` hibát talált);
  a validáció **mindig a megoldó előtt** fut (ld. `model/validate.ts` fejléce:
  "egy statikai programban a néma hibás eredmény rosszabb, mint a futás megtagadása").

Kód: [`linalg/errors.ts`](../packages/fem-core/src/linalg/errors.ts).

---

## 8. Gauss-ponti vs. csomóponti igénybevétel (P6)

Az `ElementResult.gaussPoints[].m`/`.t` a NYERS, Gauss-pontban számított
érték (nincs extrapolálva, nincs átlagolva — elemenként legfeljebb 2 érték
van egy adott csomópontra, ha két elem osztozik rajta).

A `NodeResult.m`/`.t` ezzel szemben a CSOMÓPONTRA EXTRAPOLÁLT és elemhatáron
ÁTLAGOLT érték (Diplomaterv 3.1.7.4, 46. oldal) — ez a diagramrajzoláshoz
(P8) használandó "sima" mező, NEM azonos a legközelebbi Gauss-pont értékével.

Az `ElementResult.errorEstimate` [%] az átlagolás ELŐTTI ugrás mértéke — minél
nagyobb, annál inkább érdemes az adott elem környékén sűríteni a hálót.
MODERN kiegészítés, a diplomatervben nincs megfelelője.

- Kód: [`post/extrapolation.ts`](../packages/fem-core/src/post/extrapolation.ts),
  [`post/errorEstimator.ts`](../packages/fem-core/src/post/errorEstimator.ts).
- Teszt: `extrapolation.test.ts`, `errorEstimator.test.ts`.

---

## 8/A. Rugalmas–képlékeny állapotváltozó-konvenció (P9)

- A folyáshoz tartozó belső állapot mezőneve **`kappaPEff`** (felhalmozott,
  mindig `≥0`, effektív képlékeny görbület `[1/m]`) — ezt a nevet a rétegelt
  modell (P10) is köteles átvenni a rétegenkénti állapotára, hogy a két modell
  API-ja egységes maradjon.
- A `yielded: boolean` mező mindig az UTOLSÓ lépésre vonatkozik (igaz, ha a
  keresztmetszet a folyási felületen van AZ ADOTT lépés végén) — nem a teljes
  terhelési történetre. A `kappaPEff > 0` viszont a teljes történetre nézve
  jelzi, hogy volt-e valaha folyás.
- Az állapotfrissítés (`updateResultantPlasticState`) mindig egy PRÓBA-lépéssel
  (`trial`) kezdődik, majd — csak ha szükséges — zárt alakú visszavetítéssel
  (radial return) zárul; ez a mintázat a rétegelt modellnél (P10, R-faktoros
  visszavetítés) is megmarad, csak ott rétegenként fut.
- Kód: [`material/resultantPlastic.ts`](../packages/fem-core/src/material/resultantPlastic.ts).
- Teszt: `resultantPlastic.test.ts`.

---

## 8/B. Rétegelt (fiber) modell konvenciói (P10)

- A `LayerPlasticState` mezőnevei TUDATOSAN tükrözik a nem-rétegelt
  (`ResultantPlasticState`, ld. [8/A. pont](#8a-rugalmas–képlékeny-állapotváltozó-konvenció-p9))
  modell nevezéktanát: `epsPEff` (~`kappaPEff`), `yielded` — csak a mennyiség
  szintje más (feszültség–alakváltozás rétegenként, nem nyomaték–görbület a
  teljes keresztmetszetre).
- A `generateLayers()` mindig a szelvény SÚLYPONTJÁTÓL méri a rétegek `z`
  koordinátáját, lefelé pozitívan (ld. CONVENTIONS.md §2) — ez konzisztens a
  már meglévő `Layer.z` dokumentációjával (`model/types.ts`).
- A rétegek mindig EGYENLŐ vastagságúak és a szelvény TELJES magasságát
  fedik le, hézag- és átfedésmentesen (ezt a `validate.ts` `checkLayers()`
  is ellenőrzi) — a kontúr-változás (pl. I-szelvény gerinc/öv-átmenete)
  NEM kap külön, finomabb réteget; a felbontás egyenletes, a pontosság a
  rétegszámmal nő (ld. THEORY.md 14. pont, rétegszám-konvergencia).
- Az `updateLayerPlasticState()` MINDIG egyetlen, tetszőlegesen NAGY
  alakváltozás-növekményre ad zárt alakú, egzakt eredményt, ha az adott
  hívás a folyási felületet legfeljebb EGYSZER lépi át (monoton terhelés a
  hívás alatt) — ezt használja ki a P-09 validációs eset, amely a virgin
  állapotból egyetlen lépéssel számol nagy görbületeket.
- Kód: [`material/layeredSection.ts`](../packages/fem-core/src/material/layeredSection.ts),
  [`material/elastoPlastic1D.ts`](../packages/fem-core/src/material/elastoPlastic1D.ts).
- Teszt: `layeredSection.test.ts`, `elastoPlastic1D.test.ts`.

---

## 8/C. Nemlineáris megoldó konvenciói (P11)

- **Funkcionális állapotkezelés:** `runNewtonRaphsonStep()` és a belőle hívott
  segédfüggvények SOSEM módosítják a bemeneti `u`/`states` értéket — mindig
  ÚJ objektumot/tömböt adnak vissza. Ez teszi lehetővé, hogy a `loadStepper.ts`
  egy elvetett (nem konvergált) próbálkozás után egyszerűen ELDOBJA a
  visszaadott értéket, és a KÖVETKEZŐ próbálkozás a változatlan, korábban
  konvergált állapotból induljon — a "teljes visszaállítás" bookkeeping
  nélkül, konstrukció szerint garantált.
- **Iterációnkénti (nem lépésenkénti) állapotfrissítés:** a Gauss-pontok
  anyagállapota MINDEN Newton-iterációban frissül (az előző ITERÁCIÓ κ-jához
  képesti `Δκ`-val), nem csak lépésenként — ez pontosan a diplomaterv REFORB
  (3.4.4) algoritmusának sémája.
- **Tolerancia mindig SZÁZALÉKBAN** (`tolerancePercent`), a diplomaterv (3.4.2.1/6)
  képletének megfelelően — NEM relatív törtként —, hogy a kód és a
  dokumentáció (HIBATURESI-POLITIKA.md 5. pont) egyező mértékegységet
  használjon.
- **A `NonlinearModelError` explicit hatókör-jelzésre való, NEM általános
  hibakezelésre**: a P11 jelenlegi hatóköréből kieső eseteket (hőteher +
  képlékenység, nemnulla támaszmozgás + képlékenység, `penalty` stratégia)
  ez a hibatípus jelzi — sosem hallgatjuk el (ld. `model/validate.ts`
  fejléce: "egy statikai programban a néma hibás eredmény rosszabb, mint a
  futás megtagadása", ugyanaz az elv itt is érvényes).
- **A `SingularMatrixError` a határteher közelében VÁRHATÓ, nem hiba**: a
  `runNewtonRaphsonStep()` ezt egyszerű nem-konvergenciaként kezeli (nem
  dobja tovább) — a `loadStepper.ts` szintjén ez vezet a
  `'limit-load-reached'` státuszhoz.
- Kód: [`solver/newtonRaphson.ts`](../packages/fem-core/src/solver/newtonRaphson.ts),
  [`solver/loadStepper.ts`](../packages/fem-core/src/solver/loadStepper.ts),
  [`solver/convergence.ts`](../packages/fem-core/src/solver/convergence.ts),
  [`solver/materialState.ts`](../packages/fem-core/src/solver/materialState.ts).
- Teszt: `convergence.test.ts`, `materialState.test.ts`, `loadStepper.test.ts`.

---

## 9. Kódolási szabályok (ESLint, `eslint.config.js`)

- Tilos: `any`, non-null assertion (`!`), `console.log` a `fem-core`-ban.
- A `fem-core` nem hivatkozhat DOM-globálokra (`window`, `document`, `navigator`).
- `noUncheckedIndexedAccess` bekapcsolva (ld. [ADR-0001](ADR/0001-nouncheckedindexedaccess.md))
  — indexelt hozzáférés mindig `T | undefined`; a tesztekben ezért a `mustGet()`
  segédfüggvényt kell használni (`test/helpers/assert.ts`) `!` helyett.
- Minden új mechanikai képlethez tartozik teszt, és **legalább egy fázisonként**
  mutációs próbával igazolva (a képletet szándékosan elrontva a tesztnek el
  kell buknia) — a próbák helye a THEORY.md-ben van felsorolva.
