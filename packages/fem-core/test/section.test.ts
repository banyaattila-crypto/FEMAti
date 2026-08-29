import { describe, expect, it } from 'vitest';
import {
  circle,
  geometricProperties,
  iProfile,
  makeLayeredSection,
  makeMaterial,
  makeSection,
  rect,
  recommendedShearFactor,
  rhs,
  sectionStiffness,
  tube,
  constitutiveMatrix,
} from '../src/index.js';

/**
 * Relatív eltérés ezrelékben — MÉRŐSZÁM, nem elfogadási küszöb.
 *
 * A docs/HIBATURESI-POLITIKA.md szerint a diszkretizációs hibát nem egyetlen
 * számmal, hanem a konvergencia RENDJÉNEK igazolásával fogadjuk el. Ez a
 * függvény azt mutatja meg, mekkora az eltérés — az elfogadás alapja a
 * rend-ellenőrzés.
 */
const permille = (a: number, b: number): number => (Math.abs(a - b) / Math.abs(b)) * 1000;

describe('keresztmetszeti jellemzők — zárt képletek', () => {
  it('téglalap: A = b·h, I = b·h³/12', () => {
    const p = geometricProperties(rect(0.2, 0.4));
    expect(p.area).toBeCloseTo(0.08, 14);
    expect(p.inertia).toBeCloseTo((0.2 * 0.4 ** 3) / 12, 14);
    expect(p.elasticModulus).toBeCloseTo((0.2 * 0.4 ** 2) / 6, 14);
    expect(p.plasticModulus).toBeCloseTo((0.2 * 0.4 ** 2) / 4, 14);
  });

  it('kör: A = πd²/4, I = πd⁴/64', () => {
    const p = geometricProperties(circle(0.2));
    expect(p.area).toBeCloseTo((Math.PI * 0.2 ** 2) / 4, 14);
    expect(p.inertia).toBeCloseTo((Math.PI * 0.2 ** 4) / 64, 16);
  });

  it('cső: a belső kör levonásával', () => {
    const p = geometricProperties(tube(0.2, 0.01));
    const di = 0.18;
    expect(p.area).toBeCloseTo((Math.PI * (0.04 - di * di)) / 4, 14);
    expect(p.inertia).toBeCloseTo((Math.PI * (0.2 ** 4 - di ** 4)) / 64, 16);
  });

  it('zárt szelvény (RHS): A és I a külső mínusz belső téglalapból', () => {
    const p = geometricProperties(rhs(0.2, 0.1, 0.01));
    const bi = 0.08; // 0.1 - 2*0.01
    const hi = 0.18; // 0.2 - 2*0.01
    expect(p.area).toBeCloseTo(0.2 * 0.1 - hi * bi, 14);
    expect(p.inertia).toBeCloseTo((0.1 * 0.2 ** 3 - bi * hi ** 3) / 12, 16);
  });

  it('IPE 300 névleges kontúrból: A = 51.88 cm², I = 7998 cm⁴', () => {
    const p = geometricProperties(iProfile(0.3, 0.15, 0.0071, 0.0107));
    expect(p.area * 1e4).toBeCloseTo(51.88, 2);
    expect(p.inertia * 1e8).toBeCloseTo(7998.99, 1);
  });

  it('a katalógusadattól való eltérés a lekerekítés elhagyásából ered', () => {
    // A szelvénytáblázat IPE 300 adata: A = 53.8 cm², I = 8356 cm⁴.
    // A gerinc–öv lekerekítést (r = 15 mm) a névleges kontúr nem tartalmazza,
    // ezért a számított érték kisebb. A felület ezt kiírja a felhasználónak.
    const p = geometricProperties(iProfile(0.3, 0.15, 0.0071, 0.0107));
    const deviationArea = ((53.8 - p.area * 1e4) / 53.8) * 100;
    const deviationInertia = ((8356 - p.inertia * 1e8) / 8356) * 100;
    expect(deviationArea).toBeGreaterThan(0);
    expect(deviationArea).toBeLessThan(5); // néhány százalék
    expect(deviationInertia).toBeLessThan(6);
  });
});

describe('alaki tényező c = Mp/Mₑ — Diplomaterv 4. táblázat (54. oldal)', () => {
  it('négyszög: c = 3/2 — elvileg EGZAKT, gépi pontossággal', () => {
    // Kp/Kₑ = (b·h²/4)/(b·h²/6) = 3/2 zárt alakban. Itt nincs közelítés,
    // ezért mérnöki tűrés sem: az eltérés csak kerekítés lehet.
    const p = geometricProperties(rect(0.12, 0.3));
    expect(p.shapeFactor).toBeCloseTo(1.5, 14);
  });

  it('kör: c = 1.70 (a táblázat kerekített értéke)', () => {
    const p = geometricProperties(circle(0.2));
    // Zárt alak: (d³/6) / (πd³/32) = 32/(6π). EGZAKT, gépi pontossággal.
    expect(p.shapeFactor).toBeCloseTo(32 / (6 * Math.PI), 14);
    // A diplomaterv 4. táblázata 1.70-re kerekít; a mi értékünk 1.6977.
    // Az eltérés a TÁBLÁZAT kerekítése, nem a számításunk hibája.
    expect(permille(p.shapeFactor, 1.7)).toBeLessThan(1.5);
  });

  it('vékonyfalú körgyűrű: c → 1.27 a határesetben', () => {
    // A diplomaterv 1.27 értéke VÉKONYFALÚ közelítés (Kₑ ≈ 0.785·d²·v,
    // Kp ≈ d²·v → c = 4/π = 1.2732). Nagy d/t aránynál ezt kell kapnunk.
    const thin = geometricProperties(tube(1.0, 0.001)); // d/t = 1000
    expect(thin.shapeFactor).toBeCloseTo(4 / Math.PI, 2);
    // d/t = 1000 mellett is marad ~1.3 ezrelék eltérés a határértéktől: a
    // vékonyfalú képlet a falvastagságban elsőrendű közelítés.
    expect(permille(thin.shapeFactor, 4 / Math.PI)).toBeLessThan(2);

    // Még vékonyabb fal → közelebb a határértékhez (a közelítés konzisztens).
    const thinner = geometricProperties(tube(1.0, 0.0001));
    expect(permille(thinner.shapeFactor, 4 / Math.PI)).toBeLessThan(
      permille(thin.shapeFactor, 4 / Math.PI),
    );
  });

  it('vastagfalú cső alaki tényezője a tömör kör felé tart', () => {
    const thin = geometricProperties(tube(0.2, 0.002));
    const thick = geometricProperties(tube(0.2, 0.05));
    const solid = geometricProperties(circle(0.2));
    expect(thin.shapeFactor).toBeLessThan(thick.shapeFactor);
    expect(thick.shapeFactor).toBeLessThan(solid.shapeFactor);
  });

  it('IPE 300: c = 1.129 — a katalógus Wpl/Wel arányával egyezik', () => {
    const p = geometricProperties(iProfile(0.3, 0.15, 0.0071, 0.0107));
    // Katalógus: Wpl = 628.4 cm³, Wel = 557 cm³ → c = 1.1282.
    // A két érték eltérése MODELLEZÉSI különbség (a katalógus tartalmazza a
    // gerinc-öv lekerekítést, a névleges kontúr nem), nem numerikus hiba.
    // Ezért itt mérnöki nagyságrendű egyezést várunk, és ki is mondjuk, miért.
    expect(p.shapeFactor).toBeCloseTo(1.129, 3);
    expect(permille(p.shapeFactor, 628.4 / 557)).toBeLessThan(3);
  });

  it('minél nagyobb az övek aránya, annál KISEBB az alaki tényező', () => {
    // A c annál közelebb van 1-hez, minél inkább "két öv" a szelvény: az
    // övekben a rugalmas és a képlékeny feszültségeloszlás alig különbözik.
    // A gerinc adja a többletet, mert ott a háromszög alakú rugalmas eloszlás
    // téglalappá telik. Ezért a széles övű HEB 300 alaki tényezője KISEBB,
    // mint a karcsúbb IPE 300-é — az Euler-intuíció itt fordítva működik.
    const ipe = geometricProperties(iProfile(0.3, 0.15, 0.0071, 0.0107));
    const heb = geometricProperties(iProfile(0.3, 0.3, 0.011, 0.019));
    expect(heb.shapeFactor).toBeLessThan(ipe.shapeFactor);

    // Mindkettő a diplomaterv 4. táblázatának 1.14–1.16 sávja ALATT van:
    // a sáv a korabeli, zömökebb gerincű szelvényekre vonatkozott.
    expect(ipe.shapeFactor).toBeLessThan(1.14);
    expect(heb.shapeFactor).toBeLessThan(ipe.shapeFactor);

    // Határeset: a tiszta gerinc (öv nélkül) a téglalap 1.5-ét adja.
    const webOnly = geometricProperties(rect(0.0071, 0.3));
    expect(webOnly.shapeFactor).toBeCloseTo(1.5, 10);
  });

  it('zárt szelvény (RHS) alaki tényezője vékony falnál kisebb, vastag (tömörhöz közelítő) falnál a tömör téglalapéhoz tart', () => {
    // Ugyanaz az irány, mint a cső↔kör párnál: a vékonyfalú határeset
    // KISEBB c-t ad, mint a tömör alak — az anyag a semleges száltól távol
    // koncentrálódik, ez arányaiban jobban növeli Kₑ-t, mint Kp-t.
    const thin = geometricProperties(rhs(0.2, 0.1, 0.002));
    const thick = geometricProperties(rhs(0.2, 0.1, 0.045)); // közel tömör (t < min(h,b)/2 = 0.05)
    const solid = geometricProperties(rect(0.1, 0.2));
    expect(thin.shapeFactor).toBeLessThan(thick.shapeFactor);
    expect(thick.shapeFactor).toBeLessThan(solid.shapeFactor);
    expect(thick.shapeFactor).toBeCloseTo(solid.shapeFactor, 1);
  });

  it('minden alak alaki tényezője 1 és 2 között van', () => {
    const shapes = [
      rect(0.2, 0.4),
      circle(0.3),
      tube(0.3, 0.02),
      iProfile(0.4, 0.18, 0.0086, 0.0135),
      rhs(0.2, 0.1, 0.008),
    ];
    for (const s of shapes) {
      const c = geometricProperties(s).shapeFactor;
      expect(c).toBeGreaterThan(1);
      expect(c).toBeLessThan(2);
    }
  });
});

describe('nyírási alaktényező — Cowper (1966), Poisson-tényezőtől függő', () => {
  it('téglalapra ν=0-nál pontosan 5/6 — a diplomaterv A/1.2 alakjának határesete', () => {
    expect(recommendedShearFactor(rect(0.2, 0.4), 0)).toBeCloseTo(5 / 6, 14);
    expect(recommendedShearFactor(rect(0.2, 0.4), 0)).toBeCloseTo(1 / 1.2, 14);
  });

  it('téglalapra ν=0.3-nál (acél) a Cowper-képlet szerinti értéket adja', () => {
    // κ = 10·(1+ν)/(12+11·ν) = 10·1.3/15.3
    expect(recommendedShearFactor(rect(0.2, 0.4), 0.3)).toBeCloseTo((10 * 1.3) / 15.3, 12);
  });

  it('körre ν=0-nál 6/7, ν=0.3-nál a Cowper-képlet szerint', () => {
    expect(recommendedShearFactor(circle(0.3), 0)).toBeCloseTo(6 / 7, 12);
    expect(recommendedShearFactor(circle(0.3), 0.3)).toBeCloseTo((6 * 1.3) / 8.8, 12);
  });

  it('csőszelvényre ν=0-nál 1/2 (egyezik a korábbi, hardcodeolt konstanssal)', () => {
    expect(recommendedShearFactor(tube(0.3, 0.02), 0)).toBeCloseTo(0.5, 12);
  });

  it('I-szelvénynél a gerinc arányából (IPE 300 ≈ 0.41) — NEM Cowper-formula, ν-től független', () => {
    expect(recommendedShearFactor(iProfile(0.3, 0.15, 0.0071, 0.0107), 0.3)).toBeCloseTo(0.41, 2);
  });

  it('zárt szelvénynél (RHS) a két oldalfal arányából — NEM Cowper-formula, ν-től független', () => {
    const s = rhs(0.2, 0.1, 0.008);
    const area = 0.1 * 0.2 - (0.1 - 0.016) * (0.2 - 0.016);
    expect(recommendedShearFactor(s, 0.3)).toBeCloseTo((0.2 * (2 * 0.008)) / area, 12);
  });

  it('minden alakra és realisztikus ν-tartományra (0–0.5) 0 és 1 közé esik', () => {
    const shapes = [
      rect(0.2, 0.4),
      circle(0.3),
      tube(0.3, 0.02),
      iProfile(0.4, 0.18, 0.0086, 0.0135),
      rhs(0.2, 0.1, 0.008),
    ];
    for (const s of shapes) {
      for (const nu of [0, 0.2, 0.3, 0.5]) {
        const ks = recommendedShearFactor(s, nu);
        expect(ks).toBeGreaterThan(0);
        expect(ks).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('merevségi jellemzők (EI, GAs)', () => {
  const steel = makeMaterial('S235', 'Acél', { e: 2.1e8, nu: 0.3, sigmaY: 2.35e5 });

  it('parametrikus szelvény: EI = E·I és GAs = κs·G·A', () => {
    const section = makeSection('R', 'Téglalap', rect(0.2, 0.4));
    const s = sectionStiffness(section, steel);
    const i = (0.2 * 0.4 ** 3) / 12;
    expect(s.ei).toBeCloseTo(2.1e8 * i, 3);
    expect(s.gas).toBeCloseTo((5 / 6) * (steel.g as number) * 0.08, 3);
  });

  it('a D anyagmátrix diag(EI, GAs)', () => {
    const s = sectionStiffness(makeSection('R', 'T', rect(0.2, 0.4)), steel);
    const d = constitutiveMatrix(s);
    expect(d.get(0, 0)).toBe(s.ei);
    expect(d.get(1, 1)).toBe(s.gas);
    expect(d.get(0, 1)).toBe(0);
    expect(d.get(1, 0)).toBe(0);
  });

  it('rétegelt szelvény EI-je a (3.54) képlet szerint áll elő', () => {
    // 20 réteg, téglalap 0.2 × 0.4
    const n = 20;
    const h = 0.4;
    const t = h / n;
    const layers = Array.from({ length: n }, (_, i) => ({
      b: 0.2,
      t,
      z: -h / 2 + t / 2 + i * t,
    }));
    const s = sectionStiffness(makeLayeredSection('L', 'Rétegelt', layers), steel);

    // Σ b·t·z² a folytonos b·h³/12-hez tart; 20 rétegnél az eltérés ~1/(4n²)
    const exact = (0.2 * h ** 3) / 12;
    expect(permille(s.inertia, exact)).toBeLessThan(3);
    expect(s.ei).toBeCloseTo(2.1e8 * s.inertia, 3);
    expect(s.area).toBeCloseTo(0.08, 12);
  });

  it('a rétegszám növelésével az inercia monoton tart a zárt értékhez', () => {
    const h = 0.4;
    const exact = (0.2 * h ** 3) / 12;
    const steel2 = makeMaterial('S', 'Acél', { e: 2.1e8 });

    const errors = [4, 8, 16, 32, 64].map((n) => {
      const t = h / n;
      const layers = Array.from({ length: n }, (_, i) => ({
        b: 0.2,
        t,
        z: -h / 2 + t / 2 + i * t,
      }));
      const s = sectionStiffness(makeLayeredSection('L', 'R', layers), steel2);
      return permille(s.inertia, exact);
    });

    for (let i = 1; i < errors.length; i++) {
      expect(errors[i]).toBeLessThan(errors[i - 1] as number);
    }

    // A közelítés a középpont-szabály az ∫z²dz integrálra, ezért a relatív
    // hiba PONTOSAN 1/n²: a rétegszám duplázása negyedeli a hibát.
    for (let i = 1; i < errors.length; i++) {
      expect((errors[i - 1] as number) / (errors[i] as number)).toBeCloseTo(4, 1);
    }
    // n = 64 → 1/4096 = 0.244 ezrelék
    expect(errors[errors.length - 1]).toBeCloseTo(1000 / 4096, 3);
  });

  it('a rétegszám és a diszkretizációs hiba kapcsolata kimutatható', () => {
    // A hiba 1/n² törvényt követ, ezért TETSZŐLEGES célpontossághoz megadható
    // a szükséges rétegszám: n > 1/√(cél). Például ezrelékes nagyságrendhez
    // n ≈ 19, tized-ezrelékeshez n ≈ 58.
    // A HIBATURESI-POLITIKA 4. pontja szerint az elfogadás alapja a fenti
    // rend-ellenőrzés; ez a teszt csak a gyakorlati következményt rögzíti.
    const h = 0.4;
    const exact = (0.2 * h ** 3) / 12;
    const steel2 = makeMaterial('S', 'Acél', { e: 2.1e8 });

    const errorAt = (n: number): number => {
      const t = h / n;
      const layers = Array.from({ length: n }, (_, i) => ({
        b: 0.2,
        t,
        z: -h / 2 + t / 2 + i * t,
      }));
      return permille(sectionStiffness(makeLayeredSection('L', 'R', layers), steel2).inertia, exact);
    };

    expect(errorAt(18)).toBeGreaterThan(3);
    expect(errorAt(19)).toBeLessThan(3);
    expect(errorAt(24)).toBeLessThan(2); // a felület alapértelmezése
  });

  it('a rétegek saját inerciájának beszámítása pontosabbá teszi', () => {
    const h = 0.4;
    const n = 8;
    const t = h / n;
    const layers = Array.from({ length: n }, (_, i) => ({
      b: 0.2,
      t,
      z: -h / 2 + t / 2 + i * t,
    }));
    const steel2 = makeMaterial('S', 'Acél', { e: 2.1e8 });
    const exact = (0.2 * h ** 3) / 12;

    const without = sectionStiffness(makeLayeredSection('L', 'R', layers, 5 / 6, false), steel2);
    const with_ = sectionStiffness(makeLayeredSection('L', 'R', layers, 5 / 6, true), steel2);

    expect(permille(with_.inertia, exact)).toBeLessThan(permille(without.inertia, exact));
    // A saját inercia figyelembevételével a rétegzés EGZAKT lesz.
    expect(permille(with_.inertia, exact)).toBeLessThan(1e-6);
  });

  it('kompozit rétegzés: eltérő anyagú rétegek eltérő súllyal számítanak', () => {
    const soft = makeMaterial('SOFT', 'Lágy', { e: 1e7 });
    const hard = makeMaterial('HARD', 'Kemény', { e: 2.1e8 });
    const layers = [
      { b: 0.2, t: 0.1, z: -0.15, materialId: 'HARD' },
      { b: 0.2, t: 0.2, z: 0, materialId: 'SOFT' },
      { b: 0.2, t: 0.1, z: 0.15, materialId: 'HARD' },
    ];
    const lookup = (id: string): typeof soft | undefined =>
      id === 'HARD' ? hard : id === 'SOFT' ? soft : undefined;

    const s = sectionStiffness(
      makeLayeredSection('L', 'Kompozit', layers),
      soft,
      lookup as never,
    );

    // A kemény övek dominálnak: EI >> a homogén lágy eset EI-je
    const homogeneous = sectionStiffness(makeLayeredSection('L2', 'Lágy', layers), soft);
    expect(s.ei).toBeGreaterThan(homogeneous.ei * 5);
  });
});
