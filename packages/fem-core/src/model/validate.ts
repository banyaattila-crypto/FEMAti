/**
 * Modellvalidáció. Hibákat ÉS figyelmeztetéseket ad vissza, magyar nyelvű
 * üzenettel és az érintett entitás azonosítójával.
 *
 * A validáció szándékosan a solver ELŐTT fut: egy statikai programban a néma
 * hibás eredmény rosszabb, mint a futás megtagadása.
 */

import type { Layer, Model, Section } from './types.js';

export type Severity = 'error' | 'warning';

export interface Diagnostic {
  readonly severity: Severity;
  /** Gépi kód a teszteléshez és a felület lokalizációjához. */
  readonly code: string;
  /** Emberi nyelvű, magyar üzenet. */
  readonly message: string;
  readonly entity?: { readonly kind: string; readonly id: string };
}

const err = (code: string, message: string, entity?: Diagnostic['entity']): Diagnostic =>
  entity ? { severity: 'error', code, message, entity } : { severity: 'error', code, message };

const warn = (code: string, message: string, entity?: Diagnostic['entity']): Diagnostic =>
  entity ? { severity: 'warning', code, message, entity } : { severity: 'warning', code, message };

/** Duplikált azonosítók keresése. */
function checkDuplicateIds(model: Model, out: Diagnostic[]): void {
  const groups: readonly [string, readonly { readonly id: string }[]][] = [
    ['csomópont', model.nodes],
    ['elem', model.elements],
    ['anyag', model.materials],
    ['keresztmetszet', model.sections],
    ['teher', model.loads],
  ];
  for (const [kind, items] of groups) {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.id)) {
        out.push(err('DUPLICATE_ID', `Ismétlődő ${kind} azonosító: "${item.id}".`, { kind, id: item.id }));
      }
      seen.add(item.id);
    }
  }
}

/** Hivatkozási integritás. */
function checkReferences(model: Model, out: Diagnostic[]): void {
  const nodeIds = new Set(model.nodes.map((n) => n.id as string));
  const matIds = new Set(model.materials.map((m) => m.id as string));
  const secIds = new Set(model.sections.map((s) => s.id as string));
  const elemIds = new Set(model.elements.map((e) => e.id as string));

  for (const e of model.elements) {
    for (const n of e.nodes) {
      if (!nodeIds.has(n as string)) {
        out.push(
          err('MISSING_NODE', `A(z) "${e.id}" elem nem létező csomópontra hivatkozik: "${n}".`, {
            kind: 'elem',
            id: e.id as string,
          }),
        );
      }
    }
    if (!matIds.has(e.materialId as string)) {
      out.push(
        err('MISSING_MATERIAL', `A(z) "${e.id}" elem anyaga nem található: "${e.materialId}".`, {
          kind: 'elem',
          id: e.id as string,
        }),
      );
    }
    if (!secIds.has(e.sectionId as string)) {
      out.push(
        err('MISSING_SECTION', `A(z) "${e.id}" elem keresztmetszete nem található: "${e.sectionId}".`, {
          kind: 'elem',
          id: e.id as string,
        }),
      );
    }
  }

  for (const b of model.boundaries) {
    if (!nodeIds.has(b.nodeId as string)) {
      out.push(
        err('MISSING_NODE', `Megtámasztás nem létező csomóponton: "${b.nodeId}".`, {
          kind: 'megtámasztás',
          id: b.nodeId as string,
        }),
      );
    }
  }

  for (const l of model.loads) {
    if (
      (l.kind === 'nodal-force' || l.kind === 'nodal-moment' || l.kind === 'support-displacement') &&
      !nodeIds.has(l.nodeId as string)
    ) {
      out.push(
        err('MISSING_NODE', `A(z) "${l.id}" teher nem létező csomópontra hivatkozik: "${l.nodeId}".`, {
          kind: 'teher',
          id: l.id as string,
        }),
      );
    }
    if (l.kind === 'thermal' && l.elementIds) {
      for (const eid of l.elementIds) {
        if (!elemIds.has(eid as string)) {
          out.push(
            err('MISSING_ELEMENT', `A(z) "${l.id}" hőteher nem létező elemre hivatkozik: "${eid}".`, {
              kind: 'teher',
              id: l.id as string,
            }),
          );
        }
      }
    }
  }
}

/** Elemgeometria: három különböző csomópont, a középső szigorúan a szélsők között. */
function checkElementGeometry(model: Model, out: Diagnostic[]): void {
  const xOf = new Map(model.nodes.map((n) => [n.id as string, n.x as number]));

  for (const e of model.elements) {
    const [a, b, c] = e.nodes;
    if (a === b || b === c || a === c) {
      out.push(
        err('DEGENERATE_ELEMENT', `A(z) "${e.id}" elem csomópontjai nem különbözőek.`, {
          kind: 'elem',
          id: e.id as string,
        }),
      );
      continue;
    }
    const x1 = xOf.get(a as string);
    const x2 = xOf.get(b as string);
    const x3 = xOf.get(c as string);
    if (x1 === undefined || x2 === undefined || x3 === undefined) continue;

    if (x1 === x3) {
      out.push(
        err('ZERO_LENGTH_ELEMENT', `A(z) "${e.id}" elem hossza zérus.`, {
          kind: 'elem',
          id: e.id as string,
        }),
      );
      continue;
    }
    const lo = Math.min(x1, x3);
    const hi = Math.max(x1, x3);
    if (x2 <= lo || x2 >= hi) {
      out.push(
        err(
          'MIDNODE_OUTSIDE',
          `A(z) "${e.id}" elem középső csomópontja nem az elem belsejében van ` +
            `(x = ${x2}, elem: ${lo}…${hi}). A Jacobi-determináns előjelet válthat.`,
          { kind: 'elem', id: e.id as string },
        ),
      );
    } else {
      // Erős torzítás figyelmeztetés: a középpont az elem közepétől 25%-nál messzebb.
      const mid = (lo + hi) / 2;
      const rel = Math.abs(x2 - mid) / (hi - lo);
      if (rel > 0.25) {
        out.push(
          warn(
            'DISTORTED_ELEMENT',
            `A(z) "${e.id}" elem középső csomópontja erősen eltolt (${(rel * 100).toFixed(0)}%). ` +
              `Ez rontja a numerikus pontosságot.`,
            { kind: 'elem', id: e.id as string },
          ),
        );
      }
    }
  }
}

/**
 * Kinematikai határozottság.
 *
 * A merevtest-mozgás 1D Timoshenko-gerendán: w(x) = a + b·x, φ = b
 * (ekkor κ = 0 és γ = φ − dw/dx = 0). A megtámasztásoknak ezt a kétparaméteres
 * (a, b) mozgást kell megakadályozniuk:
 *   w-megkötés az i. csomóponton →  [1, x_i] · (a, b)ᵀ = 0
 *   φ-megkötés                    →  [0, 1]  · (a, b)ᵀ = 0
 * Elég, ha e sorok rangja 2.
 */
function checkKinematicStability(model: Model, out: Diagnostic[]): void {
  if (model.nodes.length === 0) return;

  const xOf = new Map(model.nodes.map((n) => [n.id as string, n.x as number]));
  const rows: [number, number][] = [];

  for (const b of model.boundaries) {
    const x = xOf.get(b.nodeId as string);
    if (x === undefined) continue;
    if (b.wFixed || (b.springW !== undefined && (b.springW as number) > 0)) rows.push([1, x]);
    if (b.phiFixed || (b.springPhi !== undefined && (b.springPhi as number) > 0)) rows.push([0, 1]);
  }
  for (const f of model.foundations) {
    // A folytonos ágyazat mindkét merevtest-módot megakadályozza.
    if ((f.c as number) > 0 && (f.x2 as number) > (f.x1 as number)) {
      rows.push([1, f.x1 as number], [1, f.x2 as number]);
    }
  }

  if (rank2(rows) < 2) {
    out.push(
      err(
        'MECHANISM',
        'A szerkezet mechanizmus: a megtámasztások nem akadályozzák meg a merevtestszerű ' +
          'elmozdulást (eltolódás és/vagy elfordulás). Legalább két független megkötés kell ' +
          '— például egy befogás, vagy két, különböző helyen lévő görgős támasz.',
      ),
    );
  }
}

/** 2 oszlopos mátrix rangja Gauss-eliminációval. */
function rank2(rows: readonly (readonly [number, number])[]): number {
  const eps = 1e-12;
  const work = rows.map((r) => [r[0], r[1]]);
  let rank = 0;
  for (let col = 0; col < 2 && rank < work.length; col++) {
    let pivot = -1;
    let best = eps;
    for (let i = rank; i < work.length; i++) {
      const v = Math.abs(work[i][col]);
      if (v > best) {
        best = v;
        pivot = i;
      }
    }
    if (pivot < 0) continue;
    const tmp = work[rank];
    work[rank] = work[pivot];
    work[pivot] = tmp;
    const p = work[rank][col];
    for (let i = rank + 1; i < work.length; i++) {
      const factor = work[i][col] / p;
      work[i][0] -= factor * work[rank][0];
      work[i][1] -= factor * work[rank][1];
    }
    rank++;
  }
  return rank;
}

/** Anyagjellemzők értelmessége. */
function checkMaterials(model: Model, out: Diagnostic[]): void {
  for (const m of model.materials) {
    const id = { kind: 'anyag', id: m.id as string };
    if ((m.e as number) <= 0) {
      out.push(err('INVALID_E', `A(z) "${m.name}" anyag rugalmassági modulusa nem pozitív.`, id));
    }
    if ((m.g as number) <= 0) {
      out.push(err('INVALID_G', `A(z) "${m.name}" anyag nyírási modulusa nem pozitív.`, id));
    }
    const nu = m.nu as number;
    if (nu < 0 || nu >= 0.5) {
      out.push(
        warn(
          'UNUSUAL_NU',
          `A(z) "${m.name}" anyag Poisson-tényezője szokatlan (ν = ${nu}). ` +
            `Szokásos tartomány: 0 ≤ ν < 0.5.`,
          id,
        ),
      );
    }
    if (m.sigmaY !== undefined && (m.sigmaY as number) <= 0) {
      out.push(err('INVALID_SIGMA_Y', `A(z) "${m.name}" anyag folyáshatára nem pozitív.`, id));
    }
    if (m.hPrime !== undefined && (m.hPrime as number) < 0) {
      out.push(
        err(
          'NEGATIVE_HARDENING',
          `A(z) "${m.name}" anyag keményedési paramétere negatív (lágyulás). ` +
            `Ezt a mag nem támogatja.`,
          id,
        ),
      );
    }
  }
}

/** Rétegelt keresztmetszet: hézag- és átfedésmentesség. */
function checkLayers(layers: readonly Layer[], sectionName: string, id: string, out: Diagnostic[]): void {
  if (layers.length === 0) {
    out.push(err('EMPTY_SECTION', `A(z) "${sectionName}" rétegelt keresztmetszetnek nincs rétege.`, {
      kind: 'keresztmetszet',
      id,
    }));
    return;
  }

  for (const [i, l] of layers.entries()) {
    if ((l.b as number) <= 0 || (l.t as number) <= 0) {
      out.push(
        err(
          'INVALID_LAYER',
          `A(z) "${sectionName}" keresztmetszet ${i + 1}. rétegének mérete nem pozitív.`,
          { kind: 'keresztmetszet', id },
        ),
      );
    }
  }

  const sorted = [...layers].sort((a, b) => (a.z as number) - (b.z as number));
  const eps = 1e-9;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const prevTop = (prev.z as number) + (prev.t as number) / 2;
    const curBottom = (cur.z as number) - (cur.t as number) / 2;
    const gap = curBottom - prevTop;
    if (gap > eps) {
      out.push(
        warn(
          'LAYER_GAP',
          `A(z) "${sectionName}" keresztmetszet ${i}. és ${i + 1}. rétege között ` +
            `${(gap * 1000).toFixed(3)} mm hézag van.`,
          { kind: 'keresztmetszet', id },
        ),
      );
    } else if (gap < -eps) {
      out.push(
        err(
          'LAYER_OVERLAP',
          `A(z) "${sectionName}" keresztmetszet ${i}. és ${i + 1}. rétege ` +
            `${(-gap * 1000).toFixed(3)} mm-en átfedi egymást.`,
          { kind: 'keresztmetszet', id },
        ),
      );
    }
  }

  // A rétegzés súlyponti helyzete: Σ b·t·z ≈ 0 elvárt (a z a súlyponttól mért).
  let s = 0;
  let a = 0;
  for (const l of layers) {
    const area = (l.b as number) * (l.t as number);
    a += area;
    s += area * (l.z as number);
  }
  const h = Math.max(...layers.map((l) => Math.abs(l.z as number) + (l.t as number) / 2));
  if (a > 0 && Math.abs(s / a) > 1e-6 * Math.max(h, 1e-6)) {
    out.push(
      warn(
        'LAYERS_NOT_CENTROIDAL',
        `A(z) "${sectionName}" keresztmetszet rétegzése nem súlyponti: Σ(b·t·z)/A = ` +
          `${((s / a) * 1000).toFixed(4)} mm. A z koordinátákat a súlyponttól kell mérni.`,
        { kind: 'keresztmetszet', id },
      ),
    );
  }
}

function checkSections(model: Model, out: Diagnostic[]): void {
  for (const s of model.sections) {
    const id = s.id as string;
    if ((s.shearFactor as number) <= 0 || (s.shearFactor as number) > 1) {
      out.push(
        err(
          'INVALID_SHEAR_FACTOR',
          `A(z) "${s.name}" keresztmetszet nyírási alaktényezője kívül esik a (0, 1] tartományon.`,
          { kind: 'keresztmetszet', id },
        ),
      );
    }
    if (s.kind === 'layered') {
      checkLayers(s.layers, s.name, id, out);
    } else {
      checkShape(s, out);
    }
  }
}

function checkShape(s: Extract<Section, { kind: 'parametric' }>, out: Diagnostic[]): void {
  const id = { kind: 'keresztmetszet', id: s.id as string };
  const positive = (v: number, label: string): void => {
    if (v <= 0) {
      out.push(err('INVALID_DIMENSION', `A(z) "${s.name}" keresztmetszet ${label} mérete nem pozitív.`, id));
    }
  };
  const sh = s.shape;
  switch (sh.kind) {
    case 'rect':
      positive(sh.b as number, 'szélesség');
      positive(sh.h as number, 'magasság');
      break;
    case 'circle':
      positive(sh.d as number, 'átmérő');
      break;
    case 'tube':
      positive(sh.d as number, 'átmérő');
      positive(sh.t as number, 'falvastagság');
      if ((sh.t as number) >= (sh.d as number) / 2) {
        out.push(
          err('INVALID_DIMENSION', `A(z) "${s.name}" cső falvastagsága nem lehet a sugárnál nagyobb.`, id),
        );
      }
      break;
    case 'i-profile':
      positive(sh.h as number, 'magasság');
      positive(sh.b as number, 'szélesség');
      positive(sh.tw as number, 'gerincvastagság');
      positive(sh.tf as number, 'övvastagság');
      if (2 * (sh.tf as number) >= (sh.h as number)) {
        out.push(err('INVALID_DIMENSION', `A(z) "${s.name}" I-szelvény övei elfedik a gerincet.`, id));
      }
      break;
    case 'rhs':
      positive(sh.h as number, 'magasság');
      positive(sh.b as number, 'szélesség');
      positive(sh.t as number, 'falvastagság');
      if (2 * (sh.t as number) >= Math.min(sh.h as number, sh.b as number)) {
        out.push(
          err('INVALID_DIMENSION', `A(z) "${s.name}" zárt szelvény falvastagsága kitölti a belső üreget.`, id),
        );
      }
      break;
  }
}

/** Terhek geometriai értelmessége és a hőteher-figyelmeztetés. */
function checkLoads(model: Model, out: Diagnostic[]): void {
  const xs = model.nodes.map((n) => n.x as number);
  const xMin = xs.length > 0 ? Math.min(...xs) : 0;
  const xMax = xs.length > 0 ? Math.max(...xs) : 0;

  for (const l of model.loads) {
    const id = { kind: 'teher', id: l.id as string };
    if (l.kind === 'distributed-force' || l.kind === 'distributed-moment') {
      const x1 = l.x1 as number;
      const x2 = l.x2 as number;
      if (x2 <= x1) {
        out.push(err('INVALID_LOAD_RANGE', `A(z) "${l.id}" megoszló teher kezdőpontja nem kisebb a végpontjánál.`, id));
      }
      if (x1 < xMin - 1e-9 || x2 > xMax + 1e-9) {
        out.push(
          err(
            'LOAD_OUT_OF_RANGE',
            `A(z) "${l.id}" megoszló teher kilóg a szerkezetből (${x1}…${x2}, tartó: ${xMin}…${xMax}).`,
            id,
          ),
        );
      }
    }
    if (l.kind === 'distributed-force' && l.shape === 'parabolic' && l.qMid === undefined) {
      out.push(
        err('MISSING_QMID', `A(z) "${l.id}" parabolikus megoszló tehernél hiányzik a felezőponti intenzitás.`, id),
      );
    }
    if (l.kind === 'thermal') {
      const top = l.tTop as number;
      const bottom = l.tBottom as number;
      if (Math.abs(bottom - top) < 1e-12) {
        out.push(
          warn(
            'THERMAL_NO_GRADIENT',
            `A(z) "${l.id}" hőteher egyenletes (nincs gradiens), ezért a hajlított gerendamodellre ` +
              `nincs hatása: a modellnek nincs tengelyirányú szabadságfoka, így az egyenletes ` +
              `hőtágulás szabadon létrejöhet. Igénybevételt csak hőmérséklet-KÜLÖNBSÉG okoz.`,
            id,
          ),
        );
      }
    }
    if (l.kind === 'support-displacement' && l.dz === undefined && l.dPhi === undefined) {
      out.push(warn('EMPTY_SUPPORT_DISPLACEMENT', `A(z) "${l.id}" támaszmozgás nem ír elő elmozdulást.`, id));
    }
  }
}

/** Az elemek lefedik-e a tartományt hézag és átfedés nélkül. */
function checkMeshContinuity(model: Model, out: Diagnostic[]): void {
  if (model.elements.length === 0) {
    out.push(err('NO_ELEMENTS', 'A modell nem tartalmaz végeselemet.'));
    return;
  }
  const xOf = new Map(model.nodes.map((n) => [n.id as string, n.x as number]));
  const spans: [number, number][] = [];
  for (const e of model.elements) {
    const x1 = xOf.get(e.nodes[0] as string);
    const x3 = xOf.get(e.nodes[2] as string);
    if (x1 === undefined || x3 === undefined) return;
    spans.push([Math.min(x1, x3), Math.max(x1, x3)]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < spans.length; i++) {
    const gap = spans[i][0] - spans[i - 1][1];
    if (gap > 1e-9) {
      out.push(
        err('MESH_GAP', `Hézag a végeselem-hálóban: x = ${spans[i - 1][1]} és x = ${spans[i][0]} között.`),
      );
    } else if (gap < -1e-9) {
      out.push(
        err('MESH_OVERLAP', `Átfedő végeselemek: x = ${spans[i][0]} és x = ${spans[i - 1][1]} között.`),
      );
    }
  }
}

function checkHistory(model: Model, out: Diagnostic[]): void {
  if (model.history.lambdaTargets.length === 0) {
    out.push(err('EMPTY_HISTORY', 'A tehertörténet üres: legalább egy teherszorzó célértéket meg kell adni.'));
  }
  if (model.history.stepsPerTarget < 1) {
    out.push(err('INVALID_STEPS', 'A teherlépcsők száma célértékenként legalább 1 kell legyen.'));
  }
}

/**
 * A modell teljes validálása.
 * @returns diagnosztikák; a `severity === 'error'` elemek megléte esetén a
 *          modell nem futtatható.
 */
export function validateModel(model: Model): Diagnostic[] {
  const out: Diagnostic[] = [];
  checkDuplicateIds(model, out);
  checkReferences(model, out);
  checkElementGeometry(model, out);
  checkMeshContinuity(model, out);
  checkKinematicStability(model, out);
  checkMaterials(model, out);
  checkSections(model, out);
  checkLoads(model, out);
  checkHistory(model, out);
  return out;
}

/** Igaz, ha a modell futtatható (nincs hiba súlyosságú diagnosztika). */
export const isRunnable = (diagnostics: readonly Diagnostic[]): boolean =>
  !diagnostics.some((d) => d.severity === 'error');
