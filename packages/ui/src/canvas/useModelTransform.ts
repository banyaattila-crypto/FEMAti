/**
 * Modelltér → képernyőtér átváltás.
 *
 * EZ AZ EGYETLEN HELY, ahol koordináta-transzformáció történik
 * (DESIGN-TERV.md 5.1 és 10. fejezet). A rajzoló komponensek nem számolnak
 * saját léptéket.
 */

export const VIEW_WIDTH = 1200;
export const VIEW_HEIGHT = 420;
/** A tartó bal széle a viewBox-ban. */
export const AXIS_X0 = 76;
/** A tartó jobb széle a viewBox-ban. */
export const AXIS_X1 = 1124;
/** A tartó tengelyének magassága a viewBox-ban. */
export const AXIS_Y = 240;

export interface ModelTransform {
  /** x [m] → képernyő x */
  readonly sx: (xMeters: number) => number;
  /** lehajlás [m] → képernyő y (a tengelytől lefelé) */
  readonly sy: (wMeters: number) => number;
  /** A deformáció nagyítási tényezője (mindig ki kell írni). */
  readonly deformationScale: number;
  readonly axisY: number;
  readonly x0: number;
  readonly x1: number;
  readonly pixelsPerMeter: number;
}

export interface TransformOptions {
  /** A tartó teljes hossza [m] */
  readonly span: number;
  /** A legnagyobb abszolút lehajlás [m]; ha 0 vagy hiányzik, a lépték 1 */
  readonly maxDeflection?: number;
  /** Kézi lépték-felülírás */
  readonly manualScale?: number;
  /** A deformált alak kívánt képernyő-amplitúdója képpontban */
  readonly targetPixels?: number;
  /** A tengely y-koordinátájának felülírása (alapértelmezés: `AXIS_Y`) — a reszponzív, konténer-kitöltő vászonhoz (`ModelCanvas.tsx`). */
  readonly axisY?: number;
}

/**
 * Léptékek előállítása. Az automatikus deformációs lépték úgy áll be, hogy a
 * legnagyobb elmozdulás a rajzon `targetPixels` (alapértelmezés 60 px) legyen.
 */
export function createModelTransform(opts: TransformOptions): ModelTransform {
  const span = opts.span > 0 ? opts.span : 1;
  const pixelsPerMeter = (AXIS_X1 - AXIS_X0) / span;
  const target = opts.targetPixels ?? 60;

  const maxW = opts.maxDeflection ?? 0;
  const auto = maxW > 0 ? target / (maxW * pixelsPerMeter) : 1;
  const deformationScale = opts.manualScale ?? auto;
  const axisY = opts.axisY ?? AXIS_Y;

  return {
    sx: (x) => AXIS_X0 + (x / span) * (AXIS_X1 - AXIS_X0),
    sy: (w) => axisY + w * pixelsPerMeter * deformationScale,
    deformationScale,
    axisY,
    x0: AXIS_X0,
    x1: AXIS_X1,
    pixelsPerMeter,
  };
}
