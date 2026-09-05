/**
 * A "Történelmi mód" (`historical/HistoricalView.tsx`) felhasználó felé
 * mutatkozó szövegei — a teljes UI i18n (2026-09-05) 5c., záró fázisa.
 *
 * A magyarázó szöveg két mondata SZÓ SZERINT idézi az 1996-os diplomatervet
 * (3.1.7.3, 44. oldal) — az angol változatban ezek fordítva szerepelnek,
 * olvashatóság kedvéért, de az idézet HITELES forrása mindig a diplomaterv
 * eredeti magyar szövege marad (ld. `quoteNote`, ami erre explicit utal).
 */
import type { Lang } from '../state/appStore.js';

export interface HistoricalStrings {
  readonly title: string;
  readonly close: string;
  readonly errorMessage: (error: string) => string;
  readonly subtitle: string;
  readonly svgAriaLabel: string;
  readonly legendDone: string;
  readonly legendCurrent: string;
  readonly legendFront: string;
  readonly playbackAriaLabel: string;
  readonly prevElementAria: string;
  readonly playAria: string;
  readonly pauseAria: string;
  readonly nextElementAria: string;
  readonly rangeAriaLabel: string;
  readonly stepLabel: (n: number, elementId: string) => string;
  readonly noStep: string;
  readonly speedGroupAria: string;
  readonly statCurrentFrontWidth: string;
  readonly statMaxFrontWidth: string;
  readonly statMeanFrontWidth: string;
  readonly statSkylineBandwidth: string;
  readonly compareFrontLabel: string;
  readonly compareSkylineLabel: string;
  readonly explainTitle: string;
  readonly explainParagraph1: string;
  readonly explainParagraph2: string;
  readonly quoteNote: string;
}

export const HISTORICAL: Record<Lang, HistoricalStrings> = {
  hu: {
    title: 'FEMAti — Történelmi mód',
    close: 'Bezárás',
    errorMessage: (error) => `A frontális megoldó nem tudta megoldani az aktuális modellt: ${error}`,
    subtitle: 'A diplomaterv 3.1.7.3 pontjának EREDETI (1996-os) frontális algoritmusa',
    svgAriaLabel: 'A front mozgása',
    legendDone: 'feldolgozott elem',
    legendCurrent: 'aktuális elem',
    legendFront: 'aktív front-csomópont',
    playbackAriaLabel: 'Lejátszás',
    prevElementAria: 'Előző elem',
    playAria: 'Lejátszás',
    pauseAria: 'Szünet',
    nextElementAria: 'Következő elem',
    rangeAriaLabel: 'Elem sorszáma',
    stepLabel: (n, elementId) => `${n}. elem: ${elementId}`,
    noStep: '—',
    speedGroupAria: 'Lejátszási sebesség',
    statCurrentFrontWidth: 'Pillanatnyi frontszélesség',
    statMaxFrontWidth: 'Legnagyobb frontszélesség (max)',
    statMeanFrontWidth: 'Átlagos frontszélesség',
    statSkylineBandwidth: 'Skyline-profil átlagos sávszélessége',
    compareFrontLabel: 'Front (jelenlegi)',
    compareSkylineLabel: 'Skyline (átlagos sáv)',
    explainTitle: 'Miért ez volt 1996-ban a helyes választás?',
    explainParagraph1:
      'A diplomaterv (3.1.7.3, 44. oldal) szerint a program a frontális algoritmust alkalmazta: „nem a csomópontok, hanem a rudak sorszámozása határozza meg a számítás időigényét", és „az együtthatómátrix előállítása és az egyenletrendszer megoldása nem válik szét" — az elemek beépítése és a kiküszöbölés EGYETLEN átmenetben, elemenként haladva történt. Ennek oka egyszerű: a korabeli gépeken a memória volt a szűkös erőforrás, nem a számítási idő. A frontális módszer sosem tartja memóriában a TELJES merevségi mátrixot — csak a pillanatnyi "frontot" (a még ki nem küszöbölt szabadságfokokat) —, ezért egy néhány tíz-száz kilobájtos memóriájú gépen is megoldható volt egy több száz szabadságfokú szerkezet, amit a teljes mátrix tárolása ellehetetlenített volna.',
    explainParagraph2:
      'Ami azóta megváltozott: a memória ma gyakorlatilag nem korlát egy ilyen méretű 1D gerendaanalízisnél, viszont a front SZÉLESSÉGE (és ezzel a művigény) erősen függ az ELEM-sorszámozástól — egy rosszul sorszámozott hálón a front indokolatlanul kiszélesedhet. A mai Skyline-LDLᵀ megoldó (ld. `linalg/skyline.ts`, ADR-0002) ehelyett a CSOMÓPONT-sorszámozásból adódó sávszerkezetet ("profilt") használja ki, és a teljes mátrixot egyszerre, elkülönítve állítja össze és faktorizálja — ez modern gépeken gyorsabb és egyszerűbb karbantartani, ezért ez maradt a produkciós megoldó ebben a programban. A frontális algoritmus itt KIZÁRÓLAG azért szerepel, mert az eredeti diplomaterv EZT valósította meg — ez a nézet az akkori mérnöki döntés hitelesítésére és bemutatására szolgál.',
    quoteNote: '',
  },

  en: {
    title: 'FEMAti — Historical mode',
    close: 'Close',
    errorMessage: (error) => `The frontal solver could not solve the current model: ${error}`,
    subtitle: "The ORIGINAL (1996) frontal algorithm from section 3.1.7.3 of the thesis",
    svgAriaLabel: 'Front movement',
    legendDone: 'processed element',
    legendCurrent: 'current element',
    legendFront: 'active front node',
    playbackAriaLabel: 'Playback',
    prevElementAria: 'Previous element',
    playAria: 'Play',
    pauseAria: 'Pause',
    nextElementAria: 'Next element',
    rangeAriaLabel: 'Element index',
    stepLabel: (n, elementId) => `element ${n}: ${elementId}`,
    noStep: '—',
    speedGroupAria: 'Playback speed',
    statCurrentFrontWidth: 'Current front width',
    statMaxFrontWidth: 'Maximum front width (peak)',
    statMeanFrontWidth: 'Mean front width',
    statSkylineBandwidth: 'Skyline profile mean bandwidth',
    compareFrontLabel: 'Front (current)',
    compareSkylineLabel: 'Skyline (mean band)',
    explainTitle: 'Why was this the right choice in 1996?',
    explainParagraph1:
      'According to the thesis (3.1.7.3, page 44), the program used the frontal algorithm: "it is not the numbering of the nodes but of the members that determines the computation time," and "the assembly of the coefficient matrix and the solution of the equation system are not separated" — element assembly and elimination happened in a SINGLE pass, proceeding element by element. The reason is simple: on machines of that era, memory was the scarce resource, not computation time. The frontal method never keeps the FULL stiffness matrix in memory — only the current "front" (the degrees of freedom not yet eliminated) — so a structure with several hundred degrees of freedom could be solved even on a machine with only a few tens or hundreds of kilobytes of memory, which storing the full matrix would have made impossible.',
    explainParagraph2:
      'What has changed since then: today, memory is practically not a constraint for a 1D beam analysis of this size, but the WIDTH of the front (and thus the work required) depends strongly on the ELEMENT numbering — on a poorly numbered mesh the front can widen unnecessarily. Today\'s Skyline-LDLᵀ solver (see `linalg/skyline.ts`, ADR-0002) instead exploits the band structure ("profile") that results from NODE numbering, and assembles and factorizes the full matrix at once, as a separate step — this is faster on modern machines and simpler to maintain, which is why it remains the production solver in this program. The frontal algorithm appears here ONLY because the original thesis implemented it THIS way — this view exists to document and demonstrate that engineering decision of the time.',
    quoteNote: 'The two quoted phrases above are translated from the original 1996 Hungarian thesis text for readability — the Hungarian wording in the thesis remains authoritative.',
  },
};
