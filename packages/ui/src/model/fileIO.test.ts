import { describe, expect, it } from 'vitest';
import { PRESETS } from '../data/catalog.js';
import { presetToEditable, resetEntityIds } from './editable.js';
import { ModelFileError, parseEditableModelFile, serializeEditableModel } from './fileIO.js';

function fullModel() {
  resetEntityIds();
  const preset = PRESETS.find((p) => p.id === 'twospan');
  if (preset === undefined) throw new Error('twospan preset hiányzik a katalógusból');
  const model = presetToEditable(preset, 'twospan', 12, 16, 'IPE300', 'S235', true, 'selective');
  return {
    ...model,
    thermalLoad: { enabled: true, tRef: 10, tTop: 30, tBottom: -5 },
    supports: model.supports.map((s, i) => (i === 0 ? { ...s, type: 'spring' as const, k: 4000, dz: 0.002, dPhi: 0.001 } : s)),
    loads: [...model.loads, { id: 'MQ1', kind: 'distributed-moment' as const, x1: 1, x2: 3, m1: 2, m2: 5 }],
    foundations: [{ id: 'W1', x1: 4, x2: 8, c: 1500 }],
  };
}

describe('serializeEditableModel / parseEditableModelFile', () => {
  it('kör-út: minden mező (rugós/dz/dPhi támasz, megoszló nyomaték, ágyazat, hőteher) sértetlenül visszaáll', () => {
    const model = fullModel();
    const json = serializeEditableModel(model);
    const restored = parseEditableModelFile(json);
    expect(restored).toEqual(model);
  });

  it('érvénytelen JSON esetén ModelFileError-t dob', () => {
    expect(() => parseEditableModelFile('{ nem json')).toThrow(ModelFileError);
  });

  it('hiányzó femaiEditorFormat mezőnél ModelFileError-t dob', () => {
    expect(() => parseEditableModelFile(JSON.stringify({ model: {} }))).toThrow(ModelFileError);
  });

  it('ismeretlen tehertípusnál ModelFileError-t dob', () => {
    const model = fullModel();
    const file = JSON.parse(serializeEditableModel(model)) as { model: { loads: unknown[] } };
    file.model.loads = [{ id: 'X', kind: 'unknown-kind', x: 1 }];
    expect(() => parseEditableModelFile(JSON.stringify(file))).toThrow(ModelFileError);
  });

  it('hiányzó foundations mezőnél üres tömbre esik vissza (visszamenőleges kompatibilitás)', () => {
    const model = fullModel();
    const file = JSON.parse(serializeEditableModel(model)) as { model: Record<string, unknown> };
    delete file.model.foundations;
    const restored = parseEditableModelFile(JSON.stringify(file));
    expect(restored.foundations).toEqual([]);
  });
});
