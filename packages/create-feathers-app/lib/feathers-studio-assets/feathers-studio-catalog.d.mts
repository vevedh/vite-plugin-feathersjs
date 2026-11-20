/**
 * Feathers Studio: Vite 7 development middleware.
 * Type-only declaration for the adjacent .mjs module.
 * No production endpoint or migration method is exposed.
 */
import type { Plugin } from 'vite'

export interface FeathersStudioCatalogOptions {
  /** Root directory of the generated application; defaults to process.cwd(). */
  readonly root?: string
  /** Directory URL for the static development-only panel assets. */
  readonly assets?: URL
  /** Live registry hooks, scoped to this Vite dev server only. */
  readonly live?: import('./feathers-studio-live.mjs').FeathersStudioLiveBridge
}

/** Read-only catalogue; enabled only by the local Vite development profile. */
export declare function feathersStudioCatalog(options?: FeathersStudioCatalogOptions): Plugin
