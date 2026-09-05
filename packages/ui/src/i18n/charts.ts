/**
 * A diagram-sáv és a megosztott chart-komponensek (`charts/*.tsx`) felhasználó
 * felé mutatkozó szövegei — a teljes UI i18n (2026-09-05) záró, korábban
 * dokumentált nyitva hagyott résének pótlása (ld. memória:
 * `project-femati-i18n-progress`). Ez a kör a `charts/` mappa mind a 9
 * fájlját fordítja: `DiagramChart`, `DiagramPanel`, `ConvergencePanel`,
 * `LoadDisplacementChart`, `EnvelopeChart`, `ModalPanel`, `TransientChart`,
 * `DynamicPanel`, `Beam3DStress`.
 *
 * Az M/T/w/φ diagram-címeket szándékosan NEM duplikáljuk — az
 * `i18n/report.ts` `REPORT[lang].diagramTitle`-jét használják újra, hogy a
 * munkaasztal diagramfüle és a jegyzőkönyv ugyanazt a feliratot mondja. A
 * "Futtatás"/"Run" gomb (`DynamicPanel`) az `i18n/shell.ts`
 * `SHELL[lang].analysisRun`-t használja újra ugyanezen okból.
 */
import type { Lang } from '../state/appStore.js';
import type { ExcitationKind } from '../model/dynamicRun.js';

export interface ChartsStrings {
  // ── DiagramChart.tsx ──────────────────────────────────────────────────
  readonly diagramAriaLabel: (title: string, extreme: string) => string;
  readonly tensionSideSuffix: string;

  // ── DiagramPanel.tsx ──────────────────────────────────────────────────
  readonly nonlinearRunFailed: (error: string) => string;
  readonly noNonlinearResult: string;
  readonly enableMovingLoadHint: string;
  readonly envelopeNotComputable: string;
  readonly modelNotRunnable: string;
  readonly noComputationResult: string;
  readonly utilizationNeedsYield: string;
  readonly utilizationChartTitle: string;
  readonly utilizationCaption: string;
  readonly sectionHoverHint: string;
  readonly downloadSvgTitle: string;

  // ── ConvergencePanel.tsx ──────────────────────────────────────────────
  readonly convergenceAriaLabel: string;
  readonly convergenceTitle: string;
  readonly rejectedAttempts: (count: string, lambda: string) => string;
  readonly noHalving: string;

  // ── LoadDisplacementChart.tsx ─────────────────────────────────────────
  readonly loadDisplacementAriaLabel: (maxLambda: string) => string;
  readonly loadDisplacementTitle: string;

  // ── EnvelopeChart.tsx ─────────────────────────────────────────────────
  readonly envelopeFieldAria: string;
  readonly envelopeChartAria: (field: string) => string;

  // ── ModalPanel.tsx ────────────────────────────────────────────────────
  readonly modalNoResult: string;
  readonly modeSelectAria: string;
  readonly modeTitle: (n: number) => string;
  readonly modeDownloadSvgTitle: string;
  readonly modeShapeTitle: (n: number, freqHz: string) => string;

  // ── TransientChart.tsx ────────────────────────────────────────────────
  readonly labelAcceleration: string;
  readonly transientAriaLabel: (label: string, x: string, peak: string) => string;
  readonly transientTitle: (label: string) => string;

  // ── DynamicPanel.tsx ──────────────────────────────────────────────────
  readonly excitationLabel: Record<ExcitationKind, string>;
  readonly excitationTypeAria: string;
  readonly amplitudeLabel: string;
  readonly frequencyLabel: string;
  readonly rampTimeLabel: string;
  readonly impulseTimeLabel: string;
  readonly dampingAlphaLabel: string;
  readonly dampingBetaLabel: string;
  readonly stepCountLabel: string;
  readonly displayedQuantityAria: string;
  readonly dynamicRunFailed: (error: string) => string;
  readonly noDynamicResult: string;

  // ── Beam3DStress.tsx ──────────────────────────────────────────────────
  readonly stress3dAriaLabel: string;
  readonly stress3dTitle: string;
  readonly topFiberLabel: string;
  readonly bottomFiberLabel: string;
  readonly magnitudeLegend: string;
  readonly tensionLegend: string;
  readonly compressionLegend: string;
}

export const CHARTS: Record<Lang, ChartsStrings> = {
  hu: {
    diagramAriaLabel: (title, extreme) => `${title} diagram, szélsőérték ${extreme}`,
    tensionSideSuffix: ' ▼ húzott oldal',

    nonlinearRunFailed: (error) => `A nemlineáris futtatás nem sikerült: ${error}`,
    noNonlinearResult: 'Nincs nemlineáris eredmény — futtasd a SZÁMÍTÁS gombbal (F5).',
    enableMovingLoadHint: 'Kapcsold be a mozgó terhet a bal panelen ("mozgó teher — burkolóábra") ehhez a fülhöz.',
    envelopeNotComputable: 'A burkolóábra nem számítható — a modell jelenlegi állapotában nem futtatható.',
    modelNotRunnable: 'A modell jelenleg nem futtatható — nincs mit ábrázolni.',
    noComputationResult: 'Nincs számítási eredmény.',
    utilizationNeedsYield: 'A kihasználtsági térképhez folyáshatárral (σY) rendelkező anyag szükséges — a jelenlegi anyagnak nincs megadva képlékeny teherbírása.',
    utilizationChartTitle: 'M-V kihasználtság',
    utilizationCaption: 'M-V kihasználtság (EN 1993-1-1 6.2.8) a gerenda mentén — 100% fölött a keresztmetszet túllépi a redukált teherbírást (200%-nál a skála levágva)',
    sectionHoverHint: 'metszet: mozgasd az egeret a diagramon',
    downloadSvgTitle: 'Az aktív diagram SVG letöltése',

    convergenceAriaLabel: 'Konvergencia-panel: iterációnkénti reziduum, lépésenként csoportosítva, log-skálán',
    convergenceTitle: 'Konvergencia (reziduum %, log-skála)',
    rejectedAttempts: (count, lambda) => `${count} elvetett próbálkozás (Δλ felezve) a terhelési szakaszban — legutóbb λ ≈ ${lambda}-nél.`,
    noHalving: 'Nem volt Δλ-felezés — minden teherlépcső elsőre konvergált.',

    loadDisplacementAriaLabel: (maxLambda) => `Teher–elmozdulás görbe, referencia-csomópont lehajlása, λ_max = ${maxLambda}`,
    loadDisplacementTitle: 'Teher–elmozdulás (λ – w)',

    envelopeFieldAria: 'Burkolóábra mezője',
    envelopeChartAria: (field) => `${field} burkolóábra a mozgó teherre`,

    modalNoResult: 'Nincs modális eredmény.',
    modeSelectAria: 'Módus kiválasztása',
    modeTitle: (n) => `${n}. módus`,
    modeDownloadSvgTitle: 'Az aktív módalak-diagram SVG letöltése',
    modeShapeTitle: (n, freqHz) => `${n}. módalak — f = ${freqHz} Hz`,

    labelAcceleration: 'a — gyorsulás',
    transientAriaLabel: (label, x, peak) => `Idő–${label} görbe, csomópont x ≈ ${x} m, csúcsérték ${peak}`,
    transientTitle: (label) => `${label} — idő`,

    excitationLabel: { step: 'lépcső', ramp: 'rámpa', harmonic: 'harmonikus', impulse: 'impulzus' },
    excitationTypeAria: 'Gerjesztés típusa',
    amplitudeLabel: 'amplitúdó [×]',
    frequencyLabel: 'frekvencia [Hz]',
    rampTimeLabel: 'rámpa-idő [s]',
    impulseTimeLabel: 'impulzus-idő [s]',
    dampingAlphaLabel: 'csillapítás α',
    dampingBetaLabel: 'csillapítás β',
    stepCountLabel: 'lépésszám',
    displayedQuantityAria: 'Megjelenített mennyiség',
    dynamicRunFailed: (error) => `A dinamikai futtatás nem sikerült: ${error}`,
    noDynamicResult: 'Nincs dinamikai eredmény — állítsd be a gerjesztést, majd Futtatás.',

    stress3dAriaLabel: 'Szélső szálak hajlítófeszültsége, előjelesen, izometrikus',
    stress3dTitle: 'Felső és alsó szélső szál hajlítófeszültsége (σ = M·z/I), előjelesen — izometrikus, sematikus geometria',
    topFiberLabel: 'felső szál',
    bottomFiberLabel: 'alsó szál',
    magnitudeLegend: '|σ| (szín) — nagyság',
    tensionLegend: '+ húzás',
    compressionLegend: '− nyomás',
  },

  en: {
    diagramAriaLabel: (title, extreme) => `${title} diagram, extreme value ${extreme}`,
    tensionSideSuffix: ' ▼ tension side',

    nonlinearRunFailed: (error) => `The nonlinear run failed: ${error}`,
    noNonlinearResult: 'No nonlinear result yet — click COMPUTE (F5).',
    enableMovingLoadHint: 'Enable the moving load on the left panel ("moving load — envelope") for this tab.',
    envelopeNotComputable: 'The envelope cannot be computed — the model is not runnable in its current state.',
    modelNotRunnable: 'The model cannot currently be solved — nothing to plot.',
    noComputationResult: 'No computation result.',
    utilizationNeedsYield: 'The utilization map needs a material with a defined yield strength (σY) — the current material has no plastic capacity defined.',
    utilizationChartTitle: 'M-V utilization',
    utilizationCaption: 'M-V utilization (EN 1993-1-1 6.2.8) along the beam — above 100% the section exceeds the reduced capacity (scale clipped at 200%)',
    sectionHoverHint: 'section: move the mouse over the diagram',
    downloadSvgTitle: 'Download the active diagram as SVG',

    convergenceAriaLabel: 'Convergence panel: per-iteration residual, grouped by load step, log scale',
    convergenceTitle: 'Convergence (residual %, log scale)',
    rejectedAttempts: (count, lambda) => `${count} rejected attempt(s) (Δλ halved) in the loading stage — most recently at λ ≈ ${lambda}.`,
    noHalving: 'No Δλ halving occurred — every load step converged on the first try.',

    loadDisplacementAriaLabel: (maxLambda) => `Load–displacement curve, reference-node deflection, λ_max = ${maxLambda}`,
    loadDisplacementTitle: 'Load–displacement (λ – w)',

    envelopeFieldAria: 'Envelope field',
    envelopeChartAria: (field) => `${field} envelope for the moving load`,

    modalNoResult: 'No modal result.',
    modeSelectAria: 'Select mode',
    modeTitle: (n) => `Mode ${n}`,
    modeDownloadSvgTitle: 'Download the active mode-shape diagram as SVG',
    modeShapeTitle: (n, freqHz) => `Mode shape ${n} — f = ${freqHz} Hz`,

    labelAcceleration: 'a — acceleration',
    transientAriaLabel: (label, x, peak) => `Time–${label} curve, node at x ≈ ${x} m, peak value ${peak}`,
    transientTitle: (label) => `${label} — time`,

    excitationLabel: { step: 'step', ramp: 'ramp', harmonic: 'harmonic', impulse: 'impulse' },
    excitationTypeAria: 'Excitation type',
    amplitudeLabel: 'amplitude [×]',
    frequencyLabel: 'frequency [Hz]',
    rampTimeLabel: 'ramp time [s]',
    impulseTimeLabel: 'impulse duration [s]',
    dampingAlphaLabel: 'damping α',
    dampingBetaLabel: 'damping β',
    stepCountLabel: 'step count',
    displayedQuantityAria: 'Displayed quantity',
    dynamicRunFailed: (error) => `The dynamic run failed: ${error}`,
    noDynamicResult: 'No dynamic result yet — configure the excitation, then Run.',

    stress3dAriaLabel: 'Extreme-fiber bending stress, signed, isometric',
    stress3dTitle: 'Top and bottom extreme-fiber bending stress (σ = M·z/I), signed — isometric, schematic geometry',
    topFiberLabel: 'top fiber',
    bottomFiberLabel: 'bottom fiber',
    magnitudeLegend: '|σ| (color) — magnitude',
    tensionLegend: '+ tension',
    compressionLegend: '− compression',
  },
};
