import { stressMatrix } from './formfinding'
import { eigenSym } from './linalg'
import { memberLength, type Design } from './model'

export interface Stability {
  /** Eigenvalues of the tangent stiffness K = K_E + K_G below this count as zero modes. */
  zeroModes: number
  negativeModes: number
  /** Zero modes beyond the 6 rigid-body motions (0 when the structure is prestress stable). */
  mechanisms: number
  /** Smallest non-rigid eigenvalue divided by the largest one. */
  margin: number
  stable: boolean
  /** Stress matrix D is positive semi-definite with rank N−4 (N−3 if planar): the stress condition of Connelly's super-stability. */
  stressPsd: boolean
}

/**
 * Tangent stiffness K = ∑ (EA/L) d dᵀ + (t/L)(I − d dᵀ) over members, with unit direction d, tension t.
 * Prestress stable ⇔ K is positive semi-definite with only the 6 rigid-body zero modes.
 * Uses `pos` and `forces` (tension positive) in consistent units; ea[k] is the axial stiffness of member k.
 */
export function tangentStiffness(d: Design, pos: ArrayLike<number>, forces: ArrayLike<number>, ea: ArrayLike<number>): Float64Array {
  const dof = 3 * d.labels.length
  const K = new Float64Array(dof * dof)
  d.members.forEach((e, k) => {
    const L = memberLength(pos, e)
    const u = [0, 1, 2].map((c) => (pos[3 * e.b + c] - pos[3 * e.a + c]) / L)
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const kij = (ea[k] / L - forces[k] / L) * u[i] * u[j] + (i === j ? forces[k] / L : 0)
        K[(3 * e.a + i) * dof + 3 * e.a + j] += kij
        K[(3 * e.b + i) * dof + 3 * e.b + j] += kij
        K[(3 * e.a + i) * dof + 3 * e.b + j] -= kij
        K[(3 * e.b + i) * dof + 3 * e.a + j] -= kij
      }
    }
  })
  return K
}

export function analyzeStability(d: Design, pos: ArrayLike<number>, forces: ArrayLike<number>, ea: ArrayLike<number>, q: ArrayLike<number>): Stability {
  const dof = 3 * d.labels.length
  const { values } = eigenSym(tangentStiffness(d, pos, forces, ea), dof)
  const top = Math.max(...values)
  const tol = 1e-8 * top
  const zeroModes = values.filter((v) => Math.abs(v) <= tol).length
  const negativeModes = values.filter((v) => v < -tol).length
  const positive = values.filter((v) => v > tol)
  const n = d.labels.length
  const D = eigenSym(stressMatrix(d, q), n).values
  const dTop = Math.max(...D.map(Math.abs)) || 1
  // a planar layout has only a 3-dimensional null space (x, y, 1); a spatial one has 4
  const spread = eigenSym(covariance(pos, n), 3).values
  const nullDim = spread[2] > 0 && spread[0] <= 1e-9 * spread[2] ? 3 : 4
  const mechanisms = Math.max(0, zeroModes - 6)
  return {
    zeroModes,
    negativeModes,
    mechanisms,
    margin: positive.length ? positive[0] / top : 0,
    stable: negativeModes === 0 && zeroModes === 6,
    stressPsd: D.every((v) => v >= -1e-9 * dTop) && D.filter((v) => Math.abs(v) <= 1e-9 * dTop).length === nullDim,
  }
}

function covariance(pos: ArrayLike<number>, n: number): Float64Array {
  const mean = [0, 1, 2].map((c) => Array.from({ length: n }, (_, i) => pos[3 * i + c]).reduce((s, v) => s + v, 0) / n)
  const C = new Float64Array(9)
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[3 * a + b] += (pos[3 * i + a] - mean[a]) * (pos[3 * i + b] - mean[b])
  return C
}
