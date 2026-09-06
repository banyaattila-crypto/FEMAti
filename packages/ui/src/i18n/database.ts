/**
 * A `catalog/DatabaseView.tsx` (Szelvény adatbázis / Anyag adatbázis) UI-
 * szövegei — a teljes UI i18n (2026-09-05) korábban dokumentált, utolsó
 * nyitva hagyott résének pótlása (ld. memória: `project-femati-i18n-progress`).
 *
 * A katalógus-adattartalom VALÓDI kódrésze (szabványszámok/méretek, mint
 * "IPE 300", "S235", "DIN 1026-1", "⌀150") VÁLTOZATLAN marad minden
 * nyelven — ezek nemzetközi szabványkódok, fordításuk sem lehetséges, sem
 * indokolt. VISZONT a `*.source`/`*.note`/`*.name` mezőkben a kód MELLETT/
 * UTÁN álló MAGYAR SZÓ (pl. "S235 szerkezeti acél", "Kör ⌀150") EN
 * nézetben lefordítva jelenik meg (2026-09-06, felhasználói visszajelzés:
 * "amikor egy külföldi megnézi... nem érzik majd"; majd egy KÖVETKEZŐ
 * kérdésre — "a Kör, Körgyűrű, szerkezeti acél stb. direkt maradtak
 * benne?" — kiderült, hogy a `name` mezőre is ugyanez érvényes, nem csak
 * `source`/`note`-ra). Mechanizmus: `SOURCE_EN`/`NOTE_EN` TELJES-szöveg
 * lookup (`catalogText()`), `NAME_PHRASE_EN` RÉSZLETES (szórész) lookup
 * (`catalogName()`) — utóbbi azért szórész-alapú, hogy egy jövőbeli, ÚJ
 * numerikus katalógus-bejegyzés (pl. "S500 szerkezeti acél") is
 * automatikusan fordítva legyen, amint egy már ismert kifejezést használ.
 * A `fem-db` JSON-adat MAGYAR-only marad (a "tisztán adat" elv, ld.
 * `i18n/catalog.ts` fejléce, TOVÁBBRA IS érvényes — a fordítás a UI
 * rétegben történik, nem az adatban). Hiányzó fordításnál (pl. egy
 * jövőbeli, teljesen ÚJ kifejezés) a UI az EREDETI magyar szöveget mutatja
 * — sosem törik el.
 */
import { UNVERIFIED_WARNING } from '@femati/fem-db';
import type { Lang } from '../state/appStore.js';

export interface DatabaseStrings {
  readonly title: Record<'material' | 'section', string>;
  readonly searchPlaceholder: Record<'material' | 'section', string>;
  readonly noResults: string;
  readonly close: string;
  readonly navNoteMaterial: (count: number) => string;
  readonly navNoteSection: (count: number) => string;

  // ── méret-címkék (data/catalog.ts dimensionRowsFor szimbólumai) ────────
  readonly dimensionLabel: Record<string, string>;

  // ── MaterialDetail ──────────────────────────────────────────────────────
  readonly elasticModulus: string;
  readonly poissonRatio: string;
  readonly shearModulusLabel: string;
  readonly yieldStress: string;
  readonly noYieldStress: string;
  readonly hardeningModulus: string;
  readonly thermalExpansion: string;
  readonly density: string;
  readonly source: string;

  // ── SteelThicknessClass ─────────────────────────────────────────────────
  readonly steelThicknessTitle: string;
  readonly fy1Label: (threshold: number) => string;
  readonly fy2Label: (threshold: number) => string;
  readonly steelThicknessNote: string;
  readonly fireExpansionCoeff: string;

  // ── ConcreteEC2Params ────────────────────────────────────────────────────
  readonly concreteEc2Title: string;
  readonly fck: string;
  readonly fctm: string;
  readonly fctk005: string;
  readonly gammaCE: string;
  readonly phiInfinity: string;
  readonly epsC1: string;
  readonly epsC2: string;
  readonly epsCu2: string;
  readonly epsC3: string;
  readonly epsCu3: string;
  readonly eta: string;
  readonly nExponent: string;
  readonly concreteEc2Note: string;

  // ── SectionDetail ────────────────────────────────────────────────────────
  readonly dimensionsSectionTitle: string;
  readonly computedPropertiesTitle: string;
  readonly area: string;
  readonly inertia: string;
  readonly yTop: string;
  readonly yBottom: string;
  readonly elasticModulusSection: string;
  readonly elasticModulusTooltip: string;
  readonly plasticModulus: string;
  readonly shapeFactor: string;
  readonly catalogVsComputed: string;
  readonly catalogDeviation: (symbol: string) => string;
  readonly deviationNote: string;

  // ── katalógus-adat fordítás (2026-09-06) ────────────────────────────────
  readonly unverifiedWarning: string;
  /** Üres HU-ban (az eredeti a hiteles szöveg) — EN-ben jelzi, hogy ez a diplomaterv szó szerinti idézetének fordítása. */
  readonly unverifiedWarningQuoteNote: string;
}

const DIMENSION_LABEL_HU: Record<string, string> = {
  d: 'Átmérő d',
  t: 'Falvastagság t',
  h: 'Magasság h',
  b: 'Szélesség b',
  tw: 'Gerincvastagság tw',
  tf: 'Övvastagság tf',
};

const DIMENSION_LABEL_EN: Record<string, string> = {
  d: 'Diameter d',
  t: 'Wall thickness t',
  h: 'Height h',
  b: 'Width b',
  tw: 'Web thickness tw',
  tf: 'Flange thickness tf',
};

/**
 * `SectionEntry`/`MaterialEntry` `.source` mezőjének magyar → angol
 * fordítása (2026-09-06) — CSAK a 28, jelenleg ténylegesen előforduló
 * EGYEDI szöveg (125 rekord, de sok osztozik ugyanazon a mondaton). A
 * szabványkódok (pl. "MSZ EN 10025-2", pőrén, magyarázó szöveg nélkül)
 * szándékosan KIMARADNAK — azokon nincs mit fordítani, a hiányzó
 * bejegyzésnél a `catalogText()` az eredeti (már úgyis angol/nemzetközi
 * kódot tartalmazó) szöveget adja vissza változatlanul.
 */
export const SOURCE_EN: Readonly<Record<string, string>> = {
  'EN 10365 névleges méretek, emlékezetből felvéve — ELLENŐRZÉS ELŐTT NE HASZNÁLD ÉLES SZÁMÍTÁSHOZ':
    'EN 10365 nominal dimensions, entered from memory — DO NOT USE FOR ACTUAL DESIGN BEFORE VERIFICATION',
  'Eurocode / gyártói szelvénykönyv (pl. ArcelorMittal)': 'Eurocode / manufacturer section catalog (e.g. ArcelorMittal)',
  'DIN 1026-1 névleges méretek, emlékezetből felvéve — ELLENŐRZÉS ELŐTT NE HASZNÁLD ÉLES SZÁMÍTÁSHOZ':
    'DIN 1026-1 nominal dimensions, entered from memory — DO NOT USE FOR ACTUAL DESIGN BEFORE VERIFICATION',
  'DIN 1026-1 / EN 10279 névleges méretek, emlékezetből felvéve — ELLENŐRZÉS ELŐTT NE HASZNÁLD ÉLES SZÁMÍTÁSHOZ':
    'DIN 1026-1 / EN 10279 nominal dimensions, entered from memory — DO NOT USE FOR ACTUAL DESIGN BEFORE VERIFICATION',
  'paraméteres alak — nincs gyártói katalógus, a kör A/I egzakt zárt alakból számol':
    'parametric shape — no manufacturer catalog, the circle’s A/I is computed from an exact closed form',
  'paraméteres alak — nincs gyártói katalógus, a körgyűrű A/I egzakt zárt alakból számol':
    'parametric shape — no manufacturer catalog, the annulus’s A/I is computed from an exact closed form',
  'paraméteres alak — nincs gyártói katalógus, a téglalap A/I egzakt zárt alakból számol':
    'parametric shape — no manufacturer catalog, the rectangle’s A/I is computed from an exact closed form',
  'paraméteres alak — nincs gyártói katalógus, a zárt szelvény A/I egzakt zárt alakból számol':
    'parametric shape — no manufacturer catalog, the closed (hollow) section’s A/I is computed from an exact closed form',
  'paraméteres alak — nincs gyártói katalógus, a T-szelvény A/I/Wpl (aszimmetrikus súlypont, egyenlő területű semleges tengely) egzakt zárt alakból számol':
    'parametric shape — no manufacturer catalog, the T-section’s A/I/Wpl (asymmetric centroid, equal-area plastic neutral axis) is computed from an exact closed form',
  'MSZ EN 10025-4 (termomechanikusan hengerelt)': 'MSZ EN 10025-4 (thermomechanically rolled)',
  'kísérleti érték (H′ nagyságrendi becslés, nincs konkrét kísérleti forrás)':
    'experimental value (H′ order-of-magnitude estimate, no specific experimental source)',
  'MSZ EN 1992-1-1 (3.5): Ecm=22·((fck+8)/10)^0.3 GPa, fck=16 MPa — SZÁMÍTOTT érték':
    'MSZ EN 1992-1-1 (3.5): Ecm=22·((fck+8)/10)^0.3 GPa, fck=16 MPa — CALCULATED value',
  'MSZ EN 1992-1-1 (3.5): Ecm=22·((fck+8)/10)^0.3 GPa, fck=20 MPa — SZÁMÍTOTT érték':
    'MSZ EN 1992-1-1 (3.5): Ecm=22·((fck+8)/10)^0.3 GPa, fck=20 MPa — CALCULATED value',
  'MSZ EN 1992-1-1 (3.5): Ecm=22·((fck+8)/10)^0.3 GPa, fck=25 MPa — SZÁMÍTOTT érték':
    'MSZ EN 1992-1-1 (3.5): Ecm=22·((fck+8)/10)^0.3 GPa, fck=25 MPa — CALCULATED value',
  'MSZ EN 1992-1-1 (3.5): Ecm=22·((fck+8)/10)^0.3 GPa, fck=30 MPa — SZÁMÍTOTT érték':
    'MSZ EN 1992-1-1 (3.5): Ecm=22·((fck+8)/10)^0.3 GPa, fck=30 MPa — CALCULATED value',
  'MSZ EN 1992-1-1 (3.5): Ecm=22·((fck+8)/10)^0.3 GPa, fck=35 MPa — SZÁMÍTOTT érték':
    'MSZ EN 1992-1-1 (3.5): Ecm=22·((fck+8)/10)^0.3 GPa, fck=35 MPa — CALCULATED value',
  'MSZ EN 1992-1-1 (3.5): Ecm=22·((fck+8)/10)^0.3 GPa, fck=40 MPa — SZÁMÍTOTT érték':
    'MSZ EN 1992-1-1 (3.5): Ecm=22·((fck+8)/10)^0.3 GPa, fck=40 MPa — CALCULATED value',
  'MSZ EN 1992-1-1 (3.5): Ecm=22·((fck+8)/10)^0.3 GPa, fck=45 MPa — SZÁMÍTOTT érték':
    'MSZ EN 1992-1-1 (3.5): Ecm=22·((fck+8)/10)^0.3 GPa, fck=45 MPa — CALCULATED value',
  'MSZ EN 1992-1-1 (3.5): Ecm=22·((fck+8)/10)^0.3 GPa, fck=50 MPa — SZÁMÍTOTT érték':
    'MSZ EN 1992-1-1 (3.5): Ecm=22·((fck+8)/10)^0.3 GPa, fck=50 MPa — CALCULATED value',
  'MSZ EN 338 (E0,mean, ρmean) — emlékezetből felvett érték, ELLENŐRZÉS SZÜKSÉGES':
    'MSZ EN 338 (E0,mean, ρmean) — value entered from memory, VERIFICATION REQUIRED',
  'MSZ EN 10025-3 (normalizálva hengerelt), emlékezetből felvéve — ELLENŐRZÉS SZÜKSÉGES':
    'MSZ EN 10025-3 (normalized rolled), entered from memory — VERIFICATION REQUIRED',
  'MSZ EN 10088-2, emlékezetből felvéve — ELLENŐRZÉS SZÜKSÉGES': 'MSZ EN 10088-2, entered from memory — VERIFICATION REQUIRED',
  'MSZ EN 1563, emlékezetből felvéve — ELLENŐRZÉS SZÜKSÉGES': 'MSZ EN 1563, entered from memory — VERIFICATION REQUIRED',
  'MSZ EN 1999-1-1, emlékezetből felvéve — ELLENŐRZÉS SZÜKSÉGES': 'MSZ EN 1999-1-1, entered from memory — VERIFICATION REQUIRED',
  'MSZ EN 14080, emlékezetből felvéve — ELLENŐRZÉS SZÜKSÉGES': 'MSZ EN 14080, entered from memory — VERIFICATION REQUIRED',
};

/** `SectionEntry`/`MaterialEntry` `.note` mezőjének magyar → angol fordítása (2026-09-06) — a 14 jelenleg ténylegesen előforduló EGYEDI szöveg. */
export const NOTE_EN: Readonly<Record<string, string>> = {
  'A vastagságfüggő Fy2/Fu érték EN 10025-2 7. táblázata alapján, emlékezetből — ellenőrizd a tényleges lemezvastagsághoz tartozó osztályt éles tervezés előtt.':
    'The thickness-dependent Fy2/Fu value is based on EN 10025-2 Table 7, entered from memory — check the class for the actual plate thickness before final design.',
  'A vastagságfüggő Fy2/Fu érték EN 10025-4 táblázata alapján, emlékezetből — ellenőrizd a tényleges lemezvastagsághoz tartozó osztályt éles tervezés előtt.':
    'The thickness-dependent Fy2/Fu value is based on the EN 10025-4 table, entered from memory — check the class for the actual plate thickness before final design.',
  'Ecm (rövid idejű) — a diplomaterv 3.1.6.3.1 Ebt (tartós teher) igényét NEM elégíti ki automatikusan; a kúszási redukció tervezői feladat, az adatbázis nem tartalmazza. Az EC2 3.1.7 feszültség-alakváltozás paraméterei (εc1 kivételével) fck≤50 MPa-ra állandók, a φ(∞,t0) ÁLTALÁNOS, projektfüggő reprezentatív érték (RH, korrigálandó).':
    'Ecm (short-term) — does NOT automatically satisfy the thesis’s (3.1.6.3.1) Ebt (sustained-load) requirement; the creep reduction is a design task and is not included in the database. The EC2 3.1.7 stress-strain parameters (except εc1) are constant for fck≤50 MPa; φ(∞,t0) is a GENERAL, project-dependent representative value (RH-dependent, to be corrected).',
  'légszáraz (12% nedvesség) testsűrűség, E hajlításvizsgálatból (Diplomaterv 3.1.6.3.1) — a lassú alakváltozás NINCS figyelembe véve.':
    'air-dry (12% moisture) bulk density, E from a bending test (thesis 3.1.6.3.1) — creep is NOT taken into account.',
  'Ausztenites rozsdamentes acél — a Fy1/Fy2 vastagságosztályos redukció itt NEM EN 10025-2 szerinti (más szabvány, más tábla), ezért nincs megadva; a folyáshatár erősen alakváltozás-keményedő, a lineáris H′ közelítés itt durvább, mint szénacélnál.':
    'Austenitic stainless steel — the Fy1/Fy2 thickness-class reduction here does NOT follow EN 10025-2 (a different standard, a different table), so it is not given; the yield strength is strongly strain-hardening, so the linear H′ approximation is cruder here than for carbon steel.',
  "Alacsony széntartalmú ('L') változata az 1.4301-nek — kis mértékben alacsonyabb folyáshatár, jobb hegeszthetőség/korrózióállóság. Ausztenites rozsdamentes acél — a Fy1/Fy2 vastagságosztályos redukció itt NEM EN 10025-2 szerinti (más szabvány, más tábla), ezért nincs megadva; a folyáshatár erősen alakváltozás-keményedő, a lineáris H′ közelítés itt durvább, mint szénacélnál.":
    "Low-carbon ('L') variant of 1.4301 — slightly lower yield strength, better weldability/corrosion resistance. Austenitic stainless steel — the Fy1/Fy2 thickness-class reduction here does NOT follow EN 10025-2 (a different standard, a different table), so it is not given; the yield strength is strongly strain-hardening, so the linear H′ approximation is cruder here than for carbon steel.",
  "Molibdén-ötvözésű ('316' típus) — jobb korrózióállóság klorid-tartalmú/tengeri környezetben, mint az 1.4301-nél. Ausztenites rozsdamentes acél — a Fy1/Fy2 vastagságosztályos redukció itt NEM EN 10025-2 szerinti (más szabvány, más tábla), ezért nincs megadva; a folyáshatár erősen alakváltozás-keményedő, a lineáris H′ közelítés itt durvább, mint szénacélnál.":
    "Molybdenum-alloyed ('316'-type) — better corrosion resistance in chloride-containing/marine environments than 1.4301. Austenitic stainless steel — the Fy1/Fy2 thickness-class reduction here does NOT follow EN 10025-2 (a different standard, a different table), so it is not given; the yield strength is strongly strain-hardening, so the linear H′ approximation is cruder here than for carbon steel.",
  "Alacsony széntartalmú ('316L') változata az 1.4401-nek. Ausztenites rozsdamentes acél — a Fy1/Fy2 vastagságosztályos redukció itt NEM EN 10025-2 szerinti (más szabvány, más tábla), ezért nincs megadva; a folyáshatár erősen alakváltozás-keményedő, a lineáris H′ közelítés itt durvább, mint szénacélnál.":
    "Low-carbon ('316L') variant of 1.4401. Austenitic stainless steel — the Fy1/Fy2 thickness-class reduction here does NOT follow EN 10025-2 (a different standard, a different table), so it is not given; the yield strength is strongly strain-hardening, so the linear H′ approximation is cruder here than for carbon steel.",
  'Gömbgrafitos öntöttvas — rugalmassági modulusa és folyási viselkedése ÉRDEMBEN eltér a hengerelt szerkezeti acélétól; képlékenységi tartaléka korlátozott.':
    'Ductile (spheroidal graphite) cast iron — its elastic modulus and yield behavior differ SUBSTANTIALLY from rolled structural steel; its plastic reserve is limited.',
  'Nem hőkezelhető (AlMg3), edzés nélküli, félkemény (H24) állapotú ötvözet — tengeri/vegyipari korrózióállóság miatt gyakori, alacsonyabb folyáshatárú, mint a 6xxx sorozat.':
    'Non-heat-treatable (AlMg3), unhardened, half-hard (H24) temper alloy — common for marine/chemical-industry corrosion resistance, with a lower yield strength than the 6xxx series.',
  'Hőkezelt (T6), AlMg1SiCu ötvözet — a 6082-höz hasonló, széles körben elterjedt szerkezeti alumíniumötvözet.':
    'Heat-treated (T6), AlMg1SiCu alloy — similar to 6082, a widely used structural aluminum alloy.',
  'Cink-ötvözésű (AlZnMgCu1.5), nagyszilárdságú repülőgépipari alumíniumötvözet — jóval magasabb folyáshatár, de rosszabb korrózióállóság/hegeszthetőség, mint a 6xxx sorozaté.':
    'Zinc-alloyed (AlZnMgCu1.5), high-strength aerospace aluminum alloy — much higher yield strength, but worse corrosion resistance/weldability than the 6xxx series.',
  'légszáraz (12% nedvesség) testsűrűség, E hajlításvizsgálatból (Diplomaterv 3.1.6.3.1) — a lassú alakváltozás NINCS figyelembe véve. A legalacsonyabb gyakori tűlevelű szilárdsági osztály.':
    'air-dry (12% moisture) bulk density, E from a bending test (thesis 3.1.6.3.1) — creep is NOT taken into account. The lowest common softwood strength class.',
  'légszáraz (12% nedvesség) testsűrűség, E hajlításvizsgálatból (Diplomaterv 3.1.6.3.1) — a lassú alakváltozás NINCS figyelembe véve. Homogén (GL28h) ragasztott rétegelt fa, a GL24h-nál magasabb szilárdsági osztály.':
    'air-dry (12% moisture) bulk density, E from a bending test (thesis 3.1.6.3.1) — creep is NOT taken into account. Homogeneous (GL28h) glued laminated timber, a higher strength class than GL24h.',
};

/** `lang==='hu'`-nál változatlan; `'en'`-nél a megfelelő lookup-táblából fordít, hiányzó bejegyzésnél az EREDETI szöveget adja vissza (sosem törik el). */
export function catalogText(original: string, lang: Lang, translations: Readonly<Record<string, string>>): string {
  return lang === 'en' ? (translations[original] ?? original) : original;
}

/**
 * `section.name`/`material.name` mezőkben előforduló, ISMERT magyar
 * szó/kifejezés-részletek (2026-09-06) — a kódrész (IPE 300, S235, ⌀150,
 * méretek) körül/mögött álló magyar szót cseréli, magát a kódot
 * érintetlenül hagyva. TÖMB, nem `Record`, mert a SORREND számít:
 * "Körgyűrű" a "Kör" ELŐTT, mert "Kör" a "Körgyűrű" SZÓRÉSZE — ha
 * fordítva lenne, "Körgyűrű ⌀200×10"-ból hibásan "Circlegyűrű ⌀200×10"
 * lenne.
 */
export const NAME_PHRASE_EN: ReadonlyArray<readonly [hu: string, en: string]> = [
  ['szerkezeti fűrészáru (csak rugalmas)', 'structural sawn timber (elastic only)'],
  ['rag. fa (csak rugalmas)', 'glued laminated timber (elastic only)'],
  ['beton (csak rugalmas)', 'concrete (elastic only)'],
  ['nagyszilárdságú acél', 'high-strength steel'],
  ['gömbgrafitos öntöttvas', 'ductile (spheroidal graphite) cast iron'],
  ['rozsdamentes acél', 'stainless steel'],
  ['normalizált acél', 'normalized steel'],
  ['szerkezeti acél', 'structural steel'],
  ['+ keményedés (H′)', '+ hardening (H′)'],
  ['alumínium', 'aluminum'],
  ['Körgyűrű', 'Tube'],
  ['Kör', 'Circle'],
  ['Téglalap', 'Rectangle'],
  ['(U-szelvény)', '(U-section)'],
];

/** `lang==='hu'`-nál változatlan; `'en'`-nél az ISMERT magyar kifejezés-részleteket lecseréli (`NAME_PHRASE_EN`), a többit (kódok, méretek) érintetlenül hagyja. */
export function catalogName(name: string, lang: Lang): string {
  if (lang !== 'en') return name;
  return NAME_PHRASE_EN.reduce((acc, [hu, en]) => acc.replaceAll(hu, en), name);
}

export const DATABASE: Record<Lang, DatabaseStrings> = {
  hu: {
    title: { material: 'Anyag adatbázis', section: 'Szelvény adatbázis' },
    searchPlaceholder: { material: 'Anyag keresése…', section: 'Szelvény keresése…' },
    noResults: 'Nincs találat.',
    close: 'Bezárás',
    navNoteMaterial: (count) => `${count} anyag`,
    navNoteSection: (count) => `${count} szelvény`,

    dimensionLabel: DIMENSION_LABEL_HU,

    elasticModulus: 'Rugalmassági modulus E',
    poissonRatio: 'Poisson-tényező ν',
    shearModulusLabel: 'Nyírási modulus G = E/2(1+ν)',
    yieldStress: 'Folyáshatár σY',
    noYieldStress: 'Nincs megadott folyáshatár — az anyag csak rugalmas vizsgálatra alkalmas ebben a katalógusban.',
    hardeningModulus: 'Lineáris keményedés H′',
    thermalExpansion: 'Hőtágulási együttható α',
    density: 'Sűrűség ρ',
    source: 'Forrás',

    steelThicknessTitle: 'Vastagságfüggő folyáshatár-osztály (EN 10025-2)',
    fy1Label: (threshold) => `Fy1 (t ≤ ${threshold} mm)`,
    fy2Label: (threshold) => `Fy2 (t > ${threshold} mm)`,
    steelThicknessNote:
      'Referencia-adat — a megoldó jelenleg egyetlen folyáshatárt (fentebb) rendel a teljes keresztmetszethez; a vastagságosztály szerinti választás a rétegelt modellben (E) fázis) még nincs bekötve.',
    fireExpansionCoeff: 'Hőtágulási együttható tűzhatás esetén αfi',

    concreteEc2Title: 'EC2 feszültség-alakváltozás modell (EN 1992-1-1 3.1.7)',
    fck: 'Jellemző nyomószilárdság fck',
    fctm: 'Középértékű húzószilárdság fctm',
    fctk005: 'Jellemző húzószilárdság fctk,0.05',
    gammaCE: 'Rugalmassági modulus tényező γcE',
    phiInfinity: 'Végső kúszási tényező φ(∞,t0)',
    epsC1: 'Folyási határnyúlás εc1 (nemlineáris modell)',
    epsC2: 'Folyási határnyúlás εc2 (parabola-téglalap)',
    epsCu2: 'Szakadási határnyúlás εcu2 (parabola-téglalap)',
    epsC3: 'Folyási határnyúlás εc3 (bilineáris)',
    epsCu3: 'Szakadási határnyúlás εcu3 (bilineáris)',
    eta: 'Nyomószilárdság-csökkentő tényező η',
    nExponent: 'Parabola-téglalap kitevő n',
    concreteEc2Note:
      'Referencia-adat — a megoldó jelenleg a rétegelt magban egyszerű, kétegyenes (rugalmas–tökéletesen képlékeny/lineáris keményedő) törvényt használ minden rétegre; az EC2 parabola-téglalap modell tényleges bekötése (F) fázis) még nincs implementálva.',

    dimensionsSectionTitle: 'Méretek',
    computedPropertiesTitle: 'Számított jellemzők',
    area: 'Terület A',
    inertia: 'Másodrendű nyomaték I',
    yTop: 'Súlypont a felső száltól (yTop)',
    yBottom: 'Súlypont az alsó száltól (yBottom)',
    elasticModulusSection: 'Rugalmas modulus Wel = I/ymax',
    elasticModulusTooltip: 'Aszimmetrikus szelvény: ymax a KORMÁNYZÓ (nagyobb, konzervatívabb) szál — max(yTop, yBottom).',
    plasticModulus: 'Képlékeny modulus Wpl = 2S₀',
    shapeFactor: 'Alaki tényező c = Wpl/Wel',
    catalogVsComputed: 'Katalógus vs. számított',
    catalogDeviation: (symbol) => `${symbol}: katalógus / eltérés`,
    deviationNote:
      'Az eltérés a névleges kontúrból (lekerekítés nélkül) számolt és a szelvénytáblázat (gyártói, lekerekítéseket is tartalmazó) adata között — a modell mindig a számított értéket használja.',
    // A KANONIKUS (diplomaterv szó szerinti idézete) forrás — ld. `fem-db/src/index.ts` — nem duplikáljuk literálként.
    unverifiedWarning: UNVERIFIED_WARNING,
    unverifiedWarningQuoteNote: '',
  },
  en: {
    title: { material: 'Material database', section: 'Section database' },
    searchPlaceholder: { material: 'Search materials…', section: 'Search sections…' },
    noResults: 'No results.',
    close: 'Close',
    navNoteMaterial: (count) => `${count} materials`,
    navNoteSection: (count) => `${count} sections`,

    dimensionLabel: DIMENSION_LABEL_EN,

    elasticModulus: 'Elastic modulus E',
    poissonRatio: "Poisson's ratio ν",
    shearModulusLabel: 'Shear modulus G = E/2(1+ν)',
    yieldStress: 'Yield stress σY',
    noYieldStress: 'No yield stress given — this material is elastic-only in this catalog.',
    hardeningModulus: 'Linear hardening modulus H′',
    thermalExpansion: 'Thermal expansion coefficient α',
    density: 'Density ρ',
    source: 'Source',

    steelThicknessTitle: 'Thickness-dependent yield class (EN 10025-2)',
    fy1Label: (threshold) => `Fy1 (t ≤ ${threshold} mm)`,
    fy2Label: (threshold) => `Fy2 (t > ${threshold} mm)`,
    steelThicknessNote:
      'Reference data only — the solver currently assigns a single yield stress (above) to the whole cross-section; selection by thickness class in the layered model (phase E) is not wired in yet.',
    fireExpansionCoeff: 'Thermal expansion coefficient under fire, αfi',

    concreteEc2Title: 'EC2 stress-strain model (EN 1992-1-1 3.1.7)',
    fck: 'Characteristic compressive strength fck',
    fctm: 'Mean tensile strength fctm',
    fctk005: 'Characteristic tensile strength fctk,0.05',
    gammaCE: 'Elastic modulus factor γcE',
    phiInfinity: 'Final creep coefficient φ(∞,t0)',
    epsC1: 'Yield strain εc1 (nonlinear model)',
    epsC2: 'Yield strain εc2 (parabola-rectangle)',
    epsCu2: 'Ultimate strain εcu2 (parabola-rectangle)',
    epsC3: 'Yield strain εc3 (bilinear)',
    epsCu3: 'Ultimate strain εcu3 (bilinear)',
    eta: 'Strength reduction factor η',
    nExponent: 'Parabola-rectangle exponent n',
    concreteEc2Note:
      'Reference data only — the solver currently uses a simple bilinear (elastic-perfectly plastic / linear hardening) law for every layer in the layered core; the actual EC2 parabola-rectangle model (phase F) is not implemented yet.',

    dimensionsSectionTitle: 'Dimensions',
    computedPropertiesTitle: 'Computed properties',
    area: 'Area A',
    inertia: 'Second moment of area I',
    yTop: 'Centroid distance from top fiber (yTop)',
    yBottom: 'Centroid distance from bottom fiber (yBottom)',
    elasticModulusSection: 'Elastic section modulus Wel = I/ymax',
    elasticModulusTooltip: 'Asymmetric section: ymax is the GOVERNING (larger, more conservative) fiber — max(yTop, yBottom).',
    plasticModulus: 'Plastic section modulus Wpl = 2S₀',
    shapeFactor: 'Shape factor c = Wpl/Wel',
    catalogVsComputed: 'Catalog vs. computed',
    catalogDeviation: (symbol) => `${symbol}: catalog / deviation`,
    deviationNote:
      'The deviation is between the value computed from the nominal contour (no fillets) and the section table value (manufacturer data, including fillets) — the model always uses the computed value.',
    unverifiedWarning: 'The property values of the cross-sections found in the database are indicative only — verify the values before first use!',
    unverifiedWarningQuoteNote:
      'This warning is translated from the original 1996 Hungarian thesis text (p. 42) for readability — the Hungarian wording remains authoritative.',
  },
};
