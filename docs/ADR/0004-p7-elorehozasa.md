# ADR-0004 — A P7 (felület) előrehozása a P2–P6 elé

**Dátum:** 2026-08-20 · **Státusz:** elfogadva · **Érinti:** a fázissorrend

## Kontextus

A MASTER-PROMPT-TERV 5. fejezete kimondja: „Ne ugorj fázist", és a 7. fejezet
K10 kockázata kifejezetten erre figyelmeztet:

> *„A UI elviszi a fókuszt a magról. Ellenintézkedés: a P0–P6 fázis kizárólag
> mag; az első felületi elem csak validált lineáris mag után jön."*

A megrendelő (a projekt domain-tulajdonosa) ezzel szemben azt kérte, hogy a
design terv és a felület váza készüljön el először, mert „menet közben nehéz
lesz módosítani, ez nem egy sima weblap".

## Döntés

A P7 (felület váza) **a P2 előtt** elkészült, a DESIGN-TERV.md rögzítésével együtt.

## Indoklás

A megrendelő érve erősebb a K10 kockázatnál, két okból:

1. Egy CAE-felület elrendezése és rajzolási szabályai valóban nehezen
   módosíthatók utólag: a koordináta-transzformáció, a rajzjelek és a
   számformázás mélyen beépül a komponensekbe.
2. A design-prototípus (`design/vem-core.js`) **visszahatott a mag
   specifikációjára**: kiderült, hogy a `LinearResult`-nak tartalmaznia kell az
   `equilibrium`, `errorEstimate` és `props` mezőket, amit az eredeti P4 prompt
   nem írt elő. Ha a felület a mag után készül, ez a hiány csak a P7-ben derült
   volna ki, és a P4 újraírását igényelte volna.

## A K10 kockázat kezelése

A felület **egyetlen kitalált számot sem jelenít meg**:

- minden eredménymező `—` értéket mutat, amíg a mag nem elérhető;
- a SZÁMÍTÁS gomb nem szimulál futást, hanem közli, hogy a mag még nem kész;
- a modellvászon csak azt rajzolja, ami valós adat (geometria, támaszok,
  terhek), deformált alakot nem.

Ez a DESIGN-TERV 1.7 elvének („a felület nem számol") közvetlen alkalmazása.

## Következmények

- A P2 fázis a felület után folytatódott, és **teljes egészében elkészült**
  (166 teszt, 97.8% lefedettség, mutációs próbával igazolva).
- A P4 promptja módosult a `LinearResult` kötelező mezőivel.
- A további fázisok az eredeti sorrendet követik: P3 → P4 → P5 → P6.
