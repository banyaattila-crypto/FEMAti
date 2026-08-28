/**
 * Független numerikus integrátor (összetett Simpson-szabály, sok osztással) —
 * KIZÁRÓLAG tesztekhez, a megoszló terhek redukciójának ellenőrzésére.
 *
 * Szándékosan NEM a mag Gauss-kvadratúráját használja (HIBATURESI-POLITIKA
 * 2. pont: két független út egyezése), így önmagában is bizonyítja, hogy a
 * FEM-redukció eredménye a teher valódi integráljával egyezik, nem csak a
 * mag saját belső konzisztenciájával.
 */
export function simpson(f: (x: number) => number, a: number, b: number, n = 2000): number {
  const intervals = n % 2 === 0 ? n : n + 1;
  const h = (b - a) / intervals;
  let sum = f(a) + f(b);
  for (let i = 1; i < intervals; i++) {
    const x = a + i * h;
    sum += (i % 2 === 0 ? 2 : 4) * f(x);
  }
  return (sum * h) / 3;
}
