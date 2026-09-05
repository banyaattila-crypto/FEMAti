/**
 * A "Dinamika" fül — dinamikai válasz (tranziens, Newmark-β, ADR-0017).
 *
 * Eltérően a nemlineáris teherlépcsőzőtől (Toolbar SZÁMÍTÁS/F5 indítja, a
 * beállításai a `LeftPanel` "Megoldó" kártyáján élnek), ez a panel ÖNÁLLÓ
 * beállítás-űrlapot ÉS "Futtatás" gombot is tartalmaz — sok, kifejezetten
 * csak ide tartozó paramétere van (gerjesztéstípus, amplitúdó, frekvencia/
 * időtartam, csillapítás, dt, lépésszám), ezért nem indokolt a Toolbar-ba/
 * LeftPanel-be tolni egy olyan funkciót, amit a legtöbb munkamenetben nem
 * használnak. A beállítások `useState`-ben élnek a panelen belül — NEM
 * kerülnek a `File → Mentés`-be (dokumentált v1-korlátozás).
 */
import { useState } from 'react';
import { Button, SegmentedControl } from '../components/Button.js';
import { Slider } from '../components/Field.js';
import { useModelStore } from '../state/modelStore.js';
import { useAppStore } from '../state/appStore.js';
import { useDynamicStore } from '../state/dynamicStore.js';
import {
  DEFAULT_DYNAMIC_SETTINGS,
  runDynamicEditableModel,
  type DynamicSettings,
  type ExcitationKind,
} from '../model/dynamicRun.js';
import { TransientChart, TRANSIENT_CHART_HEIGHT, type TransientQuantity } from './TransientChart.js';
import { CHARTS } from '../i18n/charts.js';
import { SHELL } from '../i18n/shell.js';

export function DynamicPanel(): JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const t = CHARTS[lang];
  const model = useModelStore((s) => s.model);
  const run = useDynamicStore((s) => s.run);
  const error = useDynamicStore((s) => s.error);
  const setRun = useDynamicStore((s) => s.setRun);
  const setError = useDynamicStore((s) => s.setError);

  const [settings, setSettings] = useState<DynamicSettings>(DEFAULT_DYNAMIC_SETTINGS);
  const [quantity, setQuantity] = useState<TransientQuantity>('w');

  const patch = (p: Partial<DynamicSettings>): void => setSettings((s) => ({ ...s, ...p }));

  const runIt = (): void => {
    const outcome = runDynamicEditableModel(model, settings);
    if (outcome.run !== null) setRun(outcome.run);
    else if (outcome.error !== null) setError(outcome.error);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          padding: 'var(--space-3) var(--space-6)',
          fontSize: 12,
          flex: 'none',
        }}
      >
        <SegmentedControl
          ariaLabel={t.excitationTypeAria}
          value={settings.excitation}
          onChange={(v) => patch({ excitation: v })}
          options={(Object.keys(t.excitationLabel) as ExcitationKind[]).map((k) => ({ value: k, label: t.excitationLabel[k] }))}
        />
        <div style={{ width: 140 }}>
          <Slider
            label={t.amplitudeLabel}
            min={0.1}
            max={3}
            step={0.05}
            value={settings.amplitude}
            onChange={(v) => patch({ amplitude: v })}
            display={`${settings.amplitude.toFixed(2)}×`}
            editable
          />
        </div>
        {settings.excitation === 'harmonic' ? (
          <div style={{ width: 140 }}>
            <Slider
              label={t.frequencyLabel}
              min={0.1}
              max={100}
              step={0.1}
              value={settings.frequencyHz}
              onChange={(v) => patch({ frequencyHz: v })}
              display={`${settings.frequencyHz.toFixed(1)} Hz`}
              editable
            />
          </div>
        ) : null}
        {settings.excitation === 'ramp' ? (
          <div style={{ width: 140 }}>
            <Slider
              label={t.rampTimeLabel}
              min={0.01}
              max={2}
              step={0.01}
              value={settings.rampDuration}
              onChange={(v) => patch({ rampDuration: v })}
              display={`${settings.rampDuration.toFixed(2)} s`}
              editable
            />
          </div>
        ) : null}
        {settings.excitation === 'impulse' ? (
          <div style={{ width: 140 }}>
            <Slider
              label={t.impulseTimeLabel}
              min={0.001}
              max={0.5}
              step={0.001}
              value={settings.impulseDuration}
              onChange={(v) => patch({ impulseDuration: v })}
              display={`${settings.impulseDuration.toFixed(3)} s`}
              editable
            />
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          padding: '0 var(--space-6) var(--space-3)',
          fontSize: 12,
          flex: 'none',
        }}
      >
        <div style={{ width: 130 }}>
          <Slider
            label={t.dampingAlphaLabel}
            min={0}
            max={5}
            step={0.05}
            value={settings.dampingAlpha}
            onChange={(v) => patch({ dampingAlpha: v })}
            display={settings.dampingAlpha.toFixed(2)}
            editable
          />
        </div>
        <div style={{ width: 130 }}>
          <Slider
            label={t.dampingBetaLabel}
            min={0}
            max={0.05}
            step={0.0005}
            value={settings.dampingBeta}
            onChange={(v) => patch({ dampingBeta: v })}
            display={settings.dampingBeta.toFixed(4)}
            editable
          />
        </div>
        <div style={{ width: 130 }}>
          <Slider
            label="Δt [s]"
            min={0.0005}
            max={0.5}
            step={0.0005}
            value={settings.dt}
            onChange={(v) => patch({ dt: v })}
            display={`${settings.dt.toFixed(4)} s`}
            editable
          />
        </div>
        <div style={{ width: 130 }}>
          <Slider
            label={t.stepCountLabel}
            min={10}
            max={3000}
            step={10}
            value={settings.steps}
            onChange={(v) => patch({ steps: Math.round(v) })}
            display={`${settings.steps} (${(settings.steps * settings.dt).toFixed(2)} s)`}
            editable
          />
        </div>
        <Button variant="primary" onClick={runIt}>
          {SHELL[lang].analysisRun}
        </Button>
        {run !== null ? (
          <SegmentedControl
            ariaLabel={t.displayedQuantityAria}
            value={quantity}
            onChange={setQuantity}
            options={[
              { value: 'w', label: 'w(t)' },
              { value: 'a', label: 'a(t)' },
            ]}
          />
        ) : null}
      </div>

      {error !== null ? (
        <div style={{ padding: 'var(--space-5)', fontSize: 12, color: 'var(--text-muted)' }}>
          {t.dynamicRunFailed(error)}
        </div>
      ) : run === null ? (
        <div style={{ padding: 'var(--space-5)', fontSize: 12, color: 'var(--text-faint)' }}>
          {t.noDynamicResult}
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, height: TRANSIENT_CHART_HEIGHT }}>
          <TransientChart run={run} quantity={quantity} lang={lang} />
        </div>
      )}
    </div>
  );
}
