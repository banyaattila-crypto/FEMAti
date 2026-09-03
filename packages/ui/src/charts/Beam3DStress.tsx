/**
 * Izometrikus, extrudált hajlítófeszültség-vizualizáció — a felhasználó
 * kifejezett kérésére ("látványos outputok", egy valódi 3D-FEA von Mises
 * kontúrkép mintájára).
 *
 * FONTOS, ŐSZINTE KORLÁT: a FEMAti szigorúan 1D Timoshenko-gerendaelem-modell
 * (ld. `DESIGN-TERV.md` 11. pont, `STATUS_REPORT.md` 10. pont) — nincs 2D/3D
 * kontinuum-hálója, ezért ez NEM egy valódi kontinuum-FEA eredmény, és NEM
 * mutat geometriai törésponti (pl. gerinc/öv sarki) feszültségkoncentrációt.
 * Amit mutat: a σ = M(x)·z/I klasszikus, zárt alakú hajlítófeszültséget a
 * KÉT szélső szálon (felső és alsó, előjelesen), a gerenda hossza mentén, egy
 * leegyszerűsített (téglatest-burkoló, NEM a tényleges szelvényalak)
 * izometrikus extrudáláson ábrázolva. A színskála ezért VALÓDI, a modellből
 * számolt adat — csak a geometria sematikus.
 *
 * 2026-09-04 újratervezés (felhasználói kérés: "puritán, nem sokat ad
 * vissza") — a korábbi verzió az |σ|-t (előjel nélkül, egyetlen közös
 * értékként) festette rá MINDKÉT látható lapra, ezért a húzott/nyomott oldal
 * megkülönböztethetetlen volt (a leghasznosabb mérnöki infó hiányzott). Most:
 *  - a FELSŐ lap (a doboz valódi fizikai teteje) a FELSŐ szélső szál σ-ját,
 *  - az ELÜLSŐ lap (geometriailag oldallap, itt az ALSÓ szál kijelzésére
 *    "kölcsönvéve" — a fenti korlát-komment szerint a geometria eleve
 *    sematikus) az ALSÓ szélső szál σ-ját mutatja,
 * mindkettő a jet-skálával (nagyság), ÉS előjel-glifával (+ húzás / − nyomás)
 * minden azonos előjelű szakasz közepén — ugyanaz a nyelv, mint a
 * `CrossSectionInspector` rugalmas/képlékeny-körvonalas jelölése: a SZÍN a
 * nagyságot, egy KÜLÖN jelölő az állapotot (itt: előjelet) kódolja.
 */
import { interpolateAt } from './interpolate.js';
import { JET_LEGEND_STOPS, jetColor } from './colormap.js';

export const STRESS3D_HEIGHT = 320;

export interface Beam3DStressProps {
  readonly xs: readonly number[];
  readonly ms: readonly number[];
  /** Másodrendű nyomaték [m⁴] — a modell aktuális szelvényéből. */
  readonly inertia: number;
  /** A súlypont távolsága a FELSŐ szélső száltól [mm] — szimmetrikus szelvénynél h/2. */
  readonly yTopMm: number;
  /** A súlypont távolsága az ALSÓ szélső száltól [mm] — szimmetrikus szelvénynél h/2. */
  readonly yBottomMm: number;
}

const SEGMENTS = 36;
const STOPS = JET_LEGEND_STOPS;

const P0 = { x: 30, y: 170 };
const P1 = { x: 430, y: 60 };
const WIDTH_VEC = { x: 90, y: 26 };
const HEIGHT_VEC = { x: 0, y: 34 };

function lerpPoint(t: number): { readonly x: number; readonly y: number } {
  return { x: P0.x + (P1.x - P0.x) * t, y: P0.y + (P1.y - P0.y) * t };
}

/** Egy hosszmenti σ(x) függvény azonos előjelű szakaszainak közepe — ide kerül a +/− glifa. */
function signRunMidpoints(span: number, sigmaAt: (x: number) => number): readonly { readonly t: number; readonly positive: boolean }[] {
  const runs: { start: number; end: number; positive: boolean }[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const tMid = (i + 0.5) / SEGMENTS;
    const positive = sigmaAt(tMid * span) >= 0;
    const last = runs[runs.length - 1];
    if (last !== undefined && last.positive === positive) {
      last.end = i;
    } else {
      runs.push({ start: i, end: i, positive });
    }
  }
  return runs.map((r) => ({ t: ((r.start + r.end + 1) / 2) / SEGMENTS, positive: r.positive }));
}

/** Kis kontrasztos +/− glifa a lapon — sötét alátétkorong, hogy bármelyik jet-színen olvasható maradjon. */
function SignGlyph({ x, y, positive }: { readonly x: number; readonly y: number; readonly positive: boolean }): JSX.Element {
  return (
    <g>
      <circle cx={x} cy={y} r={7} fill="var(--surface-app)" fillOpacity={0.78} stroke="var(--border-medium)" strokeWidth={0.5} />
      <text x={x} y={y + 3.5} textAnchor="middle" fontSize={11} fontWeight={700} fontFamily="var(--font-mono)" fill={positive ? 'var(--sem-plastic)' : 'var(--sem-load)'}>
        {positive ? '+' : '−'}
      </text>
    </g>
  );
}

export function Beam3DStress({ xs, ms, inertia, yTopMm, yBottomMm }: Beam3DStressProps): JSX.Element {
  const span = xs.length > 0 ? (xs[xs.length - 1] ?? 1) : 1;
  // z lefelé pozitív (DESIGN-TERV 5.1) — a felső szál z < 0, az alsó z > 0.
  const zTop = -(yTopMm / 1000);
  const zBottom = yBottomMm / 1000;

  /** σ [MPa], ELŐJELESEN — σ = M·z/I, kPa → MPa (/1000). Pozitív = húzás (ld. anyagmodell-konvenció). */
  const sigmaAt = (x: number, z: number): number => {
    const m = interpolateAt(xs, ms, x) ?? 0;
    if (inertia <= 0) return 0;
    return (m * z) / inertia / 1000;
  };
  const sigmaTopAt = (x: number): number => sigmaAt(x, zTop);
  const sigmaBottomAt = (x: number): number => sigmaAt(x, zBottom);

  let sigmaMax = 1e-9;
  for (let i = 0; i <= SEGMENTS; i++) {
    const x = (i / SEGMENTS) * span;
    sigmaMax = Math.max(sigmaMax, Math.abs(sigmaTopAt(x)), Math.abs(sigmaBottomAt(x)));
  }

  const topFaces: JSX.Element[] = [];
  const frontFaces: JSX.Element[] = [];

  for (let i = 0; i < SEGMENTS; i++) {
    const t0 = i / SEGMENTS;
    const t1 = (i + 1) / SEGMENTS;
    const xMid = ((t0 + t1) / 2) * span;
    const topColor = jetColor(Math.abs(sigmaTopAt(xMid)) / sigmaMax);
    const bottomColor = jetColor(Math.abs(sigmaBottomAt(xMid)) / sigmaMax);

    const near0 = lerpPoint(t0);
    const near1 = lerpPoint(t1);
    const far0 = { x: near0.x + WIDTH_VEC.x, y: near0.y - WIDTH_VEC.y };
    const far1 = { x: near1.x + WIDTH_VEC.x, y: near1.y - WIDTH_VEC.y };
    const bot0 = { x: near0.x, y: near0.y + HEIGHT_VEC.y };
    const bot1 = { x: near1.x, y: near1.y + HEIGHT_VEC.y };

    topFaces.push(
      <polygon
        key={`top-${i}`}
        points={`${near0.x},${near0.y} ${near1.x},${near1.y} ${far1.x},${far1.y} ${far0.x},${far0.y}`}
        fill={topColor}
        stroke="var(--surface-app)"
        strokeWidth={0.4}
      />,
    );
    frontFaces.push(
      <polygon
        key={`front-${i}`}
        points={`${near0.x},${near0.y} ${near1.x},${near1.y} ${bot1.x},${bot1.y} ${bot0.x},${bot0.y}`}
        fill={bottomColor}
        fillOpacity={0.82}
        stroke="var(--surface-app)"
        strokeWidth={0.4}
      />,
    );
  }

  const topGlyphs = signRunMidpoints(span, sigmaTopAt).map((r, i) => {
    const p = lerpPoint(r.t);
    return <SignGlyph key={`gt-${i}`} x={p.x + WIDTH_VEC.x / 2} y={p.y - WIDTH_VEC.y / 2} positive={r.positive} />;
  });
  const bottomGlyphs = signRunMidpoints(span, sigmaBottomAt).map((r, i) => {
    const p = lerpPoint(r.t);
    return <SignGlyph key={`gb-${i}`} x={p.x} y={p.y + HEIGHT_VEC.y / 2} positive={r.positive} />;
  });

  return (
    <svg width="100%" height={STRESS3D_HEIGHT} viewBox="0 0 460 320" role="img" aria-label="Szélső szálak hajlítófeszültsége, előjelesen, izometrikus">
      <title>Felső és alsó szélső szál hajlítófeszültsége (σ = M·z/I), előjelesen — izometrikus, sematikus geometria</title>
      {frontFaces}
      {topFaces}
      {bottomGlyphs}
      {topGlyphs}
      <text x={4} y={P0.y - WIDTH_VEC.y / 2 - 6} fontFamily="var(--font-mono)" fontSize={10} fill="var(--text-faint)">
        felső szál
      </text>
      <text x={4} y={P0.y + HEIGHT_VEC.y / 2 + 3} fontFamily="var(--font-mono)" fontSize={10} fill="var(--text-faint)">
        alsó szál
      </text>
      <defs>
        <linearGradient id="vem-stress-legend" x1="0%" y1="0%" x2="100%" y2="0%">
          {STOPS.map(([t, c]) => (
            <stop key={t} offset={`${t * 100}%`} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <rect x="30" y="256" width="300" height="10" rx="2" fill="url(#vem-stress-legend)" stroke="var(--border-medium)" strokeWidth={0.75} />
      <text x="30" y="282" fontFamily="var(--font-mono)" fontSize="11" fill="var(--text-muted)">
        0 MPa
      </text>
      <text x="330" y="282" fontFamily="var(--font-mono)" fontSize="11" fill="var(--text-muted)" textAnchor="end">
        {sigmaMax.toFixed(1)} MPa
      </text>
      <text x="180" y="282" fontFamily="var(--font-mono)" fontSize="11" fill="var(--text-muted)" textAnchor="middle">
        |σ| (szín) — nagyság
      </text>
      <text x="30" y="302" fontFamily="var(--font-mono)" fontSize="11" fill="var(--sem-plastic)">
        + húzás
      </text>
      <text x="330" y="302" fontFamily="var(--font-mono)" fontSize="11" fill="var(--sem-load)" textAnchor="end">
        − nyomás
      </text>
    </svg>
  );
}
