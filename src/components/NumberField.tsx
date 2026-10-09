import { useState } from 'react'

interface Props {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
}

/** Number input that keeps the raw text while focused and only reports values inside [min, max]. */
export default function NumberField({ label, value, min, max, step, onChange }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const v = draft === null ? NaN : Number(draft)
  const bad = draft !== null && (draft.trim() === '' || !(v >= min && v <= max))
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step ?? 'any'}
        min={min}
        max={max}
        className={bad ? 'bad' : undefined}
        aria-invalid={bad}
        value={draft ?? String(+value.toPrecision(6))}
        onChange={(e) => {
          setDraft(e.target.value)
          const x = Number(e.target.value)
          if (e.target.value.trim() !== '' && x >= min && x <= max) onChange(x)
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  )
}
