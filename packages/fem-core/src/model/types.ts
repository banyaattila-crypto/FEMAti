/**
 * FEMAti domain-modell.
 *
 * A modell a mag NATÍV reprezentációja: minden mennyiség SI-alapú belső
 * egységben, márkázott típussal (lásd `units/brands.ts`). A `.femati.json`
 * fájlformátum ezzel szemben a diplomaterv 3. táblázatának felhasználóbarát
 * egységeit használja; az átváltás a `model/schema.ts` parse/serialize
 * függvényeiben történik, sehol máshol.
 *
 * Vonatkozó fejezetek: Diplomaterv 2.1 (tartószerkezet modelljei),
 * 3.1.2 (anyagjellemzők), 3.1.3 (topológia), 3.1.6 (terhek).
 */

import type {
  Celsius,
  Dimensionless,
  KiloNewton,
  KiloNewtonMeter,
  KiloNewtonMeterPerMeter,
  KiloNewtonPerCubicMeter,
  KiloNewtonPerMeter,
  KiloNewtonPerSquareMeter,
  Meter,
  PerCelsius,
  Radian,
} from '../units/brands.js';

// ─── Azonosítók ───────────────────────────────────────────────────────────────

declare const idBrand: unique symbol;
type Id<B extends string> = string & { readonly [idBrand]: B };

export type NodeId = Id<'node'>;
export type ElementId = Id<'element'>;
export type MaterialId = Id<'material'>;
export type SectionId = Id<'section'>;
export type LoadId = Id<'load'>;

export const nodeId = (s: string): NodeId => s as NodeId;
export const elementId = (s: string): ElementId => s as ElementId;
export const materialId = (s: string): MaterialId => s as MaterialId;
export const sectionId = (s: string): SectionId => s as SectionId;
export const loadId = (s: string): LoadId => s as LoadId;

// ─── Csomópont ────────────────────────────────────────────────────────────────

/**
 * Csomópont az egyenes tengelyű gerendán. A modell 1D: csak az x koordináta
 * változik, a z lefelé pozitív (Diplomaterv 3-1. ábra).
 * Szabadságfokok csomópontonként: [w, φ].
 */
export interface Node {
  readonly id: NodeId;
  readonly x: Meter;
}

// ─── Anyag ────────────────────────────────────────────────────────────────────

/**
 * Anyagjellemzők (Diplomaterv 3.1.2, 3.1.6.3.1).
 * A `sigmaY` és `hPrime` csak a rugalmas–képlékeny futáshoz kell.
 */
export interface Material {
  readonly id: MaterialId;
  readonly name: string;
  /** Rugalmassági modulus [kN/m²] */
  readonly e: KiloNewtonPerSquareMeter;
  /** Poisson-tényező [–] */
  readonly nu: Dimensionless;
  /** Nyírási modulus [kN/m²]. Ha nincs megadva, G = E / (2(1+ν)). */
  readonly g: KiloNewtonPerSquareMeter;
  /** Lineáris hőtágulási együttható [1/°C] */
  readonly alpha: PerCelsius;
  /** Fajsúly [kN/m³] — az önsúly-generáláshoz (Diplomaterv 3.23) */
  readonly gamma: KiloNewtonPerCubicMeter;
  /** Egytengelyű folyáshatár σ0 [kN/m²] (Diplomaterv 3.2.1.1) */
  readonly sigmaY?: KiloNewtonPerSquareMeter;
  /**
   * Lineáris keményedési paraméter H' [kN/m²] (Diplomaterv 3.49–3.50).
   * H' = 0 → tökéletesen képlékeny anyag.
   */
  readonly hPrime?: KiloNewtonPerSquareMeter;

  // ── Vastagságfüggő acélosztály (EN 10025-2) — E) fázis, ld. docs/ADR ────
  /** Folyáshatár a vékonyabb vastagságosztályban (`Layer.plateThickness ≤ thicknessThreshold`) [kN/m²] */
  readonly fy1?: KiloNewtonPerSquareMeter;
  /** Folyáshatár a vastagabb vastagságosztályban (`Layer.plateThickness > thicknessThreshold`) [kN/m²] */
  readonly fy2?: KiloNewtonPerSquareMeter;
  /** A vastagságosztályok határa [m] */
  readonly thicknessThreshold?: Meter;

  // ── EC2 beton feszültség-alakváltozás modell (EN 1992-1-1 3.1.7) ────────
  // F) fázis, ld. `material/concreteEC2.ts` és docs/ADR.
  /** Jellemző nyomószilárdság fck [kN/m²] */
  readonly fck?: KiloNewtonPerSquareMeter;
  /** Folyási határnyúlás a parabola-téglalap modellhez εc2 [–] */
  readonly epsC2?: Dimensionless;
  /** Szakadási (zúzódási) határnyúlás a parabola-téglalap modellhez εcu2 [–] */
  readonly epsCu2?: Dimensionless;
  /** A parabola-téglalap modell kitevője n [–] */
  readonly n?: Dimensionless;
}

// ─── Keresztmetszet ───────────────────────────────────────────────────────────

/** Parametrikus keresztmetszeti alakok (Diplomaterv 4. táblázat). */
export type SectionShape =
  | { readonly kind: 'rect'; readonly b: Meter; readonly h: Meter }
  | { readonly kind: 'circle'; readonly d: Meter }
  | { readonly kind: 'tube'; readonly d: Meter; readonly t: Meter }
  | {
      readonly kind: 'i-profile';
      readonly h: Meter;
      readonly b: Meter;
      /** gerincvastagság */
      readonly tw: Meter;
      /** övvastagság */
      readonly tf: Meter;
    }
  | {
      /** Zárt szelvény (RHS/SHS), egyenletes falvastagsággal — B) fázis, ld. docs/ADR. */
      readonly kind: 'rhs';
      readonly h: Meter;
      readonly b: Meter;
      /** falvastagság (körben, minden oldalon egyenlő) */
      readonly t: Meter;
    }
  | {
      /**
       * T-szelvény — öv FELÜL, gerinc lelóg alóla. ASZIMMETRIKUS a
       * félmagasságra (a súlypont NEM h/2-nél van) — C) fázis, ld. docs/ADR.
       */
      readonly kind: 't-profile';
      readonly h: Meter;
      readonly b: Meter;
      /** gerincvastagság */
      readonly tw: Meter;
      /** övvastagság */
      readonly tf: Meter;
    };

/**
 * Egy réteg a rétegelt keresztmetszetben (Diplomaterv 3.4.3, 3.54).
 * `z` a réteg középpontjának koordinátája a keresztmetszet súlypontjától mérve,
 * lefelé pozitív.
 */
export interface Layer {
  /** rétegszélesség b_l [m] */
  readonly b: Meter;
  /** rétegvastagság t_l [m] — a réteg SAJÁT szeletvastagsága (magasság/rétegszám), NEM a lemezvastagság */
  readonly t: Meter;
  /** a réteg középpontjának z koordinátája [m] */
  readonly z: Meter;
  /** eltérő anyagú réteg (kompozit); ha hiányzik, az elem anyaga érvényes */
  readonly materialId?: MaterialId;
  /**
   * A réteg által képviselt VALÓDI hengerelt lemezvastagság [m] — övnél tf,
   * zárt szelvény (rhs) falánál t; nincs értelmezve rect/circle/tube-nál
   * (E) fázis, EN 10025-2 vastagságosztályhoz). FÜGGETLEN a fenti `t`-től
   * (ami a rétegszám finomításától függ) — ld. `material/layeredSection.ts`.
   */
  readonly plateThickness?: Meter;
}

export interface ParametricSection {
  readonly id: SectionId;
  readonly name: string;
  readonly kind: 'parametric';
  readonly shape: SectionShape;
  /** Nyírási alaktényező κs [–]. Téglalapra 5/6 (a diplomaterv A/1.2 alakja). */
  readonly shearFactor: Dimensionless;
}

export interface LayeredSection {
  readonly id: SectionId;
  readonly name: string;
  readonly kind: 'layered';
  readonly layers: readonly Layer[];
  readonly shearFactor: Dimensionless;
  /**
   * Ha igaz, a rétegek saját inerciája (t³/12) is beszámít az EI-be.
   * A diplomaterv (3.54) képlete ezt elhanyagolja → alapértelmezés: false.
   */
  readonly includeLayerOwnInertia?: boolean;
}

export type Section = ParametricSection | LayeredSection;

// ─── Végeselem ────────────────────────────────────────────────────────────────

/** Integrálási séma (Diplomaterv 3.1.4 — a „záródási jelenség" kezelése). */
export type IntegrationScheme = 'selective' | 'full';

/**
 * Háromcsomópontú izoparametrikus C⁰ Timoshenko gerendaelem
 * (Diplomaterv 3.1.4, 3.3 egyenlet). A csomópontok sorrendje: bal, közép, jobb.
 */
export interface Element {
  readonly id: ElementId;
  readonly nodes: readonly [NodeId, NodeId, NodeId];
  readonly sectionId: SectionId;
  readonly materialId: MaterialId;
  readonly integration: IntegrationScheme;
}

// ─── Terhek ───────────────────────────────────────────────────────────────────

/** Koncentrált csomóponti erő [kN], z irányban (lefelé pozitív). */
export interface NodalForce {
  readonly id: LoadId;
  readonly kind: 'nodal-force';
  readonly nodeId: NodeId;
  readonly fz: KiloNewton;
}

/** Koncentrált csomóponti nyomaték [kNm]. */
export interface NodalMoment {
  readonly id: LoadId;
  readonly kind: 'nodal-moment';
  readonly nodeId: NodeId;
  readonly my: KiloNewtonMeter;
}

/**
 * Megoszló erő tetszőleges x1..x2 szakaszon (Diplomaterv 3.1.6.2).
 * `linear`: trapéz/háromszög (q1 → q2). `parabolic`: másodfokú, `qMid` a
 * szakasz felezőpontjának intenzitása.
 */
export interface DistributedForce {
  readonly id: LoadId;
  readonly kind: 'distributed-force';
  readonly x1: Meter;
  readonly x2: Meter;
  readonly q1: KiloNewtonPerMeter;
  readonly q2: KiloNewtonPerMeter;
  readonly shape: 'linear' | 'parabolic';
  readonly qMid?: KiloNewtonPerMeter;
}

/** Megoszló nyomaték m(x) [kNm/m] (Diplomaterv 3.2 egyenlet). */
export interface DistributedMoment {
  readonly id: LoadId;
  readonly kind: 'distributed-moment';
  readonly x1: Meter;
  readonly x2: Meter;
  readonly m1: KiloNewtonMeterPerMeter;
  readonly m2: KiloNewtonMeterPerMeter;
}

/** Önsúly az anyag fajsúlyából és a szelvény területéből (Diplomaterv 3.23). */
export interface SelfWeight {
  readonly id: LoadId;
  readonly kind: 'self-weight';
  /** szorzótényező (pl. 1.35 tehernövelő tényezőhöz) */
  readonly factor: Dimensionless;
}

/**
 * Hőteher (Diplomaterv 3.1.6.4). A gerendamodellnek nincs tengelyirányú
 * szabadságfoka, ezért CSAK a hőmérséklet-gradiens okoz igénybevételt:
 *   κ0 = α · (tBottom − tTop) / h
 * Az egyenletes (gradiens nélküli) ΔT hatása zérus — erre a validáció
 * figyelmeztetést ad.
 */
export interface ThermalLoad {
  readonly id: LoadId;
  readonly kind: 'thermal';
  /** Ha üres, minden elemre vonatkozik. */
  readonly elementIds?: readonly ElementId[];
  /** Referencia- (feszültségmentes) hőmérséklet [°C] */
  readonly tRef: Celsius;
  /** Felső szél hőmérséklete [°C] */
  readonly tTop: Celsius;
  /** Alsó szél hőmérséklete [°C] */
  readonly tBottom: Celsius;
}

/** Előírt támaszmozgás (Diplomaterv 3.1.6.5). */
export interface SupportDisplacement {
  readonly id: LoadId;
  readonly kind: 'support-displacement';
  readonly nodeId: NodeId;
  /** z irányú eltolódás [m] */
  readonly dz?: Meter;
  /** elfordulás [rad] */
  readonly dPhi?: Radian;
}

export type Load =
  | NodalForce
  | NodalMoment
  | DistributedForce
  | DistributedMoment
  | SelfWeight
  | ThermalLoad
  | SupportDisplacement;

export type LoadKind = Load['kind'];

// ─── Megtámasztás ─────────────────────────────────────────────────────────────

/**
 * Csomóponti megtámasztás. A rugóállandók a rugalmasan megtámasztott
 * esetet fedik (Diplomaterv 3.1.7.1).
 */
export interface Boundary {
  readonly nodeId: NodeId;
  /** w = 0 előírás */
  readonly wFixed: boolean;
  /** φ = 0 előírás */
  readonly phiFixed: boolean;
  /** eltolódási rugóállandó [kN/m] */
  readonly springW?: KiloNewtonPerMeter;
  /** elfordulási rugóállandó [kNm/rad] */
  readonly springPhi?: KiloNewtonMeter;
}

/**
 * Winkler-féle rugalmas ágyazat (Diplomaterv 3.28 és 5. fejezet).
 * `c` az ágyazási tényező [kN/m²] (hosszegységre eső rugómerevség).
 */
export interface ElasticFoundation {
  readonly x1: Meter;
  readonly x2: Meter;
  readonly c: KiloNewtonPerSquareMeter;
}

// ─── Tehertörténet ────────────────────────────────────────────────────────────

/**
 * Egyparaméteres teher (Diplomaterv 3.2.1: „Terhelés: egyparaméteres").
 * A `lambdaTargets` a teherszorzó célértékei; a lépések között a megoldó
 * adaptívan bonthat. Tehermentesítés = csökkenő λ (Diplomaterv 3.3).
 */
export interface LoadHistory {
  readonly lambdaTargets: readonly number[];
  /** kezdeti lépésköz-javaslat (a célértékek közti felosztás) */
  readonly stepsPerTarget: number;
}

// ─── A teljes modell ──────────────────────────────────────────────────────────

export interface ModelMeta {
  readonly name: string;
  readonly description?: string;
  readonly createdAt?: string;
}

export interface Model {
  readonly meta: ModelMeta;
  readonly nodes: readonly Node[];
  readonly elements: readonly Element[];
  readonly materials: readonly Material[];
  readonly sections: readonly Section[];
  readonly loads: readonly Load[];
  readonly boundaries: readonly Boundary[];
  readonly foundations: readonly ElasticFoundation[];
  readonly history: LoadHistory;
}
