import { useCallback, useEffect } from 'react';
import { Legend, StatusPill } from './components/Feedback.js';
import { Logo } from './components/Logo.js';
import { ModelCanvas } from './canvas/ModelCanvas.js';
import { LeftPanel } from './panels/LeftPanel.js';
import { RightPanel } from './panels/RightPanel.js';
import { MenuBar, type Menu } from './shell/MenuBar.js';
import { Toolbar } from './shell/Toolbar.js';
import { Timeline } from './shell/Timeline.js';
import { CrossSectionInspector } from './panels/CrossSectionInspector.js';
import { ReportView } from './report/ReportView.js';
import { DerivationView } from './derivation/DerivationView.js';
import { HistoricalView } from './historical/HistoricalView.js';
import { TheoryView } from './theory/TheoryView.js';
import { MeshConvergenceView } from './meshconvergence/MeshConvergenceView.js';
import { AboutDialog } from './shell/AboutDialog.js';
import { DatabaseView } from './catalog/DatabaseView.js';
import { findPreset } from './data/catalog.js';
import { useAppStore, type DiagramTab, type MobileTab } from './state/appStore.js';
import { useModelStore } from './state/modelStore.js';
import { useNonlinearStore } from './state/nonlinearStore.js';
import { combinedSteps, runNonlinearEditableModel } from './model/nonlinear.js';
import { DiagramPanel } from './charts/DiagramPanel.js';

const DIAGRAM_TABS: readonly { id: DiagramTab; label: string }[] = [
  { id: 'M', label: 'M' },
  { id: 'T', label: 'T' },
  { id: 'w', label: 'w' },
  { id: 'phi', label: 'φ' },
  { id: 'stress3d', label: '3D feszültség' },
  { id: 'load-displacement', label: 'teher–elmozdulás' },
  { id: 'convergence', label: 'konvergencia' },
  { id: 'modal', label: 'modális' },
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
  const preset = findPreset(model.presetId);

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

  // A modell BÁRMELY módosítása azonnal érvényteleníti a nemlineáris
  // eredményt (appStore.ts fejléce: "az elavult eredmény nem maradhat
  // érvényesként a képernyőn").
  useEffect(
    () =>
      useModelStore.subscribe((state, prev) => {
        if (state.model === prev.model) return;
        if (useNonlinearStore.getState().run === null) return;
        useNonlinearStore.getState().clear();
        useAppStore.getState().setStatus('editing', 'a modell módosult — futtasd újra (F5)');
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
      } else if (e.key === 'Escape' && s.databaseOpen) {
        e.preventDefault();
        s.setDatabaseOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [run, undo, redo, removeSelected, selection, s]);

  const menus: readonly Menu[] = [
    {
      label: 'Fájl',
      items: [
        { label: 'Levezetés megnyitása', onSelect: openDerivation, separatorAfter: true },
        { label: 'Jegyzőkönyv megnyitása', onSelect: openReport, separatorAfter: true },
        { label: 'Export: Word (.docx)', disabled: true },
        { label: 'Export: PDF', disabled: true },
        { label: 'Modell letöltése (.femati.json)', disabled: true },
      ],
    },
    {
      label: 'Szerkesztés',
      items: [
        { label: 'Visszavonás', shortcut: 'Ctrl+Z', onSelect: undo, disabled: !canUndo },
        { label: 'Újra', shortcut: 'Ctrl+Y', onSelect: redo, disabled: !canRedo },
        { label: 'Kijelölt elem törlése', shortcut: 'Del', onSelect: removeSelected, disabled: selection === null, separatorAfter: true },
        { label: 'Szelvény, anyag adatbázis', onSelect: () => s.setDatabaseOpen(true) },
      ],
    },
    {
      label: 'Nézet',
      items: [
        { label: 'Bal panel', shortcut: 'Ctrl+1', disabled: true },
        { label: 'Jobb panel', shortcut: 'Ctrl+3', disabled: true },
        {
          label: s.showGaussPoints ? 'Gauss-pontok elrejtése' : 'Gauss-pontok megjelenítése',
          onSelect: () => s.setShowGaussPoints(!s.showGaussPoints),
        },
        {
          label: s.momentTensionSide ? 'M ábra: normál oldal' : 'M ábra: húzott oldal',
          onSelect: () => s.setMomentTensionSide(!s.momentTensionSide),
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
        {
          label: 'Reziduális erők (REFORB)',
          onSelect: () => s.openTheory('reforb'),
          separatorAfter: true,
        },
        { label: 'Történelmi mód: frontális megoldó', onSelect: openHistorical, separatorAfter: true },
      ],
    },
    {
      label: 'Súgó',
      items: [
        { label: 'Névjegy', onSelect: () => s.setAboutOpen(true) },
      ],
    },
  ];

  return (
    <div className="vem-app">
      <header className="vem-chrome">
        <div className="vem-chrome__brand">
          <Logo variant="mark" theme="dark" size={20} />
          <div className="vem-chrome__name">FEMAti</div>
          <div className="vem-chrome__subtitle">Timoshenko gerenda · rugalmas–képlékeny analízis</div>
        </div>
        <MenuBar menus={menus} />
        <div className="vem-chrome__spacer" />
        <div className="vem-chrome__file">{preset.id}.femati.json</div>
        <StatusPill status={s.status} detail={s.statusDetail} />
      </header>

      <Toolbar onRun={run} onOpenReport={openReport} />

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

      <main className="vem-main" data-mobile-tab={s.mobileTab}>
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
      <DatabaseView />
    </div>
  );
}
