import { useEffect, useRef, useState } from 'react'
import type { Analysis, Settings } from './lib/analysis'
import type { Design } from './lib/model'
import type { Request, Response } from './solver.worker'

export interface AnalysisState {
  analysis: Analysis | null
  busy: boolean
  error: string | null
}

/** Runs form-finding and analysis in a Web Worker, debounced; keeps the last good result while a new one is computed. */
export function useAnalysis(design: Design, settings: Settings): AnalysisState {
  const [state, setState] = useState<AnalysisState>({ analysis: null, busy: true, error: null })
  const worker = useRef<Worker | null>(null)
  const latest = useRef(0)

  useEffect(() => {
    const w = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<Response>) => {
      if (e.data.id !== latest.current) return
      const r = e.data
      setState((s) => ('result' in r ? { analysis: r.result, busy: false, error: null } : { analysis: s.analysis, busy: false, error: r.error }))
    }
    worker.current = w
    return () => w.terminate()
  }, [])

  useEffect(() => {
    const id = ++latest.current
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, busy: true }))
      worker.current?.postMessage({ id, design, settings } satisfies Request)
    }, 120)
    return () => clearTimeout(timer)
  }, [design, settings])

  return state
}
