import { eigenSym } from './linalg'
import type { Design } from './model'

/** Equilibrium matrix A (3N × m): column k holds the node force per unit force density of member k. A·q = 0 is self-equilibrium. */
export function equilibriumMatrix(d: Design, pos: ArrayLike<number> = d.pos): Float64Array {
  const n = d.labels.length
  const m = d.members.length
  const A = new Float64Array(3 * n * m)
  d.members.forEach((e, k) => {
    for (let c = 0; c < 3; c++) {
      const diff = pos[3 * e.b + c] - pos[3 * e.a + c]
      A[(3 * e.a + c) * m + k] += diff
      A[(3 * e.b + c) * m + k] -= diff
    }
  })
  return A
}

/** Force density matrix D (N × N, Schek 1974): D·x = 0 for each coordinate column in equilibrium. */
export function stressMatrix(d: Design, q: ArrayLike<number>): Float64Array {
  const n = d.labels.length
  const D = new Float64Array(n * n)
  d.members.forEach((e, k) => {
    D[e.a * n + e.a] += q[k]
    D[e.b * n + e.b] += q[k]
    D[e.a * n + e.b] -= q[k]
    D[e.b * n + e.a] -= q[k]
  })
  return D
}

/** Relative equilibrium residual |A q| / (|A| |q|) for force densities q. */
export function residual(d: Design, q: ArrayLike<number>, pos: ArrayLike<number> = d.pos): number {
  const A = equilibriumMatrix(d, pos)
  const m = d.members.length
  let r = 0
  let a2 = 0
  let q2 = 0
  for (let i = 0; i < A.length / m; i++) {
    let s = 0
    for (let k = 0; k < m; k++) s += A[i * m + k] * q[k]
    r += s * s
  }
  for (const x of A) a2 += x * x
  for (let k = 0; k < m; k++) q2 += q[k] * q[k]
  return Math.sqrt(r / (a2 * q2 || 1))
}

/** |D·x| / (|D| |x|) over the three coordinate columns: zero when the geometry is in equilibrium for D. */
function stressResidual(D: Float64Array, pos: ArrayLike<number>, n: number): number {
  let r = 0
  let x2 = 0
  let d2 = 0
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      let s = 0
      for (let j = 0; j < n; j++) s += D[i * n + j] * pos[3 * j + c]
      r += s * s
      x2 += pos[3 * i + c] ** 2
    }
  }
  for (const v of D) d2 += v * v
  return Math.sqrt(r / (x2 * d2 || 1))
}

/** Target force densities: cables +1, struts -strutRatio. */
const target = (d: Design, strutRatio: number) => d.members.map((e) => (e.type === 'cable' ? 1 : -strutRatio))

/**
 * Self-stress states of the geometry: the (near-)null space of AᵀA. When several states exist
 * the one closest to the target (cables +1, struts -1) is returned, scaled so the mean cable density is 1.
 */
export function selfStress(d: Design, pos: ArrayLike<number> = d.pos, strutRatio = 1): { q: number[]; nullity: number; lowest: number } {
  const m = d.members.length
  const A = equilibriumMatrix(d, pos)
  const rows = A.length / m
  const G = new Float64Array(m * m)
  for (let i = 0; i < rows; i++) {
    for (let a = 0; a < m; a++) {
      const x = A[i * m + a]
      if (x === 0) continue
      for (let b = 0; b < m; b++) G[a * m + b] += x * A[i * m + b]
    }
  }
  const { values, vectors } = eigenSym(G, m)
  const scale = Math.max(values[m - 1], 1e-300)
  let k = 1
  while (k < m && values[k] <= values[0] + 1e-9 * scale) k++
  const t = target(d, strutRatio)
  const q = new Array<number>(m).fill(0)
  for (let j = 0; j < k; j++) {
    let dot = 0
    for (let i = 0; i < m; i++) dot += vectors[i * m + j] * t[i]
    for (let i = 0; i < m; i++) q[i] += dot * vectors[i * m + j]
  }
  let cs = 0
  let cn = 0
  d.members.forEach((e, i) => {
    if (e.type === 'cable') {
      cs += q[i]
      cn++
    }
  })
  const norm = cn ? cs / cn : q.reduce((s, x) => s + x, 0) / m
  return { q: q.map((x) => (norm ? x / norm : x)), nullity: values[0] <= 1e-9 * scale ? k : 0, lowest: values[0] / scale }
}

export interface FormFindResult {
  design: Design
  q: number[]
  iterations: number
  converged: boolean
}

/**
 * Force-density form-finding by alternating projections: find the self-stress q of the current
 * geometry, then replace the coordinates by their projection onto the four eigenvectors of the
 * stress matrix D(q) with the smallest |eigenvalue| (D·x = 0 needs a 4-dimensional null space in 3D).
 */
export function forceDensityFormFind(d: Design, opts: { maxIter?: number; tol?: number; strutRatio?: number } = {}): FormFindResult {
  const { maxIter = 200, tol = 1e-10, strutRatio = 1 } = opts
  const n = d.labels.length
  let pos = d.pos.slice()
  // work with the centred cloud at its original RMS size
  const centre = [0, 0, 0].map((_, c) => pos.reduce((s, _v, i) => s + (i % 3 === c ? _v : 0), 0) / n)
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) pos[3 * i + c] -= centre[c]
  const rms = Math.sqrt(pos.reduce((s, v) => s + v * v, 0) / n) || 1
  let q: number[] = []
  let converged = false
  let it = 0
  for (; it < maxIter; it++) {
    q = selfStress(d, pos, strutRatio).q
    const D = stressMatrix(d, q)
    if (stressResidual(D, pos, n) < tol) {
      converged = true
      break
    }
    const { values, vectors } = eigenSym(D, n)
    const idx = Array.from({ length: n }, (_, i) => i).sort((i, j) => Math.abs(values[i]) - Math.abs(values[j])).slice(0, 4)
    const next = new Array<number>(3 * n).fill(0)
    for (let c = 0; c < 3; c++) {
      for (const j of idx) {
        let dot = 0
        for (let i = 0; i < n; i++) dot += vectors[i * n + j] * pos[3 * i + c]
        for (let i = 0; i < n; i++) next[3 * i + c] += dot * vectors[i * n + j]
      }
    }
    const nr = Math.sqrt(next.reduce((s, v) => s + v * v, 0) / n) || 1
    let diff = 0
    for (let i = 0; i < next.length; i++) {
      next[i] *= rms / nr
      diff += (next[i] - pos[i]) ** 2
    }
    pos = next
    if (Math.sqrt(diff / n) < tol * rms) {
      converged = true
      break
    }
  }
  q = selfStress(d, pos, strutRatio).q
  return { design: { ...d, pos }, q, iterations: it + 1, converged }
}
