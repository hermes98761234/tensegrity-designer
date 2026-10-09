import { useState } from 'react'
import { memberIds } from '../lib/analysis'
import type { Design, MemberType } from '../lib/model'
import type { T } from '../i18n'

interface Props {
  design: Design
  edited: boolean
  selected: number | null
  t: T
  onSelect: (k: number | null) => void
  onChange: (d: Design) => void
  onReset: () => void
}

export default function TopologyEditor({ design, edited, selected, t, onSelect, onChange, onReset }: Props) {
  const [a, setA] = useState(0)
  const [b, setB] = useState(1)
  const [type, setType] = useState<MemberType>('cable')
  const ids = memberIds(design)
  const exists = a === b || design.members.some((m) => (m.a === a && m.b === b) || (m.a === b && m.b === a))
  const nodes = design.labels.map((l, i) => (
    <option key={l} value={i}>
      {l}
    </option>
  ))
  return (
    <section className="section">
      <h3>{t('Edit topology')}</h3>
      <p className="hint">{t('Click a member in the view or the list to select it. Form-finding re-runs after every change.')}</p>
      <ul className="members">
        {design.members.map((m, k) => (
          <li key={`${m.a}-${m.b}`} className={selected === k ? 'active' : undefined}>
            <button className="link" onClick={() => onSelect(selected === k ? null : k)}>
              <b>{ids[k]}</b> {design.labels[m.a]}–{design.labels[m.b]}
            </button>
            <select
              aria-label={t('Type')}
              value={m.type}
              onChange={(e) => onChange({ ...design, members: design.members.map((x, i) => (i === k ? { ...x, type: e.target.value as MemberType } : x)) })}
            >
              <option value="cable">{t('Cable')}</option>
              <option value="strut">{t('Strut')}</option>
            </select>
            <button className="small danger" title={t('Remove')} aria-label={`${t('Remove')} ${ids[k]}`} onClick={() => onChange({ ...design, members: design.members.filter((_, i) => i !== k) })}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="add">
        <label className="field">
          <span>{t('From')}</span>
          <select value={a} onChange={(e) => setA(+e.target.value)}>
            {nodes}
          </select>
        </label>
        <label className="field">
          <span>{t('To')}</span>
          <select value={b} onChange={(e) => setB(+e.target.value)}>
            {nodes}
          </select>
        </label>
        <label className="field">
          <span>{t('Type')}</span>
          <select value={type} onChange={(e) => setType(e.target.value as MemberType)}>
            <option value="cable">{t('Cable')}</option>
            <option value="strut">{t('Strut')}</option>
          </select>
        </label>
        <button disabled={exists} title={exists && a !== b ? t('That member already exists.') : undefined} onClick={() => onChange({ ...design, members: [...design.members, { a, b, type }] })}>
          {t('Add')}
        </button>
      </div>
      <div className="row">
        <button disabled={!edited} onClick={onReset}>
          {t('Reset to preset')}
        </button>
      </div>
    </section>
  )
}
