#!/usr/bin/env node
/** Real HTTP smoke against an already running loopback-only Feathers API. */
const port = Number(process.env.FEATHERS_API_PORT || 3030)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid API port')
const base = `http://127.0.0.1:${port}/api`
const title = `r17-contract-${process.pid}-${Date.now()}`
async function request(path, init = {}) {
  const response = await fetch(`${base}${path}`, { headers: { accept:'application/json','content-type':'application/json' }, ...init })
  const data = await response.json().catch(()=>null)
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`)
  return data
}
const health = await request('/health').catch(cause => {
  if (cause?.cause?.code === 'ECONNREFUSED') throw new Error(`R17 API not running on 127.0.0.1:${port}. Start the selected example's Feathers API first, or run node examples/r17/scripts/certify-r17.mjs --case quasar-spa`, { cause })
  throw cause
})
if (health?.status !== 'ok') throw new Error('Health service failed')
let id
try {
  const note = await request('/notes', { method:'POST', body:JSON.stringify({title}) })
  id = note?.id
  if (!Number.isSafeInteger(id) || note.title !== title) throw new Error('Invalid notes create result')
  const found = await request(`/notes/${id}`)
  if (found.title !== title) throw new Error('Notes get mismatch')
  const renamed = await request(`/notes/${id}`,{method:'PATCH',body:JSON.stringify({title:`${title}-edited`})})
  if (renamed.title !== `${title}-edited`) throw new Error('Notes patch mismatch')
  const list = await request('/notes')
  if (!Array.isArray(list) || !list.some(x=>x.id===id)) throw new Error('Notes find mismatch')
  const removed = await request(`/notes/${id}`,{method:'DELETE'})
  id = undefined
  if (removed.title !== `${title}-edited`) throw new Error('Notes remove mismatch')
  console.log('PASS: Feathers HTTP health + notes CRUD over loopback')
}
finally { if (id) await fetch(`${base}/notes/${id}`, {method:'DELETE'}).catch(()=>{}) }
