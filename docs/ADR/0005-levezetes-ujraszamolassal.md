# ADR-0005 — A levezetés újraszámolással készül, nem nyomvonal-rögzítéssel

**Dátum:** 2026-08-20 · **Státusz:** elfogadva · **Érinti:** P3, P4, P5, P9, P10, P11, P15

## Kontextus

Követelmény: legyen egy menüpont, amely az adott feladat **teljes levezetését és
számítását** bemutatja, és `.docx` + `.pdf` formátumban kimenthető, hogy a
számítás később ellenőrizhető legyen.

Az elfogadott mélység: a mérnöki statikai számítás **és** egy kiválasztott
végeselem teljes VEM-levezetése — alakfüggvények a Gauss-pontokban, Jacobi,
B mátrix, a 6×6 Kₑ mátrix számokkal kitöltve, teherredukció, és egy választott
Gauss-pont rétegenkénti feszültségszámítása.

Két megvalósítási út létezik:

**(a) Nyomvonal-rögzítés (trace).** A mag minden számítási lépése opcionálisan
bejegyzést ír egy gyűjtőbe. Előny: pontosan azt rögzíti, ami történt. Hátrány:
minden függvény szignatúrája megváltozik, a hot path elágazásokkal telik meg, és
egy nemlineáris futás több százezer bejegyzést termel, amiből úgyis szűrni kell.

**(b) Újraszámolás.** A levezetés-modul a mag **publikus, finom szemcsézetű**
függvényeit hívja lépésenként a kiválasztott elemre, és maga jegyzi fel a
köztes értékeket.

## Döntés

**A (b) utat választjuk: a levezetés újraszámolással készül.**

A mag érintetlen marad; a `derivation` modul kívülről, lépésenként hívja a
meglévő függvényeket.

## A döntés következménye a P3-ra és a további fázisokra

A mag részlépéseinek **külön hívhatónak** kell lenniük. Konkrétan a P3-tól
kezdve kötelező, hogy az alábbiak önállóan, egymástól függetlenül meghívhatók
legyenek, és tiszta (mellékhatásmentes) függvények legyenek:

| Lépés | Elvárt publikus felület |
|---|---|
| Alakfüggvények | `shapeFunctions(xi) → { N, dN }` |
| Jacobi | `jacobian(element, nodes, xi) → { J, detJ, invJ }` |
| B mátrix | `bMatrix(element, nodes, xi) → DenseMatrix` |
| Anyagmátrix | `constitutiveMatrix(section, material) → DenseMatrix` |
| Elemi merevség | `elementStiffness(...) → DenseMatrix` |
| Kvadratúra | `gaussRule(n) → { xi, w }[]` |
| Teherredukció | `elementLoadVector(...) → Float64Array` |
| Rétegfeszültség | `layerStress(state, dKappa, ...) → LayerState` |

Ez amúgy is jó API-tervezés: ezek a függvények külön-külön tesztelhetők
(a P3 elfogadási kritériuma pontosan ezt kéri).

## Kötelező garancia: a levezetés és a solver ugyanazt a számot adja

**A legnagyobb kockázat ennél az útnál**, hogy a levezetés más eredményt mutat,
mint amit a megoldó ténylegesen használt. Egy statikai programban ez a lehető
legrosszabb kimenetel: az ellenőrzésre szánt dokumentum hazudik.

Ezért kötelező teszt (a P15 elfogadási kritériuma):

> A levezetés-modul által kiszámított Kₑ mátrix, tehervektor és
> Gauss-ponti feszültség **bit-azonos** a solver által használt értékekkel,
> ugyanarra a modellre és ugyanarra az elemre.

Bit-azonos, nem „1e−12-n belül": ugyanazt a függvényt hívja ugyanazokkal az
argumentumokkal, tehát az eredménynek azonosnak kell lennie. Ha eltérés van, az
azt jelenti, hogy a solver más úton számol — és azt ki kell deríteni.

## Képletek megjelenítése

A képletek **strukturált szövegként** jelennek meg (monospace, Unicode
matematikai jelekkel), nem képként:

- a `.docx`-ben szerkeszthető és kereshető marad;
- nincs felbontásprobléma nyomtatáskor;
- a mérnöki gyakorlatban (MathCAD-lap) ez a bevett forma.

A HTML/PDF nézetben KaTeX-szel szedett képlet is megengedett, de a `.docx`-be
a szöveges forma kerül.

## Formátum

- **`.docx`**: valódi OOXML a `docx` npm könyvtárral. Word-ben szerkeszthető,
  stílusokkal és táblázatokkal.
- **`.pdf`**: a nyomtatási nézetből (`@media print`), a böngésző
  nyomtatómotorjával — így a PDF és a képernyőn látott tartalom garantáltan
  azonos.
