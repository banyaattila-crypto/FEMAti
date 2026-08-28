# ADR-0017 — Csillapítás és tranziens válasz (Rayleigh + Newmark-β)

**Dátum:** 2026-08-28 · **Státusz:** ELFOGADVA és MEGVALÓSÍTVA a `fem-core`
numerikus mag szintjén — validálva, `pnpm check` tiszta. UI-integráció MÉG
NINCS (ld. lent). · **Érinti:** `fem-core` (`solver`, `linalg`)

## Kontextus

Az [ADR-0016](0016-dinamikai-bovites-modalis-analizis.md) (modális analízis)
tudatosan kizárta a csillapítást és a tranziens (időlépéses) választ a
hatóköréből — ez volt a "legkisebb, önmagában lezárható" első szelet. Most,
hogy a modális megoldó (`solveModal`) validált és a felületen is elérhető,
ez a következő, szintén önmagában lezárható bővítés: a szerkezet válasza
IDŐBEN változó gerjesztésre, csillapítással.

## Döntés

1. **Csillapítás: Rayleigh- (arányos) modell**, `C = α·M + β·K`
   (`solver/damping.ts`). Ez a legelterjedtebb, legegyszerűbben validálható
   csillapítási modell szerkezetdinamikában (nem ennek a projektnek a saját
   levezetése — klasszikus eredmény, ld. pl. Chopra, *Dynamics of
   Structures*), és a KULCS-tulajdonsága teszi validálhatóvá zárt alakkal:
   a K/M sajátvektorai (a modális megoldóból már ismert módalakok) a
   csillapított rendszernek IS sajátvektorai maradnak — minden módus
   egymástól FÜGGETLEN, csillapított egyszabadságfokú oszcillátorként
   viselkedik, ζₙ = α/(2ωₙ) + β·ωₙ/2.
2. **Időintegrálás: Newmark-β**, alapértelmezésben átlagos gyorsulás
   (β=1/4, γ=1/2 — feltétel nélkül stabil, nincs numerikus csillapítás)
   (`solver/transient.ts`). Klasszikus, jól dokumentált módszer (Newmark
   1959; a konkrét együttható-jelölés Bathe, *Finite Element Procedures*
   szerint) — szintén NEM saját levezetés, a validáció ezért zárt alakú
   referenciákkal történik, nem csak a kód belső konzisztenciájával.

## Architektúra

| Fájl | Tartalom |
|---|---|
| `linalg/eigen.ts` | ÚJ, exportált `choleskySolve(l, b)` — a `generalizedSymmetricEigen`-ben már meglévő (korábban privát) előre/hátra helyettesítés publikussá téve, mert a Newmark-β minden lépésben UGYANAZT az effektív merevségi mátrixot oldja meg (egyszeri Cholesky-felbontás, sok jobboldal) |
| `solver/damping.ts` | `RayleighDamping`, `rayleighFromModalDamping(ω₁,ζ₁,ω₂,ζ₂)`, `dampingMatrix(K,M,damping)` |
| `solver/transient.ts` | `solveTransient(model, options)` — `TransientResult` (időlépésenkénti TELJES elmozdulás/sebesség/gyorsulás-vektor, mint `LinearResult.displacements`) |

`solveTransient` a `solveModal`-hoz hasonlóan `assemble()` (K) +
`assembleMass()` (M) + opcionális `dampingMatrix()` (C) kombinációjából
épül, és — ugyanúgy, mint a modális megoldó — csak `elimination`
peremfeltétel-stratégiát támogat.

## Validáció (`test/transient.test.ts`, `test/damping` esetek)

Mind zárt alakú referenciával, NEM csak formulázás-belső önellenőrzéssel:

1. **`rayleighFromModalDamping`**: a visszaadott α,β valóban a célzott ζ-t
   adja vissza mindkét módusra (gépi pontosságig).
2. **Csillapítatlan szabadrezgés az 1. módusalakból**: a kezdeti elmozdulás
   pontosan a `solveModal`-ból kapott 1. módusalak, nulla sebesség, nulla
   gerjesztés — a válasznak `u(t) = u₀·cos(ω₁·t)`-nek kell lennie (a
   klasszikus egyszabadságfokú szabadrezgés képlete). MÉRVE: 200 lépés/
   periódus mellett a csúcshiba 9.08e-4 (a Newmark átlagos-gyorsulás
   módszer kis periódushiba-eredetű fáziseltolódása 2 periódus alatt).
3. **Rayleigh-csillapított szabadrezgés**: ugyanez, de a válasznak
   `u(t) = u₀·e^(−ζω₁t)·[cos(ωd·t) + (ζω₁/ωd)·sin(ωd·t)]`-t kell követnie
   (Chopra zárt alakja). MÉRVE: 5.99e-4 csúcshiba.
4. **Energiamegmaradás**: csillapítás és gerjesztés nélkül a teljes
   mechanikai energia (kinetikus + elasztikus) az időben ÁLLANDÓ kell
   maradjon — ez a Newmark átlagos-gyorsulás módszer elméleti tulajdonsága
   (nincs numerikus csillapítás). MÉRVE: 1.47e-12 relatív drift (gépi
   pontosság, nem numerikus hiba).

Mind a négy validáció FÜGGETLEN a modális analízis validációjától (más
mennyiséget, más módon ellenőriz), de UGYANARRA a `solveModal()`
kimenetére épül — ez egyben azt is igazolja, hogy a K, M mátrixok és a
modális megoldó konzisztensek a tranziens megoldóval (ugyanaz az assembly).

## Nyitva maradt kérdések (a következő lépés, ha kell)

1. **UI-integráció NINCS.** A modellben (`EditableModel`/fem-core `Model`)
   jelenleg NINCS időben változó teher fogalma — minden `Load` statikus
   (egy konstans nagyságú erő/nyomaték/megoszló teher). Egy tranziens UI-
   nézethez ELŐSZÖR ezt kellene megoldani: vagy egy külön, egyszerű
   "gerjesztés időfüggvénye" bemenet (pl. impulzus/szinusz/lépcső preset),
   vagy a teljes terhelés-időfüggvény szerkesztő — ez ÖNMAGÁBAN egy jelentős
   UI-tervezési döntés, nem a jelen (fem-core-szintű) lépés része.
2. **A `docs/ADR/0016...`-ban lezárt irodalmi hivatkozások (Fogang 2020,
   Peuscher et al. 2009, Reddy 1999) egyike sem tárgyalja a csillapítást** —
   ez az ADR jelen döntése tehát TELJESEN FÜGGETLEN forrásból (klasszikus
   szerkezetdinamikai tankönyvi eredmény) származik, nem azoknak a
   folytatása.
3. **`fem-validation` csomagba NEM került be** ez a validáció — jelenleg
   kizárólag `fem-core/test/transient.test.ts`-ben él. Ha a projekt a
   `docs/VALIDATION.md`-t (a `fem-validation` GENERÁLJA) szeretné ezzel is
   bővíteni, az egy külön, kis lépés lenne (a meglévő V-/P- esetek mintájára).
