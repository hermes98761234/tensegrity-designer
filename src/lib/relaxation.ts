import { memberLength, type Design } from './model'

export interface RelaxResult {
  design: Design
  iterations: number
  converged: boolean
  /** Largest unbalanced nodal force relative to the cable force density times the structure size. */
  residual: number
}

/**
 * Dynamic relaxation with kinetic damping (Barnes 1999). Cables are zero-rest-length springs of
 * force density `densities[k]` or `cableDensity` (tension = q·L); struts are stiff springs holding their initial length.
 * The fictitious mass of a node is the sum of the stiffnesses meeting there, so unit steps are stable.
 */
export function dynamicRelaxation(d: Design, opts: { cableDensity?: number; densities?: ArrayLike<number>; strutStiffness?: number; maxIter?: number; tol?: number } = {}): RelaxResult {
  const { cableDensity = 1, densities, strutStiffness = 2000, maxIter = 200000, tol = 1e-8 } = opts
  const n = d.labels.length
  const pos = Float64Array.from(d.pos)
  const vel = new Float64Array(3 * n)
  const f = new Float64Array(3 * n)
  const rest = d.members.map((m) => (m.type === 'strut' ? memberLength(d.pos, m) : 0))
  const stiff = d.members.map((m, k) => (m.type === 'strut' ? strutStiffness * cableDensity : (densities?.[k] ?? cableDensity)))
  const mass = new Float64Array(n)
  d.members.forEach((m, k) => {
    mass[m.a] += stiff[k]
    mass[m.b] += stiff[k]
  })
  let size = 0
  for (let i = 0; i < 3 * n; i++) size = Math.max(size, Math.abs(pos[i]))
  let prevKe = 0
  let residual = Infinity
  let it = 0
  for (; it < maxIter; it++) {
    f.fill(0)
    d.members.forEach((m, k) => {
      const dx = pos[3 * m.b] - pos[3 * m.a]
      const dy = pos[3 * m.b + 1] - pos[3 * m.a + 1]
      const dz = pos[3 * m.b + 2] - pos[3 * m.a + 2]
      const L = Math.hypot(dx, dy, dz) || 1e-12
      const t = stiff[k] * (L - rest[k]) / L // tension per unit length
      f[3 * m.a] += t * dx
      f[3 * m.a + 1] += t * dy
      f[3 * m.a + 2] += t * dz
      f[3 * m.b] -= t * dx
      f[3 * m.b + 1] -= t * dy
      f[3 * m.b + 2] -= t * dz
    })
    let ke = 0
    let fmax = 0
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) {
        const j = 3 * i + c
        vel[j] += f[j] / mass[i]
        ke += mass[i] * vel[j] * vel[j]
        fmax = Math.max(fmax, Math.abs(f[j]))
      }
    }
    residual = fmax / (cableDensity * size)
    if (residual < tol) break
    if (ke < prevKe) vel.fill(0) // kinetic energy peak passed: restart from rest
    prevKe = ke
    for (let j = 0; j < 3 * n; j++) pos[j] += vel[j]
  }
  return { design: { ...d, pos: Array.from(pos) }, iterations: it, converged: residual < tol, residual }
}
