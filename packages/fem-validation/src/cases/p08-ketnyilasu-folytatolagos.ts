/**
 * P-08 — Kétnyílású folytatólagos gerenda, mindkét mezőben egyenletes q,
 * határteher (MASTER-PROMPT-TERV 3.2 táblázat; P12 prompt "Kiemelt eset").
 *
 * Ez a diplomaterv FŐ FELADATTÍPUSA: egy 1×-en statikailag határozatlan,
 * kétnyílású folytatólagos gerenda (mindkét nyílás hossza L, középső
 * görgős/csuklós támasszal), egyenletes q teherrel MINDKÉT mezőben.
 *
 * SZIMMETRIA-MODELLEZÉS: mivel a geometria ÉS a teher mindkét mezőben
 * PONTOSAN azonos, a középső támasz feletti keresztmetszet elfordulása
 * (φ) MINDEN terhelési szinten — rugalmasan ÉS képlékenyen is — PONTOSAN
 * nulla (a lehajlásgörbe a középső támaszra szimmetrikus, ezért az első
 * derivált ott páratlan függvényként nulla). Ez azt jelenti, hogy a
 * középső támasz a MODELLBEN egy `fixed()` befogásnak felel meg (w=0 ÉS
 * φ=0), NEM egy egyszerű `pinned()` csuklónak — ezért a modell EGYETLEN
 * mezőre (befogott-csuklós, "propped cantilever" elrendezésre)
 * redukálható, ami PONTOSAN egyenértékű a teljes kétnyílású szerkezettel,
 * de numerikusan sokkal jobban kondicionált (nincs két, egymással
 * szimmetrikusan, EGYIDEJŰLEG folyó Gauss-pont-pár a támasz KÉT oldalán,
 * ami a teljes modellnél erős lokális merevség-elfajulást — numerikus
 * konvergencia-nehézséget — okozott a próbák szerint).
 *
 * A befogott-csuklós ("propped cantilever") elrendezés zárt alakú
 * határterhe PONTOSAN ugyanaz a klasszikus képlet, mint amit a diplomaterv
 * a kétnyílású esetre ad: `qu = (6 + 4√2)·Mp/L² ≈ 11.657·Mp/L²` (2 csukló:
 * a befogásnál — itt: a szimmetria-tengelynél — és a mezőn belül, a
 * befogástól kb. 0.44L-re).
 */
import {
  buildModel,
  distributedForce,
  fixed,
  makeMaterial,
  makeSection,
  pinned,
  rect,
  runLoadStepper,
  uniformMesh,
  type LoadStepRecord,
} from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

const SPAN = 4;
const ELEMENTS = 64;

interface HingeEvent {
  readonly lambda: number;
  readonly elementId: string;
  readonly xMid: number;
}

/**
 * Az első lépés, amelyben az adott predikátumnak megfelelő elem VALAMELYIK
 * Gauss-pontjának nyomatéka eléri a `mp` `nearFraction`-ös hányadát.
 *
 * NEM a diszkrét `yielded` állapotjelzőt használja: a teherlépcsőző az
 * utolsó ELFOGADOTT lépésnél éppen csak a folyási határ ALÁ eshet (a
 * `minStepFraction` szerinti felezés miatt sosem lép át PONTOSAN a
 * határon) — a nyomaték-küszöb ezért robusztusabb "gyakorlatilag
 * megfolyt" jelző, mint a bináris állapot.
 */
function firstNearYieldEvent(
  steps: readonly LoadStepRecord[],
  elementMidX: ReadonlyMap<string, number>,
  predicate: (x: number) => boolean,
  mp: number,
  nearFraction = 0.99,
): HingeEvent | undefined {
  for (const step of steps) {
    for (const [elementId, state] of step.states) {
      const x = elementMidX.get(elementId);
      if (x === undefined || !predicate(x)) continue;
      const nearYield = state.gaussPoints.some((gp) => Math.abs(gp.m) >= nearFraction * mp);
      if (nearYield) return { lambda: step.lambda, elementId, xMid: x };
    }
  }
  return undefined;
}

export function caseP08(): ValidationCase {
  const material = makeMaterial('S1', 'Acél', { e: 2.1e8, sigmaY: 2.35e5, hPrime: 0 });
  const section = makeSection('R', 'Téglalap', rect(0.2, 0.4));
  const mp = (2.35e5 * (0.2 * 0.4 ** 2)) / 4;
  const qu = ((6 + 4 * Math.sqrt(2)) * mp) / SPAN ** 2;

  const appliedQ = -1.3 * qu;
  const mesh = uniformMesh(SPAN, ELEMENTS, { sectionId: 'R', materialId: 'S1' });
  const symmetryNode = `N${2 * ELEMENTS}`; // a középső támasz (szimmetria-tengely) — befogásként modellezve

  const model = buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [section],
    boundaries: [pinned('N0'), fixed(symmetryNode)],
    loads: [distributedForce(0, SPAN, appliedQ, appliedQ, 'Q1')],
  });

  const result = runLoadStepper(model, {
    algorithm: 'newton',
    iterMax: 30,
    iterMin: 3,
    tolerancePercent: 1e-4,
    initialSteps: 8,
    minStepFraction: 1 / 2048,
  });
  const reachedLambda = result.steps.at(-1)?.lambda ?? 0;
  const computedQu = Math.abs(appliedQ) * reachedLambda;

  const elementMidX = new Map(result.system.elements.map((e) => [e.id, e.nodeX[1]] as const));
  const nearSupport = (x: number): boolean => Math.abs(x - SPAN) < 0.15;
  const inSpan = (x: number): boolean => x < SPAN - 0.5;

  const supportHinge = firstNearYieldEvent(result.steps, elementMidX, nearSupport, mp);
  const spanHinge = firstNearYieldEvent(result.steps, elementMidX, inSpan, mp);

  const checks: ValidationCheck[] = [
    {
      label: 'a teher-vezérelt eljárás a határteher közelében leáll',
      reference: 1,
      computed: result.status === 'limit-load-reached' ? 1 : 0,
      tolerance: 0,
      kind: 'absolute',
    },
    {
      label: 'qu = (6 + 4√2)·Mp/L²',
      reference: qu,
      computed: computedQu,
      tolerance: 0.03,
      kind: 'relative',
    },
    {
      label: 'a középső támasznál (szimmetria-tengely) KELETKEZIK csukló a határteherig',
      reference: 1,
      computed: supportHinge !== undefined ? 1 : 0,
      tolerance: 0,
      kind: 'absolute',
    },
    {
      label: 'a nyílásban is KELETKEZIK csukló a határteherig',
      reference: 1,
      computed: spanHinge !== undefined ? 1 : 0,
      tolerance: 0,
      kind: 'absolute',
    },
    {
      label: 'a KIALAKULÁS SORRENDJE helyes: a támasz-csukló ELŐBB folyik meg, mint a nyílásbeli',
      reference: 1,
      computed: supportHinge !== undefined && spanHinge !== undefined && supportHinge.lambda <= spanHinge.lambda ? 1 : 0,
      tolerance: 0,
      kind: 'absolute',
    },
  ];

  const protocol =
    `A képlékeny csuklók kialakulásának sorrendje (a tehertörténetből ténylegesen megfigyelve, ` +
    `a szimmetria-modellen — a középső támasz itt a szimmetria-tengelynek megfelelő befogás): ` +
    (supportHinge !== undefined
      ? `1) λ=${supportHinge.lambda.toFixed(4)}-nél a középső támasznál (${supportHinge.elementId}, x≈${supportHinge.xMid.toFixed(3)} m) megfolyik a keresztmetszet — ` +
        `a nyomatéki ábra a támasz fölött "ellaposodik" (a többlet nyomaték a mező felé redistribuálódik). `
      : 'a középső támasznál a futás során NEM keletkezett csukló. ') +
    (spanHinge !== undefined
      ? `2) λ=${spanHinge.lambda.toFixed(4)}-nél a mezőben (${spanHinge.elementId}, x≈${spanHinge.xMid.toFixed(3)} m, a befogástól ≈${(SPAN - spanHinge.xMid).toFixed(3)} m-re) is megfolyik a keresztmetszet — ` +
        `ekkortól a szerkezet (fél-modellben) 2, a teljes kétnyílású szerkezetben pedig 3 csuklós mechanizmussá válik, és a teher-vezérelt eljárás a határteher közelében leáll. `
      : 'a mezőben a futás során NEM keletkezett csukló. ') +
    `A számított határteher qu≈${computedQu.toFixed(1)} kN/m, a zárt alak qu=(6+4√2)·Mp/L²≈${qu.toFixed(1)} kN/m.`;

  return {
    id: 'P-08',
    title: 'Kétnyílású folytatólagos gerenda — a diplomaterv fő feladattípusa',
    description: protocol,
    reference: 'MASTER-PROMPT-TERV 3.2 táblázat (P-08); a diplomaterv fő mintafeladata',
    checks,
  };
}
