/**
 * A `catalog/DatabaseView.tsx` (Szelvény adatbázis / Anyag adatbázis) UI-
 * szövegei — a teljes UI i18n (2026-09-05) korábban dokumentált, utolsó
 * nyitva hagyott résének pótlása (ld. memória: `project-femati-i18n-progress`).
 *
 * A katalógus-adattartalom (anyag-/szelvénynevek, `*.source`, `*.note`)
 * NEM tartozik ide, explicit felhasználói döntés alapján (ld.
 * `i18n/catalog.ts` fejléc-kommentje) — csak a fejlécek, mezőcímkék és
 * disclaimer-szövegek fordítása.
 */
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
  },
};
