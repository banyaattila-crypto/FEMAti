/**
 * A levezetés-hármas (`derivation/DerivationView.tsx` — képernyő,
 * `derivation/docxExport.ts` + `derivation/derivationExportData.ts` —
 * Word-export) KÖZÖS felirat-forrása — a teljes UI i18n (2026-09-05) 5b.
 * fázisa, a legkockázatosabb lépés: a két kimenet korábban EGYMÁSTÓL
 * FÜGGETLENÜL, kétszer tartalmazta ugyanazt a ~25 szakaszcímet és a
 * kísérő prózát — ez a fájl egyesíti azokat, hogy a jövőben ne
 * csússzanak el egymástól (ugyanaz az elv, mint a `formulaLatex.ts`
 * KaTeX/OOXML-közös LaTeX-sorainál, ld. annak fejléce).
 *
 * A `formulaLatex.ts` SAJÁT, belső `\text{...}` szótára (Gauss-pont,
 * Csomópont, réteg stb. — a LaTeX-sorokba ágyazva) NEM ide tartozik,
 * mert azt MINDKÉT kimenet (KaTeX-render ÉS Word-képletobjektum) a
 * `lang` paraméteren át, közvetlenül a forrásban kapja — ld. annak
 * fejléce. Ez a fájl a LaTeX-sorok KÖRÜLI prózát/táblázat-fejléceket
 * fordítja.
 *
 * A támasztípus-feliratot az `i18n/panels.ts` `SUPPORT_TYPE_LABEL`-je, a
 * lábléc szövegét az `i18n/report.ts` `footerNote`-ja, a képlékeny
 * csukló-fajtát pedig a `i18n/report.ts` `hingeKindLabel`-je adja —
 * szándékosan NEM duplikáljuk újra itt (egy jelentés/levezetés ne
 * mondjon mást, mint a másik).
 */
import type { Lang } from '../state/appStore.js';

export interface DerivationStrings {
  // ── Eszközsor + fejléc ──────────────────────────────────────────────
  readonly derivedElementLabel: string;
  readonly close: string;
  readonly exportWord: string;
  readonly printSave: string;
  readonly title: string;
  readonly versionLabel: (version: string, commit: string) => string;

  // ── 1. Feladat ──────────────────────────────────────────────────────
  readonly section1Title: string;
  readonly spanLabel: string;
  readonly elementCountLabel: string;
  readonly integrationLabel: string;
  readonly integrationSelective: string;
  readonly integrationFull: string;
  readonly sectionLabel: string;
  readonly sectionSourceSuffixUnverified: (source: string) => string;
  readonly sectionSourceSuffixVerified: (source: string) => string;
  readonly materialLabel: string;
  readonly materialElastic: string;
  readonly materialSummary: (eValue: string, sigmaYText: string, source: string) => string;
  readonly supportHeader: string;
  readonly xHeader: string;
  readonly typeHeader: string;
  readonly loadHeader: string;
  readonly valueHeader: string;

  // ── 2. Keresztmetszet ───────────────────────────────────────────────
  readonly section2Title: string;
  readonly layeredIntro: (n: number) => string;
  readonly meMpNoteElastic: (materialName: string, shapeFactor: string) => string;
  readonly sectionTableDeviation: (aCat: string, devA: string, iCat: string, devI: string) => string;
  readonly deviationLarge: (layerCount: number, layerThickness: string) => string;
  readonly deviationSmall: string;

  // ── 3. Végeselem-felosztás ──────────────────────────────────────────
  readonly section3Title: string;
  readonly elementLengthLabel: string;
  readonly nodeCountLabel: string;
  readonly dofLabel: string;
  readonly dofPerNodeSuffix: string;
  readonly activeDofLabel: string;
  readonly nodeHeader: string;
  readonly dofHeader: string;

  // ── 4. Egy választott elem teljes levezetése ─────────────────────────
  readonly section4Title: (elementId: string) => string;
  readonly section4Intro: (x1: string, x2: string, x3: string, length: string, scheme: string) => string;
  readonly section4_1Title: string;
  readonly jacobianNote: string;
  readonly section4_2Title: string;
  readonly bendingRowLabel: string;
  readonly section4_3Title: (shearPointCount: number) => string;
  readonly shearRowLabel: string;
  readonly section4_4Title: string;
  readonly section4_5Title: string;
  readonly keIntro: (shearPointCount: number) => string;
  readonly section4_6Title: string;
  readonly section4_7Title: string;
  readonly noDirectLoad: string;
  readonly distributedLoadHeading: (label: string, loadId: string, pointCount: number) => string;
  readonly distributedForceLabel: string;
  readonly distributedMomentLabel: string;
  readonly selfWeightLabel: string;
  readonly nodalForceHeading: (loadId: string) => string;
  readonly nodalMomentHeading: (loadId: string) => string;
  readonly thermalLoadHeading: string;
  readonly thermalKappa0Note: (kappa0: string) => string;
  readonly summationHeading: string;

  // ── 4A. Tömegmátrix-levezetés ─────────────────────────────────────────
  readonly section4ATitle: (elementId: string) => string;
  readonly section4AIntro: string;
  readonly section4A_1Title: string;
  readonly wRowLabel: string;
  readonly phiRowLabel: string;
  readonly section4A_2Title: string;
  readonly section4A_2Intro: string;
  readonly section4A_3Title: string;

  // ── 5. Kompilálás és megoldás ─────────────────────────────────────────
  readonly section5Title: string;
  readonly section5_1Title: (elementId: string) => string;
  readonly assemblyIntro: (n1: number, n2: number, n3: number) => string;
  readonly localDofHeader: string;
  readonly nodeShortHeader: string;
  readonly roleHeader: string;
  readonly globalDofHeader: string;
  readonly assemblyNote: (keValue: string, target: string) => string;
  readonly section5_2Title: string;
  readonly prescriptionHeader: string;
  readonly springOnlyLabel: string;
  readonly eliminationNote: (total: number, active: number) => string;
  readonly penaltyNote: string;
  readonly section5_3Title: string;
  readonly globalMatrixSizeLabel: string;
  readonly globalMatrixSizeValue: (dof: number, active: number) => string;
  readonly bandwidthLabel: string;
  readonly solverMethodLabel: string;
  readonly solverMethodValue: string;
  readonly selfCheckLabel: string;
  readonly selfCheckValue: (ok: number, total: number, warningSuffix: string) => string;
  readonly selfCheckWarningSuffix: (n: number) => string;
  readonly displacementsIntro: (elementId: string) => string;
  readonly displacementsNote: string;

  // ── 6. Eredmények és ellenőrzések ─────────────────────────────────────
  readonly section6Title: string;
  readonly section6_1Title: string;
  readonly section6_1Intro: string;
  readonly kappa0Note: (kappa0: string) => string;
  readonly section6_2Title: (elementId: string) => string;
  readonly gaussPointHeader: string;
  readonly momentHeader: string;
  readonly shearHeader: string;
  readonly elementErrorNote: (pct: string) => string;
  readonly section6_3Title: string;
  readonly section6_3Intro: string;
  readonly extrapLeftNode: string;
  readonly extrapRightNode: string;
  readonly sumFzLabel: string;
  readonly sumMyLabel: string;
  readonly noReferenceNote: string;

  // ── 7. Képlékeny számítás ─────────────────────────────────────────────
  readonly section7Title: string;
  readonly stepLogTitle: string;
  readonly stepHeader: string;
  readonly lambdaHeader: string;
  readonly iterationsHeader: string;
  readonly psiNormHeader: string;
  readonly fNormHeader: string;
  readonly finalResidualHeader: string;
  readonly convergenceFormulaTitle: string;
  readonly convergenceFormulaIntro: string;
  readonly noPlasticSample: string;
  readonly plasticSampleTitle: (elementId: string, gaussIndex: number, xSuffix: string, stepIndex: number) => string;
  readonly plasticSampleXSuffix: (x: string) => string;
  readonly plasticSampleExtreme: string;
  readonly layerHeader: string;
  readonly zHeader: string;
  readonly prevStressHeader: string;
  readonly dEpsHeader: string;
  readonly trialStressHeader: string;
  readonly rHeader: string;
  readonly newStressHeader: string;
  readonly yieldedHeader: string;
  readonly yesWord: string;
  readonly noWord: string;
  readonly hingeSequenceTitle: string;
  readonly hingeIndexHeader: string;
  readonly hingeEventHeader: string;
  readonly hingeElementHeader: string;
  readonly hingeXHeader: string;
  readonly noPlasticZone: string;
  readonly runConverged: (lambda: string) => string;
  readonly runLimitLoad: (lambda: string) => string;
  readonly runDiverged: string;
  readonly noNonlinearRun: string;

  // ── Táblázat-fejlécek, amiket a Feladat-táblák is használnak ─────────
  readonly propertyHeader: string;
  readonly valueGenericHeader: string;

  readonly strategyLabelElimination: string;
  readonly strategyLabelPenalty: string;
}

export const DERIVATION: Record<Lang, DerivationStrings> = {
  hu: {
    derivedElementLabel: 'Levezetett elem',
    close: 'Bezárás',
    exportWord: 'Export: Word (.docx)',
    printSave: 'Nyomtatás / PDF mentése',
    title: 'FEM@ti — Levezetés',
    versionLabel: (version, commit) => `v${version} · mag: ${commit}`,

    section1Title: '1. Feladat',
    spanLabel: 'Fesztáv L',
    elementCountLabel: 'Elemszám',
    integrationLabel: 'Integrálási séma',
    integrationSelective: 'szelektív redukált',
    integrationFull: 'teljes',
    sectionLabel: 'Szelvény',
    sectionSourceSuffixUnverified: (source) => ` — ${source}`,
    sectionSourceSuffixVerified: (source) => ` (forrás: ${source})`,
    materialLabel: 'Anyag',
    materialElastic: '— (rugalmas)',
    materialSummary: (eValue, sigmaYText, source) => `E = ${eValue} kN/cm², σY = ${sigmaYText} — forrás: ${source}`,
    supportHeader: 'Támasz',
    xHeader: 'x [m]',
    typeHeader: 'Típus',
    loadHeader: 'Teher',
    valueHeader: 'Jellemző',

    section2Title: '2. Keresztmetszet',
    layeredIntro: (n) =>
      `A rétegelt (fiber) modell ${n} egyenlő vastagságú csíkra osztja a keresztmetszetet, a kontúrszélességet minden csík KÖZÉPVONALÁBAN mintavételezve (Diplomaterv 3.4.3, (3.54)).`,
    meMpNoteElastic: (materialName, shapeFactor) =>
      `Az anyagnak (${materialName}) nincs megadott folyáshatára (σY) — a katalógusban "csak rugalmas" jelöléssel szerepel. Emiatt Mₑ és Mₚ NEM értelmezhető (nem 0, hanem definiálatlan); csak a rugalmas keresztmetszeti jellemzők (A, I, Wₑ, Wₚ) számottevők ennél az anyagnál. A c = Wₚ/Wₑ alaki tényező a σY-tól függetlenül, tisztán geometriai mennyiség, ezért az továbbra is érvényes: c = ${shapeFactor}.`,
    sectionTableDeviation: (aCat, devA, iCat, devI) => `Szelvénytáblázat: A = ${aCat} cm² (eltérés ${devA}%), I = ${iCat} cm⁴ (eltérés ${devI}%) — `,
    deviationLarge: (layerCount, layerThickness) =>
      `JELENTŐS eltérés: ${layerCount} rétegnél a rétegvastagság (${layerThickness} mm) meghaladja az öv vastagságát, ezért a középponti mintavétel az első/utolsó rétegnél a teljes övszélességet a valós övnél vastagabb sávra vetíti ki (a P-13 validációs eset szerint ez a hiba 64 rétegnél 1% alá csökken — ld. docs/THEORY.md).`,
    deviationSmall: 'a rétegelt modell középponti mintavétele miatt kis mértékben eltér a lekerekítéseket is tartalmazó katalógusadattól.',

    section3Title: '3. Végeselem-felosztás',
    elementLengthLabel: 'Elemhossz',
    nodeCountLabel: 'Csomópontok száma',
    dofLabel: 'Szabadságfokok',
    dofPerNodeSuffix: '(2 DOF/csomópont: w, φ)',
    activeDofLabel: 'Aktív szabadságfokok',
    nodeHeader: 'Csomópont',
    dofHeader: 'DOF (w, φ)',

    section4Title: (elementId) => `4. A(z) ${elementId} elem teljes levezetése`,
    section4Intro: (x1, x2, x3, length, scheme) =>
      `Csomópontok: x₁ = ${x1} m, x₂ = ${x2} m, x₃ = ${x3} m — hossz L_e = ${length} m. Integrálási séma: ${scheme}.`,
    section4_1Title: '4.1 Jacobi (a leképezés minden ξ-ben azonos, mert az elem egyenes és a középső csomópont pontosan a felezőpontban van)',
    jacobianNote:
      '(A dN/dξ-ből fentebb csak a B1 Gauss-pont értékét használtuk — J minden ξ-re ugyanezt adja, mert az elem egyenes és a középső csomópont pontosan a felezőpontban van.)',
    section4_2Title: '4.2 Hajlítási tag — 3 pontos Gauss-integrálás, MINDEN pont TELJES, behelyettesített levezetése',
    bendingRowLabel: 'κ-sor (B)',
    section4_3Title: (shearPointCount) => `4.3 Nyírási tag — ${shearPointCount} pontos Gauss-integrálás, MINDEN pont TELJES levezetése`,
    shearRowLabel: 'γ-sor (B)',
    section4_4Title: '4.4 D anyagmátrix',
    section4_5Title: '4.5 Kₑ integrálás — konkrét, ellenőrizhető példa egy mátrixelemre',
    keIntro: (shearPointCount) =>
      `A Kₑ minden eleme az öt Gauss-pont (3 hajlítási + ${shearPointCount} nyírási) hozzájárulásának ÖSSZEGE: Kₑ = Σ (tényező · Bᵀ·B). Az alábbi példa ezt egyetlen, teljesen kiírt mátrixelemre mutatja be, amely mindkét tagból kap járulékot:`,
    section4_6Title: '4.6 A 6×6 Kₑ mátrix végső alakja',
    section4_7Title: '4.7 Elemi tehervektor (λ = 1) — terhenkénti, TELJES levezetés',
    noDirectLoad: 'Erre az elemre nem hat közvetlen teher (a q_e = 0 vektor helyes).',
    distributedLoadHeading: (label, loadId, pointCount) =>
      `${label} (${loadId}) — q_e = ∫Nᵀ·p dx, ${pointCount} pontos Gauss-integrálással a teher és az elem tartományának metszetén`,
    distributedForceLabel: 'Megoszló erő',
    distributedMomentLabel: 'Megoszló nyomaték',
    selfWeightLabel: 'Önsúly',
    nodalForceHeading: (loadId) => `Koncentrált csomóponti erő (${loadId})`,
    nodalMomentHeading: (loadId) => `Koncentrált csomóponti nyomaték (${loadId})`,
    thermalLoadHeading: 'Hőteher (κ₀-ból) — q_e = +∫Bᵀ·D·ε₀ dx (ADR-0006 előjel)',
    thermalKappa0Note: (kappa0) => `κ₀ = ${kappa0} 1/m`,
    summationHeading: 'Összegzés',

    section4ATitle: (elementId) => `4A. A(z) ${elementId} elem tömegmátrix-levezetése (ADR-0016)`,
    section4AIntro:
      'A tömegmátrix mindkét tagja (transzlációs m\', forgási tehetetlenség m\'ᵩ) AZONOS, teljes (3 pontos Gauss) kvadratúrával integrálódik — nincs szelektív séma, ellentétben a merevségi mátrixszal (ld. elementMass dokumentációja). Csak VÉGEREDMÉNY: a sajátérték-megoldás (Jacobi-forgatás) NEM kap lépésenkénti animált nézetet (ld. ADR-0016 "UI-integráció" szakasz) — ez a pont az elem-szintű tömegmátrix-összeállítás, nem a modális megoldás.',
    section4A_1Title: '4A.1 Gauss-pontok — N alakfüggvények és a w/φ DOF-helyekre szórt sorok (nRows)',
    wRowLabel: 'w-sor (N_w)',
    phiRowLabel: 'φ-sor (N_φ)',
    section4A_2Title: '4A.2 Mₑ integrálás — konkrét, ellenőrizhető példa két mátrixelemre',
    section4A_2Intro:
      'A Mₑ w-blokkja és φ-blokkja EGYMÁSTÓL FÜGGETLEN (nincs w–φ kereszttag, ld. nRows() dokumentációja) — az alábbi példa ezért KÉT KÜLÖN, teljesen kiírt mátrixelemre mutatja be az összegzést, egyet-egyet mindkét tagból:',
    section4A_3Title: '4A.3 A 6×6 Mₑ mátrix végső alakja',

    section5Title: '5. Kompilálás és megoldás',
    section5_1Title: (elementId) => `5.1 Összeszerelés — hova kerül a(z) ${elementId} elem Kₑ-je a globális mátrixban?`,
    assemblyIntro: (n1, n2, n3) =>
      `Csomópont-sorszámok a modellben (0-tól): ${n1}, ${n2}, ${n3} — a globális DOF index minden csomópontra 2·i (w) és 2·i+1 (φ), ld. assembly/dofMap.ts.`,
    localDofHeader: 'Lokális DOF',
    nodeShortHeader: 'Csomópont',
    roleHeader: 'Szerep',
    globalDofHeader: 'Globális DOF',
    assemblyNote: (keValue, target) =>
      `Az összeszerelés szabálya: K_global[I,J] += Kₑ[i,j] minden (i,j) lokális párra, ahol I,J a fenti táblázat szerinti globális DOF. Például a Kₑ[φ₁,φ₁] = ${keValue} (ld. 4.5/4.6 pont) a K_global[${target}] helyre kerül HOZZÁADVA (nem felülírva — más elemek is adhatnak járulékot ugyanoda, ha osztoznak ezen a csomóponton).`,
    section5_2Title: '5.2 Peremfeltétel-kezelés',
    prescriptionHeader: 'Előírás',
    springOnlyLabel: '(csak rugó)',
    eliminationNote: (total, active) =>
      `Eliminációs stratégia: a fenti előírt DOF-ok KIMARADNAK a megoldandó rendszerből — a teljes ${total} DOF-ból ${active} marad aktív (ismeretlen).`,
    penaltyNote: 'Penalty stratégia: az előírt DOF-ok egy nagy merevségű "rugóval" kényszerítve maradnak a rendszerben.',
    section5_3Title: '5.3 A megoldott rendszer és a kiválasztott elem elmozdulásai',
    globalMatrixSizeLabel: 'Globális mátrix mérete',
    globalMatrixSizeValue: (dof, active) => `${dof} × ${dof} (aktív: ${active})`,
    bandwidthLabel: 'Profil (átlagos sávszélesség)',
    solverMethodLabel: 'Megoldás módszere',
    solverMethodValue: 'K_active·d_active = f_active, Skyline LDLᵀ direkt megoldó (ADR-0002)',
    selfCheckLabel: 'Önellenőrzés (selfCheck)',
    selfCheckValue: (ok, total, warningSuffix) => `${ok}/${total} ellenőrzés rendben${warningSuffix}`,
    selfCheckWarningSuffix: (n) => `, ${n} figyelmeztetés`,
    displacementsIntro: (elementId) =>
      `A megoldásból (d = K⁻¹·f) kiolvasott elmozdulások a(z) ${elementId} elem 3 csomópontjára, uₑ = [w₁,φ₁,w₂,φ₂,w₃,φ₃]:`,
    displacementsNote:
      'Ez a vektor a 6. pontban κ = B_κ·uₑ és γ = B_γ·uₑ formában adja az igénybevételt — a híd a "megoldás" (ez a pont) és az "eredmény" (6. pont) között.',

    section6Title: '6. Eredmények és ellenőrzések',
    section6_1Title: '6.1 Igénybevétel-visszaszámítás — κ = B_κ·uₑ, γ = B_γ·uₑ, M = EI·(κ−κ₀), T = GAs·γ',
    section6_1Intro:
      'A csomóponti elmozdulásokból (5.3 pont, uₑ) az elem BÁRMELY ξ pontjában visszaszámítható a görbület (κ) és nyírási szögtorzulás (γ) — az alábbiakban ugyanabban a 3 pontban (STRESS_POINTS = GAUSS_3), ahol a szelvény ténylegesen M/T-t szolgáltat a diagramhoz.',
    kappa0Note: (kappa0) => `κ₀ = ${kappa0} 1/m (hőteher kezdeti görbülete, ld. 4.7 pont) — ezért M képlete κ−κ₀-t használ, nem önmagában κ-t.`,
    section6_2Title: (elementId) => `6.2 A(z) ${elementId} elem Gauss-ponti igénybevétele → csomóponti extrapoláció (Diplomaterv 3.1.7.4)`,
    gaussPointHeader: 'Gauss-pont',
    momentHeader: 'M [kNm]',
    shearHeader: 'T [kN]',
    elementErrorNote: (pct) =>
      `Elemhatáron a szomszédos elemek extrapolált értékét átlagoljuk, a köztük mért ugrás adja az elemenkénti hibajelzőt (jelenleg ${pct}%) — ld. docs/THEORY.md 6. pont.`,
    section6_3Title: '6.3 Gauss-pont → csomópont extrapoláció — a másodfokú (Lagrange-) képlet behelyettesítve',
    section6_3Intro:
      'A 3 Gauss-pont (ξ₁,ξ₂,ξ₃) M-értékén átfektetett másodfokú polinomot kiértékelve ξ=−1-ben és ξ=+1-ben kapjuk az elem SAJÁT (még nem szomszéd-átlagolt) csomóponti extrapolált értékét — ξ=0-ban ez triviálisan a középső Gauss-pont saját értéke (ld. extrapolation.ts fejléce).',
    extrapLeftNode: 'bal csp.',
    extrapRightNode: 'jobb csp.',
    sumFzLabel: 'ΣFz (egyensúly)',
    sumMyLabel: 'ΣMy (egyensúly)',
    noReferenceNote:
      'Ehhez az általános (felhasználó által szerkesztett) statikai vázhoz nincs kanonikus zárt alakú analitikus referencia — konkrét, rögzített esetekre (konzol, kéttámaszú, kétnyílású stb.) a zárt alakú összevetést a fem-validation csomag V-01…V-12 / P-01…P-16 esetei végzik el (ld. STATUS_REPORT.md 5. pont).',

    section7Title: '7. Képlékeny számítás',
    stepLogTitle: 'Teherlépcsőnkénti napló',
    stepHeader: '#',
    lambdaHeader: 'λ',
    iterationsHeader: 'iterációk',
    psiNormHeader: '‖ψ‖',
    fNormHeader: '‖f‖',
    finalResidualHeader: 'végső reziduum [%]',
    convergenceFormulaTitle: 'A konvergencia-képlet behelyettesítve (Diplomaterv 3.4.2.1/6. lépés, "CONUND")',
    convergenceFormulaIntro: '100·‖ψ‖/‖f‖ ≤ Tolerancia — az utolsó teherlépcső utolsó iterációjára konkrétan kiírva:',
    noPlasticSample: 'Ebben a futásban sehol nem folyt meg réteg — nincs bemutatható példa.',
    plasticSampleTitle: (elementId, gaussIndex, xSuffix, stepIndex) =>
      `Egy választott Gauss-pont rétegenkénti feszültségszámítása — ${elementId}, Gauss-pont ${gaussIndex}/3${xSuffix}, lépés #${stepIndex}`,
    plasticSampleXSuffix: (x) => ` (x ≈ ${x} m)`,
    plasticSampleExtreme: 'Teljesen kiírt példa — a legnagyobb |σ_trial|-jal:',
    layerHeader: 'réteg',
    zHeader: 'z [mm]',
    prevStressHeader: 'σ_{r-1} [kN/cm²]',
    dEpsHeader: 'Δε',
    trialStressHeader: 'σ_trial [kN/cm²]',
    rHeader: 'R',
    newStressHeader: 'σ_új [kN/cm²]',
    yieldedHeader: 'folyva?',
    yesWord: 'igen',
    noWord: 'nem',
    hingeSequenceTitle: 'A képlékeny csuklók kialakulási sorrendje',
    hingeIndexHeader: '#',
    hingeEventHeader: 'Esemény',
    hingeElementHeader: 'Elem',
    hingeXHeader: 'x ≈ [m]',
    noPlasticZone: 'Nem alakult ki képlékeny zóna.',
    runConverged: (lambda) =>
      `A futás λ = ${lambda}-ig konvergált — ez a beállított csúcs-teherszorzó, NEM feltétlenül a szerkezet valódi határtehere.`,
    runLimitLoad: (lambda) =>
      `A futás a numerikus határteher közelébe ért (λ ≈ ${lambda}). Ehhez az általános vázhoz nincs kanonikus zárt alakú képlékeny határteher-képlet — konkrét esetekre ld. fem-validation P-03…P-08.`,
    runDiverged: 'A futás megszakadt.',
    noNonlinearRun:
      'Nincs nemlineáris futási eredmény — futtasd a SZÁMÍTÁS gombbal (F5), majd nyisd meg újra a levezetést, hogy ez a pont is megjelenjen.',

    propertyHeader: 'Jellemző',
    valueGenericHeader: 'Érték',

    strategyLabelElimination: 'eliminációs (kizárt DOF)',
    strategyLabelPenalty: 'penalty',
  },

  en: {
    derivedElementLabel: 'Derived element',
    close: 'Close',
    exportWord: 'Export: Word (.docx)',
    printSave: 'Print / Save as PDF',
    title: 'FEM@ti — Derivation',
    versionLabel: (version, commit) => `v${version} · core: ${commit}`,

    section1Title: '1. Task',
    spanLabel: 'Span L',
    elementCountLabel: 'Element count',
    integrationLabel: 'Integration scheme',
    integrationSelective: 'selective reduced',
    integrationFull: 'full',
    sectionLabel: 'Section',
    sectionSourceSuffixUnverified: (source) => ` — ${source}`,
    sectionSourceSuffixVerified: (source) => ` (source: ${source})`,
    materialLabel: 'Material',
    materialElastic: '— (elastic)',
    materialSummary: (eValue, sigmaYText, source) => `E = ${eValue} kN/cm², σY = ${sigmaYText} — source: ${source}`,
    supportHeader: 'Support',
    xHeader: 'x [m]',
    typeHeader: 'Type',
    loadHeader: 'Load',
    valueHeader: 'Value',

    section2Title: '2. Cross-section',
    layeredIntro: (n) =>
      `The layered (fiber) model divides the cross-section into ${n} strips of equal thickness, sampling the contour width at the MIDLINE of each strip (Diplomaterv 3.4.3, (3.54)).`,
    meMpNoteElastic: (materialName, shapeFactor) =>
      `The material (${materialName}) has no defined yield strength (σY) — it is marked "elastic only" in the catalog. Mₑ and Mₚ are therefore NOT defined (not 0, but undefined); only the elastic section properties (A, I, Wₑ, Wₚ) are meaningful for this material. The shape factor c = Wₚ/Wₑ is a purely geometric quantity, independent of σY, so it remains valid: c = ${shapeFactor}.`,
    sectionTableDeviation: (aCat, devA, iCat, devI) => `Section table: A = ${aCat} cm² (deviation ${devA}%), I = ${iCat} cm⁴ (deviation ${devI}%) — `,
    deviationLarge: (layerCount, layerThickness) =>
      `SIGNIFICANT deviation: with ${layerCount} layers, the layer thickness (${layerThickness} mm) exceeds the flange thickness, so the midline sampling projects the full flange width onto a band thicker than the real flange at the first/last layer (per the P-13 validation case this error drops below 1% at 64 layers — see docs/THEORY.md).`,
    deviationSmall: 'deviates slightly from the catalog data (which also includes fillets) due to the midline sampling of the layered model.',

    section3Title: '3. Finite element mesh',
    elementLengthLabel: 'Element length',
    nodeCountLabel: 'Number of nodes',
    dofLabel: 'Degrees of freedom',
    dofPerNodeSuffix: '(2 DOF/node: w, φ)',
    activeDofLabel: 'Active degrees of freedom',
    nodeHeader: 'Node',
    dofHeader: 'DOF (w, φ)',

    section4Title: (elementId) => `4. Full derivation of element ${elementId}`,
    section4Intro: (x1, x2, x3, length, scheme) =>
      `Nodes: x₁ = ${x1} m, x₂ = ${x2} m, x₃ = ${x3} m — length L_e = ${length} m. Integration scheme: ${scheme}.`,
    section4_1Title:
      '4.1 Jacobian (the mapping is identical at every ξ, because the element is straight and the middle node is exactly at the midpoint)',
    jacobianNote:
      '(Only the B1 Gauss point value of dN/dξ is used above — J gives the same result for every ξ, because the element is straight and the middle node is exactly at the midpoint.)',
    section4_2Title: '4.2 Bending term — 3-point Gauss integration, FULL, substituted derivation for EVERY point',
    bendingRowLabel: 'κ-row (B)',
    section4_3Title: (shearPointCount) => `4.3 Shear term — ${shearPointCount}-point Gauss integration, FULL derivation for every point`,
    shearRowLabel: 'γ-row (B)',
    section4_4Title: '4.4 D material matrix',
    section4_5Title: '4.5 Kₑ integration — a concrete, verifiable example for one matrix entry',
    keIntro: (shearPointCount) =>
      `Every entry of Kₑ is the SUM of the contributions of the five Gauss points (3 bending + ${shearPointCount} shear): Kₑ = Σ (factor · Bᵀ·B). The example below shows this for a single, fully written-out matrix entry that receives a contribution from both terms:`,
    section4_6Title: '4.6 The final 6×6 Kₑ matrix',
    section4_7Title: '4.7 Element load vector (λ = 1) — full, per-load derivation',
    noDirectLoad: 'No direct load acts on this element (the q_e = 0 vector is correct).',
    distributedLoadHeading: (label, loadId, pointCount) =>
      `${label} (${loadId}) — q_e = ∫Nᵀ·p dx, with ${pointCount}-point Gauss integration over the intersection of the load and the element's span`,
    distributedForceLabel: 'Distributed force',
    distributedMomentLabel: 'Distributed moment',
    selfWeightLabel: 'Self-weight',
    nodalForceHeading: (loadId) => `Concentrated nodal force (${loadId})`,
    nodalMomentHeading: (loadId) => `Concentrated nodal moment (${loadId})`,
    thermalLoadHeading: 'Thermal load (from κ₀) — q_e = +∫Bᵀ·D·ε₀ dx (ADR-0006 sign)',
    thermalKappa0Note: (kappa0) => `κ₀ = ${kappa0} 1/m`,
    summationHeading: 'Summation',

    section4ATitle: (elementId) => `4A. Mass matrix derivation for element ${elementId} (ADR-0016)`,
    section4AIntro:
      'Both terms of the mass matrix (translational m\', rotary inertia m\'ᵩ) are integrated with the SAME, full (3-point Gauss) quadrature — there is no selective scheme, unlike the stiffness matrix (see the elementMass documentation). RESULT ONLY: the eigenvalue solution (Jacobi rotation) does NOT get a step-by-step animated view here (see ADR-0016 "UI integration" section) — this point is the element-level mass matrix assembly, not the modal solution.',
    section4A_1Title: '4A.1 Gauss points — N shape functions and the rows scattered to the w/φ DOF slots (nRows)',
    wRowLabel: 'w-row (N_w)',
    phiRowLabel: 'φ-row (N_φ)',
    section4A_2Title: '4A.2 Mₑ integration — a concrete, verifiable example for two matrix entries',
    section4A_2Intro:
      'The w-block and φ-block of Mₑ are INDEPENDENT of each other (there is no w–φ cross term, see the nRows() documentation) — the example below therefore shows the summation for TWO SEPARATE, fully written-out matrix entries, one from each term:',
    section4A_3Title: '4A.3 The final 6×6 Mₑ matrix',

    section5Title: '5. Assembly and solution',
    section5_1Title: (elementId) => `5.1 Assembly — where does the Kₑ of element ${elementId} go in the global matrix?`,
    assemblyIntro: (n1, n2, n3) =>
      `Node numbers in the model (from 0): ${n1}, ${n2}, ${n3} — the global DOF index for every node is 2·i (w) and 2·i+1 (φ), see assembly/dofMap.ts.`,
    localDofHeader: 'Local DOF',
    nodeShortHeader: 'Node',
    roleHeader: 'Role',
    globalDofHeader: 'Global DOF',
    assemblyNote: (keValue, target) =>
      `Assembly rule: K_global[I,J] += Kₑ[i,j] for every local pair (i,j), where I,J are the global DOFs from the table above. For example, Kₑ[φ₁,φ₁] = ${keValue} (see 4.5/4.6) goes into K_global[${target}] ADDED (not overwritten — other elements may contribute to the same location if they share this node).`,
    section5_2Title: '5.2 Boundary condition handling',
    prescriptionHeader: 'Prescription',
    springOnlyLabel: '(spring only)',
    eliminationNote: (total, active) =>
      `Elimination strategy: the prescribed DOFs above are EXCLUDED from the system to be solved — of the full ${total} DOF, ${active} remain active (unknown).`,
    penaltyNote: 'Penalty strategy: the prescribed DOFs remain in the system, constrained by a very stiff "spring".',
    section5_3Title: '5.3 The solved system and the displacements of the selected element',
    globalMatrixSizeLabel: 'Global matrix size',
    globalMatrixSizeValue: (dof, active) => `${dof} × ${dof} (active: ${active})`,
    bandwidthLabel: 'Profile (mean bandwidth)',
    solverMethodLabel: 'Solution method',
    solverMethodValue: 'K_active·d_active = f_active, direct Skyline LDLᵀ solver (ADR-0002)',
    selfCheckLabel: 'Self-check',
    selfCheckValue: (ok, total, warningSuffix) => `${ok}/${total} checks passed${warningSuffix}`,
    selfCheckWarningSuffix: (n) => `, ${n} warning${n === 1 ? '' : 's'}`,
    displacementsIntro: (elementId) =>
      `The displacements read from the solution (d = K⁻¹·f) for the 3 nodes of element ${elementId}, uₑ = [w₁,φ₁,w₂,φ₂,w₃,φ₃]:`,
    displacementsNote:
      'This vector gives the internal forces in section 6 as κ = B_κ·uₑ and γ = B_γ·uₑ — the bridge between the "solution" (this point) and the "result" (section 6).',

    section6Title: '6. Results and checks',
    section6_1Title: '6.1 Internal force recovery — κ = B_κ·uₑ, γ = B_γ·uₑ, M = EI·(κ−κ₀), T = GAs·γ',
    section6_1Intro:
      'From the nodal displacements (section 5.3, uₑ), the curvature (κ) and shear strain (γ) can be recovered at ANY ξ of the element — below, at the same 3 points (STRESS_POINTS = GAUSS_3) where the section actually supplies M/T for the diagram.',
    kappa0Note: (kappa0) =>
      `κ₀ = ${kappa0} 1/m (the initial curvature from the thermal load, see section 4.7) — this is why the formula for M uses κ−κ₀, not κ alone.`,
    section6_2Title: (elementId) => `6.2 Gauss-point internal forces of element ${elementId} → nodal extrapolation (Diplomaterv 3.1.7.4)`,
    gaussPointHeader: 'Gauss point',
    momentHeader: 'M [kNm]',
    shearHeader: 'T [kN]',
    elementErrorNote: (pct) =>
      `The extrapolated values of neighboring elements are averaged at the element boundary; the jump measured between them gives the per-element error indicator (currently ${pct}%) — see docs/THEORY.md section 6.`,
    section6_3Title: '6.3 Gauss point → node extrapolation — the quadratic (Lagrange) formula, substituted',
    section6_3Intro:
      "Evaluating the quadratic polynomial fitted to the M-values of the 3 Gauss points (ξ₁,ξ₂,ξ₃) at ξ=−1 and ξ=+1 gives the element's OWN (not yet neighbor-averaged) extrapolated nodal value — at ξ=0 this is trivially the middle Gauss point's own value (see the extrapolation.ts header).",
    extrapLeftNode: 'left node',
    extrapRightNode: 'right node',
    sumFzLabel: 'ΣFz (equilibrium)',
    sumMyLabel: 'ΣMy (equilibrium)',
    noReferenceNote:
      'There is no canonical closed-form analytical reference for this general (user-edited) static scheme — for specific, fixed cases (cantilever, simply supported, two-span, etc.) the closed-form comparison is done by the V-01…V-12 / P-01…P-16 cases of the fem-validation package (see STATUS_REPORT.md section 5).',

    section7Title: '7. Plastic calculation',
    stepLogTitle: 'Per-load-step log',
    stepHeader: '#',
    lambdaHeader: 'λ',
    iterationsHeader: 'iterations',
    psiNormHeader: '‖ψ‖',
    fNormHeader: '‖f‖',
    finalResidualHeader: 'final residual [%]',
    convergenceFormulaTitle: 'The convergence formula, substituted (Diplomaterv 3.4.2.1/step 6, "CONUND")',
    convergenceFormulaIntro: '100·‖ψ‖/‖f‖ ≤ Tolerance — written out explicitly for the last iteration of the last load step:',
    noPlasticSample: 'No layer yielded anywhere in this run — there is no example to show.',
    plasticSampleTitle: (elementId, gaussIndex, xSuffix, stepIndex) =>
      `Per-layer stress calculation for a chosen Gauss point — ${elementId}, Gauss point ${gaussIndex}/3${xSuffix}, step #${stepIndex}`,
    plasticSampleXSuffix: (x) => ` (x ≈ ${x} m)`,
    plasticSampleExtreme: 'Fully written-out example — with the largest |σ_trial|:',
    layerHeader: 'layer',
    zHeader: 'z [mm]',
    prevStressHeader: 'σ_{r-1} [kN/cm²]',
    dEpsHeader: 'Δε',
    trialStressHeader: 'σ_trial [kN/cm²]',
    rHeader: 'R',
    newStressHeader: 'σ_new [kN/cm²]',
    yieldedHeader: 'yielded?',
    yesWord: 'yes',
    noWord: 'no',
    hingeSequenceTitle: 'The order in which plastic hinges formed',
    hingeIndexHeader: '#',
    hingeEventHeader: 'Event',
    hingeElementHeader: 'Element',
    hingeXHeader: 'x ≈ [m]',
    noPlasticZone: 'No plastic zone developed.',
    runConverged: (lambda) =>
      `The run converged to λ = ${lambda} — this is the configured peak load factor, NOT necessarily the structure's true limit load.`,
    runLimitLoad: (lambda) =>
      `The run approached the numerical limit load (λ ≈ ${lambda}). There is no canonical closed-form plastic limit-load formula for this general scheme — see fem-validation P-03…P-08 for specific cases.`,
    runDiverged: 'The run diverged.',
    noNonlinearRun: 'There is no nonlinear run result — click COMPUTE (F5), then reopen the derivation to see this section too.',

    propertyHeader: 'Property',
    valueGenericHeader: 'Value',

    strategyLabelElimination: 'elimination (excluded DOF)',
    strategyLabelPenalty: 'penalty',
  },
};
