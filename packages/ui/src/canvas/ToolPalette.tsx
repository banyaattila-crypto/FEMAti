import { SegmentedControl } from '../components/Button.js';
import { LoadIcon, SupportIcon } from '../panels/icons.js';

export type CanvasTool =
  | 'select'
  | 'add-fixed'
  | 'add-pinned'
  | 'add-roller'
  | 'add-point-load'
  | 'add-moment-load'
  | 'add-distributed-load';

const SUPPORT_TOOLS: readonly CanvasTool[] = ['add-fixed', 'add-pinned', 'add-roller'];
const LOAD_TOOLS: readonly CanvasTool[] = ['add-point-load', 'add-moment-load', 'add-distributed-load'];

export interface ToolPaletteProps {
  readonly tool: CanvasTool;
  readonly onChange: (tool: CanvasTool) => void;
}

/**
 * Kijelölés/vászon mód váltó — a felső eszközsorban marad (DESIGN-TERV
 * 7.2). A támasz- és teher-eszközök (korábban itt, egy sorban) mostantól
 * a `SupportToolsPanel`/`LoadToolsPanel` LEBEGŐ paneleken vannak, közvetlenül
 * a vászon fölött — felhasználói kérésre: "a modell létrehozásánál lévő
 * terhekre és támaszokra... 2 lebegő panelre csoportosítani".
 */
export function ToolPalette({ tool, onChange }: ToolPaletteProps): JSX.Element {
  return (
    <SegmentedControl
      ariaLabel="Kijelölés / vászon mód"
      value={SUPPORT_TOOLS.includes(tool) || LOAD_TOOLS.includes(tool) ? ('' as CanvasTool) : tool}
      onChange={onChange}
      options={[{ value: 'select', label: 'Kijelölés', title: 'Kattintás: kijelölés · húzás: áthelyezés' }]}
    />
  );
}

interface FloatingToolButtonProps {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly title: string;
  readonly icon: JSX.Element;
}

/** Csak ikon (szöveg nélkül) — a `title` adja a hozzáférhető nevet/tooltipet. */
function FloatingToolButton({ active, onClick, title, icon }: FloatingToolButtonProps): JSX.Element {
  return (
    <button type="button" className="vem-floating-panel__btn" aria-pressed={active} aria-label={title} onClick={onClick} title={title}>
      {icon}
    </button>
  );
}

/** Lebegő panel a vászon bal felső sarkában — új támasz elhelyezésének eszközei. */
export function SupportToolsPanel({ tool, onChange }: ToolPaletteProps): JSX.Element {
  return (
    <div className="vem-floating-panel vem-floating-panel--supports" aria-label="Támasz eszközök">
      <FloatingToolButton
        active={tool === 'add-pinned'}
        onClick={() => onChange('add-pinned')}
        title="Csuklós támasz elhelyezése kattintással"
        icon={<SupportIcon type="pinned" />}
      />
      <FloatingToolButton
        active={tool === 'add-roller'}
        onClick={() => onChange('add-roller')}
        title="Görgős támasz elhelyezése kattintással"
        icon={<SupportIcon type="roller" />}
      />
      <FloatingToolButton
        active={tool === 'add-fixed'}
        onClick={() => onChange('add-fixed')}
        title="Befogás elhelyezése kattintással"
        icon={<SupportIcon type="fixed" />}
      />
    </div>
  );
}

/** Lebegő panel a vászon jobb felső sarkában — új teher elhelyezésének eszközei. */
export function LoadToolsPanel({ tool, onChange }: ToolPaletteProps): JSX.Element {
  return (
    <div className="vem-floating-panel vem-floating-panel--loads" aria-label="Teher eszközök">
      <FloatingToolButton
        active={tool === 'add-point-load'}
        onClick={() => onChange('add-point-load')}
        title="Koncentrált erő elhelyezése kattintással"
        icon={<LoadIcon kind="point" />}
      />
      <FloatingToolButton
        active={tool === 'add-moment-load'}
        onClick={() => onChange('add-moment-load')}
        title="Koncentrált nyomaték elhelyezése kattintással"
        icon={<LoadIcon kind="moment" />}
      />
      <FloatingToolButton
        active={tool === 'add-distributed-load'}
        onClick={() => onChange('add-distributed-load')}
        title="Megoszló teher rajzolása húzással (trapéz alakra a kijelölt teher panelén szerkeszthető)"
        icon={<LoadIcon kind="distributed" />}
      />
    </div>
  );
}
