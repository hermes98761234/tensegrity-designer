/** Symmetric eigen-decomposition by cyclic Jacobi rotations. `a` is n×n row-major (not modified). */
export function eigenSym(a: ArrayLike<number>, n: number): { values: Float64Array; vectors: Float64Array } {
  const m = Float64Array.from(a)
  const v = new Float64Array(n * n)
  for (let i = 0; i < n; i++) v[i * n + i] = 1
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0
    let diag = 0
    for (let i = 0; i < n; i++) {
      diag += m[i * n + i] ** 2
      for (let j = i + 1; j < n; j++) off += m[i * n + j] ** 2
    }
    if (off <= 1e-26 * (diag + off) || off === 0) break
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = m[p * n + q]
        if (Math.abs(apq) < 1e-300) continue
        const theta = (m[q * n + q] - m[p * n + p]) / (2 * apq)
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        for (let k = 0; k < n; k++) {
          const kp = m[k * n + p]
          const kq = m[k * n + q]
          m[k * n + p] = c * kp - s * kq
          m[k * n + q] = s * kp + c * kq
        }
        for (let k = 0; k < n; k++) {
          const pk = m[p * n + k]
          const qk = m[q * n + k]
          m[p * n + k] = c * pk - s * qk
          m[q * n + k] = s * pk + c * qk
        }
        for (let k = 0; k < n; k++) {
          const kp = v[k * n + p]
          const kq = v[k * n + q]
          v[k * n + p] = c * kp - s * kq
          v[k * n + q] = s * kp + c * kq
        }
      }
    }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => m[i * n + i] - m[j * n + j])
  const values = new Float64Array(n)
  const vectors = new Float64Array(n * n) // column k = k-th smallest eigenvector
  order.forEach((src, k) => {
    values[k] = m[src * n + src]
    for (let r = 0; r < n; r++) vectors[r * n + k] = v[r * n + src]
  })
  return { values, vectors }
}
