import type { IncomingMessage, ServerResponse } from 'node:http'

export type FeathersRequestHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (error?: unknown) => void,
) => void

/**
 * API requests must never fall through to Vite's SPA HTML fallback.
 * A single runtime accessor makes the HMR handler swap atomic from the
 * perspective of each incoming request.
 */
export function createFeathersApiBridge(
  currentHandler: () => FeathersRequestHandler | undefined,
): FeathersRequestHandler {
  const respond = (res: ServerResponse, status: number, message: string): void => {
    if (res.headersSent || res.writableEnded) return
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    if (status === 503) res.setHeader('Retry-After', '1')
    res.end(JSON.stringify({ error: message }))
  }

  return (req, res, next): void => {
    // Development-only indicator: distinguishes the Feathers middleware
    // from a Vite-generated response without exposing runtime internals.
    if (!res.headersSent) res.setHeader('X-Feathers-Dev-Bridge', '1')
    const handler = currentHandler()
    if (!handler) {
      respond(res, 503, 'Feathers service unavailable')
      return
    }
    let completed = false
    const onNext = (error?: unknown): void => {
      if (completed) return
      completed = true
      if (res.headersSent || res.writableEnded) {
        if (error !== undefined) next(error)
        return
      }
      respond(res, error === undefined ? 404 : 500,
        error === undefined ? 'API endpoint not found' : 'Feathers request failed')
    }
    try {
      handler(req, res, onNext)
    } catch (error) {
      onNext(error)
    }
  }
}
