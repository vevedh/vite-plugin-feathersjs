import type { RealTimeConnection } from '@feathersjs/feathers'
import type { FeathersApp } from 'vite-plugin-feathersjs'
import { notesMethods, notesPath } from '../../../shared/feathers/notes.schema'
import { NotesService } from './notes.class'

/** Service registration: the only module discovered and imported by the Vite plugin. */
export default function register(app: FeathersApp): void {
  app.use(notesPath, new NotesService(), { methods: [...notesMethods] })
  // Optional channels: never attach global publishers in REST-only mode.
  type ChannelApi = { channel(name: string): { join(connection: RealTimeConnection): void } }
  type PublishApi = { publish(dispatcher: () => unknown): void }
  const service = app.service(notesPath) as typeof app.services[string] & Partial<PublishApi>
  if (typeof service.publish === 'function') {
    const channels = app as FeathersApp & ChannelApi
    // Demonstration channel: production services require authenticated, scoped channels.
    app.on('connection', (connection: RealTimeConnection) => { channels.channel('demo-notes').join(connection) })
    service.publish(() => channels.channel('demo-notes'))
  }
}
