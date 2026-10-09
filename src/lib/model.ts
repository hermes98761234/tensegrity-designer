export type MemberType = 'cable' | 'strut'
export interface Member {
  a: number
  b: number
  type: MemberType
}
/** A tensegrity layout: node labels, flat xyz positions and the member list. */
export interface Design {
  labels: string[]
  pos: number[]
  members: Member[]
}

export const nodeCount = (d: Design) => d.labels.length
export function memberLength(pos: ArrayLike<number>, m: Member): number {
  return Math.hypot(pos[3 * m.a] - pos[3 * m.b], pos[3 * m.a + 1] - pos[3 * m.b + 1], pos[3 * m.a + 2] - pos[3 * m.b + 2])
}
