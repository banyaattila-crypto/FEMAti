/**
 * Sajátérték-megoldó sűrű, szimmetrikus mátrixokra — ADR-0016 (modális
 * analízis), 2. nyitott kérdés.
 *
 * Az általánosított feladat (K·φ = ω²·M·φ, K és M szimmetrikus, M pozitív
 * definit) megoldása a szokásos két lépésben:
 *
 *   1) M = L·Lᵀ (Cholesky), majd a kongruens transzformáció
 *      A = L⁻¹·K·L⁻ᵀ  →  standard szimmetrikus sajátérték-feladat: A·y = λ·y
 *   2) A·y = λ·y megoldása ciklikus Jacobi-forgatással (Jacobi eigenvalue
 *      algorithm) — egyszerű, robusztus, kis/közepes sűrű mátrixra jól
 *      validálható (minden lépés ellenőrizhető A·v=λ·v és ortonormáltsággal).
 *
 * Az eredeti sajátvektor: x = L⁻ᵀ·y (levezetés a `generalizedSymmetricEigen`
 * dokumentációjában).
 *
 * Ez az ELSŐ, dense implementáció — kis DOF-számú modellekre (ld. ADR-0016).
 * Nagyobb rendszerekre (pl. subspace iteráció, Lanczos) egy KÉSŐBBI, mért
 * teljesítmény-igény alapján meghozott döntés lenne (ADR-0009 mintájára: nem
 * találgatunk, mérünk).
 */

import { assertDim } from './errors.js';
import { DenseMatrix } from './dense.js';
import { NotPositiveDefiniteError } from './errors.js';

export interface EigenResult {
  /** Sajátértékek, NÖVEKVŐ sorrendben. */
  readonly values: Float64Array;
  /** A sajátvektorok OSZLOPONKÉNT, a `values`-szel azonos sorrendben. */
  readonly vectors: DenseMatrix;
}

// ─── Cholesky-felbontás ─────────────────────────────────────────────────────

/**
 * Alsó háromszög Cholesky-felbontás: A = L·Lᵀ.
 * @throws NotPositiveDefiniteError ha A nem pozitív definit
 */
export function cholesky(a: DenseMatrix): DenseMatrix {
  const n = a.rows;
  assertDim(a.cols, n, 'Cholesky-felbontás (négyzetes mátrix)');
  const l = new DenseMatrix(n, n);

  for (let j = 0; j < n; j++) {
    let d = a.get(j, j);
    for (let k = 0; k < j; k++) d -= l.get(j, k) * l.get(j, k);
    if (!(d > 0)) throw new NotPositiveDefiniteError(j);
    const ljj = Math.sqrt(d);
    l.set(j, j, ljj);

    for (let i = j + 1; i < n; i++) {
      let s = a.get(i, j);
      for (let k = 0; k < j; k++) s -= l.get(i, k) * l.get(j, k);
      l.set(i, j, s / ljj);
    }
  }
  return l;
}

/**
 * A·x = b megoldása, A MÁR Cholesky-felbontott alakjából (`L`, A=L·Lᵀ):
 * L·y=b előre, majd Lᵀ·x=y hátra helyettesítéssel. Ismételt jobboldalakra
 * (pl. Newmark-β minden időlépésben ugyanazzal az effektív merevségi
 * mátrixszal, ld. `solver/transient.ts`) az `L`-t csak EGYSZER kell
 * előállítani.
 */
export function choleskySolve(l: DenseMatrix, b: Float64Array): Float64Array {
  return backSubstituteTranspose(l, forwardSubstitute(l, b));
}

/** L·x = b előre helyettesítéssel (L alsó háromszög, nem szinguláris). */
function forwardSubstitute(l: DenseMatrix, b: Float64Array): Float64Array {
  const n = l.rows;
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = b[i] ?? 0;
    for (let k = 0; k < i; k++) s -= l.get(i, k) * (x[k] ?? 0);
    x[i] = s / l.get(i, i);
  }
  return x;
}

/** Lᵀ·x = b hátra helyettesítéssel. */
function backSubstituteTranspose(l: DenseMatrix, b: Float64Array): Float64Array {
  const n = l.rows;
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i] ?? 0;
    for (let k = i + 1; k < n; k++) s -= l.get(k, i) * (x[k] ?? 0);
    x[i] = s / l.get(i, i);
  }
  return x;
}

function extractColumn(m: DenseMatrix, c: number): Float64Array {
  const v = new Float64Array(m.rows);
  for (let i = 0; i < m.rows; i++) v[i] = m.get(i, c);
  return v;
}

function extractRow(m: DenseMatrix, r: number): Float64Array {
  const v = new Float64Array(m.cols);
  for (let j = 0; j < m.cols; j++) v[j] = m.get(r, j);
  return v;
}

/**
 * A = L⁻¹·K·L⁻ᵀ — a kongruens transzformáció, ami a K·φ=λ·M·φ általánosított
 * feladatot standard A·y=λ·y feladattá alakítja (M = L·Lᵀ).
 *
 * Levezetés: A·y=λ·y ⟺ L⁻¹·K·L⁻ᵀ·y=λ·y ⟺ K·(L⁻ᵀ·y)=λ·L·y ⟺ K·x=λ·M·x, ha
 * x=L⁻ᵀ·y (mert M·x = L·Lᵀ·L⁻ᵀ·y = L·y).
 */
function congruentTransform(k: DenseMatrix, l: DenseMatrix): DenseMatrix {
  const n = k.rows;
  // Y = L⁻¹·K (oszloponként)
  const y = new DenseMatrix(n, n);
  for (let c = 0; c < n; c++) {
    const col = forwardSubstitute(l, extractColumn(k, c));
    for (let i = 0; i < n; i++) y.set(i, c, col[i] ?? 0);
  }
  // A = Y·L⁻ᵀ, kihasználva, hogy A szimmetrikus: A oszlopa = L⁻¹·(Y megfelelő sora)
  const a = new DenseMatrix(n, n);
  for (let c = 0; c < n; c++) {
    const col = forwardSubstitute(l, extractRow(y, c));
    for (let i = 0; i < n; i++) a.set(i, c, col[i] ?? 0);
  }
  // Kerekítési zaj miatti apró aszimmetria eltüntetése.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const avg = (a.get(i, j) + a.get(j, i)) / 2;
      a.set(i, j, avg);
      a.set(j, i, avg);
    }
  }
  return a;
}

// ─── Standard szimmetrikus sajátérték-feladat: ciklikus Jacobi ─────────────

/**
 * Szimmetrikus mátrix sajátfelbontása ciklikus Jacobi-forgatással.
 *
 * Minden sweepben az összes (p,q), p<q páron egy forgatás nullázza az
 * a[p][q] elemet; a Frobenius-normában mért off-diagonális "energia"
 * monoton csökken, a módszer konvergenciája klasszikus eredmény (nincs QR-
 * lépés, nincs shift-heurisztika — ez a robusztussága ára a sebességgel
 * szemben, kis/közepes n-re elfogadható, ld. ADR-0016).
 */
export function jacobiEigenSymmetric(aIn: DenseMatrix, maxSweeps = 100, tol = 1e-13): EigenResult {
  const n = aIn.rows;
  assertDim(aIn.cols, n, 'Jacobi sajátérték-felbontás (négyzetes mátrix)');
  const a = aIn.clone();
  const v = DenseMatrix.identity(n);

  const offNorm = (): number => {
    let s = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) s += a.get(p, q) ** 2;
    return Math.sqrt(s);
  };

  const scale = Math.max(a.maxAbs(), 1e-300);

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    if (offNorm() < tol * scale) break;

    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a.get(p, q);
        if (Math.abs(apq) < 1e-300) continue;

        const app = a.get(p, p);
        const aqq = a.get(q, q);
        const theta = (aqq - app) / (2 * apq);
        const sign = theta >= 0 ? 1 : -1;
        const t = sign / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;

        // A p,q-hoz tartozó bejegyzések a rotáció DEFINÍCIÓJA szerint (a_pq → 0):
        a.set(p, p, app - t * apq);
        a.set(q, q, aqq + t * apq);
        a.set(p, q, 0);
        a.set(q, p, 0);

        // A többi (i≠p,q) sor/oszlop — a RÉGI (forgatás előtti) p/q oszlop
        // értékeiből, EGYETLEN, konzisztens lépésben (nem két külön, egymást
        // felülíró ciklusban — az volt az eredeti hiba: a p,q diagonális
        // bejegyzéseket két, egymásnak ellentmondó képlet írta felül).
        for (let i = 0; i < n; i++) {
          if (i === p || i === q) continue;
          const aip = a.get(i, p);
          const aiq = a.get(i, q);
          const newAip = c * aip - s * aiq;
          const newAiq = s * aip + c * aiq;
          a.set(i, p, newAip);
          a.set(p, i, newAip);
          a.set(i, q, newAiq);
          a.set(q, i, newAiq);
        }

        for (let i = 0; i < n; i++) {
          const vip = v.get(i, p);
          const viq = v.get(i, q);
          v.set(i, p, c * vip - s * viq);
          v.set(i, q, s * vip + c * viq);
        }
      }
    }
  }

  const order = Array.from({ length: n }, (_, i) => i).sort((x, y) => a.get(x, x) - a.get(y, y));
  const values = new Float64Array(n);
  const vectors = new DenseMatrix(n, n);
  order.forEach((originalIndex, sortedIndex) => {
    values[sortedIndex] = a.get(originalIndex, originalIndex);
    for (let i = 0; i < n; i++) vectors.set(i, sortedIndex, v.get(i, originalIndex));
  });

  return { values, vectors };
}

// ─── Általánosított szimmetrikus sajátérték-feladat ────────────────────────

/**
 * K·φ = λ·M·φ megoldása. K és M szimmetrikus; M-nek pozitív definitnek kell
 * lennie (ez fizikailag mindig teljesül egy valódi tömegmátrixra, amíg
 * minden aktív szabadságfokhoz tartozik tömeg).
 *
 * @returns λ (növekvő sorrendben) és a hozzá tartozó, M-ORTONORMÁLT
 *          sajátvektorok (φᵢᵀ·M·φⱼ = δᵢⱼ) — ez a levezetésből automatikusan
 *          adódik, ld. a modul fejlécét.
 * @throws NotPositiveDefiniteError ha M nem pozitív definit
 */
export function generalizedSymmetricEigen(k: DenseMatrix, m: DenseMatrix): EigenResult {
  const n = k.rows;
  assertDim(k.cols, n, 'K mátrix (négyzetes)');
  assertDim(m.rows, n, 'M mátrix sorai');
  assertDim(m.cols, n, 'M mátrix oszlopai');

  const l = cholesky(m);
  const a = congruentTransform(k, l);
  const std = jacobiEigenSymmetric(a);

  const vectors = new DenseMatrix(n, n);
  for (let c = 0; c < n; c++) {
    const x = backSubstituteTranspose(l, extractColumn(std.vectors, c));
    for (let i = 0; i < n; i++) vectors.set(i, c, x[i] ?? 0);
  }

  return { values: std.values, vectors };
}
