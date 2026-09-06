/**
 * Független analitikus referencia — Timoshenko-konzol tetszőleges helyen ható
 * koncentrált teherre.
 *
 * KIZÁRÓLAG tesztekhez: nem a vizsgált kóddal (fem-core/src) közös úton
 * származik, hanem kézi zárt alakú levezetésből. A levezetés helyességét a
 * `test/solver.test.ts` a FE-megoldással veti össze (két független út
 * egyezése — HIBATURESI-POLITIKA 2. pont).
 *
 * Kinematika (a fem-core B-mátrix konvenciójával egyezően): γ = φ − dw/dx.
 * Konzol, befogva x=0-nál (w(0)=0, φ(0)=0), P koncentrált teher x=b helyen.
 *
 * Levezetés (x ≤ b esetén):
 *   M(x) = P·(b−x)   →   κ(x) = M/EI = P·(b−x)/EI
 *   T(x) = P (állandó, csak a befogás és a teher közt)
 *   φ(x) = ∫₀ˣ κ dt = P/EI·(b·x − x²/2)
 *   γ(x) = T/GAs = P/GAs
 *   dw/dx = φ(x) − γ(x)
 *   w(x)  = P/EI·(b·x²/2 − x³/6) + P·x/GAs
 *
 * x > b esetén: κ=0, T=0 (a tehertől a szabad vég felé nincs igénybevétel),
 * ezért φ és a lejtés állandó marad a b pontban felvett értéken.
 *
 * Ellenőrzés (b=L, x=L eset, a szokásos tiszta végteher-formula):
 *   w(L) = P·L³/(3EI) + P·L/GAs,  φ(L) = P·L²/(2EI)
 * — ez a klasszikus Timoshenko-konzol formula, előjelben és alakban
 * egyezik, ha b=x=L-et helyettesítünk.
 */
export interface BeamPoint {
  readonly w: number;
  readonly phi: number;
}

/** Konzol (befogva x=0-nál) elmozdulása/elfordulása x-ben, P teherből b-nél. */
export function cantileverPointLoad(ei: number, gas: number, p: number, b: number, x: number): BeamPoint {
  if (x <= b) {
    const phi = (p / ei) * (b * x - (x * x) / 2);
    const w = (p / ei) * ((b * x * x) / 2 - (x * x * x) / 6) + (p * x) / gas;
    return { w, phi };
  }
  const phiB = (p / ei) * ((b * b) / 2);
  const wB = (p / ei) * ((b * b * b) / 2 - (b * b * b) / 6) + (p * b) / gas;
  return { w: wB + phiB * (x - b), phi: phiB };
}

/** Konzol elmozdulása/elfordulása x-ben, M0 végnyomatékból (b-nél ható koncentrált nyomaték). */
export function cantileverPointMoment(ei: number, m0: number, b: number, x: number): BeamPoint {
  // Tiszta nyomatékból nincs nyíróerő, tehát a nyírási alakváltozás zérus:
  // κ(x) = M0/EI állandó a befogás és b közt, utána zérus.
  if (x <= b) {
    const phi = (m0 / ei) * x;
    const w = (m0 / ei) * ((x * x) / 2);
    return { w, phi };
  }
  const phiB = (m0 / ei) * b;
  const wB = (m0 / ei) * ((b * b) / 2);
  return { w: wB + phiB * (x - b), phi: phiB };
}

/** Két pontteher (és/vagy nyomaték) hatásának szuperpozíciója egy konzolon. */
export function superpose(...points: readonly BeamPoint[]): BeamPoint {
  return points.reduce((acc, p) => ({ w: acc.w + p.w, phi: acc.phi + p.phi }), { w: 0, phi: 0 });
}

/**
 * Befogott-görgős (statikailag határozatlan) tartó erőmódszerrel.
 *
 * Elsődleges szerkezet: konzol a befogott végnél (x=0), a görgő (x=L)
 * redundáns reakciója R. A kompatibilitási feltétel: w(L) = 0.
 *
 * @returns a redundáns reakció R, és egy függvény, ami bármely x-ben adja
 *          vissza a teljes (P + R hatását szuperponáló) elmozdulást.
 */
export function proppedCantileverPointLoad(
  ei: number,
  gas: number,
  length: number,
  p: number,
  b: number,
): { readonly r: number; readonly at: (x: number) => BeamPoint } {
  const w1 = cantileverPointLoad(ei, gas, p, b, length).w;
  const f11 = cantileverPointLoad(ei, gas, 1, length, length).w;
  const r = -w1 / f11;
  return {
    r,
    at: (x: number) => superpose(cantileverPointLoad(ei, gas, p, b, x), cantileverPointLoad(ei, gas, r, length, x)),
  };
}
