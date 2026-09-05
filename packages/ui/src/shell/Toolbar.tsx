import { SegmentedControl } from '../components/Button.js';
import { Combobox } from '../components/Combobox.js';
import { Slider } from '../components/Field.js';
import { findPreset } from '../data/catalog.js';
import { materialComboOptions, presetComboOptions, sectionComboOptions } from '../data/catalogIcons.js';
import { useAppStore } from '../state/appStore.js';
import { useModelStore } from '../state/modelStore.js';
import * as fmt from '../format/numbers.js';
import { SHELL } from '../i18n/shell.js';

interface CellProps {
  readonly caption: string;
  /** `| undefined` szükséges: exactOptionalPropertyTypes mellett a feltételes
   *  prop-átadás (`hint={cond ? x : undefined}`) különben típushibát ad. */
  readonly hint?: string | undefined;
  readonly minWidth: number;
  /** Csak akkor kell, ha a cella tartalma változó hosszúságú szöveget mutathat
   *  (pl. a Szerkezet-kombobox preset-neve) — enélkül egy hosszú szöveg
   *  korlátlanul megnövelné a cella "kívánt" szélességét, ami az egész
   *  eszközsort tördelésre kényszerítené, mielőtt a combobox saját ellipszis-
   *  csonkolása érvénybe léphetne (2026-09-05, felhasználó jelentette hiba). */
  readonly maxWidth?: number | undefined;
  readonly children: React.ReactNode;
}

function Cell({ caption, hint, minWidth, maxWidth, children }: CellProps): JSX.Element {
  return (
    <div className="vem-toolbar__cell" style={{ minWidth, maxWidth }}>
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
 * UPPERCASE kategória-címkével. SOSEM törik új sorba (`shell.css`
 * `.vem-toolbar` — `flex-wrap: nowrap` + `overflow-x: auto`, 2026-09-05) —
 * ha nem fér ki minden cella, a sor vízszintesen görgethető.
 */
export function Toolbar(): JSX.Element {
  const s = useAppStore();
  const t = SHELL[s.lang];
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
      <Cell caption={t.toolbarStructure} hint={`ref. ${preset.ref}`} minWidth={236} maxWidth={236}>
        <Combobox ariaLabel={t.staticSchemeAria} value={model.presetId} onChange={loadPreset} options={presetComboOptions(s.lang)} />
      </Cell>

      <Cell caption={t.toolbarGeometry} minWidth={206}>
        <Slider
          label={t.spanLabel(spanUnit.unit)}
          min={spanUnit.toDisplay(2)}
          max={spanUnit.toDisplay(16)}
          step={spanUnit.toDisplay(0.5)}
          value={spanUnit.toDisplay(model.span)}
          onChange={(v) => setSpan(spanUnit.toCore(v))}
          display={`${spanUnit.toDisplay(model.span).toFixed(2)} ${spanUnit.unit}`}
          editable
        />
      </Cell>

      <Cell caption={t.toolbarSectionMaterial} minWidth={252}>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Combobox ariaLabel={t.crossSectionAria} value={model.sectionId} onChange={setSectionId} options={sectionComboOptions(s.lang)} />
          <Combobox ariaLabel={t.materialAria} value={model.materialId} onChange={setMaterialId} options={materialComboOptions(s.lang)} />
        </div>
      </Cell>

      <Cell caption={t.toolbarMesh} minWidth={216}>
        <Slider
          label={t.elementCountLabel}
          min={4}
          max={100}
          step={2}
          value={model.elementCount}
          onChange={setElementCount}
          display={t.elementCountDisplay(model.elementCount)}
        />
      </Cell>

      <Cell caption={t.toolbarIntegration} minWidth={196}>
        <SegmentedControl
          ariaLabel={t.integrationAria}
          value={model.integration}
          onChange={setIntegration}
          options={[
            {
              value: 'selective',
              label: t.integrationSelective,
              title: t.integrationSelectiveTitle,
            },
            { value: 'full', label: t.integrationFull, title: t.integrationFullTitle },
          ]}
        />
      </Cell>

      <Cell
        caption={t.toolbarLoadHistory}
        hint={s.loadHistory === 'unloading' ? `λ→${s.peakLambda.toFixed(2)}→0` : undefined}
        minWidth={205}
      >
        <SegmentedControl
          ariaLabel={t.loadHistoryAria}
          value={s.loadHistory}
          onChange={s.setLoadHistory}
          options={[
            { value: 'monotonic', label: t.loadHistoryMonotonic },
            {
              value: 'unloading',
              label: t.loadHistoryUnloading,
              title: t.loadHistoryUnloadingTitle,
            },
          ]}
        />
      </Cell>
    </div>
  );
}
