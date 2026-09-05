import type { Tone } from './numbers.js';

/**
 * Kihasználtsági verdikt — a `RightPanel`/`ReportView` közös tónus-logikája,
 * hogy a "megfelel/túllépi" döntés egy helyen legyen definiálva, ne az
 * egyes kártyákban duplikálódjon. A `code` nyelv-semleges (i18n 2026-09-05):
 * ez a modul a `format/` réteg része, nem tudhat UI-nyelvet — a tényleges
 * feliratot a hívó fordítja `i18n/panels.ts` `VERDICT_LABEL`-jével.
 */
export type UtilizationVerdictCode = 'ok' | 'exceeded' | 'unknown';

export interface UtilizationVerdict {
  readonly code: UtilizationVerdictCode;
  readonly tone: Tone;
}

export function utilizationVerdict(utilization: number | null): UtilizationVerdict {
  if (utilization === null || !Number.isFinite(utilization)) return { code: 'unknown', tone: 'neutral' };
  return utilization <= 1 ? { code: 'ok', tone: 'ok' } : { code: 'exceeded', tone: 'error' };
}
