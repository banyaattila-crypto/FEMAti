/**
 * V-12 — Konvergencia-tanulmány: h-finomítás (MASTER-PROMPT-TERV 3.1 táblázat).
 *
 * A kéttámaszú, egyenletesen megoszló teherrel terhelt tartó (V-02 esete)
 * elmozdulásmezőjének CSOMÓPONTI értékei — meglepő, de igazolt módon — gépi
 * pontossággal EGZAKTAK maradnak minden hálósűrűségnél (ez a kvadratikus
 * Timoshenko-elem egy ismert szuperkonvergencia-tulajdonsága állandó
 * megoszló teherre: a csomóponti válasz a Galjorkin-módszer miatt egzakt,
 * annak ellenére, hogy az elem alakfüggvénye csak másodfokú, a valódi
 * lehajlásfüggvény pedig negyedfokú). Emiatt a KONVERGENCIA-tanulmányhoz a
 * mezőt egy FIX FIZIKAI (nem csomóponti) helyen kell mintavételezni — a
 * `shapeFunctions`-szel interpolált érték ezen a helyen MÁR NEM egzakt, és
 * a hibája a hálófinomítással a várt rendben csökken.
 *
 * Zárt alak (kézi levezetés, ellenőrizve az x=L/2 helyen a már tesztelt
 * w_max = 5qL⁴/(384EI) + qL²/(8GAs) képlettel):
 *   w(x) = q·(x⁴−2Lx³+L³x)/(24EI) + q·x·(L−x)/(2GAs)
 */
import {
  buildModel,
  distributedForce,
  makeMaterial,
  makeSection,
  pinned,
  rect,
  shapeFunctions,
  solveLinear,
  uniformMesh,
  type LinearResult,
  type Model,
} from '@femati/fem-core';
import type { ValidationCase } from '../types.js';

/** Legkisebb négyzetek szerinti egyenes-illesztés meredeksége (y = a·x + b). */
function leastSquaresSlope(xs: readonly number[], ys: readonly number[]): number {
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] ?? 0) - meanX;
    numerator += dx * ((ys[i] ?? 0) - meanY);
    denominator += dx * dx;
  }
  return numerator / denominator;
}

/** A FE lehajlásmező interpolálása egy tetszőleges (nem feltétlenül csomóponti) x helyen. */
function interpolateW(model: Model, result: LinearResult, x0: number): number {
  const xOf = new Map(model.nodes.map((n) => [n.id as string, n.x as number]));
  const wOf = new Map(result.nodes.map((n) => [n.nodeId as string, n.w]));

  for (const element of model.elements) {
    const [n1, n2, n3] = element.nodes;
    const x1 = xOf.get(n1 as string) ?? 0;
    const x3 = xOf.get(n3 as string) ?? 0;
    const lo = Math.min(x1, x3);
    const hi = Math.max(x1, x3);
    if (x0 < lo - 1e-9 || x0 > hi + 1e-9) continue;

    const xMid = (x1 + x3) / 2;
    const halfLength = (x3 - x1) / 2;
    const xi = halfLength !== 0 ? (x0 - xMid) / halfLength : 0;
    const { n } = shapeFunctions(xi);
    const w1 = wOf.get(n1 as string) ?? 0;
    const w2 = wOf.get(n2 as string) ?? 0;
    const w3 = wOf.get(n3 as string) ?? 0;
    return n[0] * w1 + n[1] * w2 + n[2] * w3;
  }
  throw new Error(`V-12: x=${x0} nem esik egyetlen elem tartományába sem.`);
}

export function caseV12(): ValidationCase {
  const E = 2.1e8;
  const nu = 0.3;
  const G = E / (2 * (1 + nu));
  const b = 0.2;
  const h = 0.4;
  const area = b * h;
  const inertia = (b * h ** 3) / 12;
  const ei = E * inertia;
  const gas = (5 / 6) * G * area;

  const L = 6;
  const q = -8;
  const x0 = 3.7; // fix fizikai hely, szándékosan NEM esik egybe csomóponttal egyik hálónál sem
  const wExact = (x: number): number => (q * (x ** 4 - 2 * L * x ** 3 + L ** 3 * x)) / (24 * ei) + (q * x * (L - x)) / (2 * gas);
  const wRef = wExact(x0);

  const material = makeMaterial('S235', 'Acél S235', { e: E, sigmaY: 2.35e5 });
  const section = makeSection('R', 'Téglalap', rect(b, h));

  const elementCounts = [8, 16, 32, 64];
  const logH: number[] = [];
  const logError: number[] = [];
  const points: { n: number; error: number }[] = [];

  for (const n of elementCounts) {
    const mesh = uniformMesh(L, n, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [material],
      sections: [section],
      boundaries: [pinned('N0'), pinned(`N${mesh.nodes.length - 1}`)],
      loads: [distributedForce(0, L, q, q, 'Q1')],
    });
    const result = solveLinear(model);
    const wAt = interpolateW(model, result, x0);

    const error = Math.abs(wAt - wRef);
    points.push({ n, error });
    logH.push(Math.log(L / n));
    logError.push(Math.log(error));
  }

  const slope = leastSquaresSlope(logH, logError);

  return {
    id: 'V-12',
    title: 'Konvergencia-tanulmány: h-finomítás',
    description:
      `Az elmozdulásmező (nem csomóponti, fix x=${x0} m helyen interpolált) hibájának ` +
      `log–log meredeksége (konvergencia-rendje) 2.8 és 3.2 közé esik. ` +
      `Mérési pontok: ${points.map((p) => `n=${p.n}: hiba=${p.error.toExponential(3)}`).join(', ')}.`,
    reference: 'Diplomaterv 3.1.7.4, 46. oldal (extrapoláció alapja); MASTER-PROMPT-TERV 3.1 táblázat',
    checks: [
      {
        label: 'log–log meredekség (konvergencia-rend)',
        reference: 3,
        computed: slope,
        tolerance: 0,
        kind: 'range',
        range: { min: 2.8, max: 3.2 },
      },
    ],
  };
}
