/**
 * A bal (`panels/LeftPanel.tsx`) és jobb (`panels/RightPanel.tsx`) panel,
 * valamint a keresztmetszet-inspektor (`panels/CrossSectionInspector.tsx`)
 * felhasználó felé mutatkozó szövegei — a teljes UI i18n (2026-09-05)
 * 2. fázisa.
 *
 * ISMERT, TUDATOS RÉS: az `optimizeResult.kindLabel` (`model/optimize.ts`,
 * a `data/catalog.ts` `SECTION_KIND_GROUP`-jából) és a katalógus-eredetű
 * `UNVERIFIED_WARNING`/`material.source`/`section.source` szövegek NEM
 * ide tartoznak — az előbbi a 4. fázisban (`data/catalog.ts` UI-feliratok)
 * válik nyelv-függővé, az utóbbiak a `fem-db` csomag adattartalma, ami
 * explicit felhasználói döntés alapján KÍVÜL esik ezen az i18n-körön.
 */
import type { Lang } from '../state/appStore.js';
import type { SupportType } from '../model/editable.js';
import type { UtilizationVerdictCode } from '../format/utilization.js';

export const SUPPORT_TYPE_LABEL: Record<Lang, Record<SupportType, string>> = {
  hu: { fixed: 'befogás', pinned: 'csuklós', roller: 'görgős', spring: 'rugós' },
  en: { fixed: 'fixed', pinned: 'pinned', roller: 'roller', spring: 'spring' },
};

export const VERDICT_LABEL: Record<Lang, Record<UtilizationVerdictCode, string>> = {
  hu: { ok: 'megfelel a határértéknek', exceeded: 'túllépi a határt', unknown: '—' },
  en: { ok: 'meets the limit', exceeded: 'exceeds the limit', unknown: '—' },
};

export interface PanelsStrings {
  // ── LeftPanel: panel/kártya-keret ──────────────────────────────────
  readonly panelAria: string;
  readonly modelTreeCardTitle: string;
  readonly treeGeometryLabel: string;
  readonly treeMaterialLabel: string;
  readonly treeSectionLabel: string;
  readonly treeMeshLabel: string;
  readonly treeSolverLabel: string;
  readonly elementsValue: (n: number) => string;
  readonly newtonLabel: string;
  readonly modNewtonLabel: string;

  // ── LeftPanel: Támaszok/Ágyazások/Terhek listák ────────────────────
  readonly supportsCardTitle: string;
  readonly noSupports: string;
  readonly foundationsCardTitle: string;
  readonly loadsCardTitle: string;
  readonly noLoads: string;
  readonly loadKindLabel: Record<'point' | 'moment' | 'distributed' | 'distributed-moment', string>;

  // ── LeftPanel: kijelölt elem szerkesztő lapja ──────────────────────
  readonly selectedSupportCardTitle: string;
  readonly supportTypeAria: string;
  readonly dzCheckbox: string;
  readonly dPhiCheckbox: string;
  readonly deleteSupportBtn: string;
  readonly selectedFoundationCardTitle: string;
  readonly foundationNoTensionCheckbox: string;
  readonly deleteFoundationBtn: string;
  readonly selectedLoadCardTitle: string;
  readonly loadCategoryAria: string;
  readonly loadCategoryPermanent: string;
  readonly loadCategoryPermanentTitle: string;
  readonly loadCategoryVariable: string;
  readonly loadCategoryVariableTitle: string;
  readonly deleteLoadBtn: string;
  readonly rangeStart: (symbol: string, unit: string) => string;
  readonly rangeEnd: (symbol: string, unit: string) => string;
  readonly dzLabel: (unit: string) => string;
  readonly dPhiMradLabel: string;

  // ── LeftPanel: Keresztmetszet kártya ────────────────────────────────
  readonly sectionCardTitle: string;
  readonly layeredNote: string;
  readonly parametricNote: string;
  readonly materialSourceNote: (name: string, source: string) => string;
  readonly sectionSourceNote: (name: string, source: string) => string;
  readonly rebarCheckbox: string;
  readonly rebarBottomLabel: (unit: string) => string;
  readonly rebarTopLabel: (unit: string) => string;
  readonly coverLabel: (unit: string) => string;
  readonly rebarUlsNote: string;
  readonly compositeCheckbox: string;
  readonly slabWidthLabel: (unit: string) => string;
  readonly slabThicknessLabel: (unit: string) => string;
  readonly slabMaterialAria: string;
  readonly compositeEiNote: (compositeEI: string, steelEI: string) => string;
  readonly compositeWarnNote: string;
  readonly optimizeButton: string;
  readonly optimizeProposal: (name: string, area: string, unit: string, utilStr: string) => string;
  readonly optimizeApplyButton: string;
  readonly optimizeNoneFound: (kindLabel: string, count: number) => string;
  readonly optimizeRebarNote: string;

  // ── LeftPanel: Megoldó kártya ────────────────────────────────────────
  readonly solverCardTitle: string;
  readonly solverAlgorithmAria: string;
  readonly newtonTitle: string;
  readonly modNewtonTitle: string;
  readonly loadStepLabel: (value: string) => string;
  readonly toleranceLabel: (value: string) => string;
  readonly peakLambdaLabel: (value: string) => string;
  readonly selfWeightCheckbox: string;
  readonly thermalCheckbox: string;
  readonly tRefLabel: (unit: string) => string;
  readonly tTopLabel: (unit: string) => string;
  readonly tBottomLabel: (unit: string) => string;
  readonly axialForceLabel: (value: string, unit: string) => string;
  readonly pDeltaNote: (compression: boolean) => string;
  readonly movingLoadCheckbox: string;
  readonly movingLoadMagnitudeLabel: (unit: string) => string;
  readonly movingLoadNote: string;
  readonly showGaussCheckbox: string;
  readonly dofCountText: (n: number) => string;
  readonly nonlinearAlwaysLayeredNote: string;

  // ── RightPanel ──────────────────────────────────────────────────────
  readonly resultsCardTitle: string;
  readonly wMaxLabel: string;
  readonly errorEstimateLabel: string;
  readonly errorEstimateTitle: string;
  readonly dofLabel: string;
  readonly reactionsCardTitle: string;
  readonly liftOffNote: (n: number) => string;
  readonly sumFzCheckLabel: string;
  readonly sumFzTitle: (reactFz: string, loadsFz: string, sumFz: string) => string;
  readonly sumMyCheckLabel: string;
  readonly sumMyTitle: (reactMy: string, loadsMy: string, sumMy: string) => string;
  readonly ultimateCardTitle: string;
  readonly ulsSlsNote: string;
  readonly elasticCapacityLabel: string;
  readonly elasticCapacityTitle: string;
  readonly plasticCapacityLabel: string;
  readonly plasticCapacityTitle: string;
  readonly shapeFactorLabel: string;
  readonly shearCapacityLabel: string;
  readonly shearCapacityTitle: string;
  readonly mvUtilLabel: string;
  readonly mvUtilTitle: string;
  readonly verdictLabel: string;
  readonly deflectionUtilLabel: string;
  readonly deflectionUtilTitle: string;
  readonly crackingUtilLabel: string;
  readonly crackingUtilTitle: string;
  readonly crackingVerdictTitle: string;
  readonly rcUlsCapacityLabel: string;
  readonly rcUlsCapacityTitle: string;
  readonly rcUlsUtilLabel: string;
  readonly rcUlsUtilTitle: string;
  readonly computedLoadFactorLabel: string;
  readonly computedLoadFactorTitle: string;
  readonly notRunnablePrefix: (message: string) => string;
  readonly noComputableModel: string;

  // ── CrossSectionInspector ───────────────────────────────────────────
  readonly inspectorTitleNoData: string;
  readonly inspectorCloseAria: string;
  readonly noLayerData: string;
  readonly inspectorTitle: (elementId: string, gaussIndex: number, xApprox: string | null) => string;
  readonly inspectorCloseTitle: string;
  readonly unloadingTag: string;
  readonly layerProfileSectionTitle: string;
  readonly layerProfileSvgAria: string;
  readonly neutralAxisText: (z: string) => string;
  readonly neutralAxisOutsideText: string;
  readonly layerLegendElastic: string;
  readonly layerLegendPartial: string;
  readonly layerLegendPlastic: string;
  readonly mkCurveSectionTitle: string;
  readonly mkCurveSvgAria: string;
  readonly residualSectionTitle: string;
  readonly residualAxialText: (v: string) => string;
  readonly residualMomentText: (v: string) => string;
}

export const PANELS: Record<Lang, PanelsStrings> = {
  hu: {
    panelAria: 'Modell és megoldó',
    modelTreeCardTitle: 'Modellfa',
    treeGeometryLabel: 'Geometria',
    treeMaterialLabel: 'Anyag',
    treeSectionLabel: 'Szelvény',
    treeMeshLabel: 'Háló',
    treeSolverLabel: 'Megoldó',
    elementsValue: (n) => `${n} elem`,
    newtonLabel: 'Newton',
    modNewtonLabel: 'mód. Newton',

    supportsCardTitle: 'Támaszok',
    noSupports: 'Nincs támasz.',
    foundationsCardTitle: 'Ágyazások',
    loadsCardTitle: 'Terhek',
    noLoads: 'Nincs teher.',
    loadKindLabel: {
      point: 'pontteher',
      moment: 'nyomatékteher',
      distributed: 'megoszló teher',
      'distributed-moment': 'megoszló nyomatékteher',
    },

    selectedSupportCardTitle: 'Kijelölt támasz',
    supportTypeAria: 'Támasz típusa',
    dzCheckbox: 'előírt süllyedés (dz)',
    dPhiCheckbox: 'előírt elfordulás (dφ)',
    deleteSupportBtn: 'Támasz törlése',
    selectedFoundationCardTitle: 'Kijelölt ágyazat',
    foundationNoTensionCheckbox: 'no-tension (csak nyomásra dolgozik)',
    deleteFoundationBtn: 'Ágyazat törlése',
    selectedLoadCardTitle: 'Kijelölt teher',
    loadCategoryAria: 'Teher kategóriája',
    loadCategoryPermanent: 'állandó (G)',
    loadCategoryPermanentTitle: 'ULS-nél γG = 1,35-tel szorozva',
    loadCategoryVariable: 'esetleges (Q)',
    loadCategoryVariableTitle: 'ULS-nél γQ = 1,5-tel szorozva',
    deleteLoadBtn: 'Teher törlése',
    rangeStart: (symbol, unit) => `${symbol} (kezdet) [${unit}]`,
    rangeEnd: (symbol, unit) => `${symbol} (vég) [${unit}]`,
    dzLabel: (unit) => `dz (süllyedés) [${unit}]`,
    dPhiMradLabel: 'dφ (elfordulás) [mrad]',

    sectionCardTitle: 'Keresztmetszet',
    layeredNote:
      'A rétegelt modell A és I értéke a valós kontúrból számítódik, ezért kis mértékben eltér a szelvénytáblázat lekerekítéseket is tartalmazó adataitól.',
    parametricNote: 'Parametrikus keresztmetszet: A és I a megadott méretekből számítódik.',
    materialSourceNote: (name, source) => ` Anyag (${name}): ${source}.`,
    sectionSourceNote: (name, source) => ` Szelvény (${name}): ${source}.`,
    rebarCheckbox: 'vasalás (ULS teherbírás-ellenőrzéshez)',
    rebarBottomLabel: (unit) => `alsó vasalás Aₛ [${unit}]`,
    rebarTopLabel: (unit) => `felső vasalás Aₛ' [${unit}]`,
    coverLabel: (unit) => `fedés c [${unit}]`,
    rebarUlsNote:
      'ULS-teherbírás: egyszerűsített téglalap feszültségblokk (EC2 3.1.7(3)), B500B betonacél, γ=1.0 (jellemző érték) — ld. jobb panel "Vasbeton ULS" sor.',
    compositeCheckbox: 'kompozit keresztmetszet (acél + betonlemez)',
    slabWidthLabel: (unit) => `lemez szélesség b [${unit}]`,
    slabThicknessLabel: (unit) => `lemez vastagság t [${unit}]`,
    slabMaterialAria: 'Betonlemez anyaga',
    compositeEiNote: (compositeEI, steelEI) => `Kompozit EI = ${compositeEI} MNm² (acél alapszelvény önmagában: ${steelEI} MNm²)`,
    compositeWarnNote:
      'Csak rugalmas (SLS) viselkedésre érvényes — teljes nyírt kapcsolat feltételezve. ULS-teherbírás-ellenőrzés és nemlineáris (F5) elemzés kompozit szelvényre még nem elérhető.',
    optimizeButton: 'Legkisebb megfelelő szelvény keresése',
    optimizeProposal: (name, area, unit, utilStr) => `Javaslat: ${name} (A = ${area} ${unit}, kihasználtság ${utilStr})`,
    optimizeApplyButton: 'Alkalmaz',
    optimizeNoneFound: (kindLabel, count) => `Nincs megfelelő szelvény ebben a családban (${kindLabel}, ${count} jelölt megvizsgálva).`,
    optimizeRebarNote: 'A vasalás mennyisége minden jelöltnél változatlan maradt — Alkalmazás után érdemes ellenőrizni/finomítani.',

    solverCardTitle: 'Megoldó',
    solverAlgorithmAria: 'Megoldó algoritmus',
    newtonTitle: 'KT minden iterációban újraszámolva',
    modNewtonTitle: 'KT teherlépcsőnként egyszer — a diplomaterv 10. oldalának lábjegyzete',
    loadStepLabel: (value) => `Teherlépcső Δλ = ${value}`,
    toleranceLabel: (value) => `Tolerancia ${value} %`,
    peakLambdaLabel: (value) => `Csúcs-teherszorzó λ_cél = ${value}`,
    selfWeightCheckbox: 'önsúly figyelembevétele',
    thermalCheckbox: 'hőteher figyelembevétele',
    tRefLabel: (unit) => `tRef (feszültségmentes hőmérséklet) [${unit}]`,
    tTopLabel: (unit) => `tTop (felső szél) [${unit}]`,
    tBottomLabel: (unit) => `tBottom (alsó szél) [${unit}]`,
    axialForceLabel: (value, unit) => `axiális erő N = ${value} ${unit} (P-Δ)`,
    pDeltaNote: (compression) =>
      `Másodrendű (P-Δ) hatás: ${compression ? 'nyomóerő' : 'húzóerő'} — csak a fő M/T/w/φ diagramokra és az SLS lehajlásra hat. Kihajlási/kritikus teher ellenőrzés és nemlineáris (F5) elemzés N≠0 mellett még nem elérhető.`,
    movingLoadCheckbox: 'mozgó teher (burkolóábra)',
    movingLoadMagnitudeLabel: (unit) => `mozgó pontteher P [${unit}]`,
    movingLoadNote:
      'A "burkolóábra" diagram-fülön látható a lehetséges legnagyobb/legkisebb M/T minden keresztmetszetre, ahogy ez a teher végigsétál a tartón (a meglévő állandó terhekkel együtt). Jellemző (nem faktorozott) teherre — több egyidejű tengelyteher (tengelycsoport) nincs ebben a körben.',
    showGaussCheckbox: 'Gauss-pontok megjelenítése',
    dofCountText: (n) => `${n} szabadságfok`,
    nonlinearAlwaysLayeredNote:
      'A nemlineáris futtatás (SZÁMÍTÁS / F5) mindig a rétegelt keresztmetszeti modellel fut — ez adja a keresztmetszet-inspektor rétegenkénti adatait.',

    resultsCardTitle: 'Eredmények',
    wMaxLabel: 'w max (lehajlás)',
    errorEstimateLabel: 'hibabecslő (legrosszabb elem)',
    errorEstimateTitle: 'Az elemhatárokon az átlagolás előtti igénybevétel-ugrás, a mező szélsőértékére normálva (Diplomaterv 3.1.7.4)',
    dofLabel: 'szabadságfokok',
    reactionsCardTitle: 'Reakciók · egyensúly',
    liftOffNote: (n) => `${n} elem felemelkedett a no-tension ágyazatról (ADR-0022) — ott az ágyazat pillanatnyilag nem fejt ki erőt.`,
    sumFzCheckLabel: 'ΣFz ellenőrzés',
    sumFzTitle: (reactFz, loadsFz, sumFz) => `ΣFz = Σreakciók + Σterhek = ${reactFz} + ${loadsFz} = ${sumFz} kN (elvileg 0)`,
    sumMyCheckLabel: 'ΣMy ellenőrzés',
    sumMyTitle: (reactMy, loadsMy, sumMy) =>
      `ΣMy (az x=0 origóra) = Σreakciók nyomatéka + Σterhek nyomatéka = ${reactMy} + ${loadsMy} = ${sumMy} kNm (elvileg 0)`,
    ultimateCardTitle: 'Határteher-ellenőrzés',
    ulsSlsNote:
      'Az ellenőrzések ULS (1,35·G+1,5·Q) / SLS (G+Q) kombinációra futnak (EN 1990) — a fenti "Eredmények" kártya w/φ/M/T max sorai ettől függetlenül a jellemző (nem faktorozott) terhet mutatják.',
    elasticCapacityLabel: 'rugalmas teherbírás Mₑ',
    elasticCapacityTitle: 'σY · Kₑ — csak akkor számítható, ha az anyagnak van folyáshatára',
    plasticCapacityLabel: 'képlékeny teherbírás Mₚ',
    plasticCapacityTitle: 'σY · Kₚ — elméleti, keresztmetszet-szintű teherbírás',
    shapeFactorLabel: 'alaki tényező c = Mₚ/Mₑ',
    shearCapacityLabel: 'képlékeny nyíróerő-teherbírás Vpl',
    shearCapacityTitle: 'Vpl = κs·A·σY/√3 — az effektív nyírási területből (κs·A), NEM a szabvány Av-jéből (ADR-0018)',
    mvUtilLabel: 'M-V kihasználtság (EN 1993-1-1)',
    mvUtilTitle:
      'EN 1993-1-1 6.2.8 stílusú, UTÓLAGOS ellenőrzés a globális M-max és T-max értékekből, γM0 = 1.00 (ajánlott érték) — ha nem azonos keresztmetszeti helyen lépnek fel, ez egy KONZERVATÍV (biztonság felé téves) becslés, nem pontos helyi érték (ADR-0018, ADR-0021)',
    verdictLabel: 'verdikt',
    deflectionUtilLabel: 'lehajlás-ellenőrzés (SLS, L/250)',
    deflectionUtilTitle: 'w max / L a megengedett L/250 arányhoz viszonyítva — anyagfüggetlen, a felhasználó saját ökölszabálya szerinti SLS-ellenőrzés',
    crackingUtilLabel: 'repedési nyomaték Mcr kihasználtsága (EC2, tájékoztató)',
    crackingUtilTitle:
      "M_cr = fctm·Kₑ — TÁJÉKOZTATÓ, SLS-jellegű jelzés arról, mikor lép túl a modell a rugalmas (repedésmentes) tartományon. Ez ÖNMAGÁBAN nem vasbeton ULS teherbírás-ellenőrzés — az a lenti 'Vasbeton ULS' sorban jelenik meg, ha a vasalás be van kapcsolva (ADR-0019, ADR-0021)",
    crackingVerdictTitle:
      "'túllépi a határt' itt azt jelenti: a keresztmetszet elméletileg berepedt — a rugalmas merevségi feltevés innentől nem érvényes, NEM azt, hogy a tartó tönkremegy",
    rcUlsCapacityLabel: 'vasbeton ULS teherbírás MRd',
    rcUlsCapacityTitle:
      'Egyszerűsített téglalap feszültségblokk (EC2 3.1.7(3)), jellemző (γ=1.0) érték, B500B betonacél — a húzott oldal a globális M előjelétől függ',
    rcUlsUtilLabel: 'Vasbeton ULS kihasználtság',
    rcUlsUtilTitle:
      '|M-max| / MRd — a globális M-max/M-min szélsőértékre, NEM feltétlenül a legkritikusabb keresztmetszetre (konzervatív becslés, mint a többi ULS-ellenőrzésnél)',
    computedLoadFactorLabel: 'számított teherszorzó (nemlineáris)',
    computedLoadFactorTitle: "A runLoadStepper által ténylegesen elért λ — 'limit-load-reached' esetén a numerikus határteher közelítése",
    notRunnablePrefix: (message) => `A modell jelenleg nem futtatható: ${message}`,
    noComputableModel: 'Nincs számítható modell (nincsenek elemek vagy támaszok).',

    inspectorTitleNoData: 'Keresztmetszet-inspektor',
    inspectorCloseAria: 'Keresztmetszet-inspektor bezárása',
    noLayerData: 'Nincs réteg-adat ehhez a Gauss-ponthoz.',
    inspectorTitle: (elementId, gaussIndex, xApprox) =>
      `Keresztmetszet-inspektor — ${elementId}, Gauss-pont ${gaussIndex}/3${xApprox !== null ? ` (x ≈ ${xApprox} m)` : ''}`,
    inspectorCloseTitle: 'Bezárás (Esc)',
    unloadingTag: 'tehermentesítés',
    layerProfileSectionTitle: 'Rétegenkénti σ-profil (a keresztmetszet magassága mentén)',
    layerProfileSvgAria: 'Rétegenkénti feszültségprofil, hőtérkép-kitöltéssel',
    neutralAxisText: (z) => `semleges tengely: z ≈ ${z} mm`,
    neutralAxisOutsideText: 'semleges tengely a szélső rétegen kívül esik (a teljes szelvény egy előjelű feszültségű)',
    layerLegendElastic: 'rugalmas',
    layerLegendPartial: 'részben képlékeny',
    layerLegendPlastic: 'képlékeny',
    mkCurveSectionTitle: 'M–κ görbe (a teljes tehertörténetre)',
    mkCurveSvgAria: 'M-kappa görbe',
    residualSectionTitle: 'Maradó (saját)feszültségek egyensúlya',
    residualAxialText: (v) => `Σ σ·b·Δz (axiális erő) = ${v} kN — elvileg 0`,
    residualMomentText: (v) => `Σ σ·z·b·Δz (nyomaték) = ${v} kNm — egyezik a fent kiírt M-mel`,
  },

  en: {
    panelAria: 'Model and solver',
    modelTreeCardTitle: 'Model tree',
    treeGeometryLabel: 'Geometry',
    treeMaterialLabel: 'Material',
    treeSectionLabel: 'Section',
    treeMeshLabel: 'Mesh',
    treeSolverLabel: 'Solver',
    elementsValue: (n) => `${n} element${n === 1 ? '' : 's'}`,
    newtonLabel: 'Newton',
    modNewtonLabel: 'mod. Newton',

    supportsCardTitle: 'Supports',
    noSupports: 'No supports.',
    foundationsCardTitle: 'Foundations',
    loadsCardTitle: 'Loads',
    noLoads: 'No loads.',
    loadKindLabel: {
      point: 'point load',
      moment: 'moment load',
      distributed: 'distributed load',
      'distributed-moment': 'distributed moment load',
    },

    selectedSupportCardTitle: 'Selected support',
    supportTypeAria: 'Support type',
    dzCheckbox: 'prescribed settlement (dz)',
    dPhiCheckbox: 'prescribed rotation (dφ)',
    deleteSupportBtn: 'Delete support',
    selectedFoundationCardTitle: 'Selected foundation',
    foundationNoTensionCheckbox: 'no-tension (compression only)',
    deleteFoundationBtn: 'Delete foundation',
    selectedLoadCardTitle: 'Selected load',
    loadCategoryAria: 'Load category',
    loadCategoryPermanent: 'permanent (G)',
    loadCategoryPermanentTitle: 'Multiplied by γG = 1.35 at ULS',
    loadCategoryVariable: 'variable (Q)',
    loadCategoryVariableTitle: 'Multiplied by γQ = 1.5 at ULS',
    deleteLoadBtn: 'Delete load',
    rangeStart: (symbol, unit) => `${symbol} (start) [${unit}]`,
    rangeEnd: (symbol, unit) => `${symbol} (end) [${unit}]`,
    dzLabel: (unit) => `dz (settlement) [${unit}]`,
    dPhiMradLabel: 'dφ (rotation) [mrad]',

    sectionCardTitle: 'Cross-section',
    layeredNote:
      'The layered model computes A and I from the actual contour, so they differ slightly from the section-table values, which also include rounding.',
    parametricNote: 'Parametric cross-section: A and I are computed from the given dimensions.',
    materialSourceNote: (name, source) => ` Material (${name}): ${source}.`,
    sectionSourceNote: (name, source) => ` Section (${name}): ${source}.`,
    rebarCheckbox: 'reinforcement (for ULS capacity check)',
    rebarBottomLabel: (unit) => `bottom reinforcement Aₛ [${unit}]`,
    rebarTopLabel: (unit) => `top reinforcement Aₛ' [${unit}]`,
    coverLabel: (unit) => `cover c [${unit}]`,
    rebarUlsNote:
      'ULS capacity: simplified rectangular stress block (EC2 3.1.7(3)), B500B reinforcing steel, γ=1.0 (characteristic value) — see the "RC ULS" row in the right panel.',
    compositeCheckbox: 'composite cross-section (steel + concrete slab)',
    slabWidthLabel: (unit) => `slab width b [${unit}]`,
    slabThicknessLabel: (unit) => `slab thickness t [${unit}]`,
    slabMaterialAria: 'Concrete slab material',
    compositeEiNote: (compositeEI, steelEI) => `Composite EI = ${compositeEI} MNm² (steel base section alone: ${steelEI} MNm²)`,
    compositeWarnNote:
      'Valid only for elastic (SLS) behavior — assumes full shear connection. ULS capacity check and nonlinear (F5) analysis are not yet available for composite sections.',
    optimizeButton: 'Find smallest adequate section',
    optimizeProposal: (name, area, unit, utilStr) => `Suggestion: ${name} (A = ${area} ${unit}, utilization ${utilStr})`,
    optimizeApplyButton: 'Apply',
    optimizeNoneFound: (kindLabel, count) => `No adequate section found in this family (${kindLabel}, ${count} candidates checked).`,
    optimizeRebarNote: 'The reinforcement amount stayed the same for every candidate — worth checking/refining after applying.',

    solverCardTitle: 'Solver',
    solverAlgorithmAria: 'Solver algorithm',
    newtonTitle: 'Stiffness matrix recomputed every iteration',
    modNewtonTitle: 'Stiffness matrix once per load step — per the thesis, page 10 footnote',
    loadStepLabel: (value) => `Load step Δλ = ${value}`,
    toleranceLabel: (value) => `Tolerance ${value} %`,
    peakLambdaLabel: (value) => `Peak load factor λ_target = ${value}`,
    selfWeightCheckbox: 'include self-weight',
    thermalCheckbox: 'include thermal load',
    tRefLabel: (unit) => `tRef (stress-free temperature) [${unit}]`,
    tTopLabel: (unit) => `tTop (top fiber) [${unit}]`,
    tBottomLabel: (unit) => `tBottom (bottom fiber) [${unit}]`,
    axialForceLabel: (value, unit) => `axial force N = ${value} ${unit} (P-Δ)`,
    pDeltaNote: (compression) =>
      `Second-order (P-Δ) effect: ${compression ? 'compressive force' : 'tensile force'} — affects only the main M/T/w/φ diagrams and the SLS deflection. Buckling/critical load check and nonlinear (F5) analysis with N≠0 are not yet available.`,
    movingLoadCheckbox: 'moving load (envelope)',
    movingLoadMagnitudeLabel: (unit) => `moving point load P [${unit}]`,
    movingLoadNote:
      'The "envelope" diagram tab shows the largest/smallest possible M/T at every cross-section as this load travels along the beam (together with the existing permanent loads). For a characteristic (unfactored) load — several simultaneous axle loads (an axle group) are not covered in this round.',
    showGaussCheckbox: 'Show Gauss points',
    dofCountText: (n) => `${n} degree${n === 1 ? '' : 's'} of freedom`,
    nonlinearAlwaysLayeredNote:
      'The nonlinear run (COMPUTE / F5) always uses the layered cross-section model — this is what feeds the cross-section inspector\'s per-layer data.',

    resultsCardTitle: 'Results',
    wMaxLabel: 'w max (deflection)',
    errorEstimateLabel: 'error estimate (worst element)',
    errorEstimateTitle: "The pre-averaging jump in internal force at element boundaries, normalized to the field's extreme value (Thesis 3.1.7.4)",
    dofLabel: 'degrees of freedom',
    reactionsCardTitle: 'Reactions · equilibrium',
    liftOffNote: (n) => `${n} element${n === 1 ? '' : 's'} lifted off the no-tension foundation (ADR-0022) — the foundation currently exerts no force there.`,
    sumFzCheckLabel: 'ΣFz check',
    sumFzTitle: (reactFz, loadsFz, sumFz) => `ΣFz = Σreactions + Σloads = ${reactFz} + ${loadsFz} = ${sumFz} kN (theoretically 0)`,
    sumMyCheckLabel: 'ΣMy check',
    sumMyTitle: (reactMy, loadsMy, sumMy) =>
      `ΣMy (about the x=0 origin) = Σreaction moments + Σload moments = ${reactMy} + ${loadsMy} = ${sumMy} kNm (theoretically 0)`,
    ultimateCardTitle: 'Ultimate capacity check',
    ulsSlsNote:
      'These checks run on the ULS (1.35·G+1.5·Q) / SLS (G+Q) combination (EN 1990) — the w/φ/M/T max rows in the "Results" card above independently show the characteristic (unfactored) load.',
    elasticCapacityLabel: 'elastic capacity Mₑ',
    elasticCapacityTitle: 'σY · Kₑ — only computable if the material has a yield strength',
    plasticCapacityLabel: 'plastic capacity Mₚ',
    plasticCapacityTitle: 'σY · Kₚ — theoretical, cross-section-level capacity',
    shapeFactorLabel: 'shape factor c = Mₚ/Mₑ',
    shearCapacityLabel: 'plastic shear capacity Vpl',
    shearCapacityTitle: "Vpl = κs·A·σY/√3 — from the effective shear area (κs·A), NOT the code's Av (ADR-0018)",
    mvUtilLabel: 'M-V utilization (EN 1993-1-1)',
    mvUtilTitle:
      "An EN 1993-1-1 6.2.8-style POST-HOC check from the global M-max and T-max values, γM0 = 1.00 (recommended value) — if they don't occur at the same cross-section, this is a CONSERVATIVE (safe-sided) estimate, not an exact local value (ADR-0018, ADR-0021)",
    verdictLabel: 'verdict',
    deflectionUtilLabel: 'deflection check (SLS, L/250)',
    deflectionUtilTitle: "w max / L relative to the allowed L/250 ratio — material-independent, an SLS check per the user's own rule of thumb",
    crackingUtilLabel: 'cracking moment Mcr utilization (EC2, informative)',
    crackingUtilTitle:
      "M_cr = fctm·Kₑ — INFORMATIVE, an SLS-style signal for when the model exceeds the elastic (uncracked) range. This is NOT itself an RC ULS capacity check — that appears in the 'RC ULS' row below, if reinforcement is enabled (ADR-0019, ADR-0021)",
    crackingVerdictTitle:
      "'exceeds the limit' here means the cross-section has theoretically cracked — the elastic stiffness assumption is no longer valid beyond this point, NOT that the beam fails",
    rcUlsCapacityLabel: 'RC ULS capacity MRd',
    rcUlsCapacityTitle:
      'Simplified rectangular stress block (EC2 3.1.7(3)), characteristic (γ=1.0) value, B500B reinforcing steel — the tension side depends on the sign of the global M',
    rcUlsUtilLabel: 'RC ULS utilization',
    rcUlsUtilTitle:
      "|M-max| / MRd — for the global M-max/M-min extremes, NOT necessarily the most critical cross-section (a conservative estimate, like the other ULS checks)",
    computedLoadFactorLabel: 'computed load factor (nonlinear)',
    computedLoadFactorTitle: "The λ actually reached by runLoadStepper — for 'limit-load-reached', the numerical approximation of the ultimate load",
    notRunnablePrefix: (message) => `The model cannot currently be run: ${message}`,
    noComputableModel: 'No computable model (no elements or supports).',

    inspectorTitleNoData: 'Cross-section inspector',
    inspectorCloseAria: 'Close cross-section inspector',
    noLayerData: 'No layer data for this Gauss point.',
    inspectorTitle: (elementId, gaussIndex, xApprox) =>
      `Cross-section inspector — ${elementId}, Gauss point ${gaussIndex}/3${xApprox !== null ? ` (x ≈ ${xApprox} m)` : ''}`,
    inspectorCloseTitle: 'Close (Esc)',
    unloadingTag: 'unloading',
    layerProfileSectionTitle: 'Layer-by-layer σ profile (along the cross-section height)',
    layerProfileSvgAria: 'Layer-by-layer stress profile, heatmap-filled',
    neutralAxisText: (z) => `neutral axis: z ≈ ${z} mm`,
    neutralAxisOutsideText: 'the neutral axis falls outside the outermost layer (the whole section has one-signed stress)',
    layerLegendElastic: 'elastic',
    layerLegendPartial: 'partially plastic',
    layerLegendPlastic: 'plastic',
    mkCurveSectionTitle: 'M–κ curve (over the full load history)',
    mkCurveSvgAria: 'M-kappa curve',
    residualSectionTitle: 'Residual (self-)stress equilibrium',
    residualAxialText: (v) => `Σ σ·b·Δz (axial force) = ${v} kN — theoretically 0`,
    residualMomentText: (v) => `Σ σ·z·b·Δz (moment) = ${v} kNm — matches the M shown above`,
  },
};
