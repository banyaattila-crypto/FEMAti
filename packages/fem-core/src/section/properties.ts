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
 * Ajánlott nyírási alaktényező κs.
 *
 * A diplomaterv a nyírási merevséget G·A/1.2 alakban használja (2-2. ábra),
 * ami téglalapra κs = 1/1.2 = 5/6. A modellben megadott érték élvez
 * elsőbbséget; ez a függvény csak javaslatot ad új szelvény felvételekor.
 */
export function recommendedShearFactor(shape: SectionShape): number {
  switch (shape.kind) {
    case 'rect':
      return 5 / 6;
    case 'circle':
      return 0.9;
    case 'tube':
      return 0.5;
    case 'i-profile': {
      // Közelítés: a nyírást gyakorlatilag a gerinc veszi fel.
      const h = shape.h as number;
      const b = shape.b as number;
      const tw = shape.tw as number;
      const tf = shape.tf as number;
      const area = 2 * b * tf + (h - 2 * tf) * tw;
      return (h * tw) / area;
    }
  }
}
