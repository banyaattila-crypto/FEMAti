/**
 * FEMAti — rugalmas-képlékeny Timoshenko gerenda végeselemes mag.
 *
 * Bánya Attila: "Rugalmas–képlékeny anyagú gerendaszerkezetek numerikus
 * vizsgálata a végeselemes módszer segítségével", BME Építőmérnöki Kar,
 * Mechanika Tanszék, 1996. Konzulens: dr. Bojtár Imre.
 *
 * A csomag tiszta TypeScript, nulla UI- és DOM-függéssel.
 */

export * from './units/index.js';
export * from './model/index.js';
export * from './linalg/index.js';
export * from './section/properties.js';
export * from './element/index.js';
export * from './diagnostics/selfCheck.js';
export * from './assembly/index.js';
export * from './solver/index.js';
export * from './post/index.js';
export * from './material/index.js';
export * from './derivation/index.js';
