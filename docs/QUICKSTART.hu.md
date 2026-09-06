# FEM@ti — Gyors kezdés

*[In English](QUICKSTART.md)*

Ez egy rövid, célzott bevezető — nem teljes referencia-kézikönyv. Azt
mutatja meg, hogyan viszel végig egy legegyszerűbb tervezési feladatot a
munkaasztalon: modell felvétele → teher → eredmény-értelmezés →
szelvény-javaslat. A mélyebb dokumentumokra (mechanikai levezetés,
validáció, korlátok) minden szakasz végén mutatunk linket.

---

## 1. A munkaasztal

Indításkor egy előre beállított statikai vázzal nyit a program (bal panel:
**Szerkezet**, **Geometria**, **Szelvény · anyag**, **Háló**). A középső
vászon a gerendát és az aktív igénybevételi ábrát (M/T/w/φ) mutatja, a
jobb panel az **Eredmények** kártyát.

![A munkaasztal áttekintése — modellfa, teher, M-diagram, eredmények](img/quickstart-overview.jpg)

- **Szerkezet** legördülő: kész statikai váz-sablonok (egyszerű
  kéttámaszú, konzol, folytatólagos stb.) — ez adja a támaszokat és egy
  alap terhet.
- **Geometria**: fesztáv (csúszka vagy pontos szám beírásával).
- **Szelvény · anyag**: katalógusból választható keresztmetszet (I, U,
  RHS, kör, cső, téglalap, T) és anyag (acél/beton), teljes műszaki
  adatlappal (kattints a névre).
- **Háló**: végeselemszám — a legtöbb gyakorlati esetben az alapérték jó.

## 2. Teher hozzáadása

A bal felső "Terhek" fülön négy teherfajta közül választhatsz:
**Pontteher**, **Nyomatékteher**, **Megoszló teher**, **Megoszló
nyomaték**. Kattints a kívánt ikonra, majd a vásznon a gerenda mentén oda,
ahol a teher hasson — a teher azonnal megjelenik, és a diagramok/
eredmények újraszámolódnak.

![Új pontteher felvétele a vásznon — az M-diagram és a reakciók azonnal frissülnek](img/quickstart-load.jpg)

A felvett teher a bal panel "Terhek" listájában is megjelenik, ahol a
pontos érték (pozíció, nagyság) beírható, és a **G**/**Q** jelölés mutatja
a kategóriát (állandó/változó — ez számít a teherkombinációnál, ld. 3.
lépés).

## 3. Eredmények értelmezése

A jobb panel **Eredmények** kártyája a *jellemző* (nem faktorozott)
terhelésre mutatja a fő mennyiségeket (w max, φ max, M max, T max, EI,
GAs). Ez a "mit írtam be" válasz — tervezéshez a lejjebb található
**Határteher-ellenőrzés** kártya a mérvadó, mert ez már a valódi
tervezési (ULS/SLS) teherkombinációra fut:

![Határteher-ellenőrzés kártya — M-V kihasználtság, verdikt, vezető teher](img/quickstart-checks.jpg)

- **M-V kihasználtság (EN 1993-1-1)** — a hajlítás-nyírás kölcsönhatásból
  számolt kihasználtsági % és zöld/piros verdikt.
- **lehajlás-ellenőrzés (SLS, L/250)** — külön, a nem faktorozott (G+Q)
  kombinációra.
- **M max (mértékadó ULS-kombináció)** és **vezető teher (ULS)** — ha 2+
  egyidejű változó teher van a modellen, itt látod, melyik terhet vette a
  program "vezetőnek" (EN 1990 6.10, ψ₀=0,7) a mértékadó eredményhez.

A kihasználtsági %-ok mögötti pontos képletekért és a "mit NEM állítunk"
listáért ld. [`docs/VALIDATION-SCOPE.md`](VALIDATION-SCOPE.hu.md).

## 4. Szelvény-optimalizálás

Ha a fenti ellenőrzés piros ("túllépi a határt"), a bal panel
**"Legkisebb megfelelő szelvény keresése"** gombja végigfuttatja az
aktuális katalógus-családon (azonos típusú szelvényeken) belüli, területre
rendezett listát, és felajánlja az első megfelelőt:

![Szelvény-javaslat — a program a katalógusból ajánl egy nagyobb, megfelelő szelvényt](img/quickstart-optimize.jpg)

Az **Alkalmaz** gombbal egy kattintással át lehet állni a javasolt
szelvényre. Fontos: csak a szelvényt cseréli — anyagot, fesztávot,
terheket, vasalást nem, és a vasbeton vasalás mennyisége is fix marad
minden jelölt szelvénynél (ld. a gomb melletti figyelmeztető szöveget).

## 5. Ha többre van szükséged

- **Nemlineáris (rugalmas-képlékeny) futtatás** — a felső **SZÁMÍTÁS**
  gomb (vagy F5) a teljes teherlépcsős, képlékeny-csuklós elemzést futtatja
  végig, réteges keresztmetszeti modellel; a "kihasználtság"/"burkolóábra"
  fülek és a keresztmetszet-inspektor ide tartoznak.
- **Teljes levezetés és jegyzőkönyv** — minden Gauss-pontra, réteges
  visszavetítésre kiterjedő, szerkeszthető Word (.docx) és nyomtatható PDF
  export.
- **"Elméletek" menü / Súgó** — ugyanaz a mechanikai levezetés, KaTeX-szel
  szedve, közvetlenül az alkalmazásban, oldal- és képlethivatkozással az
  eredeti diplomatervhez ([`docs/THEORY.md`](THEORY.md)).
- **Mit NEM állítunk** — [`docs/VALIDATION-SCOPE.md`](VALIDATION-SCOPE.hu.md)
  őszintén felsorolja a modellezési egyszerűsítéseket és a validáció
  hatókörét.

---

*A képernyőképek egy kétnyílású folytatólagos gerenda (IPE 300, S235,
q=30 kN/m + P=20 kN pontteher) éles futtatásából származnak.*
