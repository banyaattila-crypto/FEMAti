/**
 * Márkázott (branded) számtípusok a mértékegység-hibák fordítási idejű kiszűrésére.
 *
 * A FEMAti mag KIZÁRÓLAG SI-alapú belső egységekben számol:
 *   hossz [m], erő [kN], nyomaték [kNm], feszültség/merevség [kN/m²].
 *
 * A felhasználói felület a diplomaterv 3. táblázatának egységeit használja
 * (cm², cm⁴, kN/cm², mm); az átváltás kizárólag a `units/convert.ts` modulban
 * történik. Vegyes egységű aritmetika a magban tilos.
 *
 * Forrás: Diplomaterv 3.1.8 pont, 3. táblázat (48. oldal).
 */

declare const brandSymbol: unique symbol;

/** Névleges típus egy primitív fölé. Futásidőben nincs jelen. */
export type Brand<T, B extends string> = T & { readonly [brandSymbol]: B };

// ─── Belső (SI) egységek ──────────────────────────────────────────────────────

/** Hossz [m] */
export type Meter = Brand<number, 'm'>;
/** Terület [m²] */
export type SquareMeter = Brand<number, 'm2'>;
/** Másodrendű nyomaték [m⁴] */
export type QuarticMeter = Brand<number, 'm4'>;
/** Erő [kN] */
export type KiloNewton = Brand<number, 'kN'>;
/** Nyomaték [kNm] */
export type KiloNewtonMeter = Brand<number, 'kNm'>;
/** Feszültség, rugalmassági modulus [kN/m²] */
export type KiloNewtonPerSquareMeter = Brand<number, 'kN/m2'>;
/** Megoszló erő [kN/m] */
export type KiloNewtonPerMeter = Brand<number, 'kN/m'>;
/** Megoszló nyomaték [kNm/m] = [kN] */
export type KiloNewtonMeterPerMeter = Brand<number, 'kNm/m'>;
/** Fajsúly [kN/m³] */
export type KiloNewtonPerCubicMeter = Brand<number, 'kN/m3'>;
/** Görbület [1/m] */
export type PerMeter = Brand<number, '1/m'>;
/** Szög, elfordulás [rad] */
export type Radian = Brand<number, 'rad'>;
/** Hőmérséklet [°C] */
export type Celsius = Brand<number, 'degC'>;
/** Hőtágulási együttható [1/°C] */
export type PerCelsius = Brand<number, '1/degC'>;
/** Sűrűség [kg/m³] */
export type KgPerCubicMeter = Brand<number, 'kg/m3'>;
/** Dimenziótlan (pl. Poisson-tényező, nyírási alaktényező) */
export type Dimensionless = Brand<number, '1'>;

// ─── Konstruktorok ────────────────────────────────────────────────────────────
// Szándékosan explicit függvények: a `as Meter` cast a hívó kódban tilos,
// mert éppen azt a hibát engedné vissza, amit a márkázás megelőz.

const make =
  <T extends number>() =>
  (v: number): T =>
    v as T;

export const m = make<Meter>();
export const m2 = make<SquareMeter>();
export const m4 = make<QuarticMeter>();
export const kN = make<KiloNewton>();
export const kNm = make<KiloNewtonMeter>();
export const kNpm2 = make<KiloNewtonPerSquareMeter>();
export const kNpm = make<KiloNewtonPerMeter>();
export const kNmpm = make<KiloNewtonMeterPerMeter>();
export const kNpm3 = make<KiloNewtonPerCubicMeter>();
export const perM = make<PerMeter>();
export const rad = make<Radian>();
export const degC = make<Celsius>();
export const perDegC = make<PerCelsius>();
export const kgpm3 = make<KgPerCubicMeter>();
export const dimensionless = make<Dimensionless>();

/** Márkázott érték nyers számmá. Csak határfelületen (kimenet, naplózás) használandó. */
export const raw = (v: Brand<number, string>): number => v as number;
