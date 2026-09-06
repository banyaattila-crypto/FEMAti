import { describe, expect, it } from 'vitest';
import { PRESETS } from '../data/catalog.js';
import { presetToEditable, resetEntityIds } from './editable.js';
import { DEFAULT_SOLVER_SETTINGS, ModelFileError, parseEditableModelFile, serializeEditableModel, type SolverSettingsFile } from './fileIO.js';

function fullModel() {
  resetEntityIds();
  const preset = PRESETS.find((p) => p.id === 'twospan');
  if (preset === undefined) throw new Error('twospan preset hiányzik a katalógusból');
  const model = presetToEditable(preset, 'twospan', 12, 16, 'IPE300', 'S235', true, 'selective');
  return {
    ...model,
    thermalLoad: { enabled: true, tRef: 10, tTop: 30, tBottom: -5 },
    // BEKAPCSOLT, valódi (nem alapértelmezett) állapotban — a fő kör-út
    // teszt enélkül csak azt bizonyítaná, hogy a KIKAPCSOLT alapértelmezés
    // marad kikapcsolt, nem hogy a TÉNYLEGES adat is sértetlenül átmegy.
    rebar: { enabled: true, asBottom: 12e-4, asTop: 4e-4, cover: 0.04 },
    composite: { enabled: true, slabWidth: 1.2, slabThickness: 0.12, slabMaterialId: 'C3037' },
    movingLoad: { enabled: true, magnitude: 35 },
    axialForce: 250,
    supports: model.supports.map((s, i) => (i === 0 ? { ...s, type: 'spring' as const, k: 4000, dz: 0.002, dPhi: 0.001 } : s)),
    loads: [...model.loads, { id: 'MQ1', kind: 'distributed-moment' as const, x1: 1, x2: 3, m1: 2, m2: 5, category: 'permanent' as const }],
    foundations: [{ id: 'W1', x1: 4, x2: 8, c: 1500, noTension: true }],
  };
}

const fullSolverSettings: SolverSettingsFile = {
  algorithm: 'modified-newton',
  loadHistory: 'unloading',
  loadStep: 0.05,
  tolerance: 0.25,
  peakLambda: 1.5,
  showGaussPoints: true,
  momentTensionSide: false,
  showReactions: false,
  unitSystem: 'imperial',
  activeDiagram: 'T',
};

describe('serializeEditableModel / parseEditableModelFile', () => {
  it('kör-út: minden mező (modell + megoldó-beállítások) sértetlenül visszaáll', () => {
    const model = fullModel();
    const json = serializeEditableModel(model, fullSolverSettings);
    const restored = parseEditableModelFile(json);
    expect(restored.model).toEqual(model);
    expect(restored.solverSettings).toEqual(fullSolverSettings);
  });

  it.each(['dynamic', 'utilization'] as const)(
    'a(z) "%s" diagram-fül aktív állapotban is sértetlenül visszaáll (regresszió: ezek a fülek eddig hiányoztak a beolvasás érvényességi listájáról)',
    (activeDiagram) => {
      const model = fullModel();
      const settings: SolverSettingsFile = { ...fullSolverSettings, activeDiagram };
      const json = serializeEditableModel(model, settings);
      const restored = parseEditableModelFile(json);
      expect(restored.solverSettings.activeDiagram).toBe(activeDiagram);
    },
  );

  it('érvénytelen JSON esetén ModelFileError-t dob', () => {
    expect(() => parseEditableModelFile('{ nem json')).toThrow(ModelFileError);
  });

  it('hiányzó femaiEditorFormat mezőnél ModelFileError-t dob', () => {
    expect(() => parseEditableModelFile(JSON.stringify({ model: {} }))).toThrow(ModelFileError);
  });

  it('ismeretlen tehertípusnál ModelFileError-t dob', () => {
    const model = fullModel();
    const file = JSON.parse(serializeEditableModel(model, fullSolverSettings)) as { model: { loads: unknown[] } };
    file.model.loads = [{ id: 'X', kind: 'unknown-kind', x: 1 }];
    expect(() => parseEditableModelFile(JSON.stringify(file))).toThrow(ModelFileError);
  });

  // Publikálás előtti audit (2026-09-06, LOG-001): korábban egy NEM LÉTEZŐ
  // katalógus-azonosító némán a katalógus ELSŐ elemére (IPE 100 / S235) esett
  // vissza, figyelmeztetés nélkül — a program a kértnél lényegesen kisebb
  // szelvénnyel számolt, és az eredményt érvényesként mutatta. Ez ellentmond a
  // projekt saját elvének (`fem-core/src/model/validate.ts`: "a néma hibás
  // eredmény rosszabb, mint a futás megtagadása"). A szigorítás biztonságos:
  // a katalógus-azonosítók az előzményben SOSEM változtak (125 valaha
  // létezett = 125 jelenlegi), tehát régi, érvényes mentést nem utasít el.
  it('NEM LÉTEZŐ sectionId esetén ModelFileError-t dob (nem esik némán másik szelvényre)', () => {
    const model = fullModel();
    const file = JSON.parse(serializeEditableModel(model, fullSolverSettings)) as { model: Record<string, unknown> };
    file.model.sectionId = 'NEM-LETEZO-SZELVENY-9999';
    expect(() => parseEditableModelFile(JSON.stringify(file))).toThrow(ModelFileError);
  });

  it('NEM LÉTEZŐ materialId esetén ModelFileError-t dob (nem esik némán másik anyagra)', () => {
    const model = fullModel();
    const file = JSON.parse(serializeEditableModel(model, fullSolverSettings)) as { model: Record<string, unknown> };
    file.model.materialId = 'NEM-LETEZO-ANYAG-9999';
    expect(() => parseEditableModelFile(JSON.stringify(file))).toThrow(ModelFileError);
  });

  it('NEM LÉTEZŐ composite.slabMaterialId esetén ModelFileError-t dob', () => {
    const model = fullModel();
    const file = JSON.parse(serializeEditableModel(model, fullSolverSettings)) as { model: { composite: Record<string, unknown> } };
    file.model.composite.slabMaterialId = 'NEM-LETEZO-BETON-9999';
    expect(() => parseEditableModelFile(JSON.stringify(file))).toThrow(ModelFileError);
  });

  it('a JELENLEG ÉRVÉNYES katalógus-azonosítókat továbbra is elfogadja', () => {
    const model = fullModel();
    const json = serializeEditableModel(model, fullSolverSettings);
    const restored = parseEditableModelFile(json);
    expect(restored.model.sectionId).toBe('IPE300');
    expect(restored.model.materialId).toBe('S235');
    expect(restored.model.composite.slabMaterialId).toBe('C3037');
  });

  it('hiányzó foundations mezőnél üres tömbre esik vissza (visszamenőleges kompatibilitás)', () => {
    const model = fullModel();
    const file = JSON.parse(serializeEditableModel(model, fullSolverSettings)) as { model: Record<string, unknown> };
    delete file.model.foundations;
    const restored = parseEditableModelFile(JSON.stringify(file));
    expect(restored.model.foundations).toEqual([]);
  });

  it('hiányzó foundations[].noTension mezőnél nem kerül be a mezőnk (2026-09-04 előtti mentések, ADR-0022)', () => {
    const model = fullModel();
    const file = JSON.parse(serializeEditableModel(model, fullSolverSettings)) as {
      model: { foundations: Array<Record<string, unknown>> };
    };
    delete file.model.foundations[0]?.noTension;
    const restored = parseEditableModelFile(JSON.stringify(file));
    expect(restored.model.foundations[0]).toEqual({ id: 'W1', x1: 4, x2: 8, c: 1500 });
  });

  it('hiányzó composite mezőnél a kikapcsolt alapértelmezésre esik vissza (2026-09-04 előtti mentések, visszamenőleges kompatibilitás)', () => {
    const model = fullModel();
    const file = JSON.parse(serializeEditableModel(model, fullSolverSettings)) as { model: Record<string, unknown> };
    delete file.model.composite;
    const restored = parseEditableModelFile(JSON.stringify(file));
    expect(restored.model.composite).toEqual({ enabled: false, slabWidth: 1.0, slabThickness: 0.1, slabMaterialId: 'C25' });
  });

  it('hiányzó movingLoad mezőnél a kikapcsolt alapértelmezésre esik vissza (2026-09-04 előtti mentések, visszamenőleges kompatibilitás)', () => {
    const model = fullModel();
    const file = JSON.parse(serializeEditableModel(model, fullSolverSettings)) as { model: Record<string, unknown> };
    delete file.model.movingLoad;
    const restored = parseEditableModelFile(JSON.stringify(file));
    expect(restored.model.movingLoad).toEqual({ enabled: false, magnitude: 10 });
  });

  it('hiányzó axialForce mezőnél 0-ra (kikapcsolt P-Δ) esik vissza (2026-09-04 előtti mentések, visszamenőleges kompatibilitás)', () => {
    const model = fullModel();
    const file = JSON.parse(serializeEditableModel(model, fullSolverSettings)) as { model: Record<string, unknown> };
    delete file.model.axialForce;
    const restored = parseEditableModelFile(JSON.stringify(file));
    expect(restored.model.axialForce).toBe(0);
  });

  it('1. verziójú (solverSettings nélküli) régi mentés beolvasásakor az alapértelmezésekre esik vissza, nem hibázik', () => {
    const model = fullModel();
    const legacyFile = { femaiEditorFormat: 1, model };
    const restored = parseEditableModelFile(JSON.stringify(legacyFile));
    expect(restored.model).toEqual(model);
    expect(restored.solverSettings).toEqual(DEFAULT_SOLVER_SETTINGS);
  });

  it('showReactions nélküli (a mai bővítés előtti) v2 mentésnél `true`-ra esik vissza, nem hibázik', () => {
    const model = fullModel();
    const file = JSON.parse(serializeEditableModel(model, fullSolverSettings)) as { solverSettings: Record<string, unknown> };
    delete file.solverSettings.showReactions;
    const restored = parseEditableModelFile(JSON.stringify(file));
    expect(restored.solverSettings.showReactions).toBe(true);
  });

  it('érvénytelen algorithm értéknél ModelFileError-t dob', () => {
    const model = fullModel();
    const file = JSON.parse(serializeEditableModel(model, fullSolverSettings)) as { solverSettings: Record<string, unknown> };
    file.solverSettings.algorithm = 'gauss-seidel';
    expect(() => parseEditableModelFile(JSON.stringify(file))).toThrow(ModelFileError);
  });
});
