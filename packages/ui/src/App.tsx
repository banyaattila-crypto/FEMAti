import { useCallback, useEffect, useRef, type CSSProperties } from 'react';
import { Button } from './components/Button.js';
import { Legend, StatusPill } from './components/Feedback.js';
import { Logo } from './components/Logo.js';
import { ModelCanvas } from './canvas/ModelCanvas.js';
import { LeftPanel } from './panels/LeftPanel.js';
import { RightPanel } from './panels/RightPanel.js';
import { MenuBar, type Menu } from './shell/MenuBar.js';
import { Toolbar } from './shell/Toolbar.js';
import { ToolRibbon } from './shell/ToolRibbon.js';
import { Timeline } from './shell/Timeline.js';
import { CrossSectionInspector } from './panels/CrossSectionInspector.js';
import { ReportView } from './report/ReportView.js';
import { DerivationView } from './derivation/DerivationView.js';
import { HistoricalView } from './historical/HistoricalView.js';
import { TheoryView } from './theory/TheoryView.js';
import { MeshConvergenceView } from './meshconvergence/MeshConvergenceView.js';
import { AboutDialog } from './shell/AboutDialog.js';
import { WelcomeDialog } from './shell/WelcomeDialog.js';
import { DatabaseView } from './catalog/DatabaseView.js';
import { findPreset } from './data/catalog.js';
import { useAppStore, type DiagramTab, type MobileTab } from './state/appStore.js';
import { SHELL } from './i18n/shell.js';
import { useModelStore } from './state/modelStore.js';
import { useNonlinearStore } from './state/nonlinearStore.js';
import { useDynamicStore } from './state/dynamicStore.js';
import { combinedSteps, runNonlinearEditableModel } from './model/nonlinear.js';
import { ModelFileError, parseEditableModelFile, serializeEditableModel, type SolverSettingsFile } from './model/fileIO.js';
import { DiagramPanel } from './charts/DiagramPanel.js';
import { formatModelFileError } from './i18n/errors.js';

export function App(): JSX.Element {
  const s = useAppStore();
  const t = SHELL[s.lang];

  /** `accent` — a `--tab-*` tokenek neve (`tokens.css`), fülenként eltérő, de koherens tónus. */
  const diagramTabs: readonly { id: DiagramTab; label: string; accent: string }[] = [
    { id: 'M', label: 'M', accent: '--tab-m' },
    { id: 'T', label: 'T', accent: '--tab-t' },
    { id: 'w', label: 'w', accent: '--tab-w' },
    { id: 'phi', label: 'φ', accent: '--tab-phi' },
    { id: 'utilization', label: t.tabUtilization, accent: '--tab-utilization' },
    { id: 'envelope', label: t.tabEnvelope, accent: '--tab-envelope' },
    { id: 'stress3d', label: t.tabStress3d, accent: '--tab-stress3d' },
    { id: 'load-displacement', label: t.tabLoadDisplacement, accent: '--tab-load-displacement' },
    { id: 'convergence', label: t.tabConvergence, accent: '--tab-convergence' },
    { id: 'modal', label: t.tabModal, accent: '--tab-modal' },
    { id: 'dynamic', label: t.tabDynamic, accent: '--tab-dynamic' },
  ];

  /** <768px-nél a fejezet-fülek — DESIGN-TERV 3.3 "egy oszlop, fülekkel". */
  const mobileTabs: readonly { id: MobileTab; label: string }[] = [
    { id: 'model', label: t.mobileModel },
    { id: 'canvas', label: t.mobileCanvas },
    { id: 'results', label: t.mobileResults },
  ];

  const legend = [
    { label: t.legendElastic, fill: 'var(--sem-elastic)', stroke: 'var(--sem-elastic-edge)', pattern: 'solid' as const },
    {
      label: t.legendPartial,
      fill: 'var(--sem-partial)',
      stroke: 'var(--sem-partial-edge)',
      pattern: 'hatch' as const,
    },
    {
      label: t.legendPlastic,
      fill: 'var(--sem-plastic)',
      stroke: 'var(--sem-plastic-edge)',
      pattern: 'cross' as const,
    },
  ];
  const model = useModelStore((st) => st.model);
  const undo = useModelStore((st) => st.undo);
  const redo = useModelStore((st) => st.redo);
  const canUndo = useModelStore((st) => st.canUndo);
  const canRedo = useModelStore((st) => st.canRedo);
  const removeSelected = useModelStore((st) => st.removeSelected);
  const selection = useModelStore((st) => st.selection);
  const loadModel = useModelStore((st) => st.loadModel);
  const preset = findPreset(model.presetId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nonlinear = useNonlinearStore();

  const run = useCallback((): void => {
    // A lineáris eredmény ÉLŐBEN frissül minden modellváltozás után
    // (ModelCanvas → useLiveResult) — ez a gomb/F5 a NEMLINEÁRIS (rétegelt
    // keresztmetszetű, rugalmas-képlékeny) teherlépcsőzést indítja
    // (MASTER-PROMPT-TERV 4.2 #2: "nemlineáris esetben explicit „Számítás" gombra").
    s.setStatus('running', t.statusRunning);
    const initialSteps = Math.max(2, Math.round(s.peakLambda / s.loadStep));
    const outcome = runNonlinearEditableModel(model, {
      algorithm: s.algorithm,
      tolerancePercent: s.tolerance,
      initialSteps,
      peakLambda: s.peakLambda,
      unload: s.loadHistory === 'unloading',
    });

    if (outcome.error !== null) {
      nonlinear.setError(outcome.error);
      s.setStatus('error', outcome.error);
      return;
    }
    const runResult = outcome.run;
    if (runResult === null) return;

    nonlinear.setRun(runResult);
    const all = combinedSteps(runResult);
    s.setActiveStep(Math.max(0, all.length - 1));
    if (runResult.status === 'converged') {
      s.setStatus('converged', t.statusConverged(runResult.peakLambda.toFixed(3)));
    } else if (runResult.status === 'limit-load-reached') {
      const lastLambda = runResult.loadingSteps.at(-1)?.lambda ?? 0;
      s.setStatus('limit-load', t.statusLimitLoad(lastLambda.toFixed(3)));
    } else {
      s.setStatus('diverged', t.statusDiverged);
    }
  }, [s, model, nonlinear]);

  const openReport = useCallback((): void => {
    s.setReportOpen(true);
  }, [s]);

  /**
   * File → Export: PDF — a Jegyzőkönyv megnyitása, majd a böngésző natív
   * nyomtatómotorjának indítása (ADR-0005: nincs külön PDF-könyvtár, a
   * `report.css` `@media print` szabályai adják a PDF-et). A dupla
   * `requestAnimationFrame` a React állapotváltás DOM-commitját várja be,
   * mert itt — a `ReportView` saját "Nyomtatás" gombjától eltérően — a
   * jegyzőkönyv a hívás pillanatában még zárva van.
   */
  const exportReportPdf = useCallback((): void => {
    s.setReportOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }, [s]);

  /**
   * File → Mentés — a modell ÉS a megoldó-beállítások letöltése `.femati.json`-ként
   * (a böngésző natív letöltés-mechanizmusával, NEM a fem-core lefordított-háló
   * sémájával, ld. `model/fileIO.ts` fejlécét arról is, mi MARAD ki tudatosan).
   */
  const saveModel = useCallback((): void => {
    const solverSettings: SolverSettingsFile = {
      algorithm: s.algorithm,
      loadHistory: s.loadHistory,
      loadStep: s.loadStep,
      tolerance: s.tolerance,
      peakLambda: s.peakLambda,
      showGaussPoints: s.showGaussPoints,
      momentTensionSide: s.momentTensionSide,
      showReactions: s.showReactions,
      unitSystem: s.unitSystem,
      activeDiagram: s.activeDiagram,
    };
    const json = serializeEditableModel(model, solverSettings);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${model.presetId}.femati.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [model, s]);

  /** File → Betöltés — a rejtett fájlválasztó megnyitása. */
  const openLoadDialog = useCallback((): void => {
    fileInputRef.current?.click();
  }, []);

  const onLoadFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const file = e.target.files?.[0];
      e.target.value = ''; // ugyanazt a fájlt újra kiválasztva is fusson a change
      if (file === undefined) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = typeof reader.result === 'string' ? reader.result : '';
          const { model: parsedModel, solverSettings } = parseEditableModelFile(text);
          loadModel(parsedModel);
          s.setAlgorithm(solverSettings.algorithm);
          s.setLoadHistory(solverSettings.loadHistory);
          s.setLoadStep(solverSettings.loadStep);
          s.setTolerance(solverSettings.tolerance);
          s.setPeakLambda(solverSettings.peakLambda);
          s.setShowGaussPoints(solverSettings.showGaussPoints);
          s.setMomentTensionSide(solverSettings.momentTensionSide);
          s.setShowReactions(solverSettings.showReactions);
          s.setUnitSystem(solverSettings.unitSystem);
          s.setActiveDiagram(solverSettings.activeDiagram);
          s.setStatus('editing', t.statusLoaded(file.name));
        } catch (error) {
          const message = error instanceof ModelFileError ? formatModelFileError(error.info, s.lang) : error instanceof Error ? error.message : String(error);
          s.setStatus('error', t.statusLoadFailed(message));
        }
      };
      reader.onerror = () => s.setStatus('error', t.statusFileReadFailed);
      reader.readAsText(file);
    },
    [loadModel, s, t],
  );

  // A modell BÁRMELY módosítása azonnal érvényteleníti a nemlineáris ÉS a
  // dinamikai eredményt is (appStore.ts fejléce: "az elavult eredmény nem
  // maradhat érvényesként a képernyőn") — a két store EGYMÁSTÓL FÜGGETLENÜL
  // törlődik, mert az egyik lehet üres, míg a másikban van eredmény.
  useEffect(
    () =>
      useModelStore.subscribe((state, prev) => {
        if (state.model === prev.model) return;
        if (useNonlinearStore.getState().run !== null) {
          useNonlinearStore.getState().clear();
          const appState = useAppStore.getState();
          appState.setStatus('editing', SHELL[appState.lang].statusModelChanged);
        }
        if (useDynamicStore.getState().run !== null) {
          useDynamicStore.getState().clear();
        }
      }),
    [],
  );

  const openDerivation = useCallback((): void => {
    s.setDerivationOpen(true);
  }, [s]);

  const openHistorical = useCallback((): void => {
    s.setHistoricalOpen(true);
  }, [s]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      const typing = target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      if (e.key === 'F5' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        run();
      } else if (!typing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (!typing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && selection !== null) {
        e.preventDefault();
        removeSelected();
      } else if (e.key === 'Escape' && s.welcomeOpen) {
        e.preventDefault();
        s.setWelcomeOpen(false);
      } else if (e.key === 'Escape' && s.inspector !== null) {
        e.preventDefault();
        s.closeInspector();
      } else if (e.key === 'Escape' && s.reportOpen) {
        e.preventDefault();
        s.setReportOpen(false);
      } else if (e.key === 'Escape' && s.derivationOpen) {
        e.preventDefault();
        s.setDerivationOpen(false);
      } else if (e.key === 'Escape' && s.historicalOpen) {
        e.preventDefault();
        s.setHistoricalOpen(false);
      } else if (e.key === 'Escape' && s.theoryOpen) {
        e.preventDefault();
        s.setTheoryOpen(false);
      } else if (e.key === 'Escape' && s.meshConvergenceOpen) {
        e.preventDefault();
        s.setMeshConvergenceOpen(false);
      } else if (e.key === 'Escape' && s.aboutOpen) {
        e.preventDefault();
        s.setAboutOpen(false);
      } else if (e.key === 'Escape' && s.sectionDbOpen) {
        e.preventDefault();
        s.setSectionDbOpen(false);
      } else if (e.key === 'Escape' && s.materialDbOpen) {
        e.preventDefault();
        s.setMaterialDbOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [run, undo, redo, removeSelected, selection, s]);

  const menus: readonly Menu[] = [
    {
      label: t.menuFile,
      items: [
        { label: t.fileOpenReport, onSelect: openReport, separatorAfter: true },
        { label: t.fileSave, onSelect: saveModel },
        { label: t.fileLoad, onSelect: openLoadDialog, separatorAfter: true },
        { label: t.fileExportWord, disabled: true },
        { label: t.fileExportPdf, onSelect: exportReportPdf },
      ],
    },
    {
      label: t.menuEdit,
      items: [
        { label: t.editUndo, shortcut: 'Ctrl+Z', onSelect: undo, disabled: !canUndo },
        { label: t.editRedo, shortcut: 'Ctrl+Y', onSelect: redo, disabled: !canRedo },
        { label: t.editDeleteSelected, shortcut: 'Del', onSelect: removeSelected, disabled: selection === null, separatorAfter: true },
        { label: t.editSectionDb, onSelect: () => s.setSectionDbOpen(true) },
        { label: t.editMaterialDb, onSelect: () => s.setMaterialDbOpen(true) },
      ],
    },
    {
      label: t.menuView,
      items: [
        {
          label: t.viewGaussToggle(s.showGaussPoints),
          onSelect: () => s.setShowGaussPoints(!s.showGaussPoints),
        },
        {
          label: t.viewMomentSide(s.momentTensionSide),
          onSelect: () => s.setMomentTensionSide(!s.momentTensionSide),
        },
        {
          label: t.viewReactionsToggle(s.showReactions),
          onSelect: () => s.setShowReactions(!s.showReactions),
        },
        {
          label: t.viewUnitToggle(s.unitSystem),
          onSelect: () => s.setUnitSystem(s.unitSystem === 'si' ? 'imperial' : 'si'),
        },
      ],
    },
    {
      label: t.menuAnalysis,
      items: [
        { label: t.analysisRun, shortcut: 'F5', onSelect: run },
        { label: t.analysisAbort, disabled: true, separatorAfter: true },
        { label: t.analysisViewDerivation, onSelect: openDerivation },
        { label: t.analysisMeshConvergence, onSelect: () => s.setMeshConvergenceOpen(true) },
      ],
    },
    {
      label: t.menuTheory,
      items: [
        { label: t.theoryMathSummary, onSelect: () => s.openTheory('thesis96'), separatorAfter: true },
        { label: t.theoryTimoshenko, onSelect: () => s.openTheory('timoshenko') },
        { label: t.theoryIntegration, onSelect: () => s.openTheory('integration') },
        { label: t.theoryReforb, onSelect: () => s.openTheory('reforb'), separatorAfter: true },
        { label: t.theoryHistorical, onSelect: openHistorical, separatorAfter: true },
      ],
    },
    {
      label: t.menuHelp,
      items: [
        { label: t.helpGettingStarted, onSelect: () => s.setWelcomeOpen(true) },
        { label: t.helpAbout, onSelect: () => s.setAboutOpen(true) },
      ],
    },
  ];

  return (
    <div className="vem-app">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={onLoadFileChange}
        style={{ display: 'none' }}
        aria-hidden="true"
        tabIndex={-1}
      />
      <header className="vem-chrome">
        <div className="vem-chrome__brand">
          <Logo variant="mark" theme="dark" size={20} />
          <div className="vem-chrome__name">FEM@ti</div>
          <div className="vem-chrome__subtitle">{t.subtitle}</div>
        </div>
        <MenuBar menus={menus} />
        <div className="vem-chrome__spacer" />
        <div className="vem-lang-switch" role="group" aria-label="Nyelv / Language">
          <button
            type="button"
            className="vem-lang-switch-btn"
            aria-pressed={s.lang === 'hu'}
            onClick={() => s.setLang('hu')}
          >
            HU
          </button>
          <button
            type="button"
            className="vem-lang-switch-btn"
            aria-pressed={s.lang === 'en'}
            onClick={() => s.setLang('en')}
          >
            EN
          </button>
        </div>
        <div className="vem-chrome__actions">
          <Button onClick={undo} disabled={!canUndo} title={t.undoTitle} ariaLabel={t.undoAria}>
            ↶
          </Button>
          <Button onClick={redo} disabled={!canRedo} title={t.redoTitle} ariaLabel={t.redoAria}>
            ↷
          </Button>
          <Button size="sm" variant="primary" onClick={run} loading={s.status === 'running'}>
            {t.compute}
          </Button>
        </div>
        <div className="vem-chrome__file">{preset.id}.femati.json</div>
        <StatusPill status={s.status} label={t.statusLabels[s.status]} detail={s.statusDetail} />
      </header>

      <Toolbar />
      <ToolRibbon />

      <nav className="vem-mobile-tabs" role="tablist" aria-label={t.mobileNavAria}>
        {mobileTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="vem-mobile-tabs__tab"
            aria-selected={s.mobileTab === t.id}
            onClick={() => s.setMobileTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="vem-main" data-mobile-tab={s.mobileTab} data-tablet-model-open={s.tabletModelOpen}>
        <button
          type="button"
          className="vem-tablet-toggle"
          aria-expanded={s.tabletModelOpen}
          aria-label={t.modelPanelAria}
          onClick={() => s.setTabletModelOpen(!s.tabletModelOpen)}
        >
          {t.mobileModel}
        </button>

        <LeftPanel />

        <section className="vem-center" aria-label={t.canvasAria}>
          <div className="vem-canvas-bar">
            <span className="vem-canvas-bar__title">{t.modelBarTitle}</span>
            <Legend items={legend} />
          </div>

          <div className="vem-canvas-host">
            <ModelCanvas />
          </div>

          <div className="vem-diagram-bar">
            <div className="vem-diagram-bar__tabs" role="tablist" aria-label={t.diagramsAria}>
              {diagramTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  className="vem-tab"
                  aria-selected={s.activeDiagram === t.id}
                  onClick={() => s.setActiveDiagram(t.id)}
                  style={{ '--tab-accent': `var(${t.accent})` } as CSSProperties & Record<string, string>}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="vem-diagram-bar__body">
              <DiagramPanel activeDiagram={s.activeDiagram} momentFlip={s.momentTensionSide} />
            </div>
          </div>
        </section>

        <RightPanel />
      </main>

      <Timeline />
      <CrossSectionInspector />
      <ReportView />
      <DerivationView />
      <HistoricalView />
      <TheoryView />
      <MeshConvergenceView />
      <AboutDialog />
      <WelcomeDialog />
      <DatabaseView kind="section" />
      <DatabaseView kind="material" />
    </div>
  );
}
