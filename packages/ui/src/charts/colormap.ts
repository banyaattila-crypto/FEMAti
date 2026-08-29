/**
 * Megosztott "jet"-szerű hőtérkép-színskála — 2026-08-29 újratervezés.
 *
 * A valódi CAE-szoftverek (ANSYS stb.) kezelőfelülete visszafogott/semleges;
 * a szín ott az ADATON él (feszültség-/eredménykontúr), nem a kereten. A
 * `Beam3DStress.tsx` ezt már használta (0=kék…1=piros); ez a modul ugyanezt
 * a logikát vonja ki, MEGEMELT telítettséggel (a korábbi tónusok túl
 * pasztellesek voltak egy igazi kontúrképhez), hogy a diagramok (M/T/w/φ)
 * is ugyanezt a nyelvet beszéljék.
 */

const JET_STOPS: readonly [number, string][] = [
  [0, '#1a56d6'],
  [0.25, '#0fc4dd'],
  [0.5, '#2ed16b'],
  [0.75, '#f2c419'],
  [1, '#e5342a'],
];

function hexToRgb(hex: string): readonly [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const LAST_STOP_COLOR = JET_STOPS[JET_STOPS.length - 1]?.[1] ?? '#e5342a';

/** t ∈ [0,1] → "rgb(r,g,b)", 0=kék (hideg/kicsi) … 1=piros (forró/nagy). */
export function jetColor(t: number): string {
  const clamped = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  for (let i = 0; i < JET_STOPS.length - 1; i++) {
    const stop0 = JET_STOPS[i];
    const stop1 = JET_STOPS[i + 1];
    if (stop0 === undefined || stop1 === undefined) continue;
    const [t0, c0] = stop0;
    const [t1, c1] = stop1;
    if (clamped >= t0 && clamped <= t1) {
      const f = t1 !== t0 ? (clamped - t0) / (t1 - t0) : 0;
      const [r0, g0, b0] = hexToRgb(c0);
      const [r1, g1, b1] = hexToRgb(c1);
      const r = Math.round(r0 + (r1 - r0) * f);
      const g = Math.round(g0 + (g1 - g0) * f);
      const b = Math.round(b0 + (b1 - b0) * f);
      return `rgb(${r},${g},${b})`;
    }
  }
  return LAST_STOP_COLOR;
}

/** A skála SVG `<linearGradient>` `<stop>`-jaihoz (a legenda-sávhoz). */
export const JET_LEGEND_STOPS: readonly [number, string][] = JET_STOPS;
