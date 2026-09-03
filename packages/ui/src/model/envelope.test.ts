import { beforeEach, describe, expect, it } from 'vitest';
import { PRESETS } from '../data/catalog.js';
import { presetToEditable, resetEntityIds } from './editable.js';
import { computeEnvelope } from './envelope.js';
import { solveEditableModel } from './compile.js';

beforeEach(() => resetEntityIds());

describe('computeEnvelope — mozgó teher burkolóábra (2026-09-04)', () => {
  it('kikapcsolt mozgó teherre null-t ad', () => {
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = presetToEditable(preset, 'simple', 6, 8, 'IPE300', 'S235', false, 'selective');
    expect(editable.movingLoad.enabled).toBe(false);
    expect(computeEnvelope(editable)).toBeNull();
  });

  it('minden csomópontra mMax >= mMin és tMax >= tMin', () => {
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = {
      ...presetToEditable(preset, 'simple', 6, 8, 'IPE300', 'S235', false, 'selective'),
      movingLoad: { enabled: true, magnitude: 20 },
    };
    const envelope = computeEnvelope(editable);
    expect(envelope).not.toBeNull();
    if (envelope === null) return;

    envelope.xs.forEach((_, i) => {
      expect(envelope.mMax[i]).toBeGreaterThanOrEqual(envelope.mMin[i] as number);
      expect(envelope.tMax[i]).toBeGreaterThanOrEqual(envelope.tMin[i] as number);
    });
  });

  it('a burkoló minden pontban legalább akkora, mint EGYETLEN konkrét (középső) teherpozíció M-je — a max tényleg felső korlát', () => {
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const base = presetToEditable(preset, 'simple', 6, 8, 'IPE300', 'S235', false, 'selective');
    const editable = { ...base, movingLoad: { enabled: true, magnitude: 20 } };
    const envelope = computeEnvelope(editable);
    expect(envelope).not.toBeNull();
    if (envelope === null) return;

    // Egyetlen konkrét eset: a mozgó teher a felező pontban áll.
    const midX = base.span / 2;
    const withMidLoad = {
      ...base,
      loads: [...base.loads, { id: '__test-mid__', kind: 'point' as const, x: midX, p: 20, category: 'variable' as const }],
    };
    const midResult = solveEditableModel(withMidLoad).result;
    expect(midResult).not.toBeNull();
    if (midResult === null) return;

    midResult.nodes.forEach((node, i) => {
      expect(envelope.mMax[i]).toBeGreaterThanOrEqual(node.m - 1e-9);
      expect(envelope.mMin[i]).toBeLessThanOrEqual(node.m + 1e-9);
    });
  });
});
