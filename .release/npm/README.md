# @vevedh/vite-plugin-feathersjs

Run FeathersJS v5 services alongside your Vite development server. REST requests are handled through Vite’s middleware stack, using either Koa or Express. Socket.IO is available on a separate, optional port.

The plugin is intended for local development. A production API needs its own Feathers server; the Vite plugin does not turn `vite build` into a deployable backend.

## Requirements

- Node.js 20.19 or later; Node.js 22 LTS is recommended.
- Vite 5, 6 or 7.
- FeathersJS v5 (Dove).

The published package uses the name `@vevedh/vite-plugin-feathersjs`. Do not confuse it with the unrelated, unscoped `vite-plugin-feathersjs` package on npm.

## Installation

```bash
npm install -D @vevedh/vite-plugin-feathersjs
npm install @feathersjs/feathers@^5 @feathersjs/errors@^5 @feathersjs/koa@^5 @feathersjs/express@^5 @feathersjs/socketio@^5
```

The Feathers packages are peer dependencies. Both HTTP adapters are currently required by the runtime even if you select only one.

## Start with REST

Create a service registration module at `server/services/health/health.service.ts`:

```ts
import type { FeathersApp } from '@vevedh/vite-plugin-feathersjs'

class HealthService {
  async find() {
    return { status: 'ok' }
  }
}

export default function register(app: FeathersApp): void {
  app.use('health', new HealthService(), { methods: ['find'] })
}
```

Register the plugin in `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import feathers from '@vevedh/vite-plugin-feathersjs'

export default defineConfig({
  plugins: [
    feathers({
      serviceFiles: 'server/services/*/*.service.ts',
      adapter: 'koa', // 'express' also supported
      prefix: '/api',
      socketio: false,
    }),
  ],
})
```

Start Vite with `npm run dev` (or your project's normal development command) and request the service:

```bash
curl http://localhost:5173/api/health
# {"status":"ok"}
```

`serviceFiles` discovers service **registration modules**, not individual class or schema files. Each module must export a default registration function or a named `register` function. Its service path is relative to the Feathers application (`health`), while `prefix` controls the URL exposed through Vite (`/api/health`).

## Enable Socket.IO when needed

Socket.IO runs through a dedicated Feathers HTTP listener, not Vite's port. Use a loopback bind address in local development:

```ts
feathers({
  serviceFiles: 'server/services/*/*.service.ts',
  adapter: 'express',
  prefix: '/api',
  socketio: {
    port: 3031,
    host: '127.0.0.1',
    origins: ['http://localhost:5173'],
  },
})
```

Your browser client can connect with the regular FeathersJS client packages:

```bash
npm install @feathersjs/rest-client@^5 @feathersjs/socketio-client@^5 socket.io-client@^4
```

```ts
import { feathers } from '@feathersjs/feathers'
import socketioClient from '@feathersjs/socketio-client'
import { io } from 'socket.io-client'

const socket = io('http://127.0.0.1:3031', {
  transports: ['websocket'],
})
const client = feathers()
client.configure(socketioClient(socket))

const result = await client.service('health').find()
console.log(result)
```

To broadcast service events to connected clients, configure **channels and publishers** in your Feathers application. Socket.IO alone does not automatically authorize or publish data. Never put sensitive data into a channel that every connection can join. If the API is exposed beyond a local lab, add authentication, per-user authorization and appropriately scoped channels before enabling realtime events.

The HTTP listener defaults to the existing Feathers behavior when `host` is omitted. Passing `host: '127.0.0.1'` or `host: '::1'` explicitly restricts its network binding. `origins` is a browser CORS setting, not an access-control mechanism.

## Reloading services

When a service registration file changes, the plugin reloads the service runtime. With Socket.IO enabled, a full reload restarts the dedicated listener and clients reconnect.

A registration module can export `hotUpdate(app)` to request an **in-place** update. This is only attempted when every changed registration module provides that callback. It must update the current service deliberately; it must not re-register global hooks, channels or listeners. A failure can leave application state partially updated, so reserve this feature for well-tested, idempotent changes.

If a class, hook or schema lives outside the registration file, add its directory to `watchDirectories` to trigger a full reload:

```ts
feathers({
  serviceFiles: 'server/services/*/*.service.ts',
  watchDirectories: ['server/services', 'shared/feathers'],
})
```

## Options

| Option | Default | Purpose |
| --- | --- | --- |
| `serviceFiles` | **required** | Glob or array of globs for service registration modules. |
| `adapter` | `'koa'` | HTTP transport: `'koa'` or `'express'`. |
| `prefix` | `'/api'` | URL prefix for REST requests via Vite. |
| `socketio` | `false` | Separate realtime listener: `{ port, origins, host?, path? }`. |
| `watchDirectories` | `[]` | Project-relative directories whose changes trigger a full reload. |
| `cors` | disabled | Optional REST CORS configuration. |
| `jsonLimit` | `'100kb'` | Request body size limit. |
| `debounceMs` | `40` | Delay before applying a service reload, in milliseconds. |
| `configure` | — | Hook called before service registration. |
| `afterRegister` | — | Hook called after registration. |

The package also exports `createFeathersRuntime()`, `createFeathersApp()`, and `validateOptions()` for integrations that need more control.

## Production and SSR

The Vite plugin only runs during `vite serve`. It **does not** mount Feathers into a production SSR server or run during `vite build`.

For SSR projects, create a separate Feathers process using `createFeathersRuntime()` and mount its HTTP handler in a Node server. Keep Socket.IO on an explicitly configured listener and route `/api` and `/socket.io` through a local reverse proxy when a single browser origin is required.

This arrangement has been exercised in the repository's Quasar 2 / Vite SSR example with Koa and Express, both in development and with a compiled SSR server. Quasar SSR and its runtime dependencies are **not** part of the published npm package.

## Troubleshooting

**`/api/health` returns 404** — Confirm Vite is running, the glob matches the registration file, and the service is registered as `health`, not `/api/health`.

**Socket.IO cannot connect** — Check the dedicated port, bind address, connection URL, and origin. An open Socket.IO connection is not evidence of authorized event delivery.

**A method throws a private-field error** — Feathers may wrap service methods. Methods that use native JavaScript `#private` fields must preserve their original receiver (for example, by binding them in the service constructor).

**REST works in dev but not after build** — Expected: the plugin is development-only. Run a separate Feathers process for production.

## Development

The repository includes a Vitesse/Vue 3 example and an independent Quasar 2 SSR example. From the repository root:

```bash
npm run typecheck
npm run test:unit
npm run test:integration
npm run check:release
```

Release validation covers both HTTP adapters, REST CRUD, Socket.IO calls and the npm package contents. Production security still depends on the application's own authentication, validation, channel policies and reverse proxy configuration.

## License

MIT.
