# ADR-0022 — No-tension Winkler-ágyazat: elemenkénti kontakt-iteráció, nem Newton–Raphson

**Dátum:** 2026-09-04 · **Státusz:** elfogadva · **Érinti:** `fem-core` `assembly/`, `solver/linearSolver.ts`

## Kontextus

A felhasználó egy nemzetközi piackutatás (2026-09-04-i session) alapján
felvetette, hogy a hasonló, nyílt forráskódú eszközök (pl. PyNite) explicit
kínálnak húzásra/nyomásra egyoldalúan dolgozó elemeket és rugókat. A
diplomaterv 1D Timoshenko-gerendamodelljének (`[w, φ]` szabadságfokok,
NINCS axiális szabadságfok) nincs értelmezhető megfelelője egy húzott
rúd-/kábelelemnek — az a 2D-keret hatókör-bővítés témaköre lenne (külön
döntés, ld. memória: `project-femati-roadmap`).

Ami VISZONT valódi, jól illeszkedő megfelelője ennek ebben a modellben: a
**felemelkedésre képes (no-uplift / no-tension) Winkler-ágyazat** — klasszikus
geotechnikai probléma (a talaj nem tud "lehúzni" egy tőle felemelkedő
gerendaszakaszt, csak nyomni tud alulról). A felhasználó explicit ezt a
hatókört választotta az első körben (nem a csomóponti rugós támaszt, nem a
merev támaszt).

## Döntés

A no-tension ágyazatot **elemenkénti kontakt-állapot iterációval** oldjuk
meg (`solver/linearSolver.ts` `solveLinearContact()`), NEM a meglévő
`solver/newtonRaphson.ts` anyagi nemlinearitás-gépezetével.

Algoritmus: lineárisan megoldjuk a rendszert egy próbált "aktív ágyazat"
halmazzal (kezdetben: minden `noTension` elem bekötött) → megnézzük, mely
jelölt elemek emelkedtek fel (a 3 csomópontjuk `w`-jének átlaga negatív —
lefelé pozitív konvenció) → ha ez eltér az előző próbától, azzal a
kikapcsolt halmazzal újraoldunk → ismételjük, amíg a halmaz stabilizálódik
(legfeljebb 25 iterációig, utána figyelmeztetéssel visszaadjuk az utolsó
állapotot).

## Indoklás

1. **Ez NEM anyagi nemlinearitás.** A felemelkedés egy diszkrét, "be/ki"
   kontakt-állapot-váltás (a szerkezet TOPOLÓGIÁJA/merevsége változik
   lépésenként), nem egy folytonos anyagtörvény (folyás, keményedés). A
   Newton–Raphson gépezet (`materialState.ts`, radial-return
   feszültség-visszavetítés) ehhez felesleges és félrevezető lenne — egy
   önálló, egyszerűbb iteráció a helyes eszköz.
2. **Elemenkénti (nem Gauss-ponti) granularitás — tudatos MVP-egyszerűsítés.**
   Egy elemen belüli RÉSZLEGES felemelkedést (pl. egy 1 m-es elem fele
   emelkedik csak fel) a jelenlegi megoldás nem old fel — az egész elem
   ágyazata egyben kapcsol ki/be, a 3 csomópont átlagos `w`-je alapján.
   Finomabb hálóval (több, rövidebb elem az ágyazat alatt) a közelítés
   önmagától javul. Egy Gauss-ponti (vagy elemen belüli interpolált
   kontaktpont) finomítás jövőbeli, önálló tétel lehet, ha valaha durva
   hálónál pontossági probléma merülne fel.
3. **`solveLinear()` bit-azonos marad minden meglévő modellre.** A
   `solveLinearContact()` egyetlen `solveLinear()`-hívásra esik vissza, ha a
   modellben nincs `noTension: true` ágyazat (`candidateFoundationElements()`
   üres halmazt ad) — a meglévő ~660 teszt, validációs eset és a felület
   viselkedése egyetlen bájtnyit sem változik azoknál a modelleknél, amik
   nem használják az új mezőt.
4. **A kontakt-iteráció önmagában NEM garantáltan konvergens minden
   elméletileg lehetséges esetre** (ismert jelenség: "flip-flop" oszcilláció
   bizonyos merevség-/geometria-kombinációknál) — ezért van felső korlát
   (25 iteráció) és explicit figyelmeztetés, ha nem stabilizálódik. A
   gyakorlatban vizsgált esetekben (túlnyúló vég, ld. `test/
   contactFoundation.test.ts` V-08) 1 iterációban konvergál.

## Következmények

- `model/types.ts` `ElasticFoundation.noTension?: boolean` — opcionális,
  hiányzó/`false` esetén a viselkedés VÁLTOZATLAN (mindkét irányban dolgozó
  ágyazat, mint eddig).
- Az egyetlen új publikus belépési pont `solveLinearContact()` — a UI
  (`packages/ui/src/model/compile.ts`) erre vált a korábbi `solveLinear()`
  helyett, mert az MINDEN modellre (edukcióval nem érintettekre is)
  ugyanazt az eredményt adja, csak két extra mezővel (`foundationLiftOff`,
  `contactIterations`) bővítve.
- Ha valaha csomóponti rugós támasz (`Boundary.springW`) vagy merev támasz
  egyoldali (no-uplift) változata is felmerül, az ÚJ, külön döntés — a
  jelenlegi `excludedFoundationElementIds` mechanizmus KIZÁRÓLAG az ágyazatra
  vonatkozik, nem general-purpose kontakt-keret.
