/**
 * V-04 — Nyírási záródás (shear locking) kimutatása.
 *
 * A `quadratureFor('selective' | 'full')` (Diplomaterv 3.1.4 szöveges
 * indoklása; `element/quadrature.ts`) évek óta ígéri, hogy a szelektív
 * redukált integrálás (hajlítás 3 pont, nyírás 2 pont) megszünteti a
 * záródást, a teljes (mindkét tag 3 pontos) integrálás pedig NEM — ezt a
 * `docs/THEORY.md` és a `STATUS_REPORT.md` már "V-04 locking-teszt"-ként
 * hivatkozta, de a validációs eset SOSEM készült el (a `docs/THEORY.md`
 * egy nem létező `element.test.ts`-re hivatkozott). Ez az eset pótolja.
 *
 * MÓDSZER: kéttámaszú tartó, egyenletesen megoszló q teherrel (mint V-02),
 * DE szándékosan DURVA hálóval (2 elem — a záródás egy per-elem torzítás,
 * amit a durva háló felnagyít), és a keresztmetszet magasságát h-t úgy
 * söpörjük végig (L állandó, h csökken), hogy a karcsúság L/h = 10 … 10000
 * között nőjön. Minden karcsúsági fokon kiszámítjuk a középső csomópont
 * lehajlásának RELATÍV hibáját a zárt Timoshenko-megoldáshoz képest
 * (w_max = 5qL⁴/(384EI) + qL²/(8GAs), mint V-02-nél), KÜLÖN a `selective`
 * és KÜLÖN a `full` sémára.
 *
 * VÁRT EREDMÉNY (a záródás matematikai definíciója szerint):
 *   - `selective`: a relatív hiba a karcsúsággal NEM nő — a numerikus mag
 *     itt lényegében gépi pontosságú marad minden karcsúságnál (ténylegesen
 *     mért: ~1e−15 … ~1e−8 a teljes L/h=10…10000 tartományon).
 *   - `full`: a relatív hiba NEM tűnik el a karcsúság növelésével, hanem
 *     egy nemnulla platóra fut be (~12–20% — a kvadratikus Timoshenko-elem
 *     ismert, "enyhe" záródási jelensége, szemben a lineáris elem
 *     divergáló hibájával). EZ maga a záródás: egy jól kondicionált elem
 *     hibájának el KELLENE tűnnie, ahogy a nyírási tag elhanyagolhatóvá
 *     válik a hajlításhoz képest — a `full` séma ehelyett makacsul
 *     megtartja a hibát.
 *
 * A két ellenőrzés (max hiba `selective`-nél, min hiba `full`-nál) EGYÜTT
 * bizonyítja a jelenséget: nem elég, hogy az egyik séma pontos — az is
 * kell, hogy a MÁSIK séma ugyanazon a modellen ténylegesen ne legyen az.
 */
import {
  buildModel,
  distributedForce,
  makeMaterial,
  makeSection,
  pinned,
  rect,
  solveLinear,
  uniformMesh,
  type IntegrationScheme,
} from '@femati/fem-core';
import type { ValidationCase } from '../types.js';

/** Karcsúsági fokok L/h, a durva (2 elemes) hálón — a szöveges indoklás szerint. */
const SLENDERNESS_RATIOS: readonly number[] = [10, 100, 1000, 10000];

function relativeErrorAt(lh: number, scheme: IntegrationScheme): number {
  const E = 2.1e8;
  const nu = 0.3;
  const G = E / (2 * (1 + nu));
  const b = 0.2;
  const L = 6;
  const q = -8;

  const h = L / lh;
  const area = b * h;
  const inertia = (b * h ** 3) / 12;
  const ei = E * inertia;
  const gas = (5 / 6) * G * area;
  const wRef = (5 * q * L ** 4) / (384 * ei) + (q * L ** 2) / (8 * gas);

  const material = makeMaterial('S235', 'Acél S235', { e: E, sigmaY: 2.35e5 });
  const section = makeSection('R', 'Téglalap', rect(b, h));
  const mesh = uniformMesh(L, 2, { sectionId: 'R', materialId: 'S235', integration: scheme });
  const model = buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [section],
    boundaries: [pinned('N0'), pinned(`N${mesh.nodes.length - 1}`)],
    loads: [distributedForce(0, L, q, q, 'Q1')],
  });
  const result = solveLinear(model);
  const mid = result.nodes.find((n) => Math.abs(n.x - L / 2) < 1e-9);
  if (mid === undefined) throw new Error(`V-04: nincs középső csomópont (L/h=${lh}, scheme=${scheme}).`);

  return Math.abs(mid.w - wRef) / Math.abs(wRef);
}

export function caseV04(): ValidationCase {
  const selectiveErrors = SLENDERNESS_RATIOS.map((lh) => relativeErrorAt(lh, 'selective'));
  const fullErrors = SLENDERNESS_RATIOS.map((lh) => relativeErrorAt(lh, 'full'));

  const maxSelectiveError = Math.max(...selectiveErrors);
  const minFullError = Math.min(...fullErrors);
  const lockingRatio = minFullError / Math.max(maxSelectiveError, 1e-300);

  const detail = SLENDERNESS_RATIOS.map((lh, i) => {
    const se = selectiveErrors[i] ?? Number.NaN;
    const fe = fullErrors[i] ?? Number.NaN;
    return `L/h=${lh}: selective=${se.toExponential(2)}, full=${fe.toExponential(2)}`;
  }).join('; ');

  return {
    id: 'V-04',
    title: 'Nyírási záródás (shear locking) kimutatása',
    description:
      `Kéttámaszú tartó, egyenletes q, 2 elemes durva háló, L/h=${SLENDERNESS_RATIOS[0]}…` +
      `${SLENDERNESS_RATIOS.at(-1)} karcsúsági söprés. A \`selective\` séma hibája a ` +
      `karcsúsággal NEM nő (gépi pontosság marad), a \`full\` séma hibája NEM tűnik el, ` +
      `hanem nemnulla platón marad — ez maga a záródás. Részletek: ${detail}.`,
    reference: 'Diplomaterv 3.1.4 (szelektív redukált integrálás indoklása); element/quadrature.ts; docs/THEORY.md 4. fejezet',
    checks: [
      {
        label: 'max relatív hiba (selective, minden L/h-nál)',
        reference: 0,
        computed: maxSelectiveError,
        tolerance: 1e-6,
        kind: 'absolute',
      },
      {
        label: 'min relatív hiba (full, minden L/h-nál) — a záródás NEM tűnik el',
        reference: minFullError,
        computed: minFullError,
        tolerance: 0,
        kind: 'range',
        range: { min: 0.05, max: 1 },
      },
      {
        label: 'záródási arány: min(full-hiba) / max(selective-hiba)',
        reference: lockingRatio,
        computed: lockingRatio,
        tolerance: 0,
        kind: 'range',
        range: { min: 1000, max: 1e12 },
      },
    ],
  };
}
