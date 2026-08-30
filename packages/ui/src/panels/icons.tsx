/**
 * Kis (16×16) jelölő ikonok a Támaszok/Terhek panel listasoraihoz — a
 * `canvas/marks.tsx` vászon-jeleivel AZONOS, típusonkénti színnel
 * (`SUPPORT_COLOR`/`LOAD_COLOR`), de tömör, listasor-méretű formában.
 */
import type { SupportType } from '../model/editable.js';
import type { EditableLoad } from '../model/editable.js';
import { LOAD_COLOR, SUPPORT_COLOR } from '../canvas/marks.js';

export function SupportIcon({ type }: { readonly type: SupportType }): JSX.Element {
  const color = SUPPORT_COLOR[type];
  if (type === 'fixed') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <line x1="4" y1="1" x2="4" y2="15" stroke={color} strokeWidth="1.6" />
        <line x1="4" y1="2.5" x2="1" y2="5" stroke={color} strokeWidth="1" />
        <line x1="4" y1="7" x2="1" y2="9.5" stroke={color} strokeWidth="1" />
        <line x1="4" y1="11.5" x2="1" y2="14" stroke={color} strokeWidth="1" />
      </svg>
    );
  }
  if (type === 'roller') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 2 L14 12 L2 12 Z" fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
        <circle cx="5" cy="14.2" r="1.1" fill={color} />
        <circle cx="11" cy="14.2" r="1.1" fill={color} />
      </svg>
    );
  }
  if (type === 'spring') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <polyline points="8,1 11,4 5,6 11,8 5,10 11,12 8,15" fill="none" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2 L14 12 L2 12 Z" fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <line x1="2" y1="14" x2="14" y2="14" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}

export function LoadIcon({ kind }: { readonly kind: EditableLoad['kind'] }): JSX.Element {
  if (kind === 'point') {
    const color = LOAD_COLOR.point;
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <line x1="8" y1="1" x2="8" y2="12" stroke={color} strokeWidth="1.6" />
        <path d="M8 15 L5 10 L11 10 Z" fill={color} />
      </svg>
    );
  }
  if (kind === 'moment') {
    const color = LOAD_COLOR.moment;
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M13 5 A6 6 0 1 1 8 2" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M13 5 L14 1.5 L10.5 3 Z" fill={color} />
      </svg>
    );
  }
  if (kind === 'distributed-moment') {
    const color = LOAD_COLOR['distributed-moment'];
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        {[3, 8, 13].map((x) => (
          <path key={x} d={`M${x + 2.5} 5 A2.5 2.5 0 1 1 ${x} 2.5`} fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        ))}
      </svg>
    );
  }
  const color = LOAD_COLOR.distributed;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <line x1="2" y1="3" x2="14" y2="3" stroke={color} strokeWidth="1.2" />
      {[3, 8, 13].map((x) => (
        <g key={x}>
          <line x1={x} y1="3" x2={x} y2="11" stroke={color} strokeWidth="1.3" />
          <path d={`M${x} 13.5 L${x - 2} 10 L${x + 2} 10 Z`} fill={color} />
        </g>
      ))}
    </svg>
  );
}
