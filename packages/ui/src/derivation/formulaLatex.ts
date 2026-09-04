/**
 * LaTeX képlet-sorok a levezetéshez — a `DerivationView.tsx` KaTeX-szel
 * szedi (HTML/nyomtatási nézet), a `formulaOmml.ts` pedig UGYANEZEKET a
 * sorokat valódi OOXML Word-képletobjektummá alakítja a `.docx` exportban
 * (`derivationExportData.ts`) — mindkét kimenet EGY forrásból származik,
 * hogy sose csússzanak szét (2026-09-04-ig egy KÜLÖN, sima szöveges
 * `formulaText.ts` modul adta a `.docx`-öt, ADR-0005 szerint; ez a
 * felhasználó kifejezett kérésére megszűnt).
 *
 * NEM számol semmit — csak a mag már kiszámított értékeit rendezi LaTeX
 * "képlet = behelyettesített számok = eredmény" alakba.
 */
import type { DistributedLoadGaussDetail, GaussStepDetail, MassGaussStepDetail, ThermalLoadGaussDetail } from '@femati/fem-core';
import type { PlasticLayerRow } from './derivationData.js';

function f(v: number, digits = 4): string {
  if (!Number.isFinite(v)) return '\\text{---}';
  const s = v.toFixed(digits);
  // A negatív számokat zárójelbe tesszük, ha behelyettesítésként szerepelnek.
  return s;
}

function paren(v: number, digits = 4): string {
  const s = f(v, digits);
  return v < 0 ? `(${s})` : s;
}

export function shapeFunctionTex(xi: number, n: readonly [number, number, number]): readonly string[] {
  return [
    `N_1(\\xi) = \\tfrac{1}{2}\\xi(\\xi-1) = \\tfrac{1}{2}\\cdot ${paren(xi)}\\cdot(${paren(xi)}-1) = ${f(n[0])}`,
    `N_2(\\xi) = 1-\\xi^2 = 1-(${paren(xi)})^2 = ${f(n[1])}`,
    `N_3(\\xi) = \\tfrac{1}{2}\\xi(\\xi+1) = \\tfrac{1}{2}\\cdot ${paren(xi)}\\cdot(${paren(xi)}+1) = ${f(n[2])}`,
  ];
}

export function shapeDerivativeTex(xi: number, dn: readonly [number, number, number]): readonly string[] {
  return [
    `\\frac{dN_1}{d\\xi} = \\xi-0.5 = ${f(xi)}-0.5 = ${f(dn[0])}`,
    `\\frac{dN_2}{d\\xi} = -2\\xi = -2\\cdot ${paren(xi)} = ${f(dn[1])}`,
    `\\frac{dN_3}{d\\xi} = \\xi+0.5 = ${f(xi)}+0.5 = ${f(dn[2])}`,
  ];
}

export function jacobianTex(
  dn: readonly [number, number, number],
  nodeX: readonly [number, number, number],
  j: number,
  invJ: number,
): readonly string[] {
  return [
    `J = \\frac{dN_1}{d\\xi}x_1+\\frac{dN_2}{d\\xi}x_2+\\frac{dN_3}{d\\xi}x_3 = ${paren(dn[0])}\\cdot ${f(nodeX[0], 3)}+${paren(dn[1])}\\cdot ${f(nodeX[1], 3)}+${paren(dn[2])}\\cdot ${f(nodeX[2], 3)} = ${f(j, 5)}\\text{ m}`,
    `J^{-1} = \\frac{1}{J} = \\frac{1}{${f(j, 5)}} = ${f(invJ, 5)}`,
  ];
}

function dNdx(dn: readonly [number, number, number], invJ: number): readonly [number, number, number] {
  return [dn[0] * invJ, dn[1] * invJ, dn[2] * invJ];
}

function dNdxTex(dn: readonly [number, number, number], invJ: number): readonly string[] {
  const d = dNdx(dn, invJ);
  return [
    `\\frac{dN_1}{dx} = \\frac{dN_1}{d\\xi}\\cdot J^{-1} = ${paren(dn[0])}\\cdot ${f(invJ, 5)} = ${f(d[0])}`,
    `\\frac{dN_2}{dx} = \\frac{dN_2}{d\\xi}\\cdot J^{-1} = ${paren(dn[1])}\\cdot ${f(invJ, 5)} = ${f(d[1])}`,
    `\\frac{dN_3}{dx} = \\frac{dN_3}{d\\xi}\\cdot J^{-1} = ${paren(dn[2])}\\cdot ${f(invJ, 5)} = ${f(d[2])}`,
  ];
}

/** A hajlítási (κ-sort adó) Gauss-pont TELJES, behelyettesített levezetése — LaTeX sorok. */
export function bendingGaussTex(gp: GaussStepDetail, index: number, ei: number): readonly string[] {
  const factor = ei * gp.jacobian.detJ * gp.w;
  const b = gp.bRows.kappa;
  return [
    `\\text{Gauss-pont } B_{${index + 1}}:\\ \\xi=${f(gp.xi)},\\ w=${f(gp.w)}`,
    ...shapeFunctionTex(gp.xi, gp.n),
    ...shapeDerivativeTex(gp.xi, gp.dn),
    ...dNdxTex(gp.dn, gp.jacobian.invJ),
    `B_\\kappa = [0,\\ \\tfrac{dN_1}{dx},\\ 0,\\ \\tfrac{dN_2}{dx},\\ 0,\\ \\tfrac{dN_3}{dx}] = [${f(b[0] ?? 0, 3)},\\ ${f(b[1] ?? 0, 3)},\\ ${f(b[2] ?? 0, 3)},\\ ${f(b[3] ?? 0, 3)},\\ ${f(b[4] ?? 0, 3)},\\ ${f(b[5] ?? 0, 3)}]`,
    `EI\\cdot|J|\\cdot w = ${f(ei, 1)}\\cdot ${f(gp.jacobian.detJ, 5)}\\cdot ${f(gp.w, 4)} = ${f(factor, 2)}`,
  ];
}

/** A nyírási (γ-sort adó) Gauss-pont TELJES, behelyettesített levezetése — LaTeX sorok. */
export function shearGaussTex(gp: GaussStepDetail, index: number, gas: number): readonly string[] {
  const factor = gas * gp.jacobian.detJ * gp.w;
  const b = gp.bRows.gamma;
  return [
    `\\text{Gauss-pont } Ny_{${index + 1}}:\\ \\xi=${f(gp.xi)},\\ w=${f(gp.w)}`,
    ...shapeFunctionTex(gp.xi, gp.n),
    ...shapeDerivativeTex(gp.xi, gp.dn),
    ...dNdxTex(gp.dn, gp.jacobian.invJ),
    `B_\\gamma = [-\\tfrac{dN_1}{dx},\\ N_1,\\ -\\tfrac{dN_2}{dx},\\ N_2,\\ -\\tfrac{dN_3}{dx},\\ N_3] = [${f(b[0] ?? 0, 3)},\\ ${f(b[1] ?? 0, 3)},\\ ${f(b[2] ?? 0, 3)},\\ ${f(b[3] ?? 0, 3)},\\ ${f(b[4] ?? 0, 3)},\\ ${f(b[5] ?? 0, 3)}]`,
    `GA_s\\cdot|J|\\cdot w = ${f(gas, 1)}\\cdot ${f(gp.jacobian.detJ, 5)}\\cdot ${f(gp.w, 4)} = ${f(factor, 2)}`,
  ];
}

/** A Kₑ[φ₁,φ₁] főátló-elem tagonkénti, LaTeX-ben kiírt összegzése. */
export function keDiagonalTex(
  bendingPoints: readonly GaussStepDetail[],
  shearPoints: readonly GaussStepDetail[],
  ei: number,
  gas: number,
  keValue: number,
  dofIndex = 1,
): readonly string[] {
  const bendingTerms = bendingPoints.map((gp, i) => {
    const b = gp.bRows.kappa[dofIndex] ?? 0;
    const factor = ei * gp.jacobian.detJ * gp.w;
    return { label: `B_{${i + 1}}`, b, factor, term: factor * b * b };
  });
  const shearTerms = shearPoints.map((gp, i) => {
    const b = gp.bRows.gamma[dofIndex] ?? 0;
    const factor = gas * gp.jacobian.detJ * gp.w;
    return { label: `Ny_{${i + 1}}`, b, factor, term: factor * b * b };
  });
  const total = [...bendingTerms, ...shearTerms].reduce((s, t) => s + t.term, 0);
  return [
    `K_e[\\varphi_1,\\varphi_1] = \\sum\\left(EI\\cdot|J|\\cdot w\\cdot B_\\kappa[1]^2\\right) + \\sum\\left(GA_s\\cdot|J|\\cdot w\\cdot B_\\gamma[1]^2\\right)`,
    ...[...bendingTerms, ...shearTerms].map(
      (t) => `${t.label}:\\quad ${f(t.factor, 2)}\\cdot(${paren(t.b, 3)})^2 = ${f(t.term, 2)}`,
    ),
    `\\sum = ${f(total, 2)}\\quad (K_e[1,1]\\text{ a végső mátrixban}: ${f(keValue, 2)})`,
  ];
}

/**
 * Egy tömegmátrix Gauss-pont TELJES, behelyettesített levezetése (ADR-0016)
 * — a `bendingGaussTex`/`shearGaussTex` mintáját követi, de a w/φ DOF-
 * helyekre szórt alakfüggvény-sorokra (`nRows`), nem a deriváltakra épül,
 * és mindkét tagot (transzlációs m', forgási tehetetlenség m'ᵩ) kiírja.
 */
export function massGaussTex(
  gp: MassGaussStepDetail,
  index: number,
  massPerLength: number,
  rotaryInertiaPerLength: number,
): readonly string[] {
  const wFactor = massPerLength * gp.jacobian.detJ * gp.w;
  const phiFactor = rotaryInertiaPerLength * gp.jacobian.detJ * gp.w;
  const nw = gp.nRows.w;
  const nphi = gp.nRows.phi;
  return [
    `\\text{Gauss-pont } T_{${index + 1}}:\\ \\xi=${f(gp.xi)},\\ w=${f(gp.w)}`,
    ...shapeFunctionTex(gp.xi, gp.n),
    `N_w = [N_1,\\ 0,\\ N_2,\\ 0,\\ N_3,\\ 0] = [${f(nw[0] ?? 0, 3)},\\ ${f(nw[1] ?? 0, 3)},\\ ${f(nw[2] ?? 0, 3)},\\ ${f(nw[3] ?? 0, 3)},\\ ${f(nw[4] ?? 0, 3)},\\ ${f(nw[5] ?? 0, 3)}]`,
    `N_\\varphi = [0,\\ N_1,\\ 0,\\ N_2,\\ 0,\\ N_3] = [${f(nphi[0] ?? 0, 3)},\\ ${f(nphi[1] ?? 0, 3)},\\ ${f(nphi[2] ?? 0, 3)},\\ ${f(nphi[3] ?? 0, 3)},\\ ${f(nphi[4] ?? 0, 3)},\\ ${f(nphi[5] ?? 0, 3)}]`,
    `m'\\cdot|J|\\cdot w = ${f(massPerLength, 4)}\\cdot ${f(gp.jacobian.detJ, 5)}\\cdot ${f(gp.w, 4)} = ${f(wFactor, 5)}`,
    `m'_\\varphi\\cdot|J|\\cdot w = ${f(rotaryInertiaPerLength, 6)}\\cdot ${f(gp.jacobian.detJ, 5)}\\cdot ${f(gp.w, 4)} = ${f(phiFactor, 6)}`,
  ];
}

/**
 * A Mₑ[w₁,w₁] és Mₑ[φ₁,φ₁] főátló-elemek tagonkénti, LaTeX-ben kiírt
 * összegzése — a `keDiagonalTex` tömegmátrix-párja. A w és φ sor a
 * `nRows()` szerkezete miatt SOSEM csatolt (nincs kereszttag), ezért a két
 * főátló-elem KÜLÖN, egy-egy taglistából adódik össze (nem egyetlen közös
 * összegből, ellentétben a hajlítás+nyírás Kₑ-jével).
 */
export function massDiagonalTex(
  points: readonly MassGaussStepDetail[],
  massPerLength: number,
  rotaryInertiaPerLength: number,
  meWValue: number,
  mePhiValue: number,
): readonly string[] {
  const wTerms = points.map((gp, i) => {
    const n = gp.nRows.w[0] ?? 0;
    const factor = massPerLength * gp.jacobian.detJ * gp.w;
    return { label: `T_{${i + 1}}`, n, factor, term: factor * n * n };
  });
  const phiTerms = points.map((gp, i) => {
    const n = gp.nRows.phi[1] ?? 0;
    const factor = rotaryInertiaPerLength * gp.jacobian.detJ * gp.w;
    return { label: `T_{${i + 1}}`, n, factor, term: factor * n * n };
  });
  const wTotal = wTerms.reduce((s, t) => s + t.term, 0);
  const phiTotal = phiTerms.reduce((s, t) => s + t.term, 0);
  return [
    `M_e[w_1,w_1] = \\sum\\left(m'\\cdot|J|\\cdot w\\cdot N_w[1]^2\\right)`,
    ...wTerms.map((t) => `${t.label}:\\quad ${f(t.factor, 4)}\\cdot(${paren(t.n, 3)})^2 = ${f(t.term, 4)}`),
    `\\sum = ${f(wTotal, 4)}\\quad (M_e[1,1]\\text{ a végső mátrixban}: ${f(meWValue, 4)})`,
    `M_e[\\varphi_1,\\varphi_1] = \\sum\\left(m'_\\varphi\\cdot|J|\\cdot w\\cdot N_\\varphi[2]^2\\right)`,
    ...phiTerms.map((t) => `${t.label}:\\quad ${f(t.factor, 6)}\\cdot(${paren(t.n, 3)})^2 = ${f(t.term, 6)}`),
    `\\sum = ${f(phiTotal, 6)}\\quad (M_e[2,2]\\text{ a végső mátrixban}: ${f(mePhiValue, 6)})`,
  ];
}

/**
 * Egy megoszló teher/nyomaték/önsúly Gauss-pontjának TELJES, behelyettesített
 * levezetése (4.7 pont) — a `bendingGaussTex`/`shearGaussTex` mintáját követi:
 * a teher intenzitása az adott globális x-ben, majd a hozzájárulás a
 * tehervektorhoz `p(x)·|J|·w·ξ₁/₂·Nᵢ` alakban, minden i-re kiírva.
 */
export function distributedLoadGaussTex(gp: DistributedLoadGaussDetail, index: number, unit: string): readonly string[] {
  const factor = gp.detJ * gp.w * gp.xiHalf;
  return [
    `\\text{Gauss-pont } ${index + 1}:\\ \\xi=${f(gp.xi)},\\ w=${f(gp.w)},\\ x=${f(gp.x, 3)}\\ \\text{m}`,
    ...shapeFunctionTex(gp.xi, gp.n),
    `p(x) = ${f(gp.value, 3)}\\ ${unit}`,
    `|J|\\cdot w\\cdot \\xi_{1/2} = ${f(gp.detJ, 5)}\\cdot ${f(gp.w, 4)}\\cdot ${f(gp.xiHalf, 4)} = ${f(factor, 5)}`,
    `f_e^{(${index + 1})} = p(x)\\cdot|J|\\cdot w\\cdot\\xi_{1/2}\\cdot[N_1,N_2,N_3] = [${Array.from(gp.contribution)
      .map((v) => f(v, 4))
      .join(',\\ ')}]`,
  ];
}

/** Egy hőteher-Gauss-pont TELJES, behelyettesített levezetése (4.7 pont). */
export function thermalLoadGaussTex(gp: ThermalLoadGaussDetail, index: number, ei: number, kappa0: number): readonly string[] {
  return [
    `\\text{Gauss-pont } ${index + 1}:\\ \\xi=${f(gp.xi)},\\ w=${f(gp.w)}`,
    `EI\\cdot\\kappa_0\\cdot|J|\\cdot w = ${f(ei, 1)}\\cdot ${kappa0.toExponential(3)}\\cdot ${f(gp.detJ, 5)}\\cdot ${f(gp.w, 4)} = ${f(ei * kappa0 * gp.detJ * gp.w, 4)}`,
    `f_e^{(${index + 1})} = [${Array.from(gp.contribution)
      .map((v) => f(v, 4))
      .join(',\\ ')}]`,
  ];
}

/**
 * Egy Gauss-pont κ/γ → M/T visszaszámítása (5→6. pont híd) — LaTeX sorok.
 * Eddig csak a `DerivationView.tsx`-be volt beégetve — 2026-09-04-én
 * kiemelve ide, hogy a `.docx` export (`formulaOmml.ts`) is
 * újrahasználhassa.
 */
export function internalForceTex(
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
): readonly string[] {
  return [
    `\\text{Gauss-pont } ${index + 1}:\\ \\xi=${f(xi)},\\ x=${f(x, 3)}\\ \\text{m}`,
    `\\kappa = B_\\kappa\\cdot u_e = [${Array.from(bKappa).map((v) => f(v, 3)).join(',\\ ')}]\\cdot u_e = ${kappa.toExponential(3)}\\ \\tfrac{1}{\\text{m}}`,
    `\\gamma = B_\\gamma\\cdot u_e = [${Array.from(bGamma).map((v) => f(v, 3)).join(',\\ ')}]\\cdot u_e = ${gamma.toExponential(3)}`,
    `M = EI\\cdot(\\kappa-\\kappa_0) = ${f(ei, 1)}\\cdot(${kappa.toExponential(3)}-${kappa0.toExponential(3)}) = ${f(m, 3)}\\ \\text{kNm}`,
    `T = GA_s\\cdot\\gamma = ${f(gas, 1)}\\cdot ${gamma.toExponential(3)} = ${f(t, 3)}\\ \\text{kN}`,
  ];
}

/** Egy közvetlen csomóponti teher elhelyezése (nincs integrálás) — 4.7 pont. */
export function nodalLoadTex(localNode: 0 | 1 | 2, dofOffset: 0 | 1, value: number, unit: string): readonly string[] {
  const dofIndex = 2 * localNode + dofOffset;
  const rowName = dofOffset === 0 ? 'w' : '\\varphi';
  return [
    `\\text{Csomópont } ${localNode + 1}\\ (${rowName}\\text{-sor}):\\quad f_e[${dofIndex + 1}] = ${f(value, 3)}\\ ${unit}\\quad\\text{(nincs integrálás, közvetlen elhelyezés)}`,
  ];
}

/**
 * Gauss-ponti értékek másodfokú (Lagrange-) extrapolációja egy csomópontba
 * (6.2/6.3 pont, Diplomaterv 3.1.7.4) — a `fem-core` `lagrangeAt`-tal
 * MATEMATIKAILAG megegyező súlyokat számol újra (nem hívja magát a
 * függvényt, mert az egyetlen skalárt ad vissza, itt viszont a súlyokat
 * KÜLÖN is ki kell írni), majd behelyettesítve mutatja az összeget.
 */
export function extrapolationTex(
  label: string,
  values: readonly [number, number, number],
  xis: readonly [number, number, number],
  targetXi: -1 | 0 | 1,
  targetLabel: string,
  unit: string,
): readonly string[] {
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
  const weightLines = weights.map((w, i) => {
    const others = [0, 1, 2].filter((j) => j !== i);
    const [j1, j2] = others as [number, number];
    return `L_${i + 1}(${targetXi}) = \\frac{(${targetXi}-\\xi_${j1 + 1})(${targetXi}-\\xi_${j2 + 1})}{(\\xi_${i + 1}-\\xi_${j1 + 1})(\\xi_${i + 1}-\\xi_${j2 + 1})} = \\frac{(${f(targetXi - (xis[j1] ?? 0))})(${f(targetXi - (xis[j2] ?? 0))})}{(${f((xis[i] ?? 0) - (xis[j1] ?? 0))})(${f((xis[i] ?? 0) - (xis[j2] ?? 0))})} = ${f(w, 4)}`;
  });
  return [
    `${label}(${targetLabel}) = \\sum_{i=1}^{3} L_i(${targetXi})\\cdot ${label}_i`,
    ...weightLines,
    `${label}(${targetLabel}) = ${weights.map((w, i) => `${f(w, 4)}\\cdot(${f(values[i] ?? 0, 3)})`).join(' + ')} = ${f(result, 3)}\\ ${unit}`,
  ];
}

/**
 * A konvergencia-mérőszám (Diplomaterv 3.4.2.1/6. lépés, "CONUND"),
 * behelyettesítve — a 7. pont teherlépcsőnkénti naplójának egy konkrét
 * sorát bontja ki: 100·‖ψ‖/‖f‖ ≤ Tolerancia.
 */
export function convergenceTex(psiNorm: number, fNorm: number, residualPercent: number, tolerancePercent: number, converged: boolean): readonly string[] {
  return [
    `100\\cdot\\frac{\\lVert\\psi\\rVert}{\\lVert f\\rVert} = 100\\cdot\\frac{${psiNorm.toExponential(3)}}{${fNorm.toExponential(3)}} = ${f(residualPercent, 4)}\\%`,
    `${f(residualPercent, 4)}\\%\\ ${converged ? '\\le' : '>'}\\ ${f(tolerancePercent, 4)}\\%\\ (\\text{Tolerancia})\\quad\\Rightarrow\\quad\\text{${converged ? 'KONVERGÁLT' : 'további iteráció szükséges'}}`,
  ];
}

/** A rétegelt A és I összegzése — LaTeX sorok. */
export function layerSumTex(aCm2: number, iCm4: number): readonly string[] {
  return [
    `A = \\sum b_l\\cdot t_l = ${f(aCm2, 2)}\\ \\text{cm}^2`,
    `I = \\sum b_l\\cdot z_l^2\\cdot t_l = ${f(iCm4, 0)}\\ \\text{cm}^4`,
  ];
}

/** A Mₑ/Mₚ/c behelyettesített levezetése — LaTeX sorok. */
export function meMpTex(sigmaY: number, we: number, wp: number, me: number, mp: number, c: number): readonly string[] {
  return [
    `M_e = \\sigma_Y\\cdot W_e = ${f(sigmaY, 2)}\\ \\tfrac{\\text{kN}}{\\text{cm}^2}\\cdot ${f(we, 1)}\\ \\text{cm}^3 = ${f(me, 2)}\\ \\text{kNm}`,
    `M_p = \\sigma_Y\\cdot W_p = ${f(sigmaY, 2)}\\ \\tfrac{\\text{kN}}{\\text{cm}^2}\\cdot ${f(wp, 1)}\\ \\text{cm}^3 = ${f(mp, 2)}\\ \\text{kNm}`,
    `c = \\frac{M_p}{M_e} = \\frac{${f(mp, 2)}}{${f(me, 2)}} = ${f(c, 3)}`,
  ];
}

/** Egy réteg-visszavetítés (P15/A 7. pont) TELJES, behelyettesített LaTeX-képlete. */
export function plasticLayerTex(row: PlasticLayerRow): readonly string[] {
  const { layerIndex, zMm, derived } = row;
  const currentLimit = derived.sigmaY + derived.hPrime * derived.prevState.epsPEff;
  const branch =
    derived.step.r > 0 && derived.step.r < 1
      ? '\\text{Átlépi a folyási határt}'
      : derived.step.state.yielded
        ? '\\text{Már megfolyt, terhelés folytatódik}'
        : '\\text{Rugalmas marad}';
  return [
    `\\text{${layerIndex + 1}. réteg}\\ (z = ${f(zMm, 1)}\\text{ mm})`,
    `\\Delta\\varepsilon = \\Delta\\kappa\\cdot z = ${derived.dKappa.toExponential(3)}\\cdot ${f(zMm * 1e-3, 4)} = ${derived.dEps.toExponential(3)}`,
    `\\sigma_{trial} = \\sigma_{r-1}+E\\Delta\\varepsilon = ${f(derived.prevState.sigma * 1e-4, 3)}+${f(derived.e * 1e-4, 0)}\\cdot ${derived.dEps.toExponential(3)} = ${f(derived.sigmaTrial * 1e-4, 3)}\\ \\tfrac{\\text{kN}}{\\text{cm}^2}`,
    `\\sigma_Y+H'\\varepsilon_{p,r-1} = ${f(derived.sigmaY * 1e-4, 3)}+${f(derived.hPrime * 1e-4, 3)}\\cdot ${derived.prevState.epsPEff.toExponential(3)} = ${f(currentLimit * 1e-4, 3)}\\ \\tfrac{\\text{kN}}{\\text{cm}^2}`,
    `${branch} \\Rightarrow R = ${f(derived.step.r, 3)}`,
    `\\sigma_{new} = \\pm(\\sigma_Y+H'\\varepsilon_p^{new}) = ${f(derived.step.sigma * 1e-4, 3)}\\ \\tfrac{\\text{kN}}{\\text{cm}^2}\\ (${derived.step.state.yielded ? '\\text{folyva}' : '\\text{rugalmas}'})`,
  ];
}
