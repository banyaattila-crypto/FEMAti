/**
 * Modellvászon — DESIGN-TERV.md 5. fejezet + 7.2 (#5–6: húzásos szerkesztés).
 *
 * A vászon a `modelStore`-t rajzolja ÉS szerkeszti: támasz elhelyezése/
 * áthúzása, teher elhelyezése/rajzolása húzással, kijelölés, törlés,
 * zoom/pan. A deformált alakot és a Gauss-pontokat CSAK akkor rajzolja, ha
 * VAN érvényes számítási eredmény (DESIGN-TERV 1.7: „a felület nem számol").
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { findMaterial, findSection } from '../data/catalog.js';
import { useModelStore, type Selection } from '../state/modelStore.js';
import { useAppStore } from '../state/appStore.js';
import { useNonlinearStore } from '../state/nonlinearStore.js';
import { useLiveResult } from '../solve/useLiveResult.js';
import { DEFAULT_DISTRIBUTED_MOMENT, DEFAULT_FOUNDATION_STIFFNESS, DEFAULT_SPRING_STIFFNESS, snapToNode, type SupportType } from '../model/editable.js';
import { combinedSteps, elementPlasticity, nodalDisplacements } from '../model/nonlinear.js';
import {
  CanvasDefs,
  DistributedLoad,
  DistributedMomentLoad,
  Foundation,
  GaussPointMark,
  MomentLoad,
  NodeMark,
  PlasticZoneBar,
  PointLoad,
  SupportMark,
} from './marks.js';
import { ToolPalette } from './ToolPalette.js';
import {
  AXIS_X0,
  AXIS_X1,
  AXIS_Y as AXIS_Y_BASE,
  VIEW_HEIGHT as VIEW_HEIGHT_BASE,
  VIEW_WIDTH,
  createModelTransform,
} from './useModelTransform.js';
import * as fmt from '../format/numbers.js';

/** A GAUSS_3 (STRESS_POINTS) lokális koordinátái — `element/quadrature.ts`-sel egyező sorrendben. */
const GAUSS_XI: readonly [number, number, number] = [-Math.sqrt(0.6), 0, Math.sqrt(0.6)];

const DEFAULT_POINT_LOAD = 20; // kN
const DEFAULT_DISTRIBUTED_LOAD = 15; // kN/m
const DEFAULT_MOMENT_LOAD = 20; // kNm
const MIN_SCALE = 0.5;
const MAX_SCALE = 6;

interface Camera {
  readonly scale: number;
  readonly tx: number;
  readonly ty: number;
}

const IDLE_CAMERA: Camera = { scale: 1, tx: 0, ty: 0 };

type DragState =
  | { readonly kind: 'pan'; readonly startClientX: number; readonly startClientY: number; readonly origin: Camera }
  | { readonly kind: 'move-support'; readonly id: string }
  | { readonly kind: 'move-load'; readonly id: string; readonly originX: number }
  | { readonly kind: 'move-foundation'; readonly id: string; readonly originX: number }
  | { readonly kind: 'draw-distributed'; readonly x1: number; readonly x2: number }
  | { readonly kind: 'draw-distributed-moment'; readonly x1: number; readonly x2: number }
  | { readonly kind: 'draw-foundation'; readonly x1: number; readonly x2: number };

export function ModelCanvas(): JSX.Element {
  const model = useModelStore((s) => s.model);
  const selection = useModelStore((s) => s.selection);
  const select = useModelStore((s) => s.select);
  const addSupport = useModelStore((s) => s.addSupport);
  const moveSupport = useModelStore((s) => s.moveSupport);
  const addPointLoad = useModelStore((s) => s.addPointLoad);
  const addMomentLoad = useModelStore((s) => s.addMomentLoad);
  const addDistributedLoad = useModelStore((s) => s.addDistributedLoad);
  const addDistributedMomentLoad = useModelStore((s) => s.addDistributedMomentLoad);
  const addFoundation = useModelStore((s) => s.addFoundation);
  const moveLoad = useModelStore((s) => s.moveLoad);
  const moveFoundation = useModelStore((s) => s.moveFoundation);
  const removeSelected = useModelStore((s) => s.removeSelected);

  const section = findSection(model.sectionId);
  const material = findMaterial(model.materialId);
  const { result, error } = useLiveResult(model);

  const nonlinearRun = useNonlinearStore((s) => s.run);
  const activeStep = useAppStore((s) => s.activeStep);
  const showGaussPoints = useAppStore((s) => s.showGaussPoints);
  const showReactions = useAppStore((s) => s.showReactions);
  const setShowReactions = useAppStore((s) => s.setShowReactions);
  const inspector = useAppStore((s) => s.inspector);
  const openInspector = useAppStore((s) => s.openInspector);
  const currentNonlinearStep = nonlinearRun ? combinedSteps(nonlinearRun)[activeStep] : undefined;

  const tool = useAppStore((s) => s.canvasTool);
  const setTool = useAppStore((s) => s.setCanvasTool);
  const [camera, setCamera] = useState<Camera>(IDLE_CAMERA);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [previewX, setPreviewX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // A vászon TELJESEN kitöltse a rendelkezésre álló helyet (felhasználói
  // visszajelzés) — a viewBox magassága a konténer tényleges méretarányát
  // követi, hogy az "xMidYMid meet" ne hagyjon üres sávot. A tengely és a
  // rétegek relatív (a base-arányhoz képesti) függőleges pozíciója változatlan
  // marad, csak a teljes rajzterület nő/csökken vele arányosan.
  const [viewH, setViewH] = useState<number>(VIEW_HEIGHT_BASE);
  useEffect(() => {
    const svg = svgRef.current;
    if (svg === null) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setViewH(Math.max(240, (VIEW_WIDTH * height) / width));
      }
    });
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);
  const axisY = (AXIS_Y_BASE / VIEW_HEIGHT_BASE) * viewH;

  const nonlinearNodalW = nonlinearRun && currentNonlinearStep
    ? nodalDisplacements(nonlinearRun.system, currentNonlinearStep.u)
    : null;
  const nonlinearMaxW = nonlinearNodalW
    ? nonlinearNodalW.reduce((m, n) => Math.max(m, Math.abs(n.w)), 0)
    : 0;

  const t = createModelTransform({
    span: model.span,
    axisY,
    ...(nonlinearNodalW
      ? { maxDeflection: Math.max(nonlinearMaxW, 1e-9) }
      : result
        ? { maxDeflection: Math.max(Math.abs(result.extremes.w.value), 1e-9) }
        : {}),
  });

  /** Kliens (képernyő) koordináta → tartalom-térbeli (kamera ELŐTTI) viewBox koordináta. */
  const toContent = useCallback(
    (clientX: number, clientY: number): { readonly x: number; readonly y: number } | null => {
      const svg = svgRef.current;
      if (svg === null) return null;
      const ctm = svg.getScreenCTM();
      if (ctm === null) return null;
      const inv = ctm.inverse();
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const svgPt = pt.matrixTransform(inv);
      return { x: (svgPt.x - camera.tx) / camera.scale, y: (svgPt.y - camera.ty) / camera.scale };
    },
    [camera],
  );

  const toMeters = useCallback(
    (contentX: number): number => ((contentX - AXIS_X0) / (AXIS_X1 - AXIS_X0)) * model.span,
    [model.span],
  );

  const clampMeters = useCallback((x: number): number => Math.min(Math.max(x, 0), model.span), [model.span]);

  // ─── Zoom/pan ────────────────────────────────────────────────────────────
  const onWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>): void => {
      e.preventDefault();
      const svg = svgRef.current;
      if (svg === null) return;
      const ctm = svg.getScreenCTM();
      if (ctm === null) return;
      const inv = ctm.inverse();
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const p = pt.matrixTransform(inv);
      setCamera((c) => {
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, c.scale * factor));
        const tx = p.x - (nextScale / c.scale) * (p.x - c.tx);
        const ty = p.y - (nextScale / c.scale) * (p.y - c.ty);
        return { scale: nextScale, tx, ty };
      });
    },
    [],
  );

  const resetView = useCallback(() => setCamera(IDLE_CAMERA), []);

  /** Nagyítás/kicsinyítés a vászon közepére rögzítve (gombos vezérlés — a görgő-zoom mellett). */
  const zoomBy = useCallback((factor: number) => {
    setCamera((c) => {
      const cx = VIEW_WIDTH / 2;
      const cy = viewH / 2;
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, c.scale * factor));
      const tx = cx - (nextScale / c.scale) * (cx - c.tx);
      const ty = cy - (nextScale / c.scale) * (cy - c.ty);
      return { scale: nextScale, tx, ty };
    });
  }, [viewH]);

  // ─── Kattintás/húzás a háttéren (üres tartón) ───────────────────────────
  const onBackgroundPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>): void => {
      const p = toContent(e.clientX, e.clientY);
      if (p === null) return;

      if (tool === 'select') {
        select(null);
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag({ kind: 'pan', startClientX: e.clientX, startClientY: e.clientY, origin: camera });
        return;
      }

      const xMeters = clampMeters(toMeters(p.x));
      if (tool === 'add-fixed' || tool === 'add-pinned' || tool === 'add-roller') {
        const type: SupportType = tool === 'add-fixed' ? 'fixed' : tool === 'add-pinned' ? 'pinned' : 'roller';
        addSupport(xMeters, type);
        setTool('select');
        return;
      }
      if (tool === 'add-spring') {
        addSupport(xMeters, 'spring', DEFAULT_SPRING_STIFFNESS);
        setTool('select');
        return;
      }
      if (tool === 'add-point-load') {
        addPointLoad(xMeters, DEFAULT_POINT_LOAD);
        setTool('select');
        return;
      }
      if (tool === 'add-moment-load') {
        addMomentLoad(xMeters, DEFAULT_MOMENT_LOAD);
        setTool('select');
        return;
      }
      if (tool === 'add-distributed-load') {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag({ kind: 'draw-distributed', x1: xMeters, x2: xMeters });
        return;
      }
      if (tool === 'add-distributed-moment-load') {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag({ kind: 'draw-distributed-moment', x1: xMeters, x2: xMeters });
        return;
      }
      if (tool === 'add-foundation') {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag({ kind: 'draw-foundation', x1: xMeters, x2: xMeters });
      }
    },
    [tool, toContent, toMeters, clampMeters, camera, select, addSupport, addPointLoad, addMomentLoad, setTool],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>): void => {
      if (drag === null) return;
      if (drag.kind === 'pan') {
        const svg = svgRef.current;
        const ctm = svg?.getScreenCTM();
        const scaleFactor = ctm ? ctm.a : 1; // kliens px → viewBox egység
        const dx = (e.clientX - drag.startClientX) / (scaleFactor || 1);
        const dy = (e.clientY - drag.startClientY) / (scaleFactor || 1);
        setCamera({ scale: drag.origin.scale, tx: drag.origin.tx + dx, ty: drag.origin.ty + dy });
        return;
      }
      const p = toContent(e.clientX, e.clientY);
      if (p === null) return;
      const xMeters = clampMeters(toMeters(p.x));

      if (drag.kind === 'move-support' || drag.kind === 'move-load' || drag.kind === 'move-foundation') {
        // Élő előnézet — a tényleges modellmódosítás csak elengedéskor történik
        // (DESIGN-TERV 7.2 #5: „húzás közben előnézet, elengedéskor számítás").
        setPreviewX(xMeters);
      } else if (drag.kind === 'draw-distributed') {
        setDrag({ kind: 'draw-distributed', x1: drag.x1, x2: xMeters });
      } else if (drag.kind === 'draw-distributed-moment') {
        setDrag({ kind: 'draw-distributed-moment', x1: drag.x1, x2: xMeters });
      } else if (drag.kind === 'draw-foundation') {
        setDrag({ kind: 'draw-foundation', x1: drag.x1, x2: xMeters });
      }
    },
    [drag, toContent, toMeters, clampMeters],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>): void => {
      if (drag === null) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      if (drag.kind === 'move-support' && previewX !== null) {
        moveSupport(drag.id, previewX);
      } else if (drag.kind === 'move-load' && previewX !== null) {
        moveLoad(drag.id, previewX - drag.originX);
      } else if (drag.kind === 'move-foundation' && previewX !== null) {
        moveFoundation(drag.id, previewX - drag.originX);
      } else if (drag.kind === 'draw-distributed') {
        addDistributedLoad(drag.x1, drag.x2, DEFAULT_DISTRIBUTED_LOAD, DEFAULT_DISTRIBUTED_LOAD);
        setTool('select');
      } else if (drag.kind === 'draw-distributed-moment') {
        addDistributedMomentLoad(drag.x1, drag.x2, DEFAULT_DISTRIBUTED_MOMENT, DEFAULT_DISTRIBUTED_MOMENT);
        setTool('select');
      } else if (drag.kind === 'draw-foundation') {
        addFoundation(drag.x1, drag.x2, DEFAULT_FOUNDATION_STIFFNESS);
        setTool('select');
      }
      setDrag(null);
      setPreviewX(null);
    },
    [drag, previewX, moveSupport, moveLoad, moveFoundation, addDistributedLoad, addDistributedMomentLoad, addFoundation, setTool],
  );

  const startSupportDrag = useCallback(
    (e: React.PointerEvent, id: string): void => {
      if (tool !== 'select') return;
      e.stopPropagation();
      select({ kind: 'support', id });
      svgRef.current?.setPointerCapture(e.pointerId);
      setDrag({ kind: 'move-support', id });
    },
    [tool, select],
  );

  const startLoadDrag = useCallback(
    (e: React.PointerEvent, id: string, originX: number): void => {
      if (tool !== 'select') return;
      e.stopPropagation();
      select({ kind: 'load', id });
      svgRef.current?.setPointerCapture(e.pointerId);
      setDrag({ kind: 'move-load', id, originX });
    },
    [tool, select],
  );

  const startFoundationDrag = useCallback(
    (e: React.PointerEvent, id: string, originX: number): void => {
      if (tool !== 'select') return;
      e.stopPropagation();
      select({ kind: 'foundation', id });
      svgRef.current?.setPointerCapture(e.pointerId);
      setDrag({ kind: 'move-foundation', id, originX });
    },
    [tool, select],
  );

  const isSelected = (sel: Selection): boolean =>
    selection !== null && selection.kind === sel.kind && selection.id === sel.id;

  const elementBoundaries = Array.from({ length: model.elementCount + 1 }, (_, i) =>
    t.sx((i * model.span) / model.elementCount),
  );

  const deformedNodes = nonlinearNodalW ?? result?.nodes ?? null;
  const deformedPath = deformedNodes
    ? deformedNodes.map((n, i) => `${i === 0 ? 'M' : 'L'}${t.sx(n.x).toFixed(2)},${t.sy(n.w).toFixed(2)}`).join(' ')
    : null;
  // Átmenetes ("shaded") kitöltés a lehajlási görbe alatt — a tengely és a
  // görbe közti sáv törtvonala, az akcentus-gradienssel zárva (a design-
  // referencia hero-illusztrációjának "beam glow" hatása).
  const firstDeformedNode = deformedNodes?.[0];
  const lastDeformedNode = deformedNodes?.[deformedNodes.length - 1];
  const deformedFillPath =
    deformedPath && firstDeformedNode && lastDeformedNode
      ? `${deformedPath} L${t.sx(lastDeformedNode.x).toFixed(2)},${axisY.toFixed(2)} ` +
        `L${t.sx(firstDeformedNode.x).toFixed(2)},${axisY.toFixed(2)} Z`
      : null;

  // ─── P13: képlékeny zónák elemenként + Gauss-pontok (kattintható, az
  // inspektor belépési pontja) — csak akkor, ha VAN nemlineáris eredmény.
  const preparedElements = nonlinearRun?.system.elements ?? [];
  const plasticZones =
    currentNonlinearStep !== undefined
      ? preparedElements.map((e) => ({
          elementId: e.id,
          x1: t.sx(e.nodeX[0]),
          x2: t.sx(e.nodeX[2]),
          kind: elementPlasticity(currentNonlinearStep, e.id),
        }))
      : [];

  const gaussMarks =
    showGaussPoints && currentNonlinearStep !== undefined
      ? preparedElements.flatMap((e) => {
          const state = currentNonlinearStep.states.get(e.id);
          return GAUSS_XI.map((xi, gpIndex) => {
            const xMeters = e.nodeX[1] + (xi * (e.nodeX[2] - e.nodeX[0])) / 2;
            const gp = state?.gaussPoints[gpIndex];
            const yielded = gp !== undefined && (gp.kind === 'resultant' ? gp.state.yielded : gp.layers.some((l) => l.yielded));
            return {
              key: `${e.id}#${gpIndex}`,
              elementId: e.id,
              gaussIndex: gpIndex as 0 | 1 | 2,
              x: t.sx(xMeters),
              xMeters,
              yielded,
            };
          });
        })
      : [];

  const ariaLabel =
    `${fmt.length(model.span).value} m fesztáv, ${section.name} keresztmetszet, ${model.elementCount} végeselem, ` +
    `${model.supports.length} támasz, ${model.loads.length} teher. ` +
    (result ? 'Van érvényes számítási eredmény.' : error ? `Hiba: ${error}` : 'Számítási eredmény még nincs.') +
    ` Vászon-eszköz: ${tool}.`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          padding: '4px var(--space-6)',
          flex: 'none',
        }}
      >
        <ToolPalette tool={tool} onChange={setTool} />
        <button type="button" className="vem-btn vem-btn--sm" onClick={() => zoomBy(1 / 1.3)} title="Kicsinyítés" aria-label="Kicsinyítés">
          −
        </button>
        <button type="button" className="vem-btn vem-btn--sm" onClick={() => zoomBy(1.3)} title="Nagyítás" aria-label="Nagyítás">
          +
        </button>
        <button type="button" className="vem-btn vem-btn--sm" onClick={resetView} title="Nézet visszaállítása (Ctrl+0)">
          Nézet visszaáll.
        </button>
        <button
          type="button"
          className="vem-btn vem-btn--sm"
          onClick={removeSelected}
          disabled={selection === null}
          title="A kijelölt elem törlése (Delete)"
        >
          Törlés
        </button>
        <button
          type="button"
          className="vem-btn vem-btn--sm"
          aria-pressed={showReactions}
          onClick={() => setShowReactions(!showReactions)}
          title="Reakcióerők ki/be kapcsolása a vásznon"
        >
          Reakciók
        </button>
      </div>
      {/* Koordináta-tengely jelző (2026-09-04, felhasználói kérés) — KÜLÖN,
          fix pixelméretű SVG, a `.vem-canvas-host` jobb felső sarkába
          horgonyozva (`.vem-axis-indicator`, `shell.css`) — TUDATOSAN nem a
          lenti fő vászon belső, dinamikusan skálázott viewBox-ában él, mert
          az (ResizeObserver + `xMidYMid meet`) belső letterboxingot adhat
          (ld. a `.vem-model-canvas` CSS-komment). A z NYÍL LEFELÉ mutat,
          mert a modell előjelkonvenciója szerint z lefelé pozitív
          (docs/CONVENTIONS.md §2, `material/concreteEC2.ts` fejléce) — ez a
          leggyakoribb forrása a "miért lefelé nő a lehajlás" félreértésnek,
          ezt hivatott egyértelművé tenni. */}
      <svg className="vem-axis-indicator" width={40} height={40} viewBox="0 0 40 40" aria-hidden="true">
        <g transform="translate(6,6)">
          <line x1={0} y1={0} x2={22} y2={0} stroke="var(--text-faint)" strokeWidth={1.3} />
          <path d="M22,0 L16,-3 L16,3 Z" fill="var(--text-faint)" />
          <text x={27} y={3.5} fontSize={10.5} fontFamily="var(--font-mono)" fill="var(--text-faint)">
            x
          </text>
          <line x1={0} y1={0} x2={0} y2={22} stroke="var(--text-faint)" strokeWidth={1.3} />
          <path d="M0,22 L-3,16 L3,16 Z" fill="var(--text-faint)" />
          <text x={0} y={34} textAnchor="middle" fontSize={10.5} fontFamily="var(--font-mono)" fill="var(--text-faint)">
            z
          </text>
          <circle cx={0} cy={0} r={1.4} fill="var(--text-faint)" />
        </g>
      </svg>
      <svg
        ref={svgRef}
        className="vem-model-canvas"
        viewBox={`0 0 ${VIEW_WIDTH} ${viewH}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={ariaLabel}
        style={{ cursor: tool === 'select' ? (drag?.kind === 'pan' ? 'grabbing' : 'grab') : 'crosshair', flex: 1, minHeight: 0 }}
        onWheel={onWheel}
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <CanvasDefs />
        <g transform={`translate(${camera.tx},${camera.ty}) scale(${camera.scale})`}>
          {/* 2. réteg — eredeti tengely */}
          <line
            x1={AXIS_X0}
            y1={axisY}
            x2={AXIS_X1}
            y2={axisY}
            stroke={result ? 'var(--sem-undeformed)' : 'var(--text-secondary)'}
            strokeWidth={result ? 1.2 : 2}
            strokeDasharray={result ? '5 4' : undefined}
          />

          {/* 3. réteg — elemhatárok és csomópontok */}
          <g>
            {elementBoundaries.map((x, i) => (
              <line key={`b${i}`} x1={x} y1={axisY - 5} x2={x} y2={axisY + 5} stroke="var(--border-medium)" strokeWidth={1} />
            ))}
            {elementBoundaries.map((x, i) => (
              <NodeMark key={`n${i}`} x={x} y={axisY} />
            ))}
          </g>

          {/* 5. réteg — deformált alak, kizárólag valós eredményből */}
          {deformedFillPath ? <path d={deformedFillPath} fill="url(#vem-deform-glow)" stroke="none" /> : null}
          {deformedPath ? (
            <path
              d={deformedPath}
              fill="none"
              stroke="var(--sem-deformed)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              filter="url(#vem-beam-shadow)"
            />
          ) : null}

          {/* 5/A. réteg — képlékeny zónák elemenként (P13 #2) */}
          {plasticZones.map((z) => (
            <PlasticZoneBar key={z.elementId} x1={z.x1} x2={z.x2} y={axisY} kind={z.kind} />
          ))}

          {/* 5/B. réteg — Gauss-pontok, kattinthatók (P13 #4 belépési pont) */}
          {gaussMarks.map((g) => (
            <GaussPointMark
              key={g.key}
              x={g.x}
              y={axisY}
              yielded={g.yielded}
              selected={inspector?.elementId === g.elementId && inspector.gaussIndex === g.gaussIndex}
              onClick={() => openInspector({ elementId: g.elementId, gaussIndex: g.gaussIndex })}
              label={`Gauss-pont, ${g.elementId}, x ≈ ${g.xMeters.toFixed(2)} m${g.yielded ? ' (folyva)' : ''}`}
            />
          ))}

          {/* 6. réteg — támaszok */}
          {model.supports.map((sup) => {
            const dragging = drag?.kind === 'move-support' && drag.id === sup.id;
            const x = t.sx(dragging && previewX !== null ? previewX : sup.x);
            const selected = isSelected({ kind: 'support', id: sup.id });
            return (
              <g
                key={sup.id}
                tabIndex={0}
                role="button"
                aria-label={`${sup.type} támasz, x = ${sup.x.toFixed(2)} m`}
                aria-pressed={selected}
                onPointerDown={(e) => startSupportDrag(e, sup.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    select({ kind: 'support', id: sup.id });
                  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    const spacing = model.span / (2 * model.elementCount);
                    const delta = e.key === 'ArrowLeft' ? -spacing : spacing;
                    moveSupport(sup.id, snapToNode(sup.x + delta, model.span, model.elementCount));
                  } else if (e.key === 'Delete' || e.key === 'Backspace') {
                    e.preventDefault();
                    select({ kind: 'support', id: sup.id });
                    removeSelected();
                  }
                }}
                style={{ cursor: tool === 'select' ? 'ew-resize' : 'crosshair', outline: 'none' }}
              >
                {selected ? <circle cx={x} cy={axisY} r={22} fill="var(--accent-a10)" /> : null}
                <SupportMark x={x} y={axisY} type={sup.type} />
              </g>
            );
          })}

          {/* 6.5 réteg — reakcióerők (2026-09-04, felhasználói kérés), piros
              nyíllal, PONTOSAN a támasz tengelyében, ki/be kapcsolható
              ("Nézet" menü). Az fz előjele NEM "pozitív = felfelé" — a
              modell z-tengelye lefelé pozitív (ld. `material/concreteEC2.ts`
              fejléce, `docs/CONVENTIONS.md` §2), a reakcióerő UGYANEZT a
              z-konvenciót követi, ezért NEGATÍV fz mutat felfelé (a −z
              irányba), pozitív lefelé.
              A nyíl a TÁMASZ-SZIMBÓLUM ALÁ kerül (nem fölé/rá), hogy semmit
              ne takarjon — a legnagyobb támaszjel (befogás/rugó) függőleges
              kiterjedése ±30px a tengelytől, ezért a nyíl 38px-nél kezdődik.
              A felirat sorszámozott (Rz1, Rz2, …, a `result.reactions`
              tömb sorrendjében), a tényleges (nem előjeles) nagysággal —
              az irányt már a nyíl hordozza. */}
          {showReactions && result
            ? result.reactions.map((r, i) => {
                const rx = t.sx(r.x);
                const up = r.fz < 0;
                const nearY = axisY + 38;
                const farY = axisY + 62;
                const tailY = up ? farY : nearY;
                const headY = up ? nearY : farY;
                const headSign = up ? 1 : -1;
                return (
                  <g key={r.nodeId} aria-hidden="true">
                    <line x1={rx} y1={tailY} x2={rx} y2={headY} stroke="var(--sem-error)" strokeWidth={1.6} />
                    <path
                      d={`M${rx},${headY} L${rx - 3.2},${headY + 6 * headSign} L${rx + 3.2},${headY + 6 * headSign} Z`}
                      fill="var(--sem-error)"
                    />
                    <text x={rx + 6} y={farY + 6} fontSize={13} fontWeight={600} fontFamily="var(--font-mono)" fill="var(--sem-error)">
                      R<tspan fontSize={9.5} dy={3}>{`z${i + 1}`}</tspan>
                      <tspan dy={-3}>{` = ${fmt.force(r.fz).value} kN`}</tspan>
                    </text>
                  </g>
                );
              })
            : null}

          {/* 7. réteg — terhek */}
          {model.loads.map((load) => {
            const selected = isSelected({ kind: 'load', id: load.id });
            if (load.kind === 'distributed') {
              const dragging = drag?.kind === 'move-load' && drag.id === load.id && previewX !== null;
              const shift = dragging ? previewX - load.x1 : 0;
              const x1 = t.sx(load.x1 + shift);
              const x2 = t.sx(load.x2 + shift);
              const uniform = Math.abs(load.q1 - load.q2) < 1e-9;
              const qLabel = uniform
                ? `q = ${load.q1.toFixed(1)} kN/m`
                : `q = ${load.q1.toFixed(1)}→${load.q2.toFixed(1)} kN/m`;
              return (
                <g
                  key={load.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`megoszló teher, ${qLabel}, ${load.x1.toFixed(2)}–${load.x2.toFixed(2)} m`}
                  aria-pressed={selected}
                  onPointerDown={(e) => startLoadDrag(e, load.id, load.x1)}
                  onKeyDown={(e) => {
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                      e.preventDefault();
                      select({ kind: 'load', id: load.id });
                      removeSelected();
                    }
                  }}
                  style={{ cursor: tool === 'select' ? 'move' : 'crosshair', outline: 'none' }}
                >
                  {selected ? (
                    <rect x={x1 - 4} y={axisY - 34} width={x2 - x1 + 8} height={38} fill="var(--accent-a10)" />
                  ) : null}
                  <DistributedLoad x1={x1} x2={x2} y={axisY} q1={load.q1} q2={load.q2} label={qLabel} />
                </g>
              );
            }
            if (load.kind === 'distributed-moment') {
              const dragging = drag?.kind === 'move-load' && drag.id === load.id && previewX !== null;
              const shift = dragging ? previewX - load.x1 : 0;
              const x1 = t.sx(load.x1 + shift);
              const x2 = t.sx(load.x2 + shift);
              const uniform = Math.abs(load.m1 - load.m2) < 1e-9;
              const mLabel = uniform
                ? `m = ${load.m1.toFixed(1)} kNm/m`
                : `m = ${load.m1.toFixed(1)}→${load.m2.toFixed(1)} kNm/m`;
              return (
                <g
                  key={load.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`megoszló nyomatékteher, ${mLabel}, ${load.x1.toFixed(2)}–${load.x2.toFixed(2)} m`}
                  aria-pressed={selected}
                  onPointerDown={(e) => startLoadDrag(e, load.id, load.x1)}
                  onKeyDown={(e) => {
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                      e.preventDefault();
                      select({ kind: 'load', id: load.id });
                      removeSelected();
                    }
                  }}
                  style={{ cursor: tool === 'select' ? 'move' : 'crosshair', outline: 'none' }}
                >
                  {selected ? (
                    <rect x={x1 - 4} y={axisY - 46} width={x2 - x1 + 8} height={40} fill="var(--accent-a10)" />
                  ) : null}
                  <DistributedMomentLoad x1={x1} x2={x2} y={axisY} label={mLabel} />
                </g>
              );
            }
            const dragging = drag?.kind === 'move-load' && drag.id === load.id && previewX !== null;
            const x = t.sx(dragging ? previewX : load.x);
            if (load.kind === 'moment') {
              return (
                <g
                  key={load.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`nyomatékteher, ${load.m.toFixed(1)} kNm, x = ${load.x.toFixed(2)} m`}
                  aria-pressed={selected}
                  onPointerDown={(e) => startLoadDrag(e, load.id, load.x)}
                  onKeyDown={(e) => {
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                      e.preventDefault();
                      select({ kind: 'load', id: load.id });
                      removeSelected();
                    }
                  }}
                  style={{ cursor: tool === 'select' ? 'ew-resize' : 'crosshair', outline: 'none' }}
                >
                  {selected ? <circle cx={x} cy={axisY - 22} r={18} fill="var(--accent-a10)" /> : null}
                  <MomentLoad x={x} y={axisY} label={`M = ${load.m.toFixed(1)} kNm`} />
                </g>
              );
            }
            return (
              <g
                key={load.id}
                tabIndex={0}
                role="button"
                aria-label={`pontteher, ${load.p.toFixed(1)} kN, x = ${load.x.toFixed(2)} m`}
                aria-pressed={selected}
                onPointerDown={(e) => startLoadDrag(e, load.id, load.x)}
                onKeyDown={(e) => {
                  if (e.key === 'Delete' || e.key === 'Backspace') {
                    e.preventDefault();
                    select({ kind: 'load', id: load.id });
                    removeSelected();
                  }
                }}
                style={{ cursor: tool === 'select' ? 'ew-resize' : 'crosshair', outline: 'none' }}
              >
                {selected ? <circle cx={x} cy={axisY - 24} r={16} fill="var(--accent-a10)" /> : null}
                <PointLoad x={x} y={axisY} label={`P = ${load.p.toFixed(1)} kN`} />
              </g>
            );
          })}

          {/* 8. réteg — Winkler-féle rugalmas ágyazatok */}
          {model.foundations.map((f) => {
            const dragging = drag?.kind === 'move-foundation' && drag.id === f.id && previewX !== null;
            const shift = dragging ? previewX - f.x1 : 0;
            const x1 = t.sx(f.x1 + shift);
            const x2 = t.sx(f.x2 + shift);
            const selected = isSelected({ kind: 'foundation', id: f.id });
            return (
              <g
                key={f.id}
                tabIndex={0}
                role="button"
                aria-label={`Winkler-ágyazat, c = ${f.c.toFixed(0)} kN/m², ${f.x1.toFixed(2)}–${f.x2.toFixed(2)} m`}
                aria-pressed={selected}
                onPointerDown={(e) => startFoundationDrag(e, f.id, f.x1)}
                onKeyDown={(e) => {
                  if (e.key === 'Delete' || e.key === 'Backspace') {
                    e.preventDefault();
                    select({ kind: 'foundation', id: f.id });
                    removeSelected();
                  }
                }}
                style={{ cursor: tool === 'select' ? 'move' : 'crosshair', outline: 'none' }}
              >
                {selected ? (
                  <rect x={x1 - 4} y={axisY} width={x2 - x1 + 8} height={34} fill="var(--accent-a10)" />
                ) : null}
                <Foundation x1={x1} x2={x2} y={axisY} label={`c = ${f.c.toFixed(0)} kN/m²`} />
              </g>
            );
          })}

          {/* Rajzolás közbeni előnézet (megoszló teher / megoszló nyomaték / ágyazat) */}
          {drag?.kind === 'draw-distributed' ? (
            <DistributedLoad
              x1={t.sx(Math.min(drag.x1, drag.x2))}
              x2={t.sx(Math.max(drag.x1, drag.x2))}
              y={axisY}
              q1={DEFAULT_DISTRIBUTED_LOAD}
              q2={DEFAULT_DISTRIBUTED_LOAD}
              label={`q = ${DEFAULT_DISTRIBUTED_LOAD.toFixed(1)} kN/m (előnézet)`}
            />
          ) : null}
          {drag?.kind === 'draw-distributed-moment' ? (
            <DistributedMomentLoad
              x1={t.sx(Math.min(drag.x1, drag.x2))}
              x2={t.sx(Math.max(drag.x1, drag.x2))}
              y={axisY}
              label={`m = ${DEFAULT_DISTRIBUTED_MOMENT.toFixed(1)} kNm/m (előnézet)`}
            />
          ) : null}
          {drag?.kind === 'draw-foundation' ? (
            <Foundation
              x1={t.sx(Math.min(drag.x1, drag.x2))}
              x2={t.sx(Math.max(drag.x1, drag.x2))}
              y={axisY}
              label={`c = ${DEFAULT_FOUNDATION_STIFFNESS.toFixed(0)} kN/m² (előnézet)`}
            />
          ) : null}

          {/* Kóta */}
          <g>
            <line x1={AXIS_X0} y1={axisY + 96} x2={AXIS_X1} y2={axisY + 96} stroke="var(--text-faint)" strokeWidth={0.8} />
            <text
              x={(AXIS_X0 + AXIS_X1) / 2}
              y={axisY + 90}
              textAnchor="middle"
              fill="var(--text-muted)"
              style={{ font: "500 15px var(--font-mono)" }}
            >
              L = {fmt.length(model.span).value} m · {material.name}
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}
