import { NotFound } from '@feathersjs/errors'
import express, { errorHandler, json, notFound, original, rest } from '@feathersjs/express'
import { feathers, type Id } from '@feathersjs/feathers'
import type { FeathersRuntime } from './vite-feathers-plugin'

/** Narrow public health endpoint with no user input persistence. */
class HealthService {
  async get(id: Id): Promise<{ status: 'ok' }> {
    if (id !== 'status') throw new NotFound('Resource not found')
    return { status: 'ok' }
  }
}

export async function createFeathersRuntime(): Promise<FeathersRuntime> {
  // Keep the callable Express HTTP handler separate from the typed Feathers app.
  // Feathers v5 supports express(feathersApp, expressApp) and exports original().
  const httpApp = original()
  const app = express(feathers(), httpApp)
  app.use(json({ limit: '32kb' }))
  app.configure(rest())
  app.use('health', new HealthService())
  app.use(notFound())
  app.use(errorHandler())
  await app.setup()

  return {
    handle(request, response) {
      httpApp(request, response)
    },
    async dispose() {
      await app.teardown()
    }
  }
}
