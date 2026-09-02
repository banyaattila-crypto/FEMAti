import type { Tone } from './numbers.js';

/**
 * Kihasználtsági verdikt — a `RightPanel`/`ReportView` közös szöveges és
 * tónus-logikája, hogy a "megfelel/túllépi" döntés egy helyen legyen
 * definiálva, ne az egyes kártyákban duplikálódjon.
 */
export interface UtilizationVerdict {
  readonly label: string;
  readonly tone: Tone;
}

export function utilizationVerdict(utilization: number | null): UtilizationVerdict {
  if (utilization === null || !Number.isFinite(utilization)) return { label: '—', tone: 'neutral' };
  return utilization <= 1
    ? { label: 'megfelel a határértéknek', tone: 'ok' }
    : { label: 'túllépi a határt', tone: 'error' };
}
