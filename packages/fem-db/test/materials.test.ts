import { describe, expect, it } from 'vitest';
import { MATERIALS } from '../src/index.js';

describe('MATERIALS', () => {
  it('minden rekordhoz tartozik `source` és `verified` mező', () => {
    for (const m of MATERIALS) {
      expect(m.source.length).toBeGreaterThan(0);
      expect(typeof m.verified).toBe('boolean');
    }
  });

  it('a beton Ecm értékek megegyeznek az EN 1992-1-1 (3.5) zárt alakú képletével', () => {
    // Ecm = 22·((fck+8)/10)^0.3 GPa — az id-ből (pl. "C3037") kiolvasott
    // fck-val újraszámolva, FÜGGETLENÜL a JSON-ban tárolt értéktől.
    const concreteGrades: readonly { id: string; fck: number }[] = [
      { id: 'C1620', fck: 16 },
      { id: 'C2025', fck: 20 },
      { id: 'C25', fck: 25 },
      { id: 'C3037', fck: 30 },
      { id: 'C3545', fck: 35 },
      { id: 'C4050', fck: 40 },
      { id: 'C4555', fck: 45 },
      { id: 'C5060', fck: 50 },
    ];
    for (const { id, fck } of concreteGrades) {
      const material = MATERIALS.find((m) => m.id === id);
      if (material === undefined) throw new Error(`hiányzó anyag: ${id}`);
      const fcm = fck + 8;
      const ecmGPa = 22 * (fcm / 10) ** 0.3;
      const ecmKNcm2 = ecmGPa * 100; // GPa = kN/mm² → ×100 = kN/cm²
      expect(material.e).toBeCloseTo(ecmKNcm2, 0);
    }
  });

  it('nincs kettőzött id', () => {
    const ids = MATERIALS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('minden `family` érték a négy ismert anyagcsalád egyike', () => {
    const VALID = new Set(['steel', 'aluminum', 'concrete', 'timber']);
    for (const m of MATERIALS) {
      expect(VALID.has(m.family)).toBe(true);
    }
  });

  it('a `family` szerinti csoportosítás a várt tagságot adja (UI-csoportosítás alapja)', () => {
    const byFamily = (family: string): string[] => MATERIALS.filter((m) => m.family === family).map((m) => m.id);
    expect(byFamily('steel')).toEqual(['S235', 'S275', 'S355', 'S420', 'S460', 'S235H']);
    expect(byFamily('aluminum')).toEqual(['AW6082']);
    expect(byFamily('concrete')).toEqual(['C1620', 'C2025', 'C25', 'C3037', 'C3545', 'C4050', 'C4555', 'C5060']);
    expect(byFamily('timber')).toEqual(['C18', 'C30', 'C24', 'GL24h']);
  });
});
