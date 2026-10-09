import { DEFAULT_SETTINGS, type Method, type Settings } from './lib/analysis'
import { UNITS, type Unit } from './lib/buildlist'
import type { Design } from './lib/model'
import { defaultParams, PRESETS, type Preset } from './lib/presets'

export type Lang = 'en' | 'uk'
export type Theme = 'auto' | 'light' | 'dark'

export interface AppState {
  lang: Lang
  theme: Theme
  preset: string
  params: Record<string, number>
  unit: Unit
  settings: Settings
  /** Hand-edited layout; null while the design is exactly the preset. */
  edited: Design | null
  labels: boolean
  rotate: boolean
}

const KEY = 'tensegrity-designer:v1'

export const getPreset = (id: string): Preset => PRESETS.find((p) => p.id === id) ?? PRESETS[0]

export const DEFAULT_STATE: AppState = {
  lang: 'en',
  theme: 'auto',
  preset: PRESETS[0].id,
  params: defaultParams(PRESETS[0]),
  unit: 'cm',
  settings: DEFAULT_SETTINGS,
  edited: null,
  labels: false,
  rotate: true,
}

const oneOf = <T extends string>(v: unknown, all: readonly T[], d: T): T => (all.includes(v as T) ? (v as T) : d)
const num = (v: unknown, d: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d)

function validDesign(v: unknown): v is Design {
  const d = v as Design | null
  return (
    !!d &&
    Array.isArray(d.labels) &&
    Array.isArray(d.pos) &&
    Array.isArray(d.members) &&
    d.pos.length === 3 * d.labels.length &&
    d.pos.every((x) => typeof x === 'number' && Number.isFinite(x)) &&
    d.members.every((m) => Number.isInteger(m.a) && Number.isInteger(m.b) && m.a !== m.b && m.a >= 0 && m.b >= 0 && m.a < d.labels.length && m.b < d.labels.length && (m.type === 'cable' || m.type === 'strut'))
  )
}

export function loadState(): AppState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!s || typeof s !== 'object') return DEFAULT_STATE
    const preset = getPreset(s.preset)
    const params = defaultParams(preset)
    for (const p of preset.params) params[p.key] = num(s.params?.[p.key], p.value, p.min, p.max)
    const st = s.settings ?? {}
    const d = DEFAULT_SETTINGS
    return {
      lang: oneOf(s.lang, ['en', 'uk'], 'en'),
      theme: oneOf(s.theme, ['auto', 'light', 'dark'], 'auto'),
      preset: preset.id,
      params,
      unit: oneOf(s.unit, UNITS, 'cm'),
      settings: {
        method: oneOf<Method>(st.method, ['fdm', 'dr'], d.method),
        strutLength: num(st.strutLength, d.strutLength, 0.001, 1e6),
        prestrain: num(st.prestrain, d.prestrain, 0.001, 50),
        cableEA: num(st.cableEA, d.cableEA, 1, 1e12),
        strutEA: num(st.strutEA, d.strutEA, 1, 1e12),
      },
      edited: validDesign(s.edited) ? s.edited : null,
      labels: s.labels === true,
      rotate: s.rotate !== false,
    }
  } catch {
    return DEFAULT_STATE
  }
}

export function saveState(s: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Private mode or quota: the app still works, it just won't remember.
  }
}
