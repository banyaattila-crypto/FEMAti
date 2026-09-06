# ADR-0023 — Földrengés: EN 1998-1 FÜGGŐLEGES komponens, a meglévő modális megoldóra építve

**Dátum:** 2026-09-06 · **Státusz:** elfogadva, megvalósítva · **Érinti:** `fem-core` `material/verticalSeismicSpectrum.ts`; `ui` `model/combinations.ts`, `model/designChecks.ts`, `panels/LeftPanel.tsx`, `panels/RightPanel.tsx`, `components/SeismicSpectrumChart.tsx`

## Kontextus

A felhasználó megkérdezte, érdemes-e a földrengési teherkombinációval
foglalkozni, vagy csak "parasztvakítás" lenne. Explicit kizárta a 2D
keretszerkezet bevezetését (ütné az eredeti, diplomaterv szerinti 1D
Timoshenko-gerenda hatókört, ld. memória: `project-femati-roadmap`).

Egy TELJES földrengési tervezési szituáció (EN 1990 6.12a-b: ΣGk+P+AEd+
Σψ₂Qk) egy izolált, egysíkú hajlító gerendánál valóban tartalom nélküli
lenne AEd (a tényleges földrengési hatás) nélkül — egy vízszintes
földrengési hatás csak keretszerkezet/tömegeloszlás mellett értelmezhető,
amit a hatókör kizár. AMI VISZONT valódi, önmagában is értelmezhető tartalom
egyetlen gerendán: az **EN 1998-1 4.3.3.5.2 szerinti FÜGGŐLEGES komponens**
(nagy fesztávú, konzolos, vagy rideg elemet alátámasztó gerendáknál előírt
ellenőrzés) — ez egy, a szerkezet tömegével arányos függőleges pszeudo-teher,
ami PONTOSAN illeszkedik egy 1D hajlító modellhez.

## Döntés

CSAK a függőleges komponenst implementáljuk, a meglévő modális megoldóra
(ADR-0016) építve: a szerkezet TÉNYLEGES T₁ sajátperiódusát használjuk a
tervezési spektrumérték Svd(T₁) leolvasásához — nem egy generikus/becsült
periódust. Ez köti össze a modális analízist a tervezési kombinációval, és
ez adja a "látványos folyamat" felhasználói elvárást (a spektrumgörbe + a
T₁ pont vizuálisan is megjelenik, `components/SeismicSpectrumChart.tsx`).

A teljes függőleges tervezési hatás G+ψ₂Q±Ev, ahol Ev=Svd(T₁)·(G+ψ₂Q) —
mivel Ev ARÁNYOS (G+ψ₂Q)-val, ez egyetlen (1±Svd(T₁)) közös szorzóval
fejezhető ki G-re ÉS ψ₂·Q-ra egyaránt (`combinations.ts`
`scaleModelForSeismicVariants`, ugyanaz az envelope-minta, mint a 2026-09-06
korábbi ψ₀-kombinációnál).

## Hatókör-korlátok (tudatos MVP-egyszerűsítések)

- **NINCS vízszintes/keret-hatás** — egyetlen, egysíkú hajlító gerendaelemnek
  nincs értelmezhető vízszintes földrengési válasza.
- **T₁ CSAK a szerkezet saját tömegéből** — az EC8 3.2.4 szerinti teljes
  szeizmikus tömeg (G+ψ₂·Q) helyett, mert a meglévő `assembleMass()`
  (ADR-0016) csak az elemek saját (fajsúlyból számolt) tömegét kezeli, teher-
  eredetű tömeget nem. Ez a T₁-et alábecsüli (rövidebb periódust ad) — a
  plató-tartományban (TB≤T≤TC, a leggyakoribb eset alacsony fesztávú
  gerendáknál) ez NEM változtat az eredményen (a spektrum konstans ott),
  csak a leszálló ághoz (T>TC) közeli eseteknél okozhat kis eltérést.
- **Talajosztály NINCS bemenetként** — az EC8 3.4. táblázat szerint a
  talajosztály (S) a függőleges spektrumot NEM befolyásolja.
- **qv=1.5 fix** (EC8 4.3.3.5.2(1) — minden anyagra/rendszerre ez a
  megengedett max, nincs indoklás alacsonyabb értékre ebben a körben).
- **ψ₂=0.3 fix, MVP-érték** — EN 1990 A1.1 melléklet A/B kategória
  (lakó-/irodaépület), ugyanaz az egyszerűsítés, mint `ULS_PSI0`-nál
  (`combinations.ts`) — nincs teherfajta szerinti tábla.
- **Csak M-V ellenőrzés, NINCS lehajlás-ellenőrzés** — az EC8 4.3.3.5.2 egy
  ULS-jellegű (teherbírási), nem SLS-ellenőrzés.

## Forrás

Az eredeti EN 1998-1:2004 szöveg nem volt közvetlenül elérhető — a Sve(T)
képletet és a 3.4. táblázat értékeit Carvalho, E. (2011), "EUROCODE 8 —
Background and Applications" (JRC/Lisbon, 2011.02.10-11, hivatalos EU JRC
oktatási anyag, eurocodes.jrc.ec.europa.eu) 23-24. diái alapján vettük át —
ugyanaz az elv, mint a Cowper I-szelvény formulánál (2026-09-06, korábban
ugyanebben a sessionben): elsődleges forrás hiányában egy hiteles, hivatalos
másodlagos forrás, explicit megjelölve.

## Haladás (2026-09-06)

- `fem-core` `material/verticalSeismicSpectrum.ts`: `verticalElasticSpectrum`,
  `verticalDesignSpectrum`, `VERTICAL_SPECTRUM_TABLE`,
  `verticalDampingCorrection`. 13 teszt (`test/verticalSeismicSpectrum.test.ts`):
  táblázatértékek, η határesetek, folytonosság a TB/TC/TD töréspontokon,
  monoton csökkenés a leszálló ágban, qv-osztás.
- `ui` `model/editable.ts` `SeismicState` (+ `DEFAULT_SEISMIC`,
  visszamenőleges kompatibilis `fileIO.ts` roundtrip).
- `ui` `model/combinations.ts` `scaleModelForSeismicVariants` +
  `SEISMIC_PSI2`. `ui` `model/designChecks.ts` `computeSeismicUtilization`
  (envelope a ± Ev változatokra). Új tesztek mindkét fájlban.
- `ui` `panels/LeftPanel.tsx`: checkbox + ag/g és γI csúszka + spektrum-
  típus (1/2) váltó, a "Megoldó" kártyában (ugyanott, ahol a hőteher/mozgó
  teher beállításai élnek).
- `ui` `panels/RightPanel.tsx`: ÚJ "Földrengési (vertikális) ellenőrzés"
  kártya (csak ha `model.seismic.enabled`) — T₁, a
  `components/SeismicSpectrumChart.tsx` spektrumgörbe (T₁ ponttal
  megjelölve), Svd(T₁), M-V kihasználtság + verdikt.
- Böngészőben ellenőrizve (kétnyílású tartó, IPE 300): T₁=0.036s (a plató
  alatti, felszálló ágon), Svd(T₁)=0.221g, M-V kihasználtság 32.06%
  ("megfelel a határértéknek") — a görbe és a T₁-jelölő vizuálisan helyesen
  jelenik meg, konzolhiba nélkül.
- `pnpm --filter @femati/fem-core exec vitest run`, `pnpm --filter
  @femati/ui exec vitest run` (117 teszt) és `pnpm lint` (mind a 4 csomag)
  zöld.
