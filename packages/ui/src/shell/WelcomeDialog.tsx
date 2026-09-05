import { useAppStore } from '../state/appStore.js';
import { SHELL } from '../i18n/shell.js';

/**
 * "Kezdő lépések" üdvözlő kártya — első látogatáskor automatikusan
 * megjelenik (`state/appStore.ts` `welcomeOpen`/`hasSeenWelcome`,
 * `localStorage`-ban jelölve), utána Súgó → "Kezdő lépések" menüből
 * bármikor újra előhívható.
 *
 * A felület (bal panel: Modellfa/Támaszok/Ágyazások/Terhek/Keresztmetszet/
 * Megoldó; jobb panel: Eredmények/Reakciók/Határteher-ellenőrzés; a
 * diagram-sáv 8 füllel) egy külső, első alkalommal érkező felhasználónak
 * zsúfoltnak tűnhet — ez a kártya NEM próbálja elrejteni ezt a
 * összetettséget (az a szakma velejárója), csak egy rövid tájékozódási
 * pontot ad, MIELŐTT a felhasználó szembesül vele (2026-09-04, felhasználói
 * kérés). Szándékosan statikus és rövid, nem egy interaktív, elemekre
 * rámutató "spotlight" tour — az egy külön, jövőbeli lépés lehet, ha ez
 * segít.
 *
 * Ugyanaz a szerkezet, mint az `AboutDialog.tsx`-é — nincs szükség új
 * overlay-CSS-re.
 */
export function WelcomeDialog(): JSX.Element | null {
  const open = useAppStore((s) => s.welcomeOpen);
  const setOpen = useAppStore((s) => s.setWelcomeOpen);
  const t = SHELL[useAppStore((s) => s.lang)];
  if (!open) return null;

  return (
    <div className="vem-inspector-overlay" onPointerDown={() => setOpen(false)}>
      <div className="vem-inspector" style={{ width: 400 }} onPointerDown={(e) => e.stopPropagation()}>
        <div className="vem-inspector__header">
          <span>{t.welcomeTitle}</span>
          <button type="button" className="vem-btn vem-btn--sm" onClick={() => setOpen(false)} aria-label={t.welcomeCloseAria}>
            ✕
          </button>
        </div>
        <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{t.welcomeIntro}</p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {t.welcomeBullets.map((b) => (
              <li key={b.strong} style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{b.strong}</strong> — {b.text}
              </li>
            ))}
          </ul>
          <button type="button" className="vem-btn vem-btn--primary" onClick={() => setOpen(false)}>
            {t.welcomeCta}
          </button>
        </div>
      </div>
    </div>
  );
}
