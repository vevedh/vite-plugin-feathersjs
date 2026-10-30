import type { FeathersApp } from 'vite-plugin-feathersjs'
import { healthMethods, healthPath } from '../../../shared/feathers/health.schema'
import { HealthService } from './health.class'

export default function register(app: FeathersApp): void {
  app.use(healthPath, new HealthService(), { methods: [...healthMethods] })
}
