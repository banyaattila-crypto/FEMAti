/**
 * A vászon SZERKESZTHETŐ modell-reprezentációja.
 *
 * Ez NEM a `@femati/fem-core` `Model` típusa — sima számokat tart (SI-alapú
 * belső egységben, márkázás nélkül), mert a canvas-interakciók (húzás,
 * kattintás) folyamatos, márkázatlan koordinátákkal dolgoznak. A tényleges
 * `Model`-lé fordítás a `compile.ts`-ben történik, kizárólag SZÁMÍTÁS előtt.
 *
 * MEGKÖTÉS: a támaszok és a koncentrált terhek a legközelebbi hálócsomópontra
 * illeszkednek (snap) — a fem-core (P5-ig) nem támogat tetszőleges belső
 * ponton ható koncentrált terhet (`MASTER-PROMPT-TERV` 1.4 „Koncentrált
 * elemen belül" sora nincs implementálva, ld. `docs/THEORY.md`). A megoszló
 * teher tartománya viszont SZABADON, elemhatártól függetlenül állítható,
 * mert azt a mag már P5 óta helyesen redukálja részleges lefedésre is.
 */

/**
 * Az EGYETLEN `SupportType` forrás (2026-08-30 előtt `data/catalog.ts` is
 * függetlenül deklarálta — összevonva, `catalog.ts` mostantól innen
 * re-exportál, hogy a két hely ne tudjon szétcsúszni).
 */
export type SupportType = 'fixed' | 'pinned' | 'roller' | 'spring';

export interface EditableSupport {
  readonly id: string;
  /** Abszolút pozíció a tartó mentén [m]. Mindig egy hálócsomópontra illesztve. */
  readonly x: number;
  readonly type: SupportType;
  /** Rugóállandó [kN/m] — CSAK `type === 'spring'` esetén értelmezett. */
  readonly k?: number;
  /** Előírt eltolódás [m] — bármely támasztípusnál megadható (talajsüllyedés stb.). `| undefined` explicit: a törléshez (`setSupportDisplacement`) exactOptionalPropertyTypes mellett kell. */
  readonly dz?: number | undefined;
  /** Előírt elfordulás [rad] — bármely támasztípusnál megadható. */
  readonly dPhi?: number | undefined;
}

export interface EditablePointLoad {
  readonly id: string;
  readonly kind: 'point';
  /** Abszolút pozíció [m], hálócsomópontra illesztve. */
  readonly x: number;
  /** Erő [kN], z irányban (lefelé pozitív). */
  readonly p: number;
}

/** Koncentrált nyomatékteher [kNm], hálócsomópontra illesztve. */
export interface EditableMomentLoad {
  readonly id: string;
  readonly kind: 'moment';
  readonly x: number;
  readonly m: number;
}

export interface EditableDistributedLoad {
  readonly id: string;
  readonly kind: 'distributed';
  readonly x1: number;
  readonly x2: number;
  /** Intenzitás a szakasz elején/végén [kN/m] — q1===q2 esetén egyenletes, egyébként trapéz. */
  readonly q1: number;
  readonly q2: number;
}

/** Megoszló nyomatékteher m(x) [kNm/m] — a megoszló erő egyenes párja. */
export interface EditableDistributedMomentLoad {
  readonly id: string;
  readonly kind: 'distributed-moment';
  readonly x1: number;
  readonly x2: number;
  readonly m1: number;
  readonly m2: number;
}

export type EditableLoad = EditablePointLoad | EditableMomentLoad | EditableDistributedLoad | EditableDistributedMomentLoad;

/** Winkler-féle rugalmas ágyazat egy szakaszon — NEM `Load`, önálló entitáskategória. */
export interface EditableFoundation {
  readonly id: string;
  readonly x1: number;
  readonly x2: number;
  /** Ágyazási tényező [kN/m²]. */
  readonly c: number;
}

/** Globális hőteher — nem pozícionált, az egész tartóra hat (a fem-core `thermal()` alapértelmezése). */
export interface ThermalLoadState {
  readonly enabled: boolean;
  /** Referencia- (feszültségmentes) hőmérséklet [°C] */
  readonly tRef: number;
  /** Felső szél hőmérséklete [°C] */
  readonly tTop: number;
  /** Alsó szél hőmérséklete [°C] */
  readonly tBottom: number;
}

export type IntegrationScheme = 'selective' | 'full';

/**
 * Vasbeton vasalás — 2026-09-03, felhasználói kérés ("a legnagyobb tényleges
 * hiányosság... nincs valódi As alapú ULS-teherbírás-ellenőrzés"). CSAK
 * `rect` keresztmetszetnél és beton anyagnál értelmezett (ld.
 * `panels/LeftPanel.tsx`/`panels/RightPanel.tsx` feltételes megjelenítése) —
 * a klasszikus téglalap feszültségblokk (EC2 3.1.7(3)) csak állandó
 * szélességű nyomott zónára érvényes.
 */
export interface RebarState {
  readonly enabled: boolean;
  /** Alsó (húzott oldali, pozitív M-nél mérvadó) vasalás területe [m²] */
  readonly asBottom: number;
  /** Felső (nyomott oldali, negatív M-nél tension-oldali) vasalás területe [m²] */
  readonly asTop: number;
  /** Tengelytávolság a szélső betonszáltól (fedés + Ø/2 közelítéssel) [m] */
  readonly cover: number;
}

export interface EditableModel {
  readonly presetId: string;
  /** Fesztáv [m] */
  readonly span: number;
  readonly elementCount: number;
  readonly sectionId: string;
  readonly materialId: string;
  readonly selfWeight: boolean;
  readonly thermalLoad: ThermalLoadState;
  readonly rebar: RebarState;
  readonly integration: IntegrationScheme;
  readonly supports: readonly EditableSupport[];
  readonly loads: readonly EditableLoad[];
  readonly foundations: readonly EditableFoundation[];
}

export const DEFAULT_THERMAL_LOAD: ThermalLoadState = { enabled: false, tRef: 0, tTop: 0, tBottom: 0 };
export const DEFAULT_REBAR: RebarState = { enabled: false, asBottom: 0, asTop: 0, cover: 0.03 };
/** Alapértelmezett rugóállandó [kN/m] új rugós támasz elhelyezésekor. */
export const DEFAULT_SPRING_STIFFNESS = 5000;
/** Alapértelmezett ágyazási tényező [kN/m²] új Winkler-ágyazat elhelyezésekor. */
export const DEFAULT_FOUNDATION_STIFFNESS = 2000;
/** Alapértelmezett intenzitás [kNm/m] új megoszló nyomatékteher elhelyezésekor. */
export const DEFAULT_DISTRIBUTED_MOMENT = 5;

/** Trapéz megoszló teher vagy koncentrált nyomaték — a preset-katalógus `extraLoads` mezője (relatív pozíciókkal). */
export type PresetExtraLoad =
  | { readonly kind: 'moment'; readonly r: number; readonly value: number }
  | { readonly kind: 'distributed'; readonly r1: number; readonly r2: number; readonly q1: number; readonly q2: number };

/** Egy katalógus-preset átalakítása szerkeszthető modellé (a támaszok/terhek a hálóra illesztve). */
export function presetToEditable(
  preset: {
    readonly supports: readonly { readonly r: number; readonly type: SupportType }[];
    readonly q: number;
    readonly p: number;
    readonly xp: number;
    readonly extraLoads?: readonly PresetExtraLoad[];
  },
  presetId: string,
  span: number,
  elementCount: number,
  sectionId: string,
  materialId: string,
  selfWeight: boolean,
  integration: IntegrationScheme,
): EditableModel {
  const supports: EditableSupport[] = preset.supports.map((s) => ({
    id: nextEntityId('S'),
    x: snapToNode(s.r * span, span, elementCount),
    type: s.type,
  }));
  const loads: EditableLoad[] = [];
  if (preset.q > 0) {
    loads.push({ id: nextEntityId('Q'), kind: 'distributed', x1: 0, x2: span, q1: preset.q, q2: preset.q });
  }
  if (preset.p > 0) {
    loads.push({ id: nextEntityId('P'), kind: 'point', x: snapToNode(preset.xp * span, span, elementCount), p: preset.p });
  }
  for (const extra of preset.extraLoads ?? []) {
    if (extra.kind === 'moment') {
      loads.push({ id: nextEntityId('M'), kind: 'moment', x: snapToNode(extra.r * span, span, elementCount), m: extra.value });
    } else {
      loads.push({ id: nextEntityId('Q'), kind: 'distributed', x1: extra.r1 * span, x2: extra.r2 * span, q1: extra.q1, q2: extra.q2 });
    }
  }
  return {
    presetId,
    span,
    elementCount,
    sectionId,
    materialId,
    selfWeight,
    thermalLoad: DEFAULT_THERMAL_LOAD,
    rebar: DEFAULT_REBAR,
    integration,
    supports,
    loads,
    foundations: [],
  };
}

let counter = 0;
/** Új entitás-azonosító — a canvas-interakciókhoz (nem a fem-core LoadId/NodeId). */
export function nextEntityId(prefix: string): string {
  counter += 1;
  return `${prefix}${counter}`;
}

/** Csak tesztekhez: a számláló visszaállítása determinisztikus azonosítókhoz. */
export function resetEntityIds(): void {
  counter = 0;
}

/** A legközelebbi hálócsomópont x koordinátája — a snap-hez. */
export function snapToNode(x: number, span: number, elementCount: number): number {
  const nodeSpacing = span / (2 * elementCount);
  const nodeIndex = Math.round(x / nodeSpacing);
  const clamped = Math.min(Math.max(nodeIndex, 0), 2 * elementCount);
  return clamped * nodeSpacing;
}
