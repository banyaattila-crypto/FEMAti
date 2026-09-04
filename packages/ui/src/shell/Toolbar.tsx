import { SegmentedControl } from '../components/Button.js';
import { Combobox } from '../components/Combobox.js';
import { Slider } from '../components/Field.js';
import { findPreset } from '../data/catalog.js';
import { materialComboOptions, presetComboOptions, sectionComboOptions } from '../data/catalogIcons.js';
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

/**
 * Eszközsor — DESIGN-TERV 3.1. Cellákra osztott, minden cella alján
 * UPPERCASE kategória-címkével. Tördelhető (`flex-wrap`).
 */
export function Toolbar(): JSX.Element {
  const s = useAppStore();
  const model = useModelStore((st) => st.model);
  const loadPreset = useModelStore((st) => st.loadPreset);
  const setSpan = useModelStore((st) => st.setSpan);
  const setElementCount = useModelStore((st) => st.setElementCount);
  const setSectionId = useModelStore((st) => st.setSectionId);
  const setMaterialId = useModelStore((st) => st.setMaterialId);
  const setIntegration = useModelStore((st) => st.setIntegration);
  const preset = findPreset(model.presetId);
  const spanUnit = fmt.editableLength();

  return (
    <div className="vem-toolbar">
      <Cell caption="Szerkezet" hint={`ref. ${preset.ref}`} minWidth={236}>
        <Combobox ariaLabel="Statikai váz" value={model.presetId} onChange={loadPreset} options={presetComboOptions()} />
      </Cell>

      <Cell caption="Geometria" minWidth={206}>
        <Slider
          label={`Fesztáv L [${spanUnit.unit}]`}
          min={spanUnit.toDisplay(2)}
          max={spanUnit.toDisplay(16)}
          step={spanUnit.toDisplay(0.5)}
          value={spanUnit.toDisplay(model.span)}
          onChange={(v) => setSpan(spanUnit.toCore(v))}
          display={`${spanUnit.toDisplay(model.span).toFixed(2)} ${spanUnit.unit}`}
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
        minWidth={205}
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
    </div>
  );
}
