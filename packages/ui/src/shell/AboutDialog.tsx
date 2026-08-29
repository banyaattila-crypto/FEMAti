import { Logo } from '../components/Logo.js';
import { useAppStore } from '../state/appStore.js';

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
  if (!open) return null;

  return (
    <div className="vem-inspector-overlay" onPointerDown={() => setOpen(false)}>
      <div className="vem-inspector" style={{ width: 320 }} onPointerDown={(e) => e.stopPropagation()}>
        <div className="vem-inspector__header">
          <span>Névjegy</span>
          <button type="button" className="vem-btn vem-btn--sm" onClick={() => setOpen(false)} aria-label="Névjegy bezárása">
            ✕
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

          <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            <p style={{ margin: 0 }}>
              A FEMAti egy Timoshenko-gerenda rugalmas–képlékeny végeselemes analízis szoftver:
            </p>
            <ul style={{ margin: 'var(--space-3) 0 0 var(--space-5)', padding: 0 }}>
              <li>dinamikai analízis — sajátfrekvencia, módalakok, Rayleigh-csillapítás, Newmark-β tranziens válasz</li>
              <li>Cowper-féle, Poisson-tényezőtől függő nyírási korrekciós tényező</li>
              <li>képlékeny hajlítás–nyírás (M-V) interakciós teherbírás-ellenőrzés</li>
            </ul>
          </div>

          <button type="button" className="vem-btn" onClick={() => setOpen(false)}>
            Bezár
          </button>
        </div>
      </div>
    </div>
  );
}
