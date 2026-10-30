import { NotFound } from '@feathersjs/errors'
import express, { rest } from '@feathersjs/express'
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
  const app = express(feathers())
  app.use(express.json({ limit: '32kb' }))
  app.configure(rest())
  app.use('health', new HealthService())
  app.use(express.notFound())
  app.use(express.errorHandler())
  await app.setup()

  return {
    handle(request, response, next) {
      app(request, response, next)
    },
    async dispose() {
      await app.teardown()
    }
  }
}
