/**
 * Az anyagmodell merevségi mátrixa (a diplomaterv „MODB" modulja).
 *
 * (2.1)–(2.3) egyenletek: a hajlított–nyírt gerenda anyagegyenlete
 *
 *   ⎧ κ ⎫   ⎡ 1/EI    0   ⎤ ⎧ M ⎫              ⎡ EI   0  ⎤
 *   ⎨   ⎬ = ⎢             ⎥ ⎨   ⎬   →   D = H⁻¹ = ⎢         ⎥
 *   ⎩ γ ⎭   ⎣  0   1/GAs  ⎦ ⎩ T ⎭              ⎣  0  GAs ⎦
 *
 * Rétegelt keresztmetszetnél (3.4.3, (3.54)):
 *   EI = Σ Eₗ·bₗ·zₗ²·tₗ        GA = Σ Gₗ·bₗ·tₗ
 * A rétegek saját inerciája (tₗ³/12) a diplomaterv képletében nincs benne;
 * az `includeLayerOwnInertia` kapcsolóval vehető figyelembe.
 */

import { DenseMatrix } from '../linalg/dense.js';
import { DimensionError } from '../linalg/errors.js';
import { geometricProperties } from '../section/properties.js';
import { G_ACCEL } from '../units/convert.js';
import type { Material, MaterialId, Section } from '../model/types.js';

export interface SectionStiffness {
  /** Hajlítómerevség EI [kNm²] */
  readonly ei: number;
  /** Nyírási merevség GAs = κs·G·A [kN] */
  readonly gas: number;
  /** Keresztmetszeti terület A [m²] */
  readonly area: number;
  /** Másodrendű nyomaték I [m⁴] */
  readonly inertia: number;
  /** A keresztmetszet magassága [m] */
  readonly height: number;
  /** Rugalmas keresztmetszeti modulus [m³] (rétegeltnél a rétegzésből) */
  readonly elasticModulus: number;
  /** Képlékeny keresztmetszeti modulus [m³] */
  readonly plasticModulus: number;
  /** Alaki tényező c = Kp/Kₑ */
  readonly shapeFactor: number;
}

/** Anyagfeloldó: rétegenkénti anyaghivatkozáshoz. */
export type MaterialLookup = (id: MaterialId) => Material | undefined;

/**
 * A keresztmetszet merevségi jellemzőinek előállítása.
 *
 * @param section a keresztmetszet (parametrikus vagy rétegelt)
 * @param material az elem alapanyaga
 * @param lookup rétegenkénti anyagfeloldó; rétegelt szelvénynél kell
 */
export function sectionStiffness(
  section: Section,
  material: Material,
  lookup?: MaterialLookup,
): SectionStiffness {
  const e = material.e as number;
  const g = material.g as number;
  const ks = section.shearFactor as number;

  if (section.kind === 'parametric') {
    const p = geometricProperties(section.shape);
    return {
      ei: e * p.inertia,
      gas: ks * g * p.area,
      area: p.area,
      inertia: p.inertia,
      height: p.height,
      elasticModulus: p.elasticModulus,
      plasticModulus: p.plasticModulus,
      shapeFactor: p.shapeFactor,
    };
  }

  // ── Rétegelt keresztmetszet (Diplomaterv 3.4.3) ──────────────────────────
  const layers = section.layers;
  if (layers.length === 0) {
    throw new DimensionError(`A(z) "${section.name}" rétegelt keresztmetszetnek nincs rétege.`);
  }

  let ei = 0;
  let ga = 0;
  let area = 0;
  let inertia = 0;
  let plasticModulus = 0;
  let zTop = Number.POSITIVE_INFINITY;
  let zBottom = Number.NEGATIVE_INFINITY;

  for (const layer of layers) {
    const b = layer.b as number;
    const t = layer.t as number;
    const z = layer.z as number;

    const layerMaterial =
      layer.materialId !== undefined ? (lookup?.(layer.materialId) ?? material) : material;
    const el = layerMaterial.e as number;
    const gl = layerMaterial.g as number;

    const a = b * t;
    // (3.54): EI = Σ Eₗ·bₗ·zₗ²·tₗ
    const own = section.includeLayerOwnInertia === true ? (t * t) / 12 : 0;
    const i = a * (z * z + own);

    ei += el * i;
    ga += gl * a;
    area += a;
    inertia += i;
    // Kp = 2·S₀ = Σ bₗ·tₗ·|zₗ| (a súlyponti tengelyre vett statikai nyomaték kétszerese)
    plasticModulus += a * Math.abs(z);

    zTop = Math.min(zTop, z - t / 2);
    zBottom = Math.max(zBottom, z + t / 2);
  }

  const yMax = Math.max(Math.abs(zTop), Math.abs(zBottom));
  const elasticModulus = yMax > 0 ? inertia / yMax : 0;

  return {
    ei,
    gas: ks * ga,
    area,
    inertia,
    height: zBottom - zTop,
    elasticModulus,
    plasticModulus,
    shapeFactor: elasticModulus > 0 ? plasticModulus / elasticModulus : 0,
  };
}

/**
 * A D anyagmátrix: diag(EI, GAs).
 * (Diplomaterv (2.3) — a Hooke-törvény hajlékonysági mátrixának inverze.)
 */
export function constitutiveMatrix(stiffness: SectionStiffness): DenseMatrix {
  const d = new DenseMatrix(2, 2);
  d.set(0, 0, stiffness.ei);
  d.set(1, 1, stiffness.gas);
  return d;
}

/** Az elem tömegjellemzői egységnyi hosszra (ADR-0016). */
export interface SectionMass {
  /** Vonalmenti (transzlációs) tömeg m' = γ·A/g [kN·s²/m²] */
  readonly massPerLength: number;
  /** Vonalmenti forgási tehetetlenség m'ᵩ = γ·I/g [kN·s²] */
  readonly rotaryInertiaPerLength: number;
}

/**
 * A tömegjellemzők előállítása a MÁR kiszámított keresztmetszeti
 * merevségből (`area`/`inertia` — rétegelt szelvénynél is helyesen
 * összegzett) és az anyag fajsúlyából (`gamma`, ugyanaz, amit az önsúly-
 * tehervektor is használ, ld. `assembly/loadVector.ts`).
 *
 * A Material-nak nincs külön "sűrűség" mezője — a fajsúlyt (kN/m³) UGYANAZZAL
 * a `G_ACCEL`-lel (EN 1990, `units/convert.ts`) osztjuk vissza tömeggé, amivel
 * a `makeMaterial()` builder a `density`-ből számítja a `gamma`-t (ld.
 * `specificWeightFromDensity`) — a két irány (tömeg→súly, súly→tömeg)
 * konzisztens ugyanazzal az állandóval.
 */
export function sectionMass(stiffness: SectionStiffness, material: Material): SectionMass {
  const gamma = material.gamma as number;
  return {
    massPerLength: (gamma * stiffness.area) / G_ACCEL,
    rotaryInertiaPerLength: (gamma * stiffness.inertia) / G_ACCEL,
  };
}
