import type { FeathersApp } from 'vite-plugin-feathersjs'
export default function register(app: FeathersApp): void {
  app.use('health', {
    async find() { return { status: 'ok' as const } },
  })
}
