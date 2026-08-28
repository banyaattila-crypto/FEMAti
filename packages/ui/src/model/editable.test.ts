import { beforeEach, describe, expect, it } from 'vitest';
import { PRESETS } from '../data/catalog.js';
import { nextEntityId, presetToEditable, resetEntityIds, snapToNode } from './editable.js';

beforeEach(() => resetEntityIds());

describe('snapToNode', () => {
  it('a legközelebbi hálócsomópontra kerekít', () => {
    // span=12, elementCount=16 → csomópont-osztás = 12/32 = 0.375 m
    expect(snapToNode(0.4, 12, 16)).toBeCloseTo(0.375, 10);
    expect(snapToNode(0.5, 12, 16)).toBeCloseTo(0.375, 10);
    expect(snapToNode(0.6, 12, 16)).toBeCloseTo(0.75, 10);
  });

  it('a tartományon kívüli értéket levágja [0, span]-re', () => {
    expect(snapToNode(-5, 12, 16)).toBe(0);
    expect(snapToNode(100, 12, 16)).toBeCloseTo(12, 10);
  });
});

describe('nextEntityId', () => {
  it('minden hívásnál egyedi, növekvő azonosítót ad', () => {
    const a = nextEntityId('S');
    const b = nextEntityId('S');
    expect(a).not.toBe(b);
    expect(a.startsWith('S')).toBe(true);
  });
});

describe('presetToEditable', () => {
  it('a preset támaszait és terheit a hálóra illeszti', () => {
    const preset = PRESETS.find((p) => p.id === 'twospan');
    if (preset === undefined) throw new Error('twospan preset hiányzik a katalógusból');
    const model = presetToEditable(preset, 'twospan', 12, 16, 'IPE300', 'S235', false, 'selective');

    expect(model.supports).toHaveLength(3);
    expect(model.supports[0]?.x).toBeCloseTo(0, 10);
    expect(model.supports[1]?.x).toBeCloseTo(6, 10);
    expect(model.supports[2]?.x).toBeCloseTo(12, 10);
    expect(model.loads).toHaveLength(1);
    expect(model.loads[0]?.kind).toBe('distributed');
  });

  it('nulla q/p esetén nem generál terhet', () => {
    const preset = PRESETS.find((p) => p.id === 'cantilever');
    if (preset === undefined) throw new Error('cantilever preset hiányzik a katalógusból');
    const model = presetToEditable(preset, 'cantilever', 4, 8, 'IPE300', 'S235', false, 'selective');
    // A cantilever presetnek csak pontterhe van (q=0), a megoszló teher nem jelenhet meg.
    expect(model.loads.filter((l) => l.kind === 'distributed')).toHaveLength(0);
    expect(model.loads.filter((l) => l.kind === 'point')).toHaveLength(1);
  });
});
