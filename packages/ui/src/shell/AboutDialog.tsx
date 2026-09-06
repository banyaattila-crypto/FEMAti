import { Logo } from '../components/Logo.js';
import { useAppStore } from '../state/appStore.js';
import { SHELL } from '../i18n/shell.js';

/**
 * Klasszikus "Névjegy" (About) párbeszédablak — Súgó → Névjegy.
 *
 * A "Súgó → Elmélet → A diplomatervről" oldal a TÖRTÉNETET mondja el
 * részletesen (1996-os BME diplomaterv, Bánya Attila) — ez a dialógus NEM
 * azt ismétli meg, hanem a SZOFTVER JELENLEGI ÁLLAPOTÁT: verziószám, mag-
 * commit, és a diplomatervben nem szereplő, önállóan bővített képességek
 * (ld. memória: `project-femati-scope-pivot`). A logó (`Logo` `variant=
 * "full"`) szándékosan termék-semleges — nincs benne BME/1996 utalás.
 */
export function AboutDialog(): JSX.Element | null {
  const open = useAppStore((s) => s.aboutOpen);
  const setOpen = useAppStore((s) => s.setAboutOpen);
  const t = SHELL[useAppStore((s) => s.lang)];
  if (!open) return null;

  return (
    <div className="vem-inspector-overlay" onPointerDown={() => setOpen(false)}>
      {/* Nincs FIX magasság: a funkciólista idővel nőtt, és a korábbi `height: 460`
          mellett a tartalom (~666 px) túlcsordult — a © sor és a linkek a látható
          terület alá kerültek. Most a tartalomhoz igazodik, a képernyőre korlátozva
          (`.vem-inspector--about` `max-height`), és csak szükség esetén görget. */}
      <div className="vem-inspector vem-inspector--about" style={{ width: 380 }} onPointerDown={(e) => e.stopPropagation()}>
        <div className="vem-inspector__header">
          <span>{t.aboutTitle}</span>
          <button type="button" className="vem-btn vem-btn--sm" onClick={() => setOpen(false)}>
            {t.aboutClose}
          </button>
        </div>
        <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Logo variant="full" theme="dark" size={64} />
          </div>

          <div style={{ textAlign: 'center' }}>
            <div className="vem-num" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
              v{__APP_VERSION__} · mag: {__GIT_COMMIT__}
            </div>
          </div>

          {/* A nyilatkozat SZÁNDÉKOSAN a (hosszú) funkciólista ELŐTT áll: kis
              képernyőn a lista alatti tartalom görgetés mögé kerülne, egy
              felelősség-kizáró nyilatkozat pedig pont akkor ér semmit, ha
              görgetni kell érte. */}
          <div className="vem-about__disclaimer">{t.aboutDisclaimer}</div>

          <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            <p style={{ margin: 0 }}>{t.aboutIntro}</p>
            <ul style={{ margin: 'var(--space-3) 0 0 var(--space-5)', padding: 0 }}>
              {t.aboutFeatures.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>

          <div style={{ fontSize: 12, textAlign: 'center', color: 'var(--text-faint)' }}>
            <div>© 2026 Bánya Attila</div>
            <div style={{ marginTop: 'var(--space-2)' }}>
              <a href="https://github.com/banyaattila-crypto/FEMAti/issues" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                {t.aboutReportIssue}
              </a>
              {' · '}
              <a href="https://github.com/banyaattila-crypto" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                {t.aboutGithubProfile}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
