/**
 * Lineárisan rugalmas megoldás.
 *
 * Diplomaterv 3.1.7.3: „A rúdszerkezet állapotjellemzőinek meghatározásában a
 * legidőigényesebb feladat a K·v = q lineáris egyenletrendszer megoldása."
 *
 * A kimenet alakját a DESIGN-TERV.md 8. fejezete (felület ↔ mag adatszerződés)
 * rögzíti. A globális egyensúly ELVILEG EGZAKT, ezért gépi pontossággal kell
 * teljesülnie (docs/HIBATURESI-POLITIKA.md 3. pont) — ha nem, az a kompilálás
 * vagy a peremfeltétel-kezelés hibája, nem eltűrhető pontatlanság.
 */

import { norm2 } from '../linalg/dense.js';
import { SingularMatrixError } from '../linalg/errors.js';
import { STRESS_POINTS } from '../element/quadrature.js';
import { internalForces } from '../element/timoshenko3.js';
import { rigidBodyModes } from '../element/timoshenko3.js';
import { jacobian } from '../element/jacobian.js';
import {
  SelfCheckCollector,
  checkElementStiffness,
  SELF_CHECK_TOLERANCE,
  type SelfCheckLevel,
  type SelfCheckReport,
} from '../diagnostics/selfCheck.js';
import {
  assemble,
  foundationMatrix,
  type AssembledSystem,
  type PreparedElement,
} from '../assembly/assembler.js';
import { buildLoadVector, elementKappa0, unsupportedLoads } from '../assembly/loadVector.js';
import { describeDof, type ConstraintStrategy } from '../assembly/dofMap.js';
import { plasticShearCapacity } from '../material/shearMomentInteraction.js';
import { isRunnable, validateModel, type Diagnostic } from '../model/validate.js';
import { averageAtNodes, extrapolateElementToNodes, type AveragedField } from '../post/extrapolation.js';
import { estimateElementError } from '../post/errorEstimator.js';
import type { Model, NodeId } from '../model/types.js';

// ─── Kimeneti típusok (DESIGN-TERV 8) ─────────────────────────────────────────

export interface NodeResult {
  readonly nodeId: NodeId;
  readonly x: number;
  /** Lehajlás [m] */
  readonly w: number;
  /** Elfordulás [rad] */
  readonly phi: number;
  /**
   * Csomópontra extrapolált, elemhatáron átlagolt hajlítónyomaték [kNm]
   * (Diplomaterv 3.1.7.4, 46. oldal). Diagramrajzoláshoz.
   */
  readonly m: number;
  /** Csomópontra extrapolált, elemhatáron átlagolt nyíróerő [kN]. */
  readonly t: number;
}

export interface Reaction {
  readonly nodeId: NodeId;
  readonly x: number;
  /** Függőleges reakcióerő [kN] */
  readonly fz: number;
  /** Reakciónyomaték [kNm] */
  readonly my: number;
}

export interface GaussPointResult {
  /** Globális x koordináta [m] */
  readonly x: number;
  readonly xi: number;
  /** Görbület [1/m] */
  readonly kappa: number;
  /** Nyírási torzulás [–] */
  readonly gamma: number;
  /** Hajlítónyomaték [kNm] */
  readonly m: number;
  /** Nyíróerő [kN] */
  readonly t: number;
}

export interface ElementResult {
  readonly elementId: string;
  readonly gaussPoints: readonly GaussPointResult[];
  /**
   * Elemenkénti hibajelző [%]: az M és T extrapolációjának csomóponti
   * átlagolása ELŐTTI ugrás a mező szélsőértékéhez viszonyítva, a kettő
   * közül a nagyobbik (ld. `post/errorEstimator.ts`). MODERN kiegészítés,
   * nem a diplomaterv része.
   */
  readonly errorEstimate: number;
}

export interface Extreme {
  readonly value: number;
  readonly x: number;
}

export interface SectionProps {
  readonly ei: number;
  readonly gas: number;
  readonly area: number;
  readonly inertia: number;
  readonly elasticModulus: number;
  readonly plasticModulus: number;
  readonly shapeFactor: number;
  /** Rugalmas nyomatéki teherbírás Mₑ = σY·Kₑ [kNm]; null, ha nincs σY */
  readonly me: number | null;
  /** Képlékeny nyomatéki teherbírás Mp = σY·Kp [kNm]; null, ha nincs σY */
  readonly mp: number | null;
  /**
   * Képlékeny nyíróerő-teherbírás Vpl = κs·A·σY/√3 [kN]; null, ha nincs σY
   * (ADR-0018, A) út — EN 1993-1-1 6.2.8 stílusú, utólagos ellenőrzéshez).
   */
  readonly vpl: number | null;
}

export interface EquilibriumCheck {
  /** Σ(függőleges terhek + reakciók) [kN] — elvileg zérus */
  readonly sumFz: number;
  /** Σ(nyomatékok az origóra) [kNm] — elvileg zérus */
  readonly sumMy: number;
  /** |ΣFz| a ható erők nagyságához viszonyítva */
  readonly relativeFz: number;
  /** |ΣMy| a ható nyomatékok nagyságához viszonyítva */
  readonly relativeMy: number;
  /** Igaz, ha mindkét relatív hiba a gépi pontosság tartományában van */
  readonly satisfied: boolean;
}

export interface LinearResult {
  /** Teljes elmozdulásvektor, [w, φ] párokban, csomópont-sorrendben. */
  readonly displacements: Float64Array;
  readonly nodes: readonly NodeResult[];
  readonly reactions: readonly Reaction[];
  readonly elements: readonly ElementResult[];
  readonly extremes: {
    readonly w: Extreme;
    readonly phi: Extreme;
    readonly m: Extreme;
    readonly t: Extreme;
  };
  readonly props: SectionProps;
  readonly dofCount: number;
  readonly activeDofCount: number;
  readonly equilibrium: EquilibriumCheck;
  readonly selfCheck: SelfCheckReport;
  readonly strategy: ConstraintStrategy;
  /** Diagnosztikák a modellről (figyelmeztetések is). */
  readonly diagnostics: readonly Diagnostic[];
  /**
   * Figyelmeztetések a számításról — például olyan teher, amelyet ez a fázis
   * még nem vesz figyelembe. SOHA nem maradhat elhallgatva.
   */
  readonly warnings: readonly string[];
  /** A profil mérőszáma — a frontális módszerrel való összevetéshez (P17). */
  readonly meanBandwidth: number;
  /**
   * Összesített hibajelző [%] — a legrosszabb elemenkénti érték
   * (DESIGN-TERV.md 8. fejezet: „egyensúlyi maradék [%]"; a tényleges
   * definíció a diszkretizációs ugrás, ld. `ElementResult.errorEstimate`).
   */
  readonly errorEstimate: number;
}

export interface SolveOptions {
  readonly strategy?: ConstraintStrategy;
  readonly penalty?: number;
  readonly selfCheck?: SelfCheckLevel;
  /** Teherszorzó (λ). */
  readonly scale?: number;
  /** Referencia axiális erő [kN] — másodrendű (P-Δ) hatás, ld. `assembly/assembler.ts` `AssemblyOptions.axialForce`. */
  readonly axialForce?: number;
  /** No-tension ágyazat kontakt-iterációja — ld. `assembly/assembler.ts` `AssemblyOptions.excludedFoundationElementIds` és `solveLinearContact()` lent. */
  readonly excludedFoundationElementIds?: ReadonlySet<string>;
}

/** A modell érvénytelen, ezért nem futtatható. */
export class InvalidModelError extends Error {
  override readonly name = 'InvalidModelError';
  readonly diagnostics: readonly Diagnostic[];

  constructor(diagnostics: readonly Diagnostic[]) {
    const errors = diagnostics.filter((d) => d.severity === 'error');
    super(
      `A modell nem futtatható, ${errors.length} hiba miatt:\n` +
        errors.map((d) => `  · ${d.message}`).join('\n'),
    );
    this.diagnostics = diagnostics;
  }
}

// ─── Megoldás ─────────────────────────────────────────────────────────────────

/**
 * A teljes elmozdulásvektor összeállítása az aktív megoldásból és az előírt
 * (támaszmozgás) értékekből.
 */
function expandDisplacements(system: AssembledSystem, active: Float64Array): Float64Array {
  const { map } = system;
  const full = new Float64Array(map.totalDofs);
  for (let d = 0; d < map.totalDofs; d++) {
    const a = map.activeIndex[d] ?? -1;
    full[d] = a >= 0 ? (active[a] ?? 0) : (map.prescribedValue[d] ?? 0);
  }
  return full;
}

/**
 * Tisztán a rúdelemek belső ereje: Σₑ Kₑ·uₑ — SEM ágyazat, SEM rugós támasz,
 * SEM penalty NINCS benne. Ez a reakcióerő-számítás alapja (lásd lent).
 */
function internalElementForces(system: AssembledSystem, u: Float64Array): Float64Array {
  const { map, elements } = system;
  const fint = new Float64Array(map.totalDofs);
  const ue = new Float64Array(6);

  for (const e of elements) {
    for (let i = 0; i < 6; i++) ue[i] = u[e.dofs[i] ?? 0] ?? 0;
    const fe = e.ke.multiplyVector(ue);
    for (let i = 0; i < 6; i++) fint[e.dofs[i] ?? 0] += fe[i] ?? 0;
  }
  return fint;
}

/**
 * A TELJES belső erő: elemek + rugalmas ágyazat + rugós támaszok (a penalty
 * kivételével). Ez a csomóponti egyensúly (aktív szabadságfokok)
 * önellenőrzésének alapja — ott mindennek benne kell lennie, ami ténylegesen
 * hozzájárul a K mátrixhoz.
 */
function internalCombinedForces(
  system: AssembledSystem,
  model: Model,
  u: Float64Array,
  fintElements: Float64Array,
): Float64Array {
  const { map, elements } = system;
  const fint = Float64Array.from(fintElements);
  const ue = new Float64Array(6);

  for (const e of elements) {
    if (e.foundationC <= 0) continue;
    for (let i = 0; i < 6; i++) ue[i] = u[e.dofs[i] ?? 0] ?? 0;
    const ff = foundationMatrix(e.nodeX, e.foundationC, e.id).multiplyVector(ue);
    for (let i = 0; i < 6; i++) fint[e.dofs[i] ?? 0] += ff[i] ?? 0;
  }

  for (const b of model.boundaries) {
    const i = map.nodeIndex.get(b.nodeId as string);
    if (i === undefined) continue;
    if (b.springW !== undefined) fint[2 * i] += (b.springW as number) * (u[2 * i] ?? 0);
    if (b.springPhi !== undefined) fint[2 * i + 1] += (b.springPhi as number) * (u[2 * i + 1] ?? 0);
  }

  return fint;
}

/** Az egyensúly ellenőrzése: Σ(teher + reakció) = 0 erőre és nyomatékra. */
function checkEquilibrium(
  system: AssembledSystem,
  loads: Float64Array,
  reactions: Float64Array,
): EquilibriumCheck {
  const { map } = system;
  let sumFz = 0;
  let sumMy = 0;
  let scaleF = 0;
  let scaleM = 0;

  for (let i = 0; i < map.nodeCount; i++) {
    const x = map.nodeX[i] ?? 0;
    const fz = (loads[2 * i] ?? 0) + (reactions[2 * i] ?? 0);
    const my = (loads[2 * i + 1] ?? 0) + (reactions[2 * i + 1] ?? 0);

    sumFz += fz;
    sumMy += my + x * fz;

    scaleF += Math.abs(loads[2 * i] ?? 0) + Math.abs(reactions[2 * i] ?? 0);
    scaleM +=
      Math.abs(loads[2 * i + 1] ?? 0) +
      Math.abs(reactions[2 * i + 1] ?? 0) +
      Math.abs(x) * (Math.abs(loads[2 * i] ?? 0) + Math.abs(reactions[2 * i] ?? 0));
  }

  // Ha a terhek és reakciók nagyságrendje is a lebegőpontos zaj szintjén van
  // (tipikusan: kizárólag hőteher/kezdeti alakváltozás hat, valódi külső erő
  // nincs — P5), a RELATÍV mérőszám nevezője is a zaj szintjén marad, és egy
  // önmagában elhanyagolható |sumFz| is 100%-os "relatív hibaként" jelenne
  // meg. Ilyenkor az abszolút reziduumot nézzük — az elvileg pontosan
  // zérusnak kell lennie, és gépi pontossággal az is.
  const scaleFloor = SELF_CHECK_TOLERANCE.equilibrium;
  const relativeFz = scaleF > scaleFloor ? Math.abs(sumFz) / scaleF : Math.abs(sumFz);
  const relativeMy = scaleM > scaleFloor ? Math.abs(sumMy) / scaleM : Math.abs(sumMy);

  return {
    sumFz,
    sumMy,
    relativeFz,
    relativeMy,
    satisfied:
      relativeFz <= SELF_CHECK_TOLERANCE.equilibrium &&
      relativeMy <= SELF_CHECK_TOLERANCE.equilibrium,
  };
}

/**
 * Igénybevételek a Gauss-pontokban (Diplomaterv 3.1.7.4).
 *
 * A hőteher kezdeti görbületét (κ0) itt kell levonni az `M` számításánál
 * (σ = D·(ε−ε0)) — a `kappa`/`gamma` mező VÁLTOZATLANUL a teljes geometriai
 * alakváltozás marad (ld. `internalForces` fejléce). A κ0-t a `scale`
 * teherszorzóval kell szorozni, mert az egyparaméteres terhelés (λ) a
 * hőterhet is skálázza (ugyanúgy, ahogy a tehervektorba is `scale`-lel kerül).
 */
/** A hibajelző még nem áll rendelkezésre — azt csak az extrapoláció UTÁN lehet kiszámítani. */
type ElementGaussPoints = Omit<ElementResult, 'errorEstimate'>;

function elementResults(
  elements: readonly PreparedElement[],
  u: Float64Array,
  model: Model,
  scale: number,
): ElementGaussPoints[] {
  const ue = new Float64Array(6);
  const materials = new Map(model.materials.map((m) => [m.id as string, m]));
  const elementById = new Map(model.elements.map((e) => [e.id as string, e]));

  return elements.map((e) => {
    for (let i = 0; i < 6; i++) ue[i] = u[e.dofs[i] ?? 0] ?? 0;

    const sourceElement = elementById.get(e.id);
    const material = sourceElement ? materials.get(sourceElement.materialId as string) : undefined;
    const kappa0 =
      sourceElement && material
        ? scale * elementKappa0(model, sourceElement, material.alpha as number, e.stiffness.height)
        : 0;

    const gaussPoints = STRESS_POINTS.map((gp): GaussPointResult => {
      const f = internalForces({ nodeX: e.nodeX, elementId: e.id }, e.stiffness, ue, gp.xi, kappa0);
      return {
        x: jacobian(e.nodeX, gp.xi, e.id).x,
        xi: gp.xi,
        kappa: f.kappa,
        gamma: f.gamma,
        m: f.m,
        t: f.t,
      };
    });
    return { elementId: e.id, gaussPoints };
  });
}

/**
 * Egy Gauss-ponti mező (M vagy T) extrapolálása a csomópontokba, elemhatáron
 * átlagolva, elemenkénti hibajelzővel (Diplomaterv 3.1.7.4, 46. oldal; P6).
 */
function extrapolateStressField(
  results: readonly ElementGaussPoints[],
  elements: readonly PreparedElement[],
  select: (gp: GaussPointResult) => number,
  fieldExtreme: number,
  nodeCount: number,
): { readonly nodal: Float64Array; readonly errorEstimate: Float64Array } {
  const gaussXi: readonly [number, number, number] = [
    STRESS_POINTS[0]?.xi ?? 0,
    STRESS_POINTS[1]?.xi ?? 0,
    STRESS_POINTS[2]?.xi ?? 0,
  ];
  const elementNodeIndices = elements.map((e) => e.nodeIndices);
  const elementNodalValues = results.map((r) => {
    const values = r.gaussPoints.map(select);
    const triple: readonly [number, number, number] = [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0];
    return extrapolateElementToNodes(triple, gaussXi);
  });
  const averaged: AveragedField = averageAtNodes(elementNodeIndices, elementNodalValues, nodeCount);
  const errorEstimate = estimateElementError(elementNodeIndices, elementNodalValues, averaged, fieldExtreme);
  return { nodal: averaged.nodal, errorEstimate };
}

function extremeOf(values: readonly { value: number; x: number }[]): Extreme {
  let best: Extreme = { value: 0, x: 0 };
  for (const v of values) {
    if (Math.abs(v.value) > Math.abs(best.value)) best = { value: v.value, x: v.x };
  }
  return best;
}

/**
 * Lineárisan rugalmas statikai megoldás.
 *
 * @throws InvalidModelError ha a modell validációja hibát talál
 * @throws SingularMatrixError ha a szerkezet mechanizmus
 */
export function solveLinear(model: Model, options: SolveOptions = {}): LinearResult {
  const diagnostics = validateModel(model);
  if (!isRunnable(diagnostics)) throw new InvalidModelError(diagnostics);

  const warnings: string[] = [];
  const notSupported = unsupportedLoads(model);
  if (notSupported.length > 0) {
    const kinds = [...new Set(notSupported.map((l) => l.kind))].join(', ');
    warnings.push(
      `A következő tehertípusok NINCSENEK figyelembe véve ebben a fázisban: ${kinds}. ` +
        `A megoszló terhek, az önsúly és a hőteher a P5 fázisban kerülnek be. ` +
        `Az eredmény ezért nem a teljes terhelést tükrözi.`,
    );
  }

  const system = assemble(model, {
    ...(options.strategy !== undefined ? { strategy: options.strategy } : {}),
    ...(options.penalty !== undefined ? { penalty: options.penalty } : {}),
    ...(options.axialForce !== undefined ? { axialForce: options.axialForce } : {}),
    ...(options.excludedFoundationElementIds !== undefined
      ? { excludedFoundationElementIds: options.excludedFoundationElementIds }
      : {}),
  });

  const collector = new SelfCheckCollector(options.selfCheck ?? 'full');
  if (collector.enabled) {
    for (const e of system.elements) {
      collector.addAll(
        checkElementStiffness(e.ke, rigidBodyModes(e.nodeX), e.id, 4, collector.fullEnabled),
      );
    }
  }

  const loads = buildLoadVector(model, system.map, options.scale ?? 1);

  // Jobboldal: külső teher + a peremfeltételekből származó hozzájárulás
  const rhs = new Float64Array(system.map.activeDofs);
  for (let a = 0; a < rhs.length; a++) {
    rhs[a] = (loads.active[a] ?? 0) + (system.constraintLoad[a] ?? 0);
  }

  let activeU: Float64Array;
  try {
    activeU = system.k.solve(rhs);
  } catch (error) {
    if (error instanceof SingularMatrixError) {
      const { nodeIndex, kind } = describeDof(indexOfActive(system, error.dof));
      const nodeId = system.map.nodeIds[nodeIndex];
      throw new SingularMatrixError(
        error.dof,
        error.pivot,
        `Az érintett szabadságfok: a(z) "${String(nodeId)}" csomópont ` +
          `${kind === 'w' ? 'eltolódása' : 'elfordulása'} (x = ${system.map.nodeX[nodeIndex] ?? 0} m). ` +
          `Ellenőrizze a megtámasztásokat.`,
      );
    }
    throw error;
  }

  const u = expandDisplacements(system, activeU);
  const fintElements = internalElementForces(system, u);
  const fintCombined = internalCombinedForces(system, model, u, fintElements);

  /**
   * EGYSÉGES reakcióformula minden támasztípusra (merev, penalty, rugós,
   * rugalmas ágyazat):
   *
   *   reakció[d] = elemek_belső_ereje[d] − külső_teher[d]
   *
   * Levezetés: bármely szabadságfokon a globális egyensúly
   *   elemek_ereje[d] + (a támasz K-hoz adott tagja)[d] = külső_teher[d]
   * alakú (a támasz — legyen az rugó, ágyazat vagy a penalty-tag — a
   * merevségi mátrixba épül be, ezért baloldali "ellenállásként" jelenik
   * meg). A támasz által a szerkezetre kifejtett REAKCIÓ éppen ennek a
   * tagnak a negáltja:
   *   reakció[d] = −(támasz tagja)[d] = elemek_ereje[d] − külső_teher[d]
   *
   * MERT ILYENKOR a szabadságfok state-je kétféle lehet:
   *  · MEGKÖTÖTT (elimination): a dof nincs a K-ban, "elemek_ereje[d]" a
   *    hozzá kapcsolódó elemek tényleges belső ereje — ez maga a reakció,
   *    mert nincs más ellenállás-tag.
   *  · AKTÍV (penalty / rugó / ágyazat): a dof a K-ban van, a solve már
   *    biztosítja elemek_ereje[d] + támasz_tagja[d] ≈ külső_teher[d]-t,
   *    ezért a fenti képlet ugyanazt az eredményt adja algebrai átrendezéssel.
   *
   * Ez a képlet EGYETLEN speciális eset nélkül helyes mind a négy
   * támasztípusra — numerikusan igazolva: konzol, kéttámaszú tartó, befogott-
   * görgős (statikailag határozatlan) tartó, rugós támasz, penalty vs
   * elimination — minden esetben ΣFz = ΣMy = 0 gépi pontosságig (< 1e-11).
   */
  const residual = new Float64Array(system.map.totalDofs);
  for (let d = 0; d < system.map.totalDofs; d++) {
    residual[d] = (fintElements[d] ?? 0) - (loads.full[d] ?? 0);
  }

  const springNodes = new Set<number>();
  for (const b of model.boundaries) {
    const i = system.map.nodeIndex.get(b.nodeId as string);
    if (i !== undefined && (b.springW !== undefined || b.springPhi !== undefined)) {
      springNodes.add(i);
    }
  }
  const foundationNodes = new Set<number>();
  for (const e of system.elements) {
    if (e.foundationC <= 0) continue;
    for (const ni of e.nodeIndices) foundationNodes.add(ni);
  }

  const reactions: Reaction[] = [];
  for (let i = 0; i < system.map.nodeCount; i++) {
    const supported =
      system.map.prescribed[2 * i] === 1 ||
      system.map.prescribed[2 * i + 1] === 1 ||
      springNodes.has(i) ||
      foundationNodes.has(i);
    if (!supported) continue;
    const nodeId = system.map.nodeIds[i];
    if (nodeId === undefined) continue;
    reactions.push({
      nodeId,
      x: system.map.nodeX[i] ?? 0,
      fz: residual[2 * i] ?? 0,
      my: residual[2 * i + 1] ?? 0,
    });
  }

  // Egyensúly: a külső terhek és a reakciók összege zérus. A `residual`
  // (TELJES DOF-vektor, nem csak a támasz-csomópontokra szűrt `reactions`)
  // szándékosan ELTÉR a nyilvános reakció-listától: az ágyazat/rugó esetén
  // a kettő EGYBEESIK (ott minden "extra" merevség-hozzájárulás támasz-
  // szerű csomópontokon jelentkezik), de a másodrendű (P-Δ) geometriai
  // merevség (`AssemblyOptions.axialForce`) MINDEN elemre hat, nem csak a
  // támaszokéra — ha itt a szűrt `reactions`-t használnánk, a belső
  // elemeken keletkező geometriai reziduum kimaradna az összegzésből, és
  // az egyensúly hamisan nem teljesülne, holott a (Ke − N·Kg)·u = F
  // energiaelv szerint a megoldás egzaktul egyensúlyban van.
  const equilibrium = checkEquilibrium(system, loads.full, residual);

  collector.add({
    id: 'global.equilibrium-force',
    name: 'Globális erőegyensúly ΣFz',
    severity: equilibrium.relativeFz <= SELF_CHECK_TOLERANCE.equilibrium ? 'ok' : 'error',
    measured: equilibrium.relativeFz,
    tolerance: SELF_CHECK_TOLERANCE.equilibrium,
    unit: '',
    detail:
      'A külső terhek és a reakcióerők összegének elvileg pontosan zérusnak kell ' +
      'lennie. Eltérés esetén a kompilálás vagy a peremfeltétel-kezelés hibás.',
    reference: 'Diplomaterv 3.1.7',
  });
  collector.add({
    id: 'global.equilibrium-moment',
    name: 'Globális nyomatéki egyensúly ΣMy',
    severity: equilibrium.relativeMy <= SELF_CHECK_TOLERANCE.equilibrium ? 'ok' : 'error',
    measured: equilibrium.relativeMy,
    tolerance: SELF_CHECK_TOLERANCE.equilibrium,
    unit: '',
    detail:
      'A terhek és reakciók nyomatéka az origóra elvileg pontosan kiegyenlíti egymást.',
    reference: 'Diplomaterv 3.1.7',
  });

  // A maradék belső erő az AKTÍV szabadságfokokon zérus kell legyen: ez a
  // csomóponti egyensúly, és egyben a megoldás visszahelyettesítése.
  // ITT a TELJES (elemek + ágyazat + rugó) belső erőt kell nézni — a
  // reakcióformulával ellentétben, ahol pont a tiszta elemi erő kellett.
  let maxActiveResidual = 0;
  let residualScale = 0;
  for (let d = 0; d < system.map.totalDofs; d++) {
    if ((system.map.activeIndex[d] ?? -1) < 0) continue;
    if (system.map.prescribed[d] === 1) continue; // penalty esetén itt a rugó tart
    const combinedResidual = (fintCombined[d] ?? 0) - (loads.full[d] ?? 0);
    maxActiveResidual = Math.max(maxActiveResidual, Math.abs(combinedResidual));
    residualScale = Math.max(residualScale, Math.abs(fintCombined[d] ?? 0), Math.abs(loads.full[d] ?? 0));
  }
  const relativeResidual = residualScale > 0 ? maxActiveResidual / residualScale : maxActiveResidual;
  collector.add({
    id: 'global.nodal-residual',
    name: 'Csomóponti egyensúly (visszahelyettesítés)',
    severity: relativeResidual <= 1e-9 ? 'ok' : 'error',
    measured: relativeResidual,
    tolerance: 1e-9,
    unit: '',
    detail:
      'A megoldást visszahelyettesítve a szabad csomópontokon nem maradhat ' +
      'kiegyensúlyozatlan erő. Eltérés esetén az egyenletrendszer megoldása hibás.',
  });

  const rawResults = elementResults(system.elements, u, model, options.scale ?? 1);
  const mExtremeGauss = extremeOf(rawResults.flatMap((e) => e.gaussPoints.map((g) => ({ value: g.m, x: g.x }))));
  const tExtremeGauss = extremeOf(rawResults.flatMap((e) => e.gaussPoints.map((g) => ({ value: g.t, x: g.x }))));

  // Extrapoláció a csomópontokba, elemhatáron átlagolva, elemenkénti
  // hibajelzővel (Diplomaterv 3.1.7.4, 46. oldal; P6).
  const mField = extrapolateStressField(
    rawResults,
    system.elements,
    (gp) => gp.m,
    mExtremeGauss.value,
    system.map.nodeCount,
  );
  const tField = extrapolateStressField(
    rawResults,
    system.elements,
    (gp) => gp.t,
    tExtremeGauss.value,
    system.map.nodeCount,
  );

  const results: ElementResult[] = rawResults.map((r, idx) => ({
    ...r,
    errorEstimate: Math.max(mField.errorEstimate[idx] ?? 0, tField.errorEstimate[idx] ?? 0),
  }));
  const errorEstimate = results.reduce((max, r) => Math.max(max, r.errorEstimate), 0);

  const nodes: NodeResult[] = [];
  for (let i = 0; i < system.map.nodeCount; i++) {
    const nodeId = system.map.nodeIds[i];
    if (nodeId === undefined) continue;
    nodes.push({
      nodeId,
      x: system.map.nodeX[i] ?? 0,
      w: u[2 * i] ?? 0,
      phi: u[2 * i + 1] ?? 0,
      m: mField.nodal[i] ?? 0,
      t: tField.nodal[i] ?? 0,
    });
  }

  const first = system.elements[0];
  const material = model.materials.find((m) => m.id === model.elements[0]?.materialId);
  const sigmaY = material?.sigmaY !== undefined ? (material.sigmaY as number) : null;
  const stiffness = first?.stiffness;

  const props: SectionProps = {
    ei: stiffness?.ei ?? 0,
    gas: stiffness?.gas ?? 0,
    area: stiffness?.area ?? 0,
    inertia: stiffness?.inertia ?? 0,
    elasticModulus: stiffness?.elasticModulus ?? 0,
    plasticModulus: stiffness?.plasticModulus ?? 0,
    shapeFactor: stiffness?.shapeFactor ?? 0,
    me: sigmaY !== null && stiffness ? sigmaY * stiffness.elasticModulus : null,
    mp: sigmaY !== null && stiffness ? sigmaY * stiffness.plasticModulus : null,
    vpl:
      sigmaY !== null && stiffness && material
        ? plasticShearCapacity(sigmaY, stiffness.gas / (material.g as number))
        : null,
  };

  return {
    displacements: u,
    nodes,
    reactions,
    elements: results,
    extremes: {
      w: extremeOf(nodes.map((n) => ({ value: n.w, x: n.x }))),
      phi: extremeOf(nodes.map((n) => ({ value: n.phi, x: n.x }))),
      m: mExtremeGauss,
      t: tExtremeGauss,
    },
    props,
    dofCount: system.map.totalDofs,
    activeDofCount: system.map.activeDofs,
    equilibrium,
    selfCheck: collector.report(),
    strategy: system.strategy,
    diagnostics,
    warnings,
    meanBandwidth: system.k.meanBandwidth,
    errorEstimate,
  };
}

/** Aktív index → globális szabadságfok (hibaüzenethez). */
function indexOfActive(system: AssembledSystem, activeDof: number): number {
  for (let d = 0; d < system.map.totalDofs; d++) {
    if (system.map.activeIndex[d] === activeDof) return d;
  }
  return 0;
}

/** A megoldás euklideszi normája — konvergencia-vizsgálatokhoz. */
export const displacementNorm = (result: LinearResult): number => norm2(result.displacements);

// ─── No-tension ágyazat — kontakt-állapot iteráció (ADR-0022) ─────────────────

export interface ContactResult extends LinearResult {
  /**
   * Azon elemek azonosítói, amelyek a JELENLEGI (végleges) kontakt-állapotban
   * FELEMELKEDTEK a no-tension ágyazatról — az ágyazatuk ezért ki van
   * kapcsolva. Üres, ha nincs `noTension` ágyazat a modellben, vagy ha van,
   * de sehol nem lépett fel felemelkedés.
   */
  readonly foundationLiftOff: readonly string[];
  /** Hány kontakt-iterációra volt szükség a stabil állapotig (0, ha nem is kellett). */
  readonly contactIterations: number;
}

const MAX_CONTACT_ITERATIONS = 25;

/** Azon elem-azonosítók, amelyek geometriailag átfednek egy `noTension` ágyazat-szakasszal — ezek a kontakt-vizsgálat jelöltjei. */
function candidateFoundationElements(model: Model): ReadonlySet<string> {
  const noTensionSegments = model.foundations.filter((f) => f.noTension === true);
  const candidates = new Set<string>();
  if (noTensionSegments.length === 0) return candidates;

  const nodeX = new Map(model.nodes.map((n) => [n.id as string, n.x as number]));
  for (const el of model.elements) {
    const xs = el.nodes.map((id) => nodeX.get(id as string) ?? 0);
    const x1 = Math.min(...xs);
    const x2 = Math.max(...xs);
    for (const f of noTensionSegments) {
      const overlap = Math.min(x2, f.x2 as number) - Math.max(x1, f.x1 as number);
      if (overlap > 0) {
        candidates.add(el.id as string);
        break;
      }
    }
  }
  return candidates;
}

/**
 * Egy jelölt elem "felemelkedett-e" a jelenlegi megoldásból — a w
 * (lefelé pozitív) csomóponti értékeinek átlaga alapján: negatív átlag azt
 * jelenti, hogy a szakasz a talajtól ELTÁVOLODIK, ahol az ágyazat (talaj)
 * nem tud "lehúzni" (no-tension).
 *
 * ELEMENKÉNTI (nem Gauss-ponti) granularitás — MVP-egyszerűsítés: egy
 * elemen belüli részleges felemelkedést nem old fel. Durvább hálónál ez
 * pontatlanságot okozhat; finomabb hálóval (több elem az ágyazat alatt) a
 * közelítés önmagától javul. Ld. ADR-0022.
 */
function elementLiftedOff(model: Model, elementId: string, wByNode: ReadonlyMap<string, number>): boolean {
  const el = model.elements.find((e) => e.id === elementId);
  if (el === undefined) return false;
  const ws = el.nodes.map((id) => wByNode.get(id as string) ?? 0);
  const avg = (ws.reduce((s, v) => s + v, 0)) / ws.length;
  return avg < 0;
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/**
 * Lineárisan rugalmas megoldás, no-tension (felemelkedésre képes) Winkler-
 * ágyazattal — ha a modellben nincs `noTension: true` ágyazat, EGYETLEN
 * híváshoz esik vissza `solveLinear()`-re (a viselkedés a meglévő
 * modelleknél bit-azonos marad).
 *
 * Az algoritmus egy klasszikus kontakt-állapot iteráció (NEM anyagi
 * nemlinearitás, nem `newtonRaphson.ts`): minden lépésben lineárisan
 * megoldjuk a rendszert egy próbált "aktív ágyazat" halmazzal, megnézzük,
 * mely jelölt elemek emelkedtek fel (negatív átlagos w), és ha ez eltér az
 * előző próbától, azzal a halmazzal újraoldunk — amíg a halmaz stabilizálódik
 * vagy el nem érjük az iterációs korlátot (ld. ADR-0022).
 */
export function solveLinearContact(model: Model, options: SolveOptions = {}): ContactResult {
  const candidates = candidateFoundationElements(model);
  if (candidates.size === 0) {
    const result = solveLinear(model, options);
    return { ...result, foundationLiftOff: [], contactIterations: 0 };
  }

  let excluded = new Set<string>();
  let result = solveLinear(model, { ...options, excludedFoundationElementIds: excluded });

  for (let iteration = 1; iteration <= MAX_CONTACT_ITERATIONS; iteration++) {
    const wByNode = new Map(result.nodes.map((n) => [n.nodeId as string, n.w]));
    const nextExcluded = new Set<string>();
    for (const id of candidates) {
      if (elementLiftedOff(model, id, wByNode)) nextExcluded.add(id);
    }
    if (sameSet(nextExcluded, excluded)) {
      return { ...result, foundationLiftOff: [...excluded], contactIterations: iteration - 1 };
    }
    excluded = nextExcluded;
    result = solveLinear(model, { ...options, excludedFoundationElementIds: excluded });
  }

  return {
    ...result,
    foundationLiftOff: [...excluded],
    contactIterations: MAX_CONTACT_ITERATIONS,
    warnings: [
      ...result.warnings,
      `A no-tension ágyazat kontakt-állapota ${MAX_CONTACT_ITERATIONS} iteráció után sem ` +
        `stabilizálódott — az eredmény az utolsó próbált állapotot mutatja, de oszcillálhat.`,
    ],
  };
}
