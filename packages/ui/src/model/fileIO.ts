/**
 * A munkaállapot mentése/betöltése helyi `.femati.json` fájlba (File → Mentés
 * / Betöltés).
 *
 * FONTOS: ez NEM ugyanaz a séma, mint a `fem-core` `model/schema.ts`
 * `.femati.json`-ja — az a LEFORDÍTOTT, teljes hálós `Model`-t írja le
 * (minden csomópont/elem explicit), ez viszont a UI PARAMETRIKUS,
 * szerkeszthető állapotát (fesztáv, elemszám, relatív pozíciójú
 * támaszok/terhek stb.) — szándékosan, mert egy lefordított hálóból nem
 * lehetne egyértelműen visszaállítani, hogy melyik csomópont melyik
 * "támasznak" felel meg.
 *
 * A `solverSettings` (2. verziótól, felhasználói kérésre "MINDEN legyen
 * benne") a `state/appStore.ts` megoldó-beállításait (algoritmus,
 * teherlépcső, tolerancia, λ_cél, tehertörténet) és a nézeti kapcsolókat
 * (Gauss-pontok, M ábra oldala, aktív diagram-fül) menti — ezek a modelltől
 * FÜGGETLEN store-ban élnek, ezért külön mezőként.
 *
 * TUDATOSAN NEM tartalmazza:
 * - a nemlineáris (rugalmas-képlékeny) FUTTATÁS eredményét
 *   (`state/nonlinearStore.ts` — mátrixok, Float64Array-ek, Map-ek: nem
 *   praktikusan JSON-szerializálható, és nem is szükséges, mert a
 *   mentett modell + megoldó-beállítások alapján a SZÁMÍTÁS (F5) gomb
 *   DETERMINISZTIKUSAN, egy kattintással pontosan ugyanazt az eredményt
 *   újra-előállítja betöltés után);
 * - a Levezetés (`DerivationView`) és a Hálófüggetlenségi vizsgálat
 *   (`MeshConvergenceView`) tartalmát — mindkettő a modellből ÉLŐBEN,
 *   megnyitáskor újraszámolódik, nincs külön elmentendő állapotuk;
 * - efemer UI-állapotot (melyik párbeszédablak van nyitva, melyik mobil-fül
 *   aktív, a vászon aktuális eszköze) — ezek munkamenet-específikus
 *   ablak-állapotok, nem a modell/beállítások tartalma, visszaállításuk
 *   betöltéskor félrevezető lenne (pl. egy nyitva maradt párbeszédablak
 *   azonnal felugorna).
 */
import {
  DEFAULT_COMPOSITE,
  DEFAULT_MOVING_LOAD,
  DEFAULT_REBAR,
  DEFAULT_SEISMIC,
  DEFAULT_THERMAL_LOAD,
  type EditableFoundation,
  type EditableLoad,
  type EditableModel,
  type EditableSupport,
  type IntegrationScheme,
  type LoadCategory,
  type SupportType,
} from './editable.js';
import type { DiagramTab, LoadHistoryMode, SolverAlgorithm, UnitSystem } from '../state/appStore.js';

export const EDITOR_FILE_FORMAT_VERSION = 2 as const;

export interface SolverSettingsFile {
  readonly algorithm: SolverAlgorithm;
  readonly loadHistory: LoadHistoryMode;
  readonly loadStep: number;
  readonly tolerance: number;
  readonly peakLambda: number;
  readonly showGaussPoints: boolean;
  readonly momentTensionSide: boolean;
  /** Reakcióerők piros nyíllal a vásznon (2026-09-04) — a régebbi (e mező nélküli) mentéseknél `true`-ra esik vissza, ld. `parseSolverSettings`. */
  readonly showReactions: boolean;
  /** Mértékegység-rendszer a kijelzéshez (2026-09-04, `format/numbers.ts`) — a régebbi (e mező nélküli) mentéseknél `'si'`-re esik vissza. */
  readonly unitSystem: UnitSystem;
  readonly activeDiagram: DiagramTab;
}

export const DEFAULT_SOLVER_SETTINGS: SolverSettingsFile = {
  algorithm: 'newton',
  loadHistory: 'monotonic',
  loadStep: 0.1,
  tolerance: 0.5,
  peakLambda: 1.2,
  showGaussPoints: false,
  momentTensionSide: true,
  showReactions: true,
  unitSystem: 'si',
  activeDiagram: 'M',
};

export interface EditableModelFile {
  readonly femaiEditorFormat: typeof EDITOR_FILE_FORMAT_VERSION;
  readonly model: EditableModel;
  readonly solverSettings: SolverSettingsFile;
}

export interface ParsedModelFile {
  readonly model: EditableModel;
  readonly solverSettings: SolverSettingsFile;
}

/** A munkaállapot (modell + megoldó-beállítások) JSON szöveggé alakítása mentéshez. */
export function serializeEditableModel(model: EditableModel, solverSettings: SolverSettingsFile): string {
  const file: EditableModelFile = { femaiEditorFormat: EDITOR_FILE_FORMAT_VERSION, model, solverSettings };
  return JSON.stringify(file, null, 2);
}

/**
 * Nyelv-semleges leírása annak, mi ment el egy `.femati.json` fájl
 * beolvasásakor — az adatréteg (ez a fájl) nem tudhat UI-nyelvet, a
 * ténylegesen megjelenő szöveget az `i18n/errors.ts` állítja elő ebből,
 * a felület aktuális nyelve alapján.
 */
export type ModelFileErrorInfo =
  | { readonly code: 'invalid-json' }
  | { readonly code: 'unsupported-format-version'; readonly expected: number; readonly got: unknown }
  | { readonly code: 'missing-or-not-object'; readonly where: string }
  | { readonly code: 'not-array'; readonly where: string }
  | { readonly code: 'missing-or-not-number'; readonly where: string; readonly key: string }
  | { readonly code: 'not-number'; readonly where: string; readonly key: string }
  | { readonly code: 'missing-or-not-string'; readonly where: string; readonly key: string }
  | { readonly code: 'missing-or-not-boolean'; readonly where: string; readonly key: string }
  | { readonly code: 'not-boolean'; readonly where: string; readonly key: string }
  | { readonly code: 'invalid-enum-value'; readonly where: string; readonly key: string; readonly value: string }
  | { readonly code: 'unknown-support-type'; readonly where: string; readonly value: string }
  | { readonly code: 'unknown-load-category'; readonly where: string; readonly value: string }
  | { readonly code: 'unknown-load-kind'; readonly where: string; readonly value: string };

/** A korábbi, kizárólag magyar hibaszövegekkel megegyező alapértelmezés — az `Error.message` erre esik vissza, amíg a hívó (App.tsx) nem az `info` mezőt formázza a saját nyelvén (i18n 3. fázis). */
function formatModelFileErrorHu(info: ModelFileErrorInfo): string {
  switch (info.code) {
    case 'invalid-json':
      return 'A fájl nem érvényes JSON.';
    case 'unsupported-format-version':
      return (
        `Ismeretlen vagy nem támogatott .femati.json formátum-verzió (várt: ${String(info.expected)}, kapott: ${String(info.got)}). ` +
        'Ez a fájl vagy nem a FEMAti szerkesztőből származik, vagy egy újabb verzióból.'
      );
    case 'missing-or-not-object':
      return `${info.where}: hiányzik vagy nem objektum.`;
    case 'not-array':
      return `${info.where}: nem tömb.`;
    case 'missing-or-not-number':
      return `${info.where}: "${info.key}" hiányzik vagy nem (véges) szám.`;
    case 'not-number':
      return `${info.where}: "${info.key}" nem (véges) szám.`;
    case 'missing-or-not-string':
      return `${info.where}: "${info.key}" hiányzik vagy nem szöveg.`;
    case 'missing-or-not-boolean':
      return `${info.where}: "${info.key}" hiányzik vagy nem logikai érték.`;
    case 'not-boolean':
      return `${info.where}: "${info.key}" nem logikai érték.`;
    case 'invalid-enum-value':
      return `${info.where}: érvénytelen "${info.key}" érték "${info.value}".`;
    case 'unknown-support-type':
      return `${info.where}: ismeretlen támasztípus "${info.value}".`;
    case 'unknown-load-category':
      return `${info.where}: ismeretlen teherkategória "${info.value}".`;
    case 'unknown-load-kind':
      return `${info.where}: ismeretlen tehertípus "${info.value}".`;
  }
}

/** Érvénytelen/sérült `.femati.json` fájl beolvasásakor dobott hiba — a nyelv-semleges `info` mellett egy magyar `message`-t is hordoz (visszamenőleges kompatibilitás, ld. `formatModelFileErrorHu`). */
export class ModelFileError extends Error {
  override readonly name = 'ModelFileError';
  readonly info: ModelFileErrorInfo;

  constructor(info: ModelFileErrorInfo) {
    super(formatModelFileErrorHu(info));
    this.info = info;
  }
}

function assert(condition: boolean, info: ModelFileErrorInfo): asserts condition {
  if (!condition) throw new ModelFileError(info);
}

function num(obj: Record<string, unknown>, key: string, where: string): number {
  const v = obj[key];
  assert(typeof v === 'number' && Number.isFinite(v), { code: 'missing-or-not-number', where, key });
  return v as number;
}

function optNum(obj: Record<string, unknown>, key: string, where: string): number | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  assert(typeof v === 'number' && Number.isFinite(v), { code: 'not-number', where, key });
  return v as number;
}

function optBool(obj: Record<string, unknown>, key: string, where: string): boolean | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  assert(typeof v === 'boolean', { code: 'not-boolean', where, key });
  return v as boolean;
}

function str(obj: Record<string, unknown>, key: string, where: string): string {
  const v = obj[key];
  assert(typeof v === 'string' && v.length > 0, { code: 'missing-or-not-string', where, key });
  return v as string;
}

function bool(obj: Record<string, unknown>, key: string, where: string): boolean {
  const v = obj[key];
  assert(typeof v === 'boolean', { code: 'missing-or-not-boolean', where, key });
  return v as boolean;
}

function record(v: unknown, where: string): Record<string, unknown> {
  assert(typeof v === 'object' && v !== null, { code: 'missing-or-not-object', where });
  return v as Record<string, unknown>;
}

function array(v: unknown, where: string): readonly unknown[] {
  assert(Array.isArray(v), { code: 'not-array', where });
  return v;
}

const SUPPORT_TYPES: readonly SupportType[] = ['fixed', 'pinned', 'roller', 'spring'];

function parseSupport(v: unknown, index: number): EditableSupport {
  const where = `supports[${index}]`;
  const o = record(v, where);
  const id = str(o, 'id', where);
  const x = num(o, 'x', where);
  const type = str(o, 'type', where);
  assert(SUPPORT_TYPES.includes(type as SupportType), { code: 'unknown-support-type', where, value: type });
  const k = optNum(o, 'k', where);
  const dz = optNum(o, 'dz', where);
  const dPhi = optNum(o, 'dPhi', where);
  return { id, x, type: type as SupportType, ...(k !== undefined ? { k } : {}), dz, dPhi };
}

const LOAD_CATEGORIES: readonly LoadCategory[] = ['permanent', 'variable'];

/** Teherkategória beolvasása — 2026-09-04 óta létező mező; hiányában (régebbi mentés) `'variable'`-re esik vissza, ugyanaz a minta, mint a `showReactions` mezőnél (`parseSolverSettings`). */
function loadCategory(obj: Record<string, unknown>, where: string): LoadCategory {
  const v = obj.category;
  if (v === undefined) return 'variable';
  assert(typeof v === 'string' && LOAD_CATEGORIES.includes(v as LoadCategory), { code: 'unknown-load-category', where, value: String(v) });
  return v as LoadCategory;
}

function parseLoad(v: unknown, index: number): EditableLoad {
  const where = `loads[${index}]`;
  const o = record(v, where);
  const id = str(o, 'id', where);
  const kind = str(o, 'kind', where);
  const category = loadCategory(o, where);
  if (kind === 'point') return { id, kind: 'point', x: num(o, 'x', where), p: num(o, 'p', where), category };
  if (kind === 'moment') return { id, kind: 'moment', x: num(o, 'x', where), m: num(o, 'm', where), category };
  if (kind === 'distributed') {
    return {
      id,
      kind: 'distributed',
      x1: num(o, 'x1', where),
      x2: num(o, 'x2', where),
      q1: num(o, 'q1', where),
      q2: num(o, 'q2', where),
      category,
    };
  }
  if (kind === 'distributed-moment') {
    return {
      id,
      kind: 'distributed-moment',
      x1: num(o, 'x1', where),
      x2: num(o, 'x2', where),
      m1: num(o, 'm1', where),
      m2: num(o, 'm2', where),
      category,
    };
  }
  throw new ModelFileError({ code: 'unknown-load-kind', where, value: kind });
}

function parseFoundation(v: unknown, index: number): EditableFoundation {
  const where = `foundations[${index}]`;
  const o = record(v, where);
  const noTension = optBool(o, 'noTension', where);
  return {
    id: str(o, 'id', where),
    x1: num(o, 'x1', where),
    x2: num(o, 'x2', where),
    c: num(o, 'c', where),
    ...(noTension !== undefined ? { noTension } : {}),
  };
}

const ALGORITHMS: readonly SolverAlgorithm[] = ['newton', 'modified-newton'];
const LOAD_HISTORIES: readonly LoadHistoryMode[] = ['monotonic', 'unloading'];
// 2026-09-03: VALÓDI hiba javítva — ez a lista két új fület (`dynamic`,
// `fb4a9a0`, 2026-09-02; `utilization`, ma) sosem kapott meg, ezért egy
// dinamika/kihasználtság fül aktív állapotában mentett `.femati.json`
// visszatöltéskor "érvénytelen activeDiagram érték" hibát dobott volna.
const DIAGRAM_TABS: readonly DiagramTab[] = [
  'M',
  'T',
  'w',
  'phi',
  'utilization',
  'envelope',
  'load-displacement',
  'convergence',
  'stress3d',
  'modal',
  'dynamic',
];

/** A `solverSettings` mező beolvasása — hiányzó fájlnál (1. verziójú, `solverSettings` nélküli mentés) az alapértelmezésekre esik vissza, nem hibázik. */
function parseSolverSettings(v: unknown): SolverSettingsFile {
  if (v === undefined) return DEFAULT_SOLVER_SETTINGS;
  const o = record(v, 'solverSettings');
  const algorithm = str(o, 'algorithm', 'solverSettings');
  assert(ALGORITHMS.includes(algorithm as SolverAlgorithm), { code: 'invalid-enum-value', where: 'solverSettings', key: 'algorithm', value: algorithm });
  const loadHistory = str(o, 'loadHistory', 'solverSettings');
  assert(LOAD_HISTORIES.includes(loadHistory as LoadHistoryMode), { code: 'invalid-enum-value', where: 'solverSettings', key: 'loadHistory', value: loadHistory });
  const activeDiagram = str(o, 'activeDiagram', 'solverSettings');
  assert(DIAGRAM_TABS.includes(activeDiagram as DiagramTab), { code: 'invalid-enum-value', where: 'solverSettings', key: 'activeDiagram', value: activeDiagram });
  return {
    algorithm: algorithm as SolverAlgorithm,
    loadHistory: loadHistory as LoadHistoryMode,
    loadStep: num(o, 'loadStep', 'solverSettings'),
    tolerance: num(o, 'tolerance', 'solverSettings'),
    peakLambda: num(o, 'peakLambda', 'solverSettings'),
    showGaussPoints: bool(o, 'showGaussPoints', 'solverSettings'),
    momentTensionSide: bool(o, 'momentTensionSide', 'solverSettings'),
    // ÚJ mező (2026-09-04) — a MÁR meglévő v2 mentések (a mai nap korábbi
    // részéből, `dynamic`/`utilization` fülekkel) még nem ismerik; a
    // tanulság a ma reggeli DIAGRAM_TABS-hibából: ÚJ mezőt egy MÁR élő
    // formátum-verzión belül csak tolerálva, hiányzásnál alapértékre esve
    // szabad hozzáadni, nem szigorú `bool()`-lal (ami hibát dobna).
    showReactions: o.showReactions === undefined ? true : bool(o, 'showReactions', 'solverSettings'),
    // ÚJ mező (2026-09-04, mértékegység-váltó) — ugyanaz a toleráns minta, mint `showReactions`-nál.
    unitSystem: o.unitSystem === 'imperial' ? 'imperial' : 'si',
    activeDiagram: activeDiagram as DiagramTab,
  };
}

/**
 * `.femati.json` szöveg beolvasása munkaállapottá (modell + megoldó-beállítások).
 * @throws ModelFileError érvénytelen/sérült fájl esetén, felhasználónak szánt magyar üzenettel.
 */
export function parseEditableModelFile(text: string): ParsedModelFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ModelFileError({ code: 'invalid-json' });
  }
  const file = record(raw, 'fájl');
  assert(file.femaiEditorFormat === 1 || file.femaiEditorFormat === EDITOR_FILE_FORMAT_VERSION, {
    code: 'unsupported-format-version',
    expected: EDITOR_FILE_FORMAT_VERSION,
    got: file.femaiEditorFormat,
  });
  const model = record(file.model, 'model');

  const integration = str(model, 'integration', 'model');
  assert(integration === 'selective' || integration === 'full', { code: 'invalid-enum-value', where: 'model', key: 'integration', value: integration });

  const thermalRaw = model.thermalLoad;
  const thermalLoad =
    thermalRaw === undefined
      ? DEFAULT_THERMAL_LOAD
      : (() => {
          const t = record(thermalRaw, 'model.thermalLoad');
          return { enabled: bool(t, 'enabled', 'model.thermalLoad'), tRef: num(t, 'tRef', 'model.thermalLoad'), tTop: num(t, 'tTop', 'model.thermalLoad'), tBottom: num(t, 'tBottom', 'model.thermalLoad') };
        })();

  // 2026-09-03: ÚJ mező (vasbeton ULS-ellenőrzés) — a korábbi (ma előtti)
  // mentések nem ismerik, ezért hiányzó `model.rebar`-nál az alapértelmezésre
  // (kikapcsolt vasalás) esik vissza, ugyanúgy, mint a `thermalLoad`/
  // `foundations` visszamenőleges kompatibilitása.
  const rebarRaw = model.rebar;
  const rebar =
    rebarRaw === undefined
      ? DEFAULT_REBAR
      : (() => {
          const r = record(rebarRaw, 'model.rebar');
          return {
            enabled: bool(r, 'enabled', 'model.rebar'),
            asBottom: num(r, 'asBottom', 'model.rebar'),
            asTop: num(r, 'asTop', 'model.rebar'),
            cover: num(r, 'cover', 'model.rebar'),
          };
        })();

  // 2026-09-04: ÚJ mező (kompozit acél-beton keresztmetszet) — ugyanaz a
  // visszamenőleges kompatibilitási minta, mint a `rebar`-nál.
  const compositeRaw = model.composite;
  const composite =
    compositeRaw === undefined
      ? DEFAULT_COMPOSITE
      : (() => {
          const c = record(compositeRaw, 'model.composite');
          return {
            enabled: bool(c, 'enabled', 'model.composite'),
            slabWidth: num(c, 'slabWidth', 'model.composite'),
            slabThickness: num(c, 'slabThickness', 'model.composite'),
            slabMaterialId: str(c, 'slabMaterialId', 'model.composite'),
          };
        })();

  // 2026-09-04: ÚJ mező (mozgó teher — burkolóábra) — ugyanaz a
  // visszamenőleges kompatibilitási minta, mint a `rebar`/`composite`-nál.
  const movingLoadRaw = model.movingLoad;
  const movingLoad =
    movingLoadRaw === undefined
      ? DEFAULT_MOVING_LOAD
      : (() => {
          const ml = record(movingLoadRaw, 'model.movingLoad');
          return {
            enabled: bool(ml, 'enabled', 'model.movingLoad'),
            magnitude: num(ml, 'magnitude', 'model.movingLoad'),
          };
        })();

  // 2026-09-06: ÚJ mező (EN 1998-1 függőleges földrengési komponens) —
  // ugyanaz a visszamenőleges kompatibilitási minta, mint a `rebar`/
  // `composite`/`movingLoad`-nál.
  const seismicRaw = model.seismic;
  const seismic =
    seismicRaw === undefined
      ? DEFAULT_SEISMIC
      : (() => {
          const s = record(seismicRaw, 'model.seismic');
          const spectrumType = num(s, 'spectrumType', 'model.seismic');
          assert(spectrumType === 1 || spectrumType === 2, {
            code: 'invalid-enum-value',
            where: 'model.seismic',
            key: 'spectrumType',
            value: String(spectrumType),
          });
          return {
            enabled: bool(s, 'enabled', 'model.seismic'),
            agOverG: num(s, 'agOverG', 'model.seismic'),
            gammaI: num(s, 'gammaI', 'model.seismic'),
            spectrumType: spectrumType as 1 | 2,
          };
        })();

  return {
    model: {
      presetId: str(model, 'presetId', 'model'),
      span: num(model, 'span', 'model'),
      elementCount: num(model, 'elementCount', 'model'),
      sectionId: str(model, 'sectionId', 'model'),
      materialId: str(model, 'materialId', 'model'),
      selfWeight: bool(model, 'selfWeight', 'model'),
      // 2026-09-04: ÚJ mező (másodrendű P-Δ hatás) — hiányzó mezőnél 0-ra
      // (kikapcsolt állapot) esik vissza, ugyanaz a visszamenőleges
      // kompatibilitási minta, mint a többi 2026-09-04-es bővítésnél.
      axialForce: optNum(model, 'axialForce', 'model') ?? 0,
      thermalLoad,
      rebar,
      composite,
      movingLoad,
      seismic,
      integration: integration as IntegrationScheme,
      supports: array(model.supports, 'model.supports').map(parseSupport),
      loads: array(model.loads, 'model.loads').map(parseLoad),
      foundations: model.foundations === undefined ? [] : array(model.foundations, 'model.foundations').map(parseFoundation),
    },
    solverSettings: parseSolverSettings(file.solverSettings),
  };
}
