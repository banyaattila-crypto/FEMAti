# ADR-0020 — T-szelvény: aszimmetrikus keresztmetszet-támogatás

**Dátum:** 2026-08-30 · **Státusz:** ELFOGADVA ÉS MEGVALÓSÍTVA — T-szelvény
bekötve a teljes maglánc mentén (parametrikus ÉS rétegelt út). Szögvas (L)
TUDATOSAN KIZÁRVA, ld. lent. · **Érinti:** `fem-core` (`model/types.ts`,
`section/properties.ts`, `material/layeredSection.ts`, `model/builder.ts`,
`model/validate.ts`, `model/schema.ts`)

## Kontextus

A "professzionalizálási ütemterv" C) fázisa: a `fem-core` rétegelt
keresztmetszeti modell (`material/layeredSection.ts` `generateLayers()`/
`contourWidth()`, `section/properties.ts` `geometricProperties()`) eddig
minden alakot (`rect`/`circle`/`tube`/`i-profile`/`rhs`) a félmagasságra
SZIMMETRIKUSNAK tételezett fel — a súlypont mindig `h/2`-nél volt, egyetlen
`yMax` írta le mindkét szélső szálat. A T-szelvény ezt megtöri: a súlypont
NEM a félmagasságon van.

## Döntés — szögvas (L) KIZÁRVA a hatókörből

A tervezés elején nyitott kérdés volt, hogy a szögvas (L) is bekerüljön-e.
**Döntés: NEM** — ez nem munkamennyiség kérdése, hanem **elvi korlát**:

- A FEMAti egytengelyű (síkbeli) Timoshenko-gerenda modell — a hajlítás
  mindig egyetlen, előre rögzített (a modellben implicit "vízszintes")
  tengely körül történik.
- A T-szelvénynek VAN egy szimmetriatengelye (a függőleges), ami miatt a
  vízszintes tengely a MÁSIK valódi főtengely — a T-szelvény tehát TISZTÁN
  illeszkedik az egytengelyű modellbe, csak a súlypont-számítást kellett
  általánosítani.
- A szögvasnak NINCS vízszintes/függőleges főtengelye — a főtengelyei el
  vannak forgatva. Egy L-szelvény "hajlítása" a geometriai vízszintes
  tengely körül valójában csatolt kéttengelyű hajlítás + csavarás lenne.
  Ezt a jelenlegi modellbe erőltetni azt jelentené, hogy a szoftver
  HAMIS mechanikai állítást tenne a keresztmetszet viselkedéséről — ez
  összeegyeztethetetlen a projekt "radikális átláthatóság" elvével
  (minden egyszerűsítés dokumentált ÉS VALÓS közelítés, nem hazugság).
- Ez NEM egy "később hozzáadható" korlát, hanem a jelenlegi 1D-síkbeli
  architektúra alapvető határa — L csak egy jövőbeli, kéttengelyű
  hajlítást bevezető nagy architekturális bővítéssel (saját ADR-t
  igényelne) kerülhetne be.

## Matematikai levezetés — ellenőrizve zárt alak + független numerikus integrálás

T-szelvény: `{h, b, tw, tf}` — öv (szélesség `b`, vastagság `tf`) FELÜL,
gerinc (vastagság `tw`, magasság `h−tf`) lelóg alóla. `y` a tetejétől mérve:

```
Af = b·tf, Aw = tw·(h−tf), A = Af+Aw
ȳ = (Af·tf/2 + Aw·(tf+(h−tf)/2)) / A          (súlypont a tetőtől — NEM h/2!)
yTop = ȳ,  yBottom = h − ȳ
I = [b·tf³/12 + Af·(tf/2−ȳ)²] + [tw·(h−tf)³/12 + Aw·(tf+(h−tf)/2−ȳ)²]   (Steiner)
```

Képlékeny modulus — az EGYENLŐ TERÜLETŰ tengely (`y_pna`, NEM a súlypont)
körül, `Wpl = ∫|y−y_pna| dA` zárt alakú kiértékelése, esetszétválasztással
aszerint, hogy `y_pna` az övbe vagy a gerincbe esik (ld. a kód
kommentjeit, `section/properties.ts` `'t-profile'` ág).

**Ellenőrzés:** kézi példa (b=100, tf=20, h=200, tw=10 mm) zárt alakban:
`A=38 cm², ȳ=5.737 cm, I=1440.04 cm⁴, y_pna=1.9 cm, Wpl=181.9 cm³` —
200 000 pontos numerikus integrálással FÜGGETLENÜL újraszámolva
**minden tizedesjegyig egyezik**.

## Kockázatcsökkentő tervezési döntés — `yMax = max(yTop, yBottom)`

A `GeometricProperties` interfész az EDDIGI kötelező `yMax`/`elasticModulus`
mezőket **változatlanul megtartja** — T-szelvénynél `yMax = max(yTop,
yBottom)` (a KORMÁNYZÓ, nagyobb — tehát konzervatívabb, kisebb rugalmas
modulust adó — szál). Ez azt jelenti, hogy **egyetlen meglévő fogyasztó
kódot sem kellett módosítani** (`solver/linearSolver.ts` `me`/`mp`,
`panels/RightPanel.tsx` megjelenítés) — a T-szelvény "csak" egy új,
önmagában konzisztens `SectionShape`-ágként illeszkedik be, a downstream
automatikusan helyesen, a biztonság felé kerekítve működik. Az új `yTop`/
`yBottom` OPCIONÁLIS mezőkkel bővül az interfész (csak t-profile tölti ki),
kizárólag tájékoztató célra (UI-ban megjelenítve).

## Megvalósítás

- `model/types.ts`: `SectionShape` új `'t-profile'` tagja; `GeometricProperties`
  bővül `yTop?`/`yBottom?`-tal.
- `section/properties.ts`: `geometricProperties()` és `recommendedShearFactor()`
  új ága (utóbbi ugyanaz a "gerinc viszi a nyírást" közelítés, mint
  `i-profile`/`rhs`-nél — NEM Cowper-formula, dokumentáltan).
- `material/layeredSection.ts`: ÚJ `centroidTopOffset(shape)` — minden
  szimmetrikus alaknál `height/2`-t ad (BIZONYÍTHATÓAN változatlan
  viselkedés a C) fázis előtti kódhoz képest), t-profile-nál a fenti `ȳ`-t.
  `generateLayers()` ettől indul (nem `-height/2`-től). `contourWidth()`/
  `plateThicknessAt()` (E) fázis mezője) új ága a `z`→`y` (súlyponttól→
  tetőtől) átváltással.
- `model/builder.ts`: `tProfile(h,b,tw,tf)` factory.
- `model/validate.ts` + `model/schema.ts` (.femati.json perzisztencia):
  teljes lefedettség az új kindra.
- UI: `ui/model/compile.ts`/`nonlinear.ts` `toShape()`, `fem-db`
  `SectionKind += 't'` + 3 katalógus-bejegyzés, `catalog/DatabaseView.tsx`
  (méretek, képlet, ÚJ yTop/yBottom sorok aszimmetrikus szelvényeknél),
  `components/SectionShapeDiagram.tsx` (öv felül + gerinc alatta rajz-ág,
  ÉS a szaggatott "semleges tengely" vonal a VALÓS súlypontnál, nem
  automatikusan a fél magasságon — ez a felületi rajz saját, a fem-core-
  tól független, de ugyanazzal a képlettel számoló súlypont-számítása,
  mert a komponens csak a katalógus nyers [mm] mezőit ismeri).

## Validáció

- `test/section.test.ts`: a fenti kézi + numerikusan kereszt-ellenőrzött
  referenciaérték zárt alakban; `yMax = max(yTop,yBottom)` invariáns;
  szimmetrikus alakoknál `yTop`/`yBottom` MARAD `undefined`.
- `test/layeredSection.test.ts`: a rétegzés a `−yTop`-tól `+yBottom`-ig
  fedi le a magasságot (NEM `∓h/2`), terület- és súlypont-megőrző
  (`Σ bₗ·zₗ·tₗ ≈ 0`, FÜGGETLEN ellenőrzés az aszimmetrikus induló ponttól).
- `test/validate.test.ts`, `test/fuzz.test.ts`: T-profile arbitrary
  generátor a 10 000/500 iterációs P16 fuzz-teszthez (a linearis ÉS a
  rétegelt/nemlineáris úton is) — ez a legveszélyesebb eset az előjel-
  hibákra, mindkét fuzz-kör hibátlanul lefutott.
- `pnpm check` (mind a 4 csomag) + `pnpm --filter @femati/fem-core coverage`
  zöld, böngészőben ellenőrizve (T-szelvény kiválasztása, rajz/méretek/
  képletek/yTop-yBottom sorok, bal panel élő előnézete).

## Nyitva maradt (jövőbeli, ha szükséges)

Szögvas (L) — csak egy kéttengelyű hajlítást bevezető architekturális
bővítés (saját ADR, a stiffness mátrix/kinematika alapjait érintené)
hozhatná be; ez a fázis TUDATOSAN nem célozza meg.
