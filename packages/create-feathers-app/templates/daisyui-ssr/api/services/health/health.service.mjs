import { HealthService } from './health.class.mjs'
export default function register(app) {
  app.use('health', new HealthService(), { methods: ['find'] })
}
