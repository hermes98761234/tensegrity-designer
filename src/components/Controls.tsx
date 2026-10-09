import type { Settings } from '../lib/analysis'
import { UNITS, type Unit } from '../lib/buildlist'
import { PRESETS } from '../lib/presets'
import type { T } from '../i18n'
import { getPreset, type AppState } from '../state'
import NumberField from './NumberField'

interface Props {
  state: AppState
  t: T
  onPreset: (id: string) => void
  onParam: (key: string, v: number) => void
  onUnit: (u: Unit) => void
  onSettings: (patch: Partial<Settings>) => void
  onView: (patch: Partial<Pick<AppState, 'labels' | 'rotate'>>) => void
}

export default function Controls({ state, t, onPreset, onParam, onUnit, onSettings, onView }: Props) {
  const preset = getPreset(state.preset)
  const s = state.settings
  return (
    <>
      <section className="section">
        <h3>{t('Design')}</h3>
        <label className="field">
          <span>{t('Preset')}</span>
          <select value={preset.id} onChange={(e) => onPreset(e.target.value)}>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {t(p.name)}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">{t(preset.blurb)}</p>
        {preset.params.length > 0 && (
          <div className="grid2">
            {preset.params.map((p) => (
              <NumberField key={p.key} label={t(p.label)} value={state.params[p.key] ?? p.value} min={p.min} max={p.max} step={p.step} onChange={(v) => onParam(p.key, p.step === 1 ? Math.round(v) : v)} />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h3>{t('Build')}</h3>
        <div className="grid2">
          <label className="field">
            <span>{t('Units')}</span>
            <select value={state.unit} onChange={(e) => onUnit(e.target.value as Unit)}>
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
          <NumberField label={t('Strut length ({0})', state.unit)} value={s.strutLength} min={0.001} max={1e6} onChange={(v) => onSettings({ strutLength: v })} />
          <NumberField label={t('Cable prestrain (%)')} value={s.prestrain} min={0.001} max={50} onChange={(v) => onSettings({ prestrain: v })} />
          <span />
          <NumberField label={t('Cable stiffness EA (N)')} value={s.cableEA} min={1} max={1e12} onChange={(v) => onSettings({ cableEA: v })} />
          <NumberField label={t('Strut stiffness EA (N)')} value={s.strutEA} min={1} max={1e12} onChange={(v) => onSettings({ strutEA: v })} />
        </div>
        <p className="hint">{t('Strain of the most tensioned cable. Sets the prestress level and the cut length of every cable.')}</p>
        <label className="field">
          <span>{t('Form-finding')}</span>
          <select value={s.method} onChange={(e) => onSettings({ method: e.target.value as Settings['method'] })}>
            <option value="fdm">{t('Force density (eigen-decomposition)')}</option>
            <option value="dr">{t('Dynamic relaxation')}</option>
          </select>
        </label>
        <p className="hint">{t('Force density keeps the shape of the layout; dynamic relaxation holds strut lengths and gives all cables a force density from the start layout.')}</p>
      </section>

      <section className="section">
        <h3>{t('View')}</h3>
        <div className="row">
          <label className="check">
            <input type="checkbox" checked={state.labels} onChange={(e) => onView({ labels: e.target.checked })} /> {t('Node labels')}
          </label>
          <label className="check">
            <input type="checkbox" checked={state.rotate} onChange={(e) => onView({ rotate: e.target.checked })} /> {t('Auto-rotate')}
          </label>
        </div>
      </section>
    </>
  )
}
