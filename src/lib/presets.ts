import type { Design, Member } from './model'

const TAU = 2 * Math.PI

/** Twist of the top polygon of an n-strut prism relative to the bottom one: 90° − 180°/n (radians). */
export const prismTwist = (n: number) => Math.PI / 2 - Math.PI / n

function build(labels: string[], pos: number[][], members: [number, number, 'cable' | 'strut'][]): Design {
  return { labels, pos: pos.flat(), members: members.map(([a, b, type]): Member => ({ a, b, type })) }
}

/** Ring of n nodes at the given height; `shift` rotates the ring (radians). */
const ring = (n: number, r: number, z: number, shift: number) => Array.from({ length: n }, (_, i) => [r * Math.cos(shift + (TAU * i) / n), r * Math.sin(shift + (TAU * i) / n), z])

/** n-strut prism: bottom ring B, top ring T twisted by 90° − 180°/n, strut Bi→T(i+1), saddle cable Bi→Ti. Radius 1. */
export function prism(n: number, height = 1.5): Design {
  return stackedPrisms(n, 1, height)
}

/**
 * `stages` prisms on top of each other. Stage s has rings R(s) and R(s+1); a shared ring is one set of
 * nodes carrying a strut end of each neighbouring stage. Every stage twists the same way.
 */
export function stackedPrisms(n: number, stages: number, height = 1.5): Design {
  const alpha = prismTwist(n)
  const labels: string[] = []
  const pos: number[][] = []
  const at = (s: number, i: number) => s * n + (((i % n) + n) % n)
  for (let s = 0; s <= stages; s++) {
    const name = s === 0 ? 'B' : s === stages ? 'T' : `M${s}.`
    ring(n, 1, s * height, s * alpha).forEach((p, i) => {
      labels.push(`${name}${i + 1}`)
      pos.push(p)
    })
  }
  const mem: [number, number, 'cable' | 'strut'][] = []
  for (let s = 0; s <= stages; s++) for (let i = 0; i < n; i++) mem.push([at(s, i), at(s, i + 1), 'cable'])
  for (let s = 0; s < stages; s++) {
    for (let i = 0; i < n; i++) {
      mem.push([at(s, i), at(s + 1, i + 1), 'strut'])
      mem.push([at(s, i), at(s + 1, i), 'cable'])
    }
  }
  return build(labels, pos, mem)
}

/**
 * Expanded octahedron ("icosahedron" tensegrity): 6 struts in three orthogonal pairs, 24 cables.
 * Struts run along x, y and z at offsets ±1 in the next axis; each node has 4 cables to the nodes at distance √6.
 */
export function icosahedron(): Design {
  const labels: string[] = []
  const pos: number[][] = []
  const mem: [number, number, 'cable' | 'strut'][] = []
  const along = [(a: number, s: number) => [a, 0, s], (a: number, s: number) => [s, a, 0], (a: number, s: number) => [0, s, a]]
  for (const s of [-1, 1]) {
    for (const f of along) {
      mem.push([pos.length, pos.length + 1, 'strut'])
      for (const a of [-2, 2]) {
        labels.push(`N${pos.length + 1}`)
        pos.push(f(a, s))
      }
    }
  }
  for (let i = 0; i < pos.length; i++) {
    for (let j = i + 1; j < pos.length; j++) {
      const d2 = pos[i].reduce((sum, v, c) => sum + (v - pos[j][c]) ** 2, 0)
      if (Math.abs(d2 - 6) < 1e-9) mem.push([i, j, 'cable'])
    }
  }
  return build(labels, pos, mem)
}

/** Snelson's planar X-module: two crossing struts held by a rectangle of cables; `stages` modules share their horizontal cables. */
export function xModule(stages = 1, aspect = 1): Design {
  const labels: string[] = []
  const pos: number[][] = []
  const mem: [number, number, 'cable' | 'strut'][] = []
  for (let r = 0; r <= stages; r++) {
    labels.push(`L${r}`, `R${r}`)
    pos.push([-1, r * aspect * 2, 0], [1, r * aspect * 2, 0])
    mem.push([2 * r, 2 * r + 1, 'cable'])
  }
  for (let s = 0; s < stages; s++) {
    mem.push([2 * s, 2 * s + 3, 'strut'], [2 * s + 1, 2 * s + 2, 'strut'], [2 * s, 2 * s + 2, 'cable'], [2 * s + 1, 2 * s + 3, 'cable'])
  }
  return build(labels, pos, mem)
}

export interface PresetParam {
  key: string
  label: string
  min: number
  max: number
  step: number
  value: number
}
export interface Preset {
  id: string
  name: string
  blurb: string
  params: PresetParam[]
  make: (p: Record<string, number>) => Design
}

const N = (s: string) => s // marks strings for translation (see i18n.ts)
const HEIGHT = { key: 'height', label: N('Height / radius'), min: 0.5, max: 4, step: 0.1, value: 1.5 }

export const PRESETS: Preset[] = [
  {
    id: 'tprism',
    name: N('T-prism (3 struts)'),
    blurb: N('The simplest spatial tensegrity: three struts, nine cables, top twisted 30° against the bottom.'),
    params: [HEIGHT],
    make: (p) => prism(3, p.height),
  },
  {
    id: 'prism',
    name: N('n-strut prism'),
    blurb: N('Two n-gons joined by n struts and n saddle cables. The twist is 90° − 180°/n.'),
    params: [{ key: 'n', label: N('Struts n'), min: 3, max: 12, step: 1, value: 5 }, HEIGHT],
    make: (p) => prism(p.n, p.height),
  },
  {
    id: 'icosahedron',
    name: N('Icosahedron (6 struts)'),
    blurb: N('Expanded octahedron: three orthogonal pairs of struts, 24 equal cables, strut/cable length √(8/3).'),
    params: [],
    make: () => icosahedron(),
  },
  {
    id: 'tower',
    name: N('Stacked prism tower'),
    blurb: N('Several n-strut prisms stacked on shared rings, all twisting the same way.'),
    params: [
      { key: 'n', label: N('Struts per stage'), min: 3, max: 8, step: 1, value: 4 },
      { key: 'stages', label: N('Stages'), min: 2, max: 6, step: 1, value: 3 },
      HEIGHT,
    ],
    make: (p) => stackedPrisms(p.n, p.stages, p.height),
  },
  {
    id: 'xmodule',
    name: N('X-module'),
    blurb: N('Snelson’s planar X: two crossing struts in a rectangle of cables. More modules share their horizontal cables.'),
    params: [{ key: 'stages', label: N('Modules'), min: 1, max: 3, step: 1, value: 1 }, { key: 'aspect', label: N('Height / width'), min: 0.5, max: 2, step: 0.1, value: 1 }],
    make: (p) => xModule(p.stages, p.aspect),
  },
  {
    id: 'snelson',
    name: N('Snelson-style tower'),
    blurb: N('A slender mast of stacked three-strut stages, like the needle towers of Kenneth Snelson.'),
    params: [{ key: 'stages', label: N('Stages'), min: 2, max: 8, step: 1, value: 4 }, { key: 'height', label: N('Height / radius'), min: 1, max: 4, step: 0.1, value: 2.2 }],
    make: (p) => stackedPrisms(3, p.stages, p.height),
  },
]

export const defaultParams = (preset: Preset): Record<string, number> => Object.fromEntries(preset.params.map((q) => [q.key, q.value]))
