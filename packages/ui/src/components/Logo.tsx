import { useId } from 'react';
import { JET_LEGEND_STOPS, jetColor } from '../charts/colormap.js';

/**
 * FEMAti márkajel — "csomóponti-V" koncepció: egy lehajlott gerenda-görbe
 * végeselem-csomópontokkal, ami egyszerre idézi a Timoshenko-gerenda
 * lehajlását és a végeselemes diszkretizációt, alakja "V"-ként (FEMAti
 * kezdőbetűje) is olvasható.
 *
 * 2026-08-29 újratervezés: a görbe a `charts/colormap.ts` hőtérkép-
 * skáláját kapta (ugyanaz, mint a diagramokon/3D feszültségképen — "a szín
 * az adaton legyen, ne a kereten" elv, ld. ADR-jegyzetek), a korábbi
 * szaggatott alapvonal ELTÁVOLÍTVA (folyó-keresztmetszetre hasonlított).
 *
 * `variant="mark"`: kis méretű, csak a görbe (fejléc, favicon).
 * `variant="full"`: a görbe + "FEM@ti" felirat (Spectral szerif, teal „@").
 *
 * KORÁBBAN a `full` változat egy "BME · 1996" plakettet is tartalmazott —
 * a projekt 2026-08-29-i döntése (a diplomaterv-hűség keretének tudatos
 * elhagyása, ld. memória: `project-femati-scope-pivot`) után ez a logóból
 * ELTÁVOLÍTVA: a márkajel mostantól termék-semleges. A történeti eredet
 * (BME, 1996, Bánya Attila) továbbra is olvasható a "Súgó → Elmélet → A
 * diplomatervről" oldal szövegében — csak a logó-asszetben nem él tovább.
 */
interface LogoProps {
  readonly variant: 'mark' | 'full';
  readonly theme: 'dark' | 'light';
  readonly size?: number;
}

export function Logo({ variant, theme, size }: LogoProps): JSX.Element {
  const gradientId = `vem-logo-heat-${useId()}`;
  const endDot = theme === 'dark' ? 'var(--accent-light)' : 'var(--accent)';
  const peakDot = jetColor(1);

  const gradient = (
    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
      {JET_LEGEND_STOPS.map(([t, c]) => (
        <stop key={t} offset={`${t * 100}%`} stopColor={c} />
      ))}
    </linearGradient>
  );

  if (variant === 'mark') {
    const s = size ?? 20;
    return (
      <svg width={s} height={s} viewBox="18 24 94 54" role="img" aria-label="FEMAti">
        <defs>{gradient}</defs>
        <path
          d="M27 34 C 47 34, 43 66, 65 66 C 87 66, 83 34, 103 34"
          stroke={`url(#${gradientId})`}
          strokeWidth="5.5"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="27" cy="34" r="5" fill={endDot} />
        <circle cx="65" cy="66" r="6.5" fill={peakDot} />
        <circle cx="103" cy="34" r="5" fill={endDot} />
      </svg>
    );
  }

  const s = size ?? 110;
  return (
    <svg width={s} height={(s * 82) / 100} viewBox="16 22 100 82" role="img" aria-label="FEM@ti">
      <defs>{gradient}</defs>
      <path
        d="M27 34 C 47 34, 43 66, 65 66 C 87 66, 83 34, 103 34"
        stroke={`url(#${gradientId})`}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="27" cy="34" r="4.5" fill={endDot} />
      <circle cx="65" cy="66" r="6" fill={peakDot} />
      <circle cx="103" cy="34" r="4.5" fill={endDot} />
      <text x="65" y="92" textAnchor="middle" fontFamily="var(--font-serif)" fontSize="19" fontWeight="700" fill="var(--text-primary)">
        FEM<tspan fill="var(--accent)">@</tspan>ti
      </text>
    </svg>
  );
}
