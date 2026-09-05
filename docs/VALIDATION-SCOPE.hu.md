# Validáció és hatókör

*[In English](VALIDATION-SCOPE.md)*

> **E dokumentum célja.** Egyenes, kalibrált válasz arra a kérdésre, amit egy
> bíráló mérnök vagy tudományos kolléga ténylegesen fel fog tenni:
> *"Helyes-e az alapul szolgáló matematika/mechanika, és ezt honnan tudjuk?"*
> Világosan leírja, mi lett ellenőrizve, hogyan, és mi NEM — hogy senkinek ne
> kelljen hitre alapoznia a helyesség állítását, és senkit ne érjen később
> meglepetésként egy olyan korlát, amit előre is lehetett volna jelezni.

---

## 1. A rövid válasz

A mechanikai/matematikai mag **forrásra visszavezetett, független
forrásokkal keresztellenőrzött, és zárt alakú megoldásokkal gépi
pontosságú egyezéssel validált** — nem "úgy tűnik, működik", hanem konkrét,
ellenőrizhető bizonyítéklánc. Az alábbi szakaszok ez a bizonyíték-lánc, plusz
egy explicit lista arról, amit ez a projekt **nem** állít.

## 2. 1. módszer — soronkénti visszavezethetőség a forrás-diplomatervre

Minden implementált képlet vissza van vezetve az eredeti 1996-os BME-
diplomaterv (`Diplomaterv (BME).pdf`) pontos oldalára és egyenletszámára a
[`docs/THEORY.md`](THEORY.md)-ben — a PDF szövegéből kinyerve, egyenletenként
ellenőrizve, nem "az általános elmélet emlékezetből implementálva" alapon.
Egy bíráló megnyithatja a `THEORY.md`-t, és bármely kódrészlethez megtalálja
a pontos diplomaterv-egyenletet, amit megvalósít, vagy megtalálja azt az
ADR-t, ami egy tudatos, dokumentált eltérést rögzít tőle (ld. 6. pont).

## 3. 2. módszer — explicit hibataxonómia, nem egyetlen közös tűrés

A [`docs/HIBATURESI-POLITIKA.md`](HIBATURESI-POLITIKA.md) pontosan azt a
megkülönböztetést teszi meg, amit egy numerikus módszerekben jártas bíráló
elvár, és amit egyetlen "pontosság: 0,3%" állítás nem tudna megadni:

| Hibafajta | Elvárt szint | Példa |
|---|---|---|
| Konstrukció szerint egzakt azonosságok (alakfüggvény-partíció, merevségi mátrix szimmetriája, merevtest-mozgás) | gépi pontosság (1e-12…1e-14) | sosem lazítva "elég jó"-ra |
| Két független algoritmus ugyanarra a mennyiségre (Skyline-LDLᵀ vs. sűrű Gauss, frontális megoldó vs. Skyline) | 1e-9…1e-10 relatív | egyezés, nem közelítés |
| Egyenletrendszer-megoldás (reziduum, globális egyensúly ΣFz/ΣMy) | 1e-10 relatív | elvileg egzakt |
| Diszkretizációs hiba (háló, rétegszám, teherlépcső) | **nem egy szám — egy konvergencia-rend**, log–log meredekségen mérve | sosem egyetlen "szoftver-pontosság" számként közölve |
| Iterációs leállási kritérium | 1e-6 relatív (1e-4%), a diplomaterv saját 0,5%-a explicit, opcionális "történelmi mód"-ként megtartva | nyíltan közölve, nem csendben szigorítva/lazítva |
| Modellezési döntések (nyírási tényező, rétegzés felbontása, elsőrendű elmélet) | ez EGYÁLTALÁN NEM numerikus hiba — döntésként közölve (6. pont) | sosem összemosva egy hibával |

A politika kifejezetten megtiltja a tűrés emelését azért, hogy egy teszt
átmenjen, és megtiltja egyetlen hálón mért eredmény közlését konvergencia-
vizsgálat nélkül.

## 4. 3. módszer — zárt alakú validációs csomag, e dokumentum megírása előtt lefuttatva és leellenőrizve

29 eset, 195 egyedi ellenőrzés, frissen generálva a tényleges tesztkészletből
(`pnpm --filter @femati/fem-validation test` → [`docs/VALIDATION.md`](VALIDATION.md),
automatikusan generált, sosem kézzel szerkesztett). Reprezentatív eredmények,
közvetlenül ebből a futásból:

| Eset | Referencia (zárt alak) | Számított | Relatív hiba |
|---|---|---|---|
| V-01 Konzol végponti lehajlása | −9,5980952×10⁻⁴ m | −9,5980952×10⁻⁴ m | 8,4×10⁻¹⁴ |
| V-03 Tiszta hajlítás patch-teszt, görbület | 8,9286×10⁻⁵ 1/m | 8,9286×10⁻⁵ 1/m | ~1×10⁻¹³ |
| V-04 Nyírási záródás, `selective` séma, L/h akár 10 000-ig | 0 (nincs záródás) | max 9,2×10⁻⁹ | gépi pontosságon marad a karcsúságtól függetlenül |
| V-04 Nyírási záródás, `full` séma (szándékosan NEM záródás-mentes) | — | a hiba ~12–20%-os platón marad, nem tűnik el | ez maga a záródás-jelenség szándékos bemutatása |

13 lineáris eset (V-01…V-13: konzol, kéttámaszú, patch-teszt, záródás,
merevtest-mozgás, szimmetria, hőteher ×2, támaszsüllyedés, önsúly-
ekvivalencia, penalty vs. elimináció, h-konvergencia, befogott-csuklós
tartó) és 16 képlékeny eset (P-01…P-16: alaki tényezők, határteher
statikailag határozott és határozatlan vázakra, rétegelt M–κ görbe,
sajátfeszültségek, beállás, keményedés, rétegszám-konvergencia,
teherlépcső-függetlenség, Newton vs. módosított Newton) — mindegyik jelenleg
zöld.

## 5. 4. módszer — mutációs tesztelés (szándékos elrontás, hogy bizonyítsuk: a teszt tényleg elkapja)

Minden fejlesztési fázishoz legalább egy képlet-tagot szándékosan elrontottak
a forráskódban (pl. a nyírási Gauss-súly elhagyása, a hőteher κ₀-korrekciójának
elhagyása, a keményedési tag elhagyása a képlékeny visszavetítésben, egy
előjel megfordítása a Lagrange-extrapoláció nevezőjében), megerősítve, hogy a
tesztkészlet elbukik, majd a kódot visszaállították. Ez bizonyítja, hogy a
tesztek a KÉPLETET őrzik, nem csak azt, hogy "a kód lefut". A teljes,
megismételhető lista a `THEORY.md` 17. pontjában található.

## 6. Valódi hibák a fejlesztés során — közölve, nem elrejtve

Az a validációs folyamat, ami sosem talál semmit, egy olyan folyamat, ami
nem elég alaposan keres. Három konkrét, valódi hiba került elő és javításra,
mindegyikhez utólag regressziós teszttel:

- **Az R-faktor képlet fel volt cserélve** a rétegelt képlékeny
  visszavetítésben (a folyás ELŐTTI hányad, `AB/AC`, szerepelt ott, ahova a
  folyás UTÁNI hányad, `(AC−AB)/AC`, tartozott volna). Egy ASZIMMETRIKUS
  beállási (shakedown) teszteset találta meg — amit az eredeti, kizárólag
  szimmetrikus eseteket lefedő tesztkészlet szerkezetileg sem tudott volna
  elkapni. Ld. [ADR-0007](ADR/0007-r-faktor-elojel-hiba.md).
- **A frontális megoldó pivot-tűrése abszolút volt, nem a mátrix
  skálájához viszonyított relatív** — ~1e8 nagyságrendű merevségi
  együtthatóknál egy valódi szinguláris pivot átcsúszott a küszöbön, és
  csak jóval később, felnagyítva (~1e9-es nagyságrendű álelmozdulásként)
  jelentkezett, ahelyett hogy tiszta hibát dobott volna. Egy mechanizmus-
  esetre célzott mutációs teszt találta meg. Ld. `THEORY.md` 17. pont.
- **A rétegelt keresztmetszet-modell KÖZÉPPONTI mintavétellel** adta a
  rétegszélességet, ami I-szelvénynél, a gerinc/öv törésponton átnyúló
  rétegnél, ~40%-kal túlbecsülte a területet és ~46-52%-kal az inerciát.
  Egy **külső felülvizsgálat** találta meg egy levezetés-dokumentumban,
  méréssel megerősítve, terület-megőrző almintavételezéssel javítva,
  0,07%/4,6%-os maradék hibára csökkentve, és egy — a korábban vak foltot
  kifejezetten lefedő — regressziós teszttel lezárva. Ld.
  [ADR-0014](ADR/0014-fiber-reteg-szelesseg-hiba.md).

Ugyanannak a levezetés-dokumentumnak két további külső kritikáját teljes
körűen kivizsgálták, és NEM bizonyultak hibának (az egyik állítás
szerkezetileg lehetetlen volt az azt számoló kód alapján; a másik kettő
olyan számokat hasonlított össze, amiknek sosem kellett volna egyezniük —
egy rugalmas referenciaérték egy ténylegesen képlékeny, más teherszintű
futással szemben). Ezek a vizsgálatok, a lezáró indoklással együtt, nyilvánosan
elérhetők a projekt saját változásnaplójában (`STATUS_REPORT.md`, 11., 12.,
15. pont).

## 7. Keresztellenőrizve a diplomatervtől független forrásokkal is

- A Timoshenko-elem levezetése (alakfüggvények, B-mátrix, gyenge alak,
  a nyírási záródás elleni védekezés) egyezik a MathWorks Symbolic Math
  Toolbox saját, független Timoshenko-gerendaelem-levezetésével — ez a
  keresztellenőrzés hozta felszínre azt is, hogy egy korábban dokumentált,
  de sosem elkészült teszt (V-04, záródás) hiányzott; ez azóta megírva és
  hozzáadva.
- Egy befogott-csuklós, egyenletesen terhelt esetet összevetettünk Ahmed,
  A. M. & Rifai, A. M. (2021), *"Euler-Bernoulli and Timoshenko Beam
  Theories: Analytical and Numerical Comprehensive Revision,"* European
  Journal of Engineering and Technology Research, 6(7), 20–32 —
  a projekt saját erőmódszeres levezetését a cikk publikált táblázatával
  szemben ellenőriztük, és 4 tizedesjegyig egyezett.
- A nyírási korrekciós tényező (κs) hivatkozása javítva lett: a téglalap-
  keresztmetszetre vonatkozó 5/6-os konstans NEM Cowper saját eredménye —
  Cowper, G. R. (1966), *"The Shear Coefficient in Timoshenko's Beam
  Theory,"* Journal of Applied Mechanics, 33(2), 335–340, egy a
  Poisson-tényezőtől FÜGGŐ formulát vezet le, ami csak ν=0-nál egyszerűsödik
  5/6-ra. A projekt jelenleg Cowper tényleges formuláját valósítja meg
  téglalap, kör és vékonyfalú cső keresztmetszetekre, a helyes hivatkozással.

## 8. Amit ez a projekt kifejezetten NEM állít

- **Nincs hivatalos, jogosultsággal alátámasztott szakmai lektorálás.** A
  6. pontban említett külső kritikák informális, ismeretlen forrásból
  érkezett, be nem jelentett vélemények voltak, amiket a szerző AI-
  segítséggel vizsgált ki — nem egy jogosult tervezőmérnök aláírása, nem
  folyóirat-szintű peer review, nem egy NAFEMS-stílusú kereskedelmi
  benchmark-csomag.
- **Hű az 1996-os diplomatervhez, nem minden állandó lett önállóan,
  első elvekből újra levezetve.** A Timoshenko-gerendaelem alapelmélete
  (alakfüggvények, B-mátrix, merevségi integrál) független forrásokkal
  keresztellenőrzött (7. pont); a diplomaterv-specifikus táblázatértékek
  (pl. az alaki tényező-táblázat) nem.
- **A nyírás a képlékeny modellben MINDIG rugalmasnak tekintett** — nincs
  csatolt hajlítás–nyírás (M-V) folyási feltétel. Ez a diplomaterv saját
  (3.52) egyszerűsítése, hűen megtartva, nem ennek a megvalósításnak a
  rövidítése.
- **A Cowper-féle nyírási tényező I- és U-szelvénynél egy egyszerűsített
  "csak a gerinc veszi fel a nyírást" közelítést használ**, nem Cowper
  saját (bonyolultabb) I-szelvény formuláját.
- **Elsőrendű elmélet.** A másodrendű (P-Δ) kiterjesztés a lineáris
  merevség egy alapszintű kiegészítése, nem teljes stabilitás-/
  kihajlásvizsgálat.
- **Nincs formális, NAFEMS-stílusú benchmark-csomag**, amilyet egy
  kereskedelmi FEM-szoftvergyártó futtatna.
- **A tesztlefedettségi célszám (a mag csomagra ≥90%) nincs újramérve**
  a P16 teljesítmény-profilozási fázis óta.
- A fentiek MINDEGYIKE explicit ki van mondva a kódban és a
  `docs/THEORY.md`-ben/az ADR-naplóban — egyik sem rejtett hiányosság;
  a forráskód figyelmes olvasója mindegyiket megtalálja jelölve, pontosan
  ott, ahol érvényes.

## 9. Kapcsolódó dokumentumok

- [`THEORY.md`](THEORY.md) — képlet ↔ kód ↔ diplomaterv-oldalszám/egyenletszám leképezés (18 szakasz)
- [`HIBATURESI-POLITIKA.md`](HIBATURESI-POLITIKA.md) — a teljes hibatűrési politika (a fenti 3. pont ennek összefoglalója)
- [`VALIDATION.md`](VALIDATION.md) — a generált validációs jegyzőkönyv (újragenerálható: `pnpm --filter @femati/fem-validation test`)
- [`ADR/`](ADR/) — 22 architektúra-döntési feljegyzés, köztük minden valódi megtalált hiba (0007, 0014) és minden tudatos eltérés a diplomatervtől
- [`STATUS_REPORT.md`](../STATUS_REPORT.md) (repó gyökere) — a teljes fejlesztési napló, a három külső felülvizsgálati vizsgálat teljes részletességgel

*Ez a dokumentum 2026-09-05-én készült, a fenti fájlok akkori állapotára
hivatkozva. Ha a kód változik, futtasd újra a validációs csomagot, mielőtt
az itt idézett konkrét számokra hagyatkozol — a pass/fail-állapotnak és a
módszertannak kell stabilnak maradnia, nem egyetlen konkrét hibaértéknek.*
