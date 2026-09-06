import { useState } from 'react';
import { geometricProperties } from '@femati/fem-core';
import { SegmentedControl } from '../components/Button.js';
import { Checkbox, Slider } from '../components/Field.js';
import { Combobox } from '../components/Combobox.js';
import { Card, NoteBox } from '../components/Feedback.js';
import { SectionShapeDiagram } from '../components/SectionShapeDiagram.js';
import { findMaterial, findSection, dimensionRowsFor, shearModulus } from '../data/catalog.js';
import { materialComboOptions } from '../data/catalogIcons.js';
import { presetDisplayName, sectionKindGroupLabel } from '../i18n/catalog.js';
import { catalogName, catalogText, DATABASE, SOURCE_EN } from '../i18n/database.js';
import { compositeSectionStiffness, toShape } from '../model/compile.js';
import { findSmallestSuitableSection, type OptimizeResult } from '../model/optimize.js';
import { useAppStore } from '../state/appStore.js';
import { useModelStore } from '../state/modelStore.js';
import { DEFAULT_SPRING_STIFFNESS, type EditableFoundation, type EditableLoad, type EditableSupport } from '../model/editable.js';
import { loadRowLabel } from '../model/loadLabel.js';
import { LoadIcon, SupportIcon } from './icons.js';
import * as fmt from '../format/numbers.js';
import { PANELS, SUPPORT_TYPE_LABEL } from '../i18n/panels.js';

/** Támaszok itemlistája — mindegyik sor kattintható, kiválasztja a kapcsolódó vászon-elemet. */
function SupportsList({ supports }: { readonly supports: readonly EditableSupport[] }): JSX.Element {
  const selection = useModelStore((s) => s.selection);
  const select = useModelStore((s) => s.select);
  const lang = useAppStore((s) => s.lang);
  const t = PANELS[lang];
  const L = fmt.editableLength();
  const K = fmt.editableLinearLoad();

  return (
    <Card title={t.supportsCardTitle} accent="support">
      <div className="vem-item-list">
        {supports.length === 0 ? (
          <div className="vem-item-empty">{t.noSupports}</div>
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
              <span className="vem-item-label">x = {L.toDisplay(sup.x).toFixed(2)} {L.unit}</span>
              <span className="vem-item-value">
                {sup.type === 'spring'
                  ? `k = ${K.toDisplay(sup.k ?? DEFAULT_SPRING_STIFFNESS).toFixed(0)} ${K.unit}`
                  : SUPPORT_TYPE_LABEL[lang][sup.type]}
              </span>
            </button>
          ))
        )}
      </div>
    </Card>
  );
}

/** Winkler-ágyazatok itemlistája — a Támaszok kártya alatt, önálló entitáskategória. */
function FoundationsList({ foundations }: { readonly foundations: readonly EditableFoundation[] }): JSX.Element | null {
  const selection = useModelStore((s) => s.selection);
  const select = useModelStore((s) => s.select);
  const t = PANELS[useAppStore((s) => s.lang)];
  const L = fmt.editableLength();
  const C = fmt.editableFoundationModulus();
  if (foundations.length === 0) return null;

  return (
    <Card title={t.foundationsCardTitle} accent="foundation">
      <div className="vem-item-list">
        {foundations.map((f) => (
          <button
            type="button"
            key={f.id}
            className="vem-item-row"
            aria-selected={selection?.kind === 'foundation' && selection.id === f.id}
            onClick={() => select({ kind: 'foundation', id: f.id })}
          >
            <span className="vem-item-label">
              {L.toDisplay(f.x1).toFixed(2)}–{L.toDisplay(f.x2).toFixed(2)} {L.unit}
              {f.noTension ? ' · no-tension' : ''}
            </span>
            <span className="vem-item-value">c = {C.toDisplay(f.c).toFixed(0)} {C.unit}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

/** Terhek itemlistája — a `LoadIcon` a teherfajta szerint vált (pont/nyomaték/megoszló). */
function LoadsList({ loads }: { readonly loads: readonly EditableLoad[] }): JSX.Element {
  const selection = useModelStore((s) => s.selection);
  const select = useModelStore((s) => s.select);
  const t = PANELS[useAppStore((s) => s.lang)];
  const rowText = loadRowLabel;

  return (
    <Card title={t.loadsCardTitle} accent="load">
      <div className="vem-item-list">
        {loads.length === 0 ? (
          <div className="vem-item-empty">{t.noLoads}</div>
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

/** A vászonon kijelölt támasz/teher/ágyazat szerkeszthető adatlapja. */
function SelectionSheet(): JSX.Element | null {
  const lang = useAppStore((s) => s.lang);
  const t = PANELS[lang];
  const selection = useModelStore((s) => s.selection);
  const model = useModelStore((s) => s.model);
  const setSupportType = useModelStore((s) => s.setSupportType);
  const setSpringStiffness = useModelStore((s) => s.setSpringStiffness);
  const setSupportDisplacement = useModelStore((s) => s.setSupportDisplacement);
  const moveSupport = useModelStore((s) => s.moveSupport);
  const setLoadPosition = useModelStore((s) => s.setLoadPosition);
  const setLoadRange = useModelStore((s) => s.setLoadRange);
  const setLoadMagnitude = useModelStore((s) => s.setLoadMagnitude);
  const setDistributedLoadMagnitudes = useModelStore((s) => s.setDistributedLoadMagnitudes);
  const setDistributedMomentMagnitudes = useModelStore((s) => s.setDistributedMomentMagnitudes);
  const setLoadCategory = useModelStore((s) => s.setLoadCategory);
  const setFoundationRange = useModelStore((s) => s.setFoundationRange);
  const setFoundationStiffness = useModelStore((s) => s.setFoundationStiffness);
  const setFoundationNoTension = useModelStore((s) => s.setFoundationNoTension);
  const removeSelected = useModelStore((s) => s.removeSelected);
  const L = fmt.editableLength();
  const SL = fmt.editableSmallLength();
  const F = fmt.editableForce();
  const M = fmt.editableMoment();
  const Q = fmt.editableLinearLoad();
  const MPL = fmt.editableMomentPerLength();
  const C = fmt.editableFoundationModulus();

  if (selection === null) return null;

  if (selection.kind === 'support') {
    const support = model.supports.find((s) => s.id === selection.id);
    if (support === undefined) return null;
    const dzEnabled = support.dz !== undefined;
    const dPhiEnabled = support.dPhi !== undefined;
    return (
      <Card title={t.selectedSupportCardTitle} accent="support">
        <div className="vem-panel__body--padded">
          <Slider
            label={`x [${L.unit}]`}
            min={L.toDisplay(0)}
            max={L.toDisplay(model.span)}
            step={L.toDisplay(0.01)}
            value={L.toDisplay(support.x)}
            onChange={(v) => moveSupport(support.id, L.toCore(v))}
            display={`${L.toDisplay(support.x).toFixed(2)} ${L.unit}`}
            editable
          />
          <SegmentedControl
            ariaLabel={t.supportTypeAria}
            value={support.type}
            onChange={(v) => setSupportType(support.id, v)}
            options={[
              { value: 'pinned', label: SUPPORT_TYPE_LABEL[lang].pinned },
              { value: 'roller', label: SUPPORT_TYPE_LABEL[lang].roller },
              { value: 'fixed', label: SUPPORT_TYPE_LABEL[lang].fixed },
              { value: 'spring', label: SUPPORT_TYPE_LABEL[lang].spring },
            ]}
          />
          {support.type === 'spring' ? (
            <Slider
              label={`k [${Q.unit}]`}
              min={Q.toDisplay(100)}
              max={Q.toDisplay(50000)}
              step={Q.toDisplay(100)}
              value={Q.toDisplay(support.k ?? DEFAULT_SPRING_STIFFNESS)}
              onChange={(v) => setSpringStiffness(support.id, Q.toCore(v))}
              display={`${Q.toDisplay(support.k ?? DEFAULT_SPRING_STIFFNESS).toFixed(0)} ${Q.unit}`}
              editable
            />
          ) : null}
          {/* Két FÜGGETLEN jelölőnégyzet (nem egy közös) — a dz/dPhi a fem-core
              `supportDisplacement()`-ben egymástól függetlenül opcionális, és
              egy meg NEM adott komponens nem jelent kényszert. Ha a kettő egy
              checkbox mögé lenne összevonva, a bepipálás dPhi=0-t is beállítana
              olyan csuklós/görgős támasznál is, ahol a φ szabadságfok EDDIG
              szabad volt — ez hallgatólagosan befogássá alakítaná a támaszt. */}
          <Checkbox
            label={t.dzCheckbox}
            checked={dzEnabled}
            onChange={(v) => setSupportDisplacement(support.id, v ? 0 : undefined, support.dPhi)}
          />
          {dzEnabled ? (
            <Slider
              label={t.dzLabel(SL.unit)}
              min={SL.toDisplay(-0.05)}
              max={SL.toDisplay(0.05)}
              step={SL.toDisplay(0.0005)}
              value={SL.toDisplay(support.dz ?? 0)}
              onChange={(v) => setSupportDisplacement(support.id, SL.toCore(v), support.dPhi)}
              display={`${SL.toDisplay(support.dz ?? 0).toFixed(1)} ${SL.unit}`}
              editable
            />
          ) : null}
          <Checkbox
            label={t.dPhiCheckbox}
            checked={dPhiEnabled}
            onChange={(v) => setSupportDisplacement(support.id, support.dz, v ? 0 : undefined)}
          />
          {dPhiEnabled ? (
            <Slider
              label={t.dPhiMradLabel}
              min={-20}
              max={20}
              step={0.1}
              value={(support.dPhi ?? 0) * 1000}
              onChange={(v) => setSupportDisplacement(support.id, support.dz, v / 1000)}
              display={`${((support.dPhi ?? 0) * 1000).toFixed(1)} mrad`}
              editable
            />
          ) : null}
          <button type="button" className="vem-btn vem-btn--sm" style={{ marginTop: 8 }} onClick={removeSelected}>
            {t.deleteSupportBtn}
          </button>
        </div>
      </Card>
    );
  }

  if (selection.kind === 'foundation') {
    const foundation = model.foundations.find((f) => f.id === selection.id);
    if (foundation === undefined) return null;
    return (
      <Card title={t.selectedFoundationCardTitle} accent="foundation">
        <div className="vem-panel__body--padded">
          <Slider
            label={t.rangeStart('x₁', L.unit)}
            min={L.toDisplay(0)}
            max={L.toDisplay(model.span)}
            step={L.toDisplay(0.01)}
            value={L.toDisplay(foundation.x1)}
            onChange={(v) => setFoundationRange(foundation.id, L.toCore(v), foundation.x2)}
            display={`${L.toDisplay(foundation.x1).toFixed(2)} ${L.unit}`}
            editable
          />
          <Slider
            label={t.rangeEnd('x₂', L.unit)}
            min={L.toDisplay(0)}
            max={L.toDisplay(model.span)}
            step={L.toDisplay(0.01)}
            value={L.toDisplay(foundation.x2)}
            onChange={(v) => setFoundationRange(foundation.id, foundation.x1, L.toCore(v))}
            display={`${L.toDisplay(foundation.x2).toFixed(2)} ${L.unit}`}
            editable
          />
          <Slider
            label={`c [${C.unit}]`}
            min={C.toDisplay(100)}
            max={C.toDisplay(20000)}
            step={C.toDisplay(100)}
            value={C.toDisplay(foundation.c)}
            onChange={(v) => setFoundationStiffness(foundation.id, C.toCore(v))}
            display={`${C.toDisplay(foundation.c).toFixed(0)} ${C.unit}`}
            editable
          />
          <Checkbox
            label={t.foundationNoTensionCheckbox}
            checked={foundation.noTension ?? false}
            onChange={(v) => setFoundationNoTension(foundation.id, v)}
          />
          <button type="button" className="vem-btn vem-btn--sm" style={{ marginTop: 8 }} onClick={removeSelected}>
            {t.deleteFoundationBtn}
          </button>
        </div>
      </Card>
    );
  }

  const load = model.loads.find((l) => l.id === selection.id);
  if (load === undefined) return null;
  return (
    <Card title={t.selectedLoadCardTitle} accent="load">
      <div className="vem-panel__body--padded">
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
          {t.loadKindLabel[load.kind]}
        </div>
        {/* Teherkategória (2026-09-04, EN 1990 teherkombináció) — ULS-nél
            γG=1,35 (állandó) vagy γQ=1,5 (esetleges), ld. `model/
            combinations.ts`. Az önsúlynak NINCS ilyen választója, mert az
            szerkezetileg mindig állandó. */}
        <SegmentedControl
          ariaLabel={t.loadCategoryAria}
          value={load.category}
          onChange={(v) => setLoadCategory(load.id, v)}
          options={[
            { value: 'permanent', label: t.loadCategoryPermanent, title: t.loadCategoryPermanentTitle },
            { value: 'variable', label: t.loadCategoryVariable, title: t.loadCategoryVariableTitle },
          ]}
        />
        {load.kind === 'point' ? (
          <>
            <Slider
              label={`x [${L.unit}]`}
              min={L.toDisplay(0)}
              max={L.toDisplay(model.span)}
              step={L.toDisplay(0.01)}
              value={L.toDisplay(load.x)}
              onChange={(v) => setLoadPosition(load.id, L.toCore(v))}
              display={`${L.toDisplay(load.x).toFixed(2)} ${L.unit}`}
              editable
            />
            <Slider
              label={`P [${F.unit}]`}
              min={F.toDisplay(1)}
              max={F.toDisplay(200)}
              step={F.toDisplay(0.01)}
              value={F.toDisplay(load.p)}
              onChange={(v) => setLoadMagnitude(load.id, F.toCore(v))}
              display={`${F.toDisplay(load.p).toFixed(0)} ${F.unit}`}
              editable
            />
          </>
        ) : load.kind === 'moment' ? (
          <>
            <Slider
              label={`x [${L.unit}]`}
              min={L.toDisplay(0)}
              max={L.toDisplay(model.span)}
              step={L.toDisplay(0.01)}
              value={L.toDisplay(load.x)}
              onChange={(v) => setLoadPosition(load.id, L.toCore(v))}
              display={`${L.toDisplay(load.x).toFixed(2)} ${L.unit}`}
              editable
            />
            <Slider
              label={`M [${M.unit}]`}
              min={M.toDisplay(1)}
              max={M.toDisplay(200)}
              step={M.toDisplay(0.01)}
              value={M.toDisplay(load.m)}
              onChange={(v) => setLoadMagnitude(load.id, M.toCore(v))}
              display={`${M.toDisplay(load.m).toFixed(0)} ${M.unit}`}
              editable
            />
          </>
        ) : load.kind === 'distributed' ? (
          <>
            <Slider
              label={t.rangeStart('x₁', L.unit)}
              min={L.toDisplay(0)}
              max={L.toDisplay(model.span)}
              step={L.toDisplay(0.01)}
              value={L.toDisplay(load.x1)}
              onChange={(v) => setLoadRange(load.id, L.toCore(v), load.x2)}
              display={`${L.toDisplay(load.x1).toFixed(2)} ${L.unit}`}
              editable
            />
            <Slider
              label={t.rangeEnd('x₂', L.unit)}
              min={L.toDisplay(0)}
              max={L.toDisplay(model.span)}
              step={L.toDisplay(0.01)}
              value={L.toDisplay(load.x2)}
              onChange={(v) => setLoadRange(load.id, load.x1, L.toCore(v))}
              display={`${L.toDisplay(load.x2).toFixed(2)} ${L.unit}`}
              editable
            />
            <Slider
              label={t.rangeStart('q₁', Q.unit)}
              min={Q.toDisplay(1)}
              max={Q.toDisplay(100)}
              step={Q.toDisplay(0.01)}
              value={Q.toDisplay(load.q1)}
              onChange={(v) => setDistributedLoadMagnitudes(load.id, Q.toCore(v), load.q2)}
              display={`${Q.toDisplay(load.q1).toFixed(0)} ${Q.unit}`}
              editable
            />
            <Slider
              label={t.rangeEnd('q₂', Q.unit)}
              min={Q.toDisplay(1)}
              max={Q.toDisplay(100)}
              step={Q.toDisplay(0.01)}
              value={Q.toDisplay(load.q2)}
              onChange={(v) => setDistributedLoadMagnitudes(load.id, load.q1, Q.toCore(v))}
              display={`${Q.toDisplay(load.q2).toFixed(0)} ${Q.unit}`}
              editable
            />
          </>
        ) : (
          <>
            <Slider
              label={t.rangeStart('x₁', L.unit)}
              min={L.toDisplay(0)}
              max={L.toDisplay(model.span)}
              step={L.toDisplay(0.01)}
              value={L.toDisplay(load.x1)}
              onChange={(v) => setLoadRange(load.id, L.toCore(v), load.x2)}
              display={`${L.toDisplay(load.x1).toFixed(2)} ${L.unit}`}
              editable
            />
            <Slider
              label={t.rangeEnd('x₂', L.unit)}
              min={L.toDisplay(0)}
              max={L.toDisplay(model.span)}
              step={L.toDisplay(0.01)}
              value={L.toDisplay(load.x2)}
              onChange={(v) => setLoadRange(load.id, load.x1, L.toCore(v))}
              display={`${L.toDisplay(load.x2).toFixed(2)} ${L.unit}`}
              editable
            />
            <Slider
              label={t.rangeStart('m₁', MPL.unit)}
              min={MPL.toDisplay(0.1)}
              max={MPL.toDisplay(50)}
              step={MPL.toDisplay(0.01)}
              value={MPL.toDisplay(load.m1)}
              onChange={(v) => setDistributedMomentMagnitudes(load.id, MPL.toCore(v), load.m2)}
              display={`${MPL.toDisplay(load.m1).toFixed(1)} ${MPL.unit}`}
              editable
            />
            <Slider
              label={t.rangeEnd('m₂', MPL.unit)}
              min={MPL.toDisplay(0.1)}
              max={MPL.toDisplay(50)}
              step={MPL.toDisplay(0.01)}
              value={MPL.toDisplay(load.m2)}
              onChange={(v) => setDistributedMomentMagnitudes(load.id, load.m1, MPL.toCore(v))}
              display={`${MPL.toDisplay(load.m2).toFixed(1)} ${MPL.unit}`}
              editable
            />
          </>
        )}
        <button type="button" className="vem-btn vem-btn--sm" style={{ marginTop: 8 }} onClick={removeSelected}>
          {t.deleteLoadBtn}
        </button>
      </div>
    </Card>
  );
}

export function LeftPanel(): JSX.Element {
  const s = useAppStore();
  const t = PANELS[s.lang];
  const model = useModelStore((state) => state.model);
  const setSelfWeight = useModelStore((state) => state.setSelfWeight);
  const setThermalLoad = useModelStore((state) => state.setThermalLoad);
  const setAxialForce = useModelStore((state) => state.setAxialForce);
  const setMovingLoad = useModelStore((state) => state.setMovingLoad);
  const setSeismic = useModelStore((state) => state.setSeismic);
  const setRebar = useModelStore((state) => state.setRebar);
  const setComposite = useModelStore((state) => state.setComposite);
  const setSectionId = useModelStore((state) => state.setSectionId);
  const section = findSection(model.sectionId);
  const material = findMaterial(model.materialId);
  const sectionProps = geometricProperties(toShape(section));
  const compositeStiffness = model.composite.enabled ? compositeSectionStiffness(model) : null;
  const A = fmt.editableArea();
  const SL = fmt.editableSmallLength();
  const T = fmt.editableTemperature();
  const F = fmt.editableForce();

  /** A "legkisebb megfelelő szelvény" keresés eredménye — lokális, effemer UI-állapot (nem globális store: nem kell perzisztálni/undo-zni, egyszeri gombnyomás-eredmény). */
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null);

  const tree: readonly { label: string; value: string }[] = [
    { label: t.treeGeometryLabel, value: `${fmt.length(model.span).value} ${fmt.length(model.span).unit}` },
    { label: t.treeMaterialLabel, value: material.id },
    { label: t.treeSectionLabel, value: catalogName(section.name, s.lang) },
    { label: t.treeMeshLabel, value: t.elementsValue(model.elementCount) },
    { label: t.treeSolverLabel, value: s.algorithm === 'newton' ? t.newtonLabel : t.modNewtonLabel },
  ];

  const dofCount = 2 * (2 * model.elementCount + 1);

  return (
    <aside className="vem-panel vem-panel--left" aria-label={t.panelAria}>
      <div className="vem-panel__stack">
        <Card title={t.modelTreeCardTitle}>
          <div className="vem-tree">
            <div className="vem-tree__root">
              <span className="vem-tree__caret" aria-hidden="true">
                ▾
              </span>
              {presetDisplayName(model.presetId, s.lang)}
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
        <FoundationsList foundations={model.foundations} />
        <LoadsList loads={model.loads} />

        <SelectionSheet />

        <Card title={t.sectionCardTitle} accent="section">
          <div className="vem-section-preview">
            <SectionShapeDiagram section={section} />
            <div className="vem-section-preview__figures">
              <div className="vem-section-preview__name">{catalogName(section.name, s.lang)}</div>
              {dimensionRowsFor(section).map((r) => (
                <div key={r.label}>
                  {r.symbol} = {r.v !== undefined ? `${fmt.smallLength(r.v / 1000).value} ${fmt.smallLength(r.v / 1000).unit}` : '—'}
                </div>
              ))}
              <div>A = {fmt.area(sectionProps.area).value} {fmt.area(sectionProps.area).unit}</div>
              <div>I = {fmt.inertia(sectionProps.inertia).value} {fmt.inertia(sectionProps.inertia).unit}</div>
              <div>c = {sectionProps.shapeFactor.toFixed(2)}</div>
            </div>
          </div>
          <div className="vem-section-preview__figures" style={{ padding: '0 var(--space-5) var(--space-3)' }}>
            <div className="vem-section-preview__name">{catalogName(material.name, s.lang)}</div>
            <div>E = {fmt.stress(material.e * 1e4).value} {fmt.stress(material.e * 1e4).unit}</div>
            <div>G = {fmt.stress(shearModulus(material) * 1e4).value} {fmt.stress(shearModulus(material) * 1e4).unit}</div>
          </div>
          <div style={{ padding: '0 var(--space-5)' }}>
            <NoteBox tone={material.verified && section.verified ? 'info' : 'warn'}>
              {section.aCat !== undefined ? t.layeredNote : t.parametricNote}
              {!material.verified || !section.verified ? ` ${DATABASE[s.lang].unverifiedWarning}` : ''}
              {material.verified ? '' : t.materialSourceNote(catalogName(material.name, s.lang), catalogText(material.source, s.lang, SOURCE_EN))}
              {section.verified ? '' : t.sectionSourceNote(catalogName(section.name, s.lang), catalogText(section.source, s.lang, SOURCE_EN))}
            </NoteBox>
          </div>
          {material.family === 'concrete' && section.kind === 'rect' ? (
            <div style={{ padding: '0 var(--space-5) var(--space-2)' }}>
              <Checkbox
                label={t.rebarCheckbox}
                checked={model.rebar.enabled}
                onChange={(v) => {
                  setRebar({ ...model.rebar, enabled: v });
                  if (v && model.composite.enabled) setComposite({ ...model.composite, enabled: false });
                }}
              />
              {model.rebar.enabled ? (
                <>
                  <Slider
                    label={t.rebarBottomLabel(A.unit)}
                    min={A.toDisplay(0)}
                    max={A.toDisplay(0.004)}
                    step={A.toDisplay(0.00001)}
                    value={A.toDisplay(model.rebar.asBottom)}
                    onChange={(v) => setRebar({ ...model.rebar, asBottom: A.toCore(v) })}
                    display={`${A.toDisplay(model.rebar.asBottom).toFixed(2)} ${A.unit}`}
                    editable
                  />
                  <Slider
                    label={t.rebarTopLabel(A.unit)}
                    min={A.toDisplay(0)}
                    max={A.toDisplay(0.004)}
                    step={A.toDisplay(0.00001)}
                    value={A.toDisplay(model.rebar.asTop)}
                    onChange={(v) => setRebar({ ...model.rebar, asTop: A.toCore(v) })}
                    display={`${A.toDisplay(model.rebar.asTop).toFixed(2)} ${A.unit}`}
                    editable
                  />
                  <Slider
                    label={t.coverLabel(SL.unit)}
                    min={SL.toDisplay(0.015)}
                    max={SL.toDisplay(0.08)}
                    step={SL.toDisplay(0.001)}
                    value={SL.toDisplay(model.rebar.cover)}
                    onChange={(v) => setRebar({ ...model.rebar, cover: SL.toCore(v) })}
                    display={`${SL.toDisplay(model.rebar.cover).toFixed(0)} ${SL.unit}`}
                    editable
                  />
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                    {t.rebarUlsNote}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {material.family === 'steel' ? (
            <div style={{ padding: '0 var(--space-5) var(--space-2)' }}>
              <Checkbox
                label={t.compositeCheckbox}
                checked={model.composite.enabled}
                onChange={(v) => {
                  setComposite({ ...model.composite, enabled: v });
                  if (v && model.rebar.enabled) setRebar({ ...model.rebar, enabled: false });
                }}
              />
              {model.composite.enabled ? (
                <>
                  <Slider
                    label={t.slabWidthLabel(SL.unit)}
                    min={SL.toDisplay(0.1)}
                    max={SL.toDisplay(3)}
                    step={SL.toDisplay(0.01)}
                    value={SL.toDisplay(model.composite.slabWidth)}
                    onChange={(v) => setComposite({ ...model.composite, slabWidth: SL.toCore(v) })}
                    display={`${SL.toDisplay(model.composite.slabWidth).toFixed(0)} ${SL.unit}`}
                    editable
                  />
                  <Slider
                    label={t.slabThicknessLabel(SL.unit)}
                    min={SL.toDisplay(0.04)}
                    max={SL.toDisplay(0.4)}
                    step={SL.toDisplay(0.005)}
                    value={SL.toDisplay(model.composite.slabThickness)}
                    onChange={(v) => setComposite({ ...model.composite, slabThickness: SL.toCore(v) })}
                    display={`${SL.toDisplay(model.composite.slabThickness).toFixed(0)} ${SL.unit}`}
                    editable
                  />
                  <div style={{ marginBottom: 'var(--space-2)' }}>
                    <Combobox
                      ariaLabel={t.slabMaterialAria}
                      value={model.composite.slabMaterialId}
                      onChange={(id) => setComposite({ ...model.composite, slabMaterialId: id })}
                      options={materialComboOptions(s.lang, 'concrete')}
                    />
                  </div>
                  {compositeStiffness ? (
                    <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                      {t.compositeEiNote(
                        (compositeStiffness.ei * 1e-3).toFixed(0),
                        (material.e * 1e4 * sectionProps.inertia * 1e-3).toFixed(0),
                      )}
                    </div>
                  ) : null}
                  <NoteBox tone="warn">{t.compositeWarnNote}</NoteBox>
                </>
              ) : null}
            </div>
          ) : null}

          {/* Automatikus szelvény-optimalizálás (2026-09-04) — a jobb panel
              M-V/lehajlás/vasbeton-ULS ellenőrzéseit futtatja végig a
              katalógus AZONOS `kind`-ú (I, U, kör, cső, téglalap, RHS, T)
              szelvényein (`model/optimize.ts`), és a legkisebb (legkisebb
              területű) megfelelőt javasolja. Anyagot/fesztávot/terheket nem
              változtat, és egyetlen terhelési esetre optimalizál (nincs még
              teherkombináció-kezelés a programban). */}
          <div style={{ padding: '0 var(--space-5) var(--space-4)' }}>
            <button
              type="button"
              className="vem-btn vem-btn--sm"
              onClick={() => setOptimizeResult(findSmallestSuitableSection(model))}
            >
              {t.optimizeButton}
            </button>
            {optimizeResult ? (
              <div style={{ marginTop: 'var(--space-3)' }}>
                {optimizeResult.best ? (
                  <>
                    <NoteBox tone="info">
                      {t.optimizeProposal(
                        catalogName(optimizeResult.best.name, s.lang),
                        fmt.area(optimizeResult.best.area).value,
                        fmt.area(optimizeResult.best.area).unit,
                        optimizeResult.best.governing !== null ? `${(optimizeResult.best.governing * 100).toFixed(0)}%` : '—',
                      )}
                    </NoteBox>
                    <button
                      type="button"
                      className="vem-btn vem-btn--sm"
                      style={{ marginTop: 'var(--space-2)' }}
                      onClick={() => {
                        if (optimizeResult.best) setSectionId(optimizeResult.best.sectionId);
                        setOptimizeResult(null);
                      }}
                    >
                      {t.optimizeApplyButton}
                    </button>
                  </>
                ) : (
                  <NoteBox tone="warn">{t.optimizeNoneFound(sectionKindGroupLabel(optimizeResult.kind, s.lang), optimizeResult.candidates.length)}</NoteBox>
                )}
                {model.rebar.enabled ? (
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginTop: 'var(--space-2)' }}>
                    {t.optimizeRebarNote}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>

        <Card title={t.solverCardTitle} accent="solver">
          <div className="vem-panel__body--padded">
            <SegmentedControl
              ariaLabel={t.solverAlgorithmAria}
              value={s.algorithm}
              onChange={s.setAlgorithm}
              options={[
                { value: 'newton', label: t.newtonLabel, title: t.newtonTitle },
                {
                  value: 'modified-newton',
                  label: t.modNewtonLabel,
                  title: t.modNewtonTitle,
                },
              ]}
            />
            <Slider
              label={t.loadStepLabel(s.loadStep.toFixed(2))}
              min={0.02}
              max={0.25}
              step={0.01}
              value={s.loadStep}
              onChange={s.setLoadStep}
              display={s.loadStep.toFixed(2)}
            />
            <Slider
              label={t.toleranceLabel(s.tolerance.toFixed(2))}
              min={0.05}
              max={2}
              step={0.05}
              value={s.tolerance}
              onChange={s.setTolerance}
              display={s.tolerance.toFixed(2)}
            />
            <Slider
              label={t.peakLambdaLabel(s.peakLambda.toFixed(2))}
              min={0.5}
              max={3}
              step={0.05}
              value={s.peakLambda}
              onChange={s.setPeakLambda}
              display={s.peakLambda.toFixed(2)}
            />
            <Checkbox label={t.selfWeightCheckbox} checked={model.selfWeight} onChange={setSelfWeight} />
            <Checkbox
              label={t.thermalCheckbox}
              checked={model.thermalLoad.enabled}
              onChange={(v) => setThermalLoad({ ...model.thermalLoad, enabled: v })}
            />
            {model.thermalLoad.enabled ? (
              <>
                <Slider
                  label={t.tRefLabel(T.unit)}
                  min={T.toDisplay(-20)}
                  max={T.toDisplay(40)}
                  step={1}
                  value={T.toDisplay(model.thermalLoad.tRef)}
                  onChange={(v) => setThermalLoad({ ...model.thermalLoad, tRef: T.toCore(v) })}
                  display={`${T.toDisplay(model.thermalLoad.tRef).toFixed(0)} ${T.unit}`}
                  editable
                />
                <Slider
                  label={t.tTopLabel(T.unit)}
                  min={T.toDisplay(-30)}
                  max={T.toDisplay(60)}
                  step={1}
                  value={T.toDisplay(model.thermalLoad.tTop)}
                  onChange={(v) => setThermalLoad({ ...model.thermalLoad, tTop: T.toCore(v) })}
                  display={`${T.toDisplay(model.thermalLoad.tTop).toFixed(0)} ${T.unit}`}
                  editable
                />
                <Slider
                  label={t.tBottomLabel(T.unit)}
                  min={T.toDisplay(-30)}
                  max={T.toDisplay(60)}
                  step={1}
                  value={T.toDisplay(model.thermalLoad.tBottom)}
                  onChange={(v) => setThermalLoad({ ...model.thermalLoad, tBottom: T.toCore(v) })}
                  display={`${T.toDisplay(model.thermalLoad.tBottom).toFixed(0)} ${T.unit}`}
                  editable
                />
              </>
            ) : null}
            <Slider
              label={t.axialForceLabel(F.toDisplay(model.axialForce).toFixed(0), F.unit)}
              min={F.toDisplay(-1000)}
              max={F.toDisplay(1000)}
              step={F.toDisplay(10)}
              value={F.toDisplay(model.axialForce)}
              onChange={(v) => setAxialForce(F.toCore(v))}
              display={`${F.toDisplay(model.axialForce).toFixed(0)} ${F.unit}`}
              editable
            />
            {model.axialForce !== 0 ? (
              <NoteBox tone="warn">{t.pDeltaNote(model.axialForce > 0)}</NoteBox>
            ) : null}
            <Checkbox
              label={t.movingLoadCheckbox}
              checked={model.movingLoad.enabled}
              onChange={(v) => setMovingLoad({ ...model.movingLoad, enabled: v })}
            />
            {model.movingLoad.enabled ? (
              <>
                <Slider
                  label={t.movingLoadMagnitudeLabel(F.unit)}
                  min={F.toDisplay(1)}
                  max={F.toDisplay(200)}
                  step={F.toDisplay(1)}
                  value={F.toDisplay(model.movingLoad.magnitude)}
                  onChange={(v) => setMovingLoad({ ...model.movingLoad, magnitude: F.toCore(v) })}
                  display={`${F.toDisplay(model.movingLoad.magnitude).toFixed(0)} ${F.unit}`}
                  editable
                />
                <NoteBox tone="info">{t.movingLoadNote}</NoteBox>
              </>
            ) : null}
            <Checkbox
              label={t.seismicCheckbox}
              checked={model.seismic.enabled}
              onChange={(v) => setSeismic({ ...model.seismic, enabled: v })}
            />
            {model.seismic.enabled ? (
              <>
                <Slider
                  label={t.seismicAgLabel(model.seismic.agOverG.toFixed(2))}
                  min={0.02}
                  max={0.4}
                  step={0.01}
                  value={model.seismic.agOverG}
                  onChange={(v) => setSeismic({ ...model.seismic, agOverG: v })}
                  display={`${model.seismic.agOverG.toFixed(2)}·g`}
                />
                <Slider
                  label={t.seismicGammaILabel(model.seismic.gammaI.toFixed(1))}
                  min={0.8}
                  max={1.5}
                  step={0.1}
                  value={model.seismic.gammaI}
                  onChange={(v) => setSeismic({ ...model.seismic, gammaI: v })}
                  display={model.seismic.gammaI.toFixed(1)}
                />
                <SegmentedControl
                  ariaLabel={t.seismicSpectrumTypeAria}
                  value={String(model.seismic.spectrumType)}
                  onChange={(v) => setSeismic({ ...model.seismic, spectrumType: v === '2' ? 2 : 1 })}
                  options={[
                    { value: '1', label: t.seismicSpectrumType1Label, title: t.seismicSpectrumType1Title },
                    { value: '2', label: t.seismicSpectrumType2Label, title: t.seismicSpectrumType2Title },
                  ]}
                />
                <NoteBox tone="info">{t.seismicNote}</NoteBox>
              </>
            ) : null}
            <Checkbox label={t.showGaussCheckbox} checked={s.showGaussPoints} onChange={s.setShowGaussPoints} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {t.dofCountText(dofCount)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
              {t.nonlinearAlwaysLayeredNote}
            </div>
          </div>
        </Card>
      </div>
    </aside>
  );
}
