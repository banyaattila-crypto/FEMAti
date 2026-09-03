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
  DEFAULT_REBAR,
  DEFAULT_THERMAL_LOAD,
  type EditableFoundation,
  type EditableLoad,
  type EditableModel,
  type EditableSupport,
  type IntegrationScheme,
  type SupportType,
} from './editable.js';
import type { DiagramTab, LoadHistoryMode, SolverAlgorithm } from '../state/appStore.js';

export const EDITOR_FILE_FORMAT_VERSION = 2 as const;

export interface SolverSettingsFile {
  readonly algorithm: SolverAlgorithm;
  readonly loadHistory: LoadHistoryMode;
  readonly loadStep: number;
  readonly tolerance: number;
  readonly peakLambda: number;
  readonly showGaussPoints: boolean;
  readonly momentTensionSide: boolean;
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

/** Érvénytelen/sérült `.femati.json` fájl beolvasásakor dobott hiba — a felhasználónak érthető üzenettel (HIBATURESI-POLITIKA). */
export class ModelFileError extends Error {
  override readonly name = 'ModelFileError';
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new ModelFileError(message);
}

function num(obj: Record<string, unknown>, key: string, where: string): number {
  const v = obj[key];
  assert(typeof v === 'number' && Number.isFinite(v), `${where}: "${key}" hiányzik vagy nem (véges) szám.`);
  return v as number;
}

function optNum(obj: Record<string, unknown>, key: string, where: string): number | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  assert(typeof v === 'number' && Number.isFinite(v), `${where}: "${key}" nem (véges) szám.`);
  return v as number;
}

function str(obj: Record<string, unknown>, key: string, where: string): string {
  const v = obj[key];
  assert(typeof v === 'string' && v.length > 0, `${where}: "${key}" hiányzik vagy nem szöveg.`);
  return v as string;
}

function bool(obj: Record<string, unknown>, key: string, where: string): boolean {
  const v = obj[key];
  assert(typeof v === 'boolean', `${where}: "${key}" hiányzik vagy nem logikai érték.`);
  return v as boolean;
}

function record(v: unknown, where: string): Record<string, unknown> {
  assert(typeof v === 'object' && v !== null, `${where}: hiányzik vagy nem objektum.`);
  return v as Record<string, unknown>;
}

function array(v: unknown, where: string): readonly unknown[] {
  assert(Array.isArray(v), `${where}: nem tömb.`);
  return v;
}

const SUPPORT_TYPES: readonly SupportType[] = ['fixed', 'pinned', 'roller', 'spring'];

function parseSupport(v: unknown, index: number): EditableSupport {
  const where = `supports[${index}]`;
  const o = record(v, where);
  const id = str(o, 'id', where);
  const x = num(o, 'x', where);
  const type = str(o, 'type', where);
  assert(SUPPORT_TYPES.includes(type as SupportType), `${where}: ismeretlen támasztípus "${type}".`);
  const k = optNum(o, 'k', where);
  const dz = optNum(o, 'dz', where);
  const dPhi = optNum(o, 'dPhi', where);
  return { id, x, type: type as SupportType, ...(k !== undefined ? { k } : {}), dz, dPhi };
}

function parseLoad(v: unknown, index: number): EditableLoad {
  const where = `loads[${index}]`;
  const o = record(v, where);
  const id = str(o, 'id', where);
  const kind = str(o, 'kind', where);
  if (kind === 'point') return { id, kind: 'point', x: num(o, 'x', where), p: num(o, 'p', where) };
  if (kind === 'moment') return { id, kind: 'moment', x: num(o, 'x', where), m: num(o, 'm', where) };
  if (kind === 'distributed') {
    return {
      id,
      kind: 'distributed',
      x1: num(o, 'x1', where),
      x2: num(o, 'x2', where),
      q1: num(o, 'q1', where),
      q2: num(o, 'q2', where),
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
    };
  }
  throw new ModelFileError(`${where}: ismeretlen tehertípus "${kind}".`);
}

function parseFoundation(v: unknown, index: number): EditableFoundation {
  const where = `foundations[${index}]`;
  const o = record(v, where);
  return { id: str(o, 'id', where), x1: num(o, 'x1', where), x2: num(o, 'x2', where), c: num(o, 'c', where) };
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
  assert(ALGORITHMS.includes(algorithm as SolverAlgorithm), `solverSettings: érvénytelen "algorithm" érték "${algorithm}".`);
  const loadHistory = str(o, 'loadHistory', 'solverSettings');
  assert(LOAD_HISTORIES.includes(loadHistory as LoadHistoryMode), `solverSettings: érvénytelen "loadHistory" érték "${loadHistory}".`);
  const activeDiagram = str(o, 'activeDiagram', 'solverSettings');
  assert(DIAGRAM_TABS.includes(activeDiagram as DiagramTab), `solverSettings: érvénytelen "activeDiagram" érték "${activeDiagram}".`);
  return {
    algorithm: algorithm as SolverAlgorithm,
    loadHistory: loadHistory as LoadHistoryMode,
    loadStep: num(o, 'loadStep', 'solverSettings'),
    tolerance: num(o, 'tolerance', 'solverSettings'),
    peakLambda: num(o, 'peakLambda', 'solverSettings'),
    showGaussPoints: bool(o, 'showGaussPoints', 'solverSettings'),
    momentTensionSide: bool(o, 'momentTensionSide', 'solverSettings'),
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
    throw new ModelFileError('A fájl nem érvényes JSON.');
  }
  const file = record(raw, 'fájl');
  assert(
    file.femaiEditorFormat === 1 || file.femaiEditorFormat === EDITOR_FILE_FORMAT_VERSION,
    `Ismeretlen vagy nem támogatott .femati.json formátum-verzió (várt: ${EDITOR_FILE_FORMAT_VERSION}, kapott: ${String(file.femaiEditorFormat)}). ` +
      'Ez a fájl vagy nem a FEMAti szerkesztőből származik, vagy egy újabb verzióból.',
  );
  const model = record(file.model, 'model');

  const integration = str(model, 'integration', 'model');
  assert(integration === 'selective' || integration === 'full', `model: érvénytelen "integration" érték "${integration}".`);

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

  return {
    model: {
      presetId: str(model, 'presetId', 'model'),
      span: num(model, 'span', 'model'),
      elementCount: num(model, 'elementCount', 'model'),
      sectionId: str(model, 'sectionId', 'model'),
      materialId: str(model, 'materialId', 'model'),
      selfWeight: bool(model, 'selfWeight', 'model'),
      thermalLoad,
      rebar,
      integration: integration as IntegrationScheme,
      supports: array(model.supports, 'model.supports').map(parseSupport),
      loads: array(model.loads, 'model.loads').map(parseLoad),
      foundations: model.foundations === undefined ? [] : array(model.foundations, 'model.foundations').map(parseFoundation),
    },
    solverSettings: parseSolverSettings(file.solverSettings),
  };
}
