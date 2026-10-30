export class HealthService {
  async find() { return { status: 'ok', transport: 'feathers-v5' } }
}
