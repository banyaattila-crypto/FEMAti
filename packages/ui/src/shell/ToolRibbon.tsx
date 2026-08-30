/**
 * Terhek/Támaszok fül a felső Toolbar alatt — Axis3D-mintájú, típusonként
 * színes ikonsor (2026-08-30, felhasználói kérés: "hasonlóképpen akár
 * színesben is a menüpontok alá kerüljenek: terhek, támaszok. Több
 * tehertípust és több támasztípust is szeretnék."). Felváltja a vászon
 * fölötti lebegő `SupportToolsPanel`/`LoadToolsPanel` paneleket
 * (`canvas/ToolPalette.tsx` korábbi verziója) — a `CanvasTool`
 * állapot (`state/appStore.ts` `canvasTool`) MEGEGYEZIK azzal, amit a
 * `ModelCanvas` interakciós logikája olvas, ezért az ikonok kattintása
 * pontosan ugyanazt az elhelyezési módot indítja, mint korábban.
 */
import { useState, type ReactNode } from 'react';
import { FOUNDATION_COLOR, LOAD_COLOR, SUPPORT_COLOR } from '../canvas/marks.js';
import type { CanvasTool } from '../canvas/ToolPalette.js';
import { useAppStore } from '../state/appStore.js';

type RibbonTab = 'loads' | 'supports';

interface ToolDef {
  readonly tool: CanvasTool;
  readonly label: string;
  readonly title: string;
  readonly icon: JSX.Element;
}

function Icon({ color, children }: { readonly color: string; readonly children: ReactNode }): JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" stroke={color} fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const LOAD_TOOL_DEFS: readonly ToolDef[] = [
  {
    tool: 'add-point-load',
    label: 'Pontteher',
    title: 'Koncentrált erő elhelyezése kattintással',
    icon: (
      <Icon color={LOAD_COLOR.point}>
        <line x1="10" y1="2" x2="10" y2="14" />
        <path d="M10 18 L6.5 12 L13.5 12 Z" fill={LOAD_COLOR.point} stroke="none" />
      </Icon>
    ),
  },
  {
    tool: 'add-moment-load',
    label: 'Nyomatékteher',
    title: 'Koncentrált nyomaték elhelyezése kattintással',
    icon: (
      <Icon color={LOAD_COLOR.moment}>
        <path d="M16 7 A7 7 0 1 1 9 1" />
        <path d="M16 7 L17.3 2.5 L12.8 4.3 Z" fill={LOAD_COLOR.moment} stroke="none" />
      </Icon>
    ),
  },
  {
    tool: 'add-distributed-load',
    label: 'Megoszló teher',
    title: 'Megoszló teher rajzolása húzással (trapéz alakra a kijelölt teher panelén szerkeszthető)',
    icon: (
      <Icon color={LOAD_COLOR.distributed}>
        <line x1="2" y1="3" x2="18" y2="3" />
        {[3, 10, 17].map((x) => (
          <g key={x}>
            <line x1={x} y1="3" x2={x} y2="13" />
            <path d={`M${x} 16 L${x - 2.3} 11.5 L${x + 2.3} 11.5 Z`} fill={LOAD_COLOR.distributed} stroke="none" />
          </g>
        ))}
      </Icon>
    ),
  },
  {
    tool: 'add-distributed-moment-load',
    label: 'Megoszló nyomaték',
    title: 'Megoszló nyomatékteher rajzolása húzással',
    icon: (
      <Icon color={LOAD_COLOR['distributed-moment']}>
        {[3, 10, 17].map((x) => (
          <path key={x} d={`M${x + 3} 8 A3 3 0 1 1 ${x} 5`} />
        ))}
      </Icon>
    ),
  },
];

const SUPPORT_TOOL_DEFS: readonly ToolDef[] = [
  {
    tool: 'add-pinned',
    label: 'Csuklós',
    title: 'Csuklós támasz elhelyezése kattintással',
    icon: (
      <Icon color={SUPPORT_COLOR.pinned}>
        <path d="M10 2 L17 15 L3 15 Z" />
        <line x1="3" y1="17" x2="17" y2="17" />
      </Icon>
    ),
  },
  {
    tool: 'add-roller',
    label: 'Görgős',
    title: 'Görgős támasz elhelyezése kattintással',
    icon: (
      <Icon color={SUPPORT_COLOR.roller}>
        <path d="M10 2 L17 15 L3 15 Z" />
        <circle cx="6.5" cy="17" r="1.6" fill={SUPPORT_COLOR.roller} stroke="none" />
        <circle cx="13.5" cy="17" r="1.6" fill={SUPPORT_COLOR.roller} stroke="none" />
      </Icon>
    ),
  },
  {
    tool: 'add-fixed',
    label: 'Befogás',
    title: 'Befogás elhelyezése kattintással',
    icon: (
      <Icon color={SUPPORT_COLOR.fixed}>
        <line x1="6" y1="1" x2="6" y2="19" strokeWidth="2.2" />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1="6" y1={2 + i * 5} x2="1.5" y2={6 + i * 5} />
        ))}
      </Icon>
    ),
  },
  {
    tool: 'add-spring',
    label: 'Rugós',
    title: 'Rugós támasz elhelyezése kattintással',
    icon: (
      <Icon color={SUPPORT_COLOR.spring}>
        <polyline points="10,1 13.5,4 6.5,7 13.5,10 6.5,13 13.5,16 10,19" />
      </Icon>
    ),
  },
  {
    tool: 'add-foundation',
    label: 'Ágyazás',
    title: 'Winkler-féle rugalmas ágyazat rajzolása húzással',
    icon: (
      <Icon color={FOUNDATION_COLOR}>
        <line x1="2" y1="6" x2="18" y2="6" strokeWidth="1.8" />
        {[2, 6, 10, 14, 18].map((x) => (
          <line key={x} x1={x} y1="6" x2={x - 3} y2="16" />
        ))}
      </Icon>
    ),
  },
];

function RibbonButton({ def, active, onClick }: { readonly def: ToolDef; readonly active: boolean; readonly onClick: () => void }): JSX.Element {
  return (
    <button type="button" className="vem-ribbon__btn" aria-pressed={active} onClick={onClick} title={def.title}>
      {def.icon}
      <span className="vem-ribbon__btn-label">{def.label}</span>
    </button>
  );
}

/** A Toolbar alatti "Terhek"/"Támaszok" fül + típusonkénti ikonsor. */
export function ToolRibbon(): JSX.Element {
  const tool = useAppStore((s) => s.canvasTool);
  const setTool = useAppStore((s) => s.setCanvasTool);
  const activeIsLoad = LOAD_TOOL_DEFS.some((d) => d.tool === tool);
  const activeIsSupport = SUPPORT_TOOL_DEFS.some((d) => d.tool === tool);
  const [manualTab, setManualTab] = useState<RibbonTab>('loads');
  const activeTab: RibbonTab = activeIsLoad ? 'loads' : activeIsSupport ? 'supports' : manualTab;

  const defs = activeTab === 'loads' ? LOAD_TOOL_DEFS : SUPPORT_TOOL_DEFS;

  return (
    <div className="vem-ribbon">
      <div className="vem-ribbon__tabs" role="tablist" aria-label="Terhek / Támaszok">
        <button
          type="button"
          role="tab"
          className="vem-tab"
          aria-selected={activeTab === 'loads'}
          onClick={() => setManualTab('loads')}
        >
          Terhek
        </button>
        <button
          type="button"
          role="tab"
          className="vem-tab"
          aria-selected={activeTab === 'supports'}
          onClick={() => setManualTab('supports')}
        >
          Támaszok
        </button>
      </div>
      <div className="vem-ribbon__tools" role="group" aria-label={activeTab === 'loads' ? 'Teher-eszközök' : 'Támasz-eszközök'}>
        {defs.map((def) => (
          <RibbonButton key={def.tool} def={def} active={tool === def.tool} onClick={() => setTool(tool === def.tool ? 'select' : def.tool)} />
        ))}
      </div>
    </div>
  );
}
