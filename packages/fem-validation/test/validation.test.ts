import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { allCases, checkError, generateValidationReport, type ValidationCase } from '../src/index.js';

/**
 * A P4 fázis kötelező lineáris esetei (MASTER-PROMPT-TERV P4 prompt):
 * "Kösd be a fem-validation csomagba a V-01, V-03, V-05, V-06, V-11
 * eseteket... Elfogadás: mind az öt validációs eset zölden fut."
 *
 * A teszt futása egyben GENERÁLJA a docs/VALIDATION.md-t (afterAll) — ez a
 * MASTER-PROMPT-TERV 3.3 pontjának megfelelő, "a csomag futása állítja elő"
 * jegyzőkönyv.
 */

const cases = allCases();

afterAll(() => {
  const here = dirname(fileURLToPath(import.meta.url));
  const docsDir = resolve(here, '../../../docs');
  if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });
  writeFileSync(resolve(docsDir, 'VALIDATION.md'), generateValidationReport(cases), 'utf-8');
});

describe.each(cases.map((c): [string, ValidationCase] => [c.id, c]))('%s', (_id, validationCase) => {
  it(`${validationCase.title} — minden ellenőrzés a tűrésen belül`, () => {
    for (const check of validationCase.checks) {
      expect(checkError(check), check.label).toBeLessThanOrEqual(check.tolerance);
    }
  });
});
