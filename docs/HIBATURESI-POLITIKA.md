# FEMAti — HIBATŰRÉSI POLITIKA

**Státusz:** kötelező minden fázisra, visszamenőleg is · **Verzió:** 1.0 — 2026-08-21

---

## Az alapelv

**A végeselem-módszerben a hibának fajtái vannak, és ezeket soha nem szabad összekeverni.**

Egyetlen közös „elfogadható hiba" megadása szakmailag hibás lenne: a lebegőpontos
kerekítés, a diszkretizáció és az iterációs leállás egymástól független
jelenségek, eltérő nagyságrenddel és eltérő kezeléssel.

A vezérszabály:

> **Ahol az eredmény elvileg egzakt, ott mérnöki tűrés nem létezik — gépi
> pontosság jár. Ahol a hiba a modell természetéből fakad, ott nem egy szám a
> követelmény, hanem a hiba rendjének és csökkenésének kimutatása.**

Ha egy elvileg egzakt azonosság csak 1e−6-ra teljesül, az **nem „elég jó"** —
az egy fel nem fedezett kódhiba jele.

---

## 1. Kerekítési hiba — elvileg egzakt azonosságok

Ide azok az összefüggések tartoznak, amelyek a matematikai szerkezetből
következnek, függetlenül a modelltől és a hálótól.

| Azonosság | Elvárt szint | Miért egzakt |
|---|---|---|
| Alakfüggvény-partíció ΣNᵢ(ξ) = 1 | **1e−14** | Polinomazonosság |
| Kronecker-tulajdonság Nᵢ(ξⱼ) = δᵢⱼ | **1e−14** | Definíció |
| Kₑ szimmetriája | **1e−14** relatív | A ∫BᵀDB szerkezetéből |
| Merevtest-mozgás: Kₑ·u = 0 | **1e−13** relatív | Nincs alakváltozás → nincs energia |
| Patch test: konstans görbület | **1e−12** | Az elem ezt egzaktul ábrázolja |
| Jacobi: J⁻¹·J = 1 | **1e−14** | Definíció |
| Merevségi mátrix rangja | **egzakt egész** | Diszkrét mennyiség, tűrés nélkül |
| Kvadratúra-súlyok összege = 2 | **1e−14** | Definíció |
| Gauss-szabály polinomrendje | **1e−13** | A szabály konstrukciója |

**Következmény:** a `toBeCloseTo(..., 3)` típusú laza összevetés ezekben az
esetekben tiltott. Ha egy ilyen teszt csak lazábban megy át, a kódot kell
megkeresni, nem a tűrést emelni.

---

## 2. Algoritmikus konzisztencia — két független út egyezése

Amikor ugyanazt a mennyiséget két, egymástól független algoritmus adja ki, az
eltérés csak a kerekítés halmozódásából származhat.

| Összevetés | Elvárt szint |
|---|---|
| Skyline LDLᵀ vs sűrű Gauss-elimináció | **1e−10** relatív |
| Elimináció vs penalty-módszer | **1e−9** relatív |
| Frontális megoldó vs skyline (P17) | **1e−10** relatív |
| Levezetés-modul vs solver (P15/A) | **bit-azonos** |
| Kvadratúra vs sűrű numerikus integrál | a referencia saját hibájáig |

A bit-azonosság nem túlzás: ha ugyanazt a függvényt hívjuk ugyanazokkal az
argumentumokkal, az eredménynek azonosnak kell lennie. Bármilyen eltérés azt
jelenti, hogy nem ugyanazt a kódot futtatjuk.

---

## 3. Megoldási hiba — az egyenletrendszer megoldása

| Mérőszám | Elvárt szint |
|---|---|
| Reziduum ‖A·x − b‖ / ‖b‖ | **1e−10** |
| Globális egyensúly ΣFz, ΣMy | **1e−10** relatív a teherre |
| Reakciók összege vs külső teher | **1e−10** relatív |

A globális egyensúly elvileg egzakt: a végeselem-megoldás egyensúlyban van a
csomópontokra redukált teherrel. Ha nem, az a kompilálás vagy a
peremfeltétel-kezelés hibája.

**Rosszul kondicionált eset:** ha a merevségi mátrix kondíciószáma nagy
(pl. penalty-módszer 1e10-es rugóval), a reziduum-korlát a kondíciószámmal
arányosan romlik. Ilyenkor a korlátot a kondíciószámhoz kell igazítani, és ezt
a tesztben ki kell mondani — nem csendben lazítani.

---

## 4. Diszkretizációs hiba — itt nem szám a követelmény

Ez a hiba **nem kódhiba**: a véges elemszámból, véges rétegszámból és véges
teherlépcsőből fakad. Csökkenteni lehet, megszüntetni nem.

**A követelmény nem abszolút tűrés, hanem a konvergencia rendjének igazolása.**

| Jelenség | Elvárt viselkedés | Ellenőrzés |
|---|---|---|
| h-konvergencia (hálófinomítás) | az elmozdulás hibája ~ h^(p+1) | log–log meredekség mérése |
| Rétegzés (fiber-modell) | a hiba **pontosan 1/n²** (középpont-szabály) | a hiba negyedelődik n duplázásakor |
| Gauss-pontok száma | a polinomrend szerint egzakt, felette rendben csökken | zárt integrálokkal |
| Teherlépcső (Δλ) | az út-független eredmény felé tart | Δλ felezése < 1% változás |

**Amit soha nem szabad:** egyetlen hálón mért eltérést „a szoftver pontossága"
néven közölni. A diszkretizációs hiba csak konvergencia-vizsgálattal
értelmezhető.

**A gyakorlati elfogadási kritérium:** a hálófinomítás hatása essen a modellezési
bizonytalanság alá. Egy statikai feladatnál a terhek és az anyagjellemzők
bizonytalansága jellemzően több százalék, ezért a diszkretizációs hibát ez alá
kell vinni — de a *rendet* akkor is igazolni kell, mert az bizonyítja, hogy a
formuláció helyes, nem csak véletlenül jó egy adott hálón.

---

## 5. Iterációs hiba — a nemlineáris megoldó leállása

A diplomaterv (3.4.2.1/6) konvergencia-mérőszáma:

```
100 · √(Σψᵢ²) / √(Σfᵢ²)  ≤  Tolerancia [%]
```

**Az 1996-os toleranciaszint gépidő-korlát volt, nem elvi határ.** Egy 0.5%-os
reziduum-tűrés mai gépen indokolatlanul laza: a maradó kiegyensúlyozatlan erő
a teher fél százaléka, ami képlékeny feladatnál a képlékeny csuklók helyét is
elmozdíthatja.

| Beállítás | Érték |
|---|---|
| **Alapértelmezett tolerancia** | **1e−6** relatív (= 1e−4 %) |
| Megengedett tartomány | 1e−8 … 1e−2 % |
| A diplomaterv eredeti értéke | 0.5 % — külön kapcsolóval, „történelmi mód" |
| Kiegészítő feltétel | az elmozdulás-növekmény normája is csökkenjen |

A megoldónak **a konvergencia rendjét is naplóznia kell**: teljes Newton–Raphson
mellett a reziduum kvadratikusan csökken. Ha csak lineárisan, az a tangenciális
merevségi mátrix hibájára utal — ez erősebb diagnosztika, mint maga a
küszöbérték.

**Megvalósítva (P11):** a fenti táblázat pontosan a
[`solver/convergence.ts`](../packages/fem-core/src/solver/convergence.ts)
konstansaival egyezik (`DEFAULT_TOLERANCE_PERCENT`, `HISTORICAL_TOLERANCE_PERCENT`,
`MIN_TOLERANCE_PERCENT`, `MAX_TOLERANCE_PERCENT`); az iterációnkénti napló
(`NewtonIterationLog`) a `solver/newtonRaphson.ts`-ben. Ld. docs/THEORY.md
15. pont a teljes leképezéshez.

---

## 6. Modellezési hiba — a mag hatókörén kívül

Az elsőrendű elmélet, a kis elmozdulások feltétele, a nyírási alaktényező
megválasztása, a rétegzés felbontása, a képlékeny anyagmodell egyszerűsítései —
ezek **modelldöntések**, nem numerikus hibák.

A szoftver felelőssége itt annyi, hogy **a döntéseket láthatóvá tegye**: a
felület és a jegyzőkönyv írja ki, milyen feltevésekkel élt a számítás
(elsőrendű elmélet, κs értéke, rétegszám, anyagmodell, integrálási séma).

---

## 7. Amit ez a politika megtilt

1. **Tűrés emelése azért, hogy egy teszt átmenjen.** Ha egy elvileg egzakt
   azonosság nem teljesül gépi pontossággal, a kódot kell javítani.
2. **Hibafajták összemosása.** A „szoftver pontossága 0.3%" típusú állítás
   értelmetlen, mert nem mondja meg, melyik hibafajtáról van szó.
3. **Abszolút hiba használata relatív helyett.** Minden összevetés relatív,
   a megfelelő normában.
4. **Egyetlen hálón mért eredmény konvergencia-vizsgálat nélkül.**
5. **Az iterációs tolerancia laza beállítása** kényelemből.
6. **Elrejtett hiba.** Ha egy vizsgálat nem fut le (pl. nincs analitikus
   megoldás), azt ki kell írni — nem hallgatólagosan kihagyni.

---

## 8. Alkalmazás a már elkészült fázisokra

| Fázis | Felülvizsgálat |
|---|---|
| P2 (linalg) | Megfelel: LDLᵀ vs Gauss 1e−10, kézi referencia 1e−12 |
| P3 (elem) | Megfelel: partíció/Kronecker 1e−14, merevtest 1e−13, patch test 1e−12 |
| P3 (keresztmetszet) | **Javítandó:** a „3 ezrelékes" hivatkozások cseréje a hibafajta szerinti korlátra |
| P4-től | E dokumentum táblázatai a kötelező tűrések |

A `permille()` segédfüggvény megmarad a tesztekben, de **mérőszámként**, nem
elfogadási küszöbként: azt mutatja, mekkora a diszkretizációs hiba, miközben az
elfogadás a konvergencia rendjén alapul.
