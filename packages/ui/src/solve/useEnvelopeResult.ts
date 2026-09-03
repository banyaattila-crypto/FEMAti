/**
 * Mozgó teher — burkolóábra, GATED újraszámolással — a `useModalResult.ts`
 * mintájára. A burkoló akár 201 külön lineáris megoldást is futtathat
 * (`model/envelope.ts` fejléce), ezért NEM fut minden modellváltozásnál
 * (P7 élő < 50 ms költségvetése) — a `DiagramPanel.tsx` `false`-t ad át,
 * amíg a "burkolóábra" fül nincs aktív.
 */
import { useMemo } from 'react';
import { computeEnvelope, type EnvelopeResult } from '../model/envelope.js';
import type { EditableModel } from '../model/editable.js';

export function useEnvelopeResult(model: EditableModel, enabled: boolean): EnvelopeResult | null {
  return useMemo(() => (enabled ? computeEnvelope(model) : null), [model, enabled]);
}
