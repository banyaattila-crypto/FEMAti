import { useEffect, useRef, useState } from 'react';

export interface InfoTooltipProps {
  /** A magyarázó szöveg — a korábbi natív `title` attribútum tartalma. */
  readonly text: string;
}

const BUBBLE_MAX_WIDTH = 220;
const VIEWPORT_MARGIN = 8;
/** Becsült buborék-magasság a "felfelé nyíljon-e" döntéshez — a tényleges
 * magasságot csak render UTÁN ismernénk, ez elég a legtöbb 1-3 soros
 * szöveghez, és a döntés hibája legfeljebb néhány pixel átfedést okoz. */
const ESTIMATED_BUBBLE_HEIGHT = 100;

interface BubblePosition {
  readonly left: number;
  /** Az egyiket adjuk meg, sosem mindkettőt — lásd `placement`. */
  readonly top?: number;
  readonly bottom?: number;
}

/**
 * A buborék helyét a KÉPERNYŐHÖZ (nem a szülő panelhez) képest számolja —
 * ez a lényeg: a panelek `overflow: auto`-val görgethetők
 * (`shell/shell.css` `.vem-panel`), egy `position: absolute` buborék ott
 * levágódna a panel szélénél (2026-09-04, felhasználói jelzés: "kilógnak és
 * csak egy része látszik"). `position: fixed` + JS-ből számolt koordináták
 * ezt elkerülik, mert a fixed elem a viewporthoz igazodik, nem a görgethető
 * őshöz.
 */
function computePosition(iconRect: DOMRect): BubblePosition {
  let left = iconRect.left;
  if (left + BUBBLE_MAX_WIDTH + VIEWPORT_MARGIN > window.innerWidth) {
    left = window.innerWidth - BUBBLE_MAX_WIDTH - VIEWPORT_MARGIN;
  }
  if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;

  const fitsBelow = iconRect.bottom + ESTIMATED_BUBBLE_HEIGHT + VIEWPORT_MARGIN <= window.innerHeight;
  if (fitsBelow) {
    return { left, top: iconRect.bottom + 6 };
  }
  return { left, bottom: window.innerHeight - iconRect.top + 6 };
}

/**
 * Kattintható "ⓘ" jelölő — natív `title` (hover) tooltip helyett, mert az
 * felfedezhetetlen (nincs vizuális jele, hogy egy sornak egyáltalán van
 * magyarázata) és érintőképernyőn nem is működik (2026-09-04, felhasználói
 * kérés). Kattintásra egy halvány-sárga, kereteres "sticky note" buborékban
 * jelenik meg a szöveg — a `components/Value.tsx` `ResultRow`-ja használja,
 * bárhol, ahol korábban `title` prop volt megadva, és bármely más helyen is
 * bevezethető, ahol eddig natív `title` magyarázta a felhasználónak, hogyan
 * jött ki egy érték.
 */
export function InfoTooltip({ text }: InfoTooltipProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<BubblePosition | null>(null);
  const iconRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const iconEl = iconRef.current;
    if (iconEl) setPosition(computePosition(iconEl.getBoundingClientRect()));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Görgetéskor/átméretezéskor a kiszámolt pozíció elévülne — a natív
    // böngésző-tooltipekhez hasonlóan inkább bezárjuk, mint hogy rossz
    // helyen maradjon lógva. A `true` (capture) kell, mert a panelek SAJÁT
    // görgetése (`.vem-panel { overflow: auto }`) nem buborékol fel a
    // `window`-ig bubbling fázisban.
    const close = (): void => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onOutsidePointerDown = (e: PointerEvent): void => {
      const target = e.target as Node;
      if (iconRef.current?.contains(target) || bubbleRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onOutsidePointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', onOutsidePointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  return (
    <span className="vem-info-tooltip">
      <button
        ref={iconRef}
        type="button"
        className="vem-info-tooltip__icon"
        aria-label="Magyarázat megjelenítése"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        i
      </button>
      {open && position ? (
        <div ref={bubbleRef} className="vem-info-tooltip__bubble" role="tooltip" style={position}>
          {text}
        </div>
      ) : null}
    </span>
  );
}
