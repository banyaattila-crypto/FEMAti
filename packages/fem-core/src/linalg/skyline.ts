/**
 * Szimmetrikus skyline (profil) mátrix LDLᵀ faktorizációval.
 *
 * A diplomaterv 3.1.7.3 pontja frontális algoritmust ír le, amelynél a
 * kompilálás és az elimináció nem válik szét. A mai megfelelője a profil-
 * tárolás: „az együtthatómátrixban mindig csak a nem zérus blokksorokat és
 * blokkoszlopokat tároljuk". A frontális megoldó a P17 fázisban külön modulként
 * készül el, a numerikus egyezés tesztjével — ez itt a produkciós út.
 *
 * Tárolás: csak a felső háromszög, oszloponként. Az i. oszlop a `top[i]`…`i`
 * sorokat tartalmazza folytonosan; az átlós elem helye `ptr[i]`, így
 *   A[j][i] = values[ptr[i] − (i − j)]   ha  top[i] ≤ j ≤ i.
 *
 * A faktorizáció in-place: a profil alakja megőrződik (ez a skyline tárolás
 * lényege — a kitöltődés nem lép ki a profilból).
 */

import { assertDim, assertIndex, DimensionError, SingularMatrixError } from './errors.js';
import { DenseMatrix } from './dense.js';

export class SkylineMatrix {
  readonly n: number;
  /** top[i]: az i. oszlop legfelső (legkisebb indexű) tárolt sora. */
  private readonly top: Int32Array;
  /** ptr[i]: az i. átlós elem indexe a `values` tömbben. */
  private readonly ptr: Int32Array;
  private readonly values: Float64Array;
  /** Az LDLᵀ átlós mátrixa a faktorizáció után. */
  private readonly d: Float64Array;
  private factorized = false;
  /** Az eredeti átló legnagyobb abszolút értéke — a pivot-tűréshez. */
  private diagScale = 0;

  private constructor(n: number, top: Int32Array) {
    this.n = n;
    this.top = top;
    this.ptr = new Int32Array(n);
    let p = -1;
    for (let i = 0; i < n; i++) {
      p += i - top[i] + 1;
      this.ptr[i] = p;
    }
    this.values = new Float64Array(n > 0 ? p + 1 : 0);
    this.d = new Float64Array(n);
  }

  /**
   * Mátrix létrehozása a topológiából.
   * @param n a szabadságfokok száma
   * @param groups összekapcsolt szabadságfok-csoportok (elemenként egy csoport).
   *        A −1 értékű bejegyzések (megkötött DOF-ok) figyelmen kívül maradnak.
   */
  static fromConnectivity(n: number, groups: Iterable<ArrayLike<number>>): SkylineMatrix {
    if (!Number.isInteger(n) || n < 0) {
      throw new DimensionError(`Érvénytelen szabadságfok-szám: ${n}.`);
    }
    const top = new Int32Array(n);
    for (let i = 0; i < n; i++) top[i] = i;

    for (const g of groups) {
      let lo = Number.POSITIVE_INFINITY;
      for (let a = 0; a < g.length; a++) {
        const dof = g[a];
        if (dof < 0) continue;
        assertIndex(dof, n, 'skyline topológia');
        if (dof < lo) lo = dof;
      }
      if (!Number.isFinite(lo)) continue;
      for (let a = 0; a < g.length; a++) {
        const dof = g[a];
        if (dof < 0) continue;
        if (lo < top[dof]) top[dof] = lo;
      }
    }
    return new SkylineMatrix(n, top);
  }

  /** Sűrű (teli) profil — kis feladatokhoz és tesztekhez. */
  static full(n: number): SkylineMatrix {
    const top = new Int32Array(n);
    return new SkylineMatrix(n, top);
  }

  /** A tárolt (nem zérus profilon belüli) elemek száma. */
  get storedCount(): number {
    return this.values.length;
  }

  /** Átlagos frontszélesség — a diplomaterv frontális módszerének mérőszáma. */
  get meanBandwidth(): number {
    return this.n === 0 ? 0 : this.values.length / this.n;
  }

  private index(row: number, col: number): number {
    // Csak a felső háromszöget tároljuk: row ≤ col.
    const i = row <= col ? row : col;
    const j = row <= col ? col : row;
    if (i < this.top[j]) {
      throw new DimensionError(
        `A (${row}, ${col}) elem a skyline profilon kívül esik ` +
          `(a(z) ${j}. oszlop a(z) ${this.top[j]}. sortól tárolt). ` +
          `A topológia hiányos: az elemi mátrixok beszúrása előtt a profilt fel kell venni.`,
      );
    }
    return this.ptr[j] - (j - i);
  }

  get(row: number, col: number): number {
    const i = row <= col ? row : col;
    const j = row <= col ? col : row;
    if (j >= this.n || i < 0) throw new DimensionError(`A (${row}, ${col}) index érvénytelen.`);
    if (i < this.top[j]) return 0;
    return this.values[this.ptr[j] - (j - i)];
  }

  set(row: number, col: number, v: number): void {
    this.assertNotFactorized();
    this.values[this.index(row, col)] = v;
  }

  add(row: number, col: number, v: number): void {
    this.assertNotFactorized();
    this.values[this.index(row, col)] += v;
  }

  /** Átlós elem hozzáadása (rugós támasz, penalty). */
  addDiagonal(dof: number, v: number): void {
    this.assertNotFactorized();
    assertIndex(dof, this.n, 'skyline átló');
    this.values[this.ptr[dof]] += v;
  }

  /**
   * Elemi mátrix beszúrása. A `dofs[a] < 0` bejegyzések (megkötött
   * szabadságfokok) kimaradnak — ez az elimináció alapja.
   */
  addBlock(dofs: ArrayLike<number>, ke: DenseMatrix): void {
    this.assertNotFactorized();
    const m = dofs.length;
    assertDim(ke.rows, m, 'elemi mátrix sorai');
    assertDim(ke.cols, m, 'elemi mátrix oszlopai');
    for (let a = 0; a < m; a++) {
      const i = dofs[a];
      if (i < 0) continue;
      for (let b = 0; b < m; b++) {
        const j = dofs[b];
        if (j < 0 || j < i) continue; // csak a felső háromszög
        this.values[this.ptr[j] - (j - i)] += ke.get(a, b);
      }
    }
  }

  /** y = A · x — kizárólag a faktorizáció előtt (utána A helyén L, D áll). */
  multiplyVector(x: Float64Array): Float64Array {
    this.assertNotFactorized();
    assertDim(x.length, this.n, 'skyline mátrix-vektor szorzás');
    const y = new Float64Array(this.n);
    for (let j = 0; j < this.n; j++) {
      const tj = this.top[j];
      const oj = this.ptr[j] - j;
      // átló
      y[j] += this.values[this.ptr[j]] * x[j];
      // az oszlop feletti elemek: szimmetrikus hozzájárulás
      for (let i = tj; i < j; i++) {
        const a = this.values[oj + i];
        if (a === 0) continue;
        y[i] += a * x[j];
        y[j] += a * x[i];
      }
    }
    return y;
  }

  /**
   * LDLᵀ faktorizáció in-place.
   *
   * A = L · D · Lᵀ, ahol L egységátlós alsó háromszög. A tárolt felső
   * háromszögben a faktorizáció után `values[ptr[j] − j + i] = L[j][i]`,
   * az átló pedig a `d` tömbbe kerül.
   *
   * @param tol relatív pivot-tűrés az eredeti átló legnagyobb eleméhez képest
   * @throws SingularMatrixError ha egy pivot numerikusan zérus
   */
  factorize(tol = 1e-12): this {
    if (this.factorized) return this;

    this.diagScale = 0;
    for (let j = 0; j < this.n; j++) {
      this.diagScale = Math.max(this.diagScale, Math.abs(this.values[this.ptr[j]]));
    }
    const eps = tol * (this.diagScale > 0 ? this.diagScale : 1);

    const { top, ptr, values, d, n } = this;

    for (let j = 0; j < n; j++) {
      const tj = top[j];
      const oj = ptr[j] - j;

      // 1) A j. oszlop j feletti elemeinek átalakítása L[j][i]-re.
      for (let i = tj; i < j; i++) {
        const ti = top[i];
        const oi = ptr[i] - i;
        const kStart = ti > tj ? ti : tj;
        let s = values[oj + i];
        for (let k = kStart; k < i; k++) {
          s -= values[oi + k] * d[k] * values[oj + k];
        }
        values[oj + i] = s / d[i];
      }

      // 2) Az átlós elem.
      let s = values[ptr[j]];
      for (let k = tj; k < j; k++) {
        const u = values[oj + k];
        s -= u * u * d[k];
      }

      if (Math.abs(s) <= eps) {
        throw new SingularMatrixError(j, s);
      }
      d[j] = s;
    }

    this.factorized = true;
    return this;
  }

  /** Igaz, ha a mátrix már faktorizált. */
  get isFactorized(): boolean {
    return this.factorized;
  }

  /**
   * Tehetetlenségi szám: a negatív pivotok darabszáma.
   * Stabilitásvizsgálatnál a kihajlott módusok számát adja; lineáris statikai
   * feladatnál értéke 0 kell legyen (a merevségi mátrix pozitív definit).
   */
  get negativePivots(): number {
    if (!this.factorized) {
      throw new Error('A tehetetlenségi szám csak faktorizálás után kérdezhető le.');
    }
    let c = 0;
    for (let j = 0; j < this.n; j++) if (this.d[j] < 0) c++;
    return c;
  }

  /**
   * A faktorizáció átlója (D) — másolat.
   * @throws Error faktorizálás előtt: a nullvektor visszaadása félrevezető lenne.
   */
  diagonal(): Float64Array {
    if (!this.factorized) {
      throw new Error('Az LDLᵀ átlója csak faktorizálás után kérdezhető le.');
    }
    return new Float64Array(this.d);
  }

  /**
   * A·x = b megoldása. A mátrixot szükség esetén faktorizálja.
   * @param b jobboldal; NEM módosul
   * @returns az x megoldásvektor (új tömb)
   */
  solve(b: Float64Array): Float64Array {
    assertDim(b.length, this.n, 'jobboldal');
    if (!this.factorized) this.factorize();
    const x = new Float64Array(b);
    this.solveInPlace(x);
    return x;
  }

  /** Mint a `solve`, de a megadott vektort írja felül (allokációmentes). */
  solveInPlace(x: Float64Array): Float64Array {
    assertDim(x.length, this.n, 'jobboldal');
    if (!this.factorized) {
      throw new Error('A solveInPlace csak faktorizált mátrixon hívható.');
    }
    const { top, ptr, values, d, n } = this;

    // 1) L y = b (előre helyettesítés)
    for (let j = 0; j < n; j++) {
      const oj = ptr[j] - j;
      let s = x[j];
      for (let k = top[j]; k < j; k++) s -= values[oj + k] * x[k];
      x[j] = s;
    }

    // 2) D z = y
    for (let j = 0; j < n; j++) x[j] /= d[j];

    // 3) Lᵀ x = z (hátra helyettesítés, oszloponként)
    for (let j = n - 1; j >= 0; j--) {
      const oj = ptr[j] - j;
      const xj = x[j];
      if (xj === 0) continue;
      for (let k = top[j]; k < j; k++) x[k] -= values[oj + k] * xj;
    }
    return x;
  }

  /** Sűrű másolat — kizárólag tesztekhez és kis feladatok ellenőrzéséhez. */
  toDense(): DenseMatrix {
    this.assertNotFactorized();
    const a = new DenseMatrix(this.n, this.n);
    for (let j = 0; j < this.n; j++) {
      for (let i = this.top[j]; i <= j; i++) {
        const v = this.values[this.ptr[j] - (j - i)];
        a.set(i, j, v);
        a.set(j, i, v);
      }
    }
    return a;
  }

  private assertNotFactorized(): void {
    if (this.factorized) {
      throw new Error('A mátrix már faktorizált: az együtthatók nem módosíthatók. ' + 'Új terhelési lépéshez építsen új mátrixot.');
    }
  }
}
