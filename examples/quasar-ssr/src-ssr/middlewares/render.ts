import { ssrMiddleware } from 'quasar/wrappers'
// Must remain the LAST middleware: all /api and Socket.IO are served by the edge proxy.
export default ssrMiddleware(({ app, resolve, render, serve }) => {
  app.get(resolve.urlPath('*'), (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    void render({ req, res }).then(html => res.send(html)).catch((error: unknown) => {
      const err = error as { code?: number; url?: string }
      if (err.url) { res.redirect(err.code || 302, err.url); return }
      if (err.code === 404) { res.status(404).send('Not found'); return }
      // Avoid Quasar v2's verbose development error page (it can expose secrets).
      // The CLI is pinned to v2 for Vite 7; never forward process.env or cookies.
      res.status(500).send('Internal server error')
    })
  })
})
