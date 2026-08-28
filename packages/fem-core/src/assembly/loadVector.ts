/**
 * A szerkezet tehervektorának összeállítása.
 *
 * Diplomaterv 3.1.7.2: „Kiindulásképpen q-t zérus vektornak tekintjük. A
 * közvetlenül a csomópontokra ható terheket elhelyezzük a q megfelelő helyére.
 * Előállítjuk a terhelt elemek qₑ vektorát, és blokkjait hozzáadjuk a q
 * megfelelő blokkjához."
 *
 * Teherredukció (MASTER-PROMPT-TERV 1.4, Diplomaterv (3.19)–(3.23), 40–42. oldal):
 *
 *   qₑ = ∫ Nᵀ·p dx  +  ∫ Bᵀ·D·ε0 dx
 *
 * (Az ε0-tag előjele ELTÉR a MASTER-PROMPT-TERV 1.4 pontjának betűjétől —
 * ld. ADR-0006: a virtuális munka elve és a `σ = D·(ε−ε0)` konstitutív
 * konvenció (1.6 pont) csak a POZITÍV előjellel önkonzisztens.)
 *
 * - Megoszló erő: `∫ Nᵀ·q(x) dx` a `w` sorokba (lineáris vagy parabolikus q(x)).
 * - Megoszló nyomaték: ugyanez a `φ` sorokba (a nyomaték a φ interpolációval
 *   végez munkát, ahogy az erő a w-vel).
 * - Önsúly (3.23): `p_z = γsúly·A`, ezután mint egyenletesen megoszló erő.
 * - Hőteher: kezdeti görbület `κ0 = α·(t_alsó − t_felső)/h` → `ε0 = [κ0, 0]ᵀ`,
 *   a `+∫Bᵀ·D·ε0 dx` taggal (csak a κ-sor ad járulékot, mert ε0 nyírási tagja 0).
 *   Az egyenletes ΔT-nek (nincs gradiens) NINCS hatása — erre a `validateModel`
 *   FIGYELMEZTET (`THERMAL_NO_GRADIENT`), itt a κ0 egyszerűen 0 lesz.
 * - Támaszmozgás: nem tehervektor-tag, a peremfeltétel-kezelés viszi be
 *   (`assembler.ts`).
 *
 * Egy elemet lefedő megoszló teher RÉSZLEGESEN is eshet egy elemre — az elem
 * és a teher tartományának metszetére integrálunk, a teher saját (globális
 * x szerinti) lineáris/parabolikus q(x) függvényét kiértékelve a metszetben.
 * Az elem geometriai leképezése x(ξ) AFFIN (a középső csomópont pontosan a
 * felezőpontban van, ld. `model/builder.ts` `uniformMesh` és a Winkler-ágyazat
 * azonos feltevése `assembler.ts`-ben), ezért a metszet végpontjai zárt
 * alakban átszámíthatók lokális ξ-be.
 */

import { shapeFunctions } from '../element/shapeFunctions.js';
import { jacobian } from '../element/jacobian.js';
import { bRows } from '../element/bMatrix.js';
import { GAUSS_3 } from '../element/quadrature.js';
import { sectionStiffness } from '../element/constitutive.js';
import { DOF_PER_NODE } from '../element/bMatrix.js';
import type { DofMap } from './dofMap.js';
import type { Element, Load, Material, MaterialId, Model, Section } from '../model/types.js';

export interface LoadVectors {
  /** A teljes szabadságfok-tér tehervektora (a reakciószámításhoz kell). */
  readonly full: Float64Array;
  /** Az aktív szabadságfokokra szűkített tehervektor. */
  readonly active: Float64Array;
}

/** A megoldó által kezelt tehertípusok (P4: csomóponti; P5: a többi). */
const SUPPORTED: ReadonlySet<Load['kind']> = new Set([
  'nodal-force',
  'nodal-moment',
  'support-displacement',
  'distributed-force',
  'distributed-moment',
  'self-weight',
  'thermal',
]);

/**
 * Igaz, ha a modell olyan terhet tartalmaz, amelyet a megoldó (jelenleg) nem
 * tud figyelembe venni. A megoldó ezt NEM hallgathatja el (HIBATURESI-POLITIKA 7.6).
 */
export function unsupportedLoads(model: Model): readonly Load[] {
  return model.loads.filter((l) => !SUPPORTED.has(l.kind));
}

/** Egy elem geometriai/anyagi adatai a teherredukcióhoz. */
export interface ElementContext {
  readonly element: Element;
  readonly nodeX: readonly [number, number, number];
  readonly nodeIndices: readonly [number, number, number];
}

function buildElementContexts(model: Model, map: DofMap): ElementContext[] {
  const out: ElementContext[] = [];
  for (const element of model.elements) {
    const idx = element.nodes.map((id) => map.nodeIndex.get(id as string));
    if (idx.some((i) => i === undefined)) continue;
    const nodeIndices = idx as [number, number, number];
    const nodeX: [number, number, number] = [
      map.nodeX[nodeIndices[0]] ?? 0,
      map.nodeX[nodeIndices[1]] ?? 0,
      map.nodeX[nodeIndices[2]] ?? 0,
    ];
    out.push({ element, nodeX, nodeIndices });
  }
  return out;
}

/**
 * Lokális ξ egy globális x helyhez, AFFIN (középső csomópont pontosan a
 * felezőpontban) leképezés feltételezésével: x(ξ) = xMid + ξ·(x3−x1)/2.
 */
function toLocalXi(nodeX: readonly [number, number, number], x: number): number {
  const xMid = (nodeX[0] + nodeX[2]) / 2;
  const halfLength = (nodeX[2] - nodeX[0]) / 2;
  return halfLength !== 0 ? (x - xMid) / halfLength : 0;
}

/** A megoszló teher/nyomaték intenzitása egy globális x helyen (a teher SAJÁT tartományában). */
function distributedValueAt(
  x1: number,
  x2: number,
  v1: number,
  v2: number,
  shape: 'linear' | 'parabolic',
  vMid: number | undefined,
  x: number,
): number {
  if (shape === 'linear' || vMid === undefined) {
    const t = x2 !== x1 ? (x - x1) / (x2 - x1) : 0;
    return v1 + (v2 - v1) * t;
  }
  // Parabolikus: ugyanaz a másodfokú Lagrange-bázis, mint az elemé, a teher
  // SAJÁT (x1, xMid, x2) csomópontjaira illesztve.
  const eta = x2 !== x1 ? (2 * (x - x1)) / (x2 - x1) - 1 : 0;
  const { n } = shapeFunctions(eta);
  return n[0] * v1 + n[1] * vMid + n[2] * v2;
}

/**
 * Egy megoszló-teher Gauss-pont TELJES köztes állapota — kizárólag a
 * levezetés-nézet (P15/A, 4.7 pont) pedagógiai bontásához (ld.
 * `derivation/elementDerivation.ts`). A `reduceDistributed` ugyanezt a
 * függvényt hívja és csak összegzi — ezért a végső (4.7-ben megjelenő)
 * `loadVector` BIT-AZONOS marad a Gauss-pontonként kiírt sorok összegével.
 */
export interface DistributedLoadGaussDetail {
  /** Lokális ξ a TELJES elemre nézve (nem a teher-metszet saját [-1,1]-jére). */
  readonly xi: number;
  readonly w: number;
  /** A metszet-tartomány [-1,1]→[xiLo,xiHi] átskálázási tényezője (Jacobi 2). */
  readonly xiHalf: number;
  /** Globális x [m], ahol a teher intenzitását kiértékeltük. */
  readonly x: number;
  /** A teher intenzitása ebben a pontban [kN/m] vagy [kNm/m]. */
  readonly value: number;
  readonly n: readonly [number, number, number];
  readonly detJ: number;
  /** Ennek a Gauss-pontnak a járuléka a 6×1 elemi tehervektorhoz. */
  readonly contribution: readonly [number, number, number, number, number, number];
}

/**
 * Egy megoszló mennyiség (erő vagy nyomaték) redukálása egyetlen elem [w]
 * vagy [φ] soraiba, a teher és az elem tartományának metszetére integrálva —
 * Gauss-pontonkénti RÉSZLETEZÉSSEL (a 4.7 pont levezetéséhez).
 *
 * @param dofOffset 0 → w sorok (erő), 1 → φ sorok (nyomaték)
 */
export function reduceDistributedDetail(
  ctx: ElementContext,
  x1: number,
  x2: number,
  v1: number,
  v2: number,
  shape: 'linear' | 'parabolic',
  vMid: number | undefined,
  dofOffset: 0 | 1,
): readonly DistributedLoadGaussDetail[] {
  const elemLo = Math.min(ctx.nodeX[0], ctx.nodeX[2]);
  const elemHi = Math.max(ctx.nodeX[0], ctx.nodeX[2]);
  const loadLo = Math.min(x1, x2);
  const loadHi = Math.max(x1, x2);
  const lo = Math.max(elemLo, loadLo);
  const hi = Math.min(elemHi, loadHi);
  if (hi <= lo) return [];

  const xiLo = toLocalXi(ctx.nodeX, lo);
  const xiHi = toLocalXi(ctx.nodeX, hi);
  const xiMid = (xiLo + xiHi) / 2;
  const xiHalf = (xiHi - xiLo) / 2;

  return GAUSS_3.map((gp) => {
    const xi = xiMid + xiHalf * gp.xi;
    const { n } = shapeFunctions(xi);
    const { detJ, x } = jacobian(ctx.nodeX, xi, ctx.element.id as string);
    const value = distributedValueAt(x1, x2, v1, v2, shape, vMid, x);
    // A [-1,1]→[xiLo,xiHi] átskálázás Jacobi-tényezője: xiHalf.
    const factor = value * detJ * gp.w * xiHalf;
    const contribution: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 3; i++) contribution[2 * i + dofOffset] = factor * n[i];
    return { xi, w: gp.w, xiHalf, x, value, n, detJ, contribution };
  });
}

/**
 * Egy megoszló mennyiség (erő vagy nyomaték) redukálása egyetlen elem [w]
 * vagy [φ] soraiba — ld. `reduceDistributedDetail`, ez csak összegzi.
 *
 * @param dofOffset 0 → w sorok (erő), 1 → φ sorok (nyomaték)
 */
function reduceDistributed(
  ctx: ElementContext,
  x1: number,
  x2: number,
  v1: number,
  v2: number,
  shape: 'linear' | 'parabolic',
  vMid: number | undefined,
  dofOffset: 0 | 1,
): Float64Array {
  const fe = new Float64Array(6);
  for (const gp of reduceDistributedDetail(ctx, x1, x2, v1, v2, shape, vMid, dofOffset)) {
    for (let i = 0; i < 6; i++) fe[i] += gp.contribution[i] ?? 0;
  }
  return fe;
}

/**
 * Egy elem EREDŐ kezdeti görbülete (κ0) az összes rá vonatkozó hőteherből
 * összegezve — Σ α·(t_alsó − t_felső)/h. Megosztott a tehervektor-számítás
 * (itt) és az igénybevétel-visszaszámítás (`solver/linearSolver.ts`, ahol az
 * M = EI·(κ − κ0) korrekcióhoz kell ugyanez az érték) között.
 */
export function elementKappa0(model: Model, element: Element, alpha: number, height: number): number {
  if (height <= 0) return 0;
  let kappa0 = 0;
  for (const load of model.loads) {
    if (load.kind !== 'thermal') continue;
    if (load.elementIds !== undefined && !load.elementIds.some((id) => (id as string) === (element.id as string))) {
      continue;
    }
    kappa0 += (alpha * ((load.tBottom as number) - (load.tTop as number))) / height;
  }
  return kappa0;
}

/**
 * Kezdeti görbületből (hőteher) származó elemi tehervektor: +∫Bᵀ·D·ε0 dx.
 *
 * ELŐJEL — eltérés a MASTER-PROMPT-TERV 1.4 pontjának betűjétől, ld. ADR-0006:
 * a virtuális munka elve (∫δεᵀσ dx = ∫δεᵀD(ε−ε0)dx = δvᵀKv − δvᵀ∫BᵀDε0 dx,
 * majd Kv = f_ext + ∫BᵀDε0 dx) A `σ = D·(ε−ε0)` (1.6 pont, P6) konvencióval
 * PÁRBAN csak a POZITÍV előjel önkonzisztens — ezt egy statikailag határozott
 * tartó zárt alakú (M≡0) ellenőrzése numerikusan is megerősíti.
 */
/** Egy hőteher-Gauss-pont TELJES köztes állapota — a 4.7 pont levezetéséhez. */
export interface ThermalLoadGaussDetail {
  readonly xi: number;
  readonly w: number;
  readonly detJ: number;
  readonly bKappa: Float64Array;
  readonly contribution: readonly [number, number, number, number, number, number];
}

/** `reduceThermal` Gauss-pontonkénti részletezéssel — ld. `reduceDistributedDetail`. */
export function reduceThermalDetail(ctx: ElementContext, ei: number, kappa0: number): readonly ThermalLoadGaussDetail[] {
  if (kappa0 === 0) return [];
  return GAUSS_3.map((gp) => {
    const { kappa, detJ } = bRows(ctx.nodeX, gp.xi, ctx.element.id as string);
    const factor = ei * kappa0 * detJ * gp.w;
    const contribution = Array.from(kappa, (k) => factor * k) as [number, number, number, number, number, number];
    return { xi: gp.xi, w: gp.w, detJ, bKappa: kappa, contribution };
  });
}

function reduceThermal(ctx: ElementContext, ei: number, kappa0: number): Float64Array {
  const fe = new Float64Array(6);
  for (const gp of reduceThermalDetail(ctx, ei, kappa0)) {
    for (let i = 0; i < 6; i++) fe[i] += gp.contribution[i] ?? 0;
  }
  return fe;
}

function addElementVector(full: Float64Array, ctx: ElementContext, fe: Float64Array, scale: number): void {
  for (let i = 0; i < 3; i++) {
    full[DOF_PER_NODE * ctx.nodeIndices[i]] += scale * (fe[2 * i] ?? 0);
    full[DOF_PER_NODE * ctx.nodeIndices[i] + 1] += scale * (fe[2 * i + 1] ?? 0);
  }
}

/**
 * EGY elem lokális (6×1) tehervektora, a rá vonatkozó megoszló erő/nyomaték,
 * önsúly és hőteher összegzéséből (ADR-0005: a levezetés-modul számára
 * kötelező publikus, finom szemcsézetű `elementLoadVector` lépés).
 *
 * UGYANAZOKAT a (modulon belüli, nem exportált) `reduceDistributed`/
 * `reduceThermal` függvényeket hívja, mint a `buildLoadVector` — ezért a
 * visszaadott vektor bit-azonos azzal, amit a megoldó ténylegesen összead
 * a globális tehervektorba (ld. `derivation.test.ts` a bit-azonosság
 * ellenőrzésére).
 *
 * @param scale teherszorzó (λ); alapértelmezés 1 (a levezetés maga skáláz)
 */
/**
 * Egyetlen elem `ElementContext`-je, DofMap NÉLKÜL (a `nodeIndices` itt nem
 * értelmezett/[0,0,0], mert csak lokális — 6×1 — mennyiséghez kell) — a
 * `elementLoadVector` és a levezetés-modul (`deriveElementLoadVector`) közös
 * segédfüggvénye, hogy a kettő SOSEM térhessen el a csomópont-feloldásban.
 */
export function singleElementContext(model: Model, elementId: string): ElementContext | undefined {
  const element = model.elements.find((e) => (e.id as string) === elementId);
  if (element === undefined) return undefined;
  const nodeById = new Map(model.nodes.map((n) => [n.id as string, n.x as number]));
  const nodeX: [number, number, number] = [
    nodeById.get(element.nodes[0] as string) ?? 0,
    nodeById.get(element.nodes[1] as string) ?? 0,
    nodeById.get(element.nodes[2] as string) ?? 0,
  ];
  return { element, nodeX, nodeIndices: [0, 0, 0] };
}

export function elementLoadVector(model: Model, elementId: string, scale = 1): Float64Array {
  const ctx = singleElementContext(model, elementId);
  if (ctx === undefined) return new Float64Array(6);
  const { element, nodeX } = ctx;

  const materials = new Map<string, Material>(model.materials.map((m) => [m.id as string, m]));
  const sections = new Map<string, Section>(model.sections.map((s) => [s.id as string, s]));
  const material = materials.get(element.materialId as string);
  const section = sections.get(element.sectionId as string);
  const stiffness =
    material !== undefined && section !== undefined
      ? sectionStiffness(section, material, (id: MaterialId) => materials.get(id as string))
      : undefined;

  const fe = new Float64Array(6);
  const add = (v: Float64Array): void => {
    for (let i = 0; i < 6; i++) fe[i] += scale * (v[i] ?? 0);
  };

  for (const load of model.loads) {
    if (load.kind === 'distributed-force') {
      add(
        reduceDistributed(
          ctx,
          load.x1 as number,
          load.x2 as number,
          load.q1 as number,
          load.q2 as number,
          load.shape,
          load.qMid as number | undefined,
          0,
        ),
      );
    } else if (load.kind === 'distributed-moment') {
      add(reduceDistributed(ctx, load.x1 as number, load.x2 as number, load.m1 as number, load.m2 as number, 'linear', undefined, 1));
    } else if (load.kind === 'self-weight' && stiffness !== undefined && material !== undefined) {
      const pz = (material.gamma as number) * stiffness.area * (load.factor as number);
      const elemLo = Math.min(nodeX[0], nodeX[2]);
      const elemHi = Math.max(nodeX[0], nodeX[2]);
      add(reduceDistributed(ctx, elemLo, elemHi, pz, pz, 'linear', undefined, 0));
    }
  }

  if (stiffness !== undefined && material !== undefined) {
    const kappa0 = elementKappa0(model, element, material.alpha as number, stiffness.height);
    if (kappa0 !== 0) add(reduceThermal(ctx, stiffness.ei, kappa0));
  }

  return fe;
}

/**
 * Tehervektor összeállítása.
 *
 * @param scale teherszorzó (λ) — egyparaméteres teher (Diplomaterv 3.2.1)
 */
export function buildLoadVector(model: Model, map: DofMap, scale = 1): LoadVectors {
  const full = new Float64Array(map.totalDofs);

  const needsElements = model.loads.some((l) =>
    l.kind === 'distributed-force' || l.kind === 'distributed-moment' || l.kind === 'self-weight' || l.kind === 'thermal',
  );
  const contexts = needsElements ? buildElementContexts(model, map) : [];
  const materials = new Map<string, Material>(model.materials.map((m) => [m.id as string, m]));
  const sections = new Map<string, Section>(model.sections.map((s) => [s.id as string, s]));

  const stiffnessCache = new Map<string, ReturnType<typeof sectionStiffness>>();
  const stiffnessFor = (element: Element): ReturnType<typeof sectionStiffness> | undefined => {
    const key = `${element.materialId as string}::${element.sectionId as string}`;
    const cached = stiffnessCache.get(key);
    if (cached !== undefined) return cached;
    const material = materials.get(element.materialId as string);
    const section = sections.get(element.sectionId as string);
    if (!material || !section) return undefined;
    const lookup = (id: MaterialId): Material | undefined => materials.get(id as string);
    const computed = sectionStiffness(section, material, lookup);
    stiffnessCache.set(key, computed);
    return computed;
  };

  for (const load of model.loads) {
    switch (load.kind) {
      case 'nodal-force': {
        const i = map.nodeIndex.get(load.nodeId as string);
        if (i === undefined) break;
        full[DOF_PER_NODE * i] += scale * (load.fz as number);
        break;
      }
      case 'nodal-moment': {
        const i = map.nodeIndex.get(load.nodeId as string);
        if (i === undefined) break;
        full[DOF_PER_NODE * i + 1] += scale * (load.my as number);
        break;
      }
      case 'distributed-force': {
        for (const ctx of contexts) {
          const fe = reduceDistributed(
            ctx,
            load.x1 as number,
            load.x2 as number,
            load.q1 as number,
            load.q2 as number,
            load.shape,
            load.qMid as number | undefined,
            0,
          );
          addElementVector(full, ctx, fe, scale);
        }
        break;
      }
      case 'distributed-moment': {
        for (const ctx of contexts) {
          const fe = reduceDistributed(
            ctx,
            load.x1 as number,
            load.x2 as number,
            load.m1 as number,
            load.m2 as number,
            'linear',
            undefined,
            1,
          );
          addElementVector(full, ctx, fe, scale);
        }
        break;
      }
      case 'self-weight': {
        const factor = load.factor as number;
        for (const ctx of contexts) {
          const stiffness = stiffnessFor(ctx.element);
          const material = materials.get(ctx.element.materialId as string);
          if (!stiffness || !material) continue;
          const pz = (material.gamma as number) * stiffness.area * factor;
          const elemLo = Math.min(ctx.nodeX[0], ctx.nodeX[2]);
          const elemHi = Math.max(ctx.nodeX[0], ctx.nodeX[2]);
          const fe = reduceDistributed(ctx, elemLo, elemHi, pz, pz, 'linear', undefined, 0);
          addElementVector(full, ctx, fe, scale);
        }
        break;
      }
      // A hőteher az összes rá vonatkozó terhet EGYÜTT (elemenként egyszer)
      // dolgozza fel a ciklus után — ld. lent. Itt szándékosan nincs teendő,
      // különben több egyidejű hőteher esetén többszörösen számolnánk.
      case 'thermal':
        break;
      // A támaszmozgás nem tehervektor-tag: a peremfeltétel-kezelés viszi be
      // (assembler.ts). Itt szándékosan nincs teendő.
      case 'support-displacement':
        break;
    }
  }

  if (model.loads.some((l) => l.kind === 'thermal')) {
    for (const ctx of contexts) {
      const stiffness = stiffnessFor(ctx.element);
      const material = materials.get(ctx.element.materialId as string);
      if (!stiffness || !material) continue;
      const kappa0 = elementKappa0(model, ctx.element, material.alpha as number, stiffness.height);
      if (kappa0 === 0) continue;
      const fe = reduceThermal(ctx, stiffness.ei, kappa0);
      addElementVector(full, ctx, fe, scale);
    }
  }

  const active = new Float64Array(map.activeDofs);
  for (let d = 0; d < map.totalDofs; d++) {
    const a = map.activeIndex[d] ?? -1;
    if (a >= 0) active[a] += full[d] ?? 0;
  }

  return { full, active };
}
