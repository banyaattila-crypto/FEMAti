import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  DOF_PER_ELEMENT,
  GAUSS_2,
  GAUSS_3,
  NODE_XI,
  bMatrix,
  bRows,
  elementLength,
  elementStiffness,
  gaussRule,
  internalForces,
  interpolate,
  jacobian,
  nRows,
  quadratureFor,
  rigidBodyModes,
  shapeDerivativesX,
  shapeFunctions,
  strains,
  type SectionStiffness,
} from '../src/index.js';
import { DegenerateElementError } from '../src/linalg/errors.js';
import { norm2 } from '../src/linalg/dense.js';

const xi3 = GAUSS_3.map((g) => g.xi);

/**
 * Relatív eltérés ellenőrzése — docs/HIBATURESI-POLITIKA.md 7.3:
 * abszolút hibát relatív helyett használni tilos, mert a küszöb jelentése
 * a mennyiség nagyságrendjével együtt változik.
 */
function expectRelative(actual: number, expected: number, tol: number): void {
  const denom = Math.abs(expected) > 0 ? Math.abs(expected) : 1;
  expect(Math.abs(actual - expected) / denom).toBeLessThan(tol);
}

/** Egyszerű merevség: EI = 1000 kNm², GAs = 50000 kN. */
const STIFF: SectionStiffness = {
  ei: 1000,
  gas: 50000,
  area: 0.08,
  inertia: 1.0667e-3,
  height: 0.4,
  elasticModulus: 5.333e-3,
  plasticModulus: 8e-3,
  shapeFactor: 1.5,
};

const uniformNodes = (l: number, x0 = 0): readonly [number, number, number] => [x0, x0 + l / 2, x0 + l];

// ─── Alakfüggvények ───────────────────────────────────────────────────────────

describe('alakfüggvények (Diplomaterv 3.3)', () => {
  it('Kronecker-tulajdonság: Nᵢ(ξⱼ) = δᵢⱼ', () => {
    for (const [j, xj] of NODE_XI.entries()) {
      const { n } = shapeFunctions(xj);
      for (let i = 0; i < 3; i++) {
        expect(n[i]).toBeCloseTo(i === j ? 1 : 0, 14);
      }
    }
  });

  it('partíció: ΣNᵢ(ξ) = 1 minden ξ-re (property)', () => {
    fc.assert(
      fc.property(fc.double({ min: -1, max: 1, noNaN: true }), (xi) => {
        const { n } = shapeFunctions(xi);
        expect(n[0] + n[1] + n[2]).toBeCloseTo(1, 14);
      }),
    );
  });

  it('a deriváltak összege zérus (a partíció következménye)', () => {
    fc.assert(
      fc.property(fc.double({ min: -1, max: 1, noNaN: true }), (xi) => {
        const { dn } = shapeFunctions(xi);
        expect(dn[0] + dn[1] + dn[2]).toBeCloseTo(0, 14);
      }),
    );
  });

  it('a deriváltak a véges differenciával egyeznek', () => {
    const h = 1e-6;
    for (const xi of [-0.7, -0.3, 0, 0.4, 0.9]) {
      const plus = shapeFunctions(xi + h).n;
      const minus = shapeFunctions(xi - h).n;
      const { dn } = shapeFunctions(xi);
      for (let i = 0; i < 3; i++) {
        expect((plus[i] - minus[i]) / (2 * h)).toBeCloseTo(dn[i], 7);
      }
    }
  });

  it('lineáris függvényt egzaktul interpolál', () => {
    // f(ξ) = 3 + 2ξ  →  a csomóponti értékek: 1, 3, 5
    for (const xi of [-0.9, -0.2, 0.5, 1]) {
      expect(interpolate([1, 3, 5], xi)).toBeCloseTo(3 + 2 * xi, 14);
    }
  });

  it('másodfokú függvényt egzaktul interpolál', () => {
    // f(ξ) = ξ²  →  a csomóponti értékek: 1, 0, 1
    for (const xi of [-0.8, -0.1, 0.6]) {
      expect(interpolate([1, 0, 1], xi)).toBeCloseTo(xi * xi, 14);
    }
  });
});

// ─── Kvadratúra ───────────────────────────────────────────────────────────────

describe('Gauss-kvadratúra (Diplomaterv 1. táblázat)', () => {
  it('a 3 pontos szabály a diplomaterv értékeit adja', () => {
    expect(GAUSS_3[0]?.xi).toBeCloseTo(-Math.sqrt(0.6), 14);
    expect(GAUSS_3[0]?.w).toBeCloseTo(5 / 9, 14);
    expect(GAUSS_3[1]?.xi).toBe(0);
    expect(GAUSS_3[1]?.w).toBeCloseTo(8 / 9, 14);
  });

  it('a súlyok összege 2 (az intervallum hossza)', () => {
    for (const n of [1, 2, 3] as const) {
      const sum = gaussRule(n).reduce((s, g) => s + g.w, 0);
      expect(sum).toBeCloseTo(2, 14);
    }
  });

  it('a 2 pontos szabály 3. fokú polinomot egzaktul integrál', () => {
    // ∫₋₁¹ (1 + 2ξ + 3ξ² + 4ξ³) dξ = 2 + 0 + 2 + 0 = 4
    const f = (x: number): number => 1 + 2 * x + 3 * x * x + 4 * x ** 3;
    const sum = GAUSS_2.reduce((s, g) => s + g.w * f(g.xi), 0);
    expect(sum).toBeCloseTo(4, 14);
  });

  it('a 3 pontos szabály 5. fokú polinomot egzaktul integrál', () => {
    // ∫₋₁¹ ξ⁴ dξ = 2/5
    const sum = GAUSS_3.reduce((s, g) => s + g.w * g.xi ** 4, 0);
    expect(sum).toBeCloseTo(0.4, 14);
  });

  it('a 2 pontos szabály NEM egzakt 4. fokra (ezért redukált)', () => {
    const sum = GAUSS_2.reduce((s, g) => s + g.w * g.xi ** 4, 0);
    expect(Math.abs(sum - 0.4)).toBeGreaterThan(1e-3);
  });

  it('a szelektív séma a nyírásra kevesebb pontot használ', () => {
    const sel = quadratureFor('selective');
    const full = quadratureFor('full');
    expect(sel.bending).toHaveLength(3);
    expect(sel.shear).toHaveLength(2);
    expect(full.shear).toHaveLength(3);
  });
});

// ─── Jacobi ───────────────────────────────────────────────────────────────────

describe('Jacobi-mátrix (Diplomaterv 3.7–3.9)', () => {
  it('egyenközű csomópontoknál |J| = Lₑ/2 és független ξ-től', () => {
    const nodes = uniformNodes(4);
    for (const xi of [-1, -0.5, 0, 0.5, 1]) {
      expect(jacobian(nodes, xi).detJ).toBeCloseTo(2, 12);
    }
  });

  it('eltolt elemre is a hossz fele', () => {
    expect(jacobian(uniformNodes(3, 10), 0).detJ).toBeCloseTo(1.5, 12);
  });

  it('a globális koordináta a csomópontokban visszaadja a csomópontot', () => {
    const nodes = uniformNodes(6, 2);
    expect(jacobian(nodes, -1).x).toBeCloseTo(2, 12);
    expect(jacobian(nodes, 0).x).toBeCloseTo(5, 12);
    expect(jacobian(nodes, 1).x).toBeCloseTo(8, 12);
  });

  it('J⁻¹ · J = 1', () => {
    const j = jacobian(uniformNodes(7), 0.3);
    expect(j.invJ * j.j).toBeCloseTo(1, 14);
  });

  it('eltolt középső csomópontnál a Jacobi ξ-függő', () => {
    const skewed: readonly [number, number, number] = [0, 1.2, 4];
    const a = jacobian(skewed, -0.9).detJ;
    const b = jacobian(skewed, 0.9).detJ;
    expect(Math.abs(a - b)).toBeGreaterThan(0.1);
  });

  it('a leképezés megfordíthatatlanságát elkapja (|J| ≤ 0)', () => {
    // A középső csomópont az elem BAL vége elé kerül → J előjelet vált.
    const bad: readonly [number, number, number] = [0, -3, 4];
    expect(() => jacobian(bad, -1, 'E7')).toThrow(DegenerateElementError);
    try {
      jacobian(bad, -1, 'E7');
    } catch (e) {
      expect((e as DegenerateElementError).elementId).toBe('E7');
      expect((e as Error).message).toContain('nem megfordítható');
    }
  });

  it('az elemhossz a szélső csomópontok távolsága', () => {
    expect(elementLength([2, 3.5, 5])).toBeCloseTo(3, 14);
  });

  it('a globális deriváltak a láncszabályt követik (3.13)', () => {
    const nodes = uniformNodes(4);
    const { dNdx, jac } = shapeDerivativesX(nodes, 0.5);
    const { dn } = shapeFunctions(0.5);
    for (let i = 0; i < 3; i++) {
      expect(dNdx[i]).toBeCloseTo(dn[i] / jac.j, 15);
    }
  });
});

// ─── B mátrix ─────────────────────────────────────────────────────────────────

describe('B mátrix (Diplomaterv 3.14)', () => {
  it('mérete 2×6, a rögzített DOF-sorrenddel', () => {
    const b = bMatrix(uniformNodes(4), 0);
    expect(b.rows).toBe(2);
    expect(b.cols).toBe(DOF_PER_ELEMENT);
  });

  it('a görbület sora csak a φ szabadságfokokra hat', () => {
    const { kappa } = bRows(uniformNodes(4), 0.3);
    // w szabadságfokok: 0, 2, 4 — mind zérus
    expect(kappa[0]).toBe(0);
    expect(kappa[2]).toBe(0);
    expect(kappa[4]).toBe(0);
    // φ szabadságfokok: 1, 3, 5 — nem mind zérus
    expect(Math.abs(kappa[1]) + Math.abs(kappa[3]) + Math.abs(kappa[5])).toBeGreaterThan(0);
  });

  it('degenerált (megfordíthatatlan) elemre bRows is DegenerateElementError-t dob — saját ág, nem csak jacobian()-é', () => {
    const bad: readonly [number, number, number] = [0, -3, 4];
    expect(() => bRows(bad, -1, 'E8')).toThrow(DegenerateElementError);
  });

  it('degenerált elemre nRows is DegenerateElementError-t dob (a tömegmátrix alakfüggvény-soraihoz)', () => {
    const bad: readonly [number, number, number] = [0, -3, 4];
    expect(() => nRows(bad, -1, 'E9')).toThrow(DegenerateElementError);
  });

  it('a nyírási sor a konvenciót követi: γ = φ − dw/dx', () => {
    const nodes = uniformNodes(4);
    const xi = 0.25;
    const { gamma } = bRows(nodes, xi);
    const { dNdx } = shapeDerivativesX(nodes, xi);
    const { n } = shapeFunctions(xi);
    for (let i = 0; i < 3; i++) {
      expect(gamma[2 * i]).toBeCloseTo(-dNdx[i], 15); // −dNᵢ/dx a w-nél
      expect(gamma[2 * i + 1]).toBeCloseTo(n[i], 15); // +Nᵢ a φ-nél
    }
  });

  it('merev eltolásra mindkét alakváltozás zérus', () => {
    const nodes = uniformNodes(5);
    const u = Float64Array.from([1, 0, 1, 0, 1, 0]);
    for (const xi of xi3) {
      const s = strains(nodes, u, xi);
      expect(Math.abs(s.kappa)).toBeLessThan(1e-13);
      expect(Math.abs(s.gamma)).toBeLessThan(1e-13);
    }
  });

  it('merev elfordulásra mindkét alakváltozás zérus', () => {
    const nodes = uniformNodes(5);
    // w = x, φ = 1  →  κ = 0, γ = 1 − 1 = 0
    const u = Float64Array.from([nodes[0], 1, nodes[1], 1, nodes[2], 1]);
    for (const xi of xi3) {
      const s = strains(nodes, u, xi);
      expect(Math.abs(s.kappa)).toBeLessThan(1e-13);
      expect(Math.abs(s.gamma)).toBeLessThan(1e-12);
    }
  });

  it('V-03 patch test: konstans görbület egzaktul visszakapható', () => {
    const nodes = uniformNodes(6, 1);
    const kappa0 = 0.002;
    // Tiszta hajlítás: w = κ·x²/2, φ = κ·x  →  κ = const, γ = 0
    const u = Float64Array.from(nodes.flatMap((x) => [(kappa0 * x * x) / 2, kappa0 * x]));
    for (const xi of [-1, -0.6, 0, 0.4, 1]) {
      const s = strains(nodes, u, xi);
      expect(s.kappa).toBeCloseTo(kappa0, 12);
      expect(Math.abs(s.gamma)).toBeLessThan(1e-12);
    }
  });
});

// ─── Elemi merevségi mátrix ───────────────────────────────────────────────────

describe('elemi merevségi mátrix (Diplomaterv 3.24–3.26)', () => {
  const nodes = uniformNodes(4);

  it('mérete 6×6', () => {
    const k = elementStiffness({ nodeX: nodes, elementId: 'E0' }, STIFF);
    expect(k.rows).toBe(6);
    expect(k.cols).toBe(6);
  });

  it.each(['selective', 'full'] as const)('szimmetrikus (%s integrálás)', (scheme) => {
    const k = elementStiffness({ nodeX: nodes, elementId: 'E0' }, STIFF, scheme);
    expect(k.symmetryDefect() / k.maxAbs()).toBeLessThan(1e-14);
  });

  it.each(['selective', 'full'] as const)('merevtest-mozgásra zérus erő (%s)', (scheme) => {
    const k = elementStiffness({ nodeX: nodes, elementId: 'E0' }, STIFF, scheme);
    for (const mode of rigidBodyModes(nodes)) {
      const f = k.multiplyVector(mode);
      expect(norm2(f) / (k.maxAbs() * norm2(mode))).toBeLessThan(1e-13);
    }
  });

  it.each(['selective', 'full'] as const)('rangja pontosan 4 (%s)', (scheme) => {
    const k = elementStiffness({ nodeX: nodes, elementId: 'E0' }, STIFF, scheme);
    expect(k.rank()).toBe(4);
  });

  it('az átlós elemek pozitívak', () => {
    const k = elementStiffness({ nodeX: nodes, elementId: 'E0' }, STIFF);
    for (let i = 0; i < 6; i++) expect(k.get(i, i)).toBeGreaterThan(0);
  });

  it('a merevség lineárisan skálázódik EI-vel a tiszta hajlítási módusban', () => {
    const k1 = elementStiffness({ nodeX: nodes, elementId: 'E0' }, STIFF);
    const k2 = elementStiffness({ nodeX: nodes, elementId: 'E0' }, { ...STIFF, ei: STIFF.ei * 2, gas: STIFF.gas * 2 });
    // A Kₑ lineáris EI-ben és GAs-ban → a kétszerezés egzaktul kétszerez.
    for (let i = 0; i < 36; i++) expectRelative(k2.data[i], 2 * k1.data[i], 1e-14);
  });

  it('tiszta hajlítás alakváltozási energiája: ½·uᵀKu = ½·EI·κ²·L', () => {
    const l = 4;
    const nodesE = uniformNodes(l);
    const kappa0 = 0.001;
    const u = Float64Array.from(nodesE.flatMap((x) => [(kappa0 * x * x) / 2, kappa0 * x]));
    const k = elementStiffness({ nodeX: nodesE, elementId: 'E0' }, STIFF);

    const ku = k.multiplyVector(u);
    let energy = 0;
    for (let i = 0; i < 6; i++) energy += 0.5 * u[i] * (ku[i] ?? 0);

    // Tiszta hajlítás: az elem ezt egzaktul ábrázolja, ezért az energia
    // elvileg pontos. HIBATURESI-POLITIKA 1. pont → gépi pontosság.
    expectRelative(energy, 0.5 * STIFF.ei * kappa0 * kappa0 * l, 1e-13);
  });

  it('tiszta hajlítási tag: a hosszabb elem lágyabb, K ~ EI/L', () => {
    // A nyírást kikapcsolva a φ–φ átlós tag csak a hajlításból származik.
    const bendingOnly = { ...STIFF, gas: 0 };
    const short = elementStiffness({ nodeX: uniformNodes(2), elementId: 'A' }, bendingOnly);
    const long = elementStiffness({ nodeX: uniformNodes(4), elementId: 'B' }, bendingOnly);
    expect(short.get(1, 1)).toBeGreaterThan(long.get(1, 1));
    // A hossz kétszerezése felezi a hajlítási merevséget.
    expectRelative(short.get(1, 1) / long.get(1, 1), 2, 1e-13);
  });

  it('a φ szabadságfokhoz NYÍRÁSI merevség is tartozik, ami L-lel nő', () => {
    // Ez a Timoshenko-modell sajátossága: γ = φ − dw/dx miatt a φ megjelenik
    // a nyírási tagban is, ∫Nᵢ²·GAs·|J| dξ ~ GAs·L alakban. Ezért a teljes
    // φ–φ átlós elem hosszú elemnél NAGYOBB is lehet, mint rövidnél —
    // a klasszikus Euler–Bernoulli intuíció itt félrevezet.
    const shearOnly = { ...STIFF, ei: 0 };
    const short = elementStiffness({ nodeX: uniformNodes(2), elementId: 'A' }, shearOnly);
    const long = elementStiffness({ nodeX: uniformNodes(4), elementId: 'B' }, shearOnly);
    expect(long.get(1, 1)).toBeGreaterThan(short.get(1, 1));
    expectRelative(long.get(1, 1) / short.get(1, 1), 2, 1e-13);
  });

  /**
   * Tiszta nyírási módus: φ = 0, w = −γ₀·x  →  κ = 0, γ = γ₀ = konstans.
   * Az energia ekkor ½·GAs·γ₀²·L, és mivel γ konstans, MINDKÉT integrálási
   * sémának egzaktnak kell lennie.
   *
   * Ez a teszt egy mutációs próba nyomán született: a nyírási tagból elhagyott
   * Gauss-súly a szelektív sémánál láthatatlan (a 2 pontos szabály mindkét
   * súlya 1), a teljes sémánál viszont 1.5-szörös hibát okoz.
   */
  it.each(['selective', 'full'] as const)('tiszta nyírási energia: ½·GAs·γ²·L (%s integrálás)', (scheme) => {
    const l = 4;
    const nodesE = uniformNodes(l);
    const gamma0 = 0.002;
    const u = Float64Array.from(nodesE.flatMap((x) => [-gamma0 * x, 0]));
    const k = elementStiffness({ nodeX: nodesE, elementId: 'E0' }, STIFF, scheme);

    const ku = k.multiplyVector(u);
    let energy = 0;
    for (let i = 0; i < 6; i++) energy += 0.5 * u[i] * (ku[i] ?? 0);

    // γ konstans → bármely kvadratúra egzakt. Gépi pontosság jár.
    expectRelative(energy, 0.5 * STIFF.gas * gamma0 * gamma0 * l, 1e-13);
  });

  /**
   * A teljes integrálású séma nyírási tagja független numerikus referenciával:
   * összetett Simpson-szabály 400 osztással. A Bγᵢ·Bγⱼ integrandus legfeljebb
   * negyedfokú, ezért a 3 pontos Gauss egzakt — az egyezésnek gépi pontosságúnak
   * kell lennie.
   */
  it('a teljes séma nyírási tagja egyezik a sűrű numerikus integrállal', () => {
    const l = 4;
    const nodesE = uniformNodes(l);
    const gasOnly = { ...STIFF, ei: 0 };
    const k = elementStiffness({ nodeX: nodesE, elementId: 'E0' }, gasOnly, 'full');

    // Referencia: ∫₋₁¹ Bγᵀ·GAs·Bγ·|J| dξ összetett Simpson-szabállyal
    const n = 400; // páros
    const h = 2 / n;
    const ref = Array.from({ length: 6 }, () => new Float64Array(6));
    for (let s = 0; s <= n; s++) {
      const xi = -1 + s * h;
      const weight = s === 0 || s === n ? 1 : s % 2 === 1 ? 4 : 2;
      const { gamma, detJ } = bRows(nodesE, xi);
      const factor = ((weight * h) / 3) * STIFF.gas * detJ;
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          const row = ref[i];
          if (row) row[j] += factor * gamma[i] * gamma[j];
        }
      }
    }

    // A tűrést a Simpson-referencia saját hibája szabja meg (h⁴ ~ 6e-10 az
    // n = 400 osztásnál), nem a vizsgált kód pontossága. 1e-8 bőven elég
    // szoros: a hiányzó Gauss-súly 50%-os eltérést okozna.
    const scale = k.maxAbs();
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        expect(Math.abs(k.get(i, j) - (ref[i]?.[j] ?? 0)) / scale).toBeLessThan(1e-8);
      }
    }
  });

  it('a szelektív séma nyírási tagja SZÁNDÉKOSAN eltér a pontos integráltól', () => {
    // Ez a redukált integrálás lényege: a nyírási merevséget tudatosan
    // alulbecsüljük, hogy a záródás (shear locking) megszűnjön.
    const nodesE = uniformNodes(4);
    const gasOnly = { ...STIFF, ei: 0 };
    const exact = elementStiffness({ nodeX: nodesE, elementId: 'E' }, gasOnly, 'full');
    const reduced = elementStiffness({ nodeX: nodesE, elementId: 'E' }, gasOnly, 'selective');

    let maxDiff = 0;
    for (let i = 0; i < 36; i++) {
      maxDiff = Math.max(maxDiff, Math.abs(exact.data[i] - reduced.data[i]));
    }
    expect(maxDiff / exact.maxAbs()).toBeGreaterThan(0.01);

    // A redukált változat rangja kisebb — ez teszi „lágyabbá".
    expect(reduced.rank()).toBeLessThanOrEqual(exact.rank());
  });

  it('az igénybevételek a D·B·u szorzatból állnak elő', () => {
    const kappa0 = 0.0015;
    const u = Float64Array.from(nodes.flatMap((x) => [(kappa0 * x * x) / 2, kappa0 * x]));
    const f = internalForces({ nodeX: nodes, elementId: 'E0' }, STIFF, u, 0);
    expectRelative(f.kappa, kappa0, 1e-12);
    expectRelative(f.m, STIFF.ei * kappa0, 1e-12);
    // A tiszta hajlítási módusban γ = 0, ezért T-nek is zérusnak kell lennie.
    // Abszolút zérushoz relatív hiba nem értelmezhető: a GAs·γ szorzat
    // nagyságrendjéhez viszonyítunk.
    expect(Math.abs(f.t) / (STIFF.gas * kappa0)).toBeLessThan(1e-12);
  });
});

// ─── A záródás (shear locking) kimutatása ─────────────────────────────────────

describe('záródási jelenség — a szelektív integrálás indoklása', () => {
  /**
   * Egyetlen elemből álló konzol tiszta hajlításban. Karcsú gerendánál a
   * TELJES integrálás a nyírási tagot túlhangsúlyozza, és a merevség
   * elszáll — ez a diplomaterv 3.1.4 pontjában leírt „záródás".
   *
   * Mérőszám: a tiszta hajlítási módushoz tartozó energia viszonya a
   * pontos EI·κ²·L/2 értékhez. Szelektív integrálásnál 1, teljesnél nagyobb.
   */
  const energyRatio = (slenderness: number, scheme: 'selective' | 'full'): number => {
    const h = 0.4;
    const l = slenderness * h;
    const nodes = uniformNodes(l);
    const e = 2.1e8;
    const b = 0.2;
    const area = b * h;
    const inertia = (b * h ** 3) / 12;
    const stiff: SectionStiffness = {
      ei: e * inertia,
      gas: (5 / 6) * (e / 2.6) * area,
      area,
      inertia,
      height: h,
      elasticModulus: inertia / (h / 2),
      plasticModulus: (b * h * h) / 4,
      shapeFactor: 1.5,
    };

    const kappa0 = 1e-4;
    const u = Float64Array.from(nodes.flatMap((x) => [(kappa0 * x * x) / 2, kappa0 * x]));
    const k = elementStiffness({ nodeX: nodes, elementId: 'E' }, stiff, scheme);
    const ku = k.multiplyVector(u);
    let energy = 0;
    for (let i = 0; i < 6; i++) energy += 0.5 * u[i] * (ku[i] ?? 0);

    return energy / (0.5 * stiff.ei * kappa0 * kappa0 * l);
  };

  /**
   * Kondicionáltsághoz igazított korlát — HIBATURESI-POLITIKA 3. pont.
   *
   * A merevségi mátrix kondíciószáma karcsú gerendán ~ (L/h)²-tel nő, mert a
   * nyírási (GAs·L) és a hajlítási (EI/L) tag nagyságrendje szétválik. Az
   * energiaösszegzés kerekítési hibája ezzel arányosan halmozódik, ezért a
   * korlátot NEM rögzített számként adjuk meg, hanem a kondíciószámból
   * származtatva. A tényező (10·ε) mérésből származik, nem utólagos igazítás:
   * L/h = 100 mellett a mért hiba 3.2e-12, a korlát 2.2e-11.
   */
  const conditioningLimit = (slenderness: number): number => Math.max(1e-13, 10 * Number.EPSILON * slenderness ** 2);

  it.each([5, 20, 100])('szelektív integrálás L/h = %i mellett is pontos', (s) => {
    // A tiszta hajlítási módust az elem egzaktul ábrázolja: az arány pontosan 1,
    // a kondicionáltságból eredő kerekítésen belül.
    expectRelative(energyRatio(s, 'selective'), 1, conditioningLimit(s));
  });

  it('a kerekítési hiba a karcsúsággal nő — a kondíciószám hatása kimutatható', () => {
    const errors = [5, 20, 100].map((s) => Math.abs(energyRatio(s, 'selective') - 1));
    // Monoton növekvő: ez bizonyítja, hogy a maradék eltérés kondicionáltsági
    // eredetű, nem formulációs hiba (az utóbbi nem függne a karcsúságtól).
    expect(errors[1]).toBeGreaterThanOrEqual(errors[0] as number);
    expect(errors[2]).toBeGreaterThan(errors[1] as number);
    // ...és mindegyik a gépi pontosság nagyságrendjében marad.
    for (const e of errors) expect(e).toBeLessThan(1e-10);
  });

  it('a kvadratikus elem tiszta hajlításban teljes integrálással is pontos', () => {
    // A 3-csomópontú elem a tiszta hajlítási módust egzaktul ábrázolja
    // (w kvadratikus, φ lineáris), ezért γ = 0 minden integrálási pontban.
    // A záródás így NEM az energiában, hanem a megoldás konvergenciájában
    // jelentkezik — azt a V-04 validációs eset méri majd a P4 fázisban.
    expectRelative(energyRatio(100, 'full'), 1, conditioningLimit(100));
  });

  it('a két séma merevségi mátrixa ténylegesen különbözik', () => {
    const nodes = uniformNodes(4);
    const a = elementStiffness({ nodeX: nodes, elementId: 'E' }, STIFF, 'selective');
    const b = elementStiffness({ nodeX: nodes, elementId: 'E' }, STIFF, 'full');
    let diff = 0;
    for (let i = 0; i < 36; i++) diff = Math.max(diff, Math.abs(a.data[i] - b.data[i]));
    expect(diff / a.maxAbs()).toBeGreaterThan(1e-6);
  });
});
