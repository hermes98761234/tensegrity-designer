import { forceDensityFormFind, residual, selfStress } from './formfinding'
import { memberLength, type Design, type MemberType } from './model'
import { dynamicRelaxation } from './relaxation'
import { analyzeStability, type Stability } from './stability'

export type Method = 'fdm' | 'dr'

export interface Settings {
  method: Method
  /** Mean strut length in the chosen unit; sets the scale of the whole structure. */
  strutLength: number
  /** Strain of the most tensioned cable, in percent. Sets the prestress level. */
  prestrain: number
  /** Axial stiffness EA of a cable and of a strut, in force units (N). */
  cableEA: number
  strutEA: number
}

export interface MemberRow {
  id: string
  type: MemberType
  from: string
  to: string
  /** Length of the member in the assembled, prestressed structure. */
  length: number
  /** Unstressed length to cut: L / (1 + F/EA). */
  restLength: number
  /** Axial force, tension positive. */
  force: number
  /** Force density q = F / L (force per length). */
  density: number
}

export interface Analysis {
  /** Equilibrium geometry in normalised units (not yet scaled). */
  design: Design
  /** Positions in the chosen unit. */
  pos: number[]
  rows: MemberRow[]
  q: number[]
  /** Number of independent self-stress states of the geometry. */
  states: number
  /** All cables in tension and all struts in compression. */
  valid: boolean
  /** Relative equilibrium residual |A q| / (|A| |q|). */
  residual: number
  iterations: number
  converged: boolean
  stability: Stability
  maxCableForce: number
  maxStrutForce: number
}

export const DEFAULT_SETTINGS: Settings = { method: 'fdm', strutLength: 30, prestrain: 2, cableEA: 20000, strutEA: 200000 }

export function memberIds(d: Design): string[] {
  let c = 0
  let s = 0
  return d.members.map((m) => (m.type === 'cable' ? `C${++c}` : `S${++s}`))
}

/** Form-find `design` and compute scaled geometry, member forces, build list and stability. */
export function analyze(design: Design, settings: Settings): Analysis {
  let found: Design
  let iterations: number
  let converged: boolean
  if (settings.method === 'dr') {
    const start = selfStress(design).q
    const pos = start.filter((q, k) => design.members[k].type === 'cable' && q > 0)
    const fallback = pos.length ? pos.reduce((s, x) => s + x, 0) / pos.length : 1
    const r = dynamicRelaxation(design, { densities: start.map((q, k) => (design.members[k].type === 'cable' && q > 0 ? q : fallback)) })
    found = r.design
    iterations = r.iterations
    converged = r.converged
  } else {
    const r = forceDensityFormFind(design)
    found = r.design
    iterations = r.iterations
    converged = r.converged
  }
  const ss = selfStress(found)
  const q = ss.q
  const res = residual(found, q)
  const struts = found.members.filter((m) => m.type === 'strut')
  const ref = struts.length ? struts : found.members
  const meanLen = ref.reduce((s, m) => s + memberLength(found.pos, m), 0) / (ref.length || 1) || 1
  const k = settings.strutLength / meanLen
  const pos = found.pos.map((v) => v * k)
  const len = found.members.map((m) => memberLength(pos, m))
  const raw = q.map((x, i) => x * len[i])
  const valid = ss.nullity > 0 && found.members.every((m, i) => (m.type === 'cable' ? q[i] > 1e-9 : q[i] < -1e-9))
  const cableMax = Math.max(0, ...raw.filter((_, i) => found.members[i].type === 'cable'))
  const norm = cableMax > 0 ? cableMax : Math.max(...raw.map(Math.abs), 1e-12)
  const target = (settings.cableEA * settings.prestrain) / 100
  const force = raw.map((f) => (f * target) / norm)
  const ea = found.members.map((m) => (m.type === 'cable' ? settings.cableEA : settings.strutEA))
  const ids = memberIds(found)
  const rows: MemberRow[] = found.members.map((m, i) => ({
    id: ids[i],
    type: m.type,
    from: found.labels[m.a],
    to: found.labels[m.b],
    length: len[i],
    restLength: len[i] / (1 + force[i] / ea[i]),
    force: force[i],
    density: len[i] > 0 ? force[i] / len[i] : 0,
  }))
  const stability = analyzeStability(found, pos, force, ea, q)
  return {
    design: found,
    pos,
    rows,
    q,
    states: ss.nullity,
    valid,
    residual: res,
    iterations,
    converged,
    stability,
    maxCableForce: Math.max(0, ...force),
    maxStrutForce: Math.max(0, ...force.map((f) => -f)),
  }
}
