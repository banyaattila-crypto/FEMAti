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

/**
 * Teherkategória (2026-09-04, EN 1990 teherkombináció) — az önsúly
 * (`EditableModel.selfWeight`) mindig automatikusan "állandó", ahhoz NEM
 * kell ez a mező, mert szerkezetileg sosem lehet más; ez KIZÁRÓLAG a
 * felhasználó által felvett terhekre vonatkozik. `'variable'` az
 * alapértelmezés új teher felvételekor (a leggyakoribb eset — élő teher,
 * hó stb.), ld. `model/combinations.ts`.
 */
export type LoadCategory = 'permanent' | 'variable';

export interface EditablePointLoad {
  readonly id: string;
  readonly kind: 'point';
  /** Abszolút pozíció [m], hálócsomópontra illesztve. */
  readonly x: number;
  /** Erő [kN], z irányban (lefelé pozitív). */
  readonly p: number;
  readonly category: LoadCategory;
}

/** Koncentrált nyomatékteher [kNm], hálócsomópontra illesztve. */
export interface EditableMomentLoad {
  readonly id: string;
  readonly kind: 'moment';
  readonly x: number;
  readonly m: number;
  readonly category: LoadCategory;
}

export interface EditableDistributedLoad {
  readonly id: string;
  readonly kind: 'distributed';
  readonly x1: number;
  readonly x2: number;
  /** Intenzitás a szakasz elején/végén [kN/m] — q1===q2 esetén egyenletes, egyébként trapéz. */
  readonly q1: number;
  readonly q2: number;
  readonly category: LoadCategory;
}

/** Megoszló nyomatékteher m(x) [kNm/m] — a megoszló erő egyenes párja. */
export interface EditableDistributedMomentLoad {
  readonly id: string;
  readonly kind: 'distributed-moment';
  readonly x1: number;
  readonly x2: number;
  readonly m1: number;
  readonly m2: number;
  readonly category: LoadCategory;
}

export type EditableLoad = EditablePointLoad | EditableMomentLoad | EditableDistributedLoad | EditableDistributedMomentLoad;

/** Winkler-féle rugalmas ágyazat egy szakaszon — NEM `Load`, önálló entitáskategória. */
export interface EditableFoundation {
  readonly id: string;
  readonly x1: number;
  readonly x2: number;
  /** Ágyazási tényező [kN/m²]. */
  readonly c: number;
  /** Ha igaz, az ágyazat csak nyomásra dolgozik — no-tension/no-uplift talaj (ADR-0022). */
  readonly noTension?: boolean;
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

/**
 * Kompozit acél-beton keresztmetszet (2026-09-04) — a keresztmetszet
 * ALAPSZELVÉNYE (`EditableModel.sectionId`/`materialId`, acélnak feltételezve)
 * fölé illesztett betonlemez, teljes (rugalmas) nyírt kapcsolattal. CSAK a
 * lineáris (rugalmas) M/T/w/φ-megoldásra és az SLS lehajlás-ellenőrzésre hat
 * (`model/compile.ts`) — a nemlineáris futtatás (`model/nonlinear.ts`) és a
 * teherbírási ellenőrzések (`model/designChecks.ts`) kompozit szelvényen
 * NINCSENEK támogatva ebben a körben (ld. a terv "hatókör-döntés" szakaszát).
 * KÖLCSÖNÖSEN KIZÁRJA a `RebarState`-et (`panels/LeftPanel.tsx`) — két
 * különböző funkció, ebben a körben nem kombinálhatók.
 */
export interface CompositeState {
  readonly enabled: boolean;
  /** Betonlemez szélessége [m] — az alapszelvény fölött. */
  readonly slabWidth: number;
  /** Betonlemez vastagsága [m]. */
  readonly slabThickness: number;
  readonly slabMaterialId: string;
}

/**
 * Mozgó pontteher — burkolóábra (2026-09-04). A `magnitude` teher
 * VÉGIGSÉTÁL a tartó minden hálócsomópontján (a koncentrált teher ma is
 * csomópontra illeszkedik, ld. a fájl fejléce), a MEGLÉVŐ terhekre
 * SZUPERPONÁLVA — a burkolóábra (`model/envelope.ts`) minden
 * keresztmetszetre a lehetséges legnagyobb/legkisebb M/T-t adja. CSAK a
 * jellemző (nem faktorozott) teherre, a fő M/T diagramokkal PÁRHUZAMOS,
 * ÚJ diagram-fülként (`state/appStore.ts` `DiagramTab` `'envelope'`) —
 * nem érinti az ULS/SLS tervezési ellenőrzéseket.
 */
export interface MovingLoadState {
  readonly enabled: boolean;
  /** A mozgó pontteher nagysága [kN], lefelé pozitív (ua. konvenció, mint `EditablePointLoad.p`). */
  readonly magnitude: number;
}

/**
 * Földrengés — EN 1998-1 FÜGGŐLEGES komponens (2026-09-06). CSAK a
 * függőleges komponens (nagy fesztávú/konzolos/rideg elemet alátámasztó
 * gerendáknál előírt, EC8 4.3.3.5.2) — nincs vízszintes/keret-hatás, ld.
 * `docs/ADR/0023-fuggoleges-foldrenges-kombinacio.md`. A talajosztály a
 * függőleges spektrumot NEM befolyásolja (EC8 3.4. táblázat), ezért itt
 * nincs talajosztály-mező. A viselkedési tényező (qv≤1.5) és a ψ₂ (MVP:
 * egy közös 0.3-as érték) fix konstansok (`model/combinations.ts`), nem
 * felhasználói bemenet — a UI csak azt kéri, amit ténylegesen a régió/
 * épület határoz meg.
 */
export interface SeismicState {
  readonly enabled: boolean;
  /** ag/g — referencia csúcsgyorsulás a gravitációs gyorsulás többszöröseként (pl. 0.15 = "0.15g"). */
  readonly agOverG: number;
  /** Fontossági tényező γI (EN 1998-1 4.2.5). */
  readonly gammaI: number;
  readonly spectrumType: 1 | 2;
}

export interface EditableModel {
  readonly presetId: string;
  /** Fesztáv [m] */
  readonly span: number;
  readonly elementCount: number;
  readonly sectionId: string;
  readonly materialId: string;
  readonly selfWeight: boolean;
  /** Önsúly-szorzó (2026-09-04, ULS/SLS kombináció) — hiányában 1 (`model/compile.ts`). ULS-kombinációnál γG-re skálázva (`model/combinations.ts`), mert az önsúly szerkezetileg mindig "állandó" teher. */
  readonly selfWeightFactor?: number;
  /**
   * Referencia axiális erő [kN] — másodrendű (P-Δ) hatás, 2026-09-04.
   * Pozitív = nyomóerő (csökkenti a hajlítási merevséget), negatív =
   * húzóerő (növeli). `0` = kikapcsolva (nincs külön enabled-mező, ugyanaz
   * a minta, mint `selfWeightFactor`-nál). A modellnek NINCS axiális
   * szabadságfoka — ez egy KÜLSŐLEG megadott, nem "megoldott" mennyiség
   * (ld. `@femati/fem-core` `element/timoshenko3.ts`
   * `elementGeometricStiffness()` fejléce). CSAK a lineáris (rugalmas)
   * megoldásra hat (`model/compile.ts`) — a nemlineáris futtatás
   * (`model/nonlinear.ts`) N≠0 esetén hibát ad.
   */
  readonly axialForce: number;
  readonly thermalLoad: ThermalLoadState;
  readonly rebar: RebarState;
  readonly composite: CompositeState;
  readonly movingLoad: MovingLoadState;
  readonly seismic: SeismicState;
  readonly integration: IntegrationScheme;
  readonly supports: readonly EditableSupport[];
  readonly loads: readonly EditableLoad[];
  readonly foundations: readonly EditableFoundation[];
}

export const DEFAULT_THERMAL_LOAD: ThermalLoadState = { enabled: false, tRef: 0, tTop: 0, tBottom: 0 };
export const DEFAULT_REBAR: RebarState = { enabled: false, asBottom: 0, asTop: 0, cover: 0.03 };
export const DEFAULT_COMPOSITE: CompositeState = { enabled: false, slabWidth: 1.0, slabThickness: 0.1, slabMaterialId: 'C25' };
export const DEFAULT_MOVING_LOAD: MovingLoadState = { enabled: false, magnitude: 10 };
export const DEFAULT_SEISMIC: SeismicState = { enabled: false, agOverG: 0.15, gammaI: 1.0, spectrumType: 1 };
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
    loads.push({ id: nextEntityId('Q'), kind: 'distributed', x1: 0, x2: span, q1: preset.q, q2: preset.q, category: 'variable' });
  }
  if (preset.p > 0) {
    loads.push({ id: nextEntityId('P'), kind: 'point', x: snapToNode(preset.xp * span, span, elementCount), p: preset.p, category: 'variable' });
  }
  for (const extra of preset.extraLoads ?? []) {
    if (extra.kind === 'moment') {
      loads.push({ id: nextEntityId('M'), kind: 'moment', x: snapToNode(extra.r * span, span, elementCount), m: extra.value, category: 'variable' });
    } else {
      loads.push({
        id: nextEntityId('Q'),
        kind: 'distributed',
        x1: extra.r1 * span,
        x2: extra.r2 * span,
        q1: extra.q1,
        q2: extra.q2,
        category: 'variable',
      });
    }
  }
  return {
    presetId,
    span,
    elementCount,
    sectionId,
    materialId,
    selfWeight,
    axialForce: 0,
    thermalLoad: DEFAULT_THERMAL_LOAD,
    rebar: DEFAULT_REBAR,
    composite: DEFAULT_COMPOSITE,
    movingLoad: DEFAULT_MOVING_LOAD,
    seismic: DEFAULT_SEISMIC,
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
