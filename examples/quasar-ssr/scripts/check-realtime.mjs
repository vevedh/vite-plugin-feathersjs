import assert from 'node:assert/strict'
import { io } from 'socket.io-client'
import { once } from 'node:events'

const origin = 'http://127.0.0.1:8080'
const timeoutMs = 15000
const timeout = (promise, label) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label}`)), timeoutMs)),
])
const client = () => io(origin, { path: '/socket.io', transports: ['websocket'], reconnection: false, timeout: timeoutMs, autoConnect: false })
const a = client()
const b = client()
try {
  const connectedA = once(a, 'connect')
  const connectedB = once(b, 'connect')
  a.connect()
  b.connect()
  await timeout(Promise.all([connectedA, connectedB]), 'Socket.IO connections')
  // Both clients subscribe to the Feathers channel before the mutation.
  const createdA = once(a, 'notes created')
  const createdB = once(b, 'notes created')
  const response = await fetch(`${origin}/api/notes`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'r16-realtime-cert' }),
  })
  assert.equal(response.status, 201)
  const created = await response.json()
  const [[eventA], [eventB]] = await timeout(Promise.all([createdA, createdB]), 'two-client broadcast')
  assert.equal(eventA.id, created.id)
  assert.equal(eventB.id, created.id)
  await fetch(`${origin}/api/notes/${created.id}`, { method: 'DELETE' })
  console.log('PASS: Socket.IO two-client notes created via /api and /socket.io')
} finally { a.disconnect(); b.disconnect() }
