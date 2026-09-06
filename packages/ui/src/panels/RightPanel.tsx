import { useMemo } from 'react';
import { crackingMomentUtilization } from '@femati/fem-core';
import { Card, NoteBox } from '../components/Feedback.js';
import { ResultRow } from '../components/Value.js';
import { findMaterial } from '../data/catalog.js';
import { useAppStore } from '../state/appStore.js';
import { useModelStore } from '../state/modelStore.js';
import { useNonlinearStore } from '../state/nonlinearStore.js';
import { useLiveResult } from '../solve/useLiveResult.js';
import { solveEditableModel } from '../model/compile.js';
import { scaleModelForSls, scaleModelForUlsVariants, ulsVariantLeadingLoadIds } from '../model/combinations.js';
import { computeUtilizationsEnveloped } from '../model/designChecks.js';
import { loadRowLabel } from '../model/loadLabel.js';
import * as fmt from '../format/numbers.js';
import { utilizationVerdict } from '../format/utilization.js';
import { PANELS, VERDICT_LABEL } from '../i18n/panels.js';

/**
 * Eredménypanel — a DESIGN-TERV.md 8. fejezetének adatszerződése szerint.
 *
 * A P7 óta a `solveLinear()` VALÓDI eredményét mutatja — de csak addig, amíg
 * a modell érvényes; egy pillanatnyilag mechanizmus (pl. minden támasz
 * törölve) esetén a hiba szövegesen jelenik meg, SOSEM egy kitalált szám
 * (DESIGN-TERV 1.7 és 6.3).
 */
export function RightPanel(): JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const t = PANELS[lang];
  const model = useModelStore((s) => s.model);
  const { result, error } = useLiveResult(model);
  const nonlinearRun = useNonlinearStore((s) => s.run);
  const lastLoadingStep = nonlinearRun?.loadingSteps.at(-1);

  // ULS (1.35G+1.5Q) és SLS (G+Q) kombináció, KÜLÖN a fent már megoldott
  // jellemző (γ=1) `result`-tól — az "Eredmények" kártya (w/M/T/φ max)
  // TOVÁBBRA IS a jellemző választ mutatja, KIZÁRÓLAG a lenti "Határteher-
  // ellenőrzés" kártya számít a tényleges kombinációkra (felhasználói
  // döntés, 2026-09-04: a napi munkafolyamat nem változik, csak az
  // ellenőrzések input-forrása).
  // 2+ egyidejű változó teher esetén nem tudható előre, melyik a "vezető"
  // (EN 1990 6.10) — ezért mindegyik változatot le kell futtatni és a
  // legkedvezőtlenebbet venni (`combinations.ts` `scaleModelForUlsVariants`).
  const ulsResults = useMemo(
    () =>
      scaleModelForUlsVariants(model)
        .map((variant) => solveEditableModel(variant).result)
        .filter((r): r is NonNullable<typeof r> => r !== null),
    [model],
  );
  const slsResult = useMemo(() => solveEditableModel(scaleModelForSls(model)).result, [model]);

  // M-V interakció, lehajlás-ellenőrzés, vasbeton ULS — megosztott logika
  // (`model/designChecks.ts`), amit a szelvény-optimalizálás (`model/
  // optimize.ts`) is ugyanígy hív minden jelölt szelvényre, hogy a kettő ne
  // csúszhasson szét egymástól.
  const utils = ulsResults.length > 0 && slsResult ? computeUtilizationsEnveloped(model, ulsResults, slsResult) : null;
  const mvVerdict = utilizationVerdict(utils?.mv ?? null);
  const deflectionVerdict = utilizationVerdict(utils?.deflection ?? null);
  const rcVerdict = utilizationVerdict(utils?.rc ?? null);

  // A mértékadó ULS-kombináció M-je és a hozzá tartozó "vezető" teher —
  // csak tájékoztató kiírás, a fenti %-os ellenőrzések ettől függetlenül
  // már a helyes envelope-ot használják.
  const ulsGoverningResult = utils ? ulsResults[utils.ulsGoverningIndex] : null;
  const leadingLoadId = utils ? (ulsVariantLeadingLoadIds(model)[utils.ulsGoverningIndex] ?? null) : null;
  const leadingLoad = leadingLoadId !== null ? model.loads.find((l) => l.id === leadingLoadId) : undefined;
  const leadingLoadLabel = leadingLoad ? loadRowLabel(leadingLoad).label : null;

  const materialEntry = findMaterial(model.materialId);
  // fctm a katalógusban kN/cm² (ld. compile.ts `mat.e * 1e4` mintája) — kN/m²-re váltva, hogy Kₑ-vel (m³) szorozva kNm-et adjon.
  // TÁJÉKOZTATÓ jellegű (nem ULS/SLS-kapu), ezért NEM része a `computeUtilizations` "governing" kihasználtságának.
  const mcr = result && materialEntry.fctm !== undefined ? materialEntry.fctm * 1e4 * result.props.elasticModulus : null;
  const crackingUtil = result && mcr !== null ? crackingMomentUtilization(result.extremes.m.value, mcr) : null;
  const crackingVerdict = utilizationVerdict(crackingUtil);

  // ΣFz/ΣMy ellenőrzés bontása "honnan jött ki a ~0" tooltipphez — a
  // `checkEquilibrium` (fem-core `linearSolver.ts`) csomópontonként összegez
  // (terhek + reakciók DOF-szinten), ami mérnökileg nem olvasható; itt a
  // FIZIKAILAG értelmes két csoportra bontjuk vissza: Σreakciók (amit a
  // fenti Rz-sorok már úgyis kiírnak) és Σterhek = a maradék. Ez EGZAKT, nem
  // közelítés — a lineáris összegzés felcserélhetősége miatt Σterhek
  // pontosan az összes külső teher eredőjével egyezik (a konzisztens
  // csomóponti terhelés-vektor definíció szerint megőrzi az eredő erőt/
  // nyomatékot).
  const reactionsFz = result ? result.reactions.reduce((s, r) => s + r.fz, 0) : null;
  const reactionsMy = result ? result.reactions.reduce((s, r) => s + r.my + r.fz * r.x, 0) : null;
  const loadsFz = result && reactionsFz !== null ? result.equilibrium.sumFz - reactionsFz : null;
  const loadsMy = result && reactionsMy !== null ? result.equilibrium.sumMy - reactionsMy : null;
  const sumFzTitle =
    result && reactionsFz !== null && loadsFz !== null
      ? t.sumFzTitle(fmt.force(reactionsFz).value, fmt.force(loadsFz).value, fmt.force(result.equilibrium.sumFz).value)
      : undefined;
  const sumMyTitle =
    result && reactionsMy !== null && loadsMy !== null
      ? t.sumMyTitle(fmt.moment(reactionsMy).value, fmt.moment(loadsMy).value, fmt.moment(result.equilibrium.sumMy).value)
      : undefined;

  return (
    <aside className="vem-panel vem-panel--right" aria-label={t.resultsCardTitle}>
      <div className="vem-panel__stack">
        <Card title={t.resultsCardTitle} accent="results">
          {/* A négy fő eredmény (a szerkezet válaszának lényege) nagyobb
              súllyal jelenik meg, mint a részletadatok alatta — a korábbi
              minta minden sort azonos vizuális súllyal mutatott. */}
          <ResultRow label={t.wMaxLabel} formatted={fmt.deflection(result?.extremes.w.value ?? null)} emphasis="hero" />
          <ResultRow label="φ max" formatted={fmt.rotation(result?.extremes.phi.value ?? null)} emphasis="hero" />
          <ResultRow label="M max" formatted={fmt.moment(result?.extremes.m.value ?? null)} emphasis="hero" />
          <ResultRow label="T max" formatted={fmt.shear(result?.extremes.t.value ?? null)} emphasis="hero" />
          <ResultRow label="EI" formatted={fmt.bendingStiffness(result?.props.ei ?? null)} />
          <ResultRow label="GAs" formatted={fmt.shearStiffness(result?.props.gas ?? null)} />
          <ResultRow label={t.dofLabel} formatted={fmt.count(result?.dofCount ?? null, 'DOF')} />
          <ResultRow
            label={t.errorEstimateLabel}
            formatted={fmt.percent(result?.errorEstimate ?? null)}
            title={t.errorEstimateTitle}
          />
        </Card>

        <Card title={t.reactionsCardTitle} accent="results">
          {result && result.foundationLiftOff.length > 0 ? (
            <div style={{ padding: '0 var(--space-5) var(--space-3)' }}>
              <NoteBox tone="info">{t.liftOffNote(result.foundationLiftOff.length)}</NoteBox>
            </div>
          ) : null}
          {/* Az "Rz{n}" sorszámozás UGYANAZ a `result.reactions` tömb-sorrend,
              mint amit a vászon reakció-nyilai (`canvas/ModelCanvas.tsx`)
              használnak — ugyanaz a támasz mindkét helyen ugyanazt az
              indexet kapja. */}
          {result
            ? result.reactions.map((r, i) => (
                <ResultRow key={r.nodeId} label={`Rz${i + 1} (x = ${r.x.toFixed(2)} m)`} formatted={fmt.force(r.fz)} />
              ))
            : model.supports.map((s, i) => <ResultRow key={s.id} label={`Rz${i + 1} (x = ${s.x.toFixed(2)} m)`} formatted={fmt.force(null)} />)}
          <ResultRow
            label={t.sumFzCheckLabel}
            formatted={fmt.force(result?.equilibrium.sumFz ?? null)}
            tone={result ? (result.equilibrium.satisfied ? 'ok' : 'error') : 'neutral'}
            title={sumFzTitle ?? ''}
          />
          <ResultRow
            label={t.sumMyCheckLabel}
            formatted={fmt.moment(result?.equilibrium.sumMy ?? null)}
            tone={result ? (result.equilibrium.satisfied ? 'ok' : 'error') : 'neutral'}
            title={sumMyTitle ?? ''}
          />
        </Card>

        <Card title={t.ultimateCardTitle} accent="results">
          <div style={{ padding: '0 var(--space-5) var(--space-3)' }}>
            <NoteBox tone="info">{t.ulsSlsNote}</NoteBox>
          </div>
          <ResultRow
            label={t.elasticCapacityLabel}
            formatted={fmt.moment(result?.props.me ?? null)}
            title={t.elasticCapacityTitle}
          />
          <ResultRow
            label={t.plasticCapacityLabel}
            formatted={fmt.moment(result?.props.mp ?? null)}
            title={t.plasticCapacityTitle}
          />
          <ResultRow label={t.shapeFactorLabel} formatted={fmt.shapeFactor(result?.props.shapeFactor ?? null)} />
          <ResultRow
            label={t.shearCapacityLabel}
            formatted={fmt.shear(result?.props.vpl ?? null)}
            title={t.shearCapacityTitle}
          />
          <ResultRow
            label={t.ulsGoverningMomentLabel}
            formatted={fmt.moment(ulsGoverningResult?.extremes.m.value ?? null)}
            title={t.ulsGoverningMomentTitle}
          />
          {leadingLoadLabel !== null ? (
            <ResultRow label={t.ulsLeadingLoadLabel} formatted={{ value: leadingLoadLabel, unit: '' }} title={t.ulsLeadingLoadTitle} />
          ) : null}
          <ResultRow
            label={t.mvUtilLabel}
            formatted={fmt.percent(utils?.mv !== null && utils?.mv !== undefined ? utils.mv * 100 : null)}
            tone={mvVerdict.tone}
            emphasis="large"
            title={t.mvUtilTitle}
          />
          <ResultRow
            label={t.verdictLabel}
            formatted={{ value: VERDICT_LABEL[lang][mvVerdict.code], unit: '' }}
            tone={mvVerdict.tone}
          />
          <ResultRow
            label={t.deflectionUtilLabel}
            formatted={fmt.percent(utils?.deflection !== null && utils?.deflection !== undefined && Number.isFinite(utils.deflection) ? utils.deflection * 100 : null)}
            tone={deflectionVerdict.tone}
            emphasis="large"
            title={t.deflectionUtilTitle}
          />
          <ResultRow
            label={t.verdictLabel}
            formatted={{ value: VERDICT_LABEL[lang][deflectionVerdict.code], unit: '' }}
            tone={deflectionVerdict.tone}
          />
          {result && mcr !== null ? (
            <>
              <ResultRow
                label={t.crackingUtilLabel}
                formatted={fmt.percent(crackingUtil !== null && Number.isFinite(crackingUtil) ? crackingUtil * 100 : null)}
                tone={crackingVerdict.tone}
                emphasis="large"
                title={t.crackingUtilTitle}
              />
              <ResultRow
                label={t.verdictLabel}
                formatted={{ value: VERDICT_LABEL[lang][crackingVerdict.code], unit: '' }}
                tone={crackingVerdict.tone}
                title={t.crackingVerdictTitle}
              />
            </>
          ) : null}
          {utils?.rcMu !== null && utils?.rcMu !== undefined ? (
            <>
              <ResultRow
                label={t.rcUlsCapacityLabel}
                formatted={fmt.moment(utils.rcMu)}
                title={t.rcUlsCapacityTitle}
              />
              <ResultRow
                label={t.rcUlsUtilLabel}
                formatted={fmt.percent(utils.rc !== null && Number.isFinite(utils.rc) ? utils.rc * 100 : null)}
                tone={rcVerdict.tone}
                emphasis="large"
                title={t.rcUlsUtilTitle}
              />
              <ResultRow label={t.verdictLabel} formatted={{ value: VERDICT_LABEL[lang][rcVerdict.code], unit: '' }} tone={rcVerdict.tone} />
            </>
          ) : null}
          <ResultRow
            label={t.computedLoadFactorLabel}
            formatted={fmt.lambda(lastLoadingStep?.lambda ?? null)}
            tone={nonlinearRun?.status === 'limit-load-reached' ? 'warn' : nonlinearRun?.status === 'converged' ? 'ok' : 'neutral'}
            title={t.computedLoadFactorTitle}
          />
        </Card>

        {error !== null ? <NoteBox tone="error">{t.notRunnablePrefix(error)}</NoteBox> : null}
        {result === null && error === null ? (
          <NoteBox tone="warn">{t.noComputableModel}</NoteBox>
        ) : null}
      </div>
    </aside>
  );
}
