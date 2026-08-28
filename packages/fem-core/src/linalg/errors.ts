/** A numerikus mag hibatípusai. Mind emberi nyelvű, magyar üzenettel. */

export class DimensionError extends RangeError {
  override readonly name = 'DimensionError';
  constructor(message: string) {
    super(message);
  }
}

/**
 * Az együtthatómátrix szinguláris vagy numerikusan az.
 * Statikai értelemben: a szerkezet mechanizmus, vagy egy szabadságfok
 * merevség nélkül maradt.
 */
export class SingularMatrixError extends Error {
  override readonly name = 'SingularMatrixError';
  /** A szinguláris pivot sorszáma (globális szabadságfok-index). */
  readonly dof: number;
  /** A pivot értéke. */
  readonly pivot: number;

  constructor(dof: number, pivot: number, hint?: string) {
    super(
      `Az egyenletrendszer szinguláris a(z) ${dof}. szabadságfoknál ` +
        `(pivot = ${pivot.toExponential(3)}). ` +
        (hint ?? 'A szerkezet valószínűleg mechanizmus, vagy hiányzik egy megtámasztás.'),
    );
    this.dof = dof;
    this.pivot = pivot;
  }
}

/**
 * A mátrix nem pozitív definit — a Cholesky-felbontás egy pivotja nem pozitív.
 * Modális analízisnél (ADR-0016) ez azt jelenti, hogy a tömegmátrix
 * szinguláris (pl. egy aktív szabadságfokhoz nem tartozik tömeg).
 */
export class NotPositiveDefiniteError extends Error {
  override readonly name = 'NotPositiveDefiniteError';
  /** A hibás pivot sorszáma. */
  readonly index: number;

  constructor(index: number, hint?: string) {
    super(
      `A mátrix nem pozitív definit a(z) ${index}. pivotnál. ` +
        (hint ?? 'Modális analízisnél ellenőrizze, hogy minden aktív szabadságfokhoz tartozik-e tömeg.'),
    );
    this.index = index;
  }
}

/** A leképezés nem megfordítható: |J| ≤ 0 (Diplomaterv 3.7–3.9). */
export class DegenerateElementError extends Error {
  override readonly name = 'DegenerateElementError';
  readonly elementId: string;

  constructor(elementId: string, detJ: number) {
    super(
      `A(z) "${elementId}" elem Jacobi-determinánsa nem pozitív (|J| = ${detJ.toExponential(3)}). ` +
        `A lokális → globális leképezés nem megfordítható; ellenőrizze a középső csomópont helyét.`,
    );
    this.elementId = elementId;
  }
}

/** Dimenzió-ellenőrzés a publikus belépési pontokon (ADR-0001). */
export function assertDim(actual: number, expected: number, what: string): void {
  if (actual !== expected) {
    throw new DimensionError(`${what}: várt méret ${expected}, kapott ${actual}.`);
  }
}

export function assertIndex(i: number, n: number, what: string): void {
  if (!Number.isInteger(i) || i < 0 || i >= n) {
    throw new DimensionError(`${what}: a(z) ${i} index kívül esik a [0, ${n - 1}] tartományon.`);
  }
}
