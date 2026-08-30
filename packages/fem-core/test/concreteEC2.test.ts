import { describe, expect, it } from 'vitest';
import { concreteStress, isConcreteYielded } from '../src/material/concreteEC2.js';

/**
 * EC2 (EN 1992-1-1) 3.1.7, (3.17) parabola-téglalap modell — zárt alakú
 * ellenőrzések a HIBATURESI-POLITIKA szerint. C30/37-szerű, kerek
 * referenciaértékek (nem a fem-db pontos katalógusadata, hogy a kézi
 * ellenőrzés egyszerű maradjon).
 */
const FCK = 30000; // kN/m² (30 MPa)
const EPS_C2 = 0.002;
const EPS_CU2 = 0.0035;
const N = 2;

describe('concreteStress — húzott oldal (repedt keresztmetszet)', () => {
  it('húzásnál (eps ≥ 0) mindig 0 feszültség és 0 érintő modulus', () => {
    for (const eps of [0, 0.0001, 0.001, 0.01]) {
      const r = concreteStress(eps, FCK, EPS_C2, EPS_CU2, N);
      expect(r.sigma).toBe(0);
      expect(r.tangentE).toBe(0);
    }
  });
});

describe('concreteStress — nyomott oldal, parabola-téglalap', () => {
  it('a csúcsponton (eps=-epsC2) sigma = -fck', () => {
    const r = concreteStress(-EPS_C2, FCK, EPS_C2, EPS_CU2, N);
    expect(r.sigma).toBeCloseTo(-FCK, 6);
  });

  it('a fennsíkon (epsC2 < |eps| ≤ epsCu2) sigma = -fck, tangentE = 0', () => {
    const r = concreteStress(-(EPS_C2 + EPS_CU2) / 2, FCK, EPS_C2, EPS_CU2, N);
    expect(r.sigma).toBeCloseTo(-FCK, 6);
    expect(r.tangentE).toBe(0);
  });

  it('zúzódásnál (|eps| > epsCu2) sigma = 0, tangentE = 0 — a tervezési görbe nem extrapolálódik túl', () => {
    const r = concreteStress(-(EPS_CU2 + 0.001), FCK, EPS_C2, EPS_CU2, N);
    expect(r.sigma).toBe(0);
    expect(r.tangentE).toBe(0);
  });

  it('a nyomó feszültség NAGYSÁGA monoton nő |eps| növekedésével a parabola-szakaszon', () => {
    const s1 = Math.abs(concreteStress(-0.0005, FCK, EPS_C2, EPS_CU2, N).sigma);
    const s2 = Math.abs(concreteStress(-0.001, FCK, EPS_C2, EPS_CU2, N).sigma);
    const s3 = Math.abs(concreteStress(-0.0015, FCK, EPS_C2, EPS_CU2, N).sigma);
    expect(s2).toBeGreaterThan(s1);
    expect(s3).toBeGreaterThan(s2);
    expect(s3).toBeLessThan(FCK);
  });

  it('a zárt alakú érintő modulus a σ(ε) véges differenciás deriváltjával egyezik a parabola-szakaszon', () => {
    const eps = -EPS_C2 * 0.4;
    const h = 1e-9;
    const s1 = concreteStress(eps - h, FCK, EPS_C2, EPS_CU2, N).sigma;
    const s2 = concreteStress(eps + h, FCK, EPS_C2, EPS_CU2, N).sigma;
    const numericTangent = (s2 - s1) / (2 * h);
    const analytic = concreteStress(eps, FCK, EPS_C2, EPS_CU2, N).tangentE;
    expect(Math.abs(analytic - numericTangent) / analytic).toBeLessThan(1e-4);
  });

  it('n=2-nél (a leggyakoribb EC2 eset) a parabola felénél (x=0.5) a zárt alakú σ = -fck·0.75', () => {
    // σ = fck·[1-(1-x)²] — x=0.5-nél 1-(0.5)²=0.75, zárt alakban, gépi pontossággal.
    const r = concreteStress(-EPS_C2 * 0.5, FCK, EPS_C2, EPS_CU2, 2);
    expect(r.sigma).toBeCloseTo(-FCK * 0.75, 6);
  });
});

describe('isConcreteYielded', () => {
  it('csak a nyomott oldalon, epsC2-t elért/túllépő rétegre igaz', () => {
    expect(isConcreteYielded(0.001, EPS_C2)).toBe(false); // húzás
    expect(isConcreteYielded(-0.001, EPS_C2)).toBe(false); // nyomott, de epsC2 alatt
    expect(isConcreteYielded(-EPS_C2, EPS_C2)).toBe(true);
    expect(isConcreteYielded(-EPS_CU2, EPS_C2)).toBe(true);
  });
});
