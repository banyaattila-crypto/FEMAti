/**
 * Böngészős fájl-letöltés kiváltása egy `Blob`-ból.
 *
 * Szándékosan KÜLÖN modulban a `docxExport.ts`-től (publikálás előtti audit,
 * 2026-09-06, PERF-001): a `docxExport.ts` behúzza a `docx` (+ `jszip`)
 * csomagot, ami a bundle egyik legnagyobb darabja. Ez a néhány soros,
 * `docx`-től teljesen független segédfüggvény ugyanabban a modulban ülve
 * megakadályozta volna, hogy a `docx` dinamikus importtal lehasadjon a
 * kezdeti csomagról.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
