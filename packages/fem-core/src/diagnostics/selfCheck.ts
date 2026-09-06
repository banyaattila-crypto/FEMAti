/**
 * BEÉPÍTETT ÖNELLENŐRZÉS — futásidejű hibatesztelés.
 *
 * Nem ugyanaz, mint az egységteszt. Az egységteszt a fejlesztéskor fut, ismert
 * bemeneteken. Az önellenőrzés MINDEN FUTÁSNÁL lefut, a felhasználó valódi
 * modelljén, és olyan matematikai tulajdonságokat vizsgál, amelyeknek
 * mindig teljesülniük kell — függetlenül attól, milyen modellt adtak meg.
 *
 * Miért kell: egy statikai programban a néma hiba a legveszélyesebb. Ha az
 * elemi merevségi mátrix elveszti a szimmetriáját vagy a merevtest-mozgás
 * energiát termel, az eredmény akkor is „hihető" számokat ad. Az önellenőrzés
 * ezeket a helyzeteket a futás közben elkapja, és a felületen megjeleníti.
 *
 * Ezek a vizsgálatok NEM helyettesítik a validációt (analitikus összevetés),
 * hanem kiegészítik: a validáció azt kérdezi, „jó-e az eredmény", az
 * önellenőrzés azt, „konzisztens-e a számítás önmagával".
 */

import { norm2, type DenseMatrix } from '../linalg/dense.js';

/** Az önellenőrzés részletessége. */
export type SelfCheckLevel = 'off' | 'basic' | 'full';

export type SelfCheckSeverity = 'ok' | 'warning' | 'error';

export interface SelfCheckResult {
  /** Gépi azonosító (teszthez, szűréshez). */
  readonly id: string;
  /** Magyar megnevezés a felülethez. */
  readonly name: string;
  readonly severity: SelfCheckSeverity;
  /** A mért mennyiség (jellemzően relatív hiba). */
  readonly measured: number;
  /** A megengedett érték. */
  readonly tolerance: number;
  /** A mérés mértékegysége; relatív mennyiségnél üres. */
  readonly unit: string;
  /** Emberi nyelvű magyarázat — mit jelent, ha ez elbukik. */
  readonly detail: string;
  /** Diplomaterv-hivatkozás, ahol releváns. */
  readonly reference?: string;
  /** Az érintett entitás (elem, csomópont) azonosítója. */
  readonly entityId?: string;
}

export interface SelfCheckReport {
  readonly results: readonly SelfCheckResult[];
  /** Igaz, ha egyetlen `error` súlyosságú eredmény sincs. */
  readonly passed: boolean;
  readonly level: SelfCheckLevel;
  /** A hibás ellenőrzések száma. */
  readonly errorCount: number;
  readonly warningCount: number;
}

/**
 * Tűrések. Ezek NEM mérnöki tűrések, hanem numerikus konzisztencia-korlátok:
 * gépi pontosság körüli értékek, mert egy 6×6 mátrix szimmetriájának
 * kerekítési hibán túl nincs oka sérülni.
 */
export const SELF_CHECK_TOLERANCE = {
  /** Szimmetria-eltérés a legnagyobb elemhez viszonyítva. */
  symmetry: 1e-12,
  /** Merevtest-mozgás relatív energiája. */
  rigidBody: 1e-10,
  /**
   * Globális egyensúly relatív hibája (P4-től). 1e-9-ről 1e-8-ra emelve a
   * C) fázisban (T-szelvény): a P16 fuzz-teszt egy VALÓS, nem-degenerált
   * T-szelvény paraméterkombinációt talált (h≈0,1 m, 12 elem, 13 m fesztáv),
   * ahol az aszimmetrikus keresztmetszet miatt kicsit rosszabbul kondicionált
   * merevségi mátrix ~1 ULP-nyi bemeneti kerekítési zajt kb. 7×-esre
   * felnagyított — a relatív reziduum 1,02e-9 volt, tehát MAGA a hiba
   * gépi pontosság szintjén maradt, csak a korábbi 1e-9 küszöb nem hagyott
   * hozzá elég tartalékot. Valódi szoftverhiba ennél sok nagyságrenddel
   * nagyobb reziduumot adna — 1e-8 még mindig szigorúan a numerikus zaj
   * tartománya, nem mérnöki tűrés.
   */
  equilibrium: 1e-8,
} as const;

const ok = (
  id: string,
  name: string,
  measured: number,
  tolerance: number,
  detail: string,
  extra: Partial<SelfCheckResult> = {},
): SelfCheckResult => ({
  id,
  name,
  severity: measured <= tolerance ? 'ok' : 'error',
  measured,
  tolerance,
  unit: '',
  detail,
  ...extra,
});

/** Gyűjtő, amelybe a számítás közben az ellenőrzések eredménye kerül. */
export class SelfCheckCollector {
  private readonly items: SelfCheckResult[] = [];
  readonly level: SelfCheckLevel;

  constructor(level: SelfCheckLevel = 'full') {
    this.level = level;
  }

  get enabled(): boolean {
    return this.level !== 'off';
  }

  get fullEnabled(): boolean {
    return this.level === 'full';
  }

  add(result: SelfCheckResult): void {
    if (!this.enabled) return;
    this.items.push(result);
  }

  addAll(results: readonly SelfCheckResult[]): void {
    if (!this.enabled) return;
    this.items.push(...results);
  }

  report(): SelfCheckReport {
    const errorCount = this.items.filter((r) => r.severity === 'error').length;
    const warningCount = this.items.filter((r) => r.severity === 'warning').length;
    return {
      results: this.items,
      passed: errorCount === 0,
      level: this.level,
      errorCount,
      warningCount,
    };
  }
}

// ─── Elemszintű ellenőrzések ──────────────────────────────────────────────────

/**
 * Az elemi merevségi mátrix teljes önellenőrzése.
 *
 * @param k a 6×6 elemi merevségi mátrix
 * @param rigidModes a merevtest-mozgás elmozdulásvektorai
 * @param elementId az elem azonosítója (hibajelentéshez)
 * @param expectedRank a várt rang: 6 − (merevtest-módok száma) = 4
 * @param full a rangvizsgálat (drágább) elvégzése
 */
export function checkElementStiffness(
  k: DenseMatrix,
  rigidModes: readonly Float64Array[],
  elementId: string,
  expectedRank = 4,
  full = true,
): SelfCheckResult[] {
  const out: SelfCheckResult[] = [];
  const scale = k.maxAbs();
  const entity = { entityId: elementId };

  // 1) Véges értékek — NaN vagy Inf a mátrixban minden további eredményt megmérgez.
  let nonFinite = 0;
  for (let i = 0; i < k.data.length; i++) {
    if (!Number.isFinite(k.data[i])) nonFinite++;
  }
  out.push({
    id: 'element.finite',
    name: 'Véges együtthatók',
    severity: nonFinite === 0 ? 'ok' : 'error',
    measured: nonFinite,
    tolerance: 0,
    unit: 'db',
    detail:
      'A merevségi mátrix nem tartalmazhat NaN vagy végtelen értéket. Ha mégis, ' +
      'annak oka jellemzően zérus keresztmetszeti jellemző vagy degenerált geometria.',
    ...entity,
  });
  if (nonFinite > 0) return out; // a további vizsgálatok értelmetlenek

  // 2) Szimmetria — a Kₑ = ∫BᵀDB szerkezetből következik (Diplomaterv 3.1.7.1:
  //    „A K mátrix mindig szimmetrikus").
  const symmetryDefect = scale > 0 ? k.symmetryDefect() / scale : 0;
  out.push(
    ok(
      'element.symmetry',
      'Merevségi mátrix szimmetriája',
      symmetryDefect,
      SELF_CHECK_TOLERANCE.symmetry,
      'A Kₑ = ∫BᵀDB szorzat szerkezetéből következően a mátrixnak szimmetrikusnak ' +
        'kell lennie. Eltérés esetén a kompilálás vagy az integrálás hibás.',
      { reference: 'Diplomaterv 3.1.7.1', ...entity },
    ),
  );

  // 3) Pozitív átló — minden szabadságfoknak van saját merevsége.
  let minDiag = Number.POSITIVE_INFINITY;
  for (let i = 0; i < k.rows; i++) minDiag = Math.min(minDiag, k.get(i, i));
  out.push({
    id: 'element.positive-diagonal',
    name: 'Pozitív átlós elemek',
    severity: minDiag > 0 ? 'ok' : 'error',
    measured: minDiag,
    tolerance: 0,
    unit: '',
    detail:
      'Minden szabadságfoknak pozitív saját merevséggel kell rendelkeznie. ' + 'Nem pozitív átlós elem hiányzó merevségre vagy előjelhibára utal.',
    ...entity,
  });

  // 4) Merevtest-mozgás — a legerősebb ellenőrzés.
  //    Kₑ·u_merev = 0, mert a merev mozgás nem termel alakváltozási energiát.
  for (const [index, mode] of rigidModes.entries()) {
    const f = k.multiplyVector(mode);
    const denom = scale * norm2(mode);
    const relative = denom > 0 ? norm2(f) / denom : norm2(f);
    out.push(
      ok(
        `element.rigid-body-${index}`,
        index === 0 ? 'Merevtest-eltolódás energiamentes' : 'Merev elfordulás energiamentes',
        relative,
        SELF_CHECK_TOLERANCE.rigidBody,
        index === 0
          ? 'A tartó merev eltolása nem termelhet belső erőt. Ha mégis, a B mátrix ' + 'vagy az integrálás hibás.'
          : 'A merev elforduláshoz Timoshenko-gerendán w = a + b·x és φ = b tartozik, ' +
              'ekkor κ = 0 és γ = φ − dw/dx = 0. Ha ez energiát termel, az előjel-konvenció ' +
              'vagy a nyírási tag hibás.',
        { reference: 'Diplomaterv 3.1 egyenlet', ...entity },
      ),
    );
  }

  // 5) Rang — a mechanizmusok (hourglass módusok) kiszűrése.
  if (full) {
    const rank = k.rank();
    out.push({
      id: 'element.rank',
      name: 'Merevségi mátrix rangja',
      severity: rank === expectedRank ? 'ok' : rank < expectedRank ? 'error' : 'warning',
      measured: rank,
      tolerance: expectedRank,
      unit: '',
      detail:
        `A 6 szabadságfokból 2 merevtest-mozgás, ezért a rang ${expectedRank} kell legyen. ` +
        'Kisebb rang hamis mechanizmust (hourglass módust) jelent: az elem olyan ' +
        'deformációt tud felvenni, amelyhez nem tartozik merevség. Ennek oka ' +
        'jellemzően túl kevés integrálási pont.',
      reference: 'Diplomaterv 3.18 (Irons)',
      ...entity,
    });
  }

  return out;
}

/**
 * Irons mechanizmus-becslése (Diplomaterv (3.18)):
 *
 *   M = d·N − R − r·n
 *
 * ahol d: szabadságfok csomópontonként, N: csomópontszám,
 * R: független merevtest-elmozdulások száma, r: a feszültségkomponensek száma
 * integrálási pontonként, n: az integrálási pontok száma.
 *
 * A követelmény: M ≤ 0. Ez elméleti becslés — a tényleges rangvizsgálat
 * (`element.rank`) ennél megbízhatóbb, de ez megmutatja, hány pont KELL.
 */
export function ironsMechanismCount(
  dofPerNode: number,
  nodeCount: number,
  rigidModes: number,
  stressComponents: number,
  integrationPoints: number,
): number {
  return dofPerNode * nodeCount - rigidModes - stressComponents * integrationPoints;
}
