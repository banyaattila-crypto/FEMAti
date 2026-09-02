import { crackingMomentUtilization, deflectionUtilization, shearMomentInteraction } from '@femati/fem-core';
import { Card, NoteBox } from '../components/Feedback.js';
import { ResultRow } from '../components/Value.js';
import { findMaterial } from '../data/catalog.js';
import { useModelStore } from '../state/modelStore.js';
import { useNonlinearStore } from '../state/nonlinearStore.js';
import { useLiveResult } from '../solve/useLiveResult.js';
import * as fmt from '../format/numbers.js';
import { utilizationVerdict } from '../format/utilization.js';

/**
 * Eredménypanel — a DESIGN-TERV.md 8. fejezetének adatszerződése szerint.
 *
 * A P7 óta a `solveLinear()` VALÓDI eredményét mutatja — de csak addig, amíg
 * a modell érvényes; egy pillanatnyilag mechanizmus (pl. minden támasz
 * törölve) esetén a hiba szövegesen jelenik meg, SOSEM egy kitalált szám
 * (DESIGN-TERV 1.7 és 6.3).
 */
export function RightPanel(): JSX.Element {
  const model = useModelStore((s) => s.model);
  const { result, error } = useLiveResult(model);
  const nonlinearRun = useNonlinearStore((s) => s.run);
  const lastLoadingStep = nonlinearRun?.loadingSteps.at(-1);

  const interaction =
    result && result.props.mp !== null && result.props.vpl !== null
      ? shearMomentInteraction(result.extremes.m.value, result.extremes.t.value, result.props.mp, result.props.vpl)
      : null;
  const mvVerdict = utilizationVerdict(interaction?.utilization ?? null);

  const deflectionUtil = result ? deflectionUtilization(result.extremes.w.value, model.span) : null;
  const deflectionVerdict = utilizationVerdict(deflectionUtil);

  const materialEntry = findMaterial(model.materialId);
  // fctm a katalógusban kN/cm² (ld. compile.ts `mat.e * 1e4` mintája) — kN/m²-re váltva, hogy Kₑ-vel (m³) szorozva kNm-et adjon.
  const mcr = result && materialEntry.fctm !== undefined ? materialEntry.fctm * 1e4 * result.props.elasticModulus : null;
  const crackingUtil = result && mcr !== null ? crackingMomentUtilization(result.extremes.m.value, mcr) : null;
  const crackingVerdict = utilizationVerdict(crackingUtil);

  return (
    <aside className="vem-panel vem-panel--right" aria-label="Eredmények">
      <div className="vem-panel__stack">
        <Card title="Eredmények" accent="results">
          {/* A négy fő eredmény (a szerkezet válaszának lényege) nagyobb
              súllyal jelenik meg, mint a részletadatok alatta — a korábbi
              minta minden sort azonos vizuális súllyal mutatott. */}
          <ResultRow label="w max (lehajlás)" formatted={fmt.deflection(result?.extremes.w.value ?? null)} emphasis="hero" />
          <ResultRow label="φ max" formatted={fmt.rotation(result?.extremes.phi.value ?? null)} emphasis="hero" />
          <ResultRow label="M max" formatted={fmt.moment(result?.extremes.m.value ?? null)} emphasis="hero" />
          <ResultRow label="T max" formatted={fmt.shear(result?.extremes.t.value ?? null)} emphasis="hero" />
          <ResultRow label="EI" formatted={fmt.bendingStiffness(result?.props.ei ?? null)} />
          <ResultRow label="GAs" formatted={fmt.shearStiffness(result?.props.gas ?? null)} />
          <ResultRow label="szabadságfokok" formatted={fmt.count(result?.dofCount ?? null, 'DOF')} />
          <ResultRow
            label="hibabecslő (legrosszabb elem)"
            formatted={fmt.percent(result?.errorEstimate ?? null)}
            title="Az elemhatárokon az átlagolás előtti igénybevétel-ugrás, a mező szélsőértékére normálva (Diplomaterv 3.1.7.4)"
          />
        </Card>

        <Card title="Reakciók · egyensúly" accent="results">
          {result
            ? result.reactions.map((r) => (
                <ResultRow key={r.nodeId} label={`R (x = ${r.x.toFixed(2)} m)`} formatted={fmt.force(r.fz)} />
              ))
            : model.supports.map((s) => <ResultRow key={s.id} label={`R (x = ${s.x.toFixed(2)} m)`} formatted={fmt.force(null)} />)}
          <ResultRow
            label="ΣFz ellenőrzés"
            formatted={fmt.force(result?.equilibrium.sumFz ?? null)}
            tone={result ? (result.equilibrium.satisfied ? 'ok' : 'error') : 'neutral'}
          />
          <ResultRow
            label="ΣMy ellenőrzés"
            formatted={fmt.moment(result?.equilibrium.sumMy ?? null)}
            tone={result ? (result.equilibrium.satisfied ? 'ok' : 'error') : 'neutral'}
          />
        </Card>

        <Card title="Határteher-ellenőrzés" accent="results">
          <ResultRow
            label="rugalmas teherbírás Mₑ"
            formatted={fmt.moment(result?.props.me ?? null)}
            title="σY · Kₑ — csak akkor számítható, ha az anyagnak van folyáshatára"
          />
          <ResultRow
            label="képlékeny teherbírás Mₚ"
            formatted={fmt.moment(result?.props.mp ?? null)}
            title="σY · Kₚ — elméleti, keresztmetszet-szintű teherbírás"
          />
          <ResultRow label="alaki tényező c = Mₚ/Mₑ" formatted={fmt.shapeFactor(result?.props.shapeFactor ?? null)} />
          <ResultRow
            label="képlékeny nyíróerő-teherbírás Vpl"
            formatted={fmt.shear(result?.props.vpl ?? null)}
            title="Vpl = κs·A·σY/√3 — az effektív nyírási területből (κs·A), NEM a szabvány Av-jéből (ADR-0018)"
          />
          <ResultRow
            label="M-V kihasználtság (EN 1993-1-1)"
            formatted={fmt.percent(interaction !== null ? interaction.utilization * 100 : null)}
            tone={mvVerdict.tone}
            emphasis="large"
            title="EN 1993-1-1 6.2.8 stílusú, UTÓLAGOS ellenőrzés a globális M-max és T-max értékekből, γM0 = 1.00 (ajánlott érték) — ha nem azonos keresztmetszeti helyen lépnek fel, ez egy KONZERVATÍV (biztonság felé téves) becslés, nem pontos helyi érték (ADR-0018, ADR-0021)"
          />
          <ResultRow
            label="verdikt"
            formatted={{ value: mvVerdict.label, unit: '' }}
            tone={mvVerdict.tone}
          />
          <ResultRow
            label="lehajlás-ellenőrzés (SLS, L/250)"
            formatted={fmt.percent(deflectionUtil !== null && Number.isFinite(deflectionUtil) ? deflectionUtil * 100 : null)}
            tone={deflectionVerdict.tone}
            emphasis="large"
            title="w max / L a megengedett L/250 arányhoz viszonyítva — anyagfüggetlen, a felhasználó saját ökölszabálya szerinti SLS-ellenőrzés"
          />
          <ResultRow
            label="verdikt"
            formatted={{ value: deflectionVerdict.label, unit: '' }}
            tone={deflectionVerdict.tone}
          />
          {result && mcr !== null ? (
            <>
              <ResultRow
                label="repedési nyomaték Mcr kihasználtsága (EC2, tájékoztató)"
                formatted={fmt.percent(crackingUtil !== null && Number.isFinite(crackingUtil) ? crackingUtil * 100 : null)}
                tone={crackingVerdict.tone}
                emphasis="large"
                title="M_cr = fctm·Kₑ — TÁJÉKOZTATÓ, SLS-jellegű jelzés arról, mikor lép túl a modell a rugalmas (repedésmentes) tartományon. NEM vasbeton ULS teherbírás-ellenőrzés — nincs vasalás-modellezés a motorban (ADR-0019, ADR-0021)"
              />
              <ResultRow
                label="verdikt"
                formatted={{ value: crackingVerdict.label, unit: '' }}
                tone={crackingVerdict.tone}
                title="'túllépi a határt' itt azt jelenti: a keresztmetszet elméletileg berepedt — a rugalmas merevségi feltevés innentől nem érvényes, NEM azt, hogy a tartó tönkremegy"
              />
            </>
          ) : null}
          <ResultRow
            label="számított teherszorzó (nemlineáris)"
            formatted={fmt.lambda(lastLoadingStep?.lambda ?? null)}
            tone={nonlinearRun?.status === 'limit-load-reached' ? 'warn' : nonlinearRun?.status === 'converged' ? 'ok' : 'neutral'}
            title="A runLoadStepper által ténylegesen elért λ — 'limit-load-reached' esetén a numerikus határteher közelítése"
          />
        </Card>

        {error !== null ? <NoteBox tone="error">A modell jelenleg nem futtatható: {error}</NoteBox> : null}
        {result === null && error === null ? (
          <NoteBox tone="warn">Nincs számítható modell (nincsenek elemek vagy támaszok).</NoteBox>
        ) : null}
      </div>
    </aside>
  );
}
