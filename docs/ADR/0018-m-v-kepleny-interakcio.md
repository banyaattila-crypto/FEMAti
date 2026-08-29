# ADR-0018 — Képlékeny M-V (hajlítás-nyírás) interakció

**Dátum:** 2026-08-29 · **Státusz:** ELFOGADVA ÉS MEGVALÓSÍTVA az A) út
(utólagos EN 1993-1-1 6.2.8 stílusú ellenőrzés) — a radial-return/tangens
merevség VÁLTOZATLAN, csak egy önálló, validált formulapár készült el (ld.
"Haladás"). A B)/C) út (csatolt plaszticitás) nyitva marad, külön ADR-t
igényelne. UI-megjelenítés MÉG NINCS. · **Érinti:** `fem-core` (`material`,
`solver/linearSolver.ts`)

## Kontextus

A projekt "profi App" felé mutató bővítései közül (ld. memória:
`project-femati-scope-pivot`) ez a harmadik: a **dinamika** (ADR-0016/0017)
és a **Cowper-féle κs finomítás** után a **képlékeny hajlítás–nyírás
kölcsönhatás** hiányzik — jelenleg a nyírás MINDIG rugalmas marad, a
képlékenység kizárólag a hajlítónyomatékra épül.

Ez NEM hiányzó funkció a diplomaterv-hűség értelmében — a diplomaterv maga
is tudatosan ezt a leegyszerűsítést használja (3.52 egyenlet, 63. oldal):
"dQ = GAs·dγ" változatlan marad a folyási feltételtől függetlenül. A
projekt mindkét képlékenységi útja (`material/resultantPlastic.ts` —
igénybevétel-szintű; a rétegelt út a `solver/nonlinearElement.ts`-en
keresztül) ugyanezt az elvet követi:

- `resultantPlastic.ts`: `yieldFunction(m, m0) = m² − m0²` — CSAK M.
- `nonlinearElement.ts` (8-12. sor): "a nyírási tag VÁLTOZATLANUL rugalmas
  (`GAs` állandó, `T = GAs·γ`)" — mindkét (resultant és rétegelt) úton.

Ez egy **valódi, a diplomaterven túlmutató bővítés** lenne, nem
hiánypótlás — ezért ADR-t igényel, mielőtt a már validált (és korábban
egyszer hibásnak bizonyult, ld. ADR-0007) képlékenységi kódhoz nyúlunk.

## Miért NEM triviális ez a bővítés

1. **A folyási feltétel átalakul.** `f = M² − M0²` helyett egy M-V
   kombinált felület kell — ez nem egyszerű paraméter-csere, hanem a
   radial-return levezetés (`updateResultantPlasticState`) újragondolása.
2. **A tangens merevség csatolódhat.** Jelenleg `K_T = ∫Bκᵀ·EI_T·Bκ + ∫Bγᵀ·
   GAs·Bγ` — BLOKKDIAGONÁLIS a κ/γ alakváltozásokban (nincs kereszttag).
   Egy valódi M-V interakciós felületnél (normalitási szabály esetén) a
   képlékeny alakváltozás-inkrementum IRÁNYA mindkét komponenstől függ,
   ami κ-γ kereszttagot vezetne be a tangens merevségi mátrixba — ez
   messze nem "állítsunk be egy második folyási függvényt" szintű munka.
3. **Két, egymástól független implementációt érint** — a resultant
   (`resultantPlastic.ts`) ÉS a rétegelt (`layeredSection.ts` +
   `nonlinearElement.ts`) utat is módosítani/validálni kellene, mert a UI
   nemlineáris futtatása MINDIG a rétegelt modellt használja (ld.
   `STATUS_REPORT.md` 7. pont dokumentált hatókör-korlátja), miközben a
   `fem-core` szintjén a resultant modell is önállóan validált (P-09…P-16).
4. **Validációs referencia szükséges** — nincs "magától értetődő" zárt
   alakú M-V interakciós teherbírás egy Timoshenko-gerenda-szeletre, csak
   szabványos KÖZELÍTŐ formulák (ld. lent) vagy egzakt, de bonyolultabb
   von Mises-alapú keresztmetszeti integrálás.

## Lehetséges megközelítések (nyitott döntés)

| Megközelítés | Leírás | Előny | Hátrány |
|---|---|---|---|
| **A) EN 1993-1-1 6.2.8 stílusú redukált Mpl** | `V > 0.5·Vpl` esetén a folyáshatár a nyírt zónában redukálódik: `Mv,Rd = Mpl,Rd·(1−ρ)`, `ρ=(2V/Vpl−1)²` | Szabványból ismert, mérnökileg elfogadott, viszonylag egyszerű | Nem "sima" folyási felület (küszöbérték-jellegű, V≤0.5Vpl alatt NINCS hatás) — ez elméletileg konzisztensebb egy KAPACITÁS-ELLENŐRZÉSHEZ, mint egy inkrementális plaszticitás-modellhez |
| **B) Ellipszis-alakú interakciós felület** | `f(M,V) = (M/M0)² + (V/V0)² − 1` (Ilyushin-típusú) | Sima, normalitási szabállyal konzisztens, a meglévő radial-return-höz hasonló zárt alakú megoldás KERESHETŐ | Nincs annyira "szabványos" mérnöki elfogadottsága, mint az A) út; a V0 (nyírási "folyási" kapacitás) definíciója maga is tisztázandó |
| **C) Teljes von Mises keresztmetszeti integrálás** | A rétegelt modellben rétegenként σ ÉS τ, kombinált von Mises folyás | Legpontosabb, konzisztens a rétegelt modell szellemével | Legnagyobb munka; a `layeredSection.ts` alapjaiban változna (ma csak σxx-et követi rétegenként); a nyírófeszültség-eloszlás (parabolikus téglalapon, ld. korábban átnézett Ahmed & Rifai cikk (3)-as képlete) réteges közelítést igényelne |

**Javaslat (nem végleges, vitára bocsátva):** A) út először, MERT:
- ez a mérnöki gyakorlatban ténylegesen használt, szabványos ellenőrzés —
  "profi App"-hoz ez adja a legközvetlenebb, azonnal hasznosítható értéket
  (egy teherbírás-ellenőrzés kiegészítéseként, NEM feltétlenül az
  inkrementális radial-return belsejébe építve).
- KÜLÖN kezelhető a meglévő radial-return-től: egy UTÓLAGOS
  kapacitás-ellenőrzésként (M_max/Mv,Rd arány egy adott terhelési
  állapotban) ELSŐ lépésben BEVEZETHETŐ anélkül, hogy a tangens
  merevségi mátrixot és a radial-return belső logikáját módosítanánk —
  ez radikálisan csökkenti a kockázatot (nem nyúlunk a validált
  `updateResultantPlasticState`-hez).
- A B)/C) út (valódi csatolt plaszticitás) egy KÉSŐBBI, önálló ADR-t
  érdemelne, ha az A) út bizonyítottan nem elég.

## Javasolt hatókör (első lépés, ha elfogadott)

1. **Csak ELLENŐRZÉS, nem a tangens merevség módosítása**: egy új
   `shearMomentInteraction()` függvény, ami egy adott (M, V) igénybevétel-
   párra visszaadja a redukált Mv,Rd-t (EN 1993-1-1 6.2.8 formula) és egy
   `utilization = |M|/Mv,Rd` arányt.
2. **Hol jelenik meg:** a meglévő eredmény-kiértékelésben (`LinearResult`/
   nemlineáris eredmény), ÚJ mezőként — NEM a radial-return belsejében.
3. **Validáció:** kézzel számolt referenciaeset(ek) az EN 1993-1-1 6.2.8
   formulából, plusz egy V=0 és egy V=Vpl határeset ellenőrzése (ν=0-nál
   Mv,Rd=Mpl,Rd, V=Vpl-nél Mv,Rd→0).
4. **NEM ebben a lépésben:** a radial-return/tangens merevség módosítása
   (B/C út) — az egy KÜLÖN, jövőbeli ADR-t igényel, ha az A) út
   tapasztalatai alapján szükségesnek bizonyul.

## Nyitott kérdések — implementáció ELŐTT tisztázandók

1. Elfogadható-e, hogy az első lépés CSAK utólagos ellenőrzés (nem
   befolyásolja magát a nemlineáris megoldást), vagy elvárás egyből a
   teljes, csatolt plaszticitás (B/C út)?
2. Az EN 1993-1-1 6.2.8 formula I-szelvényekre lett kalibrálva (a nyírt
   terület Av definíciója web-alapú) — téglalap/kör keresztmetszetre a
   szabvány más Av-definíciót ad (`docs/THEORY.md`-hoz hasonlóan itt is
   dokumentálandó, alak-specifikus lenne).
3. Melyik teherbírás-eredménybe kerüljön be az `utilization` mező —
   `LinearResult.props`-hoz hasonló bővítés, vagy önálló mező?

## Döntés

Ez az ADR egy JAVASLAT — nincs elfogadva, nincs implementáció. A fenti
nyitott kérdések (különösen az 1. pont: hatókör mélysége) tisztázása
szükséges, mielőtt bármilyen kód készül.

## Haladás (2026-08-29)

A felhasználóval egyeztetve: **A) út, csak utólagos ellenőrzés** — a
nyitott kérdés #1-re a válasz "utólagos, nem csatolt" volt.

- ÚJ `material/shearMomentInteraction.ts`:
  - `plasticShearCapacity(sigmaY, effectiveShearArea)` — Vpl =
    A_eff·σY/√3. Az A_eff (effektív nyírási terület) NEM a szabvány
    szerinti Av, hanem a modell MÁR meglévő κs·A mennyisége
    (`SectionStiffness.gas / material.g`) — tudatos, dokumentált
    modellezési döntés (nem szabvány szerinti Av-definíció).
  - `shearMomentInteraction(m, v, mpl, vpl)` — a 6.2.8(2) formula:
    `ρ=(2·|V|/Vpl−1)²` ha `|V|>0.5·Vpl`, `Mv,Rd=(1−ρ)·Mpl,Rd`,
    `utilization=|M|/Mv,Rd`.
- `solver/linearSolver.ts`: `SectionProps` ÚJ `vpl: number | null` mezővel
  (ugyanaz a minta, mint `me`/`mp` — `null`, ha nincs `σY`).
- `test/shearMomentInteraction.test.ts` (9 teszt): a szabvány saját
  határesetei — V=0 (nincs redukció), V=0.5·Vpl (a küszöb, még nincs
  redukció), V=Vpl (teljes redukció, Mv,Rd→0), V=0.75·Vpl (a képlet szerinti
  ρ=0.25 közbenső eset), előjelfüggetlenség, Vpl=0 határeset (végtelen
  kihasználtság, nem hiba). `test/solver.test.ts` (+2 teszt): `vpl` a
  `LinearResult.props`-ban helyesen számolódik / `null` σY nélkül.
- `pnpm check` (mind a 4 csomag) tiszta.

**UI-megjelenítés — KÉSZ (2026-08-29):** `panels/RightPanel.tsx`, a
"Határteher-ellenőrzés" szakaszban, az Mₑ/Mₚ sorok mellé: ÚJ "képlékeny
nyíróerő-teherbírás Vpl" sor, és ÚJ "M-V kihasználtság" sor (a globális
`extremes.m`/`extremes.t` szélsőértékekből számolva —
`shearMomentInteraction()` közvetlen hívással a komponensben). A `tone`
(ok/error) a kihasználtság 1 alatti/fölötti értékétől függ. A `title`
tooltip ŐSZINTÉN jelzi a konzervatív becslés korlátját (ha M-max és T-max
NEM azonos keresztmetszeti helyen lép fel). Böngészőben ellenőrizve
(kétnyílású tartó, IPE 300): Vpl=288.99 kN, kihasználtság=87.61%, nincs
konzolhiba. `pnpm check` tiszta.

A B)/C) út (a folyási feltétel/tangens merevség tényleges csatolása)
NYITVA marad — külön ADR-t igényelne, ha az A) út tapasztalatai alapján
szükségesnek bizonyul.
