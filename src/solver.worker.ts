import { analyze, type Analysis, type Settings } from './lib/analysis'
import type { Design } from './lib/model'

export interface Request {
  id: number
  design: Design
  settings: Settings
}
export type Response = { id: number; result: Analysis } | { id: number; error: string }

self.onmessage = (e: MessageEvent<Request>) => {
  const { id, design, settings } = e.data
  try {
    const result = analyze(design, settings)
    if (!result.pos.every(Number.isFinite)) throw new Error('Form-finding diverged')
    self.postMessage({ id, result } satisfies Response)
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) } satisfies Response)
  }
}
