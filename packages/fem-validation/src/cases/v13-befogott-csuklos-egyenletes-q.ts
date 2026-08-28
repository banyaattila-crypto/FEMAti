/**
 * V-13 — Befogott-csuklós (propped cantilever) tartó, egyenletesen megoszló
 * teherrel.
 *
 * A `catalog.ts`-be P18 után felvett "Befogott-csuklós tartó" UI-mintához
 * (`STATUS_REPORT.md` 9. pont) eddig NEM készült dedikált zárt alakú
 * validációs eset — ezt pótolja ez a teszt. Az ötletet és a keresztellenőrzés
 * lehetőségét egy KÜLSŐ, felhasználó által megküldött szakirodalmi forrás
 * adta: Ahmed A.M., Rifai A.M., "Euler-Bernoulli and Timoshenko Beam
 * Theories: Analytical and Numerical Comprehensive Revision", European
 * Journal of Engineering and Technology Research, Vol 6, Issue 7, 2021,
 * VI. táblázat (Fixed-Hinged Beam with UDL) — a formulát a cikk zárt alakja
 * helyett (annak nyomtatott/OCR-formája ellentmondásos) SAJÁT erőmódszeres
 * levezetéssel kaptuk, és numerikusan kereszt-ellenőriztük mind a szoftver
 * eredményével, mind a cikk táblázatával (ld. lent).
 *
 * Levezetés (erőmódszer, redundáns X_B = a csuklós támasz reakciója):
 * elsődleges szerkezet = konzol (befogva x=0-nál), a csuklós végen (x=L)
 * a lehajlásnak nullának kell lennie:
 *
 *   δ_q  = q·L⁴/(8·EI) + q·L²/(2·GAs)             (konzol-végi lehajlás UDL-ből)
 *   δ_XB = X_B·L³/(3·EI) + X_B·L/GAs               (konzol-végi lehajlás X_B-ből)
 *   δ_q = δ_XB  ⇒  X_B = q·L·(3+Φ) / (2·(4+Φ)),   Φ = 12·EI/(GAs·L²)
 *
 * A befogási nyomaték (statikai egyensúlyból, ΣM_A=0):
 *
 *   M_A = q·L²/2 − X_B·L = q·L² / (2·(4+Φ))
 *
 * Ellenőrzés (Φ→0, nyírás nélküli Euler–Bernoulli-határeset): X_B → 3qL/8,
 * M_A → qL²/8 — ez a klasszikus tankönyvi eredmény (pl. Hibbeler, Timoshenko
 * & Gere), egyezik a hivatkozott cikk EBT-oszlopával (x=0: −0,1250·qL²).
 *
 * Numerikus kereszt-ellenőrzés a cikk táblázatával: a cikk paraméterei
 * (t/L=0,3, k_s=5/6, ν=0,3, tehát Φ = (E/G)·(h/L)²/k_s = 2,6·0,09/(5/6) ≈
 * 0,2808) alapján a cikk TBT-oszlopa M_A/(qL²) = −0,1168-at ad; a fenti
 * képletből M_A/(qL²) = 1/(2·(4+0,2808)) = 0,1168 — TELJES EGYEZÉS (4
 * tizedesjegyig), ami a saját levezetést és a cikk táblázatát is
 * kölcsönösen megerősíti.
 */
import {
  buildModel,
  distributedForce,
  fixed,
  makeMaterial,
  makeSection,
  pinned,
  rect,
  solveLinear,
  uniformMesh,
} from '@femati/fem-core';
import type { ValidationCase, ValidationCheck } from '../types.js';

export function caseV13(): ValidationCase {
  const E = 2.1e8;
  const nu = 0.3;
  const G = E / (2 * (1 + nu));
  const b = 0.2;
  const h = 0.4;
  const area = b * h;
  const inertia = (b * h ** 3) / 12;
  const ei = E * inertia;
  const gas = (5 / 6) * G * area;

  const L = 6;
  const q = -20;
  const qMag = Math.abs(q);

  const phi = (12 * ei) / (gas * L ** 2);
  const xB = (qMag * L * (3 + phi)) / (2 * (4 + phi));
  const rA = qMag * L - xB;
  const mA = (qMag * L ** 2) / (2 * (4 + phi));

  const material = makeMaterial('S235', 'Acél S235', { e: E, sigmaY: 2.35e5 });
  const section = makeSection('R', 'Téglalap', rect(b, h));
  const mesh = uniformMesh(L, 16, { sectionId: 'R', materialId: 'S235' });
  const lastNodeId = `N${mesh.nodes.length - 1}`;
  const model = buildModel({
    nodes: mesh.nodes,
    elements: mesh.elements,
    materials: [material],
    sections: [section],
    boundaries: [fixed('N0'), pinned(lastNodeId)],
    loads: [distributedForce(0, L, q, q, 'Q1')],
  });

  const result = solveLinear(model);
  const reactionFixed = result.reactions.find((r) => r.nodeId === 'N0');
  const reactionPinned = result.reactions.find((r) => r.nodeId === lastNodeId);
  if (reactionFixed === undefined || reactionPinned === undefined) {
    throw new Error('V-13: hiányzó reakció valamelyik támasznál.');
  }

  const checks: ValidationCheck[] = [
    { label: 'reakció a befogásnál [kN]', reference: rA, computed: reactionFixed.fz, tolerance: 1e-6, kind: 'relative' },
    { label: 'befogási nyomaték M_A [kNm]', reference: mA, computed: reactionFixed.my, tolerance: 1e-6, kind: 'relative' },
    { label: 'reakció a csuklós támasznál [kN]', reference: xB, computed: reactionPinned.fz, tolerance: 1e-6, kind: 'relative' },
    {
      label: 'globális egyensúly (reakciók összege, gépi pontosság)',
      reference: qMag * L,
      computed: reactionFixed.fz + reactionPinned.fz,
      tolerance: 1e-9,
      kind: 'absolute',
    },
  ];

  return {
    id: 'V-13',
    title: 'Befogott-csuklós tartó, egyenletesen megoszló teherrel',
    description:
      'Erőmódszeres (kompatibilitási) zárt alak a befogási nyomatékra és a reakciókra — ' +
      'keresztellenőrizve egy külső szakirodalmi forrás (Ahmed & Rifai, 2021) táblázatával.',
    reference: 'Ahmed A.M., Rifai A.M. (2021), Table VI (Fixed-Hinged Beam with UDL); saját erőmódszeres levezetés',
    checks,
  };
}
