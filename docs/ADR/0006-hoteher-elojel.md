# ADR-0006 — A hőteher-tehervektor előjele eltér a MASTER-PROMPT-TERV 1.4 betűjétől

**Dátum:** 2026-08-21 · **Státusz:** elfogadva · **Érinti:** P5 (`assembly/loadVector.ts`, `element/timoshenko3.ts`)

## Kontextus

A MASTER-PROMPT-TERV 1.4 pontja a teherredukciót így adja meg:

> `q_e = ∫ Nᵀ p dx − ∫ Bᵀ D ε0 dx`

Ezzel szemben az 1.6 pont (utófeldolgozás, P6-nak szánva, de a hőteher miatt
már P5-ben szükséges) rögzíti a feszültség-számítás konstitutív alakját:

> `σ = D · (ε − ε0)`

A két képlet EGYÜTT nem önkonzisztens. A virtuális munka elvéből levezetve:

```
∫ δεᵀσ dx = ∫ δεᵀ D(ε − ε0) dx = δvᵀ K v − δvᵀ ∫ Bᵀ D ε0 dx
```

Az egyensúly (`δvᵀf_ext = ∫δεᵀσ dx`) átrendezve:

```
K v = f_ext + ∫ Bᵀ D ε0 dx        (POZITÍV előjel)
```

Az implementáció eredetileg a MASTER-PROMPT-TERV 1.4 betűje szerint NEGATÍV
előjellel készült (`qₑ = ... − ∫Bᵀ D ε0 dx`), a `σ = D·(ε−ε0)` konvenciót
változatlanul hagyva (`M = EI·(κ−κ0)`). Ez a párosítás egy statikailag
HATÁROZOTT tartó (V-07: kéttámaszú, egyenletes ΔT_grad, `M ≡ 0` az elvárás)
zárt alakú ellenőrzésén **numerikusan elbukott**: a kapott nyomaték
`M = −2·EI·κ0` lett a várt `M = 0` helyett — pontosan a kétszeres eltérés,
amit egy előjelhiba okoz egy önmagára visszaható (K·v=f) lineáris rendszerben.

## Döntés

A tehervektor a **POZITÍV** előjelet kapja: `qₑ = ∫Nᵀp dx + ∫Bᵀ D ε0 dx`,
a `σ = D·(ε−ε0)` (⇒ `M = EI·(κ−κ0)`) konvenciót megtartva. Ez a MASTER-PROMPT-TERV
1.4 pontjának SZÖVEGÉTŐL eltér, de az 1.6 pontjával és a virtuális munka
elvével konzisztens — és ezt a `test/solver.test.ts` „P5 — hőteher (V-07
jellegű...)” tesztje numerikusan igazolja (M ≡ 0 gépi pontossággal, a
reakciók és az egyensúly is zérus egy statikailag határozott, tisztán
hőteherrel terhelt tartón).

## Indoklás

- A K8 kockázat („a régi diplomaterv képletei helyenként tömörek vagy
  sajtóhibásak") szerint egy ellentmondásos képletnél **meg kell állni és
  kérdezni, nem mechanikát kitalálni** — itt azonban NEM a diplomaterv eredeti
  képletéről van szó, hanem a MASTER-PROMPT-TERV (2026-os, AI-asszisztált
  tervdokumentum) SAJÁT belső ellentmondásáról a 1.4 és 1.6 pontjai között.
  A választást két FÜGGETLEN úton lehetett leellenőrizni (tankönyvi virtuális
  munka levezetés + kézzel számolt zárt alakú lehajlásprofil egy determinált
  tartóra), és mindkettő ugyanazt az előjelet adta — ez nem találgatás, hanem
  igazolt mérnöki levezetés.
- Az `M = EI·(κ−κ0)` konvenció (nem pedig a tehervektor előjelének
  megfordítás nélküli megtartása és a `+κ0` felcserélése az utófeldolgozásban)
  azért maradt rögzített, mert ez szerepel EXPLICIT alakban a
  MASTER-PROMPT-TERV 1.6 pontjában, míg a tehervektor előjele csak a
  levezetésben (1.4 pont, "Teherredukció (3.19–3.23)" fejléc alatt, konkrét
  diplomaterv-oldalszám nélkül) szerepel — így az utóbbi a kevésbé
  megalapozott forrás.

## Következmények

- `packages/fem-core/src/assembly/loadVector.ts` (`reduceThermal`) és a
  modul fejléce a pozitív előjelet dokumentálja.
- `packages/fem-core/src/solver/linearSolver.ts` (`elementResults`) a hőteher
  κ0-ját levonja az `M` számításánál (`internalForces(..., kappa0)`); a
  `kappa`/`gamma` mező VÁLTOZATLANUL a teljes geometriai alakváltozás marad.
- `linearSolver.ts` (`checkEquilibrium`) emellett kapott egy abszolút
  reziduum-küszöböt (`SELF_CHECK_TOLERANCE.equilibrium` mint padló a skálán):
  tisztán hőteherrel (valós külső erő nélkül) terhelt, determinált tartónál a
  relatív egyensúly-mérték nevezője maga is a lebegőpontos zaj szintjén van,
  ami hamis (100%-os) relatív hibát jelezne egy ténylegesen zérus abszolút
  reziduumra — ez önmagában is egy, a P5 hőteher-eset által felszínre hozott
  hiba volt, amit ugyanez a próba fedett fel és javított.
