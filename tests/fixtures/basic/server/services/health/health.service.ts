import type { FeathersApp } from '../../../../../../src/types.js'
import { healthMethods, healthPath } from '../../../shared/feathers/health.schema.js'
import { HealthService } from './health.class.js'

export default function register(app: FeathersApp): void {
  app.use(healthPath, new HealthService(), { methods: [...healthMethods] })
}
