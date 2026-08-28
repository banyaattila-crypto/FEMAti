/**
 * P-02 — Kör, körgyűrű, I-szelvény alaki tényezője (MASTER-PROMPT-TERV 3.2
 * táblázat; P9 prompt validációja).
 *
 * Diplomaterv 4. táblázat (54. oldal): kör c = 1.70; körgyűrű c = 1.27;
 * I-szelvény c = 1.14–1.16 (arányfüggő, ezért SÁV, nem egyetlen érték).
 */
import { geometricProperties, circle, iProfile, tube } from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseP02(): ValidationCase {
  const circleProps = geometricProperties(circle(0.4));
  // A táblázat c=1.27 értéke a VÉKONYFALÚ határeset (c→4/π≈1.2732,
  // t≪R-nél) — ezért vékony falú csövet választunk (t/R ≈ 0.01).
  const tubeProps = geometricProperties(tube(0.4, 0.002));
  // Zömök gerincű, korabeli (INP300-stílusú) I-szelvény — a mai karcsú
  // IPE/HEB gerincek c < 1.14-et adnak (lásd fem-core section.test.ts
  // 'minél nagyobb az övek aránya...' teszt), a táblázat 1.14-1.16 sávja a
  // diplomaterv-korabeli, zömökebb gerincű szelvényekre vonatkozott.
  const iProps = geometricProperties(iProfile(0.3, 0.125, 0.009, 0.015));

  const checks: ValidationCheck[] = [
    { label: 'kör: c = Kp/Kₑ', reference: 1.7, computed: circleProps.shapeFactor, tolerance: 0.02, kind: 'relative' },
    { label: 'körgyűrű: c = Kp/Kₑ', reference: 1.27, computed: tubeProps.shapeFactor, tolerance: 0.02, kind: 'relative' },
    {
      label: 'I-szelvény: c = Kp/Kₑ',
      reference: 1.15,
      computed: iProps.shapeFactor,
      tolerance: 0,
      kind: 'range',
      range: { min: 1.14, max: 1.16 },
    },
  ];

  return {
    id: 'P-02',
    title: 'Kör, körgyűrű, I-szelvény alaki tényezője',
    description: 'c = Kp/Kₑ a diplomaterv 4. táblázatának megfelelő értékekre áll be.',
    reference: 'Diplomaterv 4. táblázat, 54. oldal',
    checks,
  };
}
