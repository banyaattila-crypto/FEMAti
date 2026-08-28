/**
 * P-01 — Téglalap keresztmetszet alaki tényezője (MASTER-PROMPT-TERV 3.2
 * táblázat; P9 prompt validációja).
 *
 * c = Kp/Kₑ = Mp/Mₑ — a diplomaterv 4. táblázata (54. oldal) szerint
 * téglalap keresztmetszetre c = 1.50. Zárt alakú, parametrikus számítás
 * (`geometricProperties`) — nincs rétegzésből adódó diszkretizációs hiba,
 * ezért a tűrés a táblázat szerinti (1%), NEM a rétegelt modell (P10)
 * konvergencia-korlátja.
 */
import { geometricProperties, plasticMomentCapacity, rect } from '@femati/fem-core';
import type { ValidationCase } from '../types.js';

export function caseP01(): ValidationCase {
  const props = geometricProperties(rect(0.2, 0.4));
  const sigmaY = 2.35e5; // kN/m²

  const m0 = plasticMomentCapacity(sigmaY, props.plasticModulus);
  const me = sigmaY * props.elasticModulus;

  return {
    id: 'P-01',
    title: 'Téglalap keresztmetszet, Mp/Mₑ alaki tényező',
    description: 'c = Kp/Kₑ = Mp/Mₑ = 1.50 téglalap keresztmetszetre (zárt alak, parametrikus).',
    reference: 'Diplomaterv 4. táblázat, 54. oldal; (3.37), (3.39), 53. oldal',
    checks: [
      {
        label: 'c = Kp/Kₑ',
        reference: 1.5,
        computed: props.shapeFactor,
        tolerance: 0.01,
        kind: 'relative',
      },
      {
        label: 'c = Mp/Mₑ (a teherbírásokból számolva)',
        reference: 1.5,
        computed: m0 / me,
        tolerance: 0.01,
        kind: 'relative',
      },
    ],
  };
}
