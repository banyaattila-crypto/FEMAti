/**
 * A non-null assertion (`!`) tiltott a repóban (eslint.config.js) — ez a
 * helper adja meg ugyanazt a szűkítést egy explicit, tesztben elbukó
 * hibaüzenettel.
 */
export function mustGet<T>(value: T | undefined, message = 'Váratlanul undefined érték a tesztben.'): T {
  if (value === undefined) {
    throw new Error(message);
  }
  return value;
}
