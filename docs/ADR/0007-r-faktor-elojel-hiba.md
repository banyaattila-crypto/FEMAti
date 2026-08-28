# ADR-0007 — Az R-faktor képletében felcserélt tört (`elastoPlastic1D.ts`) javítása

**Dátum:** 2026-08-21 · **Státusz:** elfogadva · **Érinti:** P10 (`material/elastoPlastic1D.ts`), P12 (P-11 fem-validation eset fedte fel)

## Kontextus

A P10 fázisban (`updateLayerPlasticState`, a "még nem folyt, de átlépi a
folyási határt" ág) az R-faktort — a próba-feszültségnövekmény folyás UTÁNI
hányadát — a következőképpen számoltuk:

```ts
const distanceToYield = sign * currentLimit - state.sigma; // AB (a folyás ELŐTTI, még rugalmas szakasz)
const r = dSigmaTrial !== 0 ? distanceToYield / dSigmaTrial : 1; // AB/AC
```

Ez **AB/AC**-t (a folyás ELŐTTI hányadot) adja vissza, miközben a
`plasticStep()` ezt az `r` értéket a folyás UTÁNI (képlékeny) hányadként
használja fel (`dEpsP = r·Δε·E/(E+H')`). A két mennyiség csak a
SZIMMETRIKUS `AB = AC/2` esetben esik egybe (`AB/AC = (AC−AB)/AC = 0.5`) —
ez az oka, hogy a P10 fázis eredeti tesztjei (`elastoPlastic1D.test.ts`)
NEM buktak el: a "2×εY" teszt éppen ezt a szimmetrikus, megkülönböztetésre
alkalmatlan esetet fedte le, az "1×εY" (pontosan a folyási határra eső
próba-feszültség) teszt pedig — hibásan — `R→1`-et várt (`R→0` helyett), azaz
a teszt maga is a hibás képletet igazolta vissza.

A hiba a P12 fázis P-11 ("beállás") validációs esetében derült ki: egy
κ1-ig terhelt, majd nulla nyomatékig tehermentesített, majd κ1-ig
ÚJRATERHELT keresztmetszetnél a korábban folyt rétegek újraterhelése egy
ASZIMMETRIKUS határesetet fut be (a próba-feszültség a lépés VÉGÉN éppen a
(kitágult) folyási határra esik, `AB ≈ AC`, tehát `AB/AC ≈ 1`, miközben a
FIZIKAILAG helyes válasz `R ≈ 0`, mert a réteg a teljes lépés alatt rugalmas
volt, csak a legvégén ért a határra) — ez a hibás képlettel `epsPEff`
hamis, jelentős (≈0.0014, nem lebegőpontos zaj) növekedését okozta, holott a
"beállás" tétel szerint (klasszikus képlékenységtan) egyáltalán NEM
szabadna új képlékeny alakváltozásnak keletkeznie.

## Döntés

A helyes képlet: `R = (AC−AB)/AC = fTrial/Δσ_trial`, ahol
`fTrial = |σ_trial| − currentLimit` (a folyás UTÁNI, ténylegesen képlékeny
rész):

```ts
const fTrial = Math.abs(sigmaTrial) - currentLimit; // AC − AB
const r = dSigmaTrial !== 0 ? fTrial / Math.abs(dSigmaTrial) : 1;
```

## Indoklás

- A javítást a `elastoPlastic1D.test.ts`-ben egy ÚJ, kifejezetten
  aszimmetrikus (`dEps = 1.3·εY`) `H'>0` regressziós teszt igazolja zárt
  alakban (a zárt alakú radial-return `epsPEff`/`σ` értékével összevetve) —
  ez a teszt a régi (hibás) képlettel MEGBUKOTT volna, az újjal PONTOSAN
  egyezik.
- A meglévő "1×εY határeset" teszt elvárása `R→1`-ről `R→0`-ra változott
  (a fizikailag helyes érték), a "2×εY szimmetrikus eset" teszt
  változatlan maradt (mindkét képlettel ugyanazt az `R=0.5`-öt adja, ezért
  nem diszkriminatív — ez maga a tanulság, miért NEM elég egyetlen
  szimmetrikus teszteset egy R-faktor jellegű képlet igazolására).
- A modul fejlécének a nem-rétegelt modellel (`resultantPlastic.ts`) való
  "algebrailag egyenértékű zárt alakú radial-return" állítása a javítás
  UTÁN vált ténylegesen igazzá — a javítás előtt ez az állítás hallgatólagos
  feltételezés volt, amit csak a szimmetrikus tesztesetek "igazoltak vissza"
  (hamisan).

## Következmények

- `packages/fem-core/src/material/elastoPlastic1D.ts` — `updateLayerPlasticState()`
  javítva, fejléc-kommentje frissítve a levezetéssel.
- `packages/fem-core/test/elastoPlastic1D.test.ts` — a hibás elvárású teszt
  javítva, egy új aszimmetrikus `H'>0` regressziós teszt hozzáadva.
- A P10 fázis korábban commitolt validációs esetei (P-01…P-13 közül azok,
  amik `elastoPlastic1D.ts`-t használják) a hiba által ÉRINTETLENEK maradtak
  (mind H'=0-t, mind szimmetrikus/folytatódó-terhelés eseteket használtak,
  amikre a hibás és a helyes képlet egybeesik) — ezt a teljes
  `pnpm --filter @femati/fem-core test` és `pnpm --filter @femati/fem-validation test`
  újrafuttatása igazolja (mindegyik változatlanul zöld a javítás után).
- Ez a hiba nem a diplomaterv vagy a MASTER-PROMPT-TERV forrásában volt,
  hanem a saját (P10-es) implementációban — a K8 kockázat itt nem
  alkalmazható, ez egy szokásos kódolási hiba, amit egy KÉSŐBBI fázis
  (P12) validációs próbája fedett fel. Ez önmagában is azt igazolja, hogy a
  projekt "minden fázishoz legalább egy valódi validációs eset" elve
  (DoD 2. pont) működik: a hiba NEM a bevezetésekor, hanem egy ATÓL FÜGGETLEN,
  attól eltérő fizikai forgatókönyvet vizsgáló KÉSŐBBI teszt által derült ki.
