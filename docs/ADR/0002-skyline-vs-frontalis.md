# ADR-0002 — Skyline LDLᵀ a produkciós megoldó, a frontális algoritmus külön mód

**Dátum:** 2026-08-20 · **Státusz:** elfogadva · **Érinti:** P2, P4, P17

## Kontextus

A diplomaterv 3.1.7.3 pontja **frontális algoritmust** ír le: a kompilálás és az
elimináció nem válik szét, a számítás időigényét a rudak sorszámozása határozza
meg, és „az együtthatómátrixban mindig csak a nem zérus blokksorokat és
blokkoszlopokat tároljuk".

1996-ban ez helyes választás volt: a memória szűkös erőforrás volt, és a frontális
módszer a lemezre kiírt front mellett is működött.

## Döntés

A produkciós megoldó **skyline (profil) tárolás + LDLᵀ faktorizáció**.

A frontális algoritmus a **P17 fázisban** külön modulként készül el
(`solver/frontal.ts`), és a felületen külön nézetként jelenik meg, a front
mozgásának animációjával.

## Indoklás

1. A skyline tárolás a frontális módszer memóriaelőnyét megőrzi (a profil
   ugyanaz), miközben az implementáció lényegesen egyszerűbb és
   tesztelhetőbb — kevesebb hely a néma indexhibának.
2. A faktorizáció **nem lép ki a profilból**, tehát a kitöltődés ugyanaz, mint a
   frontális módszernél.
3. A frontális modul megtartása nem teljesítmény-, hanem **hitelességi és
   didaktikai** kérdés: a diplomaterv ezt írja le, és a front mozgása
   megmutatható. Elfogadási feltétele, hogy 1e−10 relatív pontossággal egyezzen
   a skyline eredménnyel.

## Következmények

- A `SkylineMatrix` közli a `meanBandwidth` és `storedCount` mérőszámot, hogy a
  P17 összevetése mérhető legyen.
- A `negativePivots` (tehetetlenségi szám) már most rendelkezésre áll — lineáris
  statikai feladatnál értéke 0 kell legyen.
