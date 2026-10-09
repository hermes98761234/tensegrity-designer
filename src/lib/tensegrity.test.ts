import { describe, expect, it } from 'vitest'
import { analyze, DEFAULT_SETTINGS } from './analysis'
import { buildListCsv, cutSummary } from './buildlist'
import { forceDensityFormFind, residual, selfStress, stressMatrix } from './formfinding'
import { memberLength, type Design } from './model'
import { icosahedron, PRESETS, defaultParams, prism, prismTwist, stackedPrisms } from './presets'
import { dynamicRelaxation } from './relaxation'

const deg = (r: number) => (r * 180) / Math.PI
const angle = (d: Design, i: number) => Math.atan2(d.pos[3 * i + 1], d.pos[3 * i])
/** Angle from `a` to `b` around the z axis, in (-180°, 180°]. */
const span = (d: Design, a: number, b: number) => {
  let x = deg(angle(d, b) - angle(d, a))
  while (x > 180) x -= 360
  while (x <= -180) x += 360
  return x
}
/**
 * Prism twist from member lengths only (invariant under rigid motions). With ring radius R,
 * strut² - saddle² = 2R²(cos α - cos(α + 2π/n)); n = 3 here.
 */
const prismTwist3 = (d: Design) => {
  const len = (a: number, b: number) => memberLength(d.pos, { a, b, type: 'cable' })
  const R2 = len(0, 1) ** 2 / 3
  const x = (len(0, 4) ** 2 - len(0, 3) ** 2) / (2 * R2) // = cos α - cos(α + 120°), which is √3 at α = 30°
  return x
}
const lengths = (d: Design, type: string) => d.members.filter((m) => m.type === type).map((m) => memberLength(d.pos, m))

describe('prism twist', () => {
  it('is 90° − 180°/n', () => {
    expect(deg(prismTwist(3))).toBeCloseTo(30, 10)
    expect(deg(prismTwist(4))).toBeCloseTo(45, 10)
    expect(deg(prismTwist(5))).toBeCloseTo(54, 10)
    expect(deg(prismTwist(6))).toBeCloseTo(60, 10)
  })

  it('T-prism: the struts span 150° (30° twist + 120°) and the structure is in self-equilibrium', () => {
    const d = prism(3)
    // strut B1 -> T2 spans 150°, the saddle cable B1 -> T1 spans 30°
    expect(span(d, 0, 4)).toBeCloseTo(150, 9)
    expect(span(d, 0, 3)).toBeCloseTo(30, 9)
    const ss = selfStress(d)
    expect(ss.nullity).toBe(1)
    expect(residual(d, ss.q)).toBeLessThan(1e-13)
  })

  it('has a self-stress state only at the 90° − 180°/n twist', () => {
    for (const n of [3, 4, 5, 6]) {
      const ok = selfStress(prism(n))
      expect(ok.nullity, `n=${n}`).toBe(1)
      const bad = prism(n)
      const turn = 0.25 // rad
      for (let i = 0; i < n; i++) {
        const a = prismTwist(n) + (2 * Math.PI * i) / n + turn
        bad.pos[3 * (n + i)] = Math.cos(a)
        bad.pos[3 * (n + i) + 1] = Math.sin(a)
      }
      expect(selfStress(bad).nullity, `n=${n} twisted`).toBe(0)
    }
  })

  it('force-density form-finding from a distorted start converges to a valid self-equilibrium', () => {
    const d = prism(3, 1.3)
    d.pos = d.pos.map((v, i) => v + 0.05 * Math.sin(5 * i + 1))
    const dd = { ...d, pos: d.pos.slice() }
    const r = forceDensityFormFind(dd, { maxIter: 500 })
    expect(r.converged).toBe(true)
    expect(residual(r.design, r.q)).toBeLessThan(1e-8)
    r.design.members.forEach((m, k) => expect(m.type === 'cable' ? r.q[k] > 0 : r.q[k] < 0).toBe(true))
  })

  it('dynamic relaxation with the prism force densities untwists to 30° from a flat start', () => {
    const ref = prism(3, 1.5)
    const flat = { ...ref, pos: ref.pos.slice() }
    for (let i = 3; i < 6; i++) {
      const a = (2 * Math.PI * (i - 3)) / 3
      flat.pos[3 * i] = Math.cos(a)
      flat.pos[3 * i + 1] = Math.sin(a)
    }
    const r = dynamicRelaxation(flat, { densities: selfStress(ref).q })
    expect(r.converged).toBe(true)
    expect(prismTwist3(r.design)).toBeCloseTo(Math.sqrt(3), 3)
    expect(residual(r.design, selfStress(r.design).q)).toBeLessThan(1e-6)
  })
})

describe('icosahedron (expanded octahedron)', () => {
  it('has 6 equal struts, 24 equal cables, strut/cable = √(8/3) and q_strut = -1.5 q_cable', () => {
    const d = icosahedron()
    expect(d.members.filter((m) => m.type === 'strut')).toHaveLength(6)
    const cables = lengths(d, 'cable')
    const struts = lengths(d, 'strut')
    expect(cables).toHaveLength(24)
    for (const c of cables) expect(c).toBeCloseTo(cables[0], 12)
    for (const s of struts) expect(s).toBeCloseTo(struts[0], 12)
    expect(struts[0] / cables[0]).toBeCloseTo(Math.sqrt(8 / 3), 12)
    const ss = selfStress(d)
    expect(ss.nullity).toBe(1)
    expect(residual(d, ss.q)).toBeLessThan(1e-13)
    d.members.forEach((m, k) => expect(ss.q[k]).toBeCloseTo(m.type === 'cable' ? 1 : -1.5, 10))
  })

  const phi = (1 + Math.sqrt(5)) / 2
  /** Struts of length 2φ and cables of length 2: the regular icosahedron, which is not in equilibrium. */
  const regular = () => {
    const d = icosahedron()
    return { ...d, pos: d.pos.map((v) => (Math.abs(v) > 1.5 ? (Math.sign(v) * 2 * phi) / 2 : v)) }
  }

  it('force-density form-finding turns the regular icosahedron into the √(8/3) tensegrity', () => {
    const start = regular()
    expect(selfStress(start).nullity).toBe(0)
    const r = forceDensityFormFind(start, { maxIter: 500 })
    expect(r.converged).toBe(true)
    const [c, s] = [lengths(r.design, 'cable'), lengths(r.design, 'strut')]
    expect(Math.max(...c) / Math.min(...c)).toBeCloseTo(1, 6)
    expect(Math.max(...s) / Math.min(...s)).toBeCloseTo(1, 6)
    expect(s[0] / c[0]).toBeCloseTo(Math.sqrt(8 / 3), 5)
  })

  it('dynamic relaxation reaches the same ratio with equal cable densities', () => {
    const r = dynamicRelaxation(regular())
    expect(r.converged).toBe(true)
    const [c, s] = [lengths(r.design, 'cable'), lengths(r.design, 'strut')]
    expect(s[0] / c[0]).toBeCloseTo(Math.sqrt(8 / 3), 2)
  })
})

describe('force density matrix', () => {
  it('annihilates the coordinates (and the ones vector) in equilibrium', () => {
    for (const p of PRESETS) {
      const d = p.make(defaultParams(p))
      const { q } = selfStress(d)
      const D = stressMatrix(d, q)
      const n = d.labels.length
      for (let i = 0; i < n; i++) {
        let one = 0
        const xyz = [0, 0, 0]
        for (let j = 0; j < n; j++) {
          one += D[i * n + j]
          for (let c = 0; c < 3; c++) xyz[c] += D[i * n + j] * d.pos[3 * j + c]
        }
        expect(Math.abs(one), p.id).toBeLessThan(1e-12)
        for (const v of xyz) expect(Math.abs(v), p.id).toBeLessThan(1e-9)
      }
    }
  })
})

describe('analyze', () => {
  it('every preset: tension in cables, compression in struts, residual ~ 0', () => {
    for (const p of PRESETS) {
      const a = analyze(p.make(defaultParams(p)), DEFAULT_SETTINGS)
      expect(a.valid, p.id).toBe(true)
      expect(a.residual, p.id).toBeLessThan(1e-9)
      for (const r of a.rows) expect(r.type === 'cable' ? r.force > 0 : r.force < 0, `${p.id} ${r.id}`).toBe(true)
    }
  })

  it('prisms, the icosahedron and stacked towers are prestress stable', () => {
    for (const id of ['tprism', 'prism', 'icosahedron', 'tower', 'snelson']) {
      const p = PRESETS.find((q) => q.id === id)!
      const a = analyze(p.make(defaultParams(p)), DEFAULT_SETTINGS)
      expect(a.stability.stable, id).toBe(true)
      expect(a.stability.mechanisms, id).toBe(0)
      expect(a.stability.negativeModes, id).toBe(0)
    }
  })

  it('scales the struts to the chosen length and sets the prestrain on the top cable', () => {
    const s = { ...DEFAULT_SETTINGS, strutLength: 45, prestrain: 3, cableEA: 10000 }
    const a = analyze(prism(3), s)
    for (const r of a.rows.filter((x) => x.type === 'strut')) expect(r.length).toBeCloseTo(45, 9)
    const cables = a.rows.filter((x) => x.type === 'cable')
    const top = cables.reduce((m, r) => (r.force > m.force ? r : m))
    expect(top.force).toBeCloseTo(300, 6) // EA · 3 %
    expect(top.restLength).toBeCloseTo(top.length / 1.03, 9)
    for (const r of cables) expect(r.restLength).toBeLessThan(r.length)
  })

  it('member forces balance at every node', () => {
    const a = analyze(stackedPrisms(3, 2), DEFAULT_SETTINGS)
    const sum = new Array(3 * a.design.labels.length).fill(0)
    a.design.members.forEach((m, k) => {
      const L = memberLength(a.pos, m)
      for (let c = 0; c < 3; c++) {
        const f = (a.rows[k].force * (a.pos[3 * m.b + c] - a.pos[3 * m.a + c])) / L
        sum[3 * m.a + c] += f
        sum[3 * m.b + c] -= f
      }
    })
    for (const v of sum) expect(Math.abs(v)).toBeLessThan(1e-6 * DEFAULT_SETTINGS.cableEA)
  })

  it('reports a structure without a self-stress state as invalid', () => {
    const d = prism(3)
    d.members = d.members.filter((m) => m.type === 'strut' || (m.a !== 5 && m.b !== 5)) // node T3 keeps only its strut
    const a = analyze(d, DEFAULT_SETTINGS)
    expect(a.valid).toBe(false)
  })

  it('detects the mechanism of a prism whose saddle cables are removed', () => {
    const d = prism(4)
    // keep the rings and struts only: no stable self-stress exists
    d.members = d.members.filter((m, k) => m.type === 'strut' || k < 8)
    const a = analyze(d, DEFAULT_SETTINGS)
    expect(a.stability.stable).toBe(false)
  })

  it('dynamic relaxation method gives an equilibrium with valid signs', () => {
    const a = analyze(prism(4), { ...DEFAULT_SETTINGS, method: 'dr' })
    expect(a.valid).toBe(true)
    expect(a.residual).toBeLessThan(1e-6)
  })
})

describe('build list', () => {
  it('exports one CSV line per member with labels and lengths', () => {
    const a = analyze(prism(3), { ...DEFAULT_SETTINGS, strutLength: 30 })
    const lines = buildListCsv(a.rows, 'cm').trim().split('\n')
    expect(lines).toHaveLength(13)
    expect(lines[0]).toBe('id,type,from,to,length (cm),cut length (cm),force (N)')
    expect(lines.filter((l) => l.includes(',strut,'))).toHaveLength(3)
    expect(lines.find((l) => l.startsWith('S1,'))).toMatch(/^S1,strut,B1,T2,30\.00,/)
  })
  it('groups equal pieces', () => {
    const a = analyze(icosahedron(), DEFAULT_SETTINGS)
    const sum = cutSummary(a.rows, 'cm')
    expect(sum.find((s) => s.type === 'cable')?.count).toBe(24)
    expect(sum.find((s) => s.type === 'strut')?.count).toBe(6)
  })
})
