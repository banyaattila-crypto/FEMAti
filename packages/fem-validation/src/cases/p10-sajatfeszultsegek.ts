/**
 * P-10 — Tehermentesítés → sajátfeszültségek (MASTER-PROMPT-TERV 3.2
 * táblázat, 3.3 pont; P12 prompt).
 *
 * Egy keresztmetszetet (nem egy egész gerendát) terhelünk a folyás fölé,
 * majd tehermentesítünk NULLA külső nyomatékig. Mivel a `updateLayerPlasticState`
 * TEHERMENTESÍTÉSKOR minden rétegnél (a korábbi folyási állapottól
 * függetlenül) a rugalmas `E` meredekséggel tér vissza (ld.
 * `material/elastoPlastic1D.ts` fejléce), a TELJES keresztmetszet
 * tehermentesítési válasza EGZAKTUL LINEÁRIS, a TELJES rugalmas `EI`-vel — a
 * nulla nyomatékhoz tartozó Δκ ezért zárt alakban egyetlen lépésben
 * számítható (`Δκ = −M₁/EI`), nem kell iterálni.
 *
 * A visszamaradó (maradó/saját-) feszültségek a rétegekben NEM nullák, de az
 * eredőjüknek egyensúlyt kell tartania: `∫σ dA = 0` (nincs axiális erő a
 * modellben — ez egy szimmetrikus téglalapnál az `ε(z)=κ·z` páratlan
 * alakváltozásmező miatt AUTOMATIKUSAN, a σ(z) páratlan szimmetriájából
 * következik — a teszt ezt a szimmetriát őrzi), és `∫σ·z dA = 0` (ez a
 * VALÓDI, nemtriviális ellenőrzés: hogy a tehermentesítés PONTOSAN
 * nullnyomatékra vezet-e vissza).
 */
import { generateLayers, INITIAL_LAYER_PLASTIC_STATE, rect, sectionMoment, updateLayerPlasticState } from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseP10(): ValidationCase {
  const e = 2.1e8; // kN/m²
  const sigmaY = 2.35e5; // kN/m²
  const hPrime = 0;
  const shape = rect(0.2, 0.4);
  const layers = generateLayers(shape, 64);

  const eiElastic = layers.reduce((s, l) => s + e * l.b * l.z * l.z * l.t, 0);
  const kappaY = (2 * sigmaY) / (e * 0.4);
  const kappa1 = 1.5 * kappaY; // részleges folyás (a szélső szálak folynak, a mag rugalmas)

  // 1) Terhelés a virgin állapotból κ1-ig.
  const loaded = layers.map((l) => updateLayerPlasticState(INITIAL_LAYER_PLASTIC_STATE, e, sigmaY, hPrime, kappa1 * l.z));
  const stresses1 = loaded.map((r) => r.sigma);
  const m1 = sectionMoment(layers, stresses1);

  // 2) Tehermentesítés nulla nyomatékig, zárt alakban: Δκ = −M₁/EI.
  const deltaKappaUnload = -m1 / eiElastic;
  const unloaded = layers.map((l, i) => {
    const prev = loaded[i];
    if (prev === undefined) throw new Error('hiányzó réteg');
    return updateLayerPlasticState(prev.state, e, sigmaY, hPrime, deltaKappaUnload * l.z);
  });
  const stresses2 = unloaded.map((r) => r.sigma);
  const m2 = sectionMoment(layers, stresses2);

  const netAxial = layers.reduce((s, l, i) => s + (stresses2[i] ?? 0) * l.b * l.t, 0);

  // A legkülső réteg maradó feszültsége — annak bizonyítéka, hogy VALÓDI
  // (nullától jól megkülönböztethető) sajátfeszültség maradt vissza, nem
  // csak numerikus zaj.
  const outerResidual = stresses2[0] ?? 0;
  const outerScale = sigmaY;

  const checks: ValidationCheck[] = [
    {
      label: '∫σ·z dA = 0 (a tehermentesítés PONTOSAN nullnyomatékra vezet vissza)',
      reference: 0,
      computed: m2,
      tolerance: 1e-6,
      kind: 'absolute',
    },
    {
      label: '∫σ dA = 0 (nincs axiális erő — a szimmetria megőrződik)',
      reference: 0,
      computed: netAxial,
      tolerance: 1e-6,
      kind: 'absolute',
    },
    {
      label: 'a legkülső réteg maradó feszültsége a σY nagyságrendjében van (valódi sajátfeszültség)',
      reference: 1,
      computed: Math.abs(outerResidual) / outerScale,
      tolerance: 0,
      kind: 'range',
      range: { min: 0.05, max: 1 },
    },
  ];

  return {
    id: 'P-10',
    title: 'Tehermentesítés — sajátfeszültségek',
    description:
      'Egy téglalap keresztmetszetet 1.5·κY-ig terhelünk (részleges folyás), majd nulla ' +
      'nyomatékig tehermentesítünk — a visszamaradó rétegenkénti feszültségek egyensúlyt tartanak, ' +
      'de egyedileg nem nullák (sajátfeszültség).',
    reference: 'MASTER-PROMPT-TERV 3.2 táblázat (P-10), 3.3 pont; Diplomaterv 3.4.4 elve',
    checks,
  };
}
