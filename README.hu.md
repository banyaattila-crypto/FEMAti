# FEM@ti

*[Read this in English](README.md)*

**Rugalmas–képlékeny Timoshenko-gerenda végeselemes analízis** — modern,
TypeScript alapú, validált végeselemes program.

---

## Mi ez?

1996-ban egy BME diplomaterv keretében készült egy rugalmas–képlékeny
Timoshenko-gerenda végeselemes program: 3-csomópontos, kvadratikus
gerendaelemekkel, szelektív redukált integrálással (a nyírási záródás
ellen), frontális egyenletmegoldóval, és réteges (fiber) keresztmetszeti
modellel a képlékeny alakváltozás nyomon követésére.

A FEMAti ugyanezt a szerkezetmechanikai modellt valósítja meg újra,
harminc évvel később, egy modern böngészőben futó, interaktív felülettel —
de nem "ihletet merít" a diplomatervből, hanem **soronként megfelelteti**
minden implementált képletet a diplomaterv adott oldalszámának és
egyenletszámának (ld. [`docs/THEORY.md`](docs/THEORY.md)), és minden
mechanikai állítást validációs teszttel bizonyít, zárt alakú vagy
kézzel-számolt referenciaértékek ellen (ld. [`docs/VALIDATION.md`](docs/VALIDATION.md)).

Ahol a mai szoftver-mérnöki gyakorlat és az 1996-os megoldás eltér (pl. a
frontális egyenletmegoldó helyett skyline-tárolás a produkciós útvonalon),
azt egy külön architektúra-döntési feljegyzés (ADR) rögzíti — beleértve
magát az EREDETI, frontális algoritmust is, ami a felület "Történelmi
mód" nézetében animálva, didaktikus célból elérhető marad (ld.
[ADR-0002](docs/ADR/0002-skyline-vs-frontalis.md)).

### Miért érdemes megnézni?

- **Interaktív modellvászon**: kattintással/húzással szerkeszthető
  gerenda-modell (támaszok, koncentrált/megoszló terhek), élő
  újraszámolással minden módosításnál.
- **Lineáris ÉS nemlineáris (rugalmas–képlékeny) analízis**: Newton–Raphson
  megoldó, adaptív teherlépcsőzéssel, REFORB feszültség-visszavetítéssel,
  teherlépcső-idővonallal és képlékeny zóna-megjelenítéssel.
- **Teljes, ellenőrizhető levezetés** minden lépésre — Gauss-pontonkénti
  alakfüggvény/Jacobi/B-mátrix/merevségi mátrix számokkal, réteges
  képlékeny visszavetítéssel, Word (.docx) és nyomtatható PDF exporttal.
- **Számítási jegyzőkönyv** és **"Történelmi mód"** (az eredeti 1996-os
  frontális algoritmus animált bemutatása, összevetve a mai skyline
  megoldóval).
- **~660 automatizált teszt**, ezen belül egy 10 000-elemes fuzz-teszt
  (`fast-check`), amely véletlen szerkezeteken bizonyítja, hogy a megoldó
  sosem dob kezeletlen kivételt, és mindig egyensúlyban lévő eredményt ad.

---

## Futtatás

Előfeltétel: **Node.js ≥ 20**, **pnpm 10** (a repó `packageManager` mezője
rögzíti a pontos verziót — `corepack enable` után automatikusan a
megfelelő pnpm-et használja).

```bash
pnpm install
pnpm --filter @femati/ui dev
```

Ez elindítja a fejlesztői szervert (Vite) — a böngészőben a kiírt
`http://localhost:5173` címen érhető el.

### Ellenőrzés (típusellenőrzés + lint + teszt, minden csomagra)

```bash
pnpm check
```

### Éles build

```bash
pnpm build
```

---

## Monorepo-szerkezet

pnpm workspace, 4 csomag:

| Csomag | Tartalom |
|---|---|
| [`packages/fem-core`](packages/fem-core) | A tényleges végeselemes mag: modell, elemek, megoldók (skyline-LDLᵀ és a történelmi frontális), anyagmodellek, validáció, utófeldolgozás — **nincs DOM-függősége**, önmagában is használható. |
| [`packages/fem-db`](packages/fem-db) | Anyag- és szelvénykatalógus, forrás-megjelöléssel (minden rekordon kötelező `source`/`verified` mező). |
| [`packages/fem-validation`](packages/fem-validation) | A `docs/VALIDATION.md`-t GENERÁLÓ validációs esetek (zárt alakú/kézi referenciák ellen). |
| [`packages/ui`](packages/ui) | React + Vite alapú, kliens-oldali felület — a számítás a böngészőben fut, nincs backend. |

## Dokumentáció

| Dokumentum | Tartalom |
|---|---|
| [`docs/THEORY.md`](docs/THEORY.md) | Minden implementált képlet: kód helye ÉS diplomaterv-oldalszám. |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) | Rögzített mérnöki/kódolási konvenciók (előjelek, DOF-sorrend, egységek). |
| [`docs/VALIDATION.md`](docs/VALIDATION.md) | Generált validációs jegyzőkönyv. |
| [`docs/HIBATURESI-POLITIKA.md`](docs/HIBATURESI-POLITIKA.md) | A hibakezelési/kockázati politika (K1–K8). |
| [`docs/ADR/`](docs/ADR) | Architektúra-döntési feljegyzések. |
| [`MASTER-PROMPT-TERV.md`](MASTER-PROMPT-TERV.md) | A projekt teljes, fázisokra bontott terve. |
| [`STATUS_REPORT.md`](STATUS_REPORT.md) | Fázisonkénti, folyamatosan frissülő állapotjelentés. |

A felület "Elméletek" menüje ugyanezeket a tartalmakat közvetlenül az
alkalmazásban, KaTeX-szel szedett képletekkel is elérhetővé teszi.

---

*A projekt a `Diplomaterv (BME).pdf` (73 oldal) teljes átolvasása alapján
készült — minden mechanikai formula ellenőrzött forrásból származik, egy
sem lett kitalálva.*
