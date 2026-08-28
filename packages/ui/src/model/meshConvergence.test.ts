import { beforeEach, describe, expect, it } from 'vitest';
import { PRESETS } from '../data/catalog.js';
import { presetToEditable, resetEntityIds } from './editable.js';
import { DEFAULT_MESH_CONVERGENCE_COUNTS, runMeshConvergence } from './meshConvergence.js';

beforeEach(() => resetEntityIds());

function simpleEditable(elementCount = 8) {
  const preset = PRESETS.find((p) => p.id === 'simple');
  if (preset === undefined) throw new Error('simple preset hiányzik');
  return presetToEditable(preset, 'simple', 6, elementCount, 'IPE300', 'S235', false, 'selective');
}

describe('runMeshConvergence', () => {
  it('az elemszám-sorozat minden tagjára ad egy pontot, azonos sorrendben', () => {
    const points = runMeshConvergence(simpleEditable());
    expect(points.map((p) => p.elementCount)).toEqual([...DEFAULT_MESH_CONVERGENCE_COUNTS]);
  });

  it('az első pontnál nincs relatív eltérés (nincs "előző" háló)', () => {
    const [first] = runMeshConvergence(simpleEditable());
    expect(first?.wRelChangePercent).toBeNull();
    expect(first?.mRelChangePercent).toBeNull();
  });

  it('egyszerű (koncentrált/megoszló terhű) tartónál MINDEN relatív eltérés gépi pontosság közelében marad', () => {
    // A záródásmentes (szelektív redukált integrálású) kvadratikus elem
    // ezt az egyszerű esetet MÁR N=4-nél is (közel) egzaktul megoldja —
    // ez NEM hiba, hanem a locking-free formuláció erőssége (ld. V-04).
    // Ezért itt nem csökkenő TENDENCIÁT várunk (a maradék eltérés a
    // lebegőpontos zaj szintjén van, nem monoton), hanem azt, hogy a
    // hálófüggetlenség GYAKORLATILAG már a legdurvább hálón is fennáll.
    const points = runMeshConvergence(simpleEditable());
    const changes = points.slice(1).map((p) => p.wRelChangePercent);
    expect(changes.every((c) => c !== null)).toBe(true);
    for (const c of changes) {
      expect(c).toBeLessThan(1e-6);
    }
  });

  it('a DOF-szám a hálósűrűséggel nő', () => {
    const points = runMeshConvergence(simpleEditable());
    const dofCounts = points.map((p) => p.dofCount);
    for (let i = 1; i < dofCounts.length; i++) {
      const prev = dofCounts[i - 1];
      const cur = dofCounts[i];
      if (prev === undefined || cur === undefined) throw new Error('hiányzó DOF-érték');
      expect(cur).toBeGreaterThan(prev);
    }
  });

  it('megoldhatatlan modellnél (nincs támasz) hibát jelez, nem dob kivételt, és nem szakítja meg a sorozatot', () => {
    const editable = { ...simpleEditable(), supports: [] };
    const points = runMeshConvergence(editable, [4, 8]);
    expect(points).toHaveLength(2);
    for (const p of points) {
      expect(p.error).not.toBeNull();
      expect(Number.isNaN(p.wMax)).toBe(true);
      expect(p.wRelChangePercent).toBeNull();
    }
  });

  it('egyéni elemszám-sorozattal is működik', () => {
    const points = runMeshConvergence(simpleEditable(), [5, 10]);
    expect(points.map((p) => p.elementCount)).toEqual([5, 10]);
  });
});
