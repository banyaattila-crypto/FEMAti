/**
 * Keresztmetszeti jellemzők parametrikus szelvényekhez.
 *
 * A rugalmas jellemzők (A, I) az elemi merevségi mátrixhoz kellenek; a
 * képlékeny modulus (Kp = 2·S₀) a diplomaterv (3.39) és 4. táblázata szerinti
 * teherbírás-számításhoz.
 *
 * Diplomaterv 4. táblázat (54. oldal) — az itt számított értékeknek ezeket az
 * arányokat kell visszaadniuk:
 *   négyszög c = 1.50 · kör c = 1.70 · körgyűrű c = 1.27 · I-szelvény c = 1.14–1.16
 *
 * Minden méret [m], minden terület [m²], minden inercia [m⁴].
 */

import type { SectionShape } from '../model/types.js';

export interface GeometricProperties {
  /** Keresztmetszeti terület A [m²] */
  readonly area: number;
  /** Másodrendű nyomaték I [m⁴] a hajlítási tengelyre */
  readonly inertia: number;
  /** A szélső szál távolsága a súlyponttól, y_max [m] */
  readonly yMax: number;
  /** Rugalmas keresztmetszeti modulus Kₑ = I / y_max [m³] (Diplomaterv 3.37) */
  readonly elasticModulus: number;
  /**
   * Képlékeny keresztmetszeti modulus Kp = 2·S₀ [m³] (Diplomaterv 3.39),
   * ahol S₀ a fél keresztmetszet statikai nyomatéka a súlyponti tengelyre.
   */
  readonly plasticModulus: number;
  /** Alaki tényező c = Kp / Kₑ = Mp / Mₑ (Diplomaterv 3.40) */
  readonly shapeFactor: number;
  /** A keresztmetszet teljes magassága [m] */
  readonly height: number;
  /**
   * A súlypont távolsága a FELSŐ szélső száltól [m] — CSAK aszimmetrikus
   * alakoknál (t-profile, C) fázis) van kitöltve; szimmetrikus alakoknál
   * `undefined` (ott `yTop === yBottom === yMax` lenne, redundáns).
   */
  readonly yTop?: number;
  /** A súlypont távolsága az ALSÓ szélső száltól [m] — ld. `yTop`. */
  readonly yBottom?: number;
}

/**
 * Parametrikus keresztmetszet geometriai jellemzői.
 *
 * A számítás a NÉVLEGES kontúrból indul: a hengerelt szelvények
 * gerinc–öv lekerekítését nem veszi figyelembe, ezért az eredmény kis
 * mértékben eltér a szelvénytáblázat adatától. A felület ezt az eltérést
 * kiírja (DESIGN-TERV 4.2 `SectionPreview`).
 */
export function geometricProperties(shape: SectionShape): GeometricProperties {
  switch (shape.kind) {
    case 'rect': {
      const b = shape.b as number;
      const h = shape.h as number;
      const area = b * h;
      const inertia = (b * h * h * h) / 12;
      const yMax = h / 2;
      // S₀ = b·(h/2)·(h/4) = b·h²/8  →  Kp = 2·S₀ = b·h²/4
      const plasticModulus = (b * h * h) / 4;
      return finish(area, inertia, yMax, plasticModulus, h);
    }

    case 'circle': {
      const d = shape.d as number;
      const r = d / 2;
      const area = Math.PI * r * r;
      const inertia = (Math.PI * d ** 4) / 64;
      // S₀ = (2/3)·r³  →  Kp = (4/3)·r³ = d³/6
      const plasticModulus = d ** 3 / 6;
      return finish(area, inertia, r, plasticModulus, d);
    }

    case 'tube': {
      const d = shape.d as number;
      const t = shape.t as number;
      const di = d - 2 * t;
      const area = (Math.PI * (d * d - di * di)) / 4;
      const inertia = (Math.PI * (d ** 4 - di ** 4)) / 64;
      // S₀ = (2/3)·(r³ − rᵢ³)  →  Kp = (d³ − dᵢ³)/6
      const plasticModulus = (d ** 3 - di ** 3) / 6;
      return finish(area, inertia, d / 2, plasticModulus, d);
    }

    case 'i-profile': {
      const h = shape.h as number;
      const b = shape.b as number;
      const tw = shape.tw as number;
      const tf = shape.tf as number;
      const hw = h - 2 * tf; // gerincmagasság

      const area = 2 * b * tf + hw * tw;
      // I = [b·h³ − (b − tw)·hw³] / 12
      const inertia = (b * h ** 3 - (b - tw) * hw ** 3) / 12;
      // S₀ = öv + fél gerinc statikai nyomatéka
      //    = b·tf·(h − tf)/2  +  tw·(hw/2)²/2
      const s0 = (b * tf * (h - tf)) / 2 + (tw * (hw / 2) ** 2) / 2;
      return finish(area, inertia, h / 2, 2 * s0, h);
    }

    case 'rhs': {
      const h = shape.h as number;
      const b = shape.b as number;
      const t = shape.t as number;
      const hi = h - 2 * t; // belső üreg magassága
      const bi = b - 2 * t; // belső üreg szélessége
      // Külső tömör téglalap mínusz a belső üreg (mindkettő zárt alakban) —
      // ugyanaz a "rect mínusz rect" elv, mint a `tube`-nál (kör mínusz kör).
      const area = b * h - bi * hi;
      const inertia = (b * h ** 3 - bi * hi ** 3) / 12;
      // Kp(rect) = w·H²/4 — a külső és a belső (üreg) téglalap Kp-jének
      // különbsége, ugyanaz a levezetés, mint a `rect` esetben fentebb.
      const plasticModulus = (b * h * h - bi * hi * hi) / 4;
      return finish(area, inertia, h / 2, plasticModulus, h);
    }

    case 't-profile': {
      // C) fázis (docs/ADR/00xx-t-szelveny.md) — ASZIMMETRIKUS a
      // félmagasságra: öv FELÜL, gerinc alatta. `y` a TETŐTŐL mérve.
      const h = shape.h as number;
      const b = shape.b as number;
      const tw = shape.tw as number;
      const tf = shape.tf as number;
      const hw = h - tf; // gerincmagasság

      const af = b * tf;
      const aw = tw * hw;
      const area = af + aw;
      const yF = tf / 2;
      const yW = tf + hw / 2;
      const yBar = (af * yF + aw * yW) / area; // súlypont a tetőtől
      const yTop = yBar;
      const yBottom = h - yBar;

      // Steiner-tétel: saját inercia + Aᵢ·(sajátsúlypont-ȳ)²
      const iFlangeOwn = (b * tf ** 3) / 12;
      const iWebOwn = (tw * hw ** 3) / 12;
      const inertia = iFlangeOwn + af * (yF - yBar) ** 2 + iWebOwn + aw * (yW - yBar) ** 2;

      // Képlékeny semleges tengely (EGYENLŐ TERÜLETŰ, NEM a súlypont) —
      // Wpl = ∫|y−y_pna| dA zárt alakban, esetszétválasztással aszerint,
      // hogy y_pna az övben vagy a gerincben esik.
      const yPna = af >= area / 2 ? area / 2 / b : tf + (area / 2 - af) / tw;
      const plasticModulus =
        yPna <= tf
          ? b * (yPna ** 2 / 2 + (tf - yPna) ** 2 / 2) + (tw * ((h - yPna) ** 2 - (tf - yPna) ** 2)) / 2
          : (b * (yPna ** 2 - (yPna - tf) ** 2)) / 2 + tw * ((yPna - tf) ** 2 / 2 + (h - yPna) ** 2 / 2);

      // yMax a KORMÁNYZÓ (nagyobb, konzervatívabb) szál — a meglévő
      // fogyasztók (linearSolver.ts me/mp) így módosítás nélkül a
      // BIZTONSÁG felé kerekítő rugalmas modulust kapják (ld. terv).
      const yMax = Math.max(yTop, yBottom);
      const elasticModulus = inertia / yMax;
      return {
        area,
        inertia,
        yMax,
        elasticModulus,
        plasticModulus,
        shapeFactor: plasticModulus / elasticModulus,
        height: h,
        yTop,
        yBottom,
      };
    }
  }
}

function finish(
  area: number,
  inertia: number,
  yMax: number,
  plasticModulus: number,
  height: number,
): GeometricProperties {
  const elasticModulus = inertia / yMax;
  return {
    area,
    inertia,
    yMax,
    elasticModulus,
    plasticModulus,
    shapeFactor: plasticModulus / elasticModulus,
    height,
  };
}

/**
 * Ajánlott nyírási alaktényező κs — Cowper (1966) Poisson-tényezőtől függő
 * formulái (ld. `docs/THEORY.md` 10.1, pontosítva Ahmed & Rifai (2021),
 * DOI 10.24018/ejers.2021.6.7.2626 alapján):
 *
 *   téglalap:  κ = 10·(1+ν) / (12+11·ν)
 *   kör:       κ = 6·(1+ν)  / (7+6·ν)
 *   vékonyfalú cső: κ = 2·(1+ν) / (4+3·ν)
 *
 * ν=0-nál a téglalap-képlet PONTOSAN 5/6-ra egyszerűsödik (ez volt eddig a
 * projekt egyetlen, konstans κs-értéke, `model/builder.ts`
 * `RECT_SHEAR_FACTOR`) — ez a bővítés tehát nem ELLENTMOND a korábbi
 * értéknek, hanem egy hiányzó paraméterrel (ν) finomítja.
 *
 * Az I-szelvényre Cowper saját formulája jóval bonyolultabb (öv/gerinc
 * arányoktól függő, nem zárt egytagú kifejezés) — a projekt itt TUDATOSAN
 * megmarad a korábbi, egyszerűbb "a nyírást gyakorlatilag a gerinc veszi
 * fel" közelítésnél (Aweb/A), amíg egy jövőbeli lépés nem vezeti le/
 * validálja a pontos Cowper I-szelvény formulát.
 *
 * A modellben explicit megadott `shearFactor` élvez elsőbbséget; ez a
 * függvény csak javaslatot ad új szelvény felvételekor / az alapértelmezés
 * előállításához (ld. `ui/model/compile.ts`, `ui/model/nonlinear.ts`).
 *
 * @param nu Poisson-tényező [–] — KÖTELEZŐ, nincs hallgatólagos
 *   alapértelmezés (a κs pontossága ν-től érdemben függ, ld. fent).
 */
export function recommendedShearFactor(shape: SectionShape, nu: number): number {
  switch (shape.kind) {
    case 'rect':
      return (10 * (1 + nu)) / (12 + 11 * nu);
    case 'circle':
      return (6 * (1 + nu)) / (7 + 6 * nu);
    case 'tube':
      return (2 * (1 + nu)) / (4 + 3 * nu);
    case 'i-profile': {
      // Közelítés: a nyírást gyakorlatilag a gerinc veszi fel (NEM Cowper-formula).
      const h = shape.h as number;
      const b = shape.b as number;
      const tw = shape.tw as number;
      const tf = shape.tf as number;
      const area = 2 * b * tf + (h - 2 * tf) * tw;
      return (h * tw) / area;
    }

    case 'rhs': {
      // Ugyanaz a közelítés, mint az i-profile ágnál (NEM Cowper-formula) —
      // a nyírást a két FÜGGŐLEGES oldalfal veszi fel, az alsó/felső fal
      // ehhez elhanyagolható járulékot ad.
      const h = shape.h as number;
      const b = shape.b as number;
      const t = shape.t as number;
      const area = b * h - (b - 2 * t) * (h - 2 * t);
      return (h * (2 * t)) / area;
    }

    case 't-profile': {
      // Ugyanaz a közelítés, mint az i-profile/rhs ágnál (NEM Cowper-formula)
      // — a nyírást gyakorlatilag a gerinc veszi fel.
      const h = shape.h as number;
      const b = shape.b as number;
      const tw = shape.tw as number;
      const tf = shape.tf as number;
      const area = b * tf + tw * (h - tf);
      return (h * tw) / area;
    }
  }
}
