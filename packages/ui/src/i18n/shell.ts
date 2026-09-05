/**
 * A mindig látható app-shell felhasználó felé mutatkozó szövegei — a
 * teljes UI i18n (2026-09-05) 1. fázisa: `App.tsx` (fejléc, menük,
 * diagram-fülek, mobil-fülek, jelmagyarázat), `shell/Toolbar.tsx`,
 * `shell/ToolRibbon.tsx`, `shell/WelcomeDialog.tsx`,
 * `shell/AboutDialog.tsx`, `ErrorBoundary.tsx`. `shell/MenuBar.tsx` maga
 * generikus renderer, nincs benne fordítandó szöveg.
 *
 * A `theory/TheoryView.tsx`-ben már bevált `Record<Lang, T>`-mintát
 * viszi tovább; a menü-fordítások szándékosan EGYEZNEK a TheoryView saját
 * angol címeivel (pl. "Mathematical summary"), hogy ugyanaz a fogalom
 * mindenhol ugyanúgy nevezve jelenjen meg.
 */
import type { Lang, UnitSystem } from '../state/appStore.js';
import type { CanvasTool } from '../canvas/ToolPalette.js';

export interface ShellStrings {
  // ── Fejléc ──────────────────────────────────────────────────────────
  readonly subtitle: string;
  readonly undoTitle: string;
  readonly undoAria: string;
  readonly redoTitle: string;
  readonly redoAria: string;
  readonly compute: string;

  // ── Menük ───────────────────────────────────────────────────────────
  readonly menuFile: string;
  readonly menuEdit: string;
  readonly menuView: string;
  readonly menuAnalysis: string;
  readonly menuTheory: string;
  readonly menuHelp: string;

  readonly fileOpenReport: string;
  readonly fileSave: string;
  readonly fileLoad: string;
  readonly fileExportWord: string;
  readonly fileExportPdf: string;

  readonly editUndo: string;
  readonly editRedo: string;
  readonly editDeleteSelected: string;
  readonly editSectionDb: string;
  readonly editMaterialDb: string;

  readonly viewGaussToggle: (shown: boolean) => string;
  readonly viewMomentSide: (tensionSide: boolean) => string;
  readonly viewReactionsToggle: (shown: boolean) => string;
  readonly viewUnitToggle: (current: UnitSystem) => string;

  readonly analysisRun: string;
  readonly analysisAbort: string;
  readonly analysisViewDerivation: string;
  readonly analysisMeshConvergence: string;

  readonly theoryMathSummary: string;
  readonly theoryTimoshenko: string;
  readonly theoryIntegration: string;
  readonly theoryReforb: string;
  readonly theoryHistorical: string;

  readonly helpGettingStarted: string;
  readonly helpAbout: string;

  // ── Diagram-fülek (App.tsx DIAGRAM_TABS — M/T/w/φ nyelvfüggetlen) ──
  readonly tabUtilization: string;
  readonly tabEnvelope: string;
  readonly tabStress3d: string;
  readonly tabLoadDisplacement: string;
  readonly tabConvergence: string;
  readonly tabModal: string;
  readonly tabDynamic: string;

  // ── Mobil-fülek + tablet-váltó (ugyanaz a szó mindkét helyen) ──────
  readonly mobileModel: string;
  readonly mobileCanvas: string;
  readonly mobileResults: string;

  // ── Jelmagyarázat ───────────────────────────────────────────────────
  readonly legendElastic: string;
  readonly legendPartial: string;
  readonly legendPlastic: string;

  // ── App-shell egyéb felirat/aria ────────────────────────────────────
  readonly mobileNavAria: string;
  readonly modelPanelAria: string;
  readonly canvasAria: string;
  readonly diagramsAria: string;
  readonly modelBarTitle: string;

  // ── Toolbar ─────────────────────────────────────────────────────────
  readonly toolbarStructure: string;
  readonly toolbarGeometry: string;
  readonly toolbarSectionMaterial: string;
  readonly toolbarMesh: string;
  readonly toolbarIntegration: string;
  readonly toolbarLoadHistory: string;
  readonly staticSchemeAria: string;
  readonly crossSectionAria: string;
  readonly materialAria: string;
  readonly spanLabel: (unit: string) => string;
  readonly elementCountLabel: string;
  readonly elementCountDisplay: (n: number) => string;
  readonly integrationAria: string;
  readonly integrationSelective: string;
  readonly integrationSelectiveTitle: string;
  readonly integrationFull: string;
  readonly integrationFullTitle: string;
  readonly loadHistoryAria: string;
  readonly loadHistoryMonotonic: string;
  readonly loadHistoryUnloading: string;
  readonly loadHistoryUnloadingTitle: string;

  // ── ToolRibbon ──────────────────────────────────────────────────────
  readonly ribbonTabsAria: string;
  readonly ribbonLoadsTab: string;
  readonly ribbonSupportsTab: string;
  readonly ribbonLoadToolsAria: string;
  readonly ribbonSupportToolsAria: string;
  readonly toolLabels: Record<Exclude<CanvasTool, 'select'>, { readonly label: string; readonly title: string }>;

  // ── WelcomeDialog ───────────────────────────────────────────────────
  readonly welcomeTitle: string;
  readonly welcomeCloseAria: string;
  readonly welcomeIntro: string;
  readonly welcomeBullets: readonly { readonly strong: string; readonly text: string }[];
  readonly welcomeCta: string;

  // ── AboutDialog ─────────────────────────────────────────────────────
  readonly aboutTitle: string;
  readonly aboutClose: string;
  readonly aboutIntro: string;
  readonly aboutFeatures: readonly string[];
  readonly aboutReportIssue: string;
  readonly aboutGithubProfile: string;

  // ── ErrorBoundary ───────────────────────────────────────────────────
  readonly errorTitle: string;
  readonly errorBody: string;
  readonly errorDetailsSummary: string;
  readonly errorReload: string;
}

export const SHELL: Record<Lang, ShellStrings> = {
  hu: {
    subtitle: 'Timoshenko gerenda · rugalmas–képlékeny végeselemes analízis',
    undoTitle: 'Visszavonás (Ctrl+Z)',
    undoAria: 'Visszavonás',
    redoTitle: 'Újra (Ctrl+Y)',
    redoAria: 'Újra',
    compute: 'SZÁMÍTÁS',

    menuFile: 'File',
    menuEdit: 'Szerkesztés',
    menuView: 'Nézet',
    menuAnalysis: 'Számítás',
    menuTheory: 'Elméletek',
    menuHelp: 'Súgó',

    fileOpenReport: 'Jegyzőkönyv megnyitása',
    fileSave: 'Mentés (.femati.json)',
    fileLoad: 'Betöltés (.femati.json)',
    fileExportWord: 'Export: Word (.docx)',
    fileExportPdf: 'Export: PDF',

    editUndo: 'Visszavonás',
    editRedo: 'Újra',
    editDeleteSelected: 'Kijelölt elem törlése',
    editSectionDb: 'Szelvény adatbázis',
    editMaterialDb: 'Anyag adatbázis',

    viewGaussToggle: (shown) => (shown ? 'Gauss-pontok elrejtése' : 'Gauss-pontok megjelenítése'),
    viewMomentSide: (tensionSide) => (tensionSide ? 'M ábra: normál oldal' : 'M ábra: húzott oldal'),
    viewReactionsToggle: (shown) => (shown ? 'Reakciók elrejtése' : 'Reakciók megjelenítése'),
    viewUnitToggle: (current) => (current === 'si' ? 'Mértékegység: US customary' : 'Mértékegység: SI'),

    analysisRun: 'Futtatás',
    analysisAbort: 'Megszakítás',
    analysisViewDerivation: 'Levezetés megtekintése',
    analysisMeshConvergence: 'Hálófüggetlenségi vizsgálat',

    theoryMathSummary: 'Matematikai összefoglaló',
    theoryTimoshenko: 'Timoshenko gerendaelem',
    theoryIntegration: 'Szelektív redukált integrálás',
    theoryReforb: 'Reziduális erők (REFORB)',
    theoryHistorical: 'Történelmi mód: frontális megoldó',

    helpGettingStarted: 'Kezdő lépések',
    helpAbout: 'Névjegy',

    tabUtilization: 'kihasználtság',
    tabEnvelope: 'burkolóábra',
    tabStress3d: '3D feszültség',
    tabLoadDisplacement: 'teher–elmozdulás',
    tabConvergence: 'konvergencia',
    tabModal: 'modális',
    tabDynamic: 'dinamika',

    mobileModel: 'Modell',
    mobileCanvas: 'Vászon',
    mobileResults: 'Eredmény',

    legendElastic: 'rugalmas',
    legendPartial: 'részben képlékeny',
    legendPlastic: 'képlékeny csukló',

    mobileNavAria: 'Nézet (mobil)',
    modelPanelAria: 'Modell panel',
    canvasAria: 'Modellvászon',
    diagramsAria: 'Diagramok',
    modelBarTitle: 'MODELL',

    toolbarStructure: 'Szerkezet',
    toolbarGeometry: 'Geometria',
    toolbarSectionMaterial: 'Szelvény · anyag',
    toolbarMesh: 'Háló',
    toolbarIntegration: 'Integrálás (záródás)',
    toolbarLoadHistory: 'Tehertörténet',
    staticSchemeAria: 'Statikai váz',
    crossSectionAria: 'Keresztmetszet',
    materialAria: 'Anyag',
    spanLabel: (unit) => `Fesztáv L [${unit}]`,
    elementCountLabel: 'Elemszám',
    elementCountDisplay: (n) => `${n} elem`,
    integrationAria: 'Integrálási séma',
    integrationSelective: 'szelektív',
    integrationSelectiveTitle: 'Hajlítás 3 pont, nyírás 2 pont — a záródás (shear locking) ellen',
    integrationFull: 'teljes',
    integrationFullTitle: 'Mindkét tag 3 pontos integrálással',
    loadHistoryAria: 'Tehertörténet',
    loadHistoryMonotonic: 'monoton',
    loadHistoryUnloading: 'tehermentesítés',
    loadHistoryUnloadingTitle: 'Terhelés a csúcsig, majd tehermentesítés — sajátfeszültségek és beállás',

    ribbonTabsAria: 'Terhek / Támaszok',
    ribbonLoadsTab: 'Terhek',
    ribbonSupportsTab: 'Támaszok',
    ribbonLoadToolsAria: 'Teher-eszközök',
    ribbonSupportToolsAria: 'Támasz-eszközök',
    toolLabels: {
      'add-point-load': { label: 'Pontteher', title: 'Koncentrált erő elhelyezése kattintással' },
      'add-moment-load': { label: 'Nyomatékteher', title: 'Koncentrált nyomaték elhelyezése kattintással' },
      'add-distributed-load': {
        label: 'Megoszló teher',
        title: 'Megoszló teher rajzolása húzással (trapéz alakra a kijelölt teher panelén szerkeszthető)',
      },
      'add-distributed-moment-load': { label: 'Megoszló nyomaték', title: 'Megoszló nyomatékteher rajzolása húzással' },
      'add-pinned': { label: 'Csuklós', title: 'Csuklós támasz elhelyezése kattintással' },
      'add-roller': { label: 'Görgős', title: 'Görgős támasz elhelyezése kattintással' },
      'add-fixed': { label: 'Befogás', title: 'Befogás elhelyezése kattintással' },
      'add-spring': { label: 'Rugós', title: 'Rugós támasz elhelyezése kattintással' },
      'add-foundation': { label: 'Ágyazás', title: 'Winkler-féle rugalmas ágyazat rajzolása húzással' },
    },

    welcomeTitle: 'Kezdő lépések',
    welcomeCloseAria: 'Kezdő lépések bezárása',
    welcomeIntro:
      'A FEMAti egy Timoshenko-gerenda rugalmas–képlékeny végeselemes analízis szoftver. Első ránézésre sok mindent mutat egyszerre — íme, mi hol van:',
    welcomeBullets: [
      { strong: 'Bal panel', text: 'itt épül a modell: támaszok, terhek, keresztmetszet, anyag.' },
      { strong: 'Középen a vászon', text: 'kattintással és húzással szerkesztheted a szerkezetet.' },
      { strong: 'Jobb panel', text: 'az eredmények (lehajlás, nyomaték, teherbírás) élőben frissülnek.' },
      {
        strong: 'Fent, a „Szerkezet" legördülőben',
        text: 'kész mintafeladatok is vannak — onnan is el lehet indulni.',
      },
    ],
    welcomeCta: 'Kezdjük',

    aboutTitle: 'Névjegy',
    aboutClose: 'Bezár',
    aboutIntro: 'A FEM@ti egy Timoshenko-gerenda rugalmas–képlékeny végeselemes analízis szoftver:',
    aboutFeatures: [
      'rugalmas–képlékeny (nemlineáris) analízis, tehertörténettel — monoton vagy terhelés–tehermentesítés',
      'dinamikai analízis — sajátfrekvencia, módalakok, Rayleigh-csillapítás, Newmark-β tranziens válasz',
      'Cowper-féle, Poisson-tényezőtől függő nyírási korrekciós tényező',
      'képlékeny hajlítás–nyírás (M-V) interakciós teherbírás-ellenőrzés',
      'vasbeton keresztmetszet vasalással, ULS teherbírás-ellenőrzés (EC2)',
      'kompozit keresztmetszet (acél gerenda + betonlemez)',
      'hőterhelés (hőmérsékleti gradiens az alsó/felső szélen)',
      'másodrendű (P-Δ) hatás axiális erő mellett',
      'mozgó teher — burkolóábra (M/T envelope)',
      'hálófüggetlenségi (h-konvergencia) vizsgálat',
      'automatikus szelvény-optimalizálás ("legkisebb megfelelő szelvény")',
      'élő feszültség-/nyomatékhőtérkép a modell-vásznon (Gauss-pontok és gerinctengely)',
      'mértékegység-váltás: SI ↔ US customary (bemenet és eredmény egyaránt)',
      'szelvény- és anyagadatbázis, jegyzőkönyv-export (Word/PDF)',
    ],
    aboutReportIssue: 'Hibajelentés / kérdés',
    aboutGithubProfile: 'GitHub-profil',

    errorTitle: 'Váratlan hiba történt',
    errorBody:
      'A felület egy nem kezelt hibába ütközött, ezért nem tud tovább biztonságosan működni. A jelenlegi modell-állapot ELVESZHETETT az újratöltéskor — ha fontos beállítást szerkesztettél, jegyezd fel, mielőtt újratöltöd.',
    errorDetailsSummary: 'Technikai részletek',
    errorReload: 'Oldal újratöltése',
  },

  en: {
    subtitle: 'Timoshenko beam · elastic–plastic finite element analysis',
    undoTitle: 'Undo (Ctrl+Z)',
    undoAria: 'Undo',
    redoTitle: 'Redo (Ctrl+Y)',
    redoAria: 'Redo',
    compute: 'COMPUTE',

    menuFile: 'File',
    menuEdit: 'Edit',
    menuView: 'View',
    menuAnalysis: 'Analysis',
    menuTheory: 'Theory',
    menuHelp: 'Help',

    fileOpenReport: 'Open report',
    fileSave: 'Save (.femati.json)',
    fileLoad: 'Load (.femati.json)',
    fileExportWord: 'Export: Word (.docx)',
    fileExportPdf: 'Export: PDF',

    editUndo: 'Undo',
    editRedo: 'Redo',
    editDeleteSelected: 'Delete selected element',
    editSectionDb: 'Section database',
    editMaterialDb: 'Material database',

    viewGaussToggle: (shown) => (shown ? 'Hide Gauss points' : 'Show Gauss points'),
    viewMomentSide: (tensionSide) => (tensionSide ? 'M diagram: standard side' : 'M diagram: tension side'),
    viewReactionsToggle: (shown) => (shown ? 'Hide reactions' : 'Show reactions'),
    viewUnitToggle: (current) => (current === 'si' ? 'Units: US customary' : 'Units: SI'),

    analysisRun: 'Run',
    analysisAbort: 'Abort',
    analysisViewDerivation: 'View derivation',
    analysisMeshConvergence: 'Mesh convergence study',

    theoryMathSummary: 'Mathematical summary',
    theoryTimoshenko: 'Timoshenko beam element',
    theoryIntegration: 'Selective reduced integration',
    theoryReforb: 'Residual force balance (REFORB)',
    theoryHistorical: 'Historical mode: frontal solver',

    helpGettingStarted: 'Getting started',
    helpAbout: 'About',

    tabUtilization: 'utilization',
    tabEnvelope: 'envelope',
    tabStress3d: '3D stress',
    tabLoadDisplacement: 'load–displacement',
    tabConvergence: 'convergence',
    tabModal: 'modal',
    tabDynamic: 'dynamic',

    mobileModel: 'Model',
    mobileCanvas: 'Canvas',
    mobileResults: 'Results',

    legendElastic: 'elastic',
    legendPartial: 'partially plastic',
    legendPlastic: 'plastic hinge',

    mobileNavAria: 'View (mobile)',
    modelPanelAria: 'Model panel',
    canvasAria: 'Model canvas',
    diagramsAria: 'Diagrams',
    modelBarTitle: 'MODEL',

    toolbarStructure: 'Structure',
    toolbarGeometry: 'Geometry',
    toolbarSectionMaterial: 'Section · material',
    toolbarMesh: 'Mesh',
    toolbarIntegration: 'Integration (locking)',
    toolbarLoadHistory: 'Load history',
    staticSchemeAria: 'Static scheme',
    crossSectionAria: 'Cross-section',
    materialAria: 'Material',
    spanLabel: (unit) => `Span L [${unit}]`,
    elementCountLabel: 'Element count',
    elementCountDisplay: (n) => `${n} element${n === 1 ? '' : 's'}`,
    integrationAria: 'Integration scheme',
    integrationSelective: 'selective',
    integrationSelectiveTitle: 'Bending: 3-point, shear: 2-point — against shear locking',
    integrationFull: 'full',
    integrationFullTitle: 'Both terms with 3-point integration',
    loadHistoryAria: 'Load history',
    loadHistoryMonotonic: 'monotonic',
    loadHistoryUnloading: 'unloading',
    loadHistoryUnloadingTitle: 'Load to peak, then unload — residual stresses and settling',

    ribbonTabsAria: 'Loads / Supports',
    ribbonLoadsTab: 'Loads',
    ribbonSupportsTab: 'Supports',
    ribbonLoadToolsAria: 'Load tools',
    ribbonSupportToolsAria: 'Support tools',
    toolLabels: {
      'add-point-load': { label: 'Point load', title: 'Place a concentrated force by clicking' },
      'add-moment-load': { label: 'Moment load', title: 'Place a concentrated moment by clicking' },
      'add-distributed-load': {
        label: 'Distributed load',
        title: 'Draw a distributed load by dragging (editable to a trapezoid shape in the selected load panel)',
      },
      'add-distributed-moment-load': { label: 'Distributed moment', title: 'Draw a distributed moment load by dragging' },
      'add-pinned': { label: 'Pinned', title: 'Place a pinned support by clicking' },
      'add-roller': { label: 'Roller', title: 'Place a roller support by clicking' },
      'add-fixed': { label: 'Fixed', title: 'Place a fixed support by clicking' },
      'add-spring': { label: 'Spring', title: 'Place a spring support by clicking' },
      'add-foundation': { label: 'Foundation', title: 'Draw a Winkler elastic foundation by dragging' },
    },

    welcomeTitle: 'Getting started',
    welcomeCloseAria: 'Close getting started',
    welcomeIntro:
      "FEMAti is an elastic–plastic finite element analysis tool for Timoshenko beams. At first glance it shows a lot at once — here's where everything is:",
    welcomeBullets: [
      { strong: 'Left panel', text: 'this is where the model is built: supports, loads, cross-section, material.' },
      { strong: 'Canvas in the middle', text: 'click and drag to edit the structure.' },
      { strong: 'Right panel', text: 'results (deflection, moment, load capacity) update live.' },
      {
        strong: 'At the top, in the "Structure" dropdown,',
        text: 'there are ready-made sample problems too — a good place to start.',
      },
    ],
    welcomeCta: "Let's start",

    aboutTitle: 'About',
    aboutClose: 'Close',
    aboutIntro: 'FEM@ti is an elastic–plastic finite element analysis tool for Timoshenko beams:',
    aboutFeatures: [
      'elastic–plastic (nonlinear) analysis with load history — monotonic or loading–unloading',
      'dynamic analysis — natural frequencies, mode shapes, Rayleigh damping, Newmark-β transient response',
      "Cowper's shear correction factor, dependent on Poisson's ratio",
      'plastic bending–shear (M–V) interaction capacity check',
      'reinforced concrete cross-section with rebar, ULS capacity check (EC2)',
      'composite cross-section (steel beam + concrete slab)',
      'thermal loading (temperature gradient across the top/bottom fiber)',
      'second-order (P-Δ) effect under axial force',
      'moving load — envelope diagram (M/T envelope)',
      'mesh-independence (h-convergence) study',
      'automatic section optimization ("smallest adequate section")',
      'live stress/moment heatmap on the model canvas (Gauss points and beam axis)',
      'unit switching: SI ↔ US customary (both input and results)',
      'section and material database, report export (Word/PDF)',
    ],
    aboutReportIssue: 'Report an issue / ask a question',
    aboutGithubProfile: 'GitHub profile',

    errorTitle: 'An unexpected error occurred',
    errorBody:
      'The application hit an unhandled error and can no longer run safely. The current model state MAY BE LOST on reload — if you were editing something important, write it down before reloading.',
    errorDetailsSummary: 'Technical details',
    errorReload: 'Reload page',
  },
};
