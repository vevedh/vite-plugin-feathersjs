export const healthPath = 'health' as const
export const healthMethods = ['find'] as const
export interface Health { status: 'ok'; transport: 'feathers-v5' }
