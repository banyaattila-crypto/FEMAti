/**
 * Beton nemlineáris egytengelyű feszültség-alakváltozás törvénye — EC2
 * (EN 1992-1-1) 3.1.7, parabola-téglalap modell, (3.17) képlet:
 *
 *   σc = fck·[1 − (1 − εc/εc2)ⁿ]   ha  0 ≤ εc ≤ εc2
 *   σc = fck                       ha  εc2 < εc ≤ εcu2
 *
 * (εc a nyomási alakváltozás ABSZOLÚT értéke — a szabvány konvencióban a
 * nyomás pozitív; ez a modul a FEMAti előjelkonvencióját követi, ahol a
 * nyomás NEGATÍV — ld. lent.)
 *
 * F) fázis (docs/ADR/00xx-ec2-beton-modell.md) — az `material/elastoPlastic1D.ts`
 * (acél, bilineáris, radial-return, INKREMENTÁLIS — állapotot igényel a
 * lépések között) MELLETT, azzal STRUKTURÁLISAN eltérő törvény: az EC2
 * tervezési görbe a TELJES (nem inkrementális) alakváltozás explicit,
 * PATH-INDEPENDENT függvénye — nincs keményedés-memória, nincs elágazás
 * tehermentesítésre. Ez a docs/ADR/00xx dokumentált, tudatos egyszerűsítés:
 *
 *   - HÚZOTT oldal: NULLA húzószilárdság (repedt keresztmetszet feltételezése)
 *     — a `fctm`/`fctk,0.05` (fem-db D) fázis) csak TÁJÉKOZTATÓ, ebbe a
 *     törvénybe nem megy be; ez a szabványos, konzervatív egyszerűsítés a
 *     legtöbb metszet-analízis szoftverben.
 *   - ZÚZÓDÁS (|εc| > εcu2): σ=0, tangensE=0 — a tervezési görbe εcu2-nél
 *     véget ér, ez a szabvány szerinti tönkremeneteli határ; nem extrapolálunk
 *     túl rajta.
 *   - TEHERMENTESÍTÉSNÉL a beton UGYANAZON a görbén futna vissza (nincs
 *     elasztikus visszatérési ág) — monoton terhelésnél (a FEMAti fő
 *     üzemmódja) ez helyes, a "tehermentesítés" kapcsolónál FIZIKAILAG
 *     PONTATLAN a betonra (ld. ADR, UI-figyelmeztetés).
 *
 * ELŐJELKONVENCIÓ (`z` lefelé pozitív, `ε(z) = κ·z`, ld. `element/bMatrix.ts`
 * κ-definíciója és `solver/materialState.ts` `dEps = dKappa·layer.z`
 * mintája): pozitív κ-nál (süllyedő nyomaték) a `z>0` (alsó) szál HÚZOTT
 * (`ε>0`), a `z<0` (felső) szál NYOMOTT (`ε<0`) — ugyanaz a séma, mint az
 * acél `sign = σ_trial≥0?1:-1` előjel-szimmetriája. Ezért itt: `ε≥0` →
 * húzás → `σ=0`; `ε<0` → a fenti görbe `|ε|`-re kiértékelve, NEGATÍV
 * előjellel.
 *
 * ISMERT, DOKUMENTÁLT NUANSZ: a parabola kezdeti (ε=0) érintő-modulusa
 * (`fck·n/εc2`) NEM egyezik szükségszerűen a `Material.e` (Ecm) értékkel —
 * az EC2-ben a Ecm (SLS, alakváltozás-becslés) és a parabola-téglalap
 * tervezési görbe (ULS, teherbírás) KÜLÖN, egymástól függetlenül kalibrált
 * mennyiségek, ez a szabvány saját jellemzője, nem e port hibája. A
 * kezdeti (terheletlen) keresztmetszeti merevség (`initialGaussPointState`,
 * `solver/materialState.ts`) továbbra is `layer.e`-ből (Ecm) számol — csak
 * az ELSŐ nemlineáris frissítéstől kezdve vált át erre a görbére, ezért
 * nagyon kis terhelésnél egy apró, dokumentált érintő-ugrás lehetséges.
 */

export interface ConcreteStressResult {
  /** Feszültség [kN/m²] — nyomás NEGATÍV, húzás mindig 0. */
  readonly sigma: number;
  /** Érintő modulus [kN/m²] az adott alakváltozásnál. */
  readonly tangentE: number;
}

/**
 * A beton feszültsége és érintő modulusa a TELJES (nem inkrementális)
 * `eps` alakváltozásnál — tiszta függvény, nincs history/state paraméter
 * (ld. fejléc-komment: path-independent).
 *
 * @param eps a réteg teljes alakváltozása [-] (nyomás negatív)
 * @param fck jellemző nyomószilárdság [kN/m²] (pozitív érték)
 * @param epsC2 folyási határnyúlás [-] (pozitív érték, pl. 0.002)
 * @param epsCu2 szakadási (zúzódási) határnyúlás [-] (pozitív érték, pl. 0.0035)
 * @param n a parabola-téglalap modell kitevője [-] (pl. 2.0)
 */
export function concreteStress(
  eps: number,
  fck: number,
  epsC2: number,
  epsCu2: number,
  n: number,
): ConcreteStressResult {
  if (eps >= 0) {
    return { sigma: 0, tangentE: 0 }; // húzás — repedt keresztmetszet, nincs húzószilárdság
  }

  const absEps = -eps;

  if (absEps > epsCu2) {
    return { sigma: 0, tangentE: 0 }; // zúzódás — a tervezési görbe εcu2-nél véget ér
  }

  if (absEps >= epsC2) {
    return { sigma: -fck, tangentE: 0 }; // téglalap (fennsík) szakasz
  }

  // Parabola szakasz: σ = fck·[1-(1-x)ⁿ], x = |ε|/εc2 ∈ [0,1).
  const x = absEps / epsC2;
  const oneMinusX = 1 - x;
  const sigma = -fck * (1 - oneMinusX ** n);
  const tangentE = (fck * n * oneMinusX ** (n - 1)) / epsC2;
  return { sigma, tangentE };
}

/** Igaz, ha a réteg elérte vagy túllépte az εc2 folyási határnyúlást (nyomott oldal). */
export function isConcreteYielded(eps: number, epsC2: number): boolean {
  return eps < 0 && -eps >= epsC2;
}
