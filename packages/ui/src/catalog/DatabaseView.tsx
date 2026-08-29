/**
 * Szelvény- és anyagadatbázis böngésző — Szerkesztés → „Szelvény adatbázis"
 * / „Anyag adatbázis" (2026-08-29, 2. kör: külön menüpont/ablak szelvényre
 * és anyagra, kereső mező, önállóan görgethető navigáció, egyetlen fejléc-
 * Bezár gomb, nagy méretjelzéses keresztmetszet-illusztráció).
 *
 * A `@femati/fem-db` katalógus (19 anyag, 22 szelvény) minden rekordját
 * megjeleníti: keresztmetszet-ábra (valós arányokból, méretjelző-
 * feliratokkal — `SectionShapeDiagram`, ugyanaz a rajzoló-logika, mint a
 * bal panel élő előnézete), a katalógus-adatok, a `fem-core`
 * `geometricProperties()`-ből SZÁMOLT jellemzők (nem a katalógus-értékek
 * megismétlése — a kettő ELTÉRHET, ld. a "katalógus vs. számított"
 * eltérés-sor), a vonatkozó zárt alakú képletek (KaTeX,
 * `derivation/Formula.tsx` — a teljes készlet: terület, másodrendű
 * nyomaték, rugalmas/képlékeny modulus, alaki tényező), és a forrás/
 * `verified` figyelmeztetés (`UNVERIFIED_WARNING`, ugyanaz, mint a bal
 * panelen).
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
import { MaterialSwatch } from '../data/catalogIcons.js';
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

/** A csoportosított listát a kereső-szöveggel szűri; üres csoportok eltűnnek. */
function filterGroups<T extends { readonly name: string }, K extends string>(
  byGroup: ReadonlyMap<K, readonly T[]>,
  groups: readonly K[],
  query: string,
): ReadonlyMap<K, readonly T[]> {
  const q = query.trim().toLowerCase();
  if (q === '') return byGroup;
  const result = new Map<K, readonly T[]>();
  for (const g of groups) {
    const filtered = (byGroup.get(g) ?? []).filter((item) => item.name.toLowerCase().includes(q));
    if (filtered.length > 0) result.set(g, filtered);
  }
  return result;
}

const MATERIALS_BY_FAMILY = groupBy(MATERIALS, (m) => m.family);
const SECTIONS_BY_KIND = groupBy(SECTIONS, (s) => s.kind);
const MATERIAL_FAMILIES = Array.from(MATERIALS_BY_FAMILY.keys()) as readonly MaterialFamily[];
const SECTION_KINDS = Array.from(SECTIONS_BY_KIND.keys()) as readonly SectionKind[];

/** Ezrelékben formázott alakváltozás-érték (εc1, εc2, εcu2, εc3, εcu3). */
const permille = (v: number): Formatted => num(v * 1000, 2, '‰');

/**
 * Vastagságfüggő acél folyáshatár-osztály (EN 10025-2 7. táblázat) — a
 * `fem-db` D) fázisban bővült adat. TISZTÁN referencia: a megoldó jelenleg
 * egyetlen `sigmaY`-t rendel minden rétegnek, ezt a bővítést az E) fázis
 * kötné be ténylegesen a rétegelt magba (ld. `types.ts` `fy1` doc-komment).
 */
function SteelThicknessClass({ material }: { readonly material: MaterialEntry }): JSX.Element {
  return (
    <div style={{ marginTop: 'var(--space-4)' }}>
      <div className="vem-theory__section" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
        Vastagságfüggő folyáshatár-osztály (EN 10025-2)
      </div>
      <ResultRow label={`Fy1 (t ≤ ${material.thicknessThreshold} mm)`} formatted={num(material.fy1 as number, 1, 'kN/cm²')} />
      <ResultRow label={`Fy2 (t > ${material.thicknessThreshold} mm)`} formatted={num(material.fy2 as number, 1, 'kN/cm²')} />
      <ResultRow label="Fu1" formatted={num(material.fu1 as number, 1, 'kN/cm²')} />
      <ResultRow label="Fu2" formatted={num(material.fu2 as number, 1, 'kN/cm²')} />
      {material.alphaFi !== undefined ? (
        <ResultRow label="Hőtágulási együttható tűzhatás esetén αfi" formatted={num(material.alphaFi * 1e6, 2, '×10⁻⁶ /°C')} />
      ) : null}
      <NoteBox tone="info">
        Referencia-adat — a megoldó jelenleg egyetlen folyáshatárt (fentebb) rendel a teljes
        keresztmetszethez; a vastagságosztály szerinti választás a rétegelt modellben (E) fázis) még
        nincs bekötve.
      </NoteBox>
    </div>
  );
}

/**
 * EC2 (EN 1992-1-1 3.1.7) feszültség-alakváltozás modell paraméterei —
 * ugyanaz a "referencia, a megoldó még nem használja" jegyzet, mint az
 * acél vastagságosztálynál. `φ(∞,t0)` ÁLTALÁNOS reprezentatív érték, nem
 * projektfüggő (RH, terhelési kor) számítás.
 */
function ConcreteEC2Params({ material }: { readonly material: MaterialEntry }): JSX.Element {
  return (
    <div style={{ marginTop: 'var(--space-4)' }}>
      <div className="vem-theory__section" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
        EC2 feszültség-alakváltozás modell (EN 1992-1-1 3.1.7)
      </div>
      <ResultRow label="Jellemző nyomószilárdság fck" formatted={num(material.fck as number, 2, 'kN/cm²')} emphasis="large" />
      <ResultRow label="Középértékű húzószilárdság fctm" formatted={num(material.fctm as number, 3, 'kN/cm²')} />
      <ResultRow label="Jellemző húzószilárdság fctk,0.05" formatted={num(material.fctk005 as number, 3, 'kN/cm²')} />
      <ResultRow label="Rugalmassági modulus tényező γcE" formatted={num(material.gammaCE as number, 2, '')} />
      <ResultRow label="Végső kúszási tényező φ(∞,t0)" formatted={num(material.phiInfinity as number, 2, '')} />
      <ResultRow label="Folyási határnyúlás εc1 (nemlineáris modell)" formatted={permille(material.epsC1 as number)} />
      <ResultRow label="Folyási határnyúlás εc2 (parabola-téglalap)" formatted={permille(material.epsC2 as number)} />
      <ResultRow label="Szakadási határnyúlás εcu2 (parabola-téglalap)" formatted={permille(material.epsCu2 as number)} />
      <ResultRow label="Folyási határnyúlás εc3 (bilineáris)" formatted={permille(material.epsC3 as number)} />
      <ResultRow label="Szakadási határnyúlás εcu3 (bilineáris)" formatted={permille(material.epsCu3 as number)} />
      <ResultRow label="Nyomószilárdság-csökkentő tényező η" formatted={num(material.eta as number, 2, '')} />
      <ResultRow label="Parabola-téglalap kitevő n" formatted={num(material.n as number, 1, '')} />
      <NoteBox tone="info">
        Referencia-adat — a megoldó jelenleg a rétegelt magban egyszerű, kétegyenes (rugalmas–
        tökéletesen képlékeny/lineáris keményedő) törvényt használ minden rétegre; az EC2
        parabola-téglalap modell tényleges bekötése (F) fázis) még nincs implementálva.
      </NoteBox>
    </div>
  );
}

function MaterialDetail({ material, onClose }: { readonly material: MaterialEntry; readonly onClose: () => void }): JSX.Element {
  const g = material.e / (2 * (1 + material.nu));
  return (
    <>
      <header className="vem-theory__header">
        <div className="vem-theory__header-title">
          <MaterialSwatch family={material.family} />
          <div>
            <h2>{material.name}</h2>
            <p className="vem-theory__subtitle">{MATERIAL_FAMILY_GROUP[material.family]}</p>
          </div>
        </div>
        <button type="button" className="vem-btn vem-btn--sm" onClick={onClose}>
          Bezárás
        </button>
      </header>
      <div className="vem-theory__body">
        <div className="vem-db__figure">
          <MaterialSwatch family={material.family} size={120} />
        </div>
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
        {material.fy1 !== undefined ? <SteelThicknessClass material={material} /> : null}
        {material.fck !== undefined ? <ConcreteEC2Params material={material} /> : null}
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

function dimensionRowsFor(section: SectionEntry): readonly { readonly label: string; readonly v: number | undefined }[] {
  switch (section.kind) {
    case 'circle':
      return [{ label: 'Átmérő d', v: section.d ?? section.h }];
    case 'tube':
      return [
        { label: 'Átmérő d', v: section.d ?? section.h },
        { label: 'Falvastagság t', v: section.t },
      ];
    case 'rect':
      return [
        { label: 'Magasság h', v: section.h },
        { label: 'Szélesség b', v: section.b },
      ];
    case 'rhs':
      return [
        { label: 'Magasság h', v: section.h },
        { label: 'Szélesség b', v: section.b },
        { label: 'Falvastagság t', v: section.t },
      ];
    case 'I':
    case 'U':
      return [
        { label: 'Magasság h', v: section.h },
        { label: 'Szélesség b', v: section.b },
        { label: 'Gerincvastagság tw', v: section.tw },
        { label: 'Övvastagság tf', v: section.tf },
      ];
  }
}

function DimensionRows({ section }: { readonly section: SectionEntry }): JSX.Element {
  const rows = dimensionRowsFor(section);
  return (
    <>
      {rows.map((r) => (
        <ResultRow key={r.label} label={r.label} formatted={r.v !== undefined ? num(r.v, 1, 'mm') : { value: '—', unit: '' }} />
      ))}
    </>
  );
}

/** A keresztmetszet-fajtánként eltérő zárt alakú A és I képlet — a Wel/Wpl/c
 * képlet (amely mindig ugyanaz) mellett, hogy egy elemnél MINDEN releváns
 * zárt alak szerepeljen, ne csak a modulusok. */
function shapeFormulaTex(kind: SectionKind): string {
  switch (kind) {
    case 'rect':
      return 'A = b\\cdot h \\qquad I = \\dfrac{b\\cdot h^3}{12}';
    case 'circle':
      return 'A = \\dfrac{\\pi d^2}{4} \\qquad I = \\dfrac{\\pi d^4}{64}';
    case 'tube':
      return 'A = \\dfrac{\\pi}{4}\\left(d^2-(d-2t)^2\\right) \\qquad I = \\dfrac{\\pi}{64}\\left(d^4-(d-2t)^4\\right)';
    case 'rhs':
      return 'A = b\\,h - (b-2t)(h-2t) \\qquad I = \\dfrac{b\\,h^3 - (b-2t)(h-2t)^3}{12}';
    case 'I':
    case 'U':
      return 'A = 2\\,b\\,t_f + (h-2t_f)\\,t_w \\qquad I = \\dfrac{b\\,h^3}{12} - \\dfrac{(b-t_w)(h-2t_f)^3}{12}';
  }
}

function SectionDetail({ section, onClose }: { readonly section: SectionEntry; readonly onClose: () => void }): JSX.Element {
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
          <div>
            <h2>{section.name}</h2>
            <p className="vem-theory__subtitle">{SECTION_KIND_GROUP[section.kind]}</p>
          </div>
        </div>
        <button type="button" className="vem-btn vem-btn--sm" onClick={onClose}>
          Bezárás
        </button>
      </header>
      <div className="vem-theory__body">
        <div className="vem-db__figure">
          <SectionShapeDiagram section={section} width={220} height={250} />
        </div>

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
          <Formula tex={shapeFormulaTex(section.kind)} />
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

export interface DatabaseViewProps {
  readonly kind: 'material' | 'section';
}

/** Az anyag-adatbázis és a szelvény-adatbázis KÜLÖN menüpont, külön ablak
 * (felhasználói visszajelzés) — de ugyanezt a komponenst példányosítja
 * `kind`-tól függően, hogy a nav/kereső/fejléc-logika ne duplikálódjon. */
export function DatabaseView({ kind }: DatabaseViewProps): JSX.Element | null {
  const open = useAppStore((s) => (kind === 'material' ? s.materialDbOpen : s.sectionDbOpen));
  const setOpen = useAppStore((s) => (kind === 'material' ? s.setMaterialDbOpen : s.setSectionDbOpen));
  const [query, setQuery] = useState('');
  const [materialSelection, setMaterialSelection] = useState(MATERIALS[0]?.id ?? '');
  const [sectionSelection, setSectionSelection] = useState(SECTIONS[0]?.id ?? '');

  if (!open) return null;
  const close = (): void => setOpen(false);

  const isMaterial = kind === 'material';
  const title = isMaterial ? 'Anyag adatbázis' : 'Szelvény adatbázis';
  const placeholder = isMaterial ? 'Anyag keresése…' : 'Szelvény keresése…';

  const filteredMaterials = filterGroups(MATERIALS_BY_FAMILY, MATERIAL_FAMILIES, query);
  const filteredSections = filterGroups(SECTIONS_BY_KIND, SECTION_KINDS, query);
  const noResults = isMaterial ? filteredMaterials.size === 0 : filteredSections.size === 0;

  const selectedMaterial = MATERIALS.find((m) => m.id === materialSelection) ?? (MATERIALS[0] as MaterialEntry);
  const selectedSection = SECTIONS.find((s) => s.id === sectionSelection) ?? (SECTIONS[0] as SectionEntry);

  return (
    <div className="vem-theory-overlay" onPointerDown={close}>
      <div className="vem-theory vem-db" onPointerDown={(e) => e.stopPropagation()}>
        <nav className="vem-theory__nav" aria-label={title}>
          <h1>{title}</h1>
          <input
            type="search"
            className="vem-db__nav-search"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={placeholder}
          />
          <div className="vem-db__nav-list">
            {noResults ? <p className="vem-db__nav-empty">Nincs találat.</p> : null}
            {isMaterial
              ? MATERIAL_FAMILIES.filter((f) => (filteredMaterials.get(f) ?? []).length > 0).map((family) => (
                  <div key={family}>
                    <div className="vem-db__nav-subgroup">{MATERIAL_FAMILY_GROUP[family]}</div>
                    {(filteredMaterials.get(family) ?? []).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="vem-theory__nav-item"
                        aria-current={materialSelection === m.id}
                        onClick={() => setMaterialSelection(m.id)}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                ))
              : SECTION_KINDS.filter((k) => (filteredSections.get(k) ?? []).length > 0).map((kindGroup) => (
                  <div key={kindGroup}>
                    <div className="vem-db__nav-subgroup">{SECTION_KIND_GROUP[kindGroup]}</div>
                    {(filteredSections.get(kindGroup) ?? []).map((sec) => (
                      <button
                        key={sec.id}
                        type="button"
                        className="vem-theory__nav-item"
                        aria-current={sectionSelection === sec.id}
                        onClick={() => setSectionSelection(sec.id)}
                      >
                        {sec.name}
                      </button>
                    ))}
                  </div>
                ))}
          </div>
          <p className="vem-theory__nav-note">
            {isMaterial ? `${MATERIALS.length} anyag` : `${SECTIONS.length} szelvény`} · <code>@femati/fem-db</code>
          </p>
        </nav>
        <article className="vem-theory__content">
          {isMaterial ? (
            <MaterialDetail material={selectedMaterial} onClose={close} />
          ) : (
            <SectionDetail section={selectedSection} onClose={close} />
          )}
        </article>
      </div>
    </div>
  );
}
