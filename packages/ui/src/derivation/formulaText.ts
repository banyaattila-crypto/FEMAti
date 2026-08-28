/**
 * Behelyettesített képlet-szövegek a levezetéshez (MASTER-PROMPT-TERV P15/A
 * prompt, 4. pont: "N1..N3 és dNi/dξ értéke MINDEN Gauss-pontban, számokkal",
 * "a Kₑ integrálás lépései").
 *
 * FONTOS: ez a fájl NEM SZÁMOL semmit, amit a mag még nem számolt ki — csak
 * a `@femati/fem-core` `derivation` moduljának (ill. a `deriveLayerStep`
 * kimenetének) MÁR MEGLÉVŐ számait rendezi "képlet = behelyettesített
 * számok = eredmény" alakba, hogy a felhasználó a konkrét számítást (ne csak
 * a végeredményt) lássa. A képletek maguk a `docs/THEORY.md`-ben és a
 * fem-core forráskód fejléceiben dokumentált, publikált formulák — nem új
 * levezetés, csak szöveges megjelenítés (ADR-0005 szelleme).
 */
import type { DistributedLoadGaussDetail, GaussStepDetail, MassGaussStepDetail, ThermalLoadGaussDetail } from '@femati/fem-core';
import type { PlasticLayerRow } from './derivationData.js';

function f(v: number, digits = 4): string {
  return Number.isFinite(v) ? v.toFixed(digits) : '—';
}

export function shapeFunctionLines(xi: number, n: readonly [number, number, number]): string {
  return [
    `N₁(ξ) = ½·ξ·(ξ−1) = ½·(${f(xi)})·(${f(xi)}−1) = ${f(n[0])}`,
    `N₂(ξ) = 1−ξ² = 1−(${f(xi)})² = ${f(n[1])}`,
    `N₃(ξ) = ½·ξ·(ξ+1) = ½·(${f(xi)})·(${f(xi)}+1) = ${f(n[2])}`,
  ].join('\n');
}

export function shapeDerivativeLines(xi: number, dn: readonly [number, number, number]): string {
  return [
    `dN₁/dξ = ξ−0.5 = ${f(xi)}−0.5 = ${f(dn[0])}`,
    `dN₂/dξ = −2·ξ = −2·(${f(xi)}) = ${f(dn[1])}`,
    `dN₃/dξ = ξ+0.5 = ${f(xi)}+0.5 = ${f(dn[2])}`,
  ].join('\n');
}

export function jacobianLines(
  dn: readonly [number, number, number],
  nodeX: readonly [number, number, number],
  j: number,
  invJ: number,
): string {
  return [
    'J = dN₁/dξ·x₁ + dN₂/dξ·x₂ + dN₃/dξ·x₃',
    `  = (${f(dn[0])})·${f(nodeX[0], 3)} + (${f(dn[1])})·${f(nodeX[1], 3)} + (${f(dn[2])})·${f(nodeX[2], 3)}`,
    `  = ${f(j, 5)} m`,
    `J⁻¹ = 1/J = 1/${f(j, 5)} = ${f(invJ, 5)}`,
  ].join('\n');
}

function dNdx(dn: readonly [number, number, number], invJ: number): readonly [number, number, number] {
  return [dn[0] * invJ, dn[1] * invJ, dn[2] * invJ];
}

function dNdxLines(dn: readonly [number, number, number], invJ: number): string {
  const d = dNdx(dn, invJ);
  return [
    `dN₁/dx = dN₁/dξ·J⁻¹ = (${f(dn[0])})·${f(invJ, 5)} = ${f(d[0])}`,
    `dN₂/dx = dN₂/dξ·J⁻¹ = (${f(dn[1])})·${f(invJ, 5)} = ${f(d[1])}`,
    `dN₃/dx = dN₃/dξ·J⁻¹ = (${f(dn[2])})·${f(invJ, 5)} = ${f(d[2])}`,
  ].join('\n');
}

/** A hajlítási (κ-sort adó) Gauss-pont TELJES, behelyettesített levezetése. */
export function bendingGaussBlock(gp: GaussStepDetail, index: number, ei: number): string {
  const factor = ei * gp.jacobian.detJ * gp.w;
  return [
    `— Gauss-pont B${index + 1}: ξ = ${f(gp.xi)}, súly w = ${f(gp.w)} —`,
    shapeFunctionLines(gp.xi, gp.n),
    shapeDerivativeLines(gp.xi, gp.dn),
    dNdxLines(gp.dn, gp.jacobian.invJ),
    `κ-sor: B_κ = [0, dN₁/dx, 0, dN₂/dx, 0, dN₃/dx] = [${Array.from(gp.bRows.kappa).map((v) => f(v, 3)).join(', ')}]`,
    `Hajlítási hozzájárulás a Kₑ-hez: EI·|J|·w = ${f(ei, 1)}·${f(gp.jacobian.detJ, 5)}·${f(gp.w, 4)} = ${f(factor, 2)}`,
  ].join('\n');
}

/** A nyírási (γ-sort adó) Gauss-pont TELJES, behelyettesített levezetése. */
export function shearGaussBlock(gp: GaussStepDetail, index: number, gas: number): string {
  const factor = gas * gp.jacobian.detJ * gp.w;
  return [
    `— Gauss-pont Ny${index + 1}: ξ = ${f(gp.xi)}, súly w = ${f(gp.w)} —`,
    shapeFunctionLines(gp.xi, gp.n),
    shapeDerivativeLines(gp.xi, gp.dn),
    dNdxLines(gp.dn, gp.jacobian.invJ),
    `γ-sor: B_γ = [−dN₁/dx, N₁, −dN₂/dx, N₂, −dN₃/dx, N₃] = [${Array.from(gp.bRows.gamma).map((v) => f(v, 3)).join(', ')}]`,
    `Nyírási hozzájárulás a Kₑ-hez: GAs·|J|·w = ${f(gas, 1)}·${f(gp.jacobian.detJ, 5)}·${f(gp.w, 4)} = ${f(factor, 2)}`,
  ].join('\n');
}

/**
 * A Kₑ[dofIndex, dofIndex] főátló-elem TELJES, tagonkénti összegzése —
 * konkrét, ellenőrizhető példa a "hajlítási tag 3 pontból, nyírási tag
 * 2 pontból" integrálásra (MASTER-PROMPT-TERV P15/A 4. pont). A φ₁ (index 1)
 * szabadságfokot mutatja, mert ARRA mindkét tag (κ ÉS γ sor is) ad
 * járulékot — jó, teljes illusztráció.
 */
export function keDiagonalDemo(
  bendingPoints: readonly GaussStepDetail[],
  shearPoints: readonly GaussStepDetail[],
  ei: number,
  gas: number,
  keValue: number,
  dofIndex = 1,
): string {
  const bendingTerms = bendingPoints.map((gp, i) => {
    const b = gp.bRows.kappa[dofIndex] ?? 0;
    const factor = ei * gp.jacobian.detJ * gp.w;
    return { label: `hajlítás B${i + 1}`, b, factor, term: factor * b * b };
  });
  const shearTerms = shearPoints.map((gp, i) => {
    const b = gp.bRows.gamma[dofIndex] ?? 0;
    const factor = gas * gp.jacobian.detJ * gp.w;
    return { label: `nyírás Ny${i + 1}`, b, factor, term: factor * b * b };
  });
  const total = [...bendingTerms, ...shearTerms].reduce((s, t) => s + t.term, 0);
  return [
    `Kₑ[φ₁,φ₁] (2. sor/oszlop, index 1) = Σ (EI·|J|·w·B_κ[1]²) + Σ (GAs·|J|·w·B_γ[1]²)`,
    ...[...bendingTerms, ...shearTerms].map((t) => `  ${t.label}: ${f(t.factor, 2)}·(${f(t.b, 3)})² = ${f(t.term, 2)}`),
    `Összeg = ${f(total, 2)}  (a végső Kₑ mátrixban ugyanez az érték: ${f(keValue, 2)})`,
  ].join('\n');
}

/**
 * Egy tömegmátrix Gauss-pont TELJES, behelyettesített levezetése (ADR-0016)
 * — a `bendingGaussBlock`/`shearGaussBlock` szöveges párja, a w/φ DOF-
 * helyekre szórt alakfüggvény-sorokra (`nRows`) építve.
 */
export function massGaussBlock(gp: MassGaussStepDetail, index: number, massPerLength: number, rotaryInertiaPerLength: number): string {
  const wFactor = massPerLength * gp.jacobian.detJ * gp.w;
  const phiFactor = rotaryInertiaPerLength * gp.jacobian.detJ * gp.w;
  return [
    `— Gauss-pont T${index + 1}: ξ = ${f(gp.xi)}, súly w = ${f(gp.w)} —`,
    shapeFunctionLines(gp.xi, gp.n),
    `w-sor: N_w = [N₁, 0, N₂, 0, N₃, 0] = [${Array.from(gp.nRows.w).map((v) => f(v, 3)).join(', ')}]`,
    `φ-sor: N_φ = [0, N₁, 0, N₂, 0, N₃] = [${Array.from(gp.nRows.phi).map((v) => f(v, 3)).join(', ')}]`,
    `Transzlációs hozzájárulás a Mₑ-hez: m'·|J|·w = ${f(massPerLength, 4)}·${f(gp.jacobian.detJ, 5)}·${f(gp.w, 4)} = ${f(wFactor, 5)}`,
    `Forgási tehetetlenségi hozzájárulás a Mₑ-hez: m'φ·|J|·w = ${f(rotaryInertiaPerLength, 6)}·${f(gp.jacobian.detJ, 5)}·${f(gp.w, 4)} = ${f(phiFactor, 6)}`,
  ].join('\n');
}

/**
 * A Mₑ[w₁,w₁] és Mₑ[φ₁,φ₁] főátló-elemek tagonkénti, TELJES összegzése —
 * a `keDiagonalDemo` tömegmátrix-párja. A két főátló-elem KÜLÖN taglistából
 * adódik össze, mert a w-sor és a φ-sor sosem csatolt (nincs kereszttag).
 */
export function massDiagonalDemo(
  points: readonly MassGaussStepDetail[],
  massPerLength: number,
  rotaryInertiaPerLength: number,
  meWValue: number,
  mePhiValue: number,
): string {
  const wTerms = points.map((gp, i) => {
    const n = gp.nRows.w[0] ?? 0;
    const factor = massPerLength * gp.jacobian.detJ * gp.w;
    return { label: `T${i + 1}`, n, factor, term: factor * n * n };
  });
  const phiTerms = points.map((gp, i) => {
    const n = gp.nRows.phi[1] ?? 0;
    const factor = rotaryInertiaPerLength * gp.jacobian.detJ * gp.w;
    return { label: `T${i + 1}`, n, factor, term: factor * n * n };
  });
  const wTotal = wTerms.reduce((s, t) => s + t.term, 0);
  const phiTotal = phiTerms.reduce((s, t) => s + t.term, 0);
  return [
    `Mₑ[w₁,w₁] (1. sor/oszlop, index 0) = Σ (m'·|J|·w·N_w[0]²)`,
    ...wTerms.map((t) => `  ${t.label}: ${f(t.factor, 4)}·(${f(t.n, 3)})² = ${f(t.term, 4)}`),
    `Összeg = ${f(wTotal, 4)}  (a végső Mₑ mátrixban ugyanez az érték: ${f(meWValue, 4)})`,
    `Mₑ[φ₁,φ₁] (2. sor/oszlop, index 1) = Σ (m'φ·|J|·w·N_φ[1]²)`,
    ...phiTerms.map((t) => `  ${t.label}: ${f(t.factor, 6)}·(${f(t.n, 3)})² = ${f(t.term, 6)}`),
    `Összeg = ${f(phiTotal, 6)}  (a végső Mₑ mátrixban ugyanez az érték: ${f(mePhiValue, 6)})`,
  ].join('\n');
}

/** Egy megoszló teher/nyomaték/önsúly Gauss-pontjának TELJES, behelyettesített levezetése (4.7 pont). */
export function distributedLoadGaussBlock(gp: DistributedLoadGaussDetail, index: number, unit: string): string {
  const factor = gp.detJ * gp.w * gp.xiHalf;
  return [
    `— Gauss-pont ${index + 1}: ξ = ${f(gp.xi)}, w = ${f(gp.w)}, x = ${f(gp.x, 3)} m —`,
    shapeFunctionLines(gp.xi, gp.n),
    `p(x) = ${f(gp.value, 3)} ${unit}`,
    `|J|·w·ξ₁ₐ₂ = ${f(gp.detJ, 5)}·${f(gp.w, 4)}·${f(gp.xiHalf, 4)} = ${f(factor, 5)}`,
    `f_e = p(x)·|J|·w·ξ₁ₐ₂·[N₁,N₂,N₃] = [${Array.from(gp.contribution).map((v) => f(v, 4)).join(', ')}]`,
  ].join('\n');
}

/** Egy hőteher-Gauss-pont TELJES, behelyettesített levezetése (4.7 pont). */
export function thermalLoadGaussBlock(gp: ThermalLoadGaussDetail, index: number, ei: number, kappa0: number): string {
  return [
    `— Gauss-pont ${index + 1}: ξ = ${f(gp.xi)}, w = ${f(gp.w)} —`,
    `EI·κ₀·|J|·w = ${f(ei, 1)}·${kappa0.toExponential(3)}·${f(gp.detJ, 5)}·${f(gp.w, 4)} = ${f(ei * kappa0 * gp.detJ * gp.w, 4)}`,
    `f_e = [${Array.from(gp.contribution).map((v) => f(v, 4)).join(', ')}]`,
  ].join('\n');
}

/** Egy közvetlen csomóponti teher elhelyezése (nincs integrálás) — 4.7 pont. */
export function nodalLoadLine(localNode: 0 | 1 | 2, dofOffset: 0 | 1, value: number, unit: string): string {
  const dofIndex = 2 * localNode + dofOffset;
  const rowName = dofOffset === 0 ? 'w' : 'φ';
  return `Csomópont ${localNode + 1} (${rowName}-sor): f_e[${dofIndex + 1}] = ${f(value, 3)} ${unit} (nincs integrálás, közvetlen elhelyezés)`;
}

/** Egy Gauss-pont κ/γ → M/T visszaszámítása (5→6. pont híd) — szöveges blokk. */
export function internalForceBlock(
  index: number,
  xi: number,
  x: number,
  bKappa: Float64Array,
  bGamma: Float64Array,
  kappa: number,
  gamma: number,
  m: number,
  t: number,
  ei: number,
  gas: number,
  kappa0: number,
): string {
  return [
    `— Gauss-pont ${index + 1}: ξ = ${xi.toFixed(4)}, x = ${x.toFixed(3)} m —`,
    `κ = B_κ·uₑ = [${Array.from(bKappa).map((v) => v.toFixed(3)).join(', ')}]·uₑ = ${kappa.toExponential(3)} 1/m`,
    `γ = B_γ·uₑ = [${Array.from(bGamma).map((v) => v.toFixed(3)).join(', ')}]·uₑ = ${gamma.toExponential(3)}`,
    `M = EI·(κ−κ₀) = ${ei.toFixed(1)}·(${kappa.toExponential(3)}−${kappa0.toExponential(3)}) = ${m.toFixed(3)} kNm`,
    `T = GAs·γ = ${gas.toFixed(1)}·${gamma.toExponential(3)} = ${t.toFixed(3)} kN`,
  ].join('\n');
}

/** Gauss-ponti értékek másodfokú (Lagrange-) extrapolációja egy csomópontba (6.2/6.3 pont) — szöveges blokk. */
export function extrapolationBlock(
  label: string,
  values: readonly [number, number, number],
  xis: readonly [number, number, number],
  targetXi: -1 | 0 | 1,
  targetLabel: string,
  unit: string,
): string {
  const weights = xis.map((xii, i) => {
    let w = 1;
    for (let j = 0; j < 3; j++) {
      if (j === i) continue;
      const xij = xis[j] ?? 0;
      w *= (targetXi - xij) / (xii - xij);
    }
    return w;
  });
  const result = weights.reduce((s, w, i) => s + w * (values[i] ?? 0), 0);
  return [
    `${label}(${targetLabel}) = Σ Lᵢ(${targetXi})·${label}ᵢ`,
    ...weights.map((w, i) => `L${i + 1}(${targetXi}) = ${w.toFixed(4)}`),
    `${label}(${targetLabel}) = ${weights.map((w, i) => `${w.toFixed(4)}·(${(values[i] ?? 0).toFixed(3)})`).join(' + ')} = ${result.toFixed(3)} ${unit}`,
  ].join('\n');
}

/** A konvergencia-mérőszám (100·‖ψ‖/‖f‖ ≤ Tolerancia) egy adott lépésre, behelyettesítve — szöveges blokk. */
export function convergenceBlock(psiNorm: number, fNorm: number, residualPercent: number, tolerancePercent: number, converged: boolean): string {
  return [
    `100·‖ψ‖/‖f‖ = 100·${psiNorm.toExponential(3)}/${fNorm.toExponential(3)} = ${residualPercent.toFixed(4)}%`,
    `${residualPercent.toFixed(4)}% ${converged ? '≤' : '>'} ${tolerancePercent.toFixed(4)}% (Tolerancia) → ${converged ? 'KONVERGÁLT' : 'további iteráció szükséges'}`,
  ].join('\n');
}

/**
 * Egy réteg-visszavetítés (P15/A 7. pont) TELJES, behelyettesített képlete —
 * a `deriveLayerStep()` (fem-core) kimenetéből, semmilyen új számítás nélkül.
 */
export function plasticLayerFormula(row: PlasticLayerRow): string {
  const { layerIndex, zMm, derived } = row;
  const currentLimit = derived.sigmaY + derived.hPrime * derived.prevState.epsPEff;
  const branch =
    derived.step.r > 0 && derived.step.r < 1
      ? 'Átlépi a folyási határt ebben a lépésben'
      : derived.step.state.yielded
        ? 'Már megfolyt, a terhelés folytatódik (R = 1)'
        : 'Rugalmas marad (R = 0)';
  return [
    `${layerIndex + 1}. réteg (z = ${zMm.toFixed(1)} mm):`,
    `Δε = Δκ·z = ${derived.dKappa.toExponential(3)}·${(zMm * 1e-3).toFixed(4)} = ${derived.dEps.toExponential(3)}`,
    `σ_trial = σ_{r-1} + E·Δε = ${(derived.prevState.sigma * 1e-4).toFixed(3)} + ${(derived.e * 1e-4).toFixed(0)}·${derived.dEps.toExponential(3)} = ${(derived.sigmaTrial * 1e-4).toFixed(3)} kN/cm²`,
    `Folyási határ: σY + H'·epsPEff_{r-1} = ${(derived.sigmaY * 1e-4).toFixed(3)} + ${(derived.hPrime * 1e-4).toFixed(3)}·${derived.prevState.epsPEff.toExponential(3)} = ${(currentLimit * 1e-4).toFixed(3)} kN/cm²`,
    `${branch} → R = ${derived.step.r.toFixed(3)}`,
    `σ_új = sign·(σY + H'·epsPEff_új) = ${(derived.step.sigma * 1e-4).toFixed(3)} kN/cm² (${derived.step.state.yielded ? 'folyva' : 'rugalmas'})`,
  ].join('\n');
}
