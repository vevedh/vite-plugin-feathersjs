import { NotesService } from './notes.class.mjs'
export default function register(app) {
  app.use('notes', new NotesService(), { methods: ['find', 'get', 'create', 'patch', 'remove'] })
  const service = app.service('notes')
  // Demo-only channel: keep the entire stack loopback-only.
  if (typeof service.publish === 'function') {
    app.on('connection', connection => app.channel('local-demo').join(connection))
    service.publish(() => app.channel('local-demo'))
  }
}
