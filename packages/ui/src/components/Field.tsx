import { useEffect, useId, useState } from 'react';

export interface SliderProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
  /** A csúszka mellett megjelenő formázott érték (monospace). */
  readonly display: string;
  readonly disabled?: boolean;
  /**
   * Ha igaz, a formázott érték helyett egy szerkeszthető számmező jelenik meg
   * a csúszka mellett — pontos érték begépeléséhez (felhasználói igény).
   * A `min`/`max` itt is érvényes (a begépelt érték ezekre vágva kerül be).
   */
  readonly editable?: boolean;
}

export function Slider({ label, value, min, max, step, onChange, display, disabled = false, editable = false }: SliderProps): JSX.Element {
  const id = useId();
  return (
    <div className="vem-slider">
      <div style={{ flex: 1, minWidth: 0 }}>
        <label className="vem-field__label" htmlFor={id}>
          {label}
        </label>
        <input
          id={id}
          className="vem-slider__input"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>
      {editable ? (
        <NumberInput value={value} min={min} max={max} step={step} onChange={onChange} disabled={disabled} />
      ) : (
        <div className="vem-slider__value">{display}</div>
      )}
    </div>
  );
}

export interface NumberInputProps {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
  readonly disabled?: boolean;
}

/**
 * A `step` alapján ésszerű tizedesjegy-számot ad (pl. step=0.01 → 2 tizedes,
 * step=100 → egész) — a mértékegység-váltó (2026-09-04) miatt a `value`
 * gyakran egy konverzió eredménye (pl. 30 mm → 1.1811023622047243 in),
 * enélkül a mező csúnya, hosszú tizedesekkel telne meg.
 */
function stepDecimals(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 2;
  return Math.max(0, Math.min(4, Math.ceil(-Math.log10(step))));
}

/**
 * Pontos érték begépelésére szolgáló számmező — a csúszka mellett, azzal
 * kétirányban szinkronban. Szabad gépelést enged (átmenetileg érvénytelen
 * állapot, pl. "23." vagy üres mező) — a tényleges `onChange` csak
 * elfogadható számra, blur-kor/Enterre fut, ekkor a min/max-ra vágva.
 */
export function NumberInput({ value, min, max, step, onChange, disabled = false }: NumberInputProps): JSX.Element {
  const [text, setText] = useState(() => value.toFixed(stepDecimals(step)));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value.toFixed(stepDecimals(step)));
  }, [value, step, focused]);

  const commit = (): void => {
    const parsed = Number(text.replace(',', '.'));
    if (Number.isFinite(parsed)) {
      onChange(Math.min(max, Math.max(min, parsed)));
    } else {
      setText(value.toFixed(stepDecimals(step)));
    }
  };

  return (
    <input
      type="number"
      className="vem-slider__number"
      value={text}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  /**
   * Csoport-címke a natív `<optgroup>`-hoz — ha BÁRMELYIK opciónak van
   * `group`-ja, a `Select` mindet csoportosítva rendereli (a nem
   * csoportosított opciók egy címke nélküli `<optgroup>`-ba kerülnek,
   * hogy a sorrend ne boruljon fel). Ha EGYETLEN opciónak sincs `group`-ja,
   * a lista lapos marad (visszafelé kompatibilis).
   */
  readonly group?: string;
  /** Az `<option>` szövegszíne (CSS-érték, jellemzően `var(--token)`) — pl. a Szelvény/Anyag katalógusnál a típusjelző szín. */
  readonly color?: string;
}

export interface SelectProps {
  readonly options: readonly SelectOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly ariaLabel: string;
  readonly disabled?: boolean;
}

/**
 * Stabil csoportosítás: minden csoport az ELSŐ előfordulásának helyén jelenik
 * meg, a csoporton belüli sorrend az eredeti sorrendet követi. Így a
 * hívó oldalon nem kell előre rendezni az opciókat csoport szerint — elég,
 * ha minden opció megkapja a saját `group`-ját (ld. `data/catalog.ts`).
 */
function groupOptions(options: readonly SelectOption[]): readonly (readonly [string | undefined, readonly SelectOption[]])[] {
  const order: (string | undefined)[] = [];
  const buckets = new Map<string | undefined, SelectOption[]>();
  for (const o of options) {
    if (!buckets.has(o.group)) {
      buckets.set(o.group, []);
      order.push(o.group);
    }
    buckets.get(o.group)?.push(o);
  }
  return order.map((key) => [key, buckets.get(key) ?? []] as const);
}

function OptionEl({ o }: { readonly o: SelectOption }): JSX.Element {
  return (
    <option key={o.value} value={o.value} style={o.color !== undefined ? { color: o.color } : undefined}>
      {o.label}
    </option>
  );
}

export function Select({ options, value, onChange, ariaLabel, disabled = false }: SelectProps): JSX.Element {
  const hasGroups = options.some((o) => o.group !== undefined);
  return (
    <select className="vem-select" value={value} disabled={disabled} aria-label={ariaLabel} onChange={(e) => onChange(e.target.value)}>
      {hasGroups
        ? groupOptions(options).map(([group, groupOptions]) =>
            group === undefined ? (
              groupOptions.map((o) => <OptionEl key={o.value} o={o} />)
            ) : (
              <optgroup key={group} label={group}>
                {groupOptions.map((o) => (
                  <OptionEl key={o.value} o={o} />
                ))}
              </optgroup>
            ),
          )
        : options.map((o) => <OptionEl key={o.value} o={o} />)}
    </select>
  );
}

export interface CheckboxProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

export function Checkbox({ label, checked, onChange }: CheckboxProps): JSX.Element {
  return (
    <label className="vem-checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
