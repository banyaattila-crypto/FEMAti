/**
 * Mértékegység-átváltás a felhasználói (diplomaterv 3. táblázat) és a belső
 * SI-alapú egységek között. Ez a projekt EGYETLEN helye, ahol átváltás történik.
 *
 * Diplomaterv 3.1.8, 3. táblázat (48. oldal):
 *   Hossz L [m] · Terület A [cm²] · Inercia I [cm⁴] · Erő F,T [kN]
 *   Nyomaték M [kNm] · Megoszló erő q [kN/m] · Megoszló nyomaték m [kNm/m]
 *   Rugalmassági modulus E [kN/cm²] · Nyírási modulus G [kN/cm²]
 *   Szög φ [rad] · Hőmérséklet T [°C] · Sűrűség ρ [kg/m³]
 *   Fajsúly γ [kN/m³] · Hőtágulási együttható α [1/°C] · Eltolódás e [mm]
 */

import {
  kgpm3,
  kNpm2,
  kNpm3,
  m,
  m2,
  m4,
  type KiloNewtonPerCubicMeter,
  type KiloNewtonPerSquareMeter,
  type KgPerCubicMeter,
  type Meter,
  type QuarticMeter,
  type SquareMeter,
} from './brands.js';

/** Nehézségi gyorsulás [m/s²] — a sűrűség → fajsúly átváltáshoz. */
export const G_ACCEL = 9.80665;

// ─── Bemenet: felhasználói egység → belső SI ──────────────────────────────────

/** Keresztmetszeti terület [cm²] → [m²] */
export const areaFromCm2 = (aCm2: number): SquareMeter => m2(aCm2 * 1e-4);

/** Másodrendű nyomaték [cm⁴] → [m⁴] */
export const inertiaFromCm4 = (iCm4: number): QuarticMeter => m4(iCm4 * 1e-8);

/** Rugalmassági / nyírási modulus [kN/cm²] → [kN/m²] */
export const modulusFromKNPerCm2 = (eKNcm2: number): KiloNewtonPerSquareMeter => kNpm2(eKNcm2 * 1e4);

/** Eltolódás [mm] → [m] */
export const lengthFromMm = (mm: number): Meter => m(mm * 1e-3);

/** Hossz [cm] → [m] (rétegméretekhez) */
export const lengthFromCm = (cm: number): Meter => m(cm * 1e-2);

/** Sűrűség [kg/m³] → fajsúly [kN/m³]. 1 kg·g = 9.80665 N = 9.80665e-3 kN. */
export const specificWeightFromDensity = (rhoKgM3: number): KiloNewtonPerCubicMeter => kNpm3((rhoKgM3 * G_ACCEL) / 1000);

// ─── Kimenet: belső SI → megjelenítési egység ─────────────────────────────────

/** [m²] → [cm²] */
export const areaToCm2 = (a: SquareMeter): number => (a as number) * 1e4;

/** [m⁴] → [cm⁴] */
export const inertiaToCm4 = (i: QuarticMeter): number => (i as number) * 1e8;

/** [kN/m²] → [kN/cm²] */
export const modulusToKNPerCm2 = (e: KiloNewtonPerSquareMeter): number => (e as number) * 1e-4;

/** [m] → [mm] — az eltolódás megjelenítési egysége a 3. táblázat szerint. */
export const lengthToMm = (v: Meter): number => (v as number) * 1e3;

/** [m] → [cm] */
export const lengthToCm = (v: Meter): number => (v as number) * 1e2;

/** [rad] → [°] */
export const radToDeg = (r: number): number => (r * 180) / Math.PI;

/** [°] → [rad] */
export const degToRad = (d: number): number => (d * Math.PI) / 180;

/** Fajsúly [kN/m³] → sűrűség [kg/m³] */
export const densityFromSpecificWeight = (gamma: KiloNewtonPerCubicMeter): KgPerCubicMeter => kgpm3(((gamma as number) * 1000) / G_ACCEL);
