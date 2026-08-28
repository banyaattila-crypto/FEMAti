import type { ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps {
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly variant?: ButtonVariant;
  readonly size?: 'md' | 'sm';
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly title?: string;
  readonly type?: 'button' | 'submit';
  /** Csak akkor kell, ha a gomb tartalma NEM olvasható szöveg (pl. ikon-glifa) — ld. `docs/UI-CONVENTIONS.md`. */
  readonly ariaLabel?: string;
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  loading = false,
  title,
  type = 'button',
  ariaLabel,
}: ButtonProps): JSX.Element {
  const classes = [
    'vem-btn',
    variant === 'primary' ? 'vem-btn--primary' : '',
    variant === 'ghost' ? 'vem-btn--ghost' : '',
    size === 'sm' ? 'vem-btn--sm' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      aria-label={ariaLabel}
      aria-busy={loading}
    >
      {loading ? <span className="vem-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly title?: string;
}

export interface SegmentedControlProps<T extends string> {
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly ariaLabel: string;
}

/**
 * Kizáró választás. A DESIGN-TERV 4.1 szerint az aktív szegmens akcentus
 * háttérrel jelenik meg; a választás állapotát `aria-pressed` közli.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>): JSX.Element {
  return (
    <div className="vem-segmented" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="vem-segmented__item"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          title={o.title}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
