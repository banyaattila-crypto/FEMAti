/**
 * A számítási jegyzőkönyv (`report/ReportView.tsx`) felhasználó felé
 * mutatkozó szövegei — a teljes UI i18n (2026-09-05) 5a. fázisa. Az
 * export-dokumentumok a UI nyelvét követik (korábbi felhasználói döntés,
 * ld. memória: `project-femati-i18n-progress`).
 *
 * A támasztípus- és verdikt-feliratokat NEM itt, hanem a már meglévő
 * `i18n/panels.ts` `SUPPORT_TYPE_LABEL`/`VERDICT_LABEL` szótárból veszi át
 * a `ReportView.tsx` — egy jelentés ne mondjon mást, mint a munkaasztal.
 *
 * A `material.name`/`section.name`/`*.source` (katalógus-adattartalom) NEM
 * tartozik ide, explicit felhasználói döntés alapján — ez marad magyar
 * mindkét nyelven.
 */
import type { Lang } from '../state/appStore.js';

export type ReportLoadKind = 'point' | 'moment' | 'distributed' | 'distributed-moment';
export type ReportHingeKind = 'first-yield' | 'full-hinge';

export interface ReportStrings {
  readonly close: string;
  readonly printSave: string;

  readonly reportTitle: string;
  readonly versionLabel: (version: string, commit: string) => string;

  readonly section2Title: string;
  readonly spanLabel: string;
  readonly sectionLabel: string;
  readonly materialLabel: string;
  readonly selfWeightLabel: string;
  readonly selfWeightYes: string;
  readonly selfWeightNo: string;
  readonly supportHeader: string;
  readonly xHeader: string;
  readonly typeHeader: string;
  readonly loadHeader: string;
  readonly valueHeader: string;
  readonly loadKindLabel: Record<ReportLoadKind, string>;
  readonly materialSourceNote: (name: string, source: string) => string;
  readonly sectionSourceNote: (name: string, source: string) => string;

  readonly section3Title: string;
  readonly elementCountLabel: string;
  readonly elementLengthLabel: string;
  readonly dofLabel: string;
  readonly integrationLabel: string;
  readonly integrationSelective: string;
  readonly integrationFull: string;

  readonly section4Title: string;
  readonly algorithmLabel: string;
  readonly algorithmNewton: string;
  readonly algorithmModified: string;
  readonly loadStepLabel: string;
  readonly toleranceLabel: string;
  readonly peakLambdaLabel: string;
  readonly loadHistoryLabel: string;
  readonly loadHistoryUnloading: string;
  readonly loadHistoryMonotonic: string;

  readonly section5Title: string;
  readonly modelNotRunnable: (error: string) => string;
  readonly noComputableModel: string;
  readonly reactionHeader: string;
  readonly equilibriumCheckLabel: string;
  readonly standardsCheckHeader: string;
  readonly utilizationHeader: string;
  readonly verdictHeader: string;
  readonly mvCheckLabel: string;
  readonly deflectionCheckLabel: string;
  readonly crackingCheckLabel: string;
  readonly crackingNote: string;
  readonly diagramTitle: Record<'M' | 'T' | 'w' | 'phi', string>;

  readonly section6Title: string;
  readonly stateLabel: string;
  readonly convergedText: (lambda: string) => string;
  readonly limitLoadText: (lambda: string) => string;
  readonly divergedText: string;
  readonly rejectedAttemptsLabel: string;
  readonly hingeIndexHeader: string;
  readonly hingeEventHeader: string;
  readonly hingeElementHeader: string;
  readonly hingeXHeader: string;
  readonly hingeKindLabel: Record<ReportHingeKind, string>;
  readonly noPlasticZone: string;

  readonly section7Title: string;
  /** A hibabecslés-bekezdés a `pct` érték köré tördelve — a hívó (`ReportView.tsx`) a százalékértéket `<strong>`-be teszi, ezért két darabban. */
  readonly errorEstimateBefore: string;
  readonly errorEstimateAfter: string;

  readonly footerNote: string;
}

export const REPORT: Record<Lang, ReportStrings> = {
  hu: {
    close: 'Bezárás',
    printSave: 'Nyomtatás / PDF mentése',

    reportTitle: 'FEM@ti — Számítási jegyzőkönyv',
    versionLabel: (version, commit) => `v${version} · mag: ${commit}`,

    section2Title: '2. Modell',
    spanLabel: 'Fesztáv L',
    sectionLabel: 'Szelvény',
    materialLabel: 'Anyag',
    selfWeightLabel: 'Önsúly',
    selfWeightYes: 'figyelembe véve',
    selfWeightNo: 'nincs figyelembe véve',
    supportHeader: 'Támasz',
    xHeader: 'x [m]',
    typeHeader: 'Típus',
    loadHeader: 'Teher',
    valueHeader: 'Jellemző',
    loadKindLabel: {
      point: 'koncentrált erő',
      moment: 'koncentrált nyomaték',
      distributed: 'megoszló teher',
      'distributed-moment': 'megoszló nyomatékteher',
    },
    materialSourceNote: (name, source) => ` Anyag (${name}): ${source}.`,
    sectionSourceNote: (name, source) => ` Szelvény (${name}): ${source}.`,

    section3Title: '3. Háló',
    elementCountLabel: 'Elemszám',
    elementLengthLabel: 'Elemhossz',
    dofLabel: 'Szabadságfokok',
    integrationLabel: 'Integrálási séma',
    integrationSelective: 'szelektív redukált (hajlítás 3 pont, nyírás 2 pont)',
    integrationFull: 'teljes (mindkét tag 3 pontos)',

    section4Title: '4. Megoldó beállításai',
    algorithmLabel: 'Algoritmus',
    algorithmNewton: 'Newton-Raphson (teljes)',
    algorithmModified: 'módosított Newton',
    loadStepLabel: 'Teherlépcső Δλ',
    toleranceLabel: 'Tolerancia',
    peakLambdaLabel: 'Csúcs-teherszorzó λ_cél',
    loadHistoryLabel: 'Tehertörténet',
    loadHistoryUnloading: 'terhelés a csúcsig, majd tehermentesítés',
    loadHistoryMonotonic: 'monoton',

    section5Title: '5. Eredmények',
    modelNotRunnable: (error) => `A modell jelenleg nem futtatható: ${error}`,
    noComputableModel: 'Nincs számítható modell.',
    reactionHeader: 'Reakció',
    equilibriumCheckLabel: 'ΣFz / ΣMy ellenőrzés',
    standardsCheckHeader: 'Szabványossági ellenőrzés',
    utilizationHeader: 'Kihasználtság',
    verdictHeader: 'Verdikt',
    mvCheckLabel: 'M-V kihasználtság (EN 1993-1-1 6.2.8, γM0 = 1.00)',
    deflectionCheckLabel: 'Lehajlás-ellenőrzés (SLS, L/250)',
    crackingCheckLabel: 'Repedési nyomaték Mcr kihasználtsága (EC2, tájékoztató)',
    crackingNote:
      'A repedési nyomaték ellenőrzés TÁJÉKOZTATÓ, SLS-jellegű jelzés — NEM vasbeton ULS teherbírás-ellenőrzés (nincs vasalás-modellezés a motorban, ld. ADR-0019, ADR-0021).',
    diagramTitle: {
      M: 'M — hajlítónyomaték',
      T: 'T — nyíróerő',
      w: 'w — lehajlás',
      phi: 'φ — elfordulás',
    },

    section6Title: '6. Nemlineáris (rugalmas–képlékeny) futás',
    stateLabel: 'Állapot',
    convergedText: (lambda) => `konvergált λ = ${lambda}-ig`,
    limitLoadText: (lambda) => `a szerkezet a határteher közelébe ért (λ ≈ ${lambda})`,
    divergedText: 'a futás megszakadt',
    rejectedAttemptsLabel: 'Elvetett próbálkozások (Δλ-felezés)',
    hingeIndexHeader: '#',
    hingeEventHeader: 'Esemény',
    hingeElementHeader: 'Elem',
    hingeXHeader: 'x ≈ [m]',
    hingeKindLabel: {
      'first-yield': 'első megfolyás',
      'full-hinge': 'képlékeny csukló (teljes keresztmetszet)',
    },
    noPlasticZone: 'Nem alakult ki képlékeny zóna ebben a futásban.',

    section7Title: '7. Hibabecslés és hálófüggetlenség',
    errorEstimateBefore:
      'A legrosszabb elemenkénti hibajelző (az elemhatáron mért, átlagolás előtti igénybevétel-ugrás a mező szélsőértékéhez viszonyítva): ',
    errorEstimateAfter:
      '. A jelző a hálósűrűség növelésével csökken (h-konvergencia) — ld. docs/THEORY.md 6. és 12. pont. A jelen jegyzőkönyv NEM helyettesíti a hálófüggetlenségi vizsgálatot: eltérő elemszámmal újrafuttatva ellenőrizendő, hogy az eredmény érdemben nem változik.',

    footerNote: 'A számítás eredményét szakmai felelősséggel ellenőrizni kell.',
  },

  en: {
    close: 'Close',
    printSave: 'Print / Save as PDF',

    reportTitle: 'FEM@ti — Calculation report',
    versionLabel: (version, commit) => `v${version} · core: ${commit}`,

    section2Title: '2. Model',
    spanLabel: 'Span L',
    sectionLabel: 'Section',
    materialLabel: 'Material',
    selfWeightLabel: 'Self-weight',
    selfWeightYes: 'included',
    selfWeightNo: 'not included',
    supportHeader: 'Support',
    xHeader: 'x [m]',
    typeHeader: 'Type',
    loadHeader: 'Load',
    valueHeader: 'Value',
    loadKindLabel: {
      point: 'point load',
      moment: 'point moment',
      distributed: 'distributed load',
      'distributed-moment': 'distributed moment load',
    },
    materialSourceNote: (name, source) => ` Material (${name}): ${source}.`,
    sectionSourceNote: (name, source) => ` Section (${name}): ${source}.`,

    section3Title: '3. Mesh',
    elementCountLabel: 'Element count',
    elementLengthLabel: 'Element length',
    dofLabel: 'Degrees of freedom',
    integrationLabel: 'Integration scheme',
    integrationSelective: 'selective reduced (bending: 3-point, shear: 2-point)',
    integrationFull: 'full (both terms 3-point)',

    section4Title: '4. Solver settings',
    algorithmLabel: 'Algorithm',
    algorithmNewton: 'Newton-Raphson (full)',
    algorithmModified: 'modified Newton',
    loadStepLabel: 'Load step Δλ',
    toleranceLabel: 'Tolerance',
    peakLambdaLabel: 'Target peak load factor λ',
    loadHistoryLabel: 'Load history',
    loadHistoryUnloading: 'load to peak, then unload',
    loadHistoryMonotonic: 'monotonic',

    section5Title: '5. Results',
    modelNotRunnable: (error) => `The model cannot currently be solved: ${error}`,
    noComputableModel: 'No computable model.',
    reactionHeader: 'Reaction',
    equilibriumCheckLabel: 'ΣFz / ΣMy check',
    standardsCheckHeader: 'Code check',
    utilizationHeader: 'Utilization',
    verdictHeader: 'Verdict',
    mvCheckLabel: 'M–V utilization (EN 1993-1-1 6.2.8, γM0 = 1.00)',
    deflectionCheckLabel: 'Deflection check (SLS, L/250)',
    crackingCheckLabel: 'Cracking moment Mcr utilization (EC2, informative)',
    crackingNote:
      'The cracking moment check is an INFORMATIVE, SLS-type indication — NOT a reinforced-concrete ULS capacity check (the engine has no rebar modeling, see ADR-0019, ADR-0021).',
    diagramTitle: {
      M: 'M — bending moment',
      T: 'T — shear force',
      w: 'w — deflection',
      phi: 'φ — rotation',
    },

    section6Title: '6. Nonlinear (elastic–plastic) run',
    stateLabel: 'State',
    convergedText: (lambda) => `converged to λ = ${lambda}`,
    limitLoadText: (lambda) => `structure approached its limit load (λ ≈ ${lambda})`,
    divergedText: 'the run diverged',
    rejectedAttemptsLabel: 'Rejected attempts (Δλ halving)',
    hingeIndexHeader: '#',
    hingeEventHeader: 'Event',
    hingeElementHeader: 'Element',
    hingeXHeader: 'x ≈ [m]',
    hingeKindLabel: {
      'first-yield': 'first yield',
      'full-hinge': 'plastic hinge (full cross-section)',
    },
    noPlasticZone: 'No plastic zone developed in this run.',

    section7Title: '7. Error estimate and mesh independence',
    errorEstimateBefore:
      "The worst per-element error indicator (the pre-averaging internal-force jump at the element boundary, relative to the field's extreme value): ",
    errorEstimateAfter:
      '. The indicator decreases as the mesh is refined (h-convergence) — see docs/THEORY.md sections 6 and 12. This report does NOT replace a mesh-independence study: re-running with a different element count should confirm the result does not change materially.',

    footerNote: 'The results of this calculation must be verified under professional engineering responsibility.',
  },
};

export function formatReportDateTime(d: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'hu-HU', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(d);
}
