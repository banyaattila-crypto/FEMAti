# ADR-0021 — Lehajlás- és repedésinyomaték-ellenőrzés + PDF export bekötése

**Dátum:** 2026-09-02 · **Státusz:** ELFOGADVA ÉS MEGVALÓSÍTVA · **Érinti:**
`fem-core` (`material`, `solver/linearSolver.ts`), `ui` (`panels/
RightPanel.tsx`, `report/ReportView.tsx`, `App.tsx`, `format/utilization.ts`)

## Kontextus

Versenytárs-elemzés (SkyCiv, Dlubal RSTAB/RFEM) alapján a legnagyobb valódi
hiányosság a FEMAti-ban a **design/code-checking**: a program kiszámítja az
igénybevételeket (M, T, w, φ), de nincs %-os, pass/fail jellegű
kihasználtsági-visszajelzés a meglévő eredmények mellett — a
versenytársak ezt alapszolgáltatásként adják.

A felhasználó két, egymástól független, kis kockázatú bővítést hagyott
jóvá: (1) a File → "Export: PDF" inaktív menütétel bekötése, (2) egy
egyszerű, %-os EC2/EN1993 kihasználtsági-ellenőrzés a meglévő M/T/w
eredmények mellé.

## PDF export — nincs új architektúra

Az ADR-0005 már kimondja: a PDF export a böngésző natív nyomtatómotorján
(`window.print()` + `@media print` CSS) keresztül történik, NEM külön
PDF-könyvtárral. Ez `ReportView.tsx`-ben és `DerivationView.tsx`-ben MÁR
MŰKÖDIK (saját "Nyomtatás / PDF mentése" gombbal). A File-menü tétele
csak egy sosem bekötött `disabled: true` stub volt — a bekötés:
`s.setReportOpen(true)`, majd dupla `requestAnimationFrame`-mel
(a React állapotváltás DOM-commitjának bevárására) `window.print()`.
`Export: Word (.docx)` VÁLTOZATLANUL `disabled: true` marad — nem része
ennek a körnek.

## Kihasználtsági-ellenőrzés — mit fed le és mit NEM

### EN 1993 (acél) — a meglévő M-V interakció (ADR-0018) kiterjesztése

A `shearMomentInteraction()` (ADR-0018) MÁR SZÁMOL egy `utilization`
arányt — csak szöveges verdikt nem volt hozzárendelve. Az EN 1993-1-1
ajánlott γM0 = 1.00 érték miatt a meglévő `me`/`mp`/`vpl` (σY·Kₑ, σY·Kₚ,
κs·A·σY/√3 — nincs osztás γM0-lal) SZÁMÉRTÉKBEN MÁR a tervezési
teherbírás — ezért a `linearSolver.ts` képlete VÁLTOZATLAN marad, csak
dokumentálva lett ez a feltételezés (National Annex szerinti eltérő γM0
egy jövőbeli, KÜLÖN bővítés lenne, nem implementált).

### EC2 (beton) — repedési nyomaték, NEM ULS teherbírás

A `fem-db` anyagkatalógusban és az EC2 σ-ε modellben (ADR-0019) NINCS
vasbetét (As) — egy valódi EC2 ULS hajlítási teherbírás-ellenőrzés
(M_Rd vasalt keresztmetszetre) ezért NEM számítható a jelenlegi motorral;
ez vasalás-geometria bevitelét igényelné, KÜLÖN, jövőbeli feladat.

Ehelyett a **repedési nyomaték** (M_cr = fctm·Kₑ, EN 1992-1-1 §7.1
szellemében, fctm-mel, γc nélkül — karakterisztikus/SLS konvenció) kerül
bevezetésre: a MEGLÉVŐ `fctm` (fem-db) és `Kₑ` (elastic modulus, már
számított) adatokból, új mező nélkül számolható, és ŐSZINTÉN,
TÁJÉKOZTATÓ jelleggel jelzi, mikor lép túl a modell a rugalmas
(repedésmentes) tartományon. A UI ("verdikt" sor, tooltip) és a
jegyzőkönyv is expliciten jelzi: ez NEM egy "a tartó tönkremegy"
állítás, hanem "a rugalmas merevségi feltevés innentől nem érvényes".

### Lehajlás (SLS, L/250) — univerzális, anyagfüggetlen

`w_max`/span vs. 1/250 — triviálisan számolható a meglévő adatokból,
minden anyagra értelmezhető, és a felhasználó saját (CLAUDE.md-ben
rögzített) mérnöki ökölszabálya.

## Megvalósítás

- ÚJ `fem-core/src/material/serviceabilityCheck.ts`: `deflectionUtilization
  (wMax, span, limitRatio=1/250)`, `crackingMomentUtilization(mMax, mcr)` —
  tiszta, matematikai függvények, a `shearMomentInteraction.ts` mintáját
  követve (nem módosítják a megoldó belső logikáját).
- `solver/linearSolver.ts`: `SectionProps` ÚJ `mcr: number | null` mezővel
  (ugyanaz a minta, mint `me`/`mp`/`vpl` — `null`, ha az anyagnak nincs
  `fctm`-je).
- `test/serviceabilityCheck.test.ts` (11 teszt): határeseti arányok
  mindkét függvényre, előjelfüggetlenség, `span=0`/`mcr=0` végtelen
  kihasználtság (nem hiba).
- ÚJ `ui/src/format/utilization.ts`: `utilizationVerdict(u)` — központi
  "megfelel a határértéknek"/"túllépi a határt" szöveg+tónus helper,
  hogy a döntés egy helyen legyen (korábban a tone-logika inline
  duplikálódott volna `RightPanel.tsx`-ben).
- `panels/RightPanel.tsx`: a "Határteher-ellenőrzés" kártyában ÚJ
  "verdikt" sorok az M-V, a lehajlás és (csak betonnál) a repedési
  nyomaték kihasználtsághoz.
- `report/ReportView.tsx`: az "5. Eredmények" szekcióban ugyanezek a
  sorok, UGYANAZOKKAL a fem-core/format helperekkel — a jegyzőkönyv és a
  képernyő SOSEM térhet el (a fájl saját fejléc-elve).
- `App.tsx`: `exportReportPdf` handler, File → "Export: PDF" bekötve.

`pnpm check` (mind a 4 csomag) tiszta. Böngészőben ellenőrizve: acél
(S235) modellnél az M-V verdikt és a lehajlás-sor megjelenik; beton
(C25) modellnél az M-V sor eltűnik (nincs σY), a repedési nyomaték sor
megjelenik; File → Export: PDF a Jegyzőkönyvet nyitja meg és elindítja a
nyomtatást.
