/**
 * Az elem nemlineáris (rugalmas–képlékeny) állapota Gauss-pontonként
 * (Diplomaterv 3.4.2/3.4.3, MASTER-PROMPT-TERV 1.7–1.8, P11).
 *
 * Minden elem 3 hajlítási Gauss-pontján (`GAUSS_3` — ugyanaz a 3 pont, mint
 * a `STRESS_POINTS`, ld. `element/quadrature.ts`) tárol egy anyagállapotot:
 * vagy egyetlen "resultant" (M–κ) rugót (P9, nem rétegelt szelvény), vagy
 * réteges (P10, `LayeredSection`) állapotok tömbjét. A NYÍRÁS MINDIG
 * rugalmas (ld. `material/resultantPlastic.ts`, `material/elastoPlastic1D.ts`
 * fejléce) — ezért a nyírási Gauss-pontokhoz nem tartozik állapot, a T
 * mindig közvetlenül `GAs·γ`-ból számol (ld. `nonlinearElement.ts`).
 */
import { sectionStiffness } from '../element/constitutive.js';
import { concreteStress, isConcreteYielded } from '../material/concreteEC2.js';
import { INITIAL_LAYER_PLASTIC_STATE, updateLayerPlasticState, type LayerPlasticState } from '../material/elastoPlastic1D.js';
import { INITIAL_RESULTANT_PLASTIC_STATE, updateResultantPlasticState, type ResultantPlasticState } from '../material/resultantPlastic.js';
import type { Element, Material, MaterialId, Model } from '../model/types.js';

/** Egy réteg EC2 beton-paraméterei — csak akkor van, ha a réteg anyaga beton (F fázis). */
export interface ConcreteLayerParams {
  readonly fck: number;
  readonly epsC2: number;
  readonly epsCu2: number;
  readonly n: number;
}

/** Egy réteg állandó (nem-változó) anyagadata a nemlineáris futáshoz. */
export interface LayerMaterialData {
  readonly b: number;
  readonly t: number;
  readonly z: number;
  readonly e: number;
  readonly sigmaY: number;
  readonly hPrime: number;
  /** A réteg valódi lemezvastagsága [m] — csak diagnosztikai/teszt célra tárolva. */
  readonly plateThickness?: number;
  /** HA az anyag beton (van `fck`-ja) — az EC2 parabola-téglalap paraméterei. */
  readonly concrete?: ConcreteLayerParams;
}

/**
 * A réteg tényleges folyáshatára — HA az anyagnak van vastagságosztálya
 * (`fy1`/`fy2`/`thicknessThreshold`) ÉS a rétegnek van valódi lemezvastagsága
 * (`plateThickness`), a küszöb szerint LÉPCSŐSEN választ (EN 10025-2 — nem
 * folytonos, nem interpolált); egyébként az anyag egységes `sigmaY`-jára esik
 * vissza (visszafelé kompatibilis minden vastagságosztály nélküli anyaggal/
 * szelvénnyel) — E) fázis, ld. docs/ADR.
 */
function resolveLayerSigmaY(material: Material, plateThickness: number | undefined): number {
  const uniform = material.sigmaY !== undefined ? (material.sigmaY as number) : ELASTIC_SIGMA_Y;
  if (material.fy1 === undefined || material.fy2 === undefined || material.thicknessThreshold === undefined || plateThickness === undefined) {
    return uniform;
  }
  return plateThickness > (material.thicknessThreshold as number) ? (material.fy2 as number) : (material.fy1 as number);
}

/**
 * Egy elem állandó (a teherlépcsőzés alatt NEM változó) anyagadata.
 * `sigmaY = +∞`, ha az anyagnak nincs folyáshatára (tisztán rugalmas elem) —
 * ez a `updateResultantPlasticState`/`updateLayerPlasticState` folyási
 * feltételét sosem elégíti ki, tehát az elem érdemben rugalmas marad, külön
 * elágazás nélkül.
 */
export type ElementMaterialData =
  | {
      readonly kind: 'resultant';
      readonly ei: number;
      readonly gas: number;
      readonly m0: number;
      readonly hPrime: number;
    }
  | {
      readonly kind: 'layered';
      readonly gas: number;
      readonly layers: readonly LayerMaterialData[];
    };

const ELASTIC_SIGMA_Y = Number.POSITIVE_INFINITY;

/** Egy elem anyagadatainak feloldása a modellből (egyszer, a futás elején). */
export function elementMaterialData(model: Model, element: Element): ElementMaterialData {
  const materials = new Map(model.materials.map((m) => [m.id as string, m]));
  const sections = new Map(model.sections.map((s) => [s.id as string, s]));
  const material = materials.get(element.materialId as string);
  const section = sections.get(element.sectionId as string);
  if (!material || !section) {
    throw new Error(`A(z) "${element.id}" elem anyaga vagy keresztmetszete nem oldható fel.`);
  }
  const lookup = (id: MaterialId): Material | undefined => materials.get(id as string);
  const stiffness = sectionStiffness(section, material, lookup);

  if (section.kind === 'parametric') {
    const sigmaY = material.sigmaY !== undefined ? (material.sigmaY as number) : ELASTIC_SIGMA_Y;
    return {
      kind: 'resultant',
      ei: stiffness.ei,
      gas: stiffness.gas,
      m0: sigmaY === ELASTIC_SIGMA_Y ? Number.POSITIVE_INFINITY : sigmaY * stiffness.plasticModulus,
      hPrime: material.hPrime !== undefined ? (material.hPrime as number) : 0,
    };
  }

  const layers: LayerMaterialData[] = section.layers.map((l) => {
    const layerMaterial = l.materialId !== undefined ? (lookup(l.materialId) ?? material) : material;
    const plateThickness = l.plateThickness as number | undefined;
    const concrete: ConcreteLayerParams | undefined =
      layerMaterial.fck !== undefined && layerMaterial.epsC2 !== undefined && layerMaterial.epsCu2 !== undefined && layerMaterial.n !== undefined
        ? {
            fck: layerMaterial.fck as number,
            epsC2: layerMaterial.epsC2 as number,
            epsCu2: layerMaterial.epsCu2 as number,
            n: layerMaterial.n as number,
          }
        : undefined;
    return {
      b: l.b as number,
      t: l.t as number,
      z: l.z as number,
      e: layerMaterial.e as number,
      sigmaY: resolveLayerSigmaY(layerMaterial, plateThickness),
      hPrime: layerMaterial.hPrime !== undefined ? (layerMaterial.hPrime as number) : 0,
      ...(plateThickness !== undefined ? { plateThickness } : {}),
      ...(concrete !== undefined ? { concrete } : {}),
    };
  });
  return { kind: 'layered', gas: stiffness.gas, layers };
}

/** Egy hajlítási Gauss-pont pillanatnyi állapota. */
export type GaussPointState =
  | {
      readonly kind: 'resultant';
      readonly kappa: number;
      readonly m: number;
      readonly tangentEi: number;
      readonly state: ResultantPlasticState;
    }
  | {
      readonly kind: 'layered';
      readonly kappa: number;
      readonly m: number;
      readonly tangentEi: number;
      readonly layers: readonly LayerPlasticState[];
    };

export type ElementGaussStates = readonly [GaussPointState, GaussPointState, GaussPointState];

export interface ElementNonlinearState {
  readonly elementId: string;
  readonly gaussPoints: ElementGaussStates;
}

/** `elementId → állapot` — a teljes szerkezet nemlineáris állapota egy pillanatban. */
export type NonlinearStateMap = ReadonlyMap<string, ElementNonlinearState>;

function initialGaussPointState(data: ElementMaterialData): GaussPointState {
  if (data.kind === 'resultant') {
    return { kind: 'resultant', kappa: 0, m: 0, tangentEi: data.ei, state: INITIAL_RESULTANT_PLASTIC_STATE };
  }
  const tangentEi = data.layers.reduce((s, l) => s + l.e * l.b * l.z * l.z * l.t, 0);
  return {
    kind: 'layered',
    kappa: 0,
    m: 0,
    tangentEi,
    layers: data.layers.map(() => INITIAL_LAYER_PLASTIC_STATE),
  };
}

/** A teljes szerkezet TERHELETLEN kezdőállapota (a nemlineáris futás elején). */
export function initialNonlinearState(elementIds: readonly string[], materialData: ReadonlyMap<string, ElementMaterialData>): NonlinearStateMap {
  const map = new Map<string, ElementNonlinearState>();
  for (const id of elementIds) {
    const data = materialData.get(id);
    if (data === undefined) throw new Error(`Hiányzó anyagadat: "${id}".`);
    const gp = initialGaussPointState(data);
    map.set(id, { elementId: id, gaussPoints: [gp, gp, gp] });
  }
  return map;
}

/**
 * Egy Gauss-pont állapotfrissítése az ÚJ, teljes (nem inkrementális) `κ`-ból
 * — a `Δκ`-t az előző (utolsó ITERÁCIÓS) állapothoz képest számítja, a
 * REFORB (3.4.4) algoritmus per-iterációs sémáját követve.
 */
export function updateGaussPointState(data: ElementMaterialData, prev: GaussPointState, kappaNew: number): GaussPointState {
  const dKappa = kappaNew - prev.kappa;

  if (data.kind === 'resultant' && prev.kind === 'resultant') {
    const r = updateResultantPlasticState(prev.state, prev.m, 0, data.ei, data.gas, data.m0, data.hPrime, dKappa, 0);
    return { kind: 'resultant', kappa: kappaNew, m: r.m, tangentEi: r.tangentEI, state: r.state };
  }

  if (data.kind === 'layered' && prev.kind === 'layered') {
    // TELJESÍTMÉNY (P16, MÉRÉSSEL azonosítva — ld. docs/ADR/0009-*.md): ez a
    // hurok a legforróbb út (elem × Gauss-pont × réteg × Newton-iteráció ×
    // teherlépcső szorzata). Az `m` (3.59: M = Σ σₗ·bₗ·zₗ·tₗ) INLINE
    // összegzéssel készül — NEM `sectionMoment(rawLayers, stresses)`
    // hívással —, mert az a hívás rétegenként EGY ÚJ `RawLayer` objektumot
    // ÉS egy `stresses` tömb-elemet allokálna, holott `data.layers[i]`
    // (b, t, z) a teherlépcsőzés alatt VÁLTOZATLAN — ugyanaz a képlet,
    // csak allokáció nélkül. A `sectionMoment()` függvény változatlan marad
    // és külön tesztelt (`layeredSection.test.ts`) — csak ez az EGY hívási
    // hely nem használja.
    const newLayerStates: LayerPlasticState[] = [];
    let tangentEi = 0;
    let m = 0;

    for (let i = 0; i < data.layers.length; i++) {
      const layer = data.layers[i];
      const layerPrevState = prev.layers[i];
      if (layer === undefined || layerPrevState === undefined) continue;

      if (layer.concrete !== undefined) {
        // F) fázis: EC2 parabola-téglalap — PATH-INDEPENDENT, a TELJES
        // (nem inkrementális) alakváltozásból, nincs `LayerPlasticState`
        // history-ra szükség (ld. `material/concreteEC2.ts` fejléce).
        const totalEps = kappaNew * layer.z;
        const cs = concreteStress(totalEps, layer.concrete.fck, layer.concrete.epsC2, layer.concrete.epsCu2, layer.concrete.n);
        newLayerStates.push({ sigma: cs.sigma, epsPEff: 0, yielded: isConcreteYielded(totalEps, layer.concrete.epsC2) });
        m += cs.sigma * layer.b * layer.z * layer.t;
        tangentEi += cs.tangentE * layer.b * layer.z * layer.z * layer.t;
        continue;
      }

      const dEps = dKappa * layer.z;
      const r = updateLayerPlasticState(layerPrevState, layer.e, layer.sigmaY, layer.hPrime, dEps);
      newLayerStates.push(r.state);
      m += r.sigma * layer.b * layer.z * layer.t;
      tangentEi += r.tangentE * layer.b * layer.z * layer.z * layer.t;
    }

    return {
      kind: 'layered',
      kappa: kappaNew,
      m,
      tangentEi,
      layers: newLayerStates,
    };
  }

  throw new Error('Inkonzisztens (rétegelt vs. nem rétegelt) anyagállapot-típus.');
}

/** Igaz, ha az adott Gauss-pont az UTOLSÓ frissítés szerint folyva van (bármely rétege, réteges esetben). */
export function isGaussPointYielded(gp: GaussPointState): boolean {
  if (gp.kind === 'resultant') return gp.state.yielded;
  return gp.layers.some((l) => l.yielded);
}
