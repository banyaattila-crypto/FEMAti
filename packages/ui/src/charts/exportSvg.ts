/**
 * SVG export — MASTER-PROMPT-TERV P8 prompt: „SVG export egyenként és
 * összesítve." Kizárólag kliensoldali Blob+letöltés, a mag nem érintett.
 */

function triggerDownload(svgMarkup: string, filename: string): void {
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Egyetlen `<svg>` DOM-elem exportálása fájlba. */
export function exportSvgElement(svg: SVGSVGElement, filename: string): void {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const markup = new XMLSerializer().serializeToString(clone);
  triggerDownload(`<?xml version="1.0" encoding="UTF-8"?>\n${markup}`, filename);
}

/**
 * Több `<svg>` elem összesítése egyetlen, egymás alá rendezett fájlba
 * (MASTER-PROMPT-TERV: „...és összesítve").
 */
export function exportSvgElementsCombined(svgs: readonly SVGSVGElement[], filename: string): void {
  if (svgs.length === 0) return;
  const width = Math.max(...svgs.map((s) => s.viewBox.baseVal.width || s.clientWidth || 1200));
  const heights = svgs.map((s) => s.viewBox.baseVal.height || s.clientHeight || 140);
  const totalHeight = heights.reduce((a, b) => a + b, 0);

  const parts: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${totalHeight}">`];
  let offsetY = 0;
  for (let i = 0; i < svgs.length; i++) {
    const svg = svgs[i];
    if (svg === undefined) continue;
    const inner = svg.innerHTML;
    parts.push(`<g transform="translate(0,${offsetY})">${inner}</g>`);
    offsetY += heights[i] ?? 140;
  }
  parts.push('</svg>');
  triggerDownload(`<?xml version="1.0" encoding="UTF-8"?>\n${parts.join('\n')}`, filename);
}
