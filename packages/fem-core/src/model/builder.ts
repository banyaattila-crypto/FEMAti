/**
 * Kényelmi konstruktorok modellépítéshez.
 *
 * Minden bemenet SI-alapú belső egységben értendő (m, kN, kN/m², kN/m³) —
 * a felhasználói egységek konverziója a `schema.ts` feladata.
 */

import {
  degC,
  dimensionless,
  kgpm3,
  kN,
  kNm,
  kNmpm,
  kNpm,
  kNpm2,
  kNpm3,
  m,
  perDegC,
  rad,
  specificWeightFromDensity,
  type Dimensionless,
} from '../units/index.js';
import {
  elementId,
  loadId,
  materialId,
  nodeId,
  sectionId,
  type Boundary,
  type Element,
  type ElasticFoundation,
  type IntegrationScheme,
  type Layer,
  type LayeredSection,
  type Load,
  type LoadHistory,
  type Material,
  type Model,
  type Node,
  type ParametricSection,
  type Section,
  type SectionShape,
} from './types.js';

/** Nyírási alaktényező κs = 5/6 — a diplomaterv A/1.2 alakjának megfelelője. */
export const RECT_SHEAR_FACTOR = 5 / 6;

export interface MaterialProps {
  /** Rugalmassági modulus [kN/m²] */
  readonly e: number;
  /** Poisson-tényező [–] */
  readonly nu?: number;
  /** Nyírási modulus [kN/m²]; ha hiányzik: E / (2(1+ν)) */
  readonly g?: number;
  /** Hőtágulási együttható [1/°C] */
  readonly alpha?: number;
  /** Fajsúly [kN/m³]; ha hiányzik, a `density`-ből számítjuk */
  readonly gamma?: number;
  /** Sűrűség [kg/m³] */
  readonly density?: number;
  /** Folyáshatár [kN/m²] */
  readonly sigmaY?: number;
  /** Lineáris keményedési paraméter H' [kN/m²] */
  readonly hPrime?: number;
  /** Vastagságfüggő folyáshatár, vékonyabb osztály [kN/m²] — E) fázis */
  readonly fy1?: number;
  /** Vastagságfüggő folyáshatár, vastagabb osztály [kN/m²] — E) fázis */
  readonly fy2?: number;
  /** A vastagságosztályok határa [m] — E) fázis */
  readonly thicknessThreshold?: number;
  /** EC2 jellemző nyomószilárdság fck [kN/m²] — F) fázis */
  readonly fck?: number;
  /** EC2 folyási határnyúlás εc2 [–] — F) fázis */
  readonly epsC2?: number;
  /** EC2 szakadási (zúzódási) határnyúlás εcu2 [–] — F) fázis */
  readonly epsCu2?: number;
  /** EC2 parabola-téglalap kitevő n [–] — F) fázis */
  readonly n?: number;
}

export function makeMaterial(id: string, name: string, p: MaterialProps): Material {
  const nu = p.nu ?? 0.3;
  const g = p.g ?? p.e / (2 * (1 + nu));
  const gamma = p.gamma ?? (p.density !== undefined ? (specificWeightFromDensity(p.density) as number) : 0);
  let material: Material = {
    id: materialId(id),
    name,
    e: kNpm2(p.e),
    nu: dimensionless(nu),
    g: kNpm2(g),
    alpha: perDegC(p.alpha ?? 0),
    gamma: kNpm3(gamma),
  };
  if (p.sigmaY !== undefined) material = { ...material, sigmaY: kNpm2(p.sigmaY) };
  if (p.hPrime !== undefined) material = { ...material, hPrime: kNpm2(p.hPrime) };
  if (p.fy1 !== undefined) material = { ...material, fy1: kNpm2(p.fy1) };
  if (p.fy2 !== undefined) material = { ...material, fy2: kNpm2(p.fy2) };
  if (p.thicknessThreshold !== undefined) material = { ...material, thicknessThreshold: m(p.thicknessThreshold) };
  if (p.fck !== undefined) material = { ...material, fck: kNpm2(p.fck) };
  if (p.epsC2 !== undefined) material = { ...material, epsC2: dimensionless(p.epsC2) };
  if (p.epsCu2 !== undefined) material = { ...material, epsCu2: dimensionless(p.epsCu2) };
  if (p.n !== undefined) material = { ...material, n: dimensionless(p.n) };
  return material;
}

/** Sűrűségből fajsúly [kN/m³] — kényelmi újraexport a builder-felhasználóknak. */
export const densityToGamma = (rho: number): number => specificWeightFromDensity(kgpm3(rho) as number) as number;

export function makeSection(
  id: string,
  name: string,
  shape: SectionShape,
  shearFactor = RECT_SHEAR_FACTOR,
): ParametricSection {
  return {
    id: sectionId(id),
    name,
    kind: 'parametric',
    shape,
    shearFactor: dimensionless(shearFactor),
  };
}

export const rect = (b: number, h: number): SectionShape => ({ kind: 'rect', b: m(b), h: m(h) });
export const circle = (d: number): SectionShape => ({ kind: 'circle', d: m(d) });
export const tube = (d: number, t: number): SectionShape => ({ kind: 'tube', d: m(d), t: m(t) });
export const iProfile = (h: number, b: number, tw: number, tf: number): SectionShape => ({
  kind: 'i-profile',
  h: m(h),
  b: m(b),
  tw: m(tw),
  tf: m(tf),
});
/** Zárt téglalap/négyzet szelvény (RHS/SHS), egyenletes falvastagsággal. */
export const rhs = (h: number, b: number, t: number): SectionShape => ({ kind: 'rhs', h: m(h), b: m(b), t: m(t) });
/** T-szelvény — öv felül, gerinc alatta (aszimmetrikus a félmagasságra). */
export const tProfile = (h: number, b: number, tw: number, tf: number): SectionShape => ({
  kind: 't-profile',
  h: m(h),
  b: m(b),
  tw: m(tw),
  tf: m(tf),
});

export function makeLayeredSection(
  id: string,
  name: string,
  layers: readonly { b: number; t: number; z: number; materialId?: string; plateThickness?: number; reinforcement?: boolean }[],
  shearFactor = RECT_SHEAR_FACTOR,
  includeLayerOwnInertia = false,
): LayeredSection {
  const ls: Layer[] = layers.map((l) => ({
    b: m(l.b),
    t: m(l.t),
    z: m(l.z),
    ...(l.materialId !== undefined ? { materialId: materialId(l.materialId) } : {}),
    ...(l.plateThickness !== undefined ? { plateThickness: m(l.plateThickness) } : {}),
    ...(l.reinforcement !== undefined ? { reinforcement: l.reinforcement } : {}),
  }));
  return {
    id: sectionId(id),
    name,
    kind: 'layered',
    layers: ls,
    shearFactor: dimensionless(shearFactor),
    includeLayerOwnInertia,
  };
}

/**
 * Egyenközű háló generálása egy egyenes gerendához.
 * `elementCount` darab háromcsomópontú elem, összesen 2·n+1 csomóponttal;
 * a középső csomópontok pontosan az elemek felezőpontjában (Diplomaterv 3.1.4).
 */
export function uniformMesh(
  length: number,
  elementCount: number,
  opts: {
    readonly sectionId: string;
    readonly materialId: string;
    readonly integration?: IntegrationScheme;
    readonly x0?: number;
  },
): { nodes: Node[]; elements: Element[] } {
  if (!Number.isInteger(elementCount) || elementCount < 1) {
    throw new RangeError(`Az elemszám pozitív egész kell legyen, kapott: ${elementCount}`);
  }
  if (!(length > 0)) {
    throw new RangeError(`A gerenda hossza pozitív kell legyen, kapott: ${length}`);
  }

  const x0 = opts.x0 ?? 0;
  const nodeCount = 2 * elementCount + 1;
  const dx = length / (nodeCount - 1);

  const nodes: Node[] = [];
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({ id: nodeId(`N${i}`), x: m(x0 + i * dx) });
  }

  const elements: Element[] = [];
  for (let e = 0; e < elementCount; e++) {
    const i = 2 * e;
    elements.push({
      id: elementId(`E${e}`),
      nodes: [nodeId(`N${i}`), nodeId(`N${i + 1}`), nodeId(`N${i + 2}`)],
      sectionId: sectionId(opts.sectionId),
      materialId: materialId(opts.materialId),
      integration: opts.integration ?? 'selective',
    });
  }
  return { nodes, elements };
}

// ─── Teher- és megtámasztás-konstruktorok ─────────────────────────────────────

let loadCounter = 0;
const nextLoadId = (prefix: string): string => `${prefix}${loadCounter++}`;

/** Teszt-determinizmushoz: a teherazonosító-számláló nullázása. */
export const resetLoadIds = (): void => {
  loadCounter = 0;
};

export const nodalForce = (node: string, fz: number, id?: string): Load => ({
  id: loadId(id ?? nextLoadId('F')),
  kind: 'nodal-force',
  nodeId: nodeId(node),
  fz: kN(fz),
});

export const nodalMoment = (node: string, my: number, id?: string): Load => ({
  id: loadId(id ?? nextLoadId('M')),
  kind: 'nodal-moment',
  nodeId: nodeId(node),
  my: kNm(my),
});

export const distributedForce = (
  x1: number,
  x2: number,
  q1: number,
  q2 = q1,
  id?: string,
): Load => ({
  id: loadId(id ?? nextLoadId('Q')),
  kind: 'distributed-force',
  x1: m(x1),
  x2: m(x2),
  q1: kNpm(q1),
  q2: kNpm(q2),
  shape: 'linear',
});

export const parabolicForce = (
  x1: number,
  x2: number,
  q1: number,
  qMid: number,
  q2: number,
  id?: string,
): Load => ({
  id: loadId(id ?? nextLoadId('QP')),
  kind: 'distributed-force',
  x1: m(x1),
  x2: m(x2),
  q1: kNpm(q1),
  q2: kNpm(q2),
  shape: 'parabolic',
  qMid: kNpm(qMid),
});

export const distributedMoment = (
  x1: number,
  x2: number,
  m1: number,
  m2 = m1,
  id?: string,
): Load => ({
  id: loadId(id ?? nextLoadId('MQ')),
  kind: 'distributed-moment',
  x1: m(x1),
  x2: m(x2),
  m1: kNmpm(m1),
  m2: kNmpm(m2),
});

export const selfWeight = (factor = 1, id?: string): Load => ({
  id: loadId(id ?? nextLoadId('G')),
  kind: 'self-weight',
  factor: dimensionless(factor),
});

export const thermal = (tTop: number, tBottom: number, tRef = 0, id?: string): Load => ({
  id: loadId(id ?? nextLoadId('T')),
  kind: 'thermal',
  tRef: degC(tRef),
  tTop: degC(tTop),
  tBottom: degC(tBottom),
});

export const supportDisplacement = (node: string, dz?: number, dPhi?: number, id?: string): Load => {
  const base = {
    id: loadId(id ?? nextLoadId('D')),
    kind: 'support-displacement' as const,
    nodeId: nodeId(node),
  };
  if (dz !== undefined && dPhi !== undefined) return { ...base, dz: m(dz), dPhi: rad(dPhi) };
  if (dz !== undefined) return { ...base, dz: m(dz) };
  if (dPhi !== undefined) return { ...base, dPhi: rad(dPhi) };
  return base;
};

/** Csuklós támasz: w = 0, φ szabad. */
export const pinned = (node: string): Boundary => ({
  nodeId: nodeId(node),
  wFixed: true,
  phiFixed: false,
});

/** Görgős támasz — 1D gerendán azonos a csuklóssal (nincs tengelyirányú DOF). */
export const roller = pinned;

/** Befogás: w = 0, φ = 0. */
export const fixed = (node: string): Boundary => ({
  nodeId: nodeId(node),
  wFixed: true,
  phiFixed: true,
});

/** Rugalmas támasz [kN/m]. */
export const springSupport = (node: string, k: number): Boundary => ({
  nodeId: nodeId(node),
  wFixed: false,
  phiFixed: false,
  springW: kNpm(k),
});

export const foundation = (x1: number, x2: number, c: number): ElasticFoundation => ({
  x1: m(x1),
  x2: m(x2),
  c: kNpm2(c),
});

export const singleStep: LoadHistory = { lambdaTargets: [1], stepsPerTarget: 1 };

export const rampHistory = (steps: number, lambdaMax = 1): LoadHistory => ({
  lambdaTargets: [lambdaMax],
  stepsPerTarget: steps,
});

// ─── A teljes modell összeállítása ────────────────────────────────────────────

export interface ModelParts {
  readonly name?: string;
  readonly nodes: readonly Node[];
  readonly elements: readonly Element[];
  readonly materials: readonly Material[];
  readonly sections: readonly Section[];
  readonly loads?: readonly Load[];
  readonly boundaries?: readonly Boundary[];
  readonly foundations?: readonly ElasticFoundation[];
  readonly history?: LoadHistory;
}

export function buildModel(parts: ModelParts): Model {
  return {
    meta: { name: parts.name ?? 'Névtelen modell' },
    nodes: parts.nodes,
    elements: parts.elements,
    materials: parts.materials,
    sections: parts.sections,
    loads: parts.loads ?? [],
    boundaries: parts.boundaries ?? [],
    foundations: parts.foundations ?? [],
    history: parts.history ?? singleStep,
  };
}

/** Dimenziótlan érték márkázása a builder-felhasználóknak. */
export const dimless = (v: number): Dimensionless => dimensionless(v);
