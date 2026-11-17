import type { Health } from '../../../shared/feathers/health.schema'

/** Read-only service; intentionally no persistence or Socket.IO publisher. */
export class HealthService {
  async find(): Promise<Health> {
    return { status: 'ok', transport: 'feathers-v5' }
  }
}
