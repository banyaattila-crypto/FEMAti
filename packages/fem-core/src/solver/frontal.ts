/**
 * Frontális megoldó — Diplomaterv 3.1.7.3: "A program a frontális algoritmust
 * alkalmazza, így nincs szükség arra, hogy a teljes globális merevségi
 * mátrixot illetve tehervektort összekompiláljuk. […] Az ún. frontális
 * módszernél nem a csomópontok, hanem a rudak sorszámozása határozza meg a
 * számítás időigényét. […] nem állítjuk elő előre a teljes szerkezet
 * merevségi mátrixát, hanem a kompiláltás közben a már végrehajtható
 * műveleteket elvégezzük. […] Ha egy rúd merevségi mátrixának blokkjait
 * elhelyeztük az aktuális együtthatómátrixba és a rúdnak van olyan
 * csomópontja, melyhez nem kapcsolódik nagyobb sorszámú rúd, akkor ennek a
 * csomópontnak az elmozdulása kifejezhető a többi éppen aktuális csomópont
 * elmozdulásának függvényében. […] Az aktuális egyenletrendszer mérete
 * lépésenként változhat, vagyis változó méretű ismeretlenszámmal (ún.
 * frontszélességgel) dolgozunk. A Gauss elimináció alkalmazása során a
 * k-adik sor kiküszöbölése az a'ij = aij − aik·akj/akk formula szerint
 * módosítja a még fennmaradt sorok elemeit."
 *
 * CÉL (P17, MASTER-PROMPT-TERV): NEM teljesítmény — hitelesség és didaktika.
 * A produkciós megoldó a Skyline-LDLᵀ (`linearSolver.ts`, ADR-0002); ez a
 * modul a diplomaterv EREDETI 1996-os algoritmusát mutatja be, az ELEM-
 * sorszámozás (nem csomópont-sorszámozás) által vezérelt, VÁLTOZÓ MÉRETŰ
 * "front" fokozatos kiküszöbölésével — ugyanazt a Kv=q rendszert oldja meg,
 * mint a Skyline, csak más sorrendben (elimináció ↔ kompilálás egyszerre,
 * a diplomaterv saját szavaival "nem válik szét").
 *
 * KÖTELEZŐ GARANCIA (P17 elfogadási kritérium): az eredmény 1e−10 relatív
 * pontossággal egyezik a Skyline-LDLᵀ eredményével — ld. `frontal.test.ts`.
 */
import { SingularMatrixError } from '../linalg/errors.js';
import { assemble, type AssembledSystem, type PreparedElement } from '../assembly/assembler.js';
import { buildLoadVector } from '../assembly/loadVector.js';
import type { DofMap } from './../assembly/dofMap.js';
import type { Model } from '../model/types.js';

/** Relatív pivot-tűrés az eredeti átló legnagyobb eleméhez képest — ld. `SkylineMatrix.factorize`. */
const SINGULAR_REL_TOL = 1e-12;

/** Egy elem feldolgozásának naplója — a front kialakulásának/mozgásának bemutatásához (P17). */
export interface FrontalStep {
  readonly elementIndex: number;
  readonly elementId: string;
  /** Az EBBEN a lépésben a frontba lépő (korábban még nem szereplő) szabadságfokok. */
  readonly enteredDofs: readonly number[];
  /** A front szélessége az elem beépítése UTÁN, a kiküszöbölés ELŐTT. */
  readonly frontWidthAfterAssembly: number;
  /** Az EBBEN a lépésben kiküszöbölt (a rúdnak volt az utolsó, rá ható eleme) szabadságfokok. */
  readonly eliminatedDofs: readonly number[];
  /** A front szélessége a kiküszöbölés UTÁN. */
  readonly frontWidthAfterElimination: number;
}

export interface FrontalResult {
  /** A teljes elmozdulásvektor (megkötött szabadságfokoknál az előírt érték). */
  readonly displacements: Float64Array;
  readonly steps: readonly FrontalStep[];
  readonly maxFrontWidth: number;
  readonly meanFrontWidth: number;
  /** Összevetéshez: a Skyline-tárolás átlagos sávszélessége UGYANERRE a modellre. */
  readonly skylineMeanBandwidth: number;
  readonly system: AssembledSystem;
}

interface EliminationRecord {
  readonly dof: number;
  readonly otherDofs: readonly number[];
  readonly coeffs: readonly number[];
  readonly pivot: number;
  readonly rhs: number;
}

/** Rugós támaszok (csomóponti rugók) főátlós hozzájárulása szabadságfokonként. */
function springDiagonal(model: Model, map: DofMap): Float64Array {
  const out = new Float64Array(map.totalDofs);
  for (const b of model.boundaries) {
    const i = map.nodeIndex.get(b.nodeId as string);
    if (i === undefined) continue;
    if (b.springW !== undefined) out[2 * i] += b.springW as number;
    if (b.springPhi !== undefined) out[2 * i + 1] += b.springPhi as number;
  }
  return out;
}

/** Az a rúd-sorszám, amelyiknek EZ az UTOLSÓ (legnagyobb sorszámú) rá ható eleme. */
function computeLastElementForDof(elements: readonly PreparedElement[], map: DofMap): Map<number, number> {
  const lastElement = new Map<number, number>();
  elements.forEach((e, k) => {
    for (const d of e.dofs) {
      if (map.prescribed[d] === 1) continue;
      const prev = lastElement.get(d);
      if (prev === undefined || k > prev) lastElement.set(d, k);
    }
  });
  return lastElement;
}

/**
 * A szerkezet lineáris megoldása FRONTÁLIS algoritmussal (Diplomaterv 3.1.7.3).
 *
 * @throws SingularMatrixError ha egy pivot elem a gépi pontosság alá esik
 *         (a szerkezet mechanizmus, vagy hiányzik egy megtámasztás)
 */
export function solveFrontal(model: Model): FrontalResult {
  const system = assemble(model, { strategy: 'elimination' });
  const { map, elements } = system;
  const loads = buildLoadVector(model, map, 1);
  const springDiag = springDiagonal(model, map);
  const lastElementForDof = computeLastElementForDof(elements, map);

  // Az eredeti (kompilálatlan) átló legnagyobb abszolút eleme — a pivot-tűrés
  // skálázásához, ugyanúgy, mint a Skyline `factorize()`-nál (relatív, nem
  // abszolút tűrés, mert az abszolút stiffness-értékek nagyságrendje modellről
  // modellre erősen változik).
  const assembledDiag = new Float64Array(map.totalDofs);
  for (const e of elements) {
    for (let a = 0; a < 6; a++) {
      const da = e.dofs[a] ?? 0;
      if (map.prescribed[da] === 1) continue;
      assembledDiag[da] = (assembledDiag[da] ?? 0) + e.keEffective.get(a, a);
    }
  }
  let diagScale = 0;
  for (let d = 0; d < map.totalDofs; d++) {
    diagScale = Math.max(diagScale, Math.abs((assembledDiag[d] ?? 0) + (springDiag[d] ?? 0)));
  }
  const pivotEps = SINGULAR_REL_TOL * (diagScale > 0 ? diagScale : 1);

  const front: number[] = [];
  const mat: number[][] = [];
  const rhs: number[] = [];
  const inFront = new Map<number, number>();

  const eliminationLog: EliminationRecord[] = [];
  const steps: FrontalStep[] = [];
  let maxFrontWidth = 0;
  let widthSum = 0;

  const addToFront = (dof: number): void => {
    inFront.set(dof, front.length);
    front.push(dof);
    for (const row of mat) row.push(0);
    mat.push(new Array(front.length).fill(0) as number[]);
    rhs.push(loads.full[dof] ?? 0);
  };

  const rebuildIndex = (): void => {
    inFront.clear();
    front.forEach((dof, i) => inFront.set(dof, i));
  };

  const eliminate = (p: number): void => {
    const pivot = mat[p]?.[p] ?? 0;
    if (!Number.isFinite(pivot) || Math.abs(pivot) <= pivotEps) {
      throw new SingularMatrixError(front[p] ?? -1, pivot);
    }
    const otherIdx = front.map((_, i) => i).filter((i) => i !== p);
    const otherDofs = otherIdx.map((i) => front[i] ?? -1);
    const pivotRow = mat[p] ?? [];
    const coeffs = otherIdx.map((i) => pivotRow[i] ?? 0);
    const pivotRhs = rhs[p] ?? 0;

    eliminationLog.push({ dof: front[p] ?? -1, otherDofs, coeffs, pivot, rhs: pivotRhs });

    // a'ij = aij − aip·apj/akk (Diplomaterv 3.1.7.3 formulája)
    for (const i of otherIdx) {
      const rowI = mat[i] ?? [];
      const factor = (rowI[p] ?? 0) / pivot;
      if (factor !== 0) {
        for (const j of otherIdx) {
          rowI[j] = (rowI[j] ?? 0) - factor * (pivotRow[j] ?? 0);
        }
        rhs[i] = (rhs[i] ?? 0) - factor * pivotRhs;
      }
    }

    front.splice(p, 1);
    mat.splice(p, 1);
    for (const row of mat) row.splice(p, 1);
    rhs.splice(p, 1);
    rebuildIndex();
  };

  elements.forEach((e, k) => {
    const enteredDofs: number[] = [];
    for (const d of e.dofs) {
      if (map.prescribed[d] === 1) continue;
      if (!inFront.has(d)) {
        addToFront(d);
        enteredDofs.push(d);
        const p = inFront.get(d);
        if (p !== undefined && springDiag[d] !== 0) {
          const row = mat[p];
          if (row !== undefined) row[p] = (row[p] ?? 0) + (springDiag[d] ?? 0);
        }
      }
    }

    for (let a = 0; a < 6; a++) {
      const da = e.dofs[a] ?? 0;
      if (map.prescribed[da] === 1) continue;
      const pa = inFront.get(da);
      if (pa === undefined) continue;
      const rowA = mat[pa];
      if (rowA === undefined) continue;
      for (let b = 0; b < 6; b++) {
        const db = e.dofs[b] ?? 0;
        const value = e.keEffective.get(a, b);
        if (map.prescribed[db] === 1) {
          // Előírt támaszmozgás hatása a jobboldalra (3.1.7.2, ld. assembler.ts elimination ága).
          const presc = map.prescribedValue[db] ?? 0;
          if (presc !== 0) rhs[pa] = (rhs[pa] ?? 0) - value * presc;
          continue;
        }
        const pb = inFront.get(db);
        if (pb === undefined) continue;
        rowA[pb] = (rowA[pb] ?? 0) + value;
      }
    }

    const frontWidthAfterAssembly = front.length;
    maxFrontWidth = Math.max(maxFrontWidth, frontWidthAfterAssembly);
    widthSum += frontWidthAfterAssembly;

    const eliminatedDofs: number[] = [];
    for (const dof of [...front]) {
      if (lastElementForDof.get(dof) !== k) continue;
      const p = inFront.get(dof);
      if (p === undefined) continue;
      eliminate(p);
      eliminatedDofs.push(dof);
    }

    steps.push({
      elementIndex: k,
      elementId: e.id,
      enteredDofs,
      frontWidthAfterAssembly,
      eliminatedDofs,
      frontWidthAfterElimination: front.length,
    });
  });

  if (front.length > 0) {
    throw new Error(
      `A frontális megoldás után ${front.length} szabadságfok nem küszöbölődött ki — ` +
        'a szerkezet valószínűleg nem összefüggő, vagy a rudak sorszámozása nem sorozatos.',
    );
  }

  // Visszahelyettesítés — FORDÍTOTT kiküszöbölési sorrendben: egy DOF
  // egyenlete csak olyan másik DOF-okra hivatkozik, amelyek VELE EGYIDŐBEN
  // vagy NÁLA KÉSŐBB küszöbölődtek ki — ezért fordított sorrendben haladva
  // minden hivatkozott érték már ismert.
  const values = new Map<number, number>();
  for (let i = eliminationLog.length - 1; i >= 0; i--) {
    const rec = eliminationLog[i];
    if (rec === undefined) continue;
    let sum = rec.rhs;
    for (let j = 0; j < rec.otherDofs.length; j++) {
      const otherDof = rec.otherDofs[j] ?? -1;
      const coeff = rec.coeffs[j] ?? 0;
      sum -= coeff * (values.get(otherDof) ?? 0);
    }
    values.set(rec.dof, sum / rec.pivot);
  }

  const displacements = new Float64Array(map.totalDofs);
  for (let d = 0; d < map.totalDofs; d++) {
    displacements[d] = map.prescribed[d] === 1 ? (map.prescribedValue[d] ?? 0) : (values.get(d) ?? 0);
  }

  return {
    displacements,
    steps,
    maxFrontWidth,
    meanFrontWidth: elements.length > 0 ? widthSum / elements.length : 0,
    skylineMeanBandwidth: system.k.meanBandwidth,
    system,
  };
}
