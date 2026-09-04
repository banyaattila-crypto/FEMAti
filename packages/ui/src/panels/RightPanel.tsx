import { useMemo } from 'react';
import { crackingMomentUtilization } from '@femati/fem-core';
import { Card, NoteBox } from '../components/Feedback.js';
import { ResultRow } from '../components/Value.js';
import { findMaterial } from '../data/catalog.js';
import { useModelStore } from '../state/modelStore.js';
import { useNonlinearStore } from '../state/nonlinearStore.js';
import { useLiveResult } from '../solve/useLiveResult.js';
import { solveEditableModel } from '../model/compile.js';
import { scaleModelForSls, scaleModelForUls } from '../model/combinations.js';
import { computeUtilizations } from '../model/designChecks.js';
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

  // ULS (1.35G+1.5Q) és SLS (G+Q) kombináció, KÜLÖN a fent már megoldott
  // jellemző (γ=1) `result`-tól — az "Eredmények" kártya (w/M/T/φ max)
  // TOVÁBBRA IS a jellemző választ mutatja, KIZÁRÓLAG a lenti "Határteher-
  // ellenőrzés" kártya számít a tényleges kombinációkra (felhasználói
  // döntés, 2026-09-04: a napi munkafolyamat nem változik, csak az
  // ellenőrzések input-forrása).
  const ulsResult = useMemo(() => solveEditableModel(scaleModelForUls(model)).result, [model]);
  const slsResult = useMemo(() => solveEditableModel(scaleModelForSls(model)).result, [model]);

  // M-V interakció, lehajlás-ellenőrzés, vasbeton ULS — megosztott logika
  // (`model/designChecks.ts`), amit a szelvény-optimalizálás (`model/
  // optimize.ts`) is ugyanígy hív minden jelölt szelvényre, hogy a kettő ne
  // csúszhasson szét egymástól.
  const utils = ulsResult && slsResult ? computeUtilizations(model, ulsResult, slsResult) : null;
  const mvVerdict = utilizationVerdict(utils?.mv ?? null);
  const deflectionVerdict = utilizationVerdict(utils?.deflection ?? null);
  const rcVerdict = utilizationVerdict(utils?.rc ?? null);

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
      ? `ΣFz = Σreakciók + Σterhek = ${fmt.force(reactionsFz).value} + ${fmt.force(loadsFz).value} = ${fmt.force(result.equilibrium.sumFz).value} kN (elvileg 0)`
      : undefined;
  const sumMyTitle =
    result && reactionsMy !== null && loadsMy !== null
      ? `ΣMy (az x=0 origóra) = Σreakciók nyomatéka + Σterhek nyomatéka = ${fmt.moment(reactionsMy).value} + ${fmt.moment(loadsMy).value} = ${fmt.moment(result.equilibrium.sumMy).value} kNm (elvileg 0)`
      : undefined;

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
          {result && result.foundationLiftOff.length > 0 ? (
            <div style={{ padding: '0 var(--space-5) var(--space-3)' }}>
              <NoteBox tone="info">
                {result.foundationLiftOff.length} elem felemelkedett a no-tension ágyazatról (ADR-0022) — ott az
                ágyazat pillanatnyilag nem fejt ki erőt.
              </NoteBox>
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
            label="ΣFz ellenőrzés"
            formatted={fmt.force(result?.equilibrium.sumFz ?? null)}
            tone={result ? (result.equilibrium.satisfied ? 'ok' : 'error') : 'neutral'}
            title={sumFzTitle ?? ''}
          />
          <ResultRow
            label="ΣMy ellenőrzés"
            formatted={fmt.moment(result?.equilibrium.sumMy ?? null)}
            tone={result ? (result.equilibrium.satisfied ? 'ok' : 'error') : 'neutral'}
            title={sumMyTitle ?? ''}
          />
        </Card>

        <Card title="Határteher-ellenőrzés" accent="results">
          <div style={{ padding: '0 var(--space-5) var(--space-3)' }}>
            <NoteBox tone="info">
              Az ellenőrzések ULS (1,35·G+1,5·Q) / SLS (G+Q) kombinációra futnak (EN 1990) — a fenti "Eredmények" kártya
              w/φ/M/T max sorai ettől függetlenül a jellemző (nem faktorozott) terhet mutatják.
            </NoteBox>
          </div>
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
            formatted={fmt.percent(utils?.mv !== null && utils?.mv !== undefined ? utils.mv * 100 : null)}
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
            formatted={fmt.percent(utils?.deflection !== null && utils?.deflection !== undefined && Number.isFinite(utils.deflection) ? utils.deflection * 100 : null)}
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
                title="M_cr = fctm·Kₑ — TÁJÉKOZTATÓ, SLS-jellegű jelzés arról, mikor lép túl a modell a rugalmas (repedésmentes) tartományon. Ez ÖNMAGÁBAN nem vasbeton ULS teherbírás-ellenőrzés — az a lenti 'Vasbeton ULS' sorban jelenik meg, ha a vasalás be van kapcsolva (ADR-0019, ADR-0021)"
              />
              <ResultRow
                label="verdikt"
                formatted={{ value: crackingVerdict.label, unit: '' }}
                tone={crackingVerdict.tone}
                title="'túllépi a határt' itt azt jelenti: a keresztmetszet elméletileg berepedt — a rugalmas merevségi feltevés innentől nem érvényes, NEM azt, hogy a tartó tönkremegy"
              />
            </>
          ) : null}
          {utils?.rcMu !== null && utils?.rcMu !== undefined ? (
            <>
              <ResultRow
                label="vasbeton ULS teherbírás MRd"
                formatted={fmt.moment(utils.rcMu)}
                title="Egyszerűsített téglalap feszültségblokk (EC2 3.1.7(3)), jellemző (γ=1.0) érték, B500B betonacél — a húzott oldal a globális M előjelétől függ"
              />
              <ResultRow
                label="Vasbeton ULS kihasználtság"
                formatted={fmt.percent(utils.rc !== null && Number.isFinite(utils.rc) ? utils.rc * 100 : null)}
                tone={rcVerdict.tone}
                emphasis="large"
                title="|M-max| / MRd — a globális M-max/M-min szélsőértékre, NEM feltétlenül a legkritikusabb keresztmetszetre (konzervatív becslés, mint a többi ULS-ellenőrzésnél)"
              />
              <ResultRow label="verdikt" formatted={{ value: rcVerdict.label, unit: '' }} tone={rcVerdict.tone} />
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
