/**
 * A háromcsomópontú Timoshenko gerendaelem merevségi mátrixa.
 *
 * Diplomaterv (3.11), (3.24)–(3.26):
 *
 *   Kₑ = ∫ Bᵀ·D·B dx = ∫₋₁¹ Bᵀ·D·B·|J| dξ
 *
 * A hajlítási és a nyírási tag KÜLÖN integrálódik, eltérő pontszámmal
 * (szelektív redukált integrálás, 3.1.4):
 *
 *   Kₑ = ∫ Bκᵀ·EI·Bκ·|J| dξ   (3 pont)
 *      + ∫ Bγᵀ·GAs·Bγ·|J| dξ  (2 pont szelektív, 3 pont teljes sémánál)
 *
 * A redukált nyírási integrálás szünteti meg a „záródási jelenséget"
 * (shear locking): karcsú rudaknál a teljes integrálás a nyírási merevséget
 * túlhangsúlyozza, és a modell elmerevedik.
 */

import { DenseMatrix } from '../linalg/dense.js';
import { DOF_PER_ELEMENT, bRows, nRows } from './bMatrix.js';
import { GAUSS_3 } from './quadrature.js';
import { quadratureFor } from './quadrature.js';
import type { IntegrationScheme } from '../model/types.js';
import type { SectionMass, SectionStiffness } from './constitutive.js';

export interface ElementGeometry {
  /** A három csomópont globális x koordinátája [m]: [bal, közép, jobb] */
  readonly nodeX: readonly [number, number, number];
  readonly elementId: string;
}

/**
 * Egy 1×6 sorvektor diadikus szorzatának hozzáadása:
 *   K += factor · rᵀ·r
 * A merevségi mátrix ezekből az egyrangú tagokból épül fel, ami egyben
 * garantálja a szimmetriát.
 */
function addOuterProduct(k: DenseMatrix, row: Float64Array, factor: number): void {
  for (let i = 0; i < DOF_PER_ELEMENT; i++) {
    const ri = row[i];
    if (ri === 0) continue;
    for (let j = i; j < DOF_PER_ELEMENT; j++) {
      const v = factor * ri * row[j];
      if (v === 0) continue;
      k.add(i, j, v);
      if (j !== i) k.add(j, i, v);
    }
  }
}

/**
 * Az elemi merevségi mátrix (6×6).
 *
 * @param geom az elem geometriája
 * @param stiffness EI és GAs
 * @param scheme integrálási séma
 */
export function elementStiffness(
  geom: ElementGeometry,
  stiffness: SectionStiffness,
  scheme: IntegrationScheme = 'selective',
): DenseMatrix {
  const k = new DenseMatrix(DOF_PER_ELEMENT, DOF_PER_ELEMENT);
  const rules = quadratureFor(scheme);

  // Hajlítási tag: ∫ Bκᵀ·EI·Bκ·|J| dξ
  for (const gp of rules.bending) {
    const { kappa, detJ } = bRows(geom.nodeX, gp.xi, geom.elementId);
    addOuterProduct(k, kappa, stiffness.ei * detJ * gp.w);
  }

  // Nyírási tag: ∫ Bγᵀ·GAs·Bγ·|J| dξ
  for (const gp of rules.shear) {
    const { gamma, detJ } = bRows(geom.nodeX, gp.xi, geom.elementId);
    addOuterProduct(k, gamma, stiffness.gas * detJ * gp.w);
  }

  return k;
}

/**
 * Geometriai merevségi mátrix, EGYSÉGNYI (referencia) axiális erőre —
 * 2026-09-04, stabilitás/másodrendű (P-Δ) hatás.
 *
 *   Kg₀ = ∫ (dNw/dx)ᵀ·(dNw/dx) dx
 *
 * Ez a klasszikus geometriai-merevség kernel, ami a keresztirányú
 * elmozdulás (w) MEREDEKSÉGÉBŐL adódó másodrendű munkát fejezi ki egy
 * axiális erő alatt. A `dw/dx` sor NEM igényel új alakfüggvény-gépezetet:
 * a `bMatrix.ts` `bRows()` már kiszámítja ezt a `gamma` sor w-komponenseként
 * (`gamma[w] = -dNdx`, ld. `bMatrix.ts` fejléce) — csak a φ-komponenseket
 * kell nullázni, mert a `dw/dx` sor NEM tartalmaz φ-tagot (ellentétben a
 * `gamma = φ − dw/dx` nyírási torzulással).
 *
 * A hívó (`assembly/assembler.ts`) skálázza N-nel: a POZITÍV N (nyomóerő)
 * a hajlítási merevséget CSÖKKENTI (`keEffective -= N·Kg₀`), a negatív
 * (húzóerő) NÖVELI.
 *
 * Teljes, 3-pontos Gauss-kvadratúra — a `(dw/dx)²` integrandus csak
 * másodfokú (a `w` alakfüggvény kvadratikus), ennél nincs "záródási
 * jelenség", amit a szelektív integrálás (`elementStiffness` nyírási tagja)
 * orvosolna, ezért a `scheme` paraméter itt felesleges.
 */
export function elementGeometricStiffness(geom: ElementGeometry): DenseMatrix {
  const kg = new DenseMatrix(DOF_PER_ELEMENT, DOF_PER_ELEMENT);

  for (const gp of GAUSS_3) {
    const { gamma, detJ } = bRows(geom.nodeX, gp.xi, geom.elementId);
    const dwdx = new Float64Array(DOF_PER_ELEMENT);
    for (let i = 0; i < 3; i++) dwdx[2 * i] = -(gamma[2 * i] ?? 0);
    addOuterProduct(kg, dwdx, detJ * gp.w);
  }

  return kg;
}

/**
 * Az elemi (konzisztens) tömegmátrix (6×6) — ADR-0016.
 *
 *   Mₑ = ∫ (m'·Nwᵀ·Nw + m'ᵩ·Nᵩᵀ·Nᵩ)·|J| dξ
 *
 * A w és a φ mező EGYMÁSTÓL FÜGGETLENÜL, ugyanazokkal a kvadratikus
 * alakfüggvényekkel interpolál (nincs w–φ kereszttag, ld. `nRows`) — ezért a
 * transzlációs és a forgási tehetetlenségi tag külön-külön, de AZONOS
 * (teljes, 3 pontos) kvadratúrával integrálódik. A merevségi mátrixtól
 * eltérően itt nincs szelektív/redukált integrálás: a tömegmátrix-integrandus
 * (Nᵢ·Nⱼ, legfeljebb negyedfokú) nem szenved a nyírási záródáshoz hasonló
 * jelenségtől, amit a redukált integrálás orvosolna — ld. ADR-0016 1. nyitott
 * kérdése (a döntés maga még NEM végleges, ez az első, validálandó lépés).
 */
export function elementMass(geom: ElementGeometry, mass: SectionMass): DenseMatrix {
  const m = new DenseMatrix(DOF_PER_ELEMENT, DOF_PER_ELEMENT);

  for (const gp of GAUSS_3) {
    const { w, phi, detJ } = nRows(geom.nodeX, gp.xi, geom.elementId);
    addOuterProduct(m, w, mass.massPerLength * detJ * gp.w);
    addOuterProduct(m, phi, mass.rotaryInertiaPerLength * detJ * gp.w);
  }

  return m;
}

/**
 * Igénybevételek egy Gauss-pontban az elemi elmozdulásvektorból.
 * (Diplomaterv (3.30)–(3.31): ε = B·uₑ, majd σ = D·(ε − ε0).)
 *
 * A `kappa`/`gamma` mező a VALÓDI (geometriai) alakváltozás — ez tartalmazza
 * a hőteher szabad görbületét is (κ0), ha a szerkezet statikailag határozott.
 * Az `m`/`t` (igénybevétel) ezzel szemben a MECHANIKAI (feszültséget okozó)
 * alakváltozásból számol: `M = EI·(κ − κ0)`. A nyírási kezdő-alakváltozás a
 * modellben mindig 0 (a hőteher ε0 = [κ0, 0]ᵀ), ezért `T = GAs·γ` változatlan.
 */
export function internalForces(
  geom: ElementGeometry,
  stiffness: SectionStiffness,
  ue: Float64Array,
  xi: number,
  kappa0 = 0,
): { readonly kappa: number; readonly gamma: number; readonly m: number; readonly t: number } {
  const rows = bRows(geom.nodeX, xi, geom.elementId);
  let kappa = 0;
  let gamma = 0;
  for (let i = 0; i < DOF_PER_ELEMENT; i++) {
    kappa += rows.kappa[i] * ue[i];
    gamma += rows.gamma[i] * ue[i];
  }
  return {
    kappa,
    gamma,
    m: stiffness.ei * (kappa - kappa0),
    t: stiffness.gas * gamma,
  };
}

/**
 * A merevtest-mozgás elmozdulásvektorai — a nulltér bázisa.
 *
 * Timoshenko-gerendán a merev mozgás:  w(x) = a + b·x,  φ = b
 * (ekkor κ = ∂φ/∂x = 0 és γ = φ − ∂w/∂x = b − b = 0).
 *
 * Ezekre `Kₑ·u = 0` kell teljesüljön — ez az elem egyik legerősebb
 * önellenőrzése (lásd `selfCheck.ts`).
 */
export function rigidBodyModes(
  nodeX: readonly [number, number, number],
): readonly Float64Array[] {
  // 1) tiszta eltolás: w = 1, φ = 0
  const translation = Float64Array.from([1, 0, 1, 0, 1, 0]);
  // 2) merev elfordulás: w = x, φ = 1
  const rotation = Float64Array.from([nodeX[0], 1, nodeX[1], 1, nodeX[2], 1]);
  return [translation, rotation];
}
