/**
 * `EditableModel` → `@femati/fem-core` `Model` fordítás, és a lineáris
 * megoldás futtatása. EZ AZ EGYETLEN HELY, ahol a felület a magot hívja
 * (DESIGN-TERV 1.7: „a felület nem számol") — minden más komponens csak a
 * `solveLinear()` kimenetét jeleníti meg.
 */
import {
  buildModel,
  distributedForce,
  distributedMoment,
  fixed,
  foundation,
  generateLayers,
  makeLayeredSection,
  makeMaterial,
  makeSection,
  nodalForce,
  nodalMoment,
  pinned,
  springSupport,
  supportDisplacement,
  thermal as thermalLoad,
  rect,
  circle as circleShape,
  tube as tubeShape,
  rhs as rhsShape,
  tProfile as tProfileShape,
  iProfile,
  selfWeight as selfWeightLoad,
  recommendedShearFactor,
  sectionStiffness,
  solveLinearContact,
  solveModal,
  uniformMesh,
  InvalidModelError,
  type Material,
  type ContactResult,
  type Model,
  type ModalResult,
  type Section,
  type SectionShape,
  type SectionStiffness,
} from '@femati/fem-core';
import { findMaterial, findSection, type SectionEntry } from '../data/catalog.js';
import { DEFAULT_SPRING_STIFFNESS, type EditableModel } from './editable.js';

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
    case 't':
      return tProfileShape(cm(section.h), cm(section.b), cm(section.tw ?? 6), cm(section.tf ?? 10));
  }
}

/**
 * A kompozit keresztmetszet (acél alapszelvény + betonlemez) csak acél
 * alapanyagnál értelmezett — 2026-09-04, VALÓDI hiba javítva: a UI eredetileg
 * bármilyen anyagnál felkínálta a "kompozit" kapcsolót, `panels/LeftPanel.tsx`
 * mostantól ezt korlátozza, DE egy régebbi (a korlátozás előtti) mentésből
 * betöltött modell ELVILEG még hordozhat `composite.enabled: true`-t
 * nem-acél anyaggal — ez a fordítási réteg (nem csak a felület) zárja ki
 * végérvényesen, hogy egy ilyen állapot csendben, félrevezető "kompozit"
 * eredményt adjon.
 */
export function isCompositeActive(editable: EditableModel): boolean {
  return editable.composite.enabled && findMaterial(editable.materialId).family === 'steel';
}

/** A fem-core anyag előállítása egy katalógus-anyagbejegyzésből (mm / kN·cm² → SI). */
function buildCatalogMaterial(mat: ReturnType<typeof findMaterial>): Material {
  return makeMaterial(mat.id, mat.name, {
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
}

/** A fem-core anyag/szelvény előállítása a katalógusból (mm / kN·cm² → SI). */
function buildCatalogParts(materialId: string, sectionId: string): { material: Material; section: Section } {
  const mat = findMaterial(materialId);
  const sec = findSection(sectionId);
  const material = buildCatalogMaterial(mat);
  const shape = toShape(sec);
  const section = makeSection(sec.id, sec.name, shape, recommendedShearFactor(shape, material.nu as number));
  return { material, section };
}

// Rétegszám a kompozit acél alapszelvényhez — ugyanaz, mint `model/nonlinear.ts`
// `LAYER_COUNT`-ja (32, a réteg-középponti mintavétel másodrendű hatása
// ennél a finomságnál <1%-ra csökken, ld. ott a magyarázatot).
const COMPOSITE_STEEL_LAYER_COUNT = 32;
// A betonlemez homogén téglalap — 8 réteg bőven elég egy állandó
// szélességű/vastagságú kontúrhoz (nincs törésponti geometria, ami finomabb
// mintavételt igényelne, ld. `material/layeredSection.ts` fejléce).
const COMPOSITE_SLAB_LAYER_COUNT = 8;

/**
 * Kompozit (acél alapszelvény + betonlemez) rétegelt keresztmetszet
 * összeállítása — 2026-09-04. A `sectionStiffness()` (fem-core) rétegelt
 * ágának EI-képlete (`Σ Eₗ·Aₗ·zₗ²`) csak akkor helyes, ha `z=0` a
 * TRANSZFORMÁLT (E-vel súlyozott) semleges tengely — ezért itt explicit
 * kiszámoljuk azt (`zBar`), és minden réteget ehhez centrálunk, mielőtt a
 * mag megkapná őket. A betonlemez az alapszelvény TETEJÉRE kerül, teljes
 * (rugalmas) nyírt kapcsolattal — nincs csúszás-modell.
 */
function buildCompositeSection(editable: EditableModel): { section: Section; materials: readonly Material[] } {
  const steelMat = findMaterial(editable.materialId);
  const steelEntry = findSection(editable.sectionId);
  const steel = buildCatalogMaterial(steelMat);
  const steelShape = toShape(steelEntry);

  const slabMat = findMaterial(editable.composite.slabMaterialId);
  const concrete = buildCatalogMaterial(slabMat);
  const slabShape = rect(editable.composite.slabWidth, editable.composite.slabThickness);

  const steelE = steel.e as number;
  const concreteE = concrete.e as number;

  const steelLayers = generateLayers(steelShape, COMPOSITE_STEEL_LAYER_COUNT).map((l) => ({
    ...l,
    materialId: steel.id as unknown as string,
  }));
  const steelTopZ = Math.min(...steelLayers.map((l) => l.z - l.t / 2));

  // A lemez saját (középpont-relatív) alsó éle (+t/2) kerül a `steelTopZ`-re.
  const slabShift = steelTopZ - editable.composite.slabThickness / 2;
  const slabLayers = generateLayers(slabShape, COMPOSITE_SLAB_LAYER_COUNT).map((l) => ({
    ...l,
    z: l.z + slabShift,
    materialId: concrete.id as unknown as string,
  }));

  const sumEA = steelLayers.reduce((s, l) => s + steelE * l.b * l.t, 0) + slabLayers.reduce((s, l) => s + concreteE * l.b * l.t, 0);
  const sumEAz = steelLayers.reduce((s, l) => s + steelE * l.b * l.t * l.z, 0) + slabLayers.reduce((s, l) => s + concreteE * l.b * l.t * l.z, 0);
  const zBar = sumEAz / sumEA;
  const centeredLayers = [...steelLayers, ...slabLayers].map((l) => ({ ...l, z: l.z - zBar }));

  const section = makeLayeredSection(
    steelEntry.id,
    `${steelEntry.name} + ${slabMat.name} (kompozit)`,
    centeredLayers,
    recommendedShearFactor(steelShape, steel.nu as number),
  );
  return { section, materials: [steel, concrete] };
}

/** A kompozit szelvény tényleges (transzformált) merevségi jellemzői — a bal panel kiírásához. */
export function compositeSectionStiffness(editable: EditableModel): SectionStiffness {
  const { section, materials } = buildCompositeSection(editable);
  const byId = new Map(materials.map((m) => [m.id as unknown as string, m]));
  const lookup = (id: string): Material | undefined => byId.get(id);
  return sectionStiffness(section, materials[0] as Material, lookup as never);
}

/** A legközelebbi hálócsomópont fem-core `NodeId`-ja (stringként). */
function nodeIdAt(x: number, span: number, elementCount: number): string {
  const nodeSpacing = span / (2 * elementCount);
  const idx = Math.min(Math.max(Math.round(x / nodeSpacing), 0), 2 * elementCount);
  return `N${idx}`;
}

/** Az `EditableModel` lefordítása egy futtatható `fem-core` `Model`-lé. */
export function compileModel(editable: EditableModel): Model {
  const { section, materials }: { section: Section; materials: readonly Material[] } = isCompositeActive(editable)
    ? buildCompositeSection(editable)
    : (() => {
        const parts = buildCatalogParts(editable.materialId, editable.sectionId);
        return { section: parts.section, materials: [parts.material] };
      })();
  // A háló-elemek "külső" anyaghivatkozása az alap (kompozitnál: acél)
  // anyagra mutat — a rétegek SAJÁT `materialId`-je (`buildCompositeSection`)
  // felülírja ezt a `sectionStiffness()`-ben, ld. `element/constitutive.ts`.
  const baseMaterial = materials[0] as Material;

  const mesh = uniformMesh(editable.span, editable.elementCount, {
    sectionId: section.id as unknown as string,
    materialId: baseMaterial.id as unknown as string,
    integration: editable.integration,
  });

  const nodeAt = (x: number): string => nodeIdAt(x, editable.span, editable.elementCount);

  const boundaries = editable.supports.map((s) =>
    s.type === 'fixed' ? fixed(nodeAt(s.x)) : s.type === 'spring' ? springSupport(nodeAt(s.x), s.k ?? DEFAULT_SPRING_STIFFNESS) : pinned(nodeAt(s.x)),
  );

  // Előírt támaszmozgás (dz/dPhi) — a Boundary MELLETT egy külön Load, csak
  // ha a támaszhoz ténylegesen meg van adva bármelyik komponens.
  const supportDisplacements = editable.supports
    .filter((s) => s.dz !== undefined || s.dPhi !== undefined)
    .map((s) => supportDisplacement(nodeAt(s.x), s.dz, s.dPhi, `${s.id}-disp`));

  const loads = [
    ...editable.loads.map((l) =>
      l.kind === 'point'
        ? nodalForce(nodeAt(l.x), l.p, l.id)
        : l.kind === 'moment'
          ? nodalMoment(nodeAt(l.x), l.m, l.id)
          : l.kind === 'distributed'
            ? distributedForce(l.x1, l.x2, l.q1, l.q2, l.id)
            : distributedMoment(l.x1, l.x2, l.m1, l.m2, l.id),
    ),
    ...supportDisplacements,
    ...(editable.selfWeight ? [selfWeightLoad(editable.selfWeightFactor ?? 1, 'G-self')] : []),
    ...(editable.thermalLoad.enabled
      ? [thermalLoad(editable.thermalLoad.tTop, editable.thermalLoad.tBottom, editable.thermalLoad.tRef, 'T-global')]
      : []),
  ];

  const foundations = editable.foundations.map((f) => foundation(f.x1, f.x2, f.c, f.noTension));

  return buildModel({
    name: editable.presetId,
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials,
    sections: [section],
    boundaries,
    loads,
    foundations,
  });
}

export interface SolveOutcome {
  readonly model: Model;
  readonly result: ContactResult | null;
  readonly error: string | null;
}

/**
 * A modell lefordítása és lineáris megoldása, hibatűrő módon (a felület sosem
 * omlik össze egy érvénytelen modelltől). A `solveLinearContact()` a
 * no-tension (felemelkedésre képes) ágyazatok kontakt-állapotát is kezeli
 * (ADR-0022) — olyan modellekre, ahol egyetlen ágyazat sem `noTension`, EGY
 * `solveLinear()`-hívásra esik vissza, bit-azonos eredménnyel.
 */
export function solveEditableModel(editable: EditableModel): SolveOutcome {
  const model = compileModel(editable);
  try {
    const result = solveLinearContact(model, { axialForce: editable.axialForce });
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
