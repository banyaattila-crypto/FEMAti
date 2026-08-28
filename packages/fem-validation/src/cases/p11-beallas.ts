/**
 * P-11 — Beállás ("shakedown") (MASTER-PROMPT-TERV 3.2 táblázat, 3.3 pont;
 * P12 prompt).
 *
 * Folytatás a P-10 forgatókönyvéből: κ1-ig terhelünk (részleges folyás),
 * nulla nyomatékig tehermentesítünk, majd ÚJRATERHELÜNK pontosan κ1-ig — a
 * klasszikus "beállás" jelenség szerint ez a második terhelési szakasz
 * TISZTÁN RUGALMAS kell legyen (a maradó feszültségek kitágították az
 * elérhető rugalmas tartományt pontosan az előző terhelési csúcsig): a
 * nyomatéknak vissza kell térnie M₁-re, és EGYETLEN rétegben sem nőhet az
 * effektív képlékeny alakváltozás (`epsPEff`).
 */
import { generateLayers, INITIAL_LAYER_PLASTIC_STATE, rect, sectionMoment, updateLayerPlasticState } from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseP11(): ValidationCase {
  const e = 2.1e8;
  const sigmaY = 2.35e5;
  const hPrime = 0;
  const shape = rect(0.2, 0.4);
  const layers = generateLayers(shape, 64);

  const eiElastic = layers.reduce((s, l) => s + e * l.b * l.z * l.z * l.t, 0);
  const kappaY = (2 * sigmaY) / (e * 0.4);
  const kappa1 = 1.5 * kappaY;

  const loaded = layers.map((l) => updateLayerPlasticState(INITIAL_LAYER_PLASTIC_STATE, e, sigmaY, hPrime, kappa1 * l.z));
  const stresses1 = loaded.map((r) => r.sigma);
  const m1 = sectionMoment(layers, stresses1);

  const deltaKappaUnload = -m1 / eiElastic;
  const unloaded = layers.map((l, i) => {
    const prev = loaded[i];
    if (prev === undefined) throw new Error('hiányzó réteg');
    return updateLayerPlasticState(prev.state, e, sigmaY, hPrime, deltaKappaUnload * l.z);
  });

  // Újraterhelés PONTOSAN κ1-ig (ugyanannyi Δκ, ellentétes előjellel).
  const reloaded = layers.map((l, i) => {
    const prev = unloaded[i];
    if (prev === undefined) throw new Error('hiányzó réteg');
    return updateLayerPlasticState(prev.state, e, sigmaY, hPrime, -deltaKappaUnload * l.z);
  });
  const stresses3 = reloaded.map((r) => r.sigma);
  const m3 = sectionMoment(layers, stresses3);

  const maxEpsPEffGrowth = layers.reduce((max, _l, i) => {
    const before = loaded[i]?.state.epsPEff ?? 0;
    const after = reloaded[i]?.state.epsPEff ?? 0;
    return Math.max(max, Math.abs(after - before));
  }, 0);

  const checks: ValidationCheck[] = [
    {
      label: 'az újraterhelés κ1-nél pontosan M₁-et ad vissza',
      reference: m1,
      computed: m3,
      tolerance: 1e-8,
      kind: 'relative',
    },
    {
      label: 'egyetlen rétegben sem nő az effektív képlékeny alakváltozás (beállás)',
      reference: 0,
      computed: maxEpsPEffGrowth,
      tolerance: 1e-10,
      kind: 'absolute',
    },
  ];

  return {
    id: 'P-11',
    title: 'Beállás (shakedown)',
    description:
      'A P-10 tehermentesítése után κ1-ig újraterhelve a válasz TISZTÁN rugalmas: a nyomaték ' +
      'pontosan M₁-re tér vissza, és egyetlen rétegben sem keletkezik ÚJ képlékeny alakváltozás.',
    reference: 'MASTER-PROMPT-TERV 3.2 táblázat (P-11), 3.3 pont; klasszikus "shakedown" tétel',
    checks,
  };
}
