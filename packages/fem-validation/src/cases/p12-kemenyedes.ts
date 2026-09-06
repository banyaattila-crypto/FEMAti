/**
 * P-12 — Keményedés, egytengelyű ellenőrzés (MASTER-PROMPT-TERV 3.2 táblázat;
 * P9 prompt validációja).
 *
 * `EI_T = EI·H'/(EI+H')` (Diplomaterv (3.51), 63. oldal) — zárt alakú
 * ellenőrzés, ezért a tűrés gépi pontosság (1e−8).
 */
import { tangentBendingStiffness } from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseP12(): ValidationCase {
  const ei = 20000; // kNm²
  const cases: readonly { readonly hPrime: number; readonly label: string }[] = [
    { hPrime: 5000, label: "H' = 5000 kNm²" },
    { hPrime: 20000, label: "H' = EI (fele akkora tangens)" },
    { hPrime: 0, label: "H' = 0 (tökéletesen képlékeny)" },
  ];

  const checks: ValidationCheck[] = cases.map((c) => {
    const reference = c.hPrime <= 0 ? 0 : (ei * c.hPrime) / (ei + c.hPrime);
    return {
      label: `EI_T, ${c.label}`,
      reference,
      computed: tangentBendingStiffness(ei, c.hPrime),
      tolerance: 1e-8,
      kind: 'relative',
    };
  });

  return {
    id: 'P-12',
    title: 'Keményedés — egytengelyű ellenőrzés',
    description: "EI_T = EI·H'/(EI+H') zárt alakban, H' = 0-nál EI_T = 0.",
    reference: 'Diplomaterv (3.50)–(3.51), 63. oldal',
    checks,
  };
}
