/**
 * Kis (16×16) jelölő ikonok a Támaszok/Terhek panel listasoraihoz — a
 * `canvas/marks.tsx` vászon-jeleivel AZONOS színnel (`--sem-support`/
 * `--sem-load`), de tömör, listasor-méretű formában.
 */
import type { SupportType } from '../model/editable.js';
import type { EditableLoad } from '../model/editable.js';

const SUPPORT = 'var(--sem-support)';
const LOAD = 'var(--sem-load)';

export function SupportIcon({ type }: { readonly type: SupportType }): JSX.Element {
  if (type === 'fixed') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <line x1="4" y1="1" x2="4" y2="15" stroke={SUPPORT} strokeWidth="1.6" />
        <line x1="4" y1="2.5" x2="1" y2="5" stroke={SUPPORT} strokeWidth="1" />
        <line x1="4" y1="7" x2="1" y2="9.5" stroke={SUPPORT} strokeWidth="1" />
        <line x1="4" y1="11.5" x2="1" y2="14" stroke={SUPPORT} strokeWidth="1" />
      </svg>
    );
  }
  if (type === 'roller') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 2 L14 12 L2 12 Z" fill="none" stroke={SUPPORT} strokeWidth="1.4" strokeLinejoin="round" />
        <circle cx="5" cy="14.2" r="1.1" fill={SUPPORT} />
        <circle cx="11" cy="14.2" r="1.1" fill={SUPPORT} />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2 L14 12 L2 12 Z" fill="none" stroke={SUPPORT} strokeWidth="1.4" strokeLinejoin="round" />
      <line x1="2" y1="14" x2="14" y2="14" stroke={SUPPORT} strokeWidth="1.4" />
    </svg>
  );
}

export function LoadIcon({ kind }: { readonly kind: EditableLoad['kind'] }): JSX.Element {
  if (kind === 'point') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <line x1="8" y1="1" x2="8" y2="12" stroke={LOAD} strokeWidth="1.6" />
        <path d="M8 15 L5 10 L11 10 Z" fill={LOAD} />
      </svg>
    );
  }
  if (kind === 'moment') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M13 5 A6 6 0 1 1 8 2" fill="none" stroke={LOAD} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M13 5 L14 1.5 L10.5 3 Z" fill={LOAD} />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <line x1="2" y1="3" x2="14" y2="3" stroke={LOAD} strokeWidth="1.2" />
      {[3, 8, 13].map((x) => (
        <g key={x}>
          <line x1={x} y1="3" x2={x} y2="11" stroke={LOAD} strokeWidth="1.3" />
          <path d={`M${x} 13.5 L${x - 2} 10 L${x + 2} 10 Z`} fill={LOAD} />
        </g>
      ))}
    </svg>
  );
}
