/**
 * A modellvászon (`canvas/ModelCanvas.tsx`, `canvas/ToolPalette.tsx`)
 * felhasználó felé mutatkozó szövegei — a teljes UI i18n (2026-09-05)
 * 2. fázisa.
 *
 * A vászonra RAJZOLT számérték-feliratok (pl. `q = 30 kN/m`, `M = 20 kNm`,
 * `L = 12.00 m · S235...`) SZÁNDÉKOSAN nem itt vannak — nem tartalmaznak
 * magyar szót, a `format/numbers.ts` fejléce szerint a vászon MINDIG SI
 * mértékegységben marad, a mértékegység-váltó csak a kijelzést érinti.
 * Ide csak a valódi magyar szót tartalmazó feliratok (aria-labelek, gomb-
 * címkék) kerültek.
 */
import type { Lang } from '../state/appStore.js';

export interface CanvasStrings {
  readonly selectToolLabel: string;
  readonly selectToolTitle: string;
  readonly selectModeAria: string;
  readonly zoomOut: string;
  readonly zoomIn: string;
  readonly resetViewTitle: string;
  readonly resetViewLabel: string;
  readonly deleteTitle: string;
  readonly deleteLabel: string;
  readonly reactionsToggleTitle: string;
  readonly reactionsToggleLabel: string;
  readonly previewSuffix: string;
  readonly canvasAriaLabel: (p: {
    readonly span: string;
    readonly sectionName: string;
    readonly elementCount: number;
    readonly supportCount: number;
    readonly loadCount: number;
    readonly status: string;
    readonly tool: string;
  }) => string;
  readonly hasResult: string;
  readonly hasError: (message: string) => string;
  readonly noResultYet: string;
  readonly supportAria: (typeLabel: string, x: string) => string;
  readonly distributedLoadAria: (qLabel: string, x1: string, x2: string) => string;
  readonly distributedMomentAria: (mLabel: string, x1: string, x2: string) => string;
  readonly momentLoadAria: (m: string, x: string) => string;
  readonly pointLoadAria: (p: string, x: string) => string;
  readonly foundationAria: (c: string, x1: string, x2: string) => string;
  readonly gaussPointLabel: (elementId: string, x: string, yielded: boolean) => string;
}

export const CANVAS: Record<Lang, CanvasStrings> = {
  hu: {
    selectToolLabel: 'Kijelölés',
    selectToolTitle: 'Kattintás: kijelölés · húzás: áthelyezés',
    selectModeAria: 'Kijelölés / vászon mód',
    zoomOut: 'Kicsinyítés',
    zoomIn: 'Nagyítás',
    resetViewTitle: 'Nézet visszaállítása (Ctrl+0)',
    resetViewLabel: 'Nézet visszaáll.',
    deleteTitle: 'A kijelölt elem törlése (Delete)',
    deleteLabel: 'Törlés',
    reactionsToggleTitle: 'Reakcióerők ki/be kapcsolása a vásznon',
    reactionsToggleLabel: 'Reakciók',
    previewSuffix: ' (előnézet)',
    canvasAriaLabel: (p) =>
      `${p.span} m fesztáv, ${p.sectionName} keresztmetszet, ${p.elementCount} végeselem, ` +
      `${p.supportCount} támasz, ${p.loadCount} teher. ${p.status} Vászon-eszköz: ${p.tool}.`,
    hasResult: 'Van érvényes számítási eredmény.',
    hasError: (message) => `Hiba: ${message}`,
    noResultYet: 'Számítási eredmény még nincs.',
    supportAria: (typeLabel, x) => `${typeLabel} támasz, x = ${x} m`,
    distributedLoadAria: (qLabel, x1, x2) => `megoszló teher, ${qLabel}, ${x1}–${x2} m`,
    distributedMomentAria: (mLabel, x1, x2) => `megoszló nyomatékteher, ${mLabel}, ${x1}–${x2} m`,
    momentLoadAria: (m, x) => `nyomatékteher, ${m} kNm, x = ${x} m`,
    pointLoadAria: (p, x) => `pontteher, ${p} kN, x = ${x} m`,
    foundationAria: (c, x1, x2) => `Winkler-ágyazat, c = ${c} kN/m², ${x1}–${x2} m`,
    gaussPointLabel: (elementId, x, yielded) => `Gauss-pont, ${elementId}, x ≈ ${x} m${yielded ? ' (folyva)' : ''}`,
  },

  en: {
    selectToolLabel: 'Select',
    selectToolTitle: 'Click: select · drag: move',
    selectModeAria: 'Select / canvas mode',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    resetViewTitle: 'Reset view (Ctrl+0)',
    resetViewLabel: 'Reset view',
    deleteTitle: 'Delete selected element (Delete)',
    deleteLabel: 'Delete',
    reactionsToggleTitle: 'Toggle reaction forces on the canvas',
    reactionsToggleLabel: 'Reactions',
    previewSuffix: ' (preview)',
    canvasAriaLabel: (p) =>
      `${p.span} m span, ${p.sectionName} cross-section, ${p.elementCount} finite element${p.elementCount === 1 ? '' : 's'}, ` +
      `${p.supportCount} support${p.supportCount === 1 ? '' : 's'}, ${p.loadCount} load${p.loadCount === 1 ? '' : 's'}. ${p.status} Canvas tool: ${p.tool}.`,
    hasResult: 'A valid analysis result is available.',
    hasError: (message) => `Error: ${message}`,
    noResultYet: 'No analysis result yet.',
    supportAria: (typeLabel, x) => `${typeLabel} support, x = ${x} m`,
    distributedLoadAria: (qLabel, x1, x2) => `distributed load, ${qLabel}, ${x1}–${x2} m`,
    distributedMomentAria: (mLabel, x1, x2) => `distributed moment load, ${mLabel}, ${x1}–${x2} m`,
    momentLoadAria: (m, x) => `moment load, ${m} kNm, x = ${x} m`,
    pointLoadAria: (p, x) => `point load, ${p} kN, x = ${x} m`,
    foundationAria: (c, x1, x2) => `Winkler foundation, c = ${c} kN/m², ${x1}–${x2} m`,
    gaussPointLabel: (elementId, x, yielded) => `Gauss point, ${elementId}, x ≈ ${x} m${yielded ? ' (yielded)' : ''}`,
  },
};
