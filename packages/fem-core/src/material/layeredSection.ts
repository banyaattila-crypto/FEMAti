/**
 * Rétegzés generálása parametrikus szelvényből (Diplomaterv 3.4.3, (3.54),
 * MASTER-PROMPT-TERV 1.7/B).
 *
 * A rétegek egyenlő vastagságú, vízszintes csíkok, a szelvény teljes
 * magassága mentén, a csík geometriai KÖZÉPVONALÁN vett `z`-vel (ez
 * rögzített marad — ld. lent, miért). A `b` (szélesség) viszont NEM
 * egyetlen középponti mintavétellel adódik, hanem a csík saját tartományán
 * belüli FINOM ALMINTAVÉTELEZÉSSEL (`SUBSAMPLES` pont), TERÜLET-MEGŐRZŐ
 * módon:
 *
 *   A_l = Σ b(zk)·Δz     (a csík valódi területe a kontúrfüggvényből)
 *   b_l = A_l / t        (effektív, terület-megőrző szélesség)
 *
 * FOLYTONOS ÉS ÁLLANDÓ szélességű kontúrnál (`rect`) ez pontosan ugyanazt
 * adja, mint a korábbi egyszerű középponti mintavétel (a P-13 validációs
 * eset — `rect()` alakon — ezért VÁLTOZATLAN marad). TÖRÉSPONTOS kontúrnál
 * (`i-profile` gerinc/öv-átmenet) viszont ez a lényeg: egyetlen középponti
 * minta durván FÉLREVEZETŐ eredményt ad, ha a csík éppen a törésponton
 * átnyúlik — pl. 16 rétegnél egy IPE300-nál a legszélső csík közepe az
 * övbe esik, és a régi módszer a TELJES övszélességet (150 mm) rendelte a
 * csík teljes (18,75 mm) vastagságához, holott abból csak ~10,7 mm valódi
 * öv, a többi gerinc (7,1 mm) — ez a keresztmetszet területét ~39%-kal, az
 * inerciáját ~46%-kal túlbecsülte (valós, mért hiba, nem elméleti). A finom
 * almintavételezés ezt lényegében kiküszöböli.
 *
 * A `z`-t TUDATOSAN a geometriai középvonalon hagytuk (nem a szélesség
 * szerint súlyozott csík-súlypontra korrigáltuk): (a) a hézag-/átfedés-
 * mentesség ellenőrzése (`model/validate.ts` `checkLayers()` és az alábbi
 * teszt) ERRE az invariánsra épül — `z ± t/2` mindig pontosan a csík
 * geometriai határa kell legyen; (b) egy görbült (kör/cső) vagy törésponton
 * átnyúló csíknál a szélesség-súlyozott súlypont és a geometriai középvonal
 * közötti eltérés MÁSODRENDŰ hatás — ugyanaz, amit az `includeLayerOwnInertia`
 * opció (alapértelmezés: ki) már dokumentáltan és tudatosan elhanyagol.
 *
 * A `z` koordináta a keresztmetszet súlypontjától mérve, lefelé pozitív
 * (ld. CONVENTIONS.md §2) — minden itt kezelt alak szimmetrikus a
 * félmagasságra, ezért a súlypont mindig a geometriai félmagasságon van.
 */

import type { SectionShape } from '../model/types.js';

/** Egy generált réteg nyers (márkázatlan) számokkal — `makeLayeredSection()` bemenete. */
export interface RawLayer {
  readonly b: number;
  readonly t: number;
  readonly z: number;
}

function shapeHeight(shape: SectionShape): number {
  switch (shape.kind) {
    case 'rect':
      return shape.h as number;
    case 'circle':
      return shape.d as number;
    case 'tube':
      return shape.d as number;
    case 'i-profile':
      return shape.h as number;
    case 'rhs':
      return shape.h as number;
  }
}

/** A szelvény kontúrszélessége `b(z)`-ben, a súlyponttól mért `z`-nél. */
function contourWidth(shape: SectionShape, z: number): number {
  switch (shape.kind) {
    case 'rect': {
      const h = shape.h as number;
      return Math.abs(z) <= h / 2 ? (shape.b as number) : 0;
    }

    case 'circle': {
      const r = (shape.d as number) / 2;
      const under = r * r - z * z;
      return under > 0 ? 2 * Math.sqrt(under) : 0;
    }

    case 'tube': {
      const ro = (shape.d as number) / 2;
      const ri = ro - (shape.t as number);
      const outer = ro * ro - z * z;
      const outerWidth = outer > 0 ? 2 * Math.sqrt(outer) : 0;
      const inner = ri * ri - z * z;
      const innerWidth = inner > 0 ? 2 * Math.sqrt(inner) : 0;
      return outerWidth - innerWidth;
    }

    case 'i-profile': {
      const h = shape.h as number;
      const tf = shape.tf as number;
      const hw = h - 2 * tf; // gerincmagasság
      if (Math.abs(z) > h / 2) return 0;
      return Math.abs(z) <= hw / 2 ? (shape.tw as number) : (shape.b as number);
    }

    case 'rhs': {
      // Zárt szelvény — a felül/alul lévő falsávban a TELJES külső
      // szélesség (b) a kontúr, a középső, üreges sávban a KÉT oldalfal
      // (2·t) — pontosan ugyanaz a minta, mint az i-profile öv/gerinc
      // váltásánál, csak itt a "gerinc" a két oldalfal együttes vastagsága.
      const h = shape.h as number;
      const t = shape.t as number;
      const hi = h - 2 * t; // a belső üreg magassága
      if (Math.abs(z) > h / 2) return 0;
      return Math.abs(z) <= hi / 2 ? 2 * t : (shape.b as number);
    }
  }
}

/** Almintavételek száma csíkonként a terület-/nyomaték-megőrző szélesség-átlagoláshoz. */
const SUBSAMPLES = 200;

/**
 * `layerCount` egyenlő vastagságú réteg a szelvény teljes magassága mentén,
 * a súlyponttól lefelé pozitív `z`-vel — terület- és elsőrendű-nyomaték-
 * megőrző, almintavételezett szélesség-átlagolással (ld. fejléc-komment).
 */
export function generateLayers(shape: SectionShape, layerCount: number): readonly RawLayer[] {
  if (!Number.isInteger(layerCount) || layerCount < 1) {
    throw new RangeError(`A rétegszámnak pozitív egésznek kell lennie (kapott: ${layerCount}).`);
  }

  const height = shapeHeight(shape);
  const t = height / layerCount;
  const dz = t / SUBSAMPLES;
  const layers: RawLayer[] = [];
  for (let i = 0; i < layerCount; i++) {
    const zTop = -height / 2 + i * t;

    let area = 0;
    for (let k = 0; k < SUBSAMPLES; k++) {
      const zk = zTop + (k + 0.5) * dz;
      area += contourWidth(shape, zk) * dz;
    }

    const z = zTop + t / 2;
    const b = area / t;
    layers.push({ b, t, z });
  }
  return layers;
}

/**
 * Keresztmetszeti nyomaték a rétegenkénti hajlítófeszültségekből:
 * `M = Σ σxl·bl·zl·tl` (3.59), az `M = EI·κ` lineáris esettel konzisztens
 * `ε(z) = κ·z` kinematikával (ld. `element/bMatrix.ts` κ-definíciója).
 */
export function sectionMoment(layers: readonly RawLayer[], layerStress: readonly number[]): number {
  let m = 0;
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const sigma = layerStress[i];
    if (layer === undefined || sigma === undefined) continue;
    m += sigma * layer.b * layer.z * layer.t;
  }
  return m;
}
