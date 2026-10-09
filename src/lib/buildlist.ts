import type { MemberRow } from './analysis'

export const UNITS = ['mm', 'cm', 'm', 'in'] as const
export type Unit = (typeof UNITS)[number]

const num = (x: number, digits: number) => (Number.isFinite(x) ? x.toFixed(digits) : '')
export const lengthDigits = (u: Unit) => (u === 'mm' ? 1 : u === 'm' ? 4 : 2)

const field = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

/** CSV of the build list: one line per member with its type, end nodes, assembled length, cut length and prestress force. */
export function buildListCsv(rows: MemberRow[], unit: Unit): string {
  const dg = lengthDigits(unit)
  const head = ['id', 'type', 'from', 'to', `length (${unit})`, `cut length (${unit})`, 'force (N)']
  const lines = rows.map((r) => [r.id, r.type, r.from, r.to, num(r.length, dg), num(r.restLength, dg), num(r.force, 1)].map(field).join(','))
  return [head.join(','), ...lines].join('\n') + '\n'
}

/** Summary of how many pieces of each cut length are needed (rounded to the display precision). */
export function cutSummary(rows: MemberRow[], unit: Unit): { type: string; cut: string; count: number }[] {
  const dg = lengthDigits(unit)
  const map = new Map<string, { type: string; cut: string; count: number }>()
  for (const r of rows) {
    const cut = num(r.restLength, dg)
    const key = `${r.type}:${cut}`
    const e = map.get(key)
    if (e) e.count++
    else map.set(key, { type: r.type, cut, count: 1 })
  }
  return [...map.values()].sort((a, b) => a.type.localeCompare(b.type) || +b.cut - +a.cut)
}
