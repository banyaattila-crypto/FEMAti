import { Button, SegmentedControl } from '../components/Button.js';
import { Combobox } from '../components/Combobox.js';
import { Select, Slider } from '../components/Field.js';
import { PRESETS, findPreset } from '../data/catalog.js';
import { materialComboOptions, sectionComboOptions } from '../data/catalogIcons.js';
import { useAppStore } from '../state/appStore.js';
import { useModelStore } from '../state/modelStore.js';
import * as fmt from '../format/numbers.js';

interface CellProps {
  readonly caption: string;
  /** `| undefined` szükséges: exactOptionalPropertyTypes mellett a feltételes
   *  prop-átadás (`hint={cond ? x : undefined}`) különben típushibát ad. */
  readonly hint?: string | undefined;
  readonly minWidth: number;
  readonly children: React.ReactNode;
}

function Cell({ caption, hint, minWidth, children }: CellProps): JSX.Element {
  return (
    <div className="vem-toolbar__cell" style={{ minWidth }}>
      <div className="vem-toolbar__caption">
        <span>{caption}</span>
        {hint ? <span className="vem-num">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export interface ToolbarProps {
  readonly onRun: () => void;
  readonly onOpenReport: () => void;
}

/**
 * Eszközsor — DESIGN-TERV 3.1. Cellákra osztott, minden cella alján
 * UPPERCASE kategória-címkével. Tördelhető (`flex-wrap`).
 */
export function Toolbar({ onRun, onOpenReport }: ToolbarProps): JSX.Element {
  const s = useAppStore();
  const model = useModelStore((st) => st.model);
  const loadPreset = useModelStore((st) => st.loadPreset);
  const setSpan = useModelStore((st) => st.setSpan);
  const setElementCount = useModelStore((st) => st.setElementCount);
  const setSectionId = useModelStore((st) => st.setSectionId);
  const setMaterialId = useModelStore((st) => st.setMaterialId);
  const setIntegration = useModelStore((st) => st.setIntegration);
  const undo = useModelStore((st) => st.undo);
  const redo = useModelStore((st) => st.redo);
  const canUndo = useModelStore((st) => st.canUndo);
  const canRedo = useModelStore((st) => st.canRedo);
  const preset = findPreset(model.presetId);
  const running = s.status === 'running';

  return (
    <div className="vem-toolbar">
      <Cell caption="Szerkezet" hint={`ref. ${preset.ref}`} minWidth={236}>
        <Select
          ariaLabel="Statikai váz"
          value={model.presetId}
          onChange={loadPreset}
          options={PRESETS.map((p) => ({ value: p.id, label: p.name }))}
        />
      </Cell>

      <Cell caption="Geometria" minWidth={206}>
        <Slider
          label="Fesztáv L [m]"
          min={2}
          max={16}
          step={0.5}
          value={model.span}
          onChange={setSpan}
          display={fmt.length(model.span).value}
          editable
        />
      </Cell>

      <Cell caption="Szelvény · anyag" minWidth={252}>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Combobox ariaLabel="Keresztmetszet" value={model.sectionId} onChange={setSectionId} options={sectionComboOptions()} />
          <Combobox ariaLabel="Anyag" value={model.materialId} onChange={setMaterialId} options={materialComboOptions()} />
        </div>
      </Cell>

      <Cell caption="Háló" minWidth={216}>
        <Slider
          label="Elemszám"
          min={4}
          max={100}
          step={2}
          value={model.elementCount}
          onChange={setElementCount}
          display={`${model.elementCount} elem`}
        />
      </Cell>

      <Cell caption="Integrálás (záródás)" minWidth={196}>
        <SegmentedControl
          ariaLabel="Integrálási séma"
          value={model.integration}
          onChange={setIntegration}
          options={[
            {
              value: 'selective',
              label: 'szelektív',
              title: 'Hajlítás 3 pont, nyírás 2 pont — a záródás (shear locking) ellen',
            },
            { value: 'full', label: 'teljes', title: 'Mindkét tag 3 pontos integrálással' },
          ]}
        />
      </Cell>

      <Cell
        caption="Tehertörténet"
        hint={s.loadHistory === 'unloading' ? `λ→${s.peakLambda.toFixed(2)}→0` : undefined}
        minWidth={238}
      >
        <SegmentedControl
          ariaLabel="Tehertörténet"
          value={s.loadHistory}
          onChange={s.setLoadHistory}
          options={[
            { value: 'monotonic', label: 'monoton' },
            {
              value: 'unloading',
              label: 'tehermentesítés',
              title: 'Terhelés a csúcsig, majd tehermentesítés — sajátfeszültségek és beállás',
            },
          ]}
        />
      </Cell>

      <div className="vem-toolbar__headline" aria-hidden="true">
        Rugalmas–képlékeny Timoshenko-gerenda végeselemes analízis
      </div>

      <div className="vem-toolbar__actions">
        <Button onClick={undo} disabled={!canUndo} title="Visszavonás (Ctrl+Z)" ariaLabel="Visszavonás">
          ↶
        </Button>
        <Button onClick={redo} disabled={!canRedo} title="Újra (Ctrl+Y)" ariaLabel="Újra">
          ↷
        </Button>
        <Button variant="primary" onClick={onRun} loading={running}>
          SZÁMÍTÁS
        </Button>
        <Button onClick={onOpenReport}>Jegyzőkönyv</Button>
      </div>
    </div>
  );
}
