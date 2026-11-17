// @quasar/app-vite v2 SSR lifecycle: serveStaticContent configures the Express app.
// This runtime is independent of the development-only Vite Feathers plugin.
import express from 'express'
import {
  ssrCreate, ssrListen, ssrClose, ssrServeStaticContent, ssrRenderPreloadTag,
} from 'quasar/wrappers'

export const create = ssrCreate(() => {
  const app = express()
  app.disable('x-powered-by')
  return app
})

// Quasar CLI v2 does not pass `isReady` to ssrListen.
// The CLI provides an optional HTTPS development app; bind only to loopback.
export const listen = ssrListen(({ app, devHttpsApp, port }) => {
  const server = devHttpsApp || app
  return server.listen(port, '127.0.0.1')
})

export const close = ssrClose(({ listenResult }) => new Promise<void>((resolve, reject) => {
  listenResult.close((error: Error | undefined) => error ? reject(error) : resolve())
}))

const maxAge = process.env.DEV ? 0 : 86_400_000
// Quasar v2 calls this once with { app, resolve }; return a function to mount
// public assets. The old `(path, opts) => express.static(path)` signature was
// removed in app-vite 2 and raised `root path must be a string` at runtime.
export const serveStaticContent = ssrServeStaticContent(({ app, resolve }) => {
  return ({ urlPath = '/', pathToServe = '.', opts = {} }) => {
    const publicFolder = resolve.public(pathToServe)
    const url = resolve.urlPath(urlPath)
    app.use(url, express.static(publicFolder, { maxAge, ...opts }))
  }
})

export const renderPreloadTag = ssrRenderPreloadTag((file) => {
  if (/\.js$/.test(file)) return `<link rel="modulepreload" href="${file}" crossorigin>`
  if (/\.css$/.test(file)) return `<link rel="stylesheet" href="${file}">`
  if (/\.woff2?$/.test(file)) return `<link rel="preload" href="${file}" as="font" crossorigin>`
  return ''
})
