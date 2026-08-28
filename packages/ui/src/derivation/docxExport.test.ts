import { describe, expect, it } from 'vitest';
import {
  deriveElementInternalForces,
  deriveElementLoadVector,
  deriveElementStiffness,
  elementGlobalNodeIndices,
  solveLinear,
} from '@femati/fem-core';
import { DEFAULT_MATERIAL_ID, DEFAULT_SECTION_ID, findMaterial, findPreset, findSection, PRESETS } from '../data/catalog.js';
import { presetToEditable, resetEntityIds } from '../model/editable.js';
import { compileLayeredModel } from '../model/nonlinear.js';
import { buildDerivationExportData } from './derivationExportData.js';
import { buildDerivationDocx } from './docxExport.js';

describe('docxExport — a teljes 4.7/5/6 bővítés nem töri el a .docx generálást', () => {
  it('buildDerivationDocx(...) ténylegesen elkészít egy nem-üres Blob-ot, minden új mezővel együtt', async () => {
    resetEntityIds();
    const preset = PRESETS.find((p) => p.id === 'simple');
    if (preset === undefined) throw new Error('simple preset hiányzik');
    const editable = presetToEditable(preset, 'simple', 6, 4, DEFAULT_SECTION_ID, DEFAULT_MATERIAL_ID, false, 'selective');
    const model = compileLayeredModel(editable);
    const elementId = model.elements[0]?.id as unknown as string;

    const linear = solveLinear(model);
    const elementDerivation = deriveElementStiffness(model, elementId);
    const loadDerivation = deriveElementLoadVector(model, elementId);
    const internalForceDerivation = deriveElementInternalForces(model, elementId, linear.displacements);
    const globalNodeIdx = elementGlobalNodeIndices(model, elementId);

    const layeredSection = model.sections[0];
    const layers = layeredSection?.kind === 'layered' ? layeredSection.layers : [];
    const layerA = layers.reduce((s, l) => s + (l.b as number) * (l.t as number), 0);
    const layerI = layers.reduce((s, l) => s + (l.b as number) * (l.z as number) ** 2 * (l.t as number), 0);

    const boundaryRows: readonly (readonly [string, string, string])[] = model.boundaries.map((b) => {
      const nodeIndex = model.nodes.findIndex((n) => (n.id as unknown as string) === (b.nodeId as unknown as string));
      const x = model.nodes[nodeIndex]?.x as unknown as number | undefined;
      const dofs = [b.wFixed ? 'w = 0' : null, b.phiFixed ? 'φ = 0' : null].filter((v): v is string => v !== null);
      return [String(nodeIndex), x !== undefined ? x.toFixed(3) : '—', dofs.length > 0 ? dofs.join(', ') : '(csak rugó)'] as const;
    });

    const exportData = buildDerivationExportData({
      model: editable,
      preset: findPreset('simple'),
      section: findSection(DEFAULT_SECTION_ID),
      material: findMaterial(DEFAULT_MATERIAL_ID),
      linear,
      layers,
      layerA,
      layerI,
      elementDerivation,
      loadDerivation,
      internalForceDerivation,
      globalNodeIdx,
      boundaryRows,
      elementResult: linear.elements.find((e) => e.elementId === elementId),
      nonlinearRun: null,
      hinges: [],
      plasticSampleTitle: '',
      plasticLayerDerivations: [],
    });

    // Alapvető tartalom-ellenőrzés: a 4.7/5.1-5.3/6.1 új mezői ténylegesen
    // meg vannak töltve (nem üres tömb/string) — a `buildDerivationDocx`
    // ezeket rendereli a dokumentumba.
    expect(exportData.loadFormulas.length).toBeGreaterThan(0);
    expect(exportData.assemblyRows.length).toBe(6);
    expect(exportData.boundaryRows.length).toBeGreaterThan(0);
    expect(exportData.internalForceFormulas.length).toBeGreaterThan(0);

    const blob = await buildDerivationDocx(exportData);
    expect(blob.size).toBeGreaterThan(0);
  });
});
