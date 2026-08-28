/**
 * Egy KIVÁLASZTOTT elem teljes levezetése (ADR-0005, MASTER-PROMPT-TERV P15/A
 * prompt, 4. pont: "a lényeg").
 *
 * ÚJRASZÁMOLÁSSAL készül (ADR-0005 (b) útja): kizárólag a mag publikus, finom
 * szemcsézetű függvényeit hívja lépésenként (`shapeFunctions`, `jacobian`,
 * `bRows`, `elementStiffness`, `elementLoadVector`), és a köztes értékeket
 * egy adatszerkezetbe jegyzi fel — NEM saját maga számol újra semmit "kézzel".
 *
 * KÖTELEZŐ GARANCIA (ADR-0005, P15/A elfogadási kritérium): a visszaadott
 * `ke` és `loadVector` BIT-AZONOS azzal, amit a megoldó ténylegesen használ —
 * mert szó szerint ugyanazt a függvényt hívja (`elementStiffness`,
 * `elementLoadVector`), ugyanazokkal a paraméterekkel, mint `assembler.ts`
 * és `loadVector.ts` (ld. `derivation.test.ts`).
 */
import {
  elementKappa0,
  elementLoadVector,
  reduceDistributedDetail,
  reduceThermalDetail,
  singleElementContext,
  type DistributedLoadGaussDetail,
  type ThermalLoadGaussDetail,
} from '../assembly/loadVector.js';
import { bRows, type BRows } from '../element/bMatrix.js';
import { sectionStiffness, type SectionStiffness } from '../element/constitutive.js';
import { jacobian, type JacobianValues } from '../element/jacobian.js';
import { quadratureFor, STRESS_POINTS } from '../element/quadrature.js';
import { shapeFunctions } from '../element/shapeFunctions.js';
import { elementStiffness, internalForces } from '../element/timoshenko3.js';
import { type DenseMatrix } from '../linalg/dense.js';
import type { IntegrationScheme, Material, MaterialId, Model, Section } from '../model/types.js';

/** Egy Gauss-pont teljes köztes állapota — a levezetés-nézet 4. pontjához. */
export interface GaussStepDetail {
  readonly xi: number;
  readonly w: number;
  /** N₁, N₂, N₃ az adott ξ-ben. */
  readonly n: readonly [number, number, number];
  /** dN₁/dξ, dN₂/dξ, dN₃/dξ. */
  readonly dn: readonly [number, number, number];
  readonly jacobian: JacobianValues;
  readonly bRows: BRows;
}

export interface ElementStiffnessDerivation {
  readonly elementId: string;
  /** [bal, közép, jobb] globális x koordináta [m]. */
  readonly nodeX: readonly [number, number, number];
  readonly length: number;
  readonly scheme: IntegrationScheme;
  readonly stiffness: SectionStiffness;
  /** A hajlítási tag Gauss-pontjai (mindig 3 pontos, GAUSS_3). */
  readonly bendingPoints: readonly GaussStepDetail[];
  /** A nyírási tag Gauss-pontjai (2 pontos szelektívnél, 3 pontos teljesnél). */
  readonly shearPoints: readonly GaussStepDetail[];
  /** A 6×6 elemi merevségi mátrix — SZÓ SZERINT `elementStiffness(...)` eredménye. */
  readonly ke: DenseMatrix;
  /** A 6×1 elemi tehervektor (λ=1) — SZÓ SZERINT `elementLoadVector(...)` eredménye. */
  readonly loadVector: Float64Array;
}

function gaussStep(nodeX: readonly [number, number, number], xi: number, w: number, elementId: string): GaussStepDetail {
  const { n, dn } = shapeFunctions(xi);
  return {
    xi,
    w,
    n,
    dn,
    jacobian: jacobian(nodeX, xi, elementId),
    bRows: bRows(nodeX, xi, elementId),
  };
}

/**
 * Egy elem teljes merevségi/teher-levezetése a modellből.
 *
 * @throws Error ha az elem, a szelvénye vagy az anyaga nem található a modellben
 */
export function deriveElementStiffness(model: Model, elementId: string): ElementStiffnessDerivation {
  const element = model.elements.find((e) => (e.id as string) === elementId);
  if (element === undefined) {
    throw new Error(`A(z) "${elementId}" elem nem található a modellben.`);
  }
  const nodeById = new Map(model.nodes.map((n) => [n.id as string, n.x as number]));
  const nodeX: [number, number, number] = [
    nodeById.get(element.nodes[0] as string) ?? 0,
    nodeById.get(element.nodes[1] as string) ?? 0,
    nodeById.get(element.nodes[2] as string) ?? 0,
  ];

  const materials = new Map<string, Material>(model.materials.map((m) => [m.id as string, m]));
  const sections = new Map<string, Section>(model.sections.map((s) => [s.id as string, s]));
  const material = materials.get(element.materialId as string);
  const section = sections.get(element.sectionId as string);
  if (material === undefined || section === undefined) {
    throw new Error(`A(z) "${elementId}" elem anyaga vagy keresztmetszete nem oldható fel.`);
  }
  const lookup = (id: MaterialId): Material | undefined => materials.get(id as string);
  const stiffness = sectionStiffness(section, material, lookup);

  const rules = quadratureFor(element.integration);
  const bendingPoints = rules.bending.map((gp) => gaussStep(nodeX, gp.xi, gp.w, elementId));
  const shearPoints = rules.shear.map((gp) => gaussStep(nodeX, gp.xi, gp.w, elementId));

  const ke = elementStiffness({ nodeX, elementId }, stiffness, element.integration);
  const loadVector = elementLoadVector(model, elementId, 1);

  return {
    elementId,
    nodeX,
    length: Math.abs(nodeX[2] - nodeX[0]),
    scheme: element.integration,
    stiffness,
    bendingPoints,
    shearPoints,
    ke,
    loadVector,
  };
}

/** Egy megoszló teher (erő/nyomaték/önsúly) járuléka az elemi tehervektorhoz — a 4.7 pont bontásához. */
export interface DistributedLoadContribution {
  readonly kind: 'distributed-force' | 'distributed-moment' | 'self-weight';
  /** A teher `id`-ja a modellben (megjelenítésre). */
  readonly loadId: string;
  /** 0 → w-sorokba (erő), 1 → φ-sorokba (nyomaték) megy a járulék. */
  readonly dofOffset: 0 | 1;
  readonly points: readonly DistributedLoadGaussDetail[];
}

/** Egy közvetlen csomóponti teher — nincs integrálás, csak elhelyezés (a 4.7 pont bontásához). */
export interface NodalLoadContribution {
  readonly kind: 'nodal-force' | 'nodal-moment';
  readonly loadId: string;
  /** Melyik a 3 elem-csomópont közül (0=bal, 1=közép, 2=jobb). */
  readonly localNode: 0 | 1 | 2;
  readonly dofOffset: 0 | 1;
  readonly value: number;
}

/** A hőteher (κ₀) járuléka — a 4.7 pont bontásához. */
export interface ThermalLoadContribution {
  readonly kappa0: number;
  readonly points: readonly ThermalLoadGaussDetail[];
}

export interface ElementLoadDerivation {
  readonly elementId: string;
  readonly distributed: readonly DistributedLoadContribution[];
  readonly nodal: readonly NodalLoadContribution[];
  readonly thermal: ThermalLoadContribution | null;
  /** A végső, összegzett 6×1 vektor — BIT-AZONOS `elementLoadVector(model, elementId, 1)`-vel. */
  readonly total: Float64Array;
}

/**
 * Egy elem tehervektorának TELJES, terhenkénti bontása (a 4.7 pont
 * levezetéséhez) — ugyanazokat a (most már exportált, Gauss-pontonként
 * részletező) `reduceDistributedDetail`/`reduceThermalDetail` függvényeket
 * hívja, mint amiket `elementLoadVector` (összegezve) használ, ezért a
 * `total` mező BIT-AZONOS a ténylegesen megoldott tehervektorral.
 *
 * @returns `undefined`, ha az elem nem található a modellben.
 */
export function deriveElementLoadVector(model: Model, elementId: string): ElementLoadDerivation | undefined {
  const ctx = singleElementContext(model, elementId);
  if (ctx === undefined) return undefined;
  const { element, nodeX } = ctx;

  const materials = new Map<string, Material>(model.materials.map((m) => [m.id as string, m]));
  const sections = new Map<string, Section>(model.sections.map((s) => [s.id as string, s]));
  const material = materials.get(element.materialId as string);
  const section = sections.get(element.sectionId as string);
  const lookup = (id: MaterialId): Material | undefined => materials.get(id as string);
  const stiffness = material !== undefined && section !== undefined ? sectionStiffness(section, material, lookup) : undefined;

  const distributed: DistributedLoadContribution[] = [];
  const nodal: NodalLoadContribution[] = [];

  for (const load of model.loads) {
    if (load.kind === 'nodal-force' || load.kind === 'nodal-moment') {
      const localNode = element.nodes.findIndex((n) => (n as string) === (load.nodeId as string));
      if (localNode < 0) continue;
      nodal.push({
        kind: load.kind,
        loadId: load.id as string,
        localNode: localNode as 0 | 1 | 2,
        dofOffset: load.kind === 'nodal-force' ? 0 : 1,
        value: load.kind === 'nodal-force' ? (load.fz as number) : (load.my as number),
      });
    } else if (load.kind === 'distributed-force') {
      const points = reduceDistributedDetail(
        ctx,
        load.x1 as number,
        load.x2 as number,
        load.q1 as number,
        load.q2 as number,
        load.shape,
        load.qMid as number | undefined,
        0,
      );
      if (points.length > 0) distributed.push({ kind: 'distributed-force', loadId: load.id as string, dofOffset: 0, points });
    } else if (load.kind === 'distributed-moment') {
      const points = reduceDistributedDetail(ctx, load.x1 as number, load.x2 as number, load.m1 as number, load.m2 as number, 'linear', undefined, 1);
      if (points.length > 0) distributed.push({ kind: 'distributed-moment', loadId: load.id as string, dofOffset: 1, points });
    } else if (load.kind === 'self-weight' && stiffness !== undefined && material !== undefined) {
      const pz = (material.gamma as number) * stiffness.area * (load.factor as number);
      const elemLo = Math.min(nodeX[0], nodeX[2]);
      const elemHi = Math.max(nodeX[0], nodeX[2]);
      const points = reduceDistributedDetail(ctx, elemLo, elemHi, pz, pz, 'linear', undefined, 0);
      if (points.length > 0) distributed.push({ kind: 'self-weight', loadId: load.id as string, dofOffset: 0, points });
    }
  }

  let thermal: ThermalLoadContribution | null = null;
  if (stiffness !== undefined && material !== undefined) {
    const kappa0 = elementKappa0(model, element, material.alpha as number, stiffness.height);
    if (kappa0 !== 0) {
      thermal = { kappa0, points: reduceThermalDetail(ctx, stiffness.ei, kappa0) };
    }
  }

  return { elementId, distributed, nodal, thermal, total: elementLoadVector(model, elementId, 1) };
}

/** Egy elem 3 csomópontjának SORSZÁMA (index a `model.nodes`-ban) — a globális DOF `2·i`/`2·i+1` (ld. `assembly/dofMap.ts`). */
export function elementGlobalNodeIndices(model: Model, elementId: string): readonly [number, number, number] | undefined {
  const element = model.elements.find((e) => (e.id as string) === elementId);
  if (element === undefined) return undefined;
  const nodeIndexById = new Map(model.nodes.map((n, i) => [n.id as string, i]));
  const idx = element.nodes.map((id) => nodeIndexById.get(id as string));
  if (idx.some((i) => i === undefined)) return undefined;
  return idx as [number, number, number];
}

/** Egy Gauss-pontban a κ/γ → M/T visszaszámítás TELJES köztes állapota (5→6. pont híd). */
export interface InternalForceGaussDetail {
  readonly xi: number;
  readonly w: number;
  readonly x: number;
  readonly bKappa: Float64Array;
  readonly bGamma: Float64Array;
  readonly kappa: number;
  readonly gamma: number;
  readonly m: number;
  readonly t: number;
}

export interface ElementInternalForceDerivation {
  readonly elementId: string;
  /** A megoldott elmozdulásvektor erre az elemre, [w₁,φ₁,w₂,φ₂,w₃,φ₃] sorrendben. */
  readonly ue: readonly [number, number, number, number, number, number];
  readonly kappa0: number;
  /** A STRESS_POINTS (= GAUSS_3) pontjaiban — UGYANOTT, ahol a szelvény M/T-t ad ki. */
  readonly points: readonly InternalForceGaussDetail[];
}

/**
 * A megoldott elmozdulásvektorból (`LinearResult.displacements`) az elem
 * Gauss-ponti igénybevételei — κ = B_κ·uₑ, γ = B_γ·uₑ, M = EI·(κ−κ₀), T =
 * GAs·γ (5→6. pont híd: hogyan lesz a megoldásból igénybevétel).
 *
 * SZÓ SZERINT `internalForces(...)`-t hívja (a `linearSolver.ts` UGYANEZT
 * hívja `STRESS_POINTS`-ban) — ezért az `m`/`t` BIT-AZONOS a
 * `LinearResult.elements[...].gaussPoints`-ban ténylegesen tárolt értékkel.
 *
 * @param displacements a TELJES (megkötöttekkel együtt), globális `[w,φ]`
 *   elmozdulásvektor — `LinearResult.displacements`.
 */
export function deriveElementInternalForces(
  model: Model,
  elementId: string,
  displacements: Float64Array,
): ElementInternalForceDerivation | undefined {
  const ctx = singleElementContext(model, elementId);
  const globalIdx = elementGlobalNodeIndices(model, elementId);
  if (ctx === undefined || globalIdx === undefined) return undefined;
  const { element, nodeX } = ctx;

  const ue: [number, number, number, number, number, number] = [
    displacements[2 * globalIdx[0]] ?? 0,
    displacements[2 * globalIdx[0] + 1] ?? 0,
    displacements[2 * globalIdx[1]] ?? 0,
    displacements[2 * globalIdx[1] + 1] ?? 0,
    displacements[2 * globalIdx[2]] ?? 0,
    displacements[2 * globalIdx[2] + 1] ?? 0,
  ];

  const materials = new Map<string, Material>(model.materials.map((m) => [m.id as string, m]));
  const sections = new Map<string, Section>(model.sections.map((s) => [s.id as string, s]));
  const material = materials.get(element.materialId as string);
  const section = sections.get(element.sectionId as string);
  if (material === undefined || section === undefined) return undefined;
  const lookup = (id: MaterialId): Material | undefined => materials.get(id as string);
  const stiffness = sectionStiffness(section, material, lookup);
  const kappa0 = elementKappa0(model, element, material.alpha as number, stiffness.height);

  const ueFloat = Float64Array.from(ue);
  const points: InternalForceGaussDetail[] = STRESS_POINTS.map((gp) => {
    const rows = bRows(nodeX, gp.xi, elementId);
    const { x } = jacobian(nodeX, gp.xi, elementId);
    const forces = internalForces({ nodeX, elementId }, stiffness, ueFloat, gp.xi, kappa0);
    return { xi: gp.xi, w: gp.w, x, bKappa: rows.kappa, bGamma: rows.gamma, kappa: forces.kappa, gamma: forces.gamma, m: forces.m, t: forces.t };
  });

  return { elementId, ue, kappa0, points };
}
