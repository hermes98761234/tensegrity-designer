import type { Analysis } from '../lib/analysis'
import { buildListCsv, cutSummary, lengthDigits, type Unit } from '../lib/buildlist'
import type { T } from '../i18n'

const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '–')
const sci = (x: number) => (x === 0 ? '0' : x.toExponential(1))

export function Summary({ a, t }: { a: Analysis; t: T }) {
  const s = a.stability
  const struts = a.rows.filter((r) => r.type === 'strut').length
  return (
    <div className="box">
      <h3>{t('Result')}</h3>
      <p className={`verdict ${a.valid ? 'ok' : 'warn'}`}>{a.valid ? t('Self-stress found: every cable is in tension and every strut in compression.') : t('No valid self-stress: the layout has no self-equilibrium, or some members would go slack.')}</p>
      <p className={`verdict ${s.stable ? 'ok' : 'err'}`}>{s.stable ? t('Prestress stable: the stiffness matrix is positive definite apart from the 6 rigid-body modes.') : t('Not prestress stable: {0} mechanism(s), {1} negative mode(s).', s.mechanisms, s.negativeModes)}</p>
      <table className="data facts">
        <tbody>
          <tr><td>{t('Nodes')}</td><td>{a.design.labels.length}</td><td>{t('Struts')}</td><td>{struts}</td></tr>
          <tr><td>{t('Cables')}</td><td>{a.rows.length - struts}</td><td>{t('Independent self-stress states')}</td><td>{a.states}</td></tr>
          <tr><td>{t('Equilibrium residual')}</td><td>{sci(a.residual)}</td><td>{t('Iterations')}</td><td>{a.iterations}</td></tr>
          <tr><td>{t('Max cable tension')}</td><td>{fmt(a.maxCableForce, 1)} N</td><td>{t('Max strut compression')}</td><td>{fmt(a.maxStrutForce, 1)} N</td></tr>
          <tr><td>{t('Stiffness margin')}</td><td>{sci(s.margin)}</td><td>{t('Stress matrix positive semi-definite (super-stable)')}</td><td>{s.stressPsd ? t('yes') : t('no')}</td></tr>
        </tbody>
      </table>
    </div>
  )
}

function download(name: string, mime: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const el = document.createElement('a')
  el.href = url
  el.download = name
  el.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

interface BuildProps {
  a: Analysis
  unit: Unit
  title: string
  selected: number | null
  t: T
  onSelect: (k: number | null) => void
}

export function BuildList({ a, unit, title, selected, t, onSelect }: BuildProps) {
  const dg = lengthDigits(unit)
  const file = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tensegrity'
  return (
    <div className="box buildlist">
      <h3>{t('Build list')}</h3>
      <p className="print-title">
        {title} · {t('Scale')}: {fmt(a.rows.find((r) => r.type === 'strut')?.length ?? 0, dg)} {unit}
      </p>
      <p className="hint no-print">{t('Every member with its end nodes, assembled length and the length to cut so that the prestrain is reached when it is assembled.')}</p>
      <div className="row no-print">
        <button onClick={() => download(`${file}-build-list.csv`, 'text/csv', buildListCsv(a.rows, unit))}>{t('Download CSV')}</button>
        <button onClick={() => download(`${file}.json`, 'application/json', JSON.stringify({ unit, positions: a.pos, labels: a.design.labels, members: a.rows }, null, 2))}>{t('Download JSON')}</button>
        <button onClick={() => window.print()}>{t('Print')}</button>
      </div>
      <div className="scroll">
        <table className="data list">
          <thead>
            <tr>
              <th>{t('Member')}</th>
              <th>{t('Type')}</th>
              <th>{t('Nodes')}</th>
              <th>{t('Length')} ({unit})</th>
              <th>{t('Cut length')} ({unit})</th>
              <th>{t('Force (N)')}</th>
            </tr>
          </thead>
          <tbody>
            {a.rows.map((r, k) => (
              <tr key={r.id} className={selected === k ? 'active' : undefined} onClick={() => onSelect(selected === k ? null : k)}>
                <td>{r.id}</td>
                <td>{r.type === 'cable' ? t('Cable') : t('Strut')}</td>
                <td>
                  {r.from}–{r.to}
                </td>
                <td>{fmt(r.length, dg)}</td>
                <td>{fmt(r.restLength, dg)}</td>
                <td>{fmt(r.force, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="sub">{t('Pieces to cut')}</h3>
      <table className="data summary">
        <thead>
          <tr>
            <th>{t('Type')}</th>
            <th>{t('Cut length')} ({unit})</th>
            <th>{t('Count')}</th>
          </tr>
        </thead>
        <tbody>
          {cutSummary(a.rows, unit).map((s) => (
            <tr key={`${s.type}${s.cut}`}>
              <td>{s.type === 'cable' ? t('Cable') : t('Strut')}</td>
              <td>{s.cut}</td>
              <td>{s.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
