import { describe, expect, it } from 'vitest';
import { rcMomentCapacity } from './rcCapacity.js';

describe('rcMomentCapacity — egyszerűsített téglalap feszültségblokk (EC2 3.1.7(3))', () => {
  it('kézzel számolt referenciaérték: b=300mm, h=500mm, C25/30, Aₛ=1200mm² (csak alsó vasalás)', () => {
    // Fc = As·fyk = 1200e-6·500e3 = 600 kN
    // x = Fc / (η·fck·λ·b) = 600 / (25e3·0.8·0.3) = 0.1 m
    // MRd = Fc·(d − λx/2) = 600·(0.46 − 0.04) = 252 kNm
    const r = rcMomentCapacity({ b: 0.3, h: 0.5 }, 25e3, 1200e-6, 0, 0.04);
    expect(r).not.toBeNull();
    expect(r?.x).toBeCloseTo(0.1, 10);
    expect(r?.mu).toBeCloseTo(252, 6);
  });

  it('nyomott (felső) vasalás hozzáadása csökkenti x-et, de növeli Mu-t', () => {
    const withoutCompression = rcMomentCapacity({ b: 0.3, h: 0.5 }, 25e3, 1200e-6, 0, 0.04);
    const withCompression = rcMomentCapacity({ b: 0.3, h: 0.5 }, 25e3, 1200e-6, 400e-6, 0.04);
    if (withoutCompression === null || withCompression === null) throw new Error('mindkettőnek érvényesnek kell lennie');
    expect(withCompression.x).toBeLessThan(withoutCompression.x);
    expect(withCompression.mu).toBeGreaterThan(withoutCompression.mu);
  });

  it('húzott vasalás nélkül (As=0) null-t ad', () => {
    expect(rcMomentCapacity({ b: 0.3, h: 0.5 }, 25e3, 0, 0, 0.04)).toBeNull();
  });

  it('degenerált (a nyomott vasalás önmagában meghaladja a húzottat, x≤0) esetben null-t ad', () => {
    expect(rcMomentCapacity({ b: 0.3, h: 0.5 }, 25e3, 200e-6, 1200e-6, 0.04)).toBeNull();
  });

  it('nagyobb fck (jobb beton) kisebb x-et ad ugyanahhoz a vasaláshoz, Mu alig változik (alulvasalt tartomány)', () => {
    const c25 = rcMomentCapacity({ b: 0.3, h: 0.5 }, 25e3, 1200e-6, 0, 0.04);
    const c35 = rcMomentCapacity({ b: 0.3, h: 0.5 }, 35e3, 1200e-6, 0, 0.04);
    if (c25 === null || c35 === null) throw new Error('mindkettőnek érvényesnek kell lennie');
    expect(c35.x).toBeLessThan(c25.x);
    expect(c35.mu).toBeGreaterThan(c25.mu);
  });
});
