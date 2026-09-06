/**
 * Az alakváltozási (B) mátrix Timoshenko gerendaelemre.
 *
 * Diplomaterv (3.14). Kinematika (3.1):
 *   γ(x) = φ(x) − ∂w/∂x        nyírási torzulás
 *   κ(x) = ∂φ/∂x                görbület
 *
 * ELŐJEL-KONVENCIÓ (docs/CONVENTIONS.md): γ = φ − dw/dx.
 * A K merevségi mátrix invariáns a γ sor együttes előjelváltására (a sor
 * kétszer szerepel a BᵀDB szorzatban), de a T nyíróerő előjele nem — ezért
 * kell egyszer rögzíteni, és teszttel őrizni.
 *
 * Szabadságfok-sorrend (rögzített): u = [w₁, φ₁, w₂, φ₂, w₃, φ₃]ᵀ
 *
 *        ⎡    0      dN₁/dx     0      dN₂/dx     0      dN₃/dx ⎤   ← κ sor
 * B(ξ) = ⎢                                                       ⎥
 *        ⎣ −dN₁/dx     N₁    −dN₂/dx     N₂    −dN₃/dx     N₃   ⎦   ← γ sor
 */

import { DenseMatrix } from '../linalg/dense.js';
import { DegenerateElementError } from '../linalg/errors.js';
import { shapeFunctions } from './shapeFunctions.js';

/** Az elemi szabadságfokok száma: 3 csomópont × (w, φ). */
export const DOF_PER_ELEMENT = 6;
/** Szabadságfok csomópontonként: [w, φ]. */
export const DOF_PER_NODE = 2;

/** A B mátrix sorai külön-külön — a szelektív integráláshoz. */
export interface BRows {
  /** A görbület sora (1×6) */
  readonly kappa: Float64Array;
  /** A nyírási torzulás sora (1×6) */
  readonly gamma: Float64Array;
  /** A Jacobi-determináns az adott pontban */
  readonly detJ: number;
}

/**
 * A B mátrix két sorának előállítása egy lokális koordinátában.
 *
 * A hajlítási és a nyírási tag külön integrálódik (különböző pontszámmal),
 * ezért adjuk vissza soronként, nem összeragasztva.
 *
 * TELJESÍTMÉNY (P16, MÉRÉSSEL azonosítva — ld. docs/ADR/0009-*.md): ez az
 * EGYETLEN legforróbb függvény a nemlineáris megoldóban (minden Newton-
 * iterációban, minden Gauss-pontban, minden elemre meghívódik). A Jacobi
 * (`j`/`invJ`) itt, INLINE készül — NEM a `jacobian()`/`shapeDerivativesX()`
 * függvényen keresztül —, mert az korábban `shapeFunctions(xi)`-t
 * HÁROMSZOR hívta meg ugyanarra a ξ-re (egyszer `jacobian()`-ben, egyszer
 * `shapeDerivativesX()`-ben, egyszer itt) — pedig egyetlen hívás elég. A
 * `jacobian()`/`shapeDerivativesX()` közfüggvények VÁLTOZATLANOK maradnak
 * (más hívóknak, pl. `assembler.ts`, `loadVector.ts`, a levezetésnek kell
 * a teljes `JacobianValues`/`x` is) — csak ez az egy, forró hívási hely nem
 * rajtuk keresztül számol. A degenerált-elem ellenőrzés (`j>0`) és a
 * `detJ=j` képlet SZÓ SZERINT ugyanaz, mint `jacobian()`-ben.
 */
export function bRows(nodeX: readonly [number, number, number], xi: number, elementId = '?'): BRows {
  const { n, dn } = shapeFunctions(xi);

  const j = dn[0] * nodeX[0] + dn[1] * nodeX[1] + dn[2] * nodeX[2];
  if (!(j > 0) || !Number.isFinite(j)) {
    throw new DegenerateElementError(elementId, j);
  }
  const invJ = 1 / j;

  const kappa = new Float64Array(DOF_PER_ELEMENT);
  const gamma = new Float64Array(DOF_PER_ELEMENT);

  for (let i = 0; i < 3; i++) {
    const w = 2 * i; // a csomópont w szabadságfoka
    const phi = 2 * i + 1; // a csomópont φ szabadságfoka
    const dNdxI = dn[i] * invJ;

    // κ = ∂φ/∂x — csak a φ szabadságfokokra hat
    kappa[phi] = dNdxI;

    // γ = φ − ∂w/∂x
    gamma[w] = -dNdxI;
    gamma[phi] = n[i];
  }

  return { kappa, gamma, detJ: j };
}

/**
 * A teljes 2×6 B mátrix — a levezetés-nézet és a tesztek számára
 * (ADR-0005: a részlépések önállóan hívhatók).
 */
export function bMatrix(nodeX: readonly [number, number, number], xi: number, elementId = '?'): DenseMatrix {
  const { kappa, gamma } = bRows(nodeX, xi, elementId);
  const b = new DenseMatrix(2, DOF_PER_ELEMENT);
  for (let k = 0; k < DOF_PER_ELEMENT; k++) {
    b.set(0, k, kappa[k]);
    b.set(1, k, gamma[k]);
  }
  return b;
}

/** Az alakfüggvény-sorok egy Gauss-pontban — a tömegmátrixhoz. */
export interface NRows {
  /** Nᵢ a w szabadságfokok helyén, 0 a φ helyén (1×6) */
  readonly w: Float64Array;
  /** Nᵢ a φ szabadságfokok helyén, 0 a w helyén (1×6) */
  readonly phi: Float64Array;
  /** A Jacobi-determináns az adott pontban */
  readonly detJ: number;
}

/**
 * Az alakfüggvények (nem a deriváltjaik) DOF-helyekre szórt sorai.
 *
 * A konzisztens tömegmátrix ∫ Nᵢ·Nⱼ alakú tagokból épül fel — w és φ
 * EGYMÁSTÓL FÜGGETLENÜL, ugyanazokkal a kvadratikus alakfüggvényekkel
 * interpolál (ld. `shapeFunctions.ts`), ezért a transzlációs és a forgási
 * tehetetlenségi tag nem csatolt (w–φ kereszttag nincs).
 */
export function nRows(nodeX: readonly [number, number, number], xi: number, elementId = '?'): NRows {
  const { n, dn } = shapeFunctions(xi);

  const j = dn[0] * nodeX[0] + dn[1] * nodeX[1] + dn[2] * nodeX[2];
  if (!(j > 0) || !Number.isFinite(j)) {
    throw new DegenerateElementError(elementId, j);
  }

  const w = new Float64Array(DOF_PER_ELEMENT);
  const phi = new Float64Array(DOF_PER_ELEMENT);
  for (let i = 0; i < 3; i++) {
    w[2 * i] = n[i];
    phi[2 * i + 1] = n[i];
  }

  return { w, phi, detJ: j };
}

/**
 * Alakváltozások az elemi elmozdulásvektorból: ε = B·uₑ.
 * (Diplomaterv (3.30).)
 */
export function strains(
  nodeX: readonly [number, number, number],
  ue: Float64Array,
  xi: number,
  elementId = '?',
): { readonly kappa: number; readonly gamma: number } {
  const rows = bRows(nodeX, xi, elementId);
  let k = 0;
  let g = 0;
  for (let i = 0; i < DOF_PER_ELEMENT; i++) {
    k += rows.kappa[i] * ue[i];
    g += rows.gamma[i] * ue[i];
  }
  return { kappa: k, gamma: g };
}
