/**
 * P-13 — Rétegszám-konvergencia, és a semleges tengely elmozdulása
 * aszimmetrikus szelvénynél (MASTER-PROMPT-TERV P10 prompt, "Elfogadás").
 *
 * 1) A teljesen képlékeny nyomatéki teherbírás (Mp) rétegszám-konvergenciája:
 *    a rétegelt modellel (nagy κ, minden réteg folyva) számított Mp
 *    monoton tart a zárt alakú M0 = σY·Kp értékhez (P-01/`plasticMomentCapacity`),
 *    és 64 rétegnél 1%-on belül van.
 *
 * 2) Semleges tengely elmozdulása: egy ASZIMMETRIKUS (eltérő szélességű öv-
 *    öv, "T-szerű") 3-blokkos keresztmetszetnél a RUGALMAS súlyponti tengely
 *    (z=0, ahol a rétegek z-koordinátája mérve van) NEM esik egybe a
 *    KÉPLÉKENY (egyenlő-terület) tengellyel — teljes képlékenyedésnél (N=0,
 *    tiszta hajlítás) a σ=±σY előjelváltásnak PONTOSAN az egyenlő-terület
 *    tengelynél kell lennie, nem a rugalmas súlypontnál. Az egyenlő-terület
 *    tengely helye zárt alakban (egyszerű terület-aritmetikával) számítható;
 *    ez a referencia. A teszt megmutatja, hogy ezen a tengelyen a rétegelt
 *    modellből számított axiális erő (N) közel nulla, míg a rugalmas
 *    súlyponton NEM az — ez maga a "tengely elmozdulásának" bizonyítéka.
 */
import { plasticMomentCapacity, generateLayers, geometricProperties, rect, updateLayerPlasticState, INITIAL_LAYER_PLASTIC_STATE } from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

interface Block {
  readonly b: number;
  readonly h: number;
}

interface RawLayer {
  readonly b: number;
  readonly t: number;
  readonly z: number;
}

/** Rétegzés generálása 3, egymásra épülő téglalap "blokkból" (alulról fölfelé), a blokk-halmaz súlypontjától mérve. */
function generateBlockLayers(blocks: readonly Block[], layersPerBlock: number): { layers: readonly RawLayer[]; centroidFromBottom: number } {
  let area = 0;
  let moment = 0; // Σ A·y (y alulról mérve)
  let yBottom = 0;
  for (const blk of blocks) {
    const a = blk.b * blk.h;
    const yMid = yBottom + blk.h / 2;
    area += a;
    moment += a * yMid;
    yBottom += blk.h;
  }
  const centroidFromBottom = moment / area;

  const layers: RawLayer[] = [];
  yBottom = 0;
  for (const blk of blocks) {
    const t = blk.h / layersPerBlock;
    for (let i = 0; i < layersPerBlock; i++) {
      const yMid = yBottom + i * t + t / 2;
      // z lefelé pozitív, a súlyponttól mérve — a súlypont FELETT (nagyobb y) negatív z.
      const z = centroidFromBottom - yMid;
      layers.push({ b: blk.b, t, z });
    }
    yBottom += blk.h;
  }
  return { layers, centroidFromBottom };
}

/** Axiális erő N(z0) = Σ sign(z_l − z0)·b_l·t_l·σY — teljesen képlékeny állapotban (minden réteg folyva). */
function axialForceAboutAxis(layers: readonly RawLayer[], z0: number, sigmaY: number): number {
  let n = 0;
  for (const l of layers) {
    const sign = l.z - z0 >= 0 ? 1 : -1;
    n += sign * l.b * l.t * sigmaY;
  }
  return n;
}

function caseP13Convergence(): readonly ValidationCheck[] {
  const e = 2.1e8;
  const sigmaY = 2.35e5;
  const shape = rect(0.2, 0.4);
  const closed = geometricProperties(shape);
  const m0 = plasticMomentCapacity(sigmaY, closed.plasticModulus);

  const layerCounts = [4, 8, 16, 32, 64];
  const kappaDeep = 100 * ((2 * sigmaY) / (e * 0.4)); // messze a folyás fölött — minden réteg folyva
  const mpValues = layerCounts.map((n) => {
    const layers = generateLayers(shape, n);
    let m = 0;
    for (const l of layers) {
      const s = updateLayerPlasticState(INITIAL_LAYER_PLASTIC_STATE, e, sigmaY, 0, kappaDeep * l.z).sigma;
      m += s * l.b * l.z * l.t;
    }
    return m;
  });

  const errors = mpValues.map((mp) => Math.abs(mp - m0) / m0);
  const checks: ValidationCheck[] = layerCounts.map((n, i) => ({
    label: `Mp (${n} réteg) → M0 zárt alak`,
    reference: m0,
    computed: mpValues[i] ?? Number.NaN,
    tolerance: n === 64 ? 0.01 : 0.1,
    kind: 'relative',
  }));

  // Téglalapnál a Kp (∫|z|dz, szakaszonként LINEÁRIS integrandus) középponti
  // Riemann-összege EGZAKT bármely rétegszámnál (ld. layeredSection.test.ts
  // "téglalap" esete) — ezért a hiba MÁR a legdurvább hálón is ~0. A "monoton
  // tart" elvárás ezért `≤`, nem szigorú `<`, hogy ezt a (helyes) egzakt
  // egyezést ne bukja el a teszt.
  const first = errors[0] ?? Number.POSITIVE_INFINITY;
  const last = errors[errors.length - 1] ?? Number.POSITIVE_INFINITY;
  checks.push({
    label: 'a hiba nem nő a legdurvábbtól a legfinomabb hálóig (konvergencia/egzaktság)',
    reference: 0,
    computed: last <= first + 1e-12 ? 0 : 1,
    tolerance: 0,
    kind: 'absolute',
  });

  return checks;
}

function caseP13NeutralAxisShift(): readonly ValidationCheck[] {
  const sigmaY = 2.35e5;
  // "T-szerű" 3-blokkos aszimmetrikus szelvény: SZÉLES alsó öv, keskeny felső öv.
  const blocks: readonly Block[] = [
    { b: 0.3, h: 0.05 }, // alsó öv
    { b: 0.02, h: 0.3 }, // gerinc
    { b: 0.1, h: 0.05 }, // felső öv
  ];
  const { layers, centroidFromBottom } = generateBlockLayers(blocks, 200);

  // Egyenlő-terület (képlékeny) tengely: az a magasság alulról, ahol a
  // kumulált terület eléri a teljes terület felét — zárt alakú, egyszerű
  // terület-aritmetikával (nem a rétegelt modellből, hanem FÜGGETLENÜL
  // számolva, mint referencia).
  const totalArea = blocks.reduce((s, blk) => s + blk.b * blk.h, 0);
  const halfArea = totalArea / 2;
  let cum = 0;
  let yPna = 0;
  let yBottom = 0;
  for (const blk of blocks) {
    const a = blk.b * blk.h;
    if (cum + a >= halfArea) {
      const remaining = halfArea - cum;
      yPna = yBottom + remaining / blk.b;
      break;
    }
    cum += a;
    yBottom += blk.h;
  }
  const zPna = centroidFromBottom - yPna;

  const nAtElasticCentroid = axialForceAboutAxis(layers, 0, sigmaY);
  const nAtPlasticAxis = axialForceAboutAxis(layers, zPna, sigmaY);

  const totalPlasticCapacity = totalArea * sigmaY;
  const elasticCentroidImbalanceRatio = Math.abs(nAtElasticCentroid) / totalPlasticCapacity;

  return [
    {
      label:
        'N(rugalmas súlypont, z=0)/N_max ERŐSEN nullától eltérő (legalább 10%, a tengely NEM ott van)',
      reference: elasticCentroidImbalanceRatio,
      computed: elasticCentroidImbalanceRatio,
      tolerance: 0,
      kind: 'range',
      range: { min: 0.1, max: 1 },
    },
    {
      label: 'N(egyenlő-terület tengely) ≈ 0 (a helyes képlékeny semleges tengely)',
      reference: 0,
      computed: nAtPlasticAxis,
      // Diszkretizációs maradék (véges rétegvastagság) — abszolút tűrés a
      // legvékonyabb réteg teherbírásának töredékére állítva.
      tolerance: (blocks[0]?.b ?? 0.3) * (0.05 / 200) * sigmaY,
      kind: 'absolute',
    },
    {
      label: 'a képlékeny tengely a szélesebb (alsó) öv felé tolódik (zPna > 0, lefelé)',
      reference: 1,
      computed: zPna > 0.01 ? 1 : 0,
      tolerance: 0,
      kind: 'absolute',
    },
  ];
}

export function caseP13(): ValidationCase {
  return {
    id: 'P-13',
    title: 'Rétegszám-konvergencia és a semleges tengely elmozdulása',
    description:
      'Mp a rétegszámmal monoton tart a zárt alakú M0-hoz (64 rétegnél 1%-on belül); ' +
      'aszimmetrikus (T-szerű) szelvénynél a képlékeny (egyenlő-terület) semleges tengely ' +
      'kimutathatóan és helyesen eltér a rugalmas súlyponttól.',
    reference: 'MASTER-PROMPT-TERV P10 prompt "Elfogadás" pontja; Diplomaterv 3.4.3, (3.54), (3.59)',
    checks: [...caseP13Convergence(), ...caseP13NeutralAxisShift()],
  };
}
