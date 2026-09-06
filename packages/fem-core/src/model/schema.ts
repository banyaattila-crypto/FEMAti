/**
 * `.femati.json` fájlformátum — séma, beolvasás, kiírás.
 *
 * A FÁJL a diplomaterv 3. táblázatának mérnöki egységeit használja, mert azt
 * ember írja és olvassa:
 *   csomópont x        [m]
 *   keresztmetszeti méretek (b, h, d, t, z)  [cm]
 *   E, G, σY, H'       [kN/cm²]
 *   sűrűség            [kg/m³]
 *   erő / nyomaték     [kN] / [kNm]
 *   megoszló teher     [kN/m] / [kNm/m]
 *   támaszmozgás dz    [mm], dφ [rad]
 *   rugóállandó        [kN/m] / [kNm/rad]
 *   ágyazási tényező   [kN/m²]  (hosszegységre eső rugómerevség)
 *
 * A MAG ezzel szemben SI-alapon számol. Az átváltás kizárólag itt történik.
 */

import { z } from 'zod';
import {
  degC,
  densityFromSpecificWeight,
  dimensionless,
  kN,
  kNm,
  kNmpm,
  kNpm,
  kNpm2,
  lengthFromCm,
  lengthFromMm,
  lengthToCm,
  lengthToMm,
  m,
  modulusFromKNPerCm2,
  modulusToKNPerCm2,
  perDegC,
  rad,
  specificWeightFromDensity,
} from '../units/index.js';
import {
  elementId,
  loadId,
  materialId,
  nodeId,
  sectionId,
  type Boundary,
  type ElasticFoundation,
  type Element,
  type Layer,
  type Load,
  type LoadHistory,
  type Material,
  type Model,
  type ModelMeta,
  type Node,
  type Section,
  type SectionShape,
} from './types.js';

export const FEMAti_SCHEMA_VERSION = 1 as const;

// ─── Zod séma ─────────────────────────────────────────────────────────────────

const finite = z.number().finite();
const positive = z.number().finite().positive();
const idString = z.string().min(1).max(64);

const nodeSchema = z.object({
  id: idString,
  /** hossz [m] */
  x: finite,
});

const materialSchema = z.object({
  id: idString,
  name: z.string().min(1),
  /** rugalmassági modulus [kN/cm²] */
  E: positive,
  /** Poisson-tényező [–] */
  nu: finite.default(0.3),
  /** nyírási modulus [kN/cm²]; hiányában E/(2(1+ν)) */
  G: positive.optional(),
  /** hőtágulási együttható [1/°C] */
  alpha: finite.default(0),
  /** sűrűség [kg/m³] */
  density: z.number().finite().nonnegative().default(0),
  /** folyáshatár [kN/cm²] */
  sigmaY: positive.optional(),
  /** lineáris keményedési paraméter [kN/cm²] */
  hPrime: z.number().finite().nonnegative().optional(),
});

const shapeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('rect'), b: positive, h: positive }),
  z.object({ kind: z.literal('circle'), d: positive }),
  z.object({ kind: z.literal('tube'), d: positive, t: positive }),
  z.object({
    kind: z.literal('i-profile'),
    h: positive,
    b: positive,
    tw: positive,
    tf: positive,
  }),
  z.object({ kind: z.literal('rhs'), h: positive, b: positive, t: positive }),
  z.object({
    kind: z.literal('t-profile'),
    h: positive,
    b: positive,
    tw: positive,
    tf: positive,
  }),
]);

const layerSchema = z.object({
  /** rétegszélesség [cm] */
  b: positive,
  /** rétegvastagság [cm] */
  t: positive,
  /** a réteg középpontja a súlyponttól [cm], lefelé pozitív */
  z: finite,
  materialId: idString.optional(),
});

const sectionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('parametric'),
    id: idString,
    name: z.string().min(1),
    shape: shapeSchema,
    shearFactor: z
      .number()
      .finite()
      .positive()
      .max(1)
      .default(5 / 6),
  }),
  z.object({
    kind: z.literal('layered'),
    id: idString,
    name: z.string().min(1),
    layers: z.array(layerSchema).min(1),
    shearFactor: z
      .number()
      .finite()
      .positive()
      .max(1)
      .default(5 / 6),
    includeLayerOwnInertia: z.boolean().default(false),
  }),
]);

const elementSchema = z.object({
  id: idString,
  nodes: z.tuple([idString, idString, idString]),
  sectionId: idString,
  materialId: idString,
  integration: z.enum(['selective', 'full']).default('selective'),
});

const loadSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('nodal-force'), id: idString, nodeId: idString, fz: finite }),
  z.object({ kind: z.literal('nodal-moment'), id: idString, nodeId: idString, my: finite }),
  z.object({
    kind: z.literal('distributed-force'),
    id: idString,
    x1: finite,
    x2: finite,
    q1: finite,
    q2: finite,
    shape: z.enum(['linear', 'parabolic']).default('linear'),
    qMid: finite.optional(),
  }),
  z.object({
    kind: z.literal('distributed-moment'),
    id: idString,
    x1: finite,
    x2: finite,
    m1: finite,
    m2: finite,
  }),
  z.object({ kind: z.literal('self-weight'), id: idString, factor: finite.default(1) }),
  z.object({
    kind: z.literal('thermal'),
    id: idString,
    elementIds: z.array(idString).optional(),
    tRef: finite.default(0),
    tTop: finite,
    tBottom: finite,
  }),
  z.object({
    kind: z.literal('support-displacement'),
    id: idString,
    nodeId: idString,
    /** [mm] */
    dz: finite.optional(),
    /** [rad] */
    dPhi: finite.optional(),
  }),
]);

const boundarySchema = z.object({
  nodeId: idString,
  wFixed: z.boolean().default(false),
  phiFixed: z.boolean().default(false),
  /** [kN/m] */
  springW: z.number().finite().nonnegative().optional(),
  /** [kNm/rad] */
  springPhi: z.number().finite().nonnegative().optional(),
});

const foundationSchema = z.object({
  x1: finite,
  x2: finite,
  /** [kN/m²] */
  c: z.number().finite().nonnegative(),
});

const historySchema = z.object({
  lambdaTargets: z.array(finite).min(1).default([1]),
  stepsPerTarget: z.number().int().positive().default(1),
});

export const modelFileSchema = z.object({
  schemaVersion: z.literal(FEMAti_SCHEMA_VERSION),
  meta: z.object({
    name: z.string().min(1).default('Névtelen modell'),
    description: z.string().optional(),
    createdAt: z.string().optional(),
  }),
  nodes: z.array(nodeSchema).min(1),
  materials: z.array(materialSchema).min(1),
  sections: z.array(sectionSchema).min(1),
  elements: z.array(elementSchema).min(1),
  loads: z.array(loadSchema).default([]),
  boundaries: z.array(boundarySchema).default([]),
  foundations: z.array(foundationSchema).default([]),
  history: historySchema.default({ lambdaTargets: [1], stepsPerTarget: 1 }),
});

export type ModelFile = z.infer<typeof modelFileSchema>;
type MaterialFile = z.infer<typeof materialSchema>;
type SectionFile = z.infer<typeof sectionSchema>;
type LoadFile = z.infer<typeof loadSchema>;

// ─── Beolvasás: fájl → mag (mérnöki egység → SI) ──────────────────────────────

const toShape = (s: z.infer<typeof shapeSchema>): SectionShape => {
  switch (s.kind) {
    case 'rect':
      return { kind: 'rect', b: lengthFromCm(s.b), h: lengthFromCm(s.h) };
    case 'circle':
      return { kind: 'circle', d: lengthFromCm(s.d) };
    case 'tube':
      return { kind: 'tube', d: lengthFromCm(s.d), t: lengthFromCm(s.t) };
    case 'i-profile':
      return {
        kind: 'i-profile',
        h: lengthFromCm(s.h),
        b: lengthFromCm(s.b),
        tw: lengthFromCm(s.tw),
        tf: lengthFromCm(s.tf),
      };
    case 'rhs':
      return { kind: 'rhs', h: lengthFromCm(s.h), b: lengthFromCm(s.b), t: lengthFromCm(s.t) };
    case 't-profile':
      return {
        kind: 't-profile',
        h: lengthFromCm(s.h),
        b: lengthFromCm(s.b),
        tw: lengthFromCm(s.tw),
        tf: lengthFromCm(s.tf),
      };
  }
};

const toMaterial = (f: MaterialFile): Material => {
  const base = {
    id: materialId(f.id),
    name: f.name,
    e: modulusFromKNPerCm2(f.E),
    nu: dimensionless(f.nu),
    g: modulusFromKNPerCm2(f.G ?? f.E / (2 * (1 + f.nu))),
    alpha: perDegC(f.alpha),
    gamma: specificWeightFromDensity(f.density),
  };
  if (f.sigmaY !== undefined && f.hPrime !== undefined) {
    return { ...base, sigmaY: modulusFromKNPerCm2(f.sigmaY), hPrime: modulusFromKNPerCm2(f.hPrime) };
  }
  if (f.sigmaY !== undefined) return { ...base, sigmaY: modulusFromKNPerCm2(f.sigmaY) };
  if (f.hPrime !== undefined) return { ...base, hPrime: modulusFromKNPerCm2(f.hPrime) };
  return base;
};

const toSection = (f: SectionFile): Section => {
  if (f.kind === 'parametric') {
    return {
      id: sectionId(f.id),
      name: f.name,
      kind: 'parametric',
      shape: toShape(f.shape),
      shearFactor: dimensionless(f.shearFactor),
    };
  }
  const layers: Layer[] = f.layers.map((l) =>
    l.materialId !== undefined
      ? {
          b: lengthFromCm(l.b),
          t: lengthFromCm(l.t),
          z: lengthFromCm(l.z),
          materialId: materialId(l.materialId),
        }
      : { b: lengthFromCm(l.b), t: lengthFromCm(l.t), z: lengthFromCm(l.z) },
  );
  return {
    id: sectionId(f.id),
    name: f.name,
    kind: 'layered',
    layers,
    shearFactor: dimensionless(f.shearFactor),
    includeLayerOwnInertia: f.includeLayerOwnInertia,
  };
};

const toLoad = (f: LoadFile): Load => {
  switch (f.kind) {
    case 'nodal-force':
      return { id: loadId(f.id), kind: 'nodal-force', nodeId: nodeId(f.nodeId), fz: kN(f.fz) };
    case 'nodal-moment':
      return { id: loadId(f.id), kind: 'nodal-moment', nodeId: nodeId(f.nodeId), my: kNm(f.my) };
    case 'distributed-force': {
      const base = {
        id: loadId(f.id),
        kind: 'distributed-force' as const,
        x1: m(f.x1),
        x2: m(f.x2),
        q1: kNpm(f.q1),
        q2: kNpm(f.q2),
        shape: f.shape,
      };
      return f.qMid !== undefined ? { ...base, qMid: kNpm(f.qMid) } : base;
    }
    case 'distributed-moment':
      return {
        id: loadId(f.id),
        kind: 'distributed-moment',
        x1: m(f.x1),
        x2: m(f.x2),
        m1: kNmpm(f.m1),
        m2: kNmpm(f.m2),
      };
    case 'self-weight':
      return { id: loadId(f.id), kind: 'self-weight', factor: dimensionless(f.factor) };
    case 'thermal': {
      const base = {
        id: loadId(f.id),
        kind: 'thermal' as const,
        tRef: degC(f.tRef),
        tTop: degC(f.tTop),
        tBottom: degC(f.tBottom),
      };
      return f.elementIds !== undefined ? { ...base, elementIds: f.elementIds.map((e) => elementId(e)) } : base;
    }
    case 'support-displacement': {
      const base = {
        id: loadId(f.id),
        kind: 'support-displacement' as const,
        nodeId: nodeId(f.nodeId),
      };
      if (f.dz !== undefined && f.dPhi !== undefined) {
        return { ...base, dz: lengthFromMm(f.dz), dPhi: rad(f.dPhi) };
      }
      if (f.dz !== undefined) return { ...base, dz: lengthFromMm(f.dz) };
      if (f.dPhi !== undefined) return { ...base, dPhi: rad(f.dPhi) };
      return base;
    }
  }
};

const toBoundary = (f: z.infer<typeof boundarySchema>): Boundary => {
  const base = { nodeId: nodeId(f.nodeId), wFixed: f.wFixed, phiFixed: f.phiFixed };
  if (f.springW !== undefined && f.springPhi !== undefined) {
    return { ...base, springW: kNpm(f.springW), springPhi: kNm(f.springPhi) };
  }
  if (f.springW !== undefined) return { ...base, springW: kNpm(f.springW) };
  if (f.springPhi !== undefined) return { ...base, springPhi: kNm(f.springPhi) };
  return base;
};

/**
 * `.femati.json` tartalom beolvasása és átváltása a mag belső egységeire.
 * @throws ZodError érvénytelen szerkezet esetén.
 */
export function parseModelFile(input: unknown): Model {
  const f = modelFileSchema.parse(input);

  const nodes: Node[] = f.nodes.map((n) => ({ id: nodeId(n.id), x: m(n.x) }));
  const elements: Element[] = f.elements.map((e) => ({
    id: elementId(e.id),
    nodes: [nodeId(e.nodes[0]), nodeId(e.nodes[1]), nodeId(e.nodes[2])],
    sectionId: sectionId(e.sectionId),
    materialId: materialId(e.materialId),
    integration: e.integration,
  }));
  const foundations: ElasticFoundation[] = f.foundations.map((x) => ({
    x1: m(x.x1),
    x2: m(x.x2),
    c: kNpm2(x.c),
  }));
  const history: LoadHistory = {
    lambdaTargets: f.history.lambdaTargets,
    stepsPerTarget: f.history.stepsPerTarget,
  };

  const meta: ModelMeta = {
    name: f.meta.name,
    ...(f.meta.description !== undefined ? { description: f.meta.description } : {}),
    ...(f.meta.createdAt !== undefined ? { createdAt: f.meta.createdAt } : {}),
  };

  return {
    meta,
    nodes,
    elements,
    materials: f.materials.map(toMaterial),
    sections: f.sections.map(toSection),
    loads: f.loads.map(toLoad),
    boundaries: f.boundaries.map(toBoundary),
    foundations,
    history,
  };
}

/** JSON szöveg beolvasása. */
export const parseModelJson = (text: string): Model => parseModelFile(JSON.parse(text) as unknown);

// ─── Kiírás: mag → fájl (SI → mérnöki egység) ─────────────────────────────────

const shapeToFile = (s: SectionShape): z.infer<typeof shapeSchema> => {
  switch (s.kind) {
    case 'rect':
      return { kind: 'rect', b: lengthToCm(s.b), h: lengthToCm(s.h) };
    case 'circle':
      return { kind: 'circle', d: lengthToCm(s.d) };
    case 'tube':
      return { kind: 'tube', d: lengthToCm(s.d), t: lengthToCm(s.t) };
    case 'i-profile':
      return {
        kind: 'i-profile',
        h: lengthToCm(s.h),
        b: lengthToCm(s.b),
        tw: lengthToCm(s.tw),
        tf: lengthToCm(s.tf),
      };
    case 'rhs':
      return { kind: 'rhs', h: lengthToCm(s.h), b: lengthToCm(s.b), t: lengthToCm(s.t) };
    case 't-profile':
      return {
        kind: 't-profile',
        h: lengthToCm(s.h),
        b: lengthToCm(s.b),
        tw: lengthToCm(s.tw),
        tf: lengthToCm(s.tf),
      };
  }
};

/** A modell kiírása `.femati.json` szerkezetbe (mérnöki egységekben). */
export function serializeModel(model: Model): ModelFile {
  return {
    schemaVersion: FEMAti_SCHEMA_VERSION,
    meta: model.meta,
    nodes: model.nodes.map((n) => ({ id: n.id as string, x: n.x as number })),
    materials: model.materials.map((mat) => {
      const out: MaterialFile = {
        id: mat.id as string,
        name: mat.name,
        E: modulusToKNPerCm2(mat.e),
        nu: mat.nu as number,
        G: modulusToKNPerCm2(mat.g),
        alpha: mat.alpha as number,
        density: densityFromSpecificWeight(mat.gamma) as number,
      };
      if (mat.sigmaY !== undefined) out.sigmaY = modulusToKNPerCm2(mat.sigmaY);
      if (mat.hPrime !== undefined) out.hPrime = modulusToKNPerCm2(mat.hPrime);
      return out;
    }),
    sections: model.sections.map((s): SectionFile => {
      if (s.kind === 'parametric') {
        return {
          kind: 'parametric',
          id: s.id as string,
          name: s.name,
          shape: shapeToFile(s.shape),
          shearFactor: s.shearFactor as number,
        };
      }
      return {
        kind: 'layered',
        id: s.id as string,
        name: s.name,
        layers: s.layers.map((l) => {
          const base = { b: lengthToCm(l.b), t: lengthToCm(l.t), z: lengthToCm(l.z) };
          return l.materialId !== undefined ? { ...base, materialId: l.materialId as string } : base;
        }),
        shearFactor: s.shearFactor as number,
        includeLayerOwnInertia: s.includeLayerOwnInertia ?? false,
      };
    }),
    elements: model.elements.map((e) => ({
      id: e.id as string,
      nodes: [e.nodes[0] as string, e.nodes[1] as string, e.nodes[2] as string],
      sectionId: e.sectionId as string,
      materialId: e.materialId as string,
      integration: e.integration,
    })),
    loads: model.loads.map((l): LoadFile => {
      switch (l.kind) {
        case 'nodal-force':
          return { kind: 'nodal-force', id: l.id as string, nodeId: l.nodeId as string, fz: l.fz as number };
        case 'nodal-moment':
          return { kind: 'nodal-moment', id: l.id as string, nodeId: l.nodeId as string, my: l.my as number };
        case 'distributed-force': {
          const base = {
            kind: 'distributed-force' as const,
            id: l.id as string,
            x1: l.x1 as number,
            x2: l.x2 as number,
            q1: l.q1 as number,
            q2: l.q2 as number,
            shape: l.shape,
          };
          return l.qMid !== undefined ? { ...base, qMid: l.qMid as number } : base;
        }
        case 'distributed-moment':
          return {
            kind: 'distributed-moment',
            id: l.id as string,
            x1: l.x1 as number,
            x2: l.x2 as number,
            m1: l.m1 as number,
            m2: l.m2 as number,
          };
        case 'self-weight':
          return { kind: 'self-weight', id: l.id as string, factor: l.factor as number };
        case 'thermal': {
          const base = {
            kind: 'thermal' as const,
            id: l.id as string,
            tRef: l.tRef as number,
            tTop: l.tTop as number,
            tBottom: l.tBottom as number,
          };
          return l.elementIds !== undefined ? { ...base, elementIds: l.elementIds.map((e) => e as string) } : base;
        }
        case 'support-displacement': {
          const base = {
            kind: 'support-displacement' as const,
            id: l.id as string,
            nodeId: l.nodeId as string,
          };
          const withDz = l.dz !== undefined ? { ...base, dz: lengthToMm(l.dz) } : base;
          return l.dPhi !== undefined ? { ...withDz, dPhi: l.dPhi as number } : withDz;
        }
      }
    }),
    boundaries: model.boundaries.map((b) => {
      const base = { nodeId: b.nodeId as string, wFixed: b.wFixed, phiFixed: b.phiFixed };
      const withW = b.springW !== undefined ? { ...base, springW: b.springW as number } : base;
      return b.springPhi !== undefined ? { ...withW, springPhi: b.springPhi as number } : withW;
    }),
    foundations: model.foundations.map((f) => ({
      x1: f.x1 as number,
      x2: f.x2 as number,
      c: f.c as number,
    })),
    history: {
      lambdaTargets: [...model.history.lambdaTargets],
      stepsPerTarget: model.history.stepsPerTarget,
    },
  };
}

/** A modell JSON szöveggé alakítása. */
export const serializeModelJson = (model: Model, indent = 2): string => JSON.stringify(serializeModel(model), null, indent);
