/**
 * FEMAti márkajel — a felhasználóval közösen kiválasztott "csomóponti-V"
 * koncepció: egy lehajlott gerenda-görbe végeselem-csomópontokkal, ami
 * egyszerre idézi a Timoshenko-gerenda lehajlását és a végeselemes
 * diszkretizációt, és alakja "V"-ként (FEMAti kezdőbetűje) is olvasható.
 *
 * `variant="mark"`: kis méretű, csak a görbe (fejléc, favicon).
 * `variant="full"`: a BME · 1996 plakettel kiegészítve (nagyobb felület,
 * pl. a "Súgó → A diplomatervről" oldal fejléce).
 */
interface LogoProps {
  readonly variant: 'mark' | 'full';
  readonly theme: 'dark' | 'light';
  readonly size?: number;
}

export function Logo({ variant, theme, size }: LogoProps): JSX.Element {
  const line = theme === 'dark' ? 'var(--text-on-chrome-muted)' : 'var(--border-medium)';
  const curve = theme === 'dark' ? 'var(--accent-light)' : 'var(--accent)';
  const dot = theme === 'dark' ? 'var(--accent-light)' : 'var(--accent-hover)';
  const plaqueBg = 'var(--surface-chrome)';
  const plaqueText = 'var(--text-on-chrome)';
  const dateText = theme === 'dark' ? 'var(--text-on-chrome-muted)' : 'var(--text-faint)';

  if (variant === 'mark') {
    const s = size ?? 20;
    return (
      <svg width={s} height={s} viewBox="18 24 94 54" role="img" aria-label="FEMAti">
        <path d="M27 34 L103 34" stroke={line} strokeWidth="1.6" strokeDasharray="3 3" fill="none" />
        <path
          d="M27 34 C 47 34, 43 66, 65 66 C 87 66, 83 34, 103 34"
          stroke={curve}
          strokeWidth="5.5"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="27" cy="34" r="5" fill={dot} />
        <circle cx="65" cy="66" r="6.5" fill={dot} />
        <circle cx="103" cy="34" r="5" fill={dot} />
      </svg>
    );
  }

  const s = size ?? 110;
  return (
    <svg width={s} height={(s * 108) / 130} viewBox="0 0 130 108" role="img" aria-label="FEMAti — BME, 1996">
      <path d="M27 34 L103 34" stroke={line} strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
      <path
        d="M27 34 C 47 34, 43 66, 65 66 C 87 66, 83 34, 103 34"
        stroke={curve}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="27" cy="34" r="4.5" fill={dot} />
      <circle cx="65" cy="66" r="6" fill={dot} />
      <circle cx="103" cy="34" r="4.5" fill={dot} />
      <rect x="24" y="86" width="36" height="18" rx="3" fill={plaqueBg} />
      <text
        x="42"
        y="98.5"
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize="9.5"
        fontWeight="600"
        fill={plaqueText}
        letterSpacing="0.5"
      >
        BME
      </text>
      <text x="66" y="98.5" fontFamily="var(--font-mono)" fontSize="9.5" fontWeight="500" fill={dateText}>
        · 1996
      </text>
    </svg>
  );
}
