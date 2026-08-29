/**
 * Szelvény- és anyagadatbázis böngésző — Szerkesztés → Szelvény, anyag
 * adatbázis (2026-08-29).
 *
 * A `@femati/fem-db` katalógus (19 anyag, 22 szelvény) minden rekordját
 * megjeleníti: keresztmetszet-ábra (valós arányokból, `SectionShapeDiagram`
 * — ugyanaz a rajzoló-logika, mint a bal panel élő előnézete), a
 * katalógus-adatok, a `fem-core` `geometricProperties()`-ből SZÁMOLT
 * jellemzők (nem a katalógus-értékek megismétlése — a kettő ELTÉRHET, ld.
 * a "katalógus vs. számított" eltérés-sor), a vonatkozó zárt alakú
 * képletek (KaTeX, `derivation/Formula.tsx`), és a forrás/`verified`
 * figyelmeztetés (`UNVERIFIED_WARNING`, ugyanaz, mint a bal panelen).
 *
 * Ugyanazt az overlay-architektúrát használja, mint a `theory/TheoryView.tsx`
 * (`.vem-theory*` osztályok) — két külön böngésző-nézet, egy közös vizuális
 * nyelv, nem duplikált CSS.
 */
import { useState } from 'react';
import { geometricProperties } from '@femati/fem-core';
import { NoteBox } from '../components/Feedback.js';
import { ResultRow } from '../components/Value.js';
import { SectionShapeDiagram } from '../components/SectionShapeDiagram.js';
import { MaterialSwatch, MATERIAL_COLOR } from '../data/catalogIcons.js';
import {
  MATERIALS,
  SECTIONS,
  MATERIAL_FAMILY_GROUP,
  SECTION_KIND_GROUP,
  UNVERIFIED_WARNING,
  type MaterialEntry,
  type MaterialFamily,
  type SectionEntry,
  type SectionKind,
} from '../data/catalog.js';
import { toShape } from '../model/compile.js';
import { Formula } from '../derivation/Formula.js';
import { useAppStore } from '../state/appStore.js';
import type { Formatted } from '../format/numbers.js';
import './database.css';

type Selection = { readonly kind: 'material'; readonly id: string } | { readonly kind: 'section'; readonly id: string };

const num = (v: number, digits: number, unit: string): Formatted => ({ value: v.toFixed(digits), unit });

const numWithDeviation = (v: number, digits: number, unit: string, devPct: number | null): Formatted => ({
  value: devPct === null ? v.toFixed(digits) : `${v.toFixed(digits)} (${devPct >= 0 ? '+' : ''}${devPct.toFixed(1)}%)`,
  unit,
});

function groupBy<T, K extends string>(items: readonly T[], key: (t: T) => K): ReadonlyMap<K, readonly T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k);
    if (arr) arr.push(item);
    else map.set(k, [item]);
  }
  return map;
}

const MATERIALS_BY_FAMILY = groupBy(MATERIALS, (m) => m.family);
const SECTIONS_BY_KIND = groupBy(SECTIONS, (s) => s.kind);

function MaterialDetail({ material }: { readonly material: MaterialEntry }): JSX.Element {
  const g = material.e / (2 * (1 + material.nu));
  return (
    <>
      <header className="vem-theory__header">
        <div className="vem-theory__header-title">
          <MaterialSwatch color={MATERIAL_COLOR[material.family]} />
          <div>
            <h2>{material.name}</h2>
            <p className="vem-theory__subtitle">{MATERIAL_FAMILY_GROUP[material.family]}</p>
          </div>
        </div>
      </header>
      <div className="vem-theory__body">
        <ResultRow label="Rugalmassági modulus E" formatted={num(material.e, 0, 'kN/cm²')} emphasis="large" />
        <ResultRow label="Poisson-tényező ν" formatted={num(material.nu, 2, '')} />
        <ResultRow label="Nyírási modulus G = E/2(1+ν)" formatted={num(g, 0, 'kN/cm²')} />
        <Formula tex="G = \dfrac{E}{2(1+\nu)}" />
        {material.sigmaY > 0 ? (
          <ResultRow label="Folyáshatár σY" formatted={num(material.sigmaY, 1, 'kN/cm²')} emphasis="large" />
        ) : (
          <NoteBox tone="info">Nincs megadott folyáshatár — az anyag csak rugalmas vizsgálatra alkalmas ebben a katalógusban.</NoteBox>
        )}
        {material.hPrime > 0 ? (
          <ResultRow label="Lineáris keményedés H′" formatted={num(material.hPrime, 0, 'kN/cm²')} />
        ) : null}
        <ResultRow label="Hőtágulási együttható α" formatted={num(material.alpha * 1e6, 2, '×10⁻⁶ /°C')} />
        <ResultRow label="Sűrűség ρ" formatted={num(material.density, 0, 'kg/m³')} />
        <div style={{ marginTop: 'var(--space-4)' }}>
          <NoteBox tone={material.verified ? 'info' : 'warn'}>
            Forrás: {material.source}
            {material.verified ? '' : ` ${UNVERIFIED_WARNING}`}
          </NoteBox>
          {material.note !== undefined ? (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <NoteBox tone="info">{material.note}</NoteBox>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function deviationPct(computed: number, catalog: number | undefined): number | null {
  if (catalog === undefined || catalog === 0) return null;
  return ((computed - catalog) / catalog) * 100;
}

function DimensionRows({ section }: { readonly section: SectionEntry }): JSX.Element {
  const rows: { readonly label: string; readonly v: number | undefined }[] =
    section.kind === 'circle'
      ? [{ label: 'Átmérő d', v: section.d ?? section.h }]
      : section.kind === 'tube'
        ? [
            { label: 'Átmérő d', v: section.d ?? section.h },
            { label: 'Falvastagság t', v: section.t },
          ]
        : section.kind === 'rect'
          ? [
              { label: 'Magasság h', v: section.h },
              { label: 'Szélesség b', v: section.b },
            ]
          : [
              { label: 'Magasság h', v: section.h },
              { label: 'Szélesség b', v: section.b },
              { label: 'Gerincvastagság tw', v: section.tw },
              { label: 'Övvastagság tf', v: section.tf },
            ];
  return (
    <>
      {rows.map((r) => (
        <ResultRow key={r.label} label={r.label} formatted={r.v !== undefined ? num(r.v, 1, 'mm') : { value: '—', unit: '' }} />
      ))}
    </>
  );
}

function SectionDetail({ section }: { readonly section: SectionEntry }): JSX.Element {
  const shape = toShape(section);
  const props = geometricProperties(shape);
  const aCm2 = props.area * 1e4;
  const iCm4 = props.inertia * 1e8;
  const welCm3 = props.elasticModulus * 1e6;
  const wplCm3 = props.plasticModulus * 1e6;

  const aDev = deviationPct(aCm2, section.aCat);
  const iDev = deviationPct(iCm4, section.iCat);
  const wplDev = deviationPct(wplCm3, section.wplCat);

  return (
    <>
      <header className="vem-theory__header">
        <div className="vem-theory__header-title">
          <SectionShapeDiagram section={section} width={64} height={92} />
          <div>
            <h2>{section.name}</h2>
            <p className="vem-theory__subtitle">{SECTION_KIND_GROUP[section.kind]}</p>
          </div>
        </div>
      </header>
      <div className="vem-theory__body">
        <div className="vem-db__columns">
          <div>
            <div className="vem-theory__section" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
              Méretek
            </div>
            <DimensionRows section={section} />
          </div>
          <div>
            <div className="vem-theory__section" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
              Számított jellemzők
            </div>
            <ResultRow label="Terület A" formatted={num(aCm2, 2, 'cm²')} emphasis="large" />
            <ResultRow label="Másodrendű nyomaték I" formatted={num(iCm4, 0, 'cm⁴')} emphasis="large" />
            <ResultRow label="Rugalmas modulus Wel = I/ymax" formatted={num(welCm3, 1, 'cm³')} />
            <ResultRow label="Képlékeny modulus Wpl = 2S₀" formatted={num(wplCm3, 1, 'cm³')} />
            <ResultRow label="Alaki tényező c = Wpl/Wel" formatted={num(props.shapeFactor, 3, '')} />
          </div>
        </div>

        <div style={{ margin: 'var(--space-4) 0' }}>
          <Formula tex="W_{el}=\dfrac{I}{y_{max}} \qquad W_{pl}=2S_0 \qquad c=\dfrac{W_{pl}}{W_{el}}" />
        </div>

        {section.aCat !== undefined ? (
          <div className="vem-theory__section" style={{ marginTop: 'var(--space-4)' }}>
            Katalógus vs. számított
          </div>
        ) : null}
        {section.aCat !== undefined ? (
          <ResultRow
            label="A: katalógus / eltérés"
            formatted={numWithDeviation(section.aCat, 2, 'cm²', aDev)}
            tone={aDev !== null && Math.abs(aDev) > 5 ? 'warn' : 'neutral'}
          />
        ) : null}
        {section.iCat !== undefined ? (
          <ResultRow
            label="I: katalógus / eltérés"
            formatted={numWithDeviation(section.iCat, 0, 'cm⁴', iDev)}
            tone={iDev !== null && Math.abs(iDev) > 5 ? 'warn' : 'neutral'}
          />
        ) : null}
        {section.wplCat !== undefined ? (
          <ResultRow
            label="Wpl: katalógus / eltérés"
            formatted={numWithDeviation(section.wplCat, 1, 'cm³', wplDev)}
            tone={wplDev !== null && Math.abs(wplDev) > 5 ? 'warn' : 'neutral'}
          />
        ) : null}
        {aDev !== null || iDev !== null || wplDev !== null ? (
          <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: 'var(--space-2) 0 0' }}>
            Az eltérés a névleges kontúrból (lekerekítés nélkül) számolt és a szelvénytáblázat (gyártói,
            lekerekítéseket is tartalmazó) adata között — a modell mindig a számított értéket használja.
          </p>
        ) : null}

        <div style={{ marginTop: 'var(--space-4)' }}>
          <NoteBox tone={section.verified ? 'info' : 'warn'}>
            Forrás: {section.source}
            {section.verified ? '' : ` ${UNVERIFIED_WARNING}`}
          </NoteBox>
        </div>
      </div>
    </>
  );
}

export function DatabaseView(): JSX.Element | null {
  const open = useAppStore((s) => s.databaseOpen);
  const setOpen = useAppStore((s) => s.setDatabaseOpen);
  const [selection, setSelection] = useState<Selection>({ kind: 'material', id: MATERIALS[0]?.id ?? '' });

  if (!open) return null;
  const close = (): void => setOpen(false);

  const materialFamilies = Array.from(MATERIALS_BY_FAMILY.keys()) as readonly MaterialFamily[];
  const sectionKinds = Array.from(SECTIONS_BY_KIND.keys()) as readonly SectionKind[];

  return (
    <div className="vem-theory-overlay" onPointerDown={close}>
      <div className="vem-theory vem-db" onPointerDown={(e) => e.stopPropagation()}>
        <nav className="vem-theory__nav" aria-label="Szelvény- és anyagadatbázis">
          <h1>Adatbázis</h1>
          <div className="vem-db__nav-group">Anyagok</div>
          {materialFamilies.map((family) => (
            <div key={family}>
              <div className="vem-db__nav-subgroup">{MATERIAL_FAMILY_GROUP[family]}</div>
              {(MATERIALS_BY_FAMILY.get(family) ?? []).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="vem-theory__nav-item"
                  aria-current={selection.kind === 'material' && selection.id === m.id}
                  onClick={() => setSelection({ kind: 'material', id: m.id })}
                >
                  {m.name}
                </button>
              ))}
            </div>
          ))}
          <div className="vem-db__nav-group">Szelvények</div>
          {sectionKinds.map((kind) => (
            <div key={kind}>
              <div className="vem-db__nav-subgroup">{SECTION_KIND_GROUP[kind]}</div>
              {(SECTIONS_BY_KIND.get(kind) ?? []).map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  className="vem-theory__nav-item"
                  aria-current={selection.kind === 'section' && selection.id === sec.id}
                  onClick={() => setSelection({ kind: 'section', id: sec.id })}
                >
                  {sec.name}
                </button>
              ))}
            </div>
          ))}
          <p className="vem-theory__nav-note">
            {MATERIALS.length} anyag · {SECTIONS.length} szelvény · <code>@femati/fem-db</code>
          </p>
        </nav>
        <article className="vem-theory__content">
          {selection.kind === 'material' ? (
            <MaterialDetail material={MATERIALS.find((m) => m.id === selection.id) ?? (MATERIALS[0] as MaterialEntry)} />
          ) : (
            <SectionDetail section={SECTIONS.find((s) => s.id === selection.id) ?? (SECTIONS[0] as SectionEntry)} />
          )}
          <button type="button" className="vem-btn vem-btn--sm" style={{ marginTop: 'var(--space-5)' }} onClick={close}>
            Bezár
          </button>
        </article>
      </div>
    </div>
  );
}
