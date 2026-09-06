import type { CSSProperties, ReactNode } from 'react';

export type SolverStatus = 'idle' | 'editing' | 'running' | 'converged' | 'limit-load' | 'diverged' | 'error';

export interface StatusPillProps {
  readonly status: SolverStatus;
  /** A `status` felhasználó felé mutatkozó felirata — a hívó adja (i18n/shell.ts `statusLabels`), a komponens maga nem tudhat UI-nyelvet. */
  readonly label: string;
  /** Kiegészítő szöveg, pl. „iteráció 3 / lépés 7". */
  readonly detail?: string;
}

/**
 * A megoldó állapota. A DESIGN-TERV 6.3 tiltja, hogy iterációs limitet elért
 * futás „sikeresnek" látsszon — ezért a `limit-load` és `diverged` külön
 * állapot, saját színnel és szöveggel.
 */
export function StatusPill({ status, label, detail }: StatusPillProps): JSX.Element {
  const cls = status === 'editing' ? 'idle' : status;
  return (
    <span className={`vem-status vem-status--${cls}`} role="status" aria-live={status === 'error' || status === 'diverged' ? 'assertive' : 'polite'}>
      <span className="vem-status__dot" aria-hidden="true" />
      {label}
      {detail ? ` · ${detail}` : ''}
    </span>
  );
}

export interface NoteBoxProps {
  readonly children: ReactNode;
  readonly tone?: 'info' | 'warn' | 'error';
}

export function NoteBox({ children, tone = 'info' }: NoteBoxProps): JSX.Element {
  const cls = tone === 'info' ? 'vem-note' : `vem-note vem-note--${tone}`;
  return <div className={cls}>{children}</div>;
}

export interface LegendItem {
  readonly label: string;
  readonly fill: string;
  readonly stroke: string;
  /** Mintázat a színvakság-tartalékhoz (DESIGN-TERV 2.2). */
  readonly pattern?: 'solid' | 'hatch' | 'cross';
}

export interface LegendProps {
  readonly items: readonly LegendItem[];
}

export function Legend({ items }: LegendProps): JSX.Element {
  return (
    <div className="vem-legend">
      {items.map((it) => (
        <span className="vem-legend__item" key={it.label}>
          <span
            className="vem-legend__swatch"
            style={{
              background: it.fill,
              borderColor: it.stroke,
              backgroundImage:
                it.pattern === 'hatch'
                  ? `repeating-linear-gradient(45deg, transparent 0 2px, ${it.stroke} 2px 3px)`
                  : it.pattern === 'cross'
                    ? `repeating-linear-gradient(45deg, transparent 0 2px, ${it.stroke} 2px 3px),` +
                      `repeating-linear-gradient(-45deg, transparent 0 2px, ${it.stroke} 2px 3px)`
                    : 'none',
            }}
            aria-hidden="true"
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export interface SectionLabelProps {
  readonly children: ReactNode;
}

export function SectionLabel({ children }: SectionLabelProps): JSX.Element {
  return <div className="vem-section-label">{children}</div>;
}

export type CardAccent = 'support' | 'foundation' | 'load' | 'section' | 'solver' | 'results';

export interface CardProps {
  readonly title: ReactNode;
  readonly children: ReactNode;
  /** Jelentéshordozó családi szín (`--fam-*`, `tokens.css`) — kihagyva a kártya semleges marad. */
  readonly accent?: CardAccent;
}

/**
 * Önálló, emelt felületű szekció-blokk (2026-08-29 újratervezés) — a bal/
 * jobb panel korábbi, közvetlenül a panel hátterén úszó lista-sorai helyett
 * minden logikai csoport (Modellfa, Eredmények stb.) saját kártyát kap,
 * hogy vizuálisan is elkülönüljön.
 */
export function Card({ title, children, accent }: CardProps): JSX.Element {
  const style = accent ? ({ '--card-accent': `var(--fam-${accent})` } as CSSProperties & Record<string, string>) : undefined;
  return (
    <section className={accent ? 'vem-card vem-card--accent' : 'vem-card'} style={style}>
      <SectionLabel>{title}</SectionLabel>
      <div className="vem-card__body">{children}</div>
    </section>
  );
}
