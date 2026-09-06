import { useEffect, useId, useRef, useState } from 'react';

export interface ComboboxOption {
  readonly value: string;
  readonly label: string;
  readonly group?: string;
  /**
   * Valódi ikon-elem (SVG/színes swatch) az opció előtt — a natív
   * `<option>`-nal ellentétben itt tetszőleges React-node megengedett,
   * mert ez a lista maga NEM natív `<select>`, hanem egy saját, letisztult
   * `role="listbox"` widget (ld. a fájl fejléc-kommentjét).
   */
  readonly icon?: JSX.Element;
}

export interface ComboboxProps {
  readonly options: readonly ComboboxOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly ariaLabel: string;
  readonly disabled?: boolean;
}

/** Stabil csoportosítás — ld. `Field.tsx` `groupOptions` (ugyanaz az elv). */
function groupOptions(options: readonly ComboboxOption[]): readonly (readonly [string | undefined, readonly ComboboxOption[]])[] {
  const order: (string | undefined)[] = [];
  const buckets = new Map<string | undefined, ComboboxOption[]>();
  for (const o of options) {
    if (!buckets.has(o.group)) {
      buckets.set(o.group, []);
      order.push(o.group);
    }
    buckets.get(o.group)?.push(o);
  }
  return order.map((key) => [key, buckets.get(key) ?? []] as const);
}

/**
 * Saját, ikonos legördülő lista — a natív `<select>`/`<option>` NEM tud
 * tetszőleges grafikát megjeleníteni (csak szöveget, esetleg `color`-t),
 * ezért egy Unicode-glifás "ikon" mindig szegényes, betűkészlet-függő
 * marad. Ez a komponens ugyanazt az interakciós mintát követi, mint a
 * `MenuBar.tsx` (kattintásra nyílik, `Esc`/kívülre kattintás zár,
 * `.vem-menu__scrim`-hez hasonló átlátszó háttér), de `role="listbox"`
 * szemantikával és nyíl-billentyűs navigációval — ARIA Combobox minta
 * (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) egyszerűsített,
 * csak-választós (nem szabadszavas) változata.
 */
export function Combobox({ options, value, onChange, ariaLabel, disabled = false }: ComboboxProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex];

  useEffect(() => {
    if (open) setHighlighted(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlighted((h) => Math.min(options.length - 1, h + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted((h) => Math.max(0, h - 1));
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const opt = options[highlighted];
        if (opt !== undefined) {
          onChange(opt.value);
          setOpen(false);
          triggerRef.current?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, highlighted, options, onChange]);

  const groups = groupOptions(options);

  return (
    <div className="vem-combobox">
      <button
        ref={triggerRef}
        type="button"
        className="vem-combobox__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="vem-combobox__trigger-icon">{selected?.icon}</span>
        <span className="vem-combobox__trigger-label">{selected?.label ?? ''}</span>
        <span className="vem-combobox__chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <>
          <div id={listId} role="listbox" aria-label={ariaLabel} className="vem-combobox__panel" tabIndex={-1}>
            {groups.map(([group, groupOptions]) => (
              <div key={group ?? '—'}>
                {group !== undefined ? <div className="vem-combobox__group-label">{group}</div> : null}
                {groupOptions.map((o) => {
                  const index = options.indexOf(o);
                  return (
                    <div
                      key={o.value}
                      role="option"
                      aria-selected={o.value === value}
                      className={`vem-combobox__option${index === highlighted ? ' vem-combobox__option--highlighted' : ''}`}
                      onMouseEnter={() => setHighlighted(index)}
                      onClick={() => {
                        onChange(o.value);
                        setOpen(false);
                        triggerRef.current?.focus();
                      }}
                    >
                      <span className="vem-combobox__option-icon">{o.icon}</span>
                      <span className="vem-combobox__option-label">{o.label}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="vem-menu__scrim" onClick={() => setOpen(false)} aria-hidden="true" />
        </>
      ) : null}
    </div>
  );
}
