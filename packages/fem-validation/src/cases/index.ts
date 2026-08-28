import { caseV01 } from './v01-konzol-vegponti-p.js';
import { caseV02 } from './v02-kettamaszu-egyenletes-q.js';
import { caseV03 } from './v03-tiszta-hajlitas-patch-test.js';
import { caseV04 } from './v04-locking.js';
import { caseV05 } from './v05-merevtest-mozgas.js';
import { caseV06 } from './v06-szimmetria-pozitiv-definit.js';
import { caseV07 } from './v07-hoteher-hatarozott.js';
import { caseV08 } from './v08-hoteher-befogott.js';
import { caseV09 } from './v09-tamaszsullyedes.js';
import { caseV10 } from './v10-onsuly-ekvivalencia.js';
import { caseV11 } from './v11-penalty-vs-elimination.js';
import { caseV12 } from './v12-konvergencia.js';
import { caseV13 } from './v13-befogott-csuklos-egyenletes-q.js';
import { caseP01 } from './p01-teglalap-alaki-tenyezo.js';
import { caseP02 } from './p02-egyeb-szelvenyek-alaki-tenyezo.js';
import { caseP03 } from './p03-konzol-hatarteher.js';
import { caseP04 } from './p04-kettamaszu-kozeppont-p.js';
import { caseP05 } from './p05-kettamaszu-egyenletes-q.js';
import { caseP06 } from './p06-befogott-egyenletes-q.js';
import { caseP07 } from './p07-befogott-kozeppont-p.js';
import { caseP08 } from './p08-ketnyilasu-folytatolagos.js';
import { caseP09 } from './p09-m-kappa-zart-megoldas.js';
import { caseP10 } from './p10-sajatfeszultsegek.js';
import { caseP11 } from './p11-beallas.js';
import { caseP12 } from './p12-kemenyedes.js';
import { caseP13 } from './p13-retegszam-konvergencia.js';
import { caseP14 } from './p14-teherlepcso-fuggetlenseg.js';
import { caseP15 } from './p15-newton-vs-modositott.js';
import { caseP16 } from './p16-reziduum-monotonitas.js';
import type { ValidationCase } from '../types.js';

export {
  caseV01,
  caseV02,
  caseV03,
  caseV04,
  caseV05,
  caseV06,
  caseV07,
  caseV08,
  caseV09,
  caseV10,
  caseV11,
  caseV12,
  caseV13,
  caseP01,
  caseP02,
  caseP03,
  caseP04,
  caseP05,
  caseP06,
  caseP07,
  caseP08,
  caseP09,
  caseP10,
  caseP11,
  caseP12,
  caseP13,
  caseP14,
  caseP15,
  caseP16,
};

/**
 * A P4 fázisban kötelező lineáris esetek (MASTER-PROMPT-TERV P4 prompt):
 * V-01, V-03, V-05, V-06, V-11. A P5 fázis hozzáadta a V-02, V-07, V-08,
 * V-09, V-10 eseteket (tehervektorok). A P6 fázis hozzáadta a V-12
 * (h-konvergencia) esetet (utófeldolgozás). A P9 fázis hozzáadta a P-01,
 * P-02 (alaki tényezők) és P-12 (keményedés) eseteket (rugalmas-képlékeny
 * anyagmodell, igénybevétel-szintű). A P10 fázis hozzáadta a P-09 (rétegelt
 * M-κ görbe zárt megoldással) és P-13 (rétegszám-konvergencia + semleges
 * tengely elmozdulása) eseteket (rétegelt/fiber anyagmodell). A P11 fázis
 * hozzáadta a P-14 (teherlépcső-függetlenség), P-15 (Newton vs. módosított
 * Newton) és P-16 (reziduum-monotonitás) eseteket (nemlineáris megoldó). A
 * P12 fázis hozzáadta a P-03…P-08 (határteher-esetek, a diplomaterv 3.2
 * táblázatának fő feladattípusai — kiemelten a P-08 kétnyílású folytatólagos
 * gerenda) és P-10/P-11 (sajátfeszültségek, beállás) eseteket. A V-13
 * (befogott-csuklós tartó, UDL) a P18 UTÁNI munka része — ld.
 * `STATUS_REPORT.md` 16. pont. A V-04 (záródás/locking) esetet a
 * `docs/THEORY.md` és a `STATUS_REPORT.md` évek óta "kész, zöld"-ként
 * hivatkozta, DE valójában sosem készült el (egy nem létező
 * `element.test.ts`-re hivatkoztak) — a P18 UTÁNI munka pótolta, miután a
 * felhasználó egy külső MathWorks-forrás alapján kért önreflektív
 * áttekintést, ld. `STATUS_REPORT.md` 24. pont.
 */
export function allCases(): readonly ValidationCase[] {
  return [
    caseV01(),
    caseV02(),
    caseV03(),
    caseV04(),
    caseV05(),
    caseV06(),
    caseV07(),
    caseV08(),
    caseV09(),
    caseV10(),
    caseV11(),
    caseV12(),
    caseV13(),
    caseP01(),
    caseP02(),
    caseP03(),
    caseP04(),
    caseP05(),
    caseP06(),
    caseP07(),
    caseP08(),
    caseP09(),
    caseP10(),
    caseP11(),
    caseP12(),
    caseP13(),
    caseP14(),
    caseP15(),
    caseP16(),
  ];
}
