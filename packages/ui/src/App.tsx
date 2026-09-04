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
import { useModelStore } from './state/modelStore.js';
import { useNonlinearStore } from './state/nonlinearStore.js';
import { useDynamicStore } from './state/dynamicStore.js';
import { combinedSteps, runNonlinearEditableModel } from './model/nonlinear.js';
import { ModelFileError, parseEditableModelFile, serializeEditableModel, type SolverSettingsFile } from './model/fileIO.js';
import { DiagramPanel } from './charts/DiagramPanel.js';

/** `accent` — a `--tab-*` tokenek neve (`tokens.css`), fülenként eltérő, de koherens tónus. */
const DIAGRAM_TABS: readonly { id: DiagramTab; label: string; accent: string }[] = [
  { id: 'M', label: 'M', accent: '--tab-m' },
  { id: 'T', label: 'T', accent: '--tab-t' },
  { id: 'w', label: 'w', accent: '--tab-w' },
  { id: 'phi', label: 'φ', accent: '--tab-phi' },
  { id: 'utilization', label: 'kihasználtság', accent: '--tab-utilization' },
  { id: 'envelope', label: 'burkolóábra', accent: '--tab-envelope' },
  { id: 'stress3d', label: '3D feszültség', accent: '--tab-stress3d' },
  { id: 'load-displacement', label: 'teher–elmozdulás', accent: '--tab-load-displacement' },
  { id: 'convergence', label: 'konvergencia', accent: '--tab-convergence' },
  { id: 'modal', label: 'modális', accent: '--tab-modal' },
  { id: 'dynamic', label: 'dinamika', accent: '--tab-dynamic' },
];

/** <768px-nél a fejezet-fülek — DESIGN-TERV 3.3 "egy oszlop, fülekkel". */
const MOBILE_TABS: readonly { id: MobileTab; label: string }[] = [
  { id: 'model', label: 'Modell' },
  { id: 'canvas', label: 'Vászon' },
  { id: 'results', label: 'Eredmény' },
];

const LEGEND = [
  { label: 'rugalmas', fill: 'var(--sem-elastic)', stroke: 'var(--sem-elastic-edge)', pattern: 'solid' as const },
  {
    label: 'részben képlékeny',
    fill: 'var(--sem-partial)',
    stroke: 'var(--sem-partial-edge)',
    pattern: 'hatch' as const,
  },
  {
    label: 'képlékeny csukló',
    fill: 'var(--sem-plastic)',
    stroke: 'var(--sem-plastic-edge)',
    pattern: 'cross' as const,
  },
];

export function App(): JSX.Element {
  const s = useAppStore();
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
    s.setStatus('running', 'nemlineáris teherlépcsőzés fut…');
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
      s.setStatus('converged', `λ = ${runResult.peakLambda.toFixed(3)}-ig konvergált`);
    } else if (runResult.status === 'limit-load-reached') {
      const lastLambda = runResult.loadingSteps.at(-1)?.lambda ?? 0;
      s.setStatus('limit-load', `a szerkezet a határteher közelébe ért (λ ≈ ${lastLambda.toFixed(3)})`);
    } else {
      s.setStatus('diverged', 'a futás megszakadt');
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
          s.setStatus('editing', `betöltve: ${file.name}`);
        } catch (error) {
          const message = error instanceof ModelFileError ? error.message : error instanceof Error ? error.message : String(error);
          s.setStatus('error', `Modell betöltése sikertelen — ${message}`);
        }
      };
      reader.onerror = () => s.setStatus('error', 'A fájl beolvasása sikertelen.');
      reader.readAsText(file);
    },
    [loadModel, s],
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
          useAppStore.getState().setStatus('editing', 'a modell módosult — futtasd újra (F5)');
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
      label: 'File',
      items: [
        { label: 'Jegyzőkönyv megnyitása', onSelect: openReport, separatorAfter: true },
        { label: 'Mentés (.femati.json)', onSelect: saveModel },
        { label: 'Betöltés (.femati.json)', onSelect: openLoadDialog, separatorAfter: true },
        { label: 'Export: Word (.docx)', disabled: true },
        { label: 'Export: PDF', onSelect: exportReportPdf },
      ],
    },
    {
      label: 'Szerkesztés',
      items: [
        { label: 'Visszavonás', shortcut: 'Ctrl+Z', onSelect: undo, disabled: !canUndo },
        { label: 'Újra', shortcut: 'Ctrl+Y', onSelect: redo, disabled: !canRedo },
        { label: 'Kijelölt elem törlése', shortcut: 'Del', onSelect: removeSelected, disabled: selection === null, separatorAfter: true },
        { label: 'Szelvény adatbázis', onSelect: () => s.setSectionDbOpen(true) },
        { label: 'Anyag adatbázis', onSelect: () => s.setMaterialDbOpen(true) },
      ],
    },
    {
      label: 'Nézet',
      items: [
        {
          label: s.showGaussPoints ? 'Gauss-pontok elrejtése' : 'Gauss-pontok megjelenítése',
          onSelect: () => s.setShowGaussPoints(!s.showGaussPoints),
        },
        {
          label: s.momentTensionSide ? 'M ábra: normál oldal' : 'M ábra: húzott oldal',
          onSelect: () => s.setMomentTensionSide(!s.momentTensionSide),
        },
        {
          label: s.showReactions ? 'Reakciók elrejtése' : 'Reakciók megjelenítése',
          onSelect: () => s.setShowReactions(!s.showReactions),
        },
        {
          label: s.unitSystem === 'si' ? 'Mértékegység: US customary' : 'Mértékegység: SI',
          onSelect: () => s.setUnitSystem(s.unitSystem === 'si' ? 'imperial' : 'si'),
        },
      ],
    },
    {
      label: 'Számítás',
      items: [
        { label: 'Futtatás', shortcut: 'F5', onSelect: run },
        { label: 'Megszakítás', disabled: true, separatorAfter: true },
        { label: 'Levezetés megtekintése', onSelect: openDerivation },
        { label: 'Hálófüggetlenségi vizsgálat', onSelect: () => s.setMeshConvergenceOpen(true) },
      ],
    },
    {
      label: 'Elmélet',
      items: [
        { label: "Diplomaterv '96", onSelect: () => s.openTheory('thesis96'), separatorAfter: true },
        { label: 'Timoshenko gerendaelem', onSelect: () => s.openTheory('timoshenko') },
        { label: 'Szelektív redukált integrálás', onSelect: () => s.openTheory('integration') },
        { label: 'Reziduális erők (REFORB)', onSelect: () => s.openTheory('reforb') },
        {
          label: 'Teljes elmélet',
          onSelect: () => s.openTheory('fullPdf'),
          separatorAfter: true,
        },
        { label: 'Történelmi mód: frontális megoldó', onSelect: openHistorical, separatorAfter: true },
      ],
    },
    {
      label: 'Súgó',
      items: [
        { label: 'Kezdő lépések', onSelect: () => s.setWelcomeOpen(true) },
        { label: 'Névjegy', onSelect: () => s.setAboutOpen(true) },
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
          <div className="vem-chrome__subtitle">Timoshenko gerenda · rugalmas–képlékeny végeselemes analízis</div>
        </div>
        <MenuBar menus={menus} />
        <div className="vem-chrome__spacer" />
        <div className="vem-chrome__actions">
          <Button onClick={undo} disabled={!canUndo} title="Visszavonás (Ctrl+Z)" ariaLabel="Visszavonás">
            ↶
          </Button>
          <Button onClick={redo} disabled={!canRedo} title="Újra (Ctrl+Y)" ariaLabel="Újra">
            ↷
          </Button>
          <Button size="sm" variant="primary" onClick={run} loading={s.status === 'running'}>
            SZÁMÍTÁS
          </Button>
        </div>
        <div className="vem-chrome__file">{preset.id}.femati.json</div>
        <StatusPill status={s.status} detail={s.statusDetail} />
      </header>

      <Toolbar />
      <ToolRibbon />

      <nav className="vem-mobile-tabs" role="tablist" aria-label="Nézet (mobil)">
        {MOBILE_TABS.map((t) => (
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
          aria-label="Modell panel"
          onClick={() => s.setTabletModelOpen(!s.tabletModelOpen)}
        >
          Modell
        </button>

        <LeftPanel />

        <section className="vem-center" aria-label="Modellvászon">
          <div className="vem-canvas-bar">
            <span className="vem-canvas-bar__title">MODELL</span>
            <Legend items={LEGEND} />
          </div>

          <div className="vem-canvas-host">
            <ModelCanvas />
          </div>

          <div className="vem-diagram-bar">
            <div className="vem-diagram-bar__tabs" role="tablist" aria-label="Diagramok">
              {DIAGRAM_TABS.map((t) => (
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
