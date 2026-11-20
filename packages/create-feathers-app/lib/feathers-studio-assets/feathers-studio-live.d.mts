/** Local-only runtime observer; no database connections or raw records. */
import type { Application } from '@feathersjs/feathers'
export interface StudioRuntimeService { name: string; status: 'registered'; eventsObserved: number }
export interface StudioRuntimeEvent { sequence: number; kind: 'registry' | 'created' | 'updated' | 'patched' | 'removed'; service: string }
export interface StudioRuntimeSnapshot {
  version: 1
  mode: 'READ_ONLY'
  generation: number
  services: StudioRuntimeService[]
  recent: StudioRuntimeEvent[]
}
export interface FeathersStudioLiveBridge {
  afterRegister(app: Application): void
  snapshot(): StudioRuntimeSnapshot
  subscribe(listener: (event: StudioRuntimeEvent) => void): () => void
  close(): void
}
export declare function createFeathersStudioLiveBridge(): FeathersStudioLiveBridge
