/**
 * P-09 — Rétegelt (fiber) keresztmetszet M–κ görbéje zárt megoldással
 * (MASTER-PROMPT-TERV P10 prompt).
 *
 * Referencia: rugalmas–TÖKÉLETESEN képlékeny (H'=0) téglalap keresztmetszet
 * klasszikus, kézzel levezethető M(κ) görbéje:
 *   κ ≤ κY:  M = EI·κ                                    (rugalmas ág)
 *   κ > κY:  M = (3/2)·MY·(1 − (1/3)·(κY/κ)²)             (Handbook-formula,
 *            pl. Chen & Han, "Plasticity for Structural Engineers")
 * ahol κY = 2σY/(E·h) a folyási görbület, MY = σY·b·h²/6 a folyási nyomaték.
 * κ→∞ határesetben M → (3/2)·MY = σY·(b·h²/4) = σY·Kp = M0 — ugyanaz a
 * teherbírás, mint amit a P-01 (nem rétegelt modell) zárt alakban ad, ami
 * önmagában is egy belső konzisztencia-ellenőrzés a két anyagmodell között.
 *
 * A rétegelt modellben egyetlen, a virgin állapotból induló nagy lépés
 * (Δε = κ·z) is EGZAKT eredményt ad — a `updateLayerPlasticState` "még nem
 * folyt, IGEN" ága tetszőleges nagyságú, EGYSZERI (nem-ismétlődő irányú)
 * átlépésre zárt alakban helyes, nem csak kis lépésekre.
 */
import { INITIAL_LAYER_PLASTIC_STATE, generateLayers, geometricProperties, rect, sectionMoment, updateLayerPlasticState } from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseP09(): ValidationCase {
  const e = 2.1e8; // kN/m²
  const sigmaY = 2.35e5; // kN/m²
  const b = 0.2;
  const h = 0.4;
  const shape = rect(b, h);
  const layers = generateLayers(shape, 64);

  const closed = geometricProperties(shape);
  const kappaY = (2 * sigmaY) / (e * h);
  const my = (sigmaY * b * h * h) / 6;

  function momentAt(kappa: number): number {
    const stresses = layers.map((l) => updateLayerPlasticState(INITIAL_LAYER_PLASTIC_STATE, e, sigmaY, 0, kappa * l.z).sigma);
    return sectionMoment(layers, stresses);
  }

  function closedFormM(kappa: number): number {
    if (kappa <= kappaY) return e * closed.inertia * kappa;
    return 1.5 * my * (1 - (1 / 3) * (kappaY / kappa) ** 2);
  }

  const kappas = [0.5 * kappaY, kappaY, 2 * kappaY, 5 * kappaY, 50 * kappaY];
  const checks: ValidationCheck[] = kappas.map((kappa, i) => ({
    label: `M(κ) — ${i === 0 ? 'rugalmas' : i === 1 ? 'folyási határ' : 'képlékeny'} tartomány`,
    reference: closedFormM(kappa),
    computed: momentAt(kappa),
    tolerance: 0.01,
    kind: 'relative',
  }));

  return {
    id: 'P-09',
    title: 'Rétegelt keresztmetszet M–κ görbéje — zárt megoldással',
    description:
      'Rugalmas–tökéletesen képlékeny téglalap keresztmetszet M(κ) görbéje a rétegelt (64 réteges) modellel, ' +
      'kézi levezetésű zárt alakhoz hasonlítva öt görbületi szinten (rugalmas, éppen folyó, és három képlékeny pont).',
    reference: 'Diplomaterv 3.4.3, (3.53)-(3.59), 63-65. oldal; a zárt alak klasszikus rugalmas-képlékeny hajlítási eredmény',
    checks,
  };
}
