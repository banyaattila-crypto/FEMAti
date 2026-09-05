/**
 * A mindig látható app-fejléc (`App.tsx` `<header className="vem-chrome">`)
 * és a hozzá tartozó eszközsor felhasználó felé mutatkozó szövegei — a
 * teljes UI i18n (2026-09-05) 0. fázisának mintafájlja, ld. a
 * `theory/TheoryView.tsx`-ben már bevált `Record<Lang, T>`-mintát.
 */
import type { Lang } from '../state/appStore.js';

export interface ShellStrings {
  readonly subtitle: string;
  readonly undoTitle: string;
  readonly undoAria: string;
  readonly redoTitle: string;
  readonly redoAria: string;
  readonly compute: string;
}

export const SHELL: Record<Lang, ShellStrings> = {
  hu: {
    subtitle: 'Timoshenko gerenda · rugalmas–képlékeny végeselemes analízis',
    undoTitle: 'Visszavonás (Ctrl+Z)',
    undoAria: 'Visszavonás',
    redoTitle: 'Újra (Ctrl+Y)',
    redoAria: 'Újra',
    compute: 'SZÁMÍTÁS',
  },
  en: {
    subtitle: 'Timoshenko beam · elastic–plastic finite element analysis',
    undoTitle: 'Undo (Ctrl+Z)',
    undoAria: 'Undo',
    redoTitle: 'Redo (Ctrl+Y)',
    redoAria: 'Redo',
    compute: 'COMPUTE',
  },
};
