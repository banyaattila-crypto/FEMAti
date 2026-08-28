# ADR-0015 — Izometrikus 3D-feszültség-vizualizáció: sematikus geometria, valódi σ

**Dátum:** 2026-08-23 · **Státusz:** elfogadva · **Érinti:** `ui/src/charts/Beam3DStress.tsx`

## Kontextus

A felhasználó egy valódi kontinuum-FEA (ANSYS/Abaqus-stílusú, 2D/3D hálós)
von Mises feszültség-kontúrképet mutatott, és megkérdezte, tud-e a FEMAti
hasonlóan látványos kimenetet adni.

A FEMAti szigorúan **1D Timoshenko-gerendaelem-modell** — nincs 2D/3D
kontinuum-hálója, a keresztmetszet csak `A`, `I`, illetve rétegzett `z`-profil
formájában létezik (ld. `DESIGN-TERV.md` 11. pont, `STATUS_REPORT.md` 10.
pont). Egy valódi kontinuum-kontúrkép (geometriai törésponti, pl. gerinc/öv
sarki feszültségkoncentrációval) ezért a jelenlegi architektúrával NEM
állítható elő — ez egy másik (kontinuum-FEA) motort igényelne.

## Döntés

Egy **izometrikus, extrudált vizualizáció** készült (`Beam3DStress.tsx`, új
"3D feszültség" fül a diagramsávon), amely:

1. **Valódi, a modellből számolt adatot** jelenít meg: a szélső szálon
   (`z = ±h/2`) számolt zárt alakú hajlítófeszültséget,
   `σ = M(x)·z / I`, a gerenda hossza mentén, az élő lineáris eredményből
   (`useLiveResult`) — NEM kitalált vagy dekoratív érték.
2. **Sematikus (téglatest-burkoló) geometriát** használ, NEM a tényleges
   szelvényalak (I/HEA/U/kör stb.) profilját — a komponens fejléc-
   kommentje és a képernyőn megjelenő `<title>` is explicit kimondja ezt a
   korlátot, hogy a felhasználó ne értelmezze tévesen kontinuum-FEA
   eredményként.
3. Öt megállós "jet"-szerű színskálát használ (kék→cián→zöld→sárga→piros),
   `|σ|`-t normalizálva a gerenda mentén mért maximumra — ÚJ, önálló
   színnyelv, tudatosan NEM a meglévő `--sem-*` szemantikus paletta (amely
   diszkrét mechanikai ÁLLAPOTOT jelöl, nem folytonos mennyiséget).

## Indoklás

1. **Miért nem valódi 3D (Three.js/WebGL)?** A "klasszikus CAE munkaasztal"
   design-elv (`DESIGN-TERV.md`) letisztult, szögletes, nem-dekoratív
   megjelenést ír elő; egy kamera/világítás/forgatás-réteg ezzel törne, és
   jelentős build-méret/karbantartási terhet hozna egy MÁSODLAGOS
   (nem validációs, nem mérnöki-pontosságú) funkcióért. A felhasználóval
   egyeztetve (2 koncepció közül) az SVG-alapú megoldás mellett döntöttünk.
2. **Miért csak a szélső szál (elasztikus σ), nem a teljes rétegzett/
   képlékeny mező?** Ez MINDIG elérhető (a lineáris eredmény élőben
   frissül minden modellváltozás után), nem igényli a nemlineáris
   futtatás (F5) előzetes lefuttatását — konzisztens a többi élő
   diagrammal (M/T/w/φ).
3. **Miért kell a fejléc-kommentben és a `<title>`-ben is kimondani a
   korlátot?** Mert a vizuális forma (extrudált, színes, "3D-s" beam) erős
   asszociációt kelt egy valódi kontinuum-FEA eredménnyel — ez FÉLREVEZETŐ
   lenne explicit figyelmeztetés nélkül, különösen mérnöki kontextusban.

## Következmények

- Az új "3D feszültség" fül a `DiagramTab` unióba és a `DiagramPanel`
  elágazásába illeszkedik, ugyanúgy, mint a `load-displacement`/
  `convergence` fülek — nincs új állapotkezelési minta.
- A geometria és a színskála FÜGGETLEN a `--sem-*` szemantikus palettától —
  ha a jövőben a rétegzett/képlékeny σ-mezőt is meg akarjuk jeleníteni itt,
  az egy KÜLÖN döntés (a nemlineáris futtatás előzetes lefuttatását
  igényelné, és a jet-skála/sem-paletta viszonyát újra kellene gondolni).
- Böngészőben ellenőrizve: a fül helyesen vált, 36 szegmens × 2 lap (72
  polygon) renderelődik, a legend `0 MPa`–`σ_max MPa` tartományt mutat
  valós, a modellből számolt σ_max-szal (nagyságrendileg ellenőrizve az
  `M = M·z/I` kézi számítással).
