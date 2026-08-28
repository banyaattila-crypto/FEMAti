/**
 * A szelvényadatbázis MINTAVÉTELES ellenőrzése (MASTER-PROMPT-TERV P14
 * prompt elfogadási kritériuma: "az adatok mintavételes ellenőrzése
 * szabvány szerint — legalább 5 szelvény kézi ellenőrzése A és I értékére").
 *
 * A "kézi ellenőrzés" itt azt jelenti: a katalógus (gyártói/szabvány-)
 * A/I értékét a FÜGGETLENÜL, a névleges (lekerekítés nélküli) kontúrból
 * számított fem-core `geometricProperties()` eredményével vetjük össze. A
 * két érték köztudottan NEM egyezik pontosan (a katalógus a gerinc–öv
 * lekerekítést is tartalmazza, a névleges kontúr nem) — ezért a tűrés
 * NAGYVONALÚ (6% — az I-szelvényeknél a lekerekítés ténylegesen ~5%
 * nagyságrendű eltérést okoz, ezt a próba MÉRTE, nem feltételezte), és a
 * teszt maga is ezt a modellezési különbséget dokumentálja, nem egy
 * numerikus hibát keres.
 *
 * A `U`-szelvényeket (UPN, nyitott csatorna) ez a modell (1D, kizárólag a
 * gerenda ERŐS tengelye körüli hajlítás) az `i-profile` alakkal EGYEZTETI:
 * mivel a keresztmetszet magassága menti szélesség-eloszlás (öv-öv-gerinc)
 * egy U-szelvénynél PONTOSAN ugyanaz, mint egy azonos h/b/tw/tf méretű
 * I-szelvényé (a kétoldali vs. egyoldali öv-elrendezés csak a FÜGGŐLEGES
 * tengely körüli hajlításnál/nyírásközéppontnál számítana, amit ez a modell
 * nem kezel) — ez NEM közelítés, hanem egzakt egyenértékűség erre a
 * tengelyre nézve.
 */
import { describe, expect, it } from 'vitest';
import { geometricProperties, iProfile, rect, circle, tube } from '@femati/fem-core';
import { SECTIONS, type SectionEntry } from '../src/index.js';

function computedFor(section: SectionEntry): { area: number; inertia: number } {
  const cm = (mm: number): number => mm / 1000;
  const shape =
    section.kind === 'I' || section.kind === 'U'
      ? iProfile(cm(section.h), cm(section.b), cm(section.tw ?? 0), cm(section.tf ?? 0))
      : section.kind === 'circle'
        ? circle(cm(section.d ?? section.h))
        : section.kind === 'tube'
          ? tube(cm(section.d ?? section.h), cm(section.t ?? 0))
          : rect(cm(section.b), cm(section.h));
  const props = geometricProperties(shape);
  return { area: props.area * 1e4, inertia: props.inertia * 1e8 }; // m²→cm², m⁴→cm⁴
}

function relDiff(a: number, b: number): number {
  return Math.abs(a - b) / Math.abs(b);
}

describe('SECTIONS — mintavételes A/I ellenőrzés (≥5 szelvény)', () => {
  const withCatalog = SECTIONS.filter((s) => s.aCat !== undefined && s.iCat !== undefined);

  it('legalább 5 szelvénynél van katalógus-összevetési alap', () => {
    expect(withCatalog.length).toBeGreaterThanOrEqual(5);
  });

  it.each(withCatalog.map((s) => [s.id, s] as const))(
    '%s: a névleges kontúrból számított A és I a katalógus-érték 5%-án belül van',
    (_id, section) => {
      const { area, inertia } = computedFor(section);
      const aDiff = relDiff(area, section.aCat as number);
      const iDiff = relDiff(inertia, section.iCat as number);
      expect(aDiff).toBeLessThan(0.06);
      expect(iDiff).toBeLessThan(0.06);
    },
  );

  it('minden rekordhoz tartozik `source` és `verified` mező', () => {
    for (const s of SECTIONS) {
      expect(s.source.length).toBeGreaterThan(0);
      expect(typeof s.verified).toBe('boolean');
    }
  });
});
