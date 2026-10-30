import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// The very same class source is evaluated with stand-in Feathers error types
// when npm dependencies are unavailable in the authoring environment.
// On Windows the separate integration test below exercises real Feathers v5.
const classFile = new URL('../api/services/notes/notes.class.mjs', import.meta.url)
const source = await readFile(classFile, 'utf8')
const dependencyLine = "import { NotFound, BadRequest } from '@feathersjs/errors'"
assert.ok(source.includes(dependencyLine), 'Feathers v5 error types remain in the service')
const stubErrors = `class NotFound extends Error { constructor(message) { super(message); this.code = 404; this.name = 'NotFound' } }
class BadRequest extends Error { constructor(message) { super(message); this.code = 400; this.name = 'BadRequest' } }`
const { NotesService } = await import('data:text/javascript,' + encodeURIComponent(source.replace(dependencyLine, stubErrors)))

const methods = ['find', 'get', 'create', 'patch', 'remove']

test('Feathers service facade cannot change the native-private receiver', async () => {
  const backing = new NotesService()
  const facade = Object.fromEntries(methods.map(name => [name, backing[name]]))
  // The old code failed here: this was the Feathers facade, not NotesService.
  assert.equal(facade.find.length, 0)
  assert.equal((await facade.find())[0].title, 'Hello from FeathersJS v5')
  const created = await facade.create({ title: 'bound-methods' })
  assert.equal(created.id, 2)
  assert.deepEqual(await facade.get(created.id), created)
  assert.equal((await facade.patch(created.id, { title: 'patched' })).title, 'patched')
  assert.equal((await facade.remove(created.id)).id, created.id)
  await assert.rejects(facade.get(created.id), e => e.code === 404)
  await assert.rejects(facade.create({ title: '   ' }), e => e.code === 400)
})

test('NotesService instances and IDs are isolated across SSR runtimes', async () => {
  const a = new NotesService()
  const b = new NotesService()
  const unbound = a.create
  assert.equal((await unbound.call({ notTheService: true }, { title: 'a' })).id, 2)
  assert.equal((await b.create({ title: 'b' })).id, 2)
  assert.equal((await a.find()).length, 2)
  assert.equal((await b.find()).length, 2)
  assert.notDeepEqual((await a.find())[1], (await b.find())[1])
})

test('FeathersJS v5 service registration executes real CRUD when installed', async t => {
  let feathers
  let register
  try {
    ({ feathers } = await import('@feathersjs/feathers'))
    ;({ default: register } = await import('../api/services/notes/notes.service.mjs'))
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') {
      t.skip('Real @feathersjs dependencies are not installed here; required on Windows')
      return
    }
    throw error
  }
  const app = feathers()
  register(app)
  await app.setup()
  try {
    const service = app.service('notes')
    const result = await service.create({ title: 'real-feathers' })
    assert.equal(result.id, 2)
    assert.equal((await service.get(result.id)).title, 'real-feathers')
    assert.equal((await service.patch(result.id, { title: 'real-patch' })).title, 'real-patch')
    await service.remove(result.id)
    await assert.rejects(service.get(result.id), e => e.code === 404)
  } finally {
    await app.teardown()
  }
})
