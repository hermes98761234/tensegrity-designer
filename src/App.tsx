import { useEffect, useMemo, useState } from 'react'
import { tr, type T } from './i18n'
import type { Settings } from './lib/analysis'
import type { Design } from './lib/model'
import { defaultParams } from './lib/presets'
import { getPreset, loadState, saveState, type AppState } from './state'
import { useAnalysis } from './useAnalysis'
import Controls from './components/Controls'
import { BuildList, Summary } from './components/Results'
import TopologyEditor from './components/TopologyEditor'
import Viewport from './components/Viewport'

export default function App() {
  const [state, setState] = useState<AppState>(loadState)
  const [selected, setSelected] = useState<number | null>(null)
  const t: T = (s, ...a) => tr(state.lang, s, ...a)
  const preset = getPreset(state.preset)
  const design = useMemo<Design>(() => state.edited ?? preset.make(state.params), [state.edited, state.params, preset])
  const { analysis, busy, error } = useAnalysis(design, state.settings)
  const update = (patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch }))

  useEffect(() => saveState(state), [state])
  useEffect(() => {
    const root = document.documentElement
    if (state.theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = state.theme
    root.lang = state.lang
  }, [state.theme, state.lang])

  const fitKey = `${state.preset}:${JSON.stringify(state.params)}`
  const setPreset = (id: string) => {
    setSelected(null)
    update({ preset: id, params: defaultParams(getPreset(id)), edited: null })
  }
  const edit = (d: Design) => {
    setSelected(null)
    update({ edited: d })
  }
  const shown = analysis && analysis.design.members.length === design.members.length ? analysis : null
  const title = t(preset.name)

  return (
    <div className="app">
      <header className="toolbar no-print">
        <span className="brand">{t('Tensegrity Designer')}</span>
        <span className="hint grow">{t('Form-finding, stability and build list for tensegrity structures.')}</span>
        <label className="inline">
          {t('Language')}{' '}
          <select value={state.lang} onChange={(e) => update({ lang: e.target.value as AppState['lang'] })}>
            <option value="en">English</option>
            <option value="uk">Українська</option>
          </select>
        </label>
        <label className="inline">
          {t('Theme')}{' '}
          <select value={state.theme} onChange={(e) => update({ theme: e.target.value as AppState['theme'] })}>
            <option value="auto">{t('System')}</option>
            <option value="light">{t('Light')}</option>
            <option value="dark">{t('Dark')}</option>
          </select>
        </label>
      </header>
      <div className="body">
        <aside className="side no-print">
          <div className="panel">
            <Controls
              state={state}
              t={t}
              onPreset={setPreset}
              onParam={(key, v) => update({ params: { ...state.params, [key]: v }, edited: null })}
              onUnit={(unit) => update({ unit })}
              onSettings={(patch: Partial<Settings>) => update({ settings: { ...state.settings, ...patch } })}
              onView={update}
            />
            <TopologyEditor design={design} edited={state.edited !== null} selected={selected} t={t} onSelect={setSelected} onChange={edit} onReset={() => update({ edited: null })} />
          </div>
        </aside>
        <main className="main">
          <div className="box no-print">
            <div className="scene">
              <Viewport analysis={shown} fitKey={fitKey} labels={state.labels} rotate={state.rotate} selected={selected} onSelect={setSelected} />
              {(busy || error) && <div className={`scene-msg ${error ? 'err-text' : ''}`}>{error ? t('Could not find a shape: {0}', error) : t('Calculating…')}</div>}
            </div>
            <div className="legend">
              <span>{t('Cable tension')}</span>
              <i className="bar" />
              <span>{shown ? `${Math.min(...shown.rows.filter((r) => r.type === 'cable').map((r) => r.force)).toFixed(0)} – ${shown.maxCableForce.toFixed(0)} N` : ''}</span>
              <span className="grow" />
              <span className="hint">{t('Drag to orbit, scroll to zoom, right-drag to pan.')}</span>
            </div>
          </div>
          {shown && (
            <>
              <div className="no-print">
                <Summary a={shown} t={t} />
              </div>
              <BuildList a={shown} unit={state.unit} title={title} selected={selected} t={t} onSelect={setSelected} />
            </>
          )}
          <p className="hint foot no-print">
            {t('Results are idealised: pin-jointed members, linear elasticity, no self-weight.')}{' '}
            <a href="https://github.com/hermes98761234/tensegrity-designer">{t('Source on GitHub')}</a>
          </p>
        </main>
      </div>
    </div>
  )
}
