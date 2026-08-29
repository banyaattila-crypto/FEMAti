import { geometricProperties } from '@femati/fem-core';
import { SegmentedControl } from '../components/Button.js';
import { Checkbox, Slider } from '../components/Field.js';
import { Card, NoteBox } from '../components/Feedback.js';
import { SectionShapeDiagram } from '../components/SectionShapeDiagram.js';
import { findMaterial, findPreset, findSection, UNVERIFIED_WARNING } from '../data/catalog.js';
import { toShape } from '../model/compile.js';
import { useAppStore } from '../state/appStore.js';
import { useModelStore } from '../state/modelStore.js';
import type { EditableLoad, EditableSupport, SupportType } from '../model/editable.js';
import { LoadIcon, SupportIcon } from './icons.js';
import * as fmt from '../format/numbers.js';

const SUPPORT_TYPE_LABEL: Record<SupportType, string> = {
  fixed: 'befogás',
  pinned: 'csuklós',
  roller: 'görgős',
};

/** Támaszok itemlistája — mindegyik sor kattintható, kiválasztja a kapcsolódó vászon-elemet. */
function SupportsList({ supports }: { readonly supports: readonly EditableSupport[] }): JSX.Element {
  const selection = useModelStore((s) => s.selection);
  const select = useModelStore((s) => s.select);

  return (
    <Card title="Támaszok">
      <div className="vem-item-list">
        {supports.length === 0 ? (
          <div className="vem-item-empty">Nincs támasz.</div>
        ) : (
          supports.map((sup) => (
            <button
              type="button"
              key={sup.id}
              className="vem-item-row"
              aria-selected={selection?.kind === 'support' && selection.id === sup.id}
              onClick={() => select({ kind: 'support', id: sup.id })}
            >
              <SupportIcon type={sup.type} />
              <span className="vem-item-label">x = {sup.x.toFixed(2)} m</span>
              <span className="vem-item-value">{SUPPORT_TYPE_LABEL[sup.type]}</span>
            </button>
          ))
        )}
      </div>
    </Card>
  );
}

/** Terhek itemlistája — a `LoadIcon` a teherfajta szerint vált (pont/nyomaték/megoszló). */
function LoadsList({ loads }: { readonly loads: readonly EditableLoad[] }): JSX.Element {
  const selection = useModelStore((s) => s.selection);
  const select = useModelStore((s) => s.select);

  const rowText = (load: EditableLoad): { readonly label: string; readonly value: string } => {
    if (load.kind === 'point') return { label: `x = ${load.x.toFixed(2)} m`, value: `P = ${load.p.toFixed(0)} kN` };
    if (load.kind === 'moment') return { label: `x = ${load.x.toFixed(2)} m`, value: `M = ${load.m.toFixed(0)} kNm` };
    const qLabel = load.q1 === load.q2 ? `q = ${load.q1.toFixed(0)} kN/m` : `q = ${load.q1.toFixed(0)}→${load.q2.toFixed(0)} kN/m`;
    return { label: `${load.x1.toFixed(2)}–${load.x2.toFixed(2)} m`, value: qLabel };
  };

  return (
    <Card title="Terhek">
      <div className="vem-item-list">
        {loads.length === 0 ? (
          <div className="vem-item-empty">Nincs teher.</div>
        ) : (
          loads.map((load) => {
            const { label, value } = rowText(load);
            return (
              <button
                type="button"
                key={load.id}
                className="vem-item-row"
                aria-selected={selection?.kind === 'load' && selection.id === load.id}
                onClick={() => select({ kind: 'load', id: load.id })}
              >
                <LoadIcon kind={load.kind} />
                <span className="vem-item-label">{label}</span>
                <span className="vem-item-value">{value}</span>
              </button>
            );
          })
        )}
      </div>
    </Card>
  );
}

/** A vászonon kijelölt támasz/teher szerkeszthető adatlapja. */
function SelectionSheet(): JSX.Element | null {
  const selection = useModelStore((s) => s.selection);
  const model = useModelStore((s) => s.model);
  const setSupportType = useModelStore((s) => s.setSupportType);
  const setLoadMagnitude = useModelStore((s) => s.setLoadMagnitude);
  const setDistributedLoadMagnitudes = useModelStore((s) => s.setDistributedLoadMagnitudes);
  const removeSelected = useModelStore((s) => s.removeSelected);

  if (selection === null) return null;

  if (selection.kind === 'support') {
    const support = model.supports.find((s) => s.id === selection.id);
    if (support === undefined) return null;
    return (
      <Card title="Kijelölt támasz">
        <div className="vem-panel__body--padded">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            x = {support.x.toFixed(2)} m
          </div>
          <SegmentedControl
            ariaLabel="Támasz típusa"
            value={support.type}
            onChange={(v) => setSupportType(support.id, v)}
            options={[
              { value: 'pinned', label: 'csuklós' },
              { value: 'roller', label: 'görgős' },
              { value: 'fixed', label: 'befogás' },
            ]}
          />
          <button type="button" className="vem-btn vem-btn--sm" style={{ marginTop: 8 }} onClick={removeSelected}>
            Támasz törlése
          </button>
        </div>
      </Card>
    );
  }

  const load = model.loads.find((l) => l.id === selection.id);
  if (load === undefined) return null;
  return (
    <Card title="Kijelölt teher">
      <div className="vem-panel__body--padded">
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
          {load.kind === 'point'
            ? `pontteher, x = ${load.x.toFixed(2)} m`
            : load.kind === 'moment'
              ? `nyomatékteher, x = ${load.x.toFixed(2)} m`
              : `megoszló teher, ${load.x1.toFixed(2)}–${load.x2.toFixed(2)} m`}
        </div>
        {load.kind === 'point' ? (
          <Slider
            label="P [kN]"
            min={1}
            max={200}
            step={0.01}
            value={load.p}
            onChange={(v) => setLoadMagnitude(load.id, v)}
            display={`${load.p.toFixed(0)} kN`}
            editable
          />
        ) : load.kind === 'moment' ? (
          <Slider
            label="M [kNm]"
            min={1}
            max={200}
            step={0.01}
            value={load.m}
            onChange={(v) => setLoadMagnitude(load.id, v)}
            display={`${load.m.toFixed(0)} kNm`}
            editable
          />
        ) : (
          <>
            <Slider
              label="q₁ (kezdet) [kN/m]"
              min={1}
              max={100}
              step={0.01}
              value={load.q1}
              onChange={(v) => setDistributedLoadMagnitudes(load.id, v, load.q2)}
              display={`${load.q1.toFixed(0)} kN/m`}
              editable
            />
            <Slider
              label="q₂ (vég) [kN/m]"
              min={1}
              max={100}
              step={0.01}
              value={load.q2}
              onChange={(v) => setDistributedLoadMagnitudes(load.id, load.q1, v)}
              display={`${load.q2.toFixed(0)} kN/m`}
              editable
            />
          </>
        )}
        <button type="button" className="vem-btn vem-btn--sm" style={{ marginTop: 8 }} onClick={removeSelected}>
          Teher törlése
        </button>
      </div>
    </Card>
  );
}

export function LeftPanel(): JSX.Element {
  const s = useAppStore();
  const model = useModelStore((state) => state.model);
  const setSelfWeight = useModelStore((state) => state.setSelfWeight);
  const section = findSection(model.sectionId);
  const material = findMaterial(model.materialId);
  const sectionProps = geometricProperties(toShape(section));

  const tree: readonly { label: string; value: string }[] = [
    { label: 'Geometria', value: `${fmt.length(model.span).value} m` },
    { label: 'Anyag', value: material.id },
    { label: 'Szelvény', value: section.name },
    { label: 'Háló', value: `${model.elementCount} elem` },
    { label: 'Megoldó', value: s.algorithm === 'newton' ? 'Newton' : 'mód. Newton' },
  ];

  const dofCount = 2 * (2 * model.elementCount + 1);

  return (
    <aside className="vem-panel vem-panel--left" aria-label="Modell és megoldó">
      <div className="vem-panel__stack">
        <Card title="Modellfa">
          <div className="vem-tree">
            <div className="vem-tree__root">
              <span className="vem-tree__caret" aria-hidden="true">
                ▾
              </span>
              {findPreset(model.presetId).name}
            </div>
            {tree.map((n) => (
              <div className="vem-tree__row" key={n.label}>
                <span className="vem-tree__marker" aria-hidden="true" />
                <span className="vem-tree__label">{n.label}</span>
                <span className="vem-tree__value">{n.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <SupportsList supports={model.supports} />
        <LoadsList loads={model.loads} />

        <SelectionSheet />

        <Card title="Keresztmetszet">
          <div className="vem-section-preview">
            <SectionShapeDiagram section={section} />
            <div className="vem-section-preview__figures">
              <div>A = {(sectionProps.area * 1e4).toFixed(2)} cm²</div>
              <div>I = {(sectionProps.inertia * 1e8).toFixed(0)} cm⁴</div>
            </div>
          </div>
          <div style={{ padding: '0 var(--space-5)' }}>
            <NoteBox tone={material.verified && section.verified ? 'info' : 'warn'}>
              {section.aCat !== undefined
                ? 'A rétegelt modell A és I értéke a valós kontúrból számítódik, ezért kis mértékben eltér a szelvénytáblázat lekerekítéseket is tartalmazó adataitól.'
                : 'Parametrikus keresztmetszet: A és I a megadott méretekből számítódik.'}
              {!material.verified || !section.verified ? ` ${UNVERIFIED_WARNING}` : ''}
              {material.verified ? '' : ` Anyag (${material.name}): ${material.source}.`}
              {section.verified ? '' : ` Szelvény (${section.name}): ${section.source}.`}
            </NoteBox>
          </div>
        </Card>

        <Card title="Megoldó">
          <div className="vem-panel__body--padded">
            <SegmentedControl
              ariaLabel="Megoldó algoritmus"
              value={s.algorithm}
              onChange={s.setAlgorithm}
              options={[
                { value: 'newton', label: 'Newton', title: 'KT minden iterációban újraszámolva' },
                {
                  value: 'modified-newton',
                  label: 'mód. Newton',
                  title: 'KT teherlépcsőnként egyszer — a diplomaterv 10. oldalának lábjegyzete',
                },
              ]}
            />
            <Slider
              label={`Teherlépcső Δλ = ${s.loadStep.toFixed(2)}`}
              min={0.02}
              max={0.25}
              step={0.01}
              value={s.loadStep}
              onChange={s.setLoadStep}
              display={s.loadStep.toFixed(2)}
            />
            <Slider
              label={`Tolerancia ${s.tolerance.toFixed(2)} %`}
              min={0.05}
              max={2}
              step={0.05}
              value={s.tolerance}
              onChange={s.setTolerance}
              display={s.tolerance.toFixed(2)}
            />
            <Slider
              label={`Csúcs-teherszorzó λ_cél = ${s.peakLambda.toFixed(2)}`}
              min={0.5}
              max={3}
              step={0.05}
              value={s.peakLambda}
              onChange={s.setPeakLambda}
              display={s.peakLambda.toFixed(2)}
            />
            <Checkbox label="önsúly figyelembevétele" checked={model.selfWeight} onChange={setSelfWeight} />
            <Checkbox label="Gauss-pontok megjelenítése" checked={s.showGaussPoints} onChange={s.setShowGaussPoints} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {dofCount} szabadságfok
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
              A nemlineáris futtatás (SZÁMÍTÁS / F5) mindig a rétegelt keresztmetszeti modellel fut —
              ez adja a keresztmetszet-inspektor rétegenkénti adatait.
            </div>
          </div>
        </Card>
      </div>
    </aside>
  );
}
