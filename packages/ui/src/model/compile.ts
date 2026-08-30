/**
 * `EditableModel` → `@femati/fem-core` `Model` fordítás, és a lineáris
 * megoldás futtatása. EZ AZ EGYETLEN HELY, ahol a felület a magot hívja
 * (DESIGN-TERV 1.7: „a felület nem számol") — minden más komponens csak a
 * `solveLinear()` kimenetét jeleníti meg.
 */
import {
  buildModel,
  distributedForce,
  fixed,
  makeMaterial,
  makeSection,
  nodalForce,
  nodalMoment,
  pinned,
  rect,
  circle as circleShape,
  tube as tubeShape,
  rhs as rhsShape,
  iProfile,
  selfWeight as selfWeightLoad,
  recommendedShearFactor,
  solveLinear,
  solveModal,
  uniformMesh,
  InvalidModelError,
  type Material,
  type LinearResult,
  type Model,
  type ModalResult,
  type Section,
  type SectionShape,
} from '@femati/fem-core';
import { findMaterial, findSection, type SectionEntry } from '../data/catalog.js';
import type { EditableModel } from './editable.js';

/** A katalógus-szelvény [mm] adatainak átalakítása fem-core `SectionShape`-re [m]. */
export function toShape(section: SectionEntry): SectionShape {
  const cm = (mm: number): number => mm / 1000;
  switch (section.kind) {
    // A "U" (nyitott csatorna, UPN) szelvény ennél az 1D — kizárólag a
    // gerenda ERŐS tengelye körüli hajlítást kezelő — modellnél egzaktul
    // egyenértékű egy azonos h/b/tw/tf méretű I-szelvénnyel: a magasság
    // menti szélesség-eloszlás (öv-öv-gerinc) PONTOSAN ugyanaz, a kétoldali
    // vs. egyoldali övelrendezés csak a nyírásközéppontnál/a MÁSIK
    // tengelynél számítana, amit ez a modell nem kezel (ld. fem-db
    // sections.test.ts fejléce).
    case 'I':
    case 'U':
      return iProfile(cm(section.h), cm(section.b), cm(section.tw ?? 6), cm(section.tf ?? 10));
    case 'circle':
      return circleShape(cm(section.d ?? section.h));
    case 'tube':
      return tubeShape(cm(section.d ?? section.h), cm(section.t ?? 8));
    case 'rect':
      return rect(cm(section.b), cm(section.h));
    case 'rhs':
      return rhsShape(cm(section.h), cm(section.b), cm(section.t ?? 8));
  }
}

/** A fem-core anyag/szelvény előállítása a katalógusból (mm / kN·cm² → SI). */
function buildCatalogParts(materialId: string, sectionId: string): { material: Material; section: Section } {
  const mat = findMaterial(materialId);
  const sec = findSection(sectionId);
  const material = makeMaterial(mat.id, mat.name, {
    e: mat.e * 1e4, // kN/cm² → kN/m²
    nu: mat.nu,
    alpha: mat.alpha,
    density: mat.density,
    // exactOptionalPropertyTypes: csak akkor kerül be a kulcs, ha van értéke.
    ...(mat.sigmaY > 0 ? { sigmaY: mat.sigmaY * 1e4 } : {}),
    ...(mat.hPrime > 0 ? { hPrime: mat.hPrime * 1e4 } : {}),
    // E) fázis: vastagságfüggő acél-folyáshatár (referencia-adatból bekötve).
    ...(mat.fy1 !== undefined ? { fy1: mat.fy1 * 1e4 } : {}),
    ...(mat.fy2 !== undefined ? { fy2: mat.fy2 * 1e4 } : {}),
    ...(mat.thicknessThreshold !== undefined ? { thicknessThreshold: mat.thicknessThreshold / 1000 } : {}),
    // F) fázis: EC2 beton nemlineáris σ-ε modell.
    ...(mat.fck !== undefined ? { fck: mat.fck * 1e4 } : {}),
    ...(mat.epsC2 !== undefined ? { epsC2: mat.epsC2 } : {}),
    ...(mat.epsCu2 !== undefined ? { epsCu2: mat.epsCu2 } : {}),
    ...(mat.n !== undefined ? { n: mat.n } : {}),
  });
  const shape = toShape(sec);
  const section = makeSection(sec.id, sec.name, shape, recommendedShearFactor(shape, material.nu as number));
  return { material, section };
}

/** A legközelebbi hálócsomópont fem-core `NodeId`-ja (stringként). */
function nodeIdAt(x: number, span: number, elementCount: number): string {
  const nodeSpacing = span / (2 * elementCount);
  const idx = Math.min(Math.max(Math.round(x / nodeSpacing), 0), 2 * elementCount);
  return `N${idx}`;
}

/** Az `EditableModel` lefordítása egy futtatható `fem-core` `Model`-lé. */
export function compileModel(editable: EditableModel): Model {
  const { material, section } = buildCatalogParts(editable.materialId, editable.sectionId);

  const mesh = uniformMesh(editable.span, editable.elementCount, {
    sectionId: section.id as unknown as string,
    materialId: material.id as unknown as string,
    integration: editable.integration,
  });

  const nodeAt = (x: number): string => nodeIdAt(x, editable.span, editable.elementCount);

  const boundaries = editable.supports.map((s) =>
    s.type === 'fixed' ? fixed(nodeAt(s.x)) : pinned(nodeAt(s.x)),
  );

  const loads = [
    ...editable.loads.map((l) =>
      l.kind === 'point'
        ? nodalForce(nodeAt(l.x), l.p, l.id)
        : l.kind === 'moment'
          ? nodalMoment(nodeAt(l.x), l.m, l.id)
          : distributedForce(l.x1, l.x2, l.q1, l.q2, l.id),
    ),
    ...(editable.selfWeight ? [selfWeightLoad(1, 'G-self')] : []),
  ];

  return buildModel({
    name: editable.presetId,
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [section],
    boundaries,
    loads,
  });
}

export interface SolveOutcome {
  readonly model: Model;
  readonly result: LinearResult | null;
  readonly error: string | null;
}

/** A modell lefordítása és lineáris megoldása, hibatűrő módon (a felület sosem omlik össze egy érvénytelen modelltől). */
export function solveEditableModel(editable: EditableModel): SolveOutcome {
  const model = compileModel(editable);
  try {
    const result = solveLinear(model);
    return { model, result, error: null };
  } catch (error) {
    if (error instanceof InvalidModelError) {
      const messages = error.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message);
      return { model, result: null, error: messages.join(' ') || error.message };
    }
    return { model, result: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export interface ModalOutcome {
  readonly model: Model;
  readonly modal: ModalResult | null;
  readonly error: string | null;
}

/**
 * A modell modális (sajátfrekvencia) analízise, hibatűrő módon — ADR-0016.
 * A `LinearResult`-hoz hasonlóan a felület sosem omlik össze egy
 * érvénytelen vagy szinguláris tömegmátrixú modelltől.
 */
export function solveModalModel(editable: EditableModel): ModalOutcome {
  const model = compileModel(editable);
  try {
    const modal = solveModal(model);
    return { model, modal, error: null };
  } catch (error) {
    if (error instanceof InvalidModelError) {
      const messages = error.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message);
      return { model, modal: null, error: messages.join(' ') || error.message };
    }
    return { model, modal: null, error: error instanceof Error ? error.message : String(error) };
  }
}
