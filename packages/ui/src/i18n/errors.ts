/**
 * A `model/fileIO.ts` `ModelFileErrorInfo`-jának (nyelv-semleges kód +
 * paraméterek) felhasználó felé mutatkozó szöveggé formázása — a teljes UI
 * i18n (2026-09-05) 3. fázisa. Szándékosan KÜLÖN a `ModelFileError.message`
 * belső, magyar-only szövegétől (`model/fileIO.ts` saját formázója): az
 * adatréteg nem tudhat UI-nyelvet, ezért ott csak egy visszamenőlegesen
 * kompatibilis alapértelmezés marad, a TÉNYLEGESEN megjelenő szöveget innen,
 * a felület aktuális nyelve alapján kapja (`App.tsx`).
 */
import type { Lang } from '../state/appStore.js';
import type { ModelFileErrorInfo } from '../model/fileIO.js';

interface ErrorStrings {
  readonly invalidJson: string;
  readonly unsupportedFormatVersion: (expected: number, got: unknown) => string;
  readonly missingOrNotObject: (where: string) => string;
  readonly notArray: (where: string) => string;
  readonly missingOrNotNumber: (where: string, key: string) => string;
  readonly notNumber: (where: string, key: string) => string;
  readonly missingOrNotString: (where: string, key: string) => string;
  readonly missingOrNotBoolean: (where: string, key: string) => string;
  readonly notBoolean: (where: string, key: string) => string;
  readonly invalidEnumValue: (where: string, key: string, value: string) => string;
  readonly unknownSupportType: (where: string, value: string) => string;
  readonly unknownLoadCategory: (where: string, value: string) => string;
  readonly unknownLoadKind: (where: string, value: string) => string;
}

const ERRORS: Record<Lang, ErrorStrings> = {
  hu: {
    invalidJson: 'A fájl nem érvényes JSON.',
    unsupportedFormatVersion: (expected, got) =>
      `Ismeretlen vagy nem támogatott .femati.json formátum-verzió (várt: ${String(expected)}, kapott: ${String(got)}). ` +
      'Ez a fájl vagy nem a FEMAti szerkesztőből származik, vagy egy újabb verzióból.',
    missingOrNotObject: (where) => `${where}: hiányzik vagy nem objektum.`,
    notArray: (where) => `${where}: nem tömb.`,
    missingOrNotNumber: (where, key) => `${where}: "${key}" hiányzik vagy nem (véges) szám.`,
    notNumber: (where, key) => `${where}: "${key}" nem (véges) szám.`,
    missingOrNotString: (where, key) => `${where}: "${key}" hiányzik vagy nem szöveg.`,
    missingOrNotBoolean: (where, key) => `${where}: "${key}" hiányzik vagy nem logikai érték.`,
    notBoolean: (where, key) => `${where}: "${key}" nem logikai érték.`,
    invalidEnumValue: (where, key, value) => `${where}: érvénytelen "${key}" érték "${value}".`,
    unknownSupportType: (where, value) => `${where}: ismeretlen támasztípus "${value}".`,
    unknownLoadCategory: (where, value) => `${where}: ismeretlen teherkategória "${value}".`,
    unknownLoadKind: (where, value) => `${where}: ismeretlen tehertípus "${value}".`,
  },
  en: {
    invalidJson: 'The file is not valid JSON.',
    unsupportedFormatVersion: (expected, got) =>
      `Unknown or unsupported .femati.json format version (expected: ${String(expected)}, got: ${String(got)}). ` +
      'This file either did not come from the FEMAti editor, or is from a newer version.',
    missingOrNotObject: (where) => `${where}: missing, or not an object.`,
    notArray: (where) => `${where}: not an array.`,
    missingOrNotNumber: (where, key) => `${where}: "${key}" is missing or not a (finite) number.`,
    notNumber: (where, key) => `${where}: "${key}" is not a (finite) number.`,
    missingOrNotString: (where, key) => `${where}: "${key}" is missing or not a string.`,
    missingOrNotBoolean: (where, key) => `${where}: "${key}" is missing or not a boolean.`,
    notBoolean: (where, key) => `${where}: "${key}" is not a boolean.`,
    invalidEnumValue: (where, key, value) => `${where}: invalid "${key}" value "${value}".`,
    unknownSupportType: (where, value) => `${where}: unknown support type "${value}".`,
    unknownLoadCategory: (where, value) => `${where}: unknown load category "${value}".`,
    unknownLoadKind: (where, value) => `${where}: unknown load kind "${value}".`,
  },
};

/** `ModelFileErrorInfo` → a felület aktuális nyelvén megjelenítendő szöveg. */
export function formatModelFileError(info: ModelFileErrorInfo, lang: Lang): string {
  const t = ERRORS[lang];
  switch (info.code) {
    case 'invalid-json':
      return t.invalidJson;
    case 'unsupported-format-version':
      return t.unsupportedFormatVersion(info.expected, info.got);
    case 'missing-or-not-object':
      return t.missingOrNotObject(info.where);
    case 'not-array':
      return t.notArray(info.where);
    case 'missing-or-not-number':
      return t.missingOrNotNumber(info.where, info.key);
    case 'not-number':
      return t.notNumber(info.where, info.key);
    case 'missing-or-not-string':
      return t.missingOrNotString(info.where, info.key);
    case 'missing-or-not-boolean':
      return t.missingOrNotBoolean(info.where, info.key);
    case 'not-boolean':
      return t.notBoolean(info.where, info.key);
    case 'invalid-enum-value':
      return t.invalidEnumValue(info.where, info.key, info.value);
    case 'unknown-support-type':
      return t.unknownSupportType(info.where, info.value);
    case 'unknown-load-category':
      return t.unknownLoadCategory(info.where, info.value);
    case 'unknown-load-kind':
      return t.unknownLoadKind(info.where, info.value);
  }
}
