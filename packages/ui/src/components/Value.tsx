import type { ReactNode } from 'react';
import type { Formatted, Tone } from '../format/numbers.js';
import { InfoTooltip } from './InfoTooltip.js';

export interface ValueDisplayProps {
  readonly formatted: Formatted;
  readonly emphasis?: 'normal' | 'large' | 'hero';
  readonly tone?: Tone;
}

/**
 * Számérték + mértékegység. A DESIGN-TERV 6.1 szerint a kettő MINDIG külön
 * elem: az érték az elsődleges szöveg, az egység tompított — így az egység
 * nem versenyez a számmal.
 */
export function ValueDisplay({ formatted, emphasis = 'normal', tone = 'neutral' }: ValueDisplayProps): JSX.Element {
  const classes = [
    'vem-value',
    emphasis === 'large' ? 'vem-value--large' : '',
    emphasis === 'hero' ? 'vem-value--hero' : '',
    tone !== 'neutral' ? `vem-value--${tone}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes}>
      <span className="vem-value__num">{formatted.value}</span>
      {formatted.unit ? <span className="vem-value__unit">{formatted.unit}</span> : null}
    </span>
  );
}

export interface ResultRowProps {
  readonly label: ReactNode;
  readonly formatted: Formatted;
  readonly tone?: Tone;
  readonly emphasis?: 'normal' | 'large' | 'hero';
  readonly title?: string;
}

/** Az eredménypanelek alap-primitívje: címke balra, érték + egység jobbra. */
export function ResultRow({ label, formatted, tone = 'neutral', emphasis = 'normal', title }: ResultRowProps): JSX.Element {
  return (
    <div className="vem-result-row">
      <span className="vem-result-row__label-group">
        <span className="vem-result-row__label">{label}</span>
        {title ? <InfoTooltip text={title} /> : null}
      </span>
      <span className="vem-result-row__value">
        <ValueDisplay formatted={formatted} tone={tone} emphasis={emphasis} />
      </span>
    </div>
  );
}
