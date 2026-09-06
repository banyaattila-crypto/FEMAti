import { SegmentedControl } from '../components/Button.js';
import { useAppStore } from '../state/appStore.js';
import { CANVAS } from '../i18n/canvas.js';

export type CanvasTool =
  | 'select'
  | 'add-fixed'
  | 'add-pinned'
  | 'add-roller'
  | 'add-spring'
  | 'add-foundation'
  | 'add-point-load'
  | 'add-moment-load'
  | 'add-distributed-load'
  | 'add-distributed-moment-load';

export const SUPPORT_TOOLS: readonly CanvasTool[] = ['add-fixed', 'add-pinned', 'add-roller', 'add-spring', 'add-foundation'];
export const LOAD_TOOLS: readonly CanvasTool[] = ['add-point-load', 'add-moment-load', 'add-distributed-load', 'add-distributed-moment-load'];

export interface ToolPaletteProps {
  readonly tool: CanvasTool;
  readonly onChange: (tool: CanvasTool) => void;
}

/**
 * Kijelölés/vászon mód váltó — a felső eszközsorban marad (DESIGN-TERV
 * 7.2). A támasz- és teher-elhelyező ikongombok (korábban a vászon fölötti
 * lebegő paneleken, 2026-08-30 előtt) mostantól a felső Toolbar "Terhek"/
 * "Támaszok" fülén vannak (`shell/ToolRibbon.tsx`) — felhasználói kérésre,
 * az Axis3D-mintájú fül+ikonsor elrendezés alapján.
 */
export function ToolPalette({ tool, onChange }: ToolPaletteProps): JSX.Element {
  const t = CANVAS[useAppStore((s) => s.lang)];
  return (
    <SegmentedControl
      ariaLabel={t.selectModeAria}
      value={SUPPORT_TOOLS.includes(tool) || LOAD_TOOLS.includes(tool) ? ('' as CanvasTool) : tool}
      onChange={onChange}
      options={[{ value: 'select', label: t.selectToolLabel, title: t.selectToolTitle }]}
    />
  );
}
