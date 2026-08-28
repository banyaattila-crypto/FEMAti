import { useEffect, useRef, useState } from 'react';

export interface MenuItem {
  readonly label: string;
  readonly onSelect?: () => void;
  readonly disabled?: boolean;
  readonly shortcut?: string;
  readonly separatorAfter?: boolean;
}

export interface Menu {
  readonly label: string;
  readonly items: readonly MenuItem[];
}

export interface MenuBarProps {
  readonly menus: readonly Menu[];
}

/**
 * Menüsáv. Kattintásra nyílik, kívülre kattintva és `Esc`-re záródik
 * (DESIGN-TERV 4.2, 7.3).
 */
export function MenuBar({ menus }: MenuBarProps): JSX.Element {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openIndex === null) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpenIndex(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openIndex]);

  return (
    <div className="vem-menubar" ref={barRef}>
      {menus.map((menu, i) => (
        <div key={menu.label} style={{ position: 'relative' }}>
          <button
            type="button"
            className="vem-menubar__button"
            aria-haspopup="menu"
            aria-expanded={openIndex === i}
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
          >
            {menu.label}
          </button>
          {openIndex === i ? (
            <div className="vem-menu" role="menu" aria-label={menu.label}>
              {menu.items.map((item) => (
                <div key={item.label}>
                  <button
                    type="button"
                    role="menuitem"
                    className="vem-menu__item"
                    disabled={item.disabled === true}
                    onClick={() => {
                      setOpenIndex(null);
                      item.onSelect?.();
                    }}
                  >
                    {item.label}
                    {item.shortcut ? (
                      <span style={{ float: 'right', opacity: 0.6, marginLeft: 16 }}>
                        {item.shortcut}
                      </span>
                    ) : null}
                  </button>
                  {item.separatorAfter === true ? <div className="vem-menu__separator" /> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
      {openIndex !== null ? (
        <div className="vem-menu__scrim" onClick={() => setOpenIndex(null)} aria-hidden="true" />
      ) : null}
    </div>
  );
}
