/**
 * A nemlineáris (rugalmas-képlékeny) futtatás — MASTER-PROMPT-TERV P13 prompt.
 *
 * EZ AZ EGYETLEN HELY (a `compile.ts` mellett), ahol a felület a magot hívja
 * (DESIGN-TERV 1.7: „a felület nem számol"). A nemlineáris futtatáshoz a
 * keresztmetszet MINDIG rétegelt (`generateLayers` + `makeLayeredSection`) —
 * a keresztmetszet-inspektor (P13 #4) rétegenkénti σ-profilja csak így
 * értelmezhető (a "resultant", nem rétegelt modellnél nincs réteg-adat).
 *
 * A "tehermentesítési mód" (MASTER-PROMPT-TERV 4.2 #6) a `runLoadStepper()`
 * (csak monoton, 0→λ_cél) UTÁN egy kézzel épített, csökkenő λ-jú
 * lépéssorozattal folytatódik, közvetlenül a `runNewtonRaphsonStep()`
 * alacsonyabb szintű függvénnyel — a tehermentesítés MINDIG rugalmas minden
 * rétegben (ld. `material/elastoPlastic1D.ts` fejléce), ezért ehhez nem kell
 * adaptív felezés, néhány egyenlő lépés elég.
 */
import {
  buildLoadVector,
  elementMaterialData,
  generateLayers,
  makeLayeredSection,
  makeMaterial,
  recommendedShearFactor,
  runLoadStepper,
  runNewtonRaphsonStep,
  solveLinear,
  uniformMesh,
  fixed,
  nodalForce,
  nodalMoment,
  distributedForce,
  pinned,
  buildModel,
  rect,
  circle as circleShape,
  tube as tubeShape,
  rhs as rhsShape,
  tProfile as tProfileShape,
  iProfile,
  InvalidModelError,
  type AssembledSystem,
  type ElementMaterialData,
  type LoadStepRecord,
  type LoadStepperStatus,
  type Model,
  type NonlinearAlgorithm,
  type NonlinearStateMap,
  type SectionShape,
} from '@femati/fem-core';
import { findMaterial, findSection, type SectionEntry } from '../data/catalog.js';
import type { EditableModel } from './editable.js';

// 32 réteg — a 16-os alapérték mellett az Mₑ/Mₚ ~4-5%-kal tért el a zárt
// alaktól (a réteg-középponti mintavétel másodrendű hatása, ld. ADR-0014
// és THEORY.md 14. pont); 32 rétegnél <1%-ra csökken, a P16 mérés szerint
// a teljesítmény-hatás a valós UI-méretskálán (≤48 elem) még mindig
// elhanyagolható.
const LAYER_COUNT = 32;

function toShape(section: SectionEntry): SectionShape {
  const cm = (mm: number): number => mm / 1000;
  switch (section.kind) {
    // Ld. `compile.ts` `toShape()` fejlécét: a "U" (UPN) szelvény ennél az
    // erős-tengelyű hajlítási modellnél egzaktul egyenértékű egy azonos
    // méretű I-szelvénnyel.
    case 'I':
    case 'U':
      return iProfile(cm(section.h), cm(section.b), cm(section.tw ?? 6), cm(section.tf ?? 10));
    case 'circle':
      return circleShape(cm(section.d ?? section.h));
    case 'tube':
      return tubeShape(cm(section.d ?? section.h), cm(section.t ?? 8));
    case 'rect':
      return rect(cm(section.b), cm(section.h));
    case 'rhs':
      return rhsShape(cm(section.h), cm(section.b), cm(section.t ?? 8));
    case 't':
      return tProfileShape(cm(section.h), cm(section.b), cm(section.tw ?? 6), cm(section.tf ?? 10));
  }
}

/** A legközelebbi hálócsomópont fem-core `NodeId`-ja (stringként). */
function nodeIdAt(x: number, span: number, elementCount: number): string {
  const nodeSpacing = span / (2 * elementCount);
  const idx = Math.min(Math.max(Math.round(x / nodeSpacing), 0), 2 * elementCount);
  return `N${idx}`;
}

/**
 * A modell fordítása RÉTEGELT keresztmetszettel — csak a nemlineáris
 * futtatáshoz (a lineáris élő újraszámolás `compile.ts`-ben, parametrikus
 * szelvénnyel, változatlanul marad, mert ott nincs szükség réteg-adatra).
 */
export function compileLayeredModel(editable: EditableModel): Model {
  const mat = findMaterial(editable.materialId);
  const sec = findSection(editable.sectionId);
  const shape = toShape(sec);

  const material = makeMaterial(mat.id, mat.name, {
    e: mat.e * 1e4,
    nu: mat.nu,
    alpha: mat.alpha,
    density: mat.density,
    ...(mat.sigmaY > 0 ? { sigmaY: mat.sigmaY * 1e4 } : {}),
    ...(mat.hPrime > 0 ? { hPrime: mat.hPrime * 1e4 } : {}),
    // E) fázis: vastagságfüggő acél-folyáshatár (referencia-adatból bekötve).
    ...(mat.fy1 !== undefined ? { fy1: mat.fy1 * 1e4 } : {}),
    ...(mat.fy2 !== undefined ? { fy2: mat.fy2 * 1e4 } : {}),
    ...(mat.thicknessThreshold !== undefined ? { thicknessThreshold: mat.thicknessThreshold / 1000 } : {}),
    // F) fázis: EC2 beton nemlineáris σ-ε modell.
    ...(mat.fck !== undefined ? { fck: mat.fck * 1e4 } : {}),
    ...(mat.epsC2 !== undefined ? { epsC2: mat.epsC2 } : {}),
    ...(mat.epsCu2 !== undefined ? { epsCu2: mat.epsCu2 } : {}),
    ...(mat.n !== undefined ? { n: mat.n } : {}),
  });

  const rawLayers = generateLayers(shape, LAYER_COUNT);
  const section = makeLayeredSection(
    sec.id,
    sec.name,
    rawLayers.map((l) => ({ b: l.b, t: l.t, z: l.z, ...(l.plateThickness !== undefined ? { plateThickness: l.plateThickness } : {}) })),
    recommendedShearFactor(shape, material.nu as number),
  );

  const mesh = uniformMesh(editable.span, editable.elementCount, {
    sectionId: section.id as unknown as string,
    materialId: material.id as unknown as string,
    integration: editable.integration,
  });
  const nodeAt = (x: number): string => nodeIdAt(x, editable.span, editable.elementCount);
  const boundaries = editable.supports.map((s) => (s.type === 'fixed' ? fixed(nodeAt(s.x)) : pinned(nodeAt(s.x))));
  const loads = editable.loads.map((l) =>
    l.kind === 'point'
      ? nodalForce(nodeAt(l.x), l.p, l.id)
      : l.kind === 'moment'
        ? nodalMoment(nodeAt(l.x), l.m, l.id)
        : distributedForce(l.x1, l.x2, l.q1, l.q2, l.id),
  );

  return buildModel({
    name: editable.presetId,
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [section],
    boundaries,
    loads,
  });
}

export interface NonlinearRun {
  readonly model: Model;
  readonly system: AssembledSystem;
  readonly materialData: ReadonlyMap<string, ElementMaterialData>;
  readonly status: LoadStepperStatus;
  /** A terhelési (0→peakLambda) szakasz elfogadott lépései. */
  readonly loadingSteps: readonly LoadStepRecord[];
  /** A tehermentesítési (peakLambda→0) szakasz lépései — üres, ha nincs tehermentesítés. */
  readonly unloadSteps: readonly LoadStepRecord[];
  /** Az ELVETETT (nem konvergált, Δλ-felezést kiváltó) próbálkozások a terhelési szakaszból — a konvergencia-panelhez (P13 #5). */
  readonly rejectedAttempts: readonly LoadStepRecord[];
  readonly peakLambda: number;
  /** A teher–elmozdulás görbe (P13 #3) referencia-csomópontjának indexe (a `nodalDisplacements()` sorrendjében). */
  readonly referenceNodeIndex: number;
  /** A referencia-csomópont RUGALMAS lehajlása λ=1-nél (`solveLinear` a rétegelt modellen — a σY-t figyelmen kívül hagyja). */
  readonly elasticReferenceW: number;
  /** A futáshoz beállított konvergencia-tolerancia [%] — a levezetés 7. pontjának konvergencia-képletéhez. */
  readonly tolerancePercent: number;
}

export interface NonlinearOptions {
  readonly algorithm: NonlinearAlgorithm;
  readonly tolerancePercent: number;
  readonly initialSteps: number;
  readonly peakLambda: number;
  readonly unload: boolean;
}

const UNLOAD_STEPS = 8;

function runUnloadSequence(
  system: AssembledSystem,
  model: Model,
  materialData: ReadonlyMap<string, ElementMaterialData>,
  algorithm: NonlinearAlgorithm,
  tolerancePercent: number,
  startU: Float64Array,
  startStates: NonlinearStateMap,
  fromLambda: number,
): LoadStepRecord[] {
  const records: LoadStepRecord[] = [];
  let u = startU;
  let states = startStates;
  for (let i = 1; i <= UNLOAD_STEPS; i++) {
    const lambda = fromLambda * (1 - i / UNLOAD_STEPS);
    const loads = buildLoadVector(model, system.map, lambda);
    const fTarget = new Float64Array(system.map.activeDofs);
    for (let a = 0; a < fTarget.length; a++) {
      fTarget[a] = (loads.active[a] ?? 0) + (system.constraintLoad[a] ?? 0);
    }
    const stepResult = runNewtonRaphsonStep(system, model, materialData, system.k, u, states, fTarget, {
      algorithm,
      iterMax: 30,
      tolerancePercent,
    });
    u = stepResult.u;
    states = stepResult.states;
    records.push({
      lambda,
      accepted: stepResult.converged,
      deltaLambda: fromLambda / UNLOAD_STEPS,
      u,
      states,
      iterations: stepResult.iterations,
    });
  }
  return records;
}

export interface NonlinearOutcome {
  readonly run: NonlinearRun | null;
  readonly error: string | null;
}

/** A rétegelt modell megoldása a nemlineáris teherlépcsőzővel, hibatűrő módon. */
export function runNonlinearEditableModel(editable: EditableModel, options: NonlinearOptions): NonlinearOutcome {
  let model: Model;
  try {
    model = compileLayeredModel(editable);
  } catch (error) {
    return { run: null, error: error instanceof Error ? error.message : String(error) };
  }

  try {
    const result = runLoadStepper(model, {
      algorithm: options.algorithm,
      iterMax: 30,
      iterMin: 3,
      tolerancePercent: options.tolerancePercent,
      initialSteps: options.initialSteps,
      targetLambda: options.peakLambda,
    });

    const materialData = new Map<string, ElementMaterialData>();
    for (const element of model.elements) {
      materialData.set(element.id as string, elementMaterialData(model, element));
    }

    let unloadSteps: readonly LoadStepRecord[] = [];
    const lastStep = result.steps.at(-1);
    if (options.unload && lastStep !== undefined) {
      unloadSteps = runUnloadSequence(
        result.system,
        model,
        materialData,
        options.algorithm,
        options.tolerancePercent,
        lastStep.u,
        lastStep.states,
        lastStep.lambda,
      );
    }

    // A teher–elmozdulás görbe (P13 #3) referencia-csomópontja: ahol a
    // VÉGSŐ lépésben a lehajlás a legnagyobb — ugyanez a csomópont követi
    // végig a teljes tehertörténetet, konzisztensen.
    let referenceNodeIndex = 0;
    if (lastStep !== undefined) {
      const finalNodal = nodalDisplacements(result.system, lastStep.u);
      let maxAbs = 0;
      finalNodal.forEach((n, i) => {
        if (Math.abs(n.w) > maxAbs) {
          maxAbs = Math.abs(n.w);
          referenceNodeIndex = i;
        }
      });
    }
    const linear = solveLinear(model);
    const elasticReferenceW = linear.displacements[2 * referenceNodeIndex] ?? 0;

    const run: NonlinearRun = {
      model,
      system: result.system,
      materialData,
      status: result.status,
      loadingSteps: result.steps,
      unloadSteps,
      rejectedAttempts: result.rejectedAttempts,
      peakLambda: options.peakLambda,
      referenceNodeIndex,
      elasticReferenceW,
      tolerancePercent: options.tolerancePercent,
    };
    return { run, error: null };
  } catch (error) {
    if (error instanceof InvalidModelError) {
      const messages = error.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message);
      return { run: null, error: messages.join(' ') || error.message };
    }
    return { run: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Az elemhez tartozó, elő-asszemblált `AssembledSystem`-beli elem (nodeX, activeDofs stb.) megkeresése. */
export function findPreparedElement(system: AssembledSystem, elementId: string): AssembledSystem['elements'][number] | undefined {
  return system.elements.find((e) => e.id === elementId);
}

export interface NodalDisplacement {
  readonly nodeId: string;
  readonly x: number;
  readonly w: number;
  readonly phi: number;
}

/**
 * Az AKTÍV szabadságfok-vektor ("u", csak a meg nem kötött DOF-ok) kiterjesztése
 * TELJES, csomópontonkénti [w,φ] listává — ugyanaz a logika, mint a
 * `solver/linearSolver.ts` (nem exportált) `expandDisplacements()`-e, csak a
 * felület oldalán, mert a nemlineáris lépés csak az aktív vektort adja vissza.
 */
export function nodalDisplacements(system: AssembledSystem, u: Float64Array): readonly NodalDisplacement[] {
  const { map } = system;
  const out: NodalDisplacement[] = [];
  for (let i = 0; i < map.nodeCount; i++) {
    const nodeId = map.nodeIds[i];
    if (nodeId === undefined) continue;
    const wDof = 2 * i;
    const phiDof = 2 * i + 1;
    const wActive = map.activeIndex[wDof] ?? -1;
    const phiActive = map.activeIndex[phiDof] ?? -1;
    const w = wActive >= 0 ? (u[wActive] ?? 0) : (map.prescribedValue[wDof] ?? 0);
    const phi = phiActive >= 0 ? (u[phiActive] ?? 0) : (map.prescribedValue[phiDof] ?? 0);
    out.push({ nodeId, x: map.nodeX[i] ?? 0, w, phi });
  }
  return out;
}

/**
 * A teherlépcső-idővonal EGYETLEN, folytonos lépéssorozata: a terhelési
 * (0→peakLambda) szakasz, majd — ha van — a tehermentesítési szakasz
 * (peakLambda→0) UTÁNA fűzve. Az idővonal `activeStep`-je ebbe indexel.
 */
export function combinedSteps(run: NonlinearRun): readonly LoadStepRecord[] {
  return [...run.loadingSteps, ...run.unloadSteps];
}

export type ElementPlasticity = 'elastic' | 'partial' | 'plastic';

/** Egy elem képlékenységi osztálya egy adott lépésben — a vászon P13 #2 rétegéhez. */
export function elementPlasticity(step: LoadStepRecord, elementId: string): ElementPlasticity {
  const state = step.states.get(elementId);
  if (state === undefined) return 'elastic';
  let yieldedCount = 0;
  for (const gp of state.gaussPoints) {
    const yielded = gp.kind === 'resultant' ? gp.state.yielded : gp.layers.some((l) => l.yielded);
    if (yielded) yieldedCount += 1;
  }
  if (yieldedCount === 0) return 'elastic';
  if (yieldedCount === 3) return 'plastic';
  return 'partial';
}

export interface HingeMarker {
  readonly stepIndex: number;
  readonly kind: 'first-yield' | 'full-hinge';
  readonly elementId: string;
}

/**
 * Az idővonalon jelölendő események (MASTER-PROMPT-TERV P13 #1): "hol folyt
 * meg először egy Gauss-pont" (`first-yield`, minden ELSŐ alkalommal, amikor
 * egy adott Gauss-pont folyóvá válik) és "hol alakult ki képlékeny csukló"
 * (`full-hinge`, amikor egy elem MINDHÁROM hajlítási Gauss-pontja folyóvá
 * vált — a "csukló" ennek a modellnek a közelítése, ld. THEORY.md P08 pont).
 */
export function computeHingeMarkers(run: NonlinearRun): readonly HingeMarker[] {
  const steps = combinedSteps(run);
  const markers: HingeMarker[] = [];
  const yieldedGpSeen = new Set<string>();
  const fullHingeSeen = new Set<string>();

  steps.forEach((step, stepIndex) => {
    for (const [elementId, state] of step.states) {
      let yieldedCount = 0;
      state.gaussPoints.forEach((gp, gpIndex) => {
        const yielded = gp.kind === 'resultant' ? gp.state.yielded : gp.layers.some((l) => l.yielded);
        if (!yielded) return;
        yieldedCount += 1;
        const key = `${elementId}#${gpIndex}`;
        if (yieldedGpSeen.has(key)) return;
        yieldedGpSeen.add(key);
        markers.push({ stepIndex, kind: 'first-yield', elementId });
      });
      if (yieldedCount === 3 && !fullHingeSeen.has(elementId)) {
        fullHingeSeen.add(elementId);
        markers.push({ stepIndex, kind: 'full-hinge', elementId });
      }
    }
  });

  return markers;
}
