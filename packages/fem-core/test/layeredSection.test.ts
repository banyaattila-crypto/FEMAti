import { describe, expect, it } from 'vitest';
import {
  circle,
  generateLayers,
  geometricProperties,
  iProfile,
  makeLayeredSection,
  makeMaterial,
  rect,
  sectionMoment,
  sectionStiffness,
  tube,
} from '../src/index.js';
import { mustGet } from './helpers/assert.js';

const steel = makeMaterial('S1', 'Acél', { e: 2.1e8, sigmaY: 2.35e5, hPrime: 0 });

describe('generateLayers', () => {
  it('a rétegek száma és összvastagsága megegyezik a kérttel', () => {
    const shape = rect(0.2, 0.4);
    const layers = generateLayers(shape, 8);
    expect(layers).toHaveLength(8);
    const totalT = layers.reduce((s, l) => s + l.t, 0);
    expect(totalT).toBeCloseTo(0.4, 12);
  });

  it('a rétegek hézag- és átfedésmentesen, növekvő z sorrendben követik egymást', () => {
    const layers = generateLayers(circle(0.3), 6);
    for (let i = 1; i < layers.length; i++) {
      const prev = layers[i - 1];
      const cur = layers[i];
      if (prev === undefined || cur === undefined) throw new Error('hiányzó réteg');
      const prevBottom = prev.z + prev.t / 2;
      const curTop = cur.z - cur.t / 2;
      expect(curTop).toBeCloseTo(prevBottom, 10);
    }
  });

  it('téglalapnál minden réteg szélessége b (a kontúr állandó)', () => {
    const layers = generateLayers(rect(0.2, 0.4), 10);
    for (const l of layers) {
      expect(l.b).toBeCloseTo(0.2, 12);
    }
  });

  it('körnél a szélső rétegek szélessége kisebb, mint a középsőké', () => {
    const layers = generateLayers(circle(0.4), 20);
    const mid = layers[10];
    const edge = layers[0];
    if (mid === undefined || edge === undefined) throw new Error('hiányzó réteg');
    expect(edge.b).toBeLessThan(mid.b);
  });

  it('érvénytelen rétegszámra hibát dob', () => {
    expect(() => generateLayers(rect(0.2, 0.4), 0)).toThrow(RangeError);
    expect(() => generateLayers(rect(0.2, 0.4), 1.5)).toThrow(RangeError);
  });

  it('I-szelvénynél a gerinc-sávban a gerincvastagság, az öv-sávban az övszélesség a kontúr', () => {
    // h=0.3, b=0.15, tw=0.01, tf=0.05 → hw=0.2 (gerincmagasság).
    const shape = iProfile(0.3, 0.15, 0.01, 0.05);
    const layers = generateLayers(shape, 30); // 0.01 m/réteg — pontosan illeszkedik a gerinc/öv határra
    const webLayer = layers.find((l) => Math.abs(l.z) < 0.09);
    const flangeLayer = layers.find((l) => Math.abs(l.z) > 0.12);
    if (webLayer === undefined || flangeLayer === undefined) throw new Error('hiányzó réteg');
    expect(webLayer.b).toBeCloseTo(0.01, 12);
    expect(flangeLayer.b).toBeCloseTo(0.15, 12);
  });

  it('I-szelvénynél, ha egy réteg ÁTNYÚLIK a gerinc/öv határon (nem illeszkedő rétegszám), a terület/inercia közel marad a zárt alakhoz — VALÓDI, felhasználó jelentette hiba regressziós tesztje', () => {
    // IPE300-szerű alak, 16 réteg (18,75 mm/réteg) — a hw/2=139,3 mm határ
    // NEM esik rétegvastagság-többszörösre, ezért a legszélső 2 réteg a
    // gerinc/öv átmeneten nyúlik át. A régi (egyetlen középponti mintaponton
    // alapuló) módszer ilyenkor a TELJES övszélességet (150 mm) rendelte a
    // teljes 18,75 mm-es rétegvastagsághoz — ez a területet ~39%-kal, az
    // inerciát ~46%-kal túlbecsülte (külső felülvizsgálat találta és igazolta
    // számokkal; ld. THEORY.md 17. pont / ADR-0014).
    const shape = iProfile(0.3, 0.15, 0.0071, 0.0107);
    const layers = generateLayers(shape, 16);
    const closed = geometricProperties(shape);

    const area = layers.reduce((s, l) => s + l.b * l.t, 0);
    const inertia = layers.reduce((s, l) => s + l.b * l.t * l.z * l.z, 0);

    const areaError = Math.abs(area - closed.area) / closed.area;
    const inertiaError = Math.abs(inertia - closed.inertia) / closed.inertia;

    // A régi hiba ~0.39 / ~0.46 volt — a küszöb bőven ez alatt, de nem
    // nulla (a geometriai középvonalon hagyott `z` miatt marad egy kis,
    // másodrendű — az `includeLayerOwnInertia` opcióéval rokon — eltérés).
    expect(areaError).toBeLessThan(0.01);
    expect(inertiaError).toBeLessThan(0.06);
  });
});

describe('rétegszám-konvergencia — a generált rétegzésből számított merevség tart a zárt alakhoz', () => {
  it('téglalap: EI, terület és alaki tényező pontosan (analitikusan) egyezik minden rétegszámnál', () => {
    // Téglalapnál a kontúr állandó (b = áll.), ezért a középponti
    // Riemann-összeg a Kp-re (∫|z|dz, szakaszonként LINEÁRIS integrandus)
    // EGZAKT bármely rétegszámnál. Az EI-re (∫z²dz, MÁSODFOKÚ integrandus) a
    // középponti szabály hibája zárt alakban levezethető: a diszkrét összeg
    // pontosan `EI_zárt·(1 − 1/n²)` — ez maga egy zárt alakú ellenőrzés,
    // NEM egy "közelítőleg konvergál" jellegű tolerancia.
    const shape = rect(0.2, 0.4);
    const closed = geometricProperties(shape);
    for (const n of [2, 4, 8, 16]) {
      const layers = generateLayers(shape, n);
      const section = makeLayeredSection(
        'L1',
        'Rétegelt téglalap',
        layers.map((l) => ({ b: l.b, t: l.t, z: l.z })),
      );
      const stiffness = sectionStiffness(section, steel);
      const expectedEi = (steel.e as number) * closed.inertia * (1 - 1 / (n * n));
      expect(stiffness.ei).toBeCloseTo(expectedEi, 6);
      expect(stiffness.plasticModulus).toBeCloseTo(closed.plasticModulus, 8);
    }
  });

  it('kör: az alaki tényező monoton tart a zárt alakhoz (c=1.70), 64 rétegnél 1%-on belül', () => {
    const shape = circle(0.4);
    const closed = geometricProperties(shape);
    const errors: number[] = [];
    for (const n of [4, 8, 16, 32, 64]) {
      const layers = generateLayers(shape, n);
      const section = makeLayeredSection(
        'L2',
        'Rétegelt kör',
        layers.map((l) => ({ b: l.b, t: l.t, z: l.z })),
      );
      const stiffness = sectionStiffness(section, steel);
      errors.push(Math.abs(stiffness.shapeFactor - closed.shapeFactor) / closed.shapeFactor);
    }
    // A hiba TENDENCIÁJA csökkenő (a legdurvább és legfinomabb háló közötti
    // összevetés) — a Kp (∫|z|dz) és Kₑ (∫z²dz) diszkretizációs hibái
    // eltérő ütemben csökkennek, ezért a hányadosuk (c) hibája lépésenként
    // NEM feltétlenül monoton, de a végpontok közötti javulás igen (ld.
    // HIBATURESI-POLITIKA 2. pont: a konvergencia RENDJÉT, nem egyetlen
    // lépésenkénti csökkenést nézzük).
    const first = errors[0];
    const last = errors[errors.length - 1];
    if (first === undefined || last === undefined) throw new Error('üres hibalista');
    expect(last).toBeLessThan(first);
    expect(last).toBeLessThan(0.01);
  });

  it('körgyűrű: az alaki tényező 64 rétegnél 1%-on belül tart a zárt alakhoz', () => {
    const shape = tube(0.4, 0.002);
    const closed = geometricProperties(shape);
    const layers = generateLayers(shape, 64);
    const section = makeLayeredSection(
      'L3',
      'Rétegelt körgyűrű',
      layers.map((l) => ({ b: l.b, t: l.t, z: l.z })),
    );
    const stiffness = sectionStiffness(section, steel);
    expect(Math.abs(stiffness.shapeFactor - closed.shapeFactor) / closed.shapeFactor).toBeLessThan(0.01);
  });
});

describe('sectionMoment — M = Σ σxl·bl·zl·tl (3.59)', () => {
  it('lineárisan rugalmas rétegenkénti feszültségre visszaadja az M = EI·κ eredményt', () => {
    const shape = rect(0.2, 0.4);
    const layers = generateLayers(shape, 64);
    const kappa = 0.001;
    const e = steel.e as number;
    const stresses = layers.map((l) => e * kappa * l.z);
    const m = sectionMoment(layers, stresses);
    const closed = geometricProperties(shape);
    // A σ(z)=E·κ·z réteges összegzése maga is a diszkretizált EI-t (ld.
    // fenti (1−1/n²) törvény) adja vissza, nem a zárt alakú EI-t.
    const expectedM = e * closed.inertia * kappa * (1 - 1 / (64 * 64));
    expect(m).toBeCloseTo(expectedM, 6);
  });

  it('hiányzó feszültségértéket nullaként kezel (kimaradó réteg nem dob hibát)', () => {
    const layers = generateLayers(rect(0.2, 0.4), 4);
    const l0 = mustGet(layers[0]);
    const l1 = mustGet(layers[1]);
    expect(sectionMoment(layers, [1, 2])).toBeCloseTo(1 * l0.b * l0.z * l0.t + 2 * l1.b * l1.z * l1.t, 10);
  });
});
