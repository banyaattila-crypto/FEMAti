/**
 * V-08 — no-tension (felemelkedésre képes) Winkler-ágyazat, ADR-0022.
 *
 * MODERN kiegészítés, nem a diplomaterv része. A `solveLinearContact()`
 * elemenkénti kontakt-állapot iterációval oldja meg — ez a fájl a
 * legfontosabb tulajdonságait ellenőrzi: helyes felemelkedés-detektálás,
 * globális egyensúly a kontakt-iteráció UTÁN is, és bit-azonos visszaesés
 * `solveLinear()`-re, ha nincs `noTension` ágyazat a modellben.
 */
import { describe, expect, it } from 'vitest';
import {
  buildModel,
  fixed,
  foundation,
  makeMaterial,
  makeSection,
  nodalForce,
  pinned,
  rect,
  resetLoadIds,
  solveLinear,
  solveLinearContact,
  uniformMesh,
  type Model,
} from '../src/index.js';
import { mustGet } from './helpers/assert.js';

const MAT = makeMaterial('S235', 'Acél S235', { e: 2.1e8 });
const SEC = makeSection('R', 'Téglalap', rect(0.2, 0.4));

/**
 * Két belső (x=2, x=8) csuklós támaszú, 10 m-es tartó, [0,2] és [8,10]
 * túlnyúló véggel, mindkét túlnyúlás alatt Winkler-ágyazattal. Középen
 * (x=5) lefelé ható pontteher — a klasszikus eset, ahol a túlnyúló végek
 * FELFELÉ fordulnak (a bekötött ágyazat ott húzást kapna).
 */
function overhangModel(noTension: boolean): Model {
  resetLoadIds();
  const L = 10;
  const n = 10;
  const mesh = uniformMesh(L, n, { sectionId: 'R', materialId: 'S235' });
  return buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [MAT],
    sections: [SEC],
    boundaries: [pinned('N4'), pinned('N16')],
    foundations: [foundation(0, 2, 4000, noTension), foundation(8, 10, 4000, noTension)],
    loads: [nodalForce('N10', 40, 'F1')],
  });
}

describe('V-08 — no-tension ágyazat: túlnyúló vég felemelkedik', () => {
  it('bekötött (mindkét irányban dolgozó) ágyazatnál a túlnyúló vég felfelé mozdulna (negatív w)', () => {
    const bonded = solveLinear(overhangModel(false));
    const tip = mustGet(bonded.nodes.find((n) => n.x === 0));
    expect(tip.w).toBeLessThan(0);
  });

  it('no-tension ágyazatnál PONTOSAN a túlnyúló szakaszok elemei emelkednek fel', () => {
    const contact = solveLinearContact(overhangModel(true));
    expect(new Set(contact.foundationLiftOff)).toEqual(new Set(['E0', 'E1', 'E8', 'E9']));
    expect(contact.contactIterations).toBeGreaterThan(0);
  });

  it('a globális egyensúly a kontakt-iteráció UTÁN is gépi pontossággal zár', () => {
    const contact = solveLinearContact(overhangModel(true));
    expect(contact.equilibrium.satisfied).toBe(true);
    expect(contact.equilibrium.relativeFz).toBeLessThan(1e-9);
    expect(contact.equilibrium.relativeMy).toBeLessThan(1e-9);
    expect(contact.selfCheck.errorCount).toBe(0);
  });

  it('a felemelkedés miatt a szerkezet MINDENÜTT hajlékonyabb (nagyobb |w|), mint bekötve', () => {
    const bonded = solveLinear(overhangModel(false));
    const contact = solveLinearContact(overhangModel(true));
    for (let i = 0; i < bonded.nodes.length; i++) {
      const b = mustGet(bonded.nodes[i]);
      const c = mustGet(contact.nodes[i]);
      expect(Math.abs(c.w)).toBeGreaterThanOrEqual(Math.abs(b.w) - 1e-12);
    }
  });

  it('szimmetrikus teher és geometria esetén a végeredmény is szimmetrikus', () => {
    const contact = solveLinearContact(overhangModel(true));
    const left = mustGet(contact.nodes.find((n) => n.x === 0)).w;
    const right = mustGet(contact.nodes.find((n) => n.x === 10)).w;
    expect(left).toBeCloseTo(right, 9);
  });
});

describe('solveLinearContact — visszaesés solveLinear()-re, ha nincs noTension ágyazat', () => {
  it('bit-azonos eredményt ad, ha egyetlen ágyazat sem noTension', () => {
    const model = overhangModel(false);
    const plain = solveLinear(model);
    const contact = solveLinearContact(model);
    expect(contact.foundationLiftOff).toEqual([]);
    expect(contact.contactIterations).toBe(0);
    expect(contact.displacements).toEqual(plain.displacements);
  });

  it('noTension ágyazatnál is üres a felemelkedés-lista, ha ténylegesen sehol nem lép fel húzás', () => {
    // Befogott konzol, ágyazattal a TELJES hosszon, végponti teherrel — a
    // konzol lehajlási alakja monoton (nincs előjelváltás), sehol nincs
    // húzás, tehát a no-tension kapcsoló ténylegesen hatástalan marad.
    resetLoadIds();
    const L = 6;
    const n = 6;
    const mesh = uniformMesh(L, n, { sectionId: 'R', materialId: 'S235' });
    const model = buildModel({
      nodes: mesh.nodes,
      elements: mesh.elements,
      materials: [MAT],
      sections: [SEC],
      boundaries: [fixed('N0')],
      foundations: [foundation(0, L, 8000, true)],
      loads: [nodalForce(`N${2 * n}`, 20, 'F1')],
    });
    const plain = solveLinear({ ...model, foundations: [foundation(0, L, 8000, false)] });
    const contact = solveLinearContact(model);
    expect(contact.foundationLiftOff).toEqual([]);
    expect(contact.displacements).toEqual(plain.displacements);
  });
});
