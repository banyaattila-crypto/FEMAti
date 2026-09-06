/**
 * A `docs/VALIDATION.md` GENERÁLÁSA a validációs esetek eredményeiből.
 *
 * MASTER-PROMPT-TERV 3.3: "A `fem-validation` csomag futása GENERÁLJA a
 * `docs/VALIDATION.md` fájlt... Ez a dokumentum a szoftver mérnöki
 * hitelesítése." — ezért ez a fájl SOSEM kézzel szerkesztett (ld. .gitignore).
 */
import { casePassed, checkError, checkPassed, type ValidationCase } from './types.js';

function formatNumber(n: number): string {
  if (n === 0) return '0';
  if (Math.abs(n) < 1e-4 || Math.abs(n) >= 1e6) return n.toExponential(4);
  return n.toPrecision(8).replace(/0+$/, '').replace(/\.$/, '');
}

export function generateValidationReport(cases: readonly ValidationCase[], generatedAt = new Date()): string {
  const total = cases.reduce((n, c) => n + c.checks.length, 0);
  const failedCases = cases.filter((c) => !casePassed(c));
  const allGreen = failedCases.length === 0;

  const lines: string[] = [];
  lines.push('# VALIDATION — validációs jegyzőkönyv');
  lines.push('');
  lines.push('> **EZ A DOKUMENTUM GENERÁLT** (`pnpm --filter @femati/fem-validation test`),');
  lines.push('> ne szerkeszd kézzel. Forrás: `packages/fem-validation/src/cases/*.ts`.');
  lines.push('');
  // SZÁNDÉKOSAN csak dátum, nem teljes időbélyeg (publikálás előtti audit,
  // 2026-09-06, REL-001): a fájl commitolva van (a README hivatkozik rá), és a
  // másodperc-pontos időbélyeg miatt MINDEN tesztfutás "módosítottnak" mutatta,
  // állandóan piszkos munkafát és tartalom nélküli commitokat okozva. A dátum
  // megtartja a tájékoztató értéket, de egy napon belül stabil marad.
  lines.push(`Generálva: ${generatedAt.toISOString().slice(0, 10)}`);
  lines.push('');
  lines.push(
    `**Összesítés:** ${cases.length} eset, ${total} ellenőrzés, ` + `${allGreen ? 'MIND ZÖLD ✅' : `${failedCases.length} eset ELBUKOTT ❌`}.`,
  );
  lines.push('');

  for (const c of cases) {
    const passed = casePassed(c);
    lines.push(`## ${c.id} — ${c.title} ${passed ? '✅' : '❌'}`);
    lines.push('');
    lines.push(c.description);
    lines.push('');
    lines.push(`*Hivatkozás:* ${c.reference}`);
    lines.push('');
    lines.push('| Ellenőrzés | Referencia | Számított | Hiba | Tűrés | Eredmény |');
    lines.push('|---|---|---|---|---|---|');
    for (const check of c.checks) {
      const err = checkError(check);
      const ok = checkPassed(check);
      const referenceCell =
        check.kind === 'range' && check.range !== undefined
          ? `[${formatNumber(check.range.min)}, ${formatNumber(check.range.max)}]`
          : formatNumber(check.reference);
      const kindLabel = check.kind === 'relative' ? ' (rel.)' : check.kind === 'absolute' ? ' (abs.)' : ' (sávon kívül)';
      const toleranceCell = check.kind === 'range' ? '—' : formatNumber(check.tolerance);
      lines.push(
        `| ${check.label} | ${referenceCell} | ${formatNumber(check.computed)} | ` +
          `${formatNumber(err)}${kindLabel} | ${toleranceCell} | ${ok ? 'OK' : 'HIBA'} |`,
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}
