/**
 * Levezetés — adat-előállítás (MASTER-PROMPT-TERV P15/A prompt, ADR-0005).
 *
 * A tényleges LÉPÉSENKÉNTI levezetést (Gauss-pontok, B mátrix, Kₑ, réteg-
 * visszavetítés) a `@femati/fem-core` `derivation` modulja adja
 * (`deriveElementStiffness`, `deriveLayerStep`) — ez a fájl csak azt a KÉT
 * kiválasztást végzi el, ami a felület dolga (melyik elem, melyik Gauss-pont/
 * réteg legyen az alapértelmezett bemutatott példa), plusz a rétegelt modell
 * összeállítását és lineáris megoldását a levezetéshez.
 */
import { deriveLayerStep, solveLinear, type LayerStepDerivation, type LinearResult, type Model } from '@femati/fem-core';
import { combinedSteps, compileLayeredModel, findPreparedElement } from '../model/nonlinear.js';
import type { EditableModel } from '../model/editable.js';
import type { NonlinearRun } from '../model/nonlinear.js';

export interface DerivationData {
  readonly model: Model;
  readonly linear: LinearResult;
  readonly elementIds: readonly string[];
  readonly defaultElementId: string;
}

/** A rétegelt modell összeállítása és lineáris megoldása a levezetéshez. */
export function buildDerivationData(editable: EditableModel): DerivationData {
  const model = compileLayeredModel(editable);
  const linear = solveLinear(model);
  const elementIds = model.elements.map((e) => e.id as unknown as string);
  return { model, linear, elementIds, defaultElementId: pickMaxMomentElement(model, linear) };
}

/**
 * Az az elem, amelynek valamelyik Gauss-pontjában a legnagyobb |M| ébred —
 * ez az alapértelmezett "választott elem" a levezetés 4. pontjához (ez
 * egyezik a jobb panel "M max" értékével is, ugyanabból a `LinearResult`-ból).
 */
export function pickMaxMomentElement(model: Model, linear: LinearResult): string {
  let bestId = model.elements[0]?.id as unknown as string;
  let bestAbs = -1;
  for (const el of linear.elements) {
    for (const gp of el.gaussPoints) {
      if (Math.abs(gp.m) > bestAbs) {
        bestAbs = Math.abs(gp.m);
        bestId = el.elementId;
      }
    }
  }
  return bestId;
}

export interface PlasticSample {
  readonly stepIndex: number;
  readonly elementId: string;
  readonly gaussIndex: 0 | 1 | 2;
  readonly layerIndex: number;
}

/**
 * Egy tanulságos, ténylegesen képlékennyé vált (réteg, Gauss-pont, lépés)
 * hármas a levezetés 7. pontjához — az ELSŐ olyan lépés/hely, ahol egy réteg
 * megfolyt (`yielded`). `null`, ha a futásban sehol nem folyt meg semmi.
 */
export function pickDefaultPlasticSample(run: NonlinearRun): PlasticSample | null {
  const steps = [...run.loadingSteps, ...run.unloadSteps];
  for (let stepIndex = 1; stepIndex < steps.length; stepIndex++) {
    const step = steps[stepIndex];
    if (step === undefined) continue;
    for (const [elementId, state] of step.states) {
      for (let gaussIndex = 0; gaussIndex < 3; gaussIndex++) {
        const gp = state.gaussPoints[gaussIndex];
        if (gp === undefined || gp.kind !== 'layered') continue;
        const layerIndex = gp.layers.findIndex((l) => l.yielded);
        if (layerIndex >= 0) {
          return { stepIndex, elementId, gaussIndex: gaussIndex as 0 | 1 | 2, layerIndex };
        }
      }
    }
  }
  return null;
}

export interface PlasticLayerRow {
  readonly layerIndex: number;
  readonly zMm: number;
  readonly derived: LayerStepDerivation;
}

/**
 * A 7. pont "egy választott Gauss-pont rétegenkénti feszültségszámítása"
 * táblázatához szükséges, réteg-soronkénti levezetés — a `DerivationView`
 * (HTML) és a `docxExport` (Word) UGYANEZT hívja, hogy a két kimenet ne
 * térhessen el egymástól.
 */
export function computePlasticLayerRows(sample: PlasticSample, run: NonlinearRun): readonly PlasticLayerRow[] | null {
  const steps = combinedSteps(run);
  const prevStep = steps[sample.stepIndex - 1];
  const curStep = steps[sample.stepIndex];
  const materialData = run.materialData.get(sample.elementId);
  if (prevStep === undefined || curStep === undefined || materialData === undefined || materialData.kind !== 'layered') {
    return null;
  }
  const prevGp = prevStep.states.get(sample.elementId)?.gaussPoints[sample.gaussIndex];
  const curGp = curStep.states.get(sample.elementId)?.gaussPoints[sample.gaussIndex];
  if (prevGp === undefined || curGp === undefined || prevGp.kind !== 'layered' || curGp.kind !== 'layered') return null;
  const dKappa = curGp.kappa - prevGp.kappa;

  const rows: PlasticLayerRow[] = [];
  materialData.layers.forEach((layer, i) => {
    const prevState = prevGp.layers[i];
    if (prevState === undefined) return;
    const derived = deriveLayerStep(i, layer.z, layer.e, layer.sigmaY, layer.hPrime, prevState, dKappa);
    rows.push({ layerIndex: i, zMm: layer.z * 1e3, derived });
  });
  return rows;
}

/** A 7. pont mintapélda-címéhez szükséges x-koordináta (a keresztmetszet-inspektorral egyező forrásból). */
export function plasticSampleElementX(sample: PlasticSample, run: NonlinearRun): number | null {
  const el = findPreparedElement(run.system, sample.elementId);
  return el ? el.nodeX[1] : null;
}
