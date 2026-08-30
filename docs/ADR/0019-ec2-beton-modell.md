# ADR-0019 — EC2 beton nemlineáris σ-ε modell a rétegelt magban

**Dátum:** 2026-08-30 · **Státusz:** ELFOGADVA ÉS MEGVALÓSÍTVA — EC2 (EN
1992-1-1) 3.1.7 parabola-téglalap tervezési görbe, PATH-INDEPENDENT
kiértékeléssel, nulla húzószilárdsággal. · **Érinti:** `fem-core`
(`material/concreteEC2.ts`, `solver/materialState.ts`)

## Kontextus

A "professzionalizálási ütemterv" (ld. memória/session-kontextus) D)
fázisában a `fem-db` anyagkatalógus megkapta a teljes EC2 3.1.7
feszültség-alakváltozás paraméterkészletet (`fck`, `epsC1`, `epsC2`,
`epsCu2`, `epsC3`, `epsCu3`, `eta`, `n`, `gammaCE`, `phiInfinity`) —
addig TISZTÁN referencia-adatként, a UI-ban megjelenítve, de a megoldó
által NEM használva. Ez az ADR a tényleges bekötést dokumentálja.

A meglévő rétegelt képlékenységi mag (`material/elastoPlastic1D.ts`,
REFORB — ld. ADR-0007/ADR-0014) egy INKREMENTÁLIS, radial-return
bilineáris (rugalmas–lineárisan keményedő) törvényt valósít meg,
ÁLLAPOTTAL (`LayerPlasticState`: `sigma`, `epsPEff`, `yielded`) a
Newton-iterációk között. Ez FIZIKAILAG NEM a beton viselkedése — a beton
nyomott ágon a KEZDETTŐL FOGVA nemlineáris (parabola), nincs éles
"folyási határ", és a szabványos tervezési σ-ε görbe egy explicit
függvénye a TELJES (nem inkrementális) alakváltozásnak.

## Modellezési döntések

1. **Húzott oldal: NULLA húzószilárdság** (repedt keresztmetszet
   feltételezése). Ez a szabványos, konzervatív egyszerűsítés, amit
   gyakorlatilag minden metszet-analízis szoftver alkalmaz ULS-szerű
   válaszszámításnál — a `fctm`/`fctk,0.05` (D) fázis) csak TÁJÉKOZTATÓ
   (repedési nyomaték becsléséhez), ebbe a törvénybe nem megy be.
2. **A projekt előjelkonvenciója** (`z` lefelé pozitív, `ε(z)=κ·z`, ld.
   `element/bMatrix.ts` és `solver/materialState.ts` `dEps = dKappa·layer.z`
   mintája) szerint pozitív `κ`-nál a `z>0` (alsó) szál HÚZOTT, a `z<0`
   (felső) szál NYOMOTT — ugyanaz a séma, amit az acél
   `sign = σ_trial≥0?1:-1` már használ. Ezért: `ε≥0` → húzás → `σ=0`;
   `ε<0` → az EC2 görbe `|ε|`-re kiértékelve, negatív előjellel.
3. **Zúzódás (`|ε| > εcu2`): σ=0, tangensE=0.** Az EC2 tervezési görbe
   `εcu2`-nél véget ér — ez a szabvány szerinti tönkremeneteli határ, nem
   extrapoláljuk túl rajta.
4. **Nincs history/memória (path-independent).** Az EC2 (3.17) parabola-
   téglalap görbe a TELJES alakváltozás explicit függvénye. Ez
   EGYSZERŰSÍTI a hívást (nincs szükség `LayerPlasticState`-re a beton
   ágon — a REFORB-hurok `updateGaussPointState()`-jében egy ÚJ,
   párhuzamos elágazás lett, nem a meglévő radial-return módosítva).
5. **ISMERT, DOKUMENTÁLT KORLÁT — tehermentesítés.** Mivel a görbe
   path-independent, tehermentesítésnél a beton UGYANAZON a görbén
   futna vissza (nincs elasztikus visszatérési ág, nincs maradó
   alakváltozás-koncepció). Monoton terhelésnél (a FEMAti fő
   üzemmódja) ez PONTOS a szabvány szerint; a meglévő "tehermentesítés"
   kapcsolónál (MASTER-PROMPT-TERV 4.2 #6) FIZIKAILAG PONTATLAN a
   betonra — ez egy tudatosan vállalt, dokumentált korlát, NEM hiba.
6. **`fck`-alapú, nem `fcd` (γc-vel osztott).** A FEMAti feladata a
   szerkezeti VÁLASZ szimulálása (elmozdulás, nyomaték-görbület), nem
   ULS tervezési kapacitás-ellenőrzés — a `γc` parciális biztonsági
   tényező tervezési fogalom, nem anyagviselkedés, ezért a görbe a
   karakterisztikus `fck`-t használja közvetlenül (a `gammaCE` mező a
   D) fázisban a rugalmassági modulus bizonytalanságához tartozik, EGY
   MÁS EC2-fogalom, nem ez).
7. **Ismert, dokumentált nuansz — kezdeti érintő-modulus.** A parabola
   ε=0-beli érintője (`fck·n/εc2`) NEM egyezik szükségszerűen
   `Material.e`-vel (Ecm) — az EC2-ben Ecm (SLS) és a parabola-téglalap
   (ULS tervezési görbe) KÜLÖN kalibrált mennyiségek, ez a szabvány
   saját jellemzője. A keresztmetszet KEZDETI (terheletlen) merevsége
   (`initialGaussPointState`) továbbra is `layer.e`-ből (Ecm) számol —
   csak az ELSŐ nemlineáris frissítéstől kezdve vált át a görbére.

## Megvalósítás

- **ÚJ modul `material/concreteEC2.ts`**: `concreteStress(eps, fck,
  epsC2, epsCu2, n)` — tiszta függvény (nincs state paraméter),
  `{ sigma, tangentE }`-t ad vissza a fenti szabályok szerint.
  `isConcreteYielded(eps, epsC2)` — segédfüggvény a `LayerPlasticState`-
  kompatibilis `yielded` mezőhöz.
- **`model/types.ts`** `Material`: `fck?`, `epsC2?`, `epsCu2?`, `n?` (E)
  fázisban már bevezetett `fy1`/`fy2`/`thicknessThreshold` mellé).
- **`solver/materialState.ts`**: `LayerMaterialData` ÚJ opcionális
  `concrete?: ConcreteLayerParams` mezővel (`elementMaterialData()`-ban
  töltődik fel, HA a réteg anyagának mind a négy EC2-paramétere adott).
  `updateGaussPointState()` rétegenkénti hurokjában: HA `layer.concrete
  !== undefined`, a `concreteStress(kappaNew * layer.z, …)` hívás
  VÁLTJA FEL a `updateLayerPlasticState()` hívást (a TELJES, nem
  inkrementális `κ·z`-ből) — az eredmény ugyanabba a `LayerPlasticState`
  alakba csomagolva, hogy a `GaussPointState.layers` típusa és minden
  hívó kód (pl. a jövőbeli keresztmetszet-inspektor) VÁLTOZATLAN
  maradjon.
- **UI-adatfolyam**: `ui/model/compile.ts` + `ui/model/nonlinear.ts` —
  már az E) fázisban előrelátóan bekötve (`mat.fck`/`epsC2`/`epsCu2`/`n`
  a `makeMaterial()` hívásba, kN/cm²→kN/m² átváltással a `fck`-ra).

## Validáció

- **`test/concreteEC2.test.ts`** (8 teszt, zárt alak): húzásnál mindig
  σ=0/tangentE=0; a csúcsponton (`ε=-εc2`) `σ=-fck` (gépi pontosság);
  a fennsíkon `σ=-fck`, `tangentE=0`; zúzódás után `σ=0`; a nyomó
  feszültség NAGYSÁGA monoton nő a parabola-szakaszon; a zárt alakú
  érintő modulus véges differenciás numerikus deriválttal egyezik
  (< 1e-4 relatív eltérés); `n=2`-nél a parabola felénél (`x=0.5`)
  `σ=-fck·0.75` zárt alakban (`1-(1-0.5)²=0.75`).
- **`test/materialState.test.ts`** (+3 teszt, modell-szintű): egy
  vasalatlan (csak beton) téglalap keresztmetszet — (1) a rétegek
  ténylegesen megkapják a `concrete` paramétereket; (2) pozitív κ-nál a
  HÚZOTT (`z>0`) rétegek feszültsége PONTOSAN 0 minden rétegen (a
  "repedt keresztmetszet" feltételezés VÉGIGELLENŐRIZVE, nem csak a
  `concreteStress()` egységszinten); (3) a görbület növelésével a
  nyomatéki válasz nagysága nő (zúzódásig).
- `pnpm check` (mind a 4 csomag) + `pnpm --filter @femati/fem-core
  coverage` tiszta.

## Nyitva maradt kérdések (jövőbeli ADR, ha szükséges)

1. **Tehermentesítési mód betonra** — a fent dokumentált korlát miatt a
   meglévő "tehermentesítés" kapcsoló betonos modelleknél félrevezető
   eredményt adhat; egy UI-figyelmeztetés (NoteBox) hozzáadása
   fontolandó, ha a felhasználó ténylegesen próbál betont
   tehermentesítési módban futtatni.
2. **Vasbeton (kompozit acél+beton réteg) még nem cél** — ez az ADR
   csak a beton ANYAGTÖRVÉNYÉT köti be; a `Layer.materialId` már ma is
   lehetővé tenné vegyes (acél betétes) rétegzést, de ehhez a UI-nak
   (szelvényszerkesztő) is támogatnia kellene a réteges vasalás-
   kiosztást — külön funkció, nem ennek az ADR-nek a hatóköre.
3. **`epsC1`/`epsC3`/`epsCu3`/`eta` (D) fázisban felvett mezők) még
   nincsenek használva** — ezek az EC2 3.1.5 (nemlineáris SLS-elemzés)
   és 3.1.7 bilineáris ALTERNATÍVA paraméterei; a jelen ADR csak a
   parabola-téglalapot (a leggyakoribb, `n`-alapú) köti be. Ha igény
   mutatkozik a bilineáris vagy a nemlineáris SLS-görbére, külön
   döntést igényel.
