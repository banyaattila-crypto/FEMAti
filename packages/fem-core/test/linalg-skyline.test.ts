import { describe, expect, it } from 'vitest';
import { DenseMatrix, maxAbsDiff, norm2 } from '../src/linalg/dense.js';
import { DimensionError, SingularMatrixError } from '../src/linalg/errors.js';
import { SkylineMatrix } from '../src/linalg/skyline.js';
import { denseSolve, makeRng, randomSPD, relativeError } from './helpers/denseSolve.js';

/** Sűrű mátrix betöltése teli profilú skyline mátrixba. */
function skylineFromDense(a: DenseMatrix): SkylineMatrix {
  const s = SkylineMatrix.full(a.rows);
  for (let i = 0; i < a.rows; i++) {
    for (let j = i; j < a.cols; j++) s.set(i, j, a.get(i, j));
  }
  return s;
}

describe('LDLᵀ — kézzel ellenőrzött referencia', () => {
  /**
   * A klasszikus tesztmátrix:
   *   A = [[  4,  12, -16],
   *        [ 12,  37, -43],
   *        [-16, -43,  98]]
   * Kézi LDLᵀ felbontása:
   *   D = diag(4, 1, 9)
   *   L = [[1,0,0], [3,1,0], [-4,5,1]]
   * Ellenőrzés: L·D·Lᵀ visszaadja A-t (a levezetés a tesztben szerepel).
   */
  const A = DenseMatrix.fromRows([
    [4, 12, -16],
    [12, 37, -43],
    [-16, -43, 98],
  ]);

  it('az átlós mátrix D = diag(4, 1, 9)', () => {
    const s = skylineFromDense(A).factorize();
    const d = s.diagonal();
    expect(d[0]).toBeCloseTo(4, 12);
    expect(d[1]).toBeCloseTo(1, 12);
    expect(d[2]).toBeCloseTo(9, 12);
  });

  it('az L tényezők a tárolt felső háromszögben állnak elő', () => {
    const s = skylineFromDense(A).factorize();
    // A tárolás szerint values[ptr[j] − j + i] = L[j][i].
    expect(s.get(0, 1)).toBeCloseTo(3, 12); // L[1][0]
    expect(s.get(0, 2)).toBeCloseTo(-4, 12); // L[2][0]
    expect(s.get(1, 2)).toBeCloseTo(5, 12); // L[2][1]
  });

  it('a megoldás egyezik a független Gauss-eliminációval', () => {
    const b = Float64Array.from([1, 2, 3]);
    const skyline = skylineFromDense(A).solve(b);
    const reference = denseSolve(A, b);
    expect(relativeError(skyline, reference)).toBeLessThan(1e-12);
  });

  it('a mátrix pozitív definit: nincs negatív pivot', () => {
    const s = skylineFromDense(A).factorize();
    expect(s.negativePivots).toBe(0);
  });
});

describe('profil-tárolás', () => {
  it('a topológia szűkíti a profilt', () => {
    // Láncszerű összeköttetés: 0-1, 1-2, 2-3 → sávmátrix.
    const s = SkylineMatrix.fromConnectivity(4, [
      [0, 1],
      [1, 2],
      [2, 3],
    ]);
    // Teli profil 4×4-re: 1+2+3+4 = 10 tárolt elem. Sávosan: 1+2+2+2 = 7.
    expect(s.storedCount).toBe(7);
    expect(SkylineMatrix.full(4).storedCount).toBe(10);
  });

  it('a −1 jelű (megkötött) szabadságfokok nem tágítják a profilt', () => {
    const a = SkylineMatrix.fromConnectivity(3, [[-1, 0, 1]]);
    const b = SkylineMatrix.fromConnectivity(3, [[0, 1]]);
    expect(a.storedCount).toBe(b.storedCount);
  });

  it('érvénytelen szabadságfok-indexre hibát dob', () => {
    expect(() => SkylineMatrix.fromConnectivity(3, [[0, 5]])).toThrow(DimensionError);
    expect(() => SkylineMatrix.fromConnectivity(-1, [])).toThrow(DimensionError);
  });

  it('a profilon kívüli írás hibát ad, nem néma adatvesztést', () => {
    const s = SkylineMatrix.fromConnectivity(4, [
      [0, 1],
      [2, 3],
    ]);
    // A 0. és 3. szabadságfok nincs összekötve → a (0,3) elem a profilon kívül.
    expect(() => s.set(0, 3, 1)).toThrow(DimensionError);
  });

  it('a profilon kívüli olvasás zérust ad', () => {
    const s = SkylineMatrix.fromConnectivity(4, [
      [0, 1],
      [2, 3],
    ]);
    expect(s.get(0, 3)).toBe(0);
  });

  it('az átlagos frontszélesség a profil mérőszáma', () => {
    const band = SkylineMatrix.fromConnectivity(
      10,
      Array.from({ length: 9 }, (_, i) => [i, i + 1]),
    );
    expect(band.meanBandwidth).toBeLessThan(SkylineMatrix.full(10).meanBandwidth);
  });
});

describe('elemi mátrix beszúrása (addBlock)', () => {
  it('szimmetrikusan halmoz és tiszteli a −1 kihagyást', () => {
    const s = SkylineMatrix.fromConnectivity(3, [[0, 1, 2]]);
    const ke = DenseMatrix.fromRows([
      [2, -1, 0],
      [-1, 2, -1],
      [0, -1, 2],
    ]);
    s.addBlock(Int32Array.from([0, 1, 2]), ke);
    expect(s.get(0, 0)).toBe(2);
    expect(s.get(0, 1)).toBe(-1);
    expect(s.get(1, 2)).toBe(-1);

    // Ugyanaz a blokk mégegyszer: az értékek összeadódnak.
    s.addBlock(Int32Array.from([0, 1, 2]), ke);
    expect(s.get(0, 0)).toBe(4);
  });

  it('a megkötött szabadságfok sora és oszlopa kimarad', () => {
    const s = SkylineMatrix.fromConnectivity(2, [[0, 1]]);
    const ke = DenseMatrix.fromRows([
      [5, 7],
      [7, 9],
    ]);
    // Az első DOF megkötött (−1): csak a második átlós elem kerül be.
    s.addBlock(Int32Array.from([-1, 1]), ke);
    expect(s.get(0, 0)).toBe(0);
    expect(s.get(0, 1)).toBe(0);
    expect(s.get(1, 1)).toBe(9);
  });

  it('nem illeszkedő elemi mátrix méretére hibát dob', () => {
    const s = SkylineMatrix.full(3);
    expect(() => s.addBlock(Int32Array.from([0, 1]), DenseMatrix.zeros(3, 3))).toThrow(DimensionError);
  });
});

describe('mátrix-vektor szorzás', () => {
  it('egyezik a sűrű szorzással', () => {
    const rng = makeRng(3);
    for (let trial = 0; trial < 25; trial++) {
      const n = 2 + Math.floor(rng() * 8);
      const a = randomSPD(n, rng);
      const s = skylineFromDense(a);
      const x = Float64Array.from({ length: n }, () => rng() * 2 - 1);
      expect(maxAbsDiff(s.multiplyVector(x), a.multiplyVector(x))).toBeLessThan(1e-10);
    }
  });

  it('faktorizálás után már nem hívható', () => {
    const s = skylineFromDense(DenseMatrix.identity(3)).factorize();
    expect(() => s.multiplyVector(Float64Array.from([1, 2, 3]))).toThrow();
  });
});

describe('megoldás — a skyline és a sűrű út egyezése', () => {
  it('100 véletlen SPD feladaton a relatív eltérés < 1e-10', () => {
    const rng = makeRng(1234);
    let worst = 0;
    for (let trial = 0; trial < 100; trial++) {
      const n = 2 + Math.floor(rng() * 10);
      const a = randomSPD(n, rng);
      const b = Float64Array.from({ length: n }, () => rng() * 20 - 10);

      const xSkyline = skylineFromDense(a).solve(b);
      const xDense = denseSolve(a, b);
      worst = Math.max(worst, relativeError(xSkyline, xDense));
    }
    expect(worst).toBeLessThan(1e-10);
  });

  it('a megoldás visszahelyettesítve visszaadja a jobboldalt', () => {
    const rng = makeRng(99);
    for (let trial = 0; trial < 40; trial++) {
      const n = 3 + Math.floor(rng() * 12);
      const a = randomSPD(n, rng);
      const b = Float64Array.from({ length: n }, () => rng() * 10 - 5);

      const x = skylineFromDense(a).solve(b);
      const residual = a.multiplyVector(x);
      for (let i = 0; i < n; i++) residual[i] -= b[i];

      expect(norm2(residual) / Math.max(norm2(b), 1e-300)).toBeLessThan(1e-10);
    }
  });

  it('ismert megoldásra: A·x_várt = b esetén visszakapjuk x_vártat', () => {
    const rng = makeRng(555);
    for (let trial = 0; trial < 30; trial++) {
      const n = 3 + Math.floor(rng() * 8);
      const a = randomSPD(n, rng);
      const expected = Float64Array.from({ length: n }, () => rng() * 4 - 2);
      const b = a.multiplyVector(expected);

      const x = skylineFromDense(a).solve(b);
      expect(relativeError(x, expected)).toBeLessThan(1e-9);
    }
  });

  it('sávos profilon ugyanaz jön ki, mint teli profilon', () => {
    const rng = makeRng(2024);
    const n = 12;
    // Sávmátrix: A[i][j] ≠ 0 csak |i−j| ≤ 2 esetén.
    const dense = DenseMatrix.zeros(n, n);
    for (let i = 0; i < n; i++) {
      dense.set(i, i, 4 + rng());
      for (let k = 1; k <= 2 && i + k < n; k++) {
        const v = rng() - 0.5;
        dense.set(i, i + k, v);
        dense.set(i + k, i, v);
      }
    }
    const groups: number[][] = [];
    for (let i = 0; i + 2 < n; i++) groups.push([i, i + 1, i + 2]);

    const banded = SkylineMatrix.fromConnectivity(n, groups);
    for (let i = 0; i < n; i++) {
      for (let j = i; j < Math.min(n, i + 3); j++) banded.set(i, j, dense.get(i, j));
    }

    const b = Float64Array.from({ length: n }, () => rng() * 6 - 3);
    const xBanded = banded.solve(b);
    const xFull = skylineFromDense(dense).solve(b);

    expect(relativeError(xBanded, xFull)).toBeLessThan(1e-10);
    expect(banded.storedCount).toBeLessThan(skylineFromDense(dense).storedCount);
  });

  it('a solveInPlace ugyanazt adja, mint a solve', () => {
    const a = randomSPD(6, makeRng(17));
    const b = Float64Array.from([1, -2, 3, -4, 5, -6]);
    const s = skylineFromDense(a).factorize();
    const x1 = s.solve(b);
    const x2 = Float64Array.from(b);
    s.solveInPlace(x2);
    expect(maxAbsDiff(x1, x2)).toBe(0);
  });

  it('a jobboldalt nem módosítja', () => {
    const a = randomSPD(4, makeRng(21));
    const b = Float64Array.from([1, 2, 3, 4]);
    const original = Float64Array.from(b);
    skylineFromDense(a).solve(b);
    expect([...b]).toEqual([...original]);
  });
});

describe('szinguláris és indefinit esetek', () => {
  it('zérus sorra SingularMatrixError, a szabadságfok megjelölésével', () => {
    // A 2. szabadságfoknak nincs merevsége — statikailag: szabadon lógó csomópont.
    const s = SkylineMatrix.full(3);
    s.set(0, 0, 2);
    s.set(0, 1, -1);
    s.set(1, 1, 2);
    // a (2,2) elem marad 0
    let caught: SingularMatrixError | null = null;
    try {
      s.factorize();
    } catch (e) {
      caught = e as SingularMatrixError;
    }
    expect(caught).toBeInstanceOf(SingularMatrixError);
    expect(caught?.dof).toBe(2);
    expect(caught?.message).toContain('szinguláris');
  });

  it('szinguláris mátrixon nem NaN jön ki, hanem kivétel', () => {
    const s = SkylineMatrix.full(2);
    s.set(0, 0, 1);
    s.set(0, 1, 1);
    s.set(1, 1, 1); // det = 0
    expect(() => s.solve(Float64Array.from([1, 1]))).toThrow(SingularMatrixError);
  });

  it('indefinit mátrixon a negatív pivotok megszámlálhatók', () => {
    const s = SkylineMatrix.full(2);
    s.set(0, 0, 1);
    s.set(0, 1, 0);
    s.set(1, 1, -3);
    s.factorize();
    expect(s.negativePivots).toBe(1);
  });

  it('faktorizálás előtt a tehetetlenségi szám nem kérdezhető le', () => {
    const s = SkylineMatrix.full(2);
    expect(() => s.negativePivots).toThrow();
  });
});

describe('állapotvédelem', () => {
  it('faktorizálás után az együtthatók nem módosíthatók', () => {
    const s = skylineFromDense(DenseMatrix.identity(3)).factorize();
    expect(() => s.set(0, 0, 5)).toThrow(/faktorizált/);
    expect(() => s.add(0, 0, 5)).toThrow(/faktorizált/);
    expect(() => s.addDiagonal(0, 5)).toThrow(/faktorizált/);
    expect(() => s.toDense()).toThrow(/faktorizált/);
  });

  it('a kétszeri faktorizálás nem rontja el a megoldást', () => {
    const a = randomSPD(5, makeRng(31));
    const b = Float64Array.from([1, 2, 3, 4, 5]);
    const s = skylineFromDense(a);
    s.factorize();
    const x1 = s.solve(b);
    s.factorize(); // idempotens
    const x2 = s.solve(b);
    expect(maxAbsDiff(x1, x2)).toBe(0);
  });

  it('rossz méretű jobboldalra dimenzióhiba', () => {
    const s = skylineFromDense(DenseMatrix.identity(3));
    expect(() => s.solve(Float64Array.from([1, 2]))).toThrow(DimensionError);
  });

  it('a solveInPlace faktorizálatlan mátrixon nem hívható', () => {
    const s = skylineFromDense(DenseMatrix.identity(3));
    expect(() => s.solveInPlace(Float64Array.from([1, 2, 3]))).toThrow();
  });
});

describe('rugóállandó hozzáadása (penalty / rugalmas támasz)', () => {
  it('az átlós hozzáadás megjelenik a megoldásban', () => {
    // 1 DOF: k·u = f. A rugó megduplázza a merevséget.
    const s = SkylineMatrix.full(1);
    s.set(0, 0, 10);
    s.addDiagonal(0, 10);
    const x = s.solve(Float64Array.from([20]));
    expect(x[0]).toBeCloseTo(1, 12);
  });

  it('nagy rugóállandó gyakorlatilag megköti a szabadságfokot', () => {
    // Két DOF, az elsőt penalty-vel rögzítjük.
    const s = SkylineMatrix.full(2);
    s.set(0, 0, 4);
    s.set(0, 1, -2);
    s.set(1, 1, 4);
    s.addDiagonal(0, 1e12);
    const x = s.solve(Float64Array.from([1, 1]));
    expect(Math.abs(x[0])).toBeLessThan(1e-10);
    expect(x[1]).toBeCloseTo(0.25, 8);
  });
});
