import { describe, expect, it } from 'vitest'
import { eigenSym } from './linalg'

describe('eigenSym', () => {
  it('finds the eigenvalues of a known matrix', () => {
    // [[2,1,0],[1,2,1],[0,1,2]] has eigenvalues 2 - √2, 2, 2 + √2
    const { values } = eigenSym([2, 1, 0, 1, 2, 1, 0, 1, 2], 3)
    expect([...values]).toEqual([2 - Math.SQRT2, 2, 2 + Math.SQRT2].map((v) => expect.closeTo(v, 12)))
  })
  it('reconstructs A = V Λ Vᵀ with orthonormal V', () => {
    const n = 7
    const a = new Float64Array(n * n)
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) a[i * n + j] = a[j * n + i] = Math.sin(1 + 3 * i + 7 * j)
    const { values, vectors } = eigenSym(a, n)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let rec = 0
        let dot = 0
        for (let k = 0; k < n; k++) {
          rec += vectors[i * n + k] * values[k] * vectors[j * n + k]
          dot += vectors[k * n + i] * vectors[k * n + j]
        }
        expect(rec).toBeCloseTo(a[i * n + j], 10)
        expect(dot).toBeCloseTo(i === j ? 1 : 0, 10)
      }
    }
  })
})
