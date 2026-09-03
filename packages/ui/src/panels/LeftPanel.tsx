import { useState } from 'react';
import { geometricProperties } from '@femati/fem-core';
import { SegmentedControl } from '../components/Button.js';
import { Checkbox, Slider } from '../components/Field.js';
import { Combobox } from '../components/Combobox.js';
import { Card, NoteBox } from '../components/Feedback.js';
import { SectionShapeDiagram } from '../components/SectionShapeDiagram.js';
import { findMaterial, findPreset, findSection, dimensionRowsFor, shearModulus, UNVERIFIED_WARNING } from '../data/catalog.js';
import { materialComboOptions } from '../data/catalogIcons.js';
import { compositeSectionStiffness, toShape } from '../model/compile.js';
import { findSmallestSuitableSection, type OptimizeResult } from '../model/optimize.js';
import { useAppStore } from '../state/appStore.js';
import { useModelStore } from '../state/modelStore.js';
import { DEFAULT_SPRING_STIFFNESS, type EditableFoundation, type EditableLoad, type EditableSupport, type SupportType } from '../model/editable.js';
import { LoadIcon, SupportIcon } from './icons.js';
import * as fmt from '../format/numbers.js';

const SUPPORT_TYPE_LABEL: Record<SupportType, string> = {
  fixed: 'befogás',
  pinned: 'csuklós',
  roller: 'görgős',
  spring: 'rugós',
};

/** Támaszok itemlistája — mindegyik sor kattintható, kiválasztja a kapcsolódó vászon-elemet. */
function SupportsList({ supports }: { readonly supports: readonly EditableSupport[] }): JSX.Element {
  const selection = useModelStore((s) => s.selection);
  const select = useModelStore((s) => s.select);

  return (
    <Card title="Támaszok" accent="support">
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
              <span className="vem-item-value">
                {sup.type === 'spring' ? `k = ${(sup.k ?? DEFAULT_SPRING_STIFFNESS).toFixed(0)} kN/m` : SUPPORT_TYPE_LABEL[sup.type]}
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
  if (foundations.length === 0) return null;

  return (
    <Card title="Ágyazások" accent="foundation">
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
              {f.x1.toFixed(2)}–{f.x2.toFixed(2)} m
            </span>
            <span className="vem-item-value">c = {f.c.toFixed(0)} kN/m²</span>
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

  /** "G"/"Q" jelölő a listasoron — ULS-nél γG=1,35 / γQ=1,5, ld. `model/combinations.ts`. */
  const categoryTag = (load: EditableLoad): string => (load.category === 'permanent' ? 'G' : 'Q');

  const rowText = (load: EditableLoad): { readonly label: string; readonly value: string } => {
    if (load.kind === 'point') return { label: `${categoryTag(load)} · x = ${load.x.toFixed(2)} m`, value: `P = ${load.p.toFixed(0)} kN` };
    if (load.kind === 'moment') return { label: `${categoryTag(load)} · x = ${load.x.toFixed(2)} m`, value: `M = ${load.m.toFixed(0)} kNm` };
    if (load.kind === 'distributed') {
      const qLabel = load.q1 === load.q2 ? `q = ${load.q1.toFixed(0)} kN/m` : `q = ${load.q1.toFixed(0)}→${load.q2.toFixed(0)} kN/m`;
      return { label: `${categoryTag(load)} · ${load.x1.toFixed(2)}–${load.x2.toFixed(2)} m`, value: qLabel };
    }
    const mLabel = load.m1 === load.m2 ? `m = ${load.m1.toFixed(0)} kNm/m` : `m = ${load.m1.toFixed(0)}→${load.m2.toFixed(0)} kNm/m`;
    return { label: `${categoryTag(load)} · ${load.x1.toFixed(2)}–${load.x2.toFixed(2)} m`, value: mLabel };
  };

  return (
    <Card title="Terhek" accent="load">
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

/** A vászonon kijelölt támasz/teher/ágyazat szerkeszthető adatlapja. */
function SelectionSheet(): JSX.Element | null {
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
  const removeSelected = useModelStore((s) => s.removeSelected);

  if (selection === null) return null;

  if (selection.kind === 'support') {
    const support = model.supports.find((s) => s.id === selection.id);
    if (support === undefined) return null;
    const dzEnabled = support.dz !== undefined;
    const dPhiEnabled = support.dPhi !== undefined;
    return (
      <Card title="Kijelölt támasz" accent="support">
        <div className="vem-panel__body--padded">
          <Slider
            label="x [m]"
            min={0}
            max={model.span}
            step={0.01}
            value={support.x}
            onChange={(v) => moveSupport(support.id, v)}
            display={`${support.x.toFixed(2)} m`}
            editable
          />
          <SegmentedControl
            ariaLabel="Támasz típusa"
            value={support.type}
            onChange={(v) => setSupportType(support.id, v)}
            options={[
              { value: 'pinned', label: 'csuklós' },
              { value: 'roller', label: 'görgős' },
              { value: 'fixed', label: 'befogás' },
              { value: 'spring', label: 'rugós' },
            ]}
          />
          {support.type === 'spring' ? (
            <Slider
              label="k [kN/m]"
              min={100}
              max={50000}
              step={100}
              value={support.k ?? DEFAULT_SPRING_STIFFNESS}
              onChange={(v) => setSpringStiffness(support.id, v)}
              display={`${(support.k ?? DEFAULT_SPRING_STIFFNESS).toFixed(0)} kN/m`}
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
            label="előírt süllyedés (dz)"
            checked={dzEnabled}
            onChange={(v) => setSupportDisplacement(support.id, v ? 0 : undefined, support.dPhi)}
          />
          {dzEnabled ? (
            <Slider
              label="dz (süllyedés) [mm]"
              min={-50}
              max={50}
              step={0.5}
              value={(support.dz ?? 0) * 1000}
              onChange={(v) => setSupportDisplacement(support.id, v / 1000, support.dPhi)}
              display={`${((support.dz ?? 0) * 1000).toFixed(1)} mm`}
              editable
            />
          ) : null}
          <Checkbox
            label="előírt elfordulás (dφ)"
            checked={dPhiEnabled}
            onChange={(v) => setSupportDisplacement(support.id, support.dz, v ? 0 : undefined)}
          />
          {dPhiEnabled ? (
            <Slider
              label="dφ (elfordulás) [mrad]"
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
            Támasz törlése
          </button>
        </div>
      </Card>
    );
  }

  if (selection.kind === 'foundation') {
    const foundation = model.foundations.find((f) => f.id === selection.id);
    if (foundation === undefined) return null;
    return (
      <Card title="Kijelölt ágyazat" accent="foundation">
        <div className="vem-panel__body--padded">
          <Slider
            label="x₁ (kezdet) [m]"
            min={0}
            max={model.span}
            step={0.01}
            value={foundation.x1}
            onChange={(v) => setFoundationRange(foundation.id, v, foundation.x2)}
            display={`${foundation.x1.toFixed(2)} m`}
            editable
          />
          <Slider
            label="x₂ (vég) [m]"
            min={0}
            max={model.span}
            step={0.01}
            value={foundation.x2}
            onChange={(v) => setFoundationRange(foundation.id, foundation.x1, v)}
            display={`${foundation.x2.toFixed(2)} m`}
            editable
          />
          <Slider
            label="c [kN/m²]"
            min={100}
            max={20000}
            step={100}
            value={foundation.c}
            onChange={(v) => setFoundationStiffness(foundation.id, v)}
            display={`${foundation.c.toFixed(0)} kN/m²`}
            editable
          />
          <button type="button" className="vem-btn vem-btn--sm" style={{ marginTop: 8 }} onClick={removeSelected}>
            Ágyazat törlése
          </button>
        </div>
      </Card>
    );
  }

  const load = model.loads.find((l) => l.id === selection.id);
  if (load === undefined) return null;
  return (
    <Card title="Kijelölt teher" accent="load">
      <div className="vem-panel__body--padded">
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
          {load.kind === 'point' ? 'pontteher' : load.kind === 'moment' ? 'nyomatékteher' : load.kind === 'distributed' ? 'megoszló teher' : 'megoszló nyomatékteher'}
        </div>
        {/* Teherkategória (2026-09-04, EN 1990 teherkombináció) — ULS-nél
            γG=1,35 (állandó) vagy γQ=1,5 (esetleges), ld. `model/
            combinations.ts`. Az önsúlynak NINCS ilyen választója, mert az
            szerkezetileg mindig állandó. */}
        <SegmentedControl
          ariaLabel="Teher kategóriája"
          value={load.category}
          onChange={(v) => setLoadCategory(load.id, v)}
          options={[
            { value: 'permanent', label: 'állandó (G)', title: 'ULS-nél γG = 1,35-tel szorozva' },
            { value: 'variable', label: 'esetleges (Q)', title: 'ULS-nél γQ = 1,5-tel szorozva' },
          ]}
        />
        {load.kind === 'point' ? (
          <>
            <Slider
              label="x [m]"
              min={0}
              max={model.span}
              step={0.01}
              value={load.x}
              onChange={(v) => setLoadPosition(load.id, v)}
              display={`${load.x.toFixed(2)} m`}
              editable
            />
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
          </>
        ) : load.kind === 'moment' ? (
          <>
            <Slider
              label="x [m]"
              min={0}
              max={model.span}
              step={0.01}
              value={load.x}
              onChange={(v) => setLoadPosition(load.id, v)}
              display={`${load.x.toFixed(2)} m`}
              editable
            />
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
          </>
        ) : load.kind === 'distributed' ? (
          <>
            <Slider
              label="x₁ (kezdet) [m]"
              min={0}
              max={model.span}
              step={0.01}
              value={load.x1}
              onChange={(v) => setLoadRange(load.id, v, load.x2)}
              display={`${load.x1.toFixed(2)} m`}
              editable
            />
            <Slider
              label="x₂ (vég) [m]"
              min={0}
              max={model.span}
              step={0.01}
              value={load.x2}
              onChange={(v) => setLoadRange(load.id, load.x1, v)}
              display={`${load.x2.toFixed(2)} m`}
              editable
            />
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
        ) : (
          <>
            <Slider
              label="x₁ (kezdet) [m]"
              min={0}
              max={model.span}
              step={0.01}
              value={load.x1}
              onChange={(v) => setLoadRange(load.id, v, load.x2)}
              display={`${load.x1.toFixed(2)} m`}
              editable
            />
            <Slider
              label="x₂ (vég) [m]"
              min={0}
              max={model.span}
              step={0.01}
              value={load.x2}
              onChange={(v) => setLoadRange(load.id, load.x1, v)}
              display={`${load.x2.toFixed(2)} m`}
              editable
            />
            <Slider
              label="m₁ (kezdet) [kNm/m]"
              min={0.1}
              max={50}
              step={0.01}
              value={load.m1}
              onChange={(v) => setDistributedMomentMagnitudes(load.id, v, load.m2)}
              display={`${load.m1.toFixed(1)} kNm/m`}
              editable
            />
            <Slider
              label="m₂ (vég) [kNm/m]"
              min={0.1}
              max={50}
              step={0.01}
              value={load.m2}
              onChange={(v) => setDistributedMomentMagnitudes(load.id, load.m1, v)}
              display={`${load.m2.toFixed(1)} kNm/m`}
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
  const setThermalLoad = useModelStore((state) => state.setThermalLoad);
  const setRebar = useModelStore((state) => state.setRebar);
  const setComposite = useModelStore((state) => state.setComposite);
  const setSectionId = useModelStore((state) => state.setSectionId);
  const section = findSection(model.sectionId);
  const material = findMaterial(model.materialId);
  const sectionProps = geometricProperties(toShape(section));
  const compositeStiffness = model.composite.enabled ? compositeSectionStiffness(model) : null;

  /** A "legkisebb megfelelő szelvény" keresés eredménye — lokális, effemer UI-állapot (nem globális store: nem kell perzisztálni/undo-zni, egyszeri gombnyomás-eredmény). */
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null);

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
        <FoundationsList foundations={model.foundations} />
        <LoadsList loads={model.loads} />

        <SelectionSheet />

        <Card title="Keresztmetszet" accent="section">
          <div className="vem-section-preview">
            <SectionShapeDiagram section={section} />
            <div className="vem-section-preview__figures">
              <div className="vem-section-preview__name">{section.name}</div>
              {dimensionRowsFor(section).map((r) => (
                <div key={r.label}>
                  {r.symbol} = {r.v !== undefined ? r.v.toFixed(1) : '—'} mm
                </div>
              ))}
              <div>A = {(sectionProps.area * 1e4).toFixed(2)} cm²</div>
              <div>I = {(sectionProps.inertia * 1e8).toFixed(0)} cm⁴</div>
              <div>c = {sectionProps.shapeFactor.toFixed(2)}</div>
            </div>
          </div>
          <div className="vem-section-preview__figures" style={{ padding: '0 var(--space-5) var(--space-3)' }}>
            <div className="vem-section-preview__name">{material.name}</div>
            <div>E = {material.e.toFixed(0)} kN/cm²</div>
            <div>G = {shearModulus(material).toFixed(0)} kN/cm²</div>
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
          {material.family === 'concrete' && section.kind === 'rect' ? (
            <div style={{ padding: '0 var(--space-5) var(--space-2)' }}>
              <Checkbox
                label="vasalás (ULS teherbírás-ellenőrzéshez)"
                checked={model.rebar.enabled}
                onChange={(v) => {
                  setRebar({ ...model.rebar, enabled: v });
                  if (v && model.composite.enabled) setComposite({ ...model.composite, enabled: false });
                }}
              />
              {model.rebar.enabled ? (
                <>
                  <Slider
                    label="alsó vasalás Aₛ [cm²]"
                    min={0}
                    max={40}
                    step={0.1}
                    value={model.rebar.asBottom * 1e4}
                    onChange={(v) => setRebar({ ...model.rebar, asBottom: v / 1e4 })}
                    display={`${(model.rebar.asBottom * 1e4).toFixed(2)} cm²`}
                    editable
                  />
                  <Slider
                    label="felső vasalás Aₛ' [cm²]"
                    min={0}
                    max={40}
                    step={0.1}
                    value={model.rebar.asTop * 1e4}
                    onChange={(v) => setRebar({ ...model.rebar, asTop: v / 1e4 })}
                    display={`${(model.rebar.asTop * 1e4).toFixed(2)} cm²`}
                    editable
                  />
                  <Slider
                    label="fedés c [mm]"
                    min={15}
                    max={80}
                    step={1}
                    value={model.rebar.cover * 1000}
                    onChange={(v) => setRebar({ ...model.rebar, cover: v / 1000 })}
                    display={`${(model.rebar.cover * 1000).toFixed(0)} mm`}
                    editable
                  />
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                    ULS-teherbírás: egyszerűsített téglalap feszültségblokk (EC2 3.1.7(3)), B500B betonacél, γ=1.0
                    (jellemző érték) — ld. jobb panel "Vasbeton ULS" sor.
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          <div style={{ padding: '0 var(--space-5) var(--space-2)' }}>
            <Checkbox
              label="kompozit keresztmetszet (acél + betonlemez)"
              checked={model.composite.enabled}
              onChange={(v) => {
                setComposite({ ...model.composite, enabled: v });
                if (v && model.rebar.enabled) setRebar({ ...model.rebar, enabled: false });
              }}
            />
            {model.composite.enabled ? (
              <>
                <Slider
                  label="lemez szélesség b [mm]"
                  min={100}
                  max={3000}
                  step={10}
                  value={model.composite.slabWidth * 1000}
                  onChange={(v) => setComposite({ ...model.composite, slabWidth: v / 1000 })}
                  display={`${(model.composite.slabWidth * 1000).toFixed(0)} mm`}
                  editable
                />
                <Slider
                  label="lemez vastagság t [mm]"
                  min={40}
                  max={400}
                  step={5}
                  value={model.composite.slabThickness * 1000}
                  onChange={(v) => setComposite({ ...model.composite, slabThickness: v / 1000 })}
                  display={`${(model.composite.slabThickness * 1000).toFixed(0)} mm`}
                  editable
                />
                <div style={{ marginBottom: 'var(--space-2)' }}>
                  <Combobox
                    ariaLabel="Betonlemez anyaga"
                    value={model.composite.slabMaterialId}
                    onChange={(id) => setComposite({ ...model.composite, slabMaterialId: id })}
                    options={materialComboOptions('concrete')}
                  />
                </div>
                {compositeStiffness ? (
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                    Kompozit EI = {(compositeStiffness.ei * 1e-3).toFixed(0)} MNm² (acél alapszelvény önmagában:{' '}
                    {(material.e * 1e4 * sectionProps.inertia * 1e-3).toFixed(0)} MNm²)
                  </div>
                ) : null}
                <NoteBox tone="warn">
                  Csak rugalmas (SLS) viselkedésre érvényes — teljes nyírt kapcsolat feltételezve. ULS-
                  teherbírás-ellenőrzés és nemlineáris (F5) elemzés kompozit szelvényre még nem elérhető.
                </NoteBox>
              </>
            ) : null}
          </div>

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
              Legkisebb megfelelő szelvény keresése
            </button>
            {optimizeResult ? (
              <div style={{ marginTop: 'var(--space-3)' }}>
                {optimizeResult.best ? (
                  <>
                    <NoteBox tone="info">
                      Javaslat: {optimizeResult.best.name} (A = {(optimizeResult.best.area * 1e4).toFixed(2)} cm², kihasználtság{' '}
                      {optimizeResult.best.governing !== null ? `${(optimizeResult.best.governing * 100).toFixed(0)}%` : '—'})
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
                      Alkalmaz
                    </button>
                  </>
                ) : (
                  <NoteBox tone="warn">
                    Nincs megfelelő szelvény ebben a családban ({optimizeResult.kindLabel}, {optimizeResult.candidates.length} jelölt
                    megvizsgálva).
                  </NoteBox>
                )}
                {model.rebar.enabled ? (
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginTop: 'var(--space-2)' }}>
                    A vasalás mennyisége minden jelöltnél változatlan maradt — Alkalmazás után érdemes ellenőrizni/finomítani.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>

        <Card title="Megoldó" accent="solver">
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
            <Checkbox
              label="hőteher figyelembevétele"
              checked={model.thermalLoad.enabled}
              onChange={(v) => setThermalLoad({ ...model.thermalLoad, enabled: v })}
            />
            {model.thermalLoad.enabled ? (
              <>
                <Slider
                  label="tRef (feszültségmentes hőmérséklet) [°C]"
                  min={-20}
                  max={40}
                  step={1}
                  value={model.thermalLoad.tRef}
                  onChange={(v) => setThermalLoad({ ...model.thermalLoad, tRef: v })}
                  display={`${model.thermalLoad.tRef.toFixed(0)} °C`}
                  editable
                />
                <Slider
                  label="tTop (felső szél) [°C]"
                  min={-30}
                  max={60}
                  step={1}
                  value={model.thermalLoad.tTop}
                  onChange={(v) => setThermalLoad({ ...model.thermalLoad, tTop: v })}
                  display={`${model.thermalLoad.tTop.toFixed(0)} °C`}
                  editable
                />
                <Slider
                  label="tBottom (alsó szél) [°C]"
                  min={-30}
                  max={60}
                  step={1}
                  value={model.thermalLoad.tBottom}
                  onChange={(v) => setThermalLoad({ ...model.thermalLoad, tBottom: v })}
                  display={`${model.thermalLoad.tBottom.toFixed(0)} °C`}
                  editable
                />
              </>
            ) : null}
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
