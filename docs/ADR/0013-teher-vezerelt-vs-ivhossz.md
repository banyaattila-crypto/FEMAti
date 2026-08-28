# ADR-0013 — Teher-vezérelt lépcsőzés a megoldó, ívhossz-vezérlés tudatosan elmaradt

**Dátum:** 2026-08-22 · **Státusz:** elfogadva · **Érinti:** P11, P13, P16

## Kontextus

A diplomaterv nemlineáris megoldása (3.4.2.1/3.4.4) **egyparaméteres,
teher-vezérelt** eljárás: a `λ` teherszorzót lépcsőzi (`f ← f + Δf`), és
minden lépésben Newton-Raphson iterációval keresi az egyensúlyt. Ennek
ismert korlátja, hogy a teher–elmozdulás görbe **csúcsán (a határteherén)
túl** — ahol a merevség előjelet vált (`snap-through`/`snap-back`) — a
teher-vezérelt eljárás definíció szerint nem tud továbbhaladni: a Newton-
iteráció nem konvergál, mert nincs olyan elmozdulás-növekmény, ami az adott
tehernövekményhez egyensúlyt adna.

A MASTER-PROMPT-TERV (1.8 pont, 244. sor) ezt a korlátot explicit módon
megnevezi, és egy lehetséges kiegészítést javasol: **ívhossz-vezérlés
(Riks-módszer)**, mint a P16 fázis **OPCIONÁLIS** tétele — csak akkor
ütemezve, ha minden más P16 elfogadási kritérium már teljesült.

## Döntés

A megoldó marad **kizárólag teher-vezérelt** (`solver/loadStepper.ts`,
adaptív `Δλ`-lépésfelezéssel/-növeléssel). Az ívhossz-vezérlés (Riks) **NEM
készül el** ebben a projektben.

## Indoklás

1. **A diplomaterv maga is teher-vezérelt** — a hiteles rekonstrukció célja
   szerint ez az elsődleges, hű megvalósítandó eljárás; az ívhossz-vezérlés
   a mesterterv szerint is csak "modern kiegészítés", nem a diplomaterv
   része.
2. **A P16 fázis MÉRÉSSEL igazolta, hogy a fő teljesítmény-célok (5000 DOF-os
   stressz-teszt, allokáció-optimalizálás, robusztusság-igazolás,
   fuzz-teszt) ELőbb teljesítendők** — az ívhossz-vezérlés a mesterterv
   sorrendje szerint is csak EZUTÁN, opcionálisan merülhet fel (ld. P16
   prompt 5. pont: "OPCIONÁLIS, csak ha a fentiek készen vannak"). A P16
   fázis ezeket a kötelező tételeket elvégezte (ld. ADR-0009), de az
   ívhossz-vezérlést tudatosan NEM kezdte el — ez konzisztens a mesterterv
   saját prioritási sorrendjével, nem hiányosság.
3. **A határteher közelében fellépő nem-konvergencia FIZIKAI eredmény, nem
   hiba** — a mesterterv explicit előírja (1.8 pont, 244. sor): "Világosan
   jelezzük a felületen, hogy a nem-konvergencia a határteher közelében
   fizikai eredmény, nem hiba." Ezt a `loadStepper.ts`
   `'limit-load-reached'` állapota és a UI (`StatusPill`, "a szerkezet a
   határteher közelébe ért") már teljesíti — az ívhossz-vezérlés hiánya
   emiatt NEM jár azzal, hogy a felhasználó félrevezető vagy néma hibát
   kap; a program egyértelműen és korrekt módon jelzi a saját korlátját.
4. **Az ívhossz-vezérlés bevezetése nem triviális kiegészítés.** Egy Riks-
   féle megoldó megváltoztatná az iteráció alapszerkezetét (a
   szabadságfokok mellé egy extra, a teherszorzót is szabályozó
   egyenletet kellene bevezetni, más konvergencia-kritériummal) — ez a
   `newtonRaphson.ts`/`loadStepper.ts` jelentős, önálló átalakítását
   igényelné, ami a jelen projekt hatókörén (a diplomaterv hű
   rekonstrukciója + a mesterterv KÖTELEZŐ tételei) túlmutat.

## Következmények

- A `LoadStepResult.status` `'limit-load-reached'` értéke a végleges,
  dokumentált jelzés a határteher elérésére — ez NEM ideiglenes állapot,
  amit egy jövőbeli ívhossz-vezérlés "feloldana", hanem a projekt
  szándékos, végleges hatókör-határa.
- A `docs/HIBATURESI-POLITIKA.md` K5 pontja ("Divergencia a határteher
  közelében") ezt a döntést tükrözi: "Nem hiba, hanem eredmény: külön
  státusz, adaptív lépésfelezés" — az "opcionális ívhossz-vezérlés (P16)"
  megjegyzés innentől **elmaradt, tudatosan lezárt tételként** értendő, nem
  nyitott munkaként.
- Ha egy jövőbeli felhasználói igény (pl. instabil, kihajlás-közeli
  szerkezetek vizsgálata) mégis szükségessé tenné, ez egy ÚJ, önálló
  fázist igényelne, saját tervezéssel és validációval — nem a jelenlegi
  `loadStepper.ts` toldaléka.
