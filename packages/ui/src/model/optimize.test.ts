import { beforeEach, describe, expect, it } from 'vitest';
import { PRESETS, findSection } from '../data/catalog.js';
import { presetToEditable, resetEntityIds } from './editable.js';
import { findSmallestSuitableSection } from './optimize.js';

beforeEach(() => resetEntityIds());

describe('findSmallestSuitableSection', () => {
  it('egy alulméretezett IPE100-ról egy nagyobb, megfelelő IPE-t javasol', () => {
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = presetToEditable(preset, 'simple', 6, 8, 'IPE100', 'S235', false, 'selective');

    const outcome = findSmallestSuitableSection(editable);

    expect(outcome.candidates.length).toBeGreaterThan(1);
    // Terület szerint szigorúan növekvő sorrend.
    for (let i = 1; i < outcome.candidates.length; i++) {
      expect(outcome.candidates[i]?.area).toBeGreaterThanOrEqual(outcome.candidates[i - 1]?.area ?? 0);
    }
    expect(outcome.best).not.toBeNull();
    expect(outcome.best?.ok).toBe(true);
    expect(outcome.best?.sectionId).not.toBe('IPE100');
    // A javasolt kihasználtság ne haladja meg a 100%-ot.
    expect(outcome.best?.governing ?? Infinity).toBeLessThanOrEqual(1);
  });

  it('csak a jelenlegivel AZONOS szelvénycsaládot (kind) vizsgálja', () => {
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = presetToEditable(preset, 'simple', 6, 8, 'IPE300', 'S235', false, 'selective');

    const outcome = findSmallestSuitableSection(editable);

    expect(outcome.candidates.every((c) => findSection(c.sectionId).kind === 'I')).toBe(true);
  });
});
