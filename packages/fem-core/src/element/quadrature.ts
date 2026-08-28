/**
 * Gauss–Legendre kvadratúra a [−1, 1] intervallumon.
 *
 * A diplomaterv 1. táblázata (40. oldal) a három pontos szabályt adja meg:
 *   ξ = ∓√0.6,  w = 5/9        és        ξ = 0,  w = 8/9
 *
 * A két pontos szabály a szelektív redukált integráláshoz kell (3.1.4:
 * „numerikusan kedvező eredményt értek el azáltal is, hogy a hajlítási illetve
 * nyírási tagokat különböző pontszámú integrálással határozták meg, így
 * csökkentve a záródás hatását").
 */

export interface GaussPoint {
  /** Lokális koordináta */
  readonly xi: number;
  /** Súly */
  readonly w: number;
}

const SQRT_0_6 = Math.sqrt(0.6);
const INV_SQRT_3 = 1 / Math.sqrt(3);

/** 1 pontos szabály: ξ = 0, w = 2. Pontos 1. fokú polinomra. */
export const GAUSS_1: readonly GaussPoint[] = [{ xi: 0, w: 2 }];

/** 2 pontos szabály: ξ = ∓1/√3, w = 1. Pontos 3. fokú polinomra. */
export const GAUSS_2: readonly GaussPoint[] = [
  { xi: -INV_SQRT_3, w: 1 },
  { xi: INV_SQRT_3, w: 1 },
];

/** 3 pontos szabály (Diplomaterv 1. táblázat). Pontos 5. fokú polinomra. */
export const GAUSS_3: readonly GaussPoint[] = [
  { xi: -SQRT_0_6, w: 5 / 9 },
  { xi: 0, w: 8 / 9 },
  { xi: SQRT_0_6, w: 5 / 9 },
];

/**
 * Kvadratúra-szabály a pontok száma alapján.
 * @throws RangeError ha a pontszám nem 1, 2 vagy 3
 */
export function gaussRule(points: 1 | 2 | 3): readonly GaussPoint[] {
  switch (points) {
    case 1:
      return GAUSS_1;
    case 2:
      return GAUSS_2;
    case 3:
      return GAUSS_3;
  }
}

/**
 * Az integrálási pontok száma tagonként, integrálási séma szerint
 * (a MASTER-PROMPT-TERV 1.3 pontja).
 *
 * `selective`: hajlítás 3 pont (teljes), nyírás 2 pont (redukált) — ez az
 *              alapértelmezés, mert megszünteti a záródást (shear locking).
 * `full`:      mindkét tag 3 ponttal. A záródás kimutatásához tartjuk meg
 *              (V-04 validációs eset).
 */
export function quadratureFor(scheme: 'selective' | 'full'): {
  readonly bending: readonly GaussPoint[];
  readonly shear: readonly GaussPoint[];
} {
  return scheme === 'selective'
    ? { bending: GAUSS_3, shear: GAUSS_2 }
    : { bending: GAUSS_3, shear: GAUSS_3 };
}

/**
 * A feszültségek kiértékelési pontjai. A diplomaterv 3.1.7.4 pontja szerint az
 * igénybevételeket a Gauss-pontokban kapjuk meg, és onnan extrapolálunk a
 * csomópontokba — ezért mindkét séma esetén a 3 pontos hely a hivatkozási alap.
 */
export const STRESS_POINTS = GAUSS_3;
