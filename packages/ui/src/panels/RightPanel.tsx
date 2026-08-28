import { NoteBox, SectionLabel } from '../components/Feedback.js';
import { ResultRow } from '../components/Value.js';
import { useModelStore } from '../state/modelStore.js';
import { useNonlinearStore } from '../state/nonlinearStore.js';
import { useLiveResult } from '../solve/useLiveResult.js';
import * as fmt from '../format/numbers.js';

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

  return (
    <aside className="vem-panel vem-panel--right" aria-label="Eredmények">
      <SectionLabel>Eredmények</SectionLabel>
      <div>
        <ResultRow label="w max (lehajlás)" formatted={fmt.deflection(result?.extremes.w.value ?? null)} />
        <ResultRow label="φ max" formatted={fmt.rotation(result?.extremes.phi.value ?? null)} />
        <ResultRow label="M max" formatted={fmt.moment(result?.extremes.m.value ?? null)} />
        <ResultRow label="T max" formatted={fmt.shear(result?.extremes.t.value ?? null)} />
        <ResultRow label="EI" formatted={fmt.bendingStiffness(result?.props.ei ?? null)} />
        <ResultRow label="GAs" formatted={fmt.shearStiffness(result?.props.gas ?? null)} />
        <ResultRow label="szabadságfokok" formatted={fmt.count(result?.dofCount ?? null, 'DOF')} />
        <ResultRow
          label="hibabecslő (legrosszabb elem)"
          formatted={fmt.percent(result?.errorEstimate ?? null)}
          title="Az elemhatárokon az átlagolás előtti igénybevétel-ugrás, a mező szélsőértékére normálva (Diplomaterv 3.1.7.4)"
        />
      </div>

      <SectionLabel>Reakciók · egyensúly</SectionLabel>
      <div>
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
      </div>

      <SectionLabel>Határteher-ellenőrzés</SectionLabel>
      <div>
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
          label="számított teherszorzó (nemlineáris)"
          formatted={fmt.lambda(lastLoadingStep?.lambda ?? null)}
          tone={nonlinearRun?.status === 'limit-load-reached' ? 'warn' : nonlinearRun?.status === 'converged' ? 'ok' : 'neutral'}
          title="A runLoadStepper által ténylegesen elért λ — 'limit-load-reached' esetén a numerikus határteher közelítése"
        />
      </div>

      {error !== null ? (
        <div style={{ padding: 'var(--space-5)' }}>
          <NoteBox tone="error">A modell jelenleg nem futtatható: {error}</NoteBox>
        </div>
      ) : null}
      {result === null && error === null ? (
        <div style={{ padding: 'var(--space-5)' }}>
          <NoteBox tone="warn">Nincs számítható modell (nincsenek elemek vagy támaszok).</NoteBox>
        </div>
      ) : null}
    </aside>
  );
}
