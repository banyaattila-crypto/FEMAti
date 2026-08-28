# ADR-0014 — Fiber-réteg szélesség: középponti mintavétel helyett terület-megőrző almintavételezés

**Dátum:** 2026-08-22 · **Státusz:** elfogadva, javítva · **Érinti:** `material/layeredSection.ts` (`generateLayers`)

## Kontextus

Külső felülvizsgálat (a felhasználó által megküldött, egy IPE300 konzolra
készült levezetés-dokumentum áttekintése) azt állította, hogy a rétegelt
(fiber) keresztmetszeti modell 16 réteggel számított területe (74,89 cm²)
és inerciája (12188 cm⁴) ~39%, illetve ~46%-kal nagyobb a szelvénytáblázat
értékeinél (53,80 cm² / 8356 cm⁴).

A vizsgálat megerősítette: ez **valódi hiba**, nem félreértés. A
`generateLayers()` minden réteg szélességét (`b`) a réteg **geometriai
KÖZÉPPONTJÁBAN** egyetlen `contourWidth(shape, z)` mintavétellel határozta
meg. Ez FOLYTONOS és a rétegen belül GYAKORLATILAG ÁLLANDÓ kontúrnál
(`rect`) ártalmatlan, de egy TÖRÉSPONTOS kontúrnál (`i-profile` gerinc/öv
átmenet) durván félrevezető, ha egy réteg éppen átnyúlik a törésponton: a
teljes réteg-vastagsághoz a középpontban mért (esetlegesen a szélesebb
tartományból vett) szélesség rendelődik.

Konkrétan: IPE300 (h=300, b=150, tw=7,1, tf=10,7 mm), 16 réteg → rétegenként
18,75 mm. A gerinc/öv határ (hw/2=139,3 mm) nem esik rétegvastagság-
többszörösére, ezért a 2 legszélső réteg átnyúlik rajta. Ezek középpontja
(140,625 mm) az övbe esik → a régi kód a TELJES 150 mm-es övszélességet
rendelte a teljes 18,75 mm-es rétegvastagsághoz, holott abból csak ~10,7 mm
valódi öv, a többi (~8,05 mm) gerinc (7,1 mm széles). Mivel ez a 2 réteg a
legnagyobb karlejtésű (outermost), a hatásuk az inerciára aránytalanul nagy.

**A hiba számokkal, MÉRVE (nem elméletben):**

| | Régi (középponti minta) | Zárt alak (`geometricProperties`) | Hiba |
|---|---|---|---|
| Terület | 74,89 cm² | 51,88 cm² (fillet nélkül) / 53,80 cm² (katalógus) | +44% / +39% |
| Inercia | 12188 cm⁴ | 7999 cm⁴ (fillet nélkül) / 8356 cm⁴ (katalógus) | +52% / +46% |

A meglévő tesztkészletnek volt egy VAK FOLTJA erre az esetre: az
`layeredSection.test.ts` I-szelvényes tesztje szándékosan (bár nem
tudatosan hibakeresési céllal) olyan rétegszámot (30) választott, amely
PONTOSAN illeszkedik a gerinc/öv határra — így a hibás eset (átnyúló réteg)
sosem futott le a tesztek alatt. A P-13 validációs eset rétegszám-
konvergenciát csak `rect()`/`circle()`/`tube()` alakokra ellenőrzött —
mindhárom FOLYTONOS kontúrú, ahol a régi módszer nem hibás.

## Döntés

A `generateLayers()` minden réteg szélességét mostantól **terület-megőrző
almintavételezéssel** (`SUBSAMPLES = 200` alpont/réteg) számítja:

```
A_l = Σ b(zk)·Δz     (a csík VALÓDI területe a kontúrfüggvényből)
b_l = A_l / t        (effektív, terület-megőrző szélesség)
```

A réteg `z` (középvonal) mezője TUDATOSAN VÁLTOZATLAN maradt (a geometriai
középpont, nem a szélesség szerint súlyozott súlypont) — ld. Indoklás.

## Indoklás

1. **A hiba dominánsan a SZÉLESSÉGBEN van, nem a `z`-ben.** A terület-
   megőrző szélesség-átlagolás egymagában a mért hibát 44%-ról **0,07%-ra**
   csökkenti (terület), és 52%-ról **4,6%-ra** (inercia) — utóbbi a
   fennmaradó, MÁSODRENDŰ hatás abból, hogy egy átnyúló rétegnél a
   szélesség-súlyozott súlypont kicsit eltér a geometriai középponttól.
2. **A `z`-t szándékosan NEM korrigáltuk** a szélesség szerint súlyozott
   súlypontra, két okból: (a) a hézag-/átfedésmentesség ellenőrzése
   (`model/validate.ts` `checkLayers()`, és a `layeredSection.test.ts`
   "hézag- és átfedésmentesen" tesztje) ARRA az invariánsra épül, hogy
   `z ± t/2` mindig pontosan a réteg geometriai határa — ezt megsértve a
   validáció hamis pozitív hibát jelezne egy valójában helyes rétegzésre;
   (b) a `z`-korrekció hatása kimutathatóan (mérve: kör alakon próbálva)
   MÁSODRENDŰ, és pontosan ugyanaz a hatás, amit a már létező, dokumentált
   `includeLayerOwnInertia` opció (alapértelmezés: ki) tudatosan elhanyagol
   — nincs értelme egy már ismert, elfogadott egyszerűsítést itt máshogy
   kezelni.
3. **Miért 200 almintavétel, nem analitikus (szakaszonkénti) integrálás?**
   Egy analitikus megoldás (a törésponti `z`-t megkeresve, a réteget ott
   szétvágva) alakonként külön logikát igényelne (`i-profile`-nál a
   gerinc/öv határ, másik alaknál esetleg más töréspont) — a numerikus
   almintavételezés ALAK-FÜGGETLEN, egyetlen, egyszerű, könnyen tesztelhető
   kód, és mivel ez a rétegzés-generálás EGYSZERI, modellépítéskori
   művelet (nem a Newton-iteráció forró hurokja), a 200×rétegszám extra
   `contourWidth()`-hívás számítási költsége elhanyagolható.

## Következmények

- Minden JÖVŐBELI, rétegelt keresztmetszetű, nem-illeszkedő rétegszámú
  I/U-szelvény modell (a leggyakoribb valós eset — a rétegszám ritkán
  esik pontosan a gerinc/öv határra) mostantól helyes A/I értéket ad.
- ÚJ regressziós teszt (`layeredSection.test.ts`, "VALÓDI, felhasználó
  jelentette hiba") kifejezetten a nem-illeszkedő (átnyúló réteges) esetet
  fedi le — mutációs próbával igazolva: `SUBSAMPLES = 1`-re visszaállítva a
  teszt élesen elbukik (44,3%-os hibát mér), a javítással zöld.
- A `deriveElementStiffness` — `buildLoadVector` "bit-azonosság" teszt
  (`derivation.test.ts`) egy ide kapcsolódó, VÁRT mellékhatásként enyhén
  módosult: az önsúly-teher a (most helyes) területet használja, ami az
  ELŐZŐ (hibás) terület-értékhez képest más lebegőpontos kerekítési utat ad
  — a teszt EGZAKT (`toEqual`) bit-azonosságról gépi pontosságú
  (`toBeCloseTo(...,10)`) összevetésre módosult, mert két FÜGGETLEN
  összegzési sorrend lebegőpontosan nem garantáltan asszociatív (ADR-0008
  már korábban is dokumentálta, hogy a szigorú bit-azonosság csak bizonyos
  esetekre garantált, másokra "gépi pontosságig").
- A P-13 (`fem-validation`) rétegszám-konvergencia eset (`rect`/`circle`/
  `tube` alakon) VÁLTOZATLAN maradt — ezekre a fix hatása nulla (folytonos,
  gyakorlatilag állandó kontúr egy rétegen belül).
