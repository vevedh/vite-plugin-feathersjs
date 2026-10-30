import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {resolve} from 'node:path'
import {parseArgs,assertHealth} from '../examples/r17/scripts/certify-quasar-ssr-generated.mjs'

test('generated Quasar SSR certification defaults to Koa and isolates its project',()=>{
 const config=parseArgs([])
 assert.equal(config.adapter,'koa')
 assert.match(config.project,/r17-quasar-ssr$/)
 assert.equal(parseArgs(['--adapter','express']).adapter,'express')
 for(const input of [['--adapter','fastify'],['--unknown'],['--project','../../not-generated']])
   assert.throws(()=>parseArgs(input))
})
test('SSR certification requires Feathers JSON health, not Quasar HTML fallback',()=>{
 assert.doesNotThrow(()=>assertHealth({status:200,contentType:'application/json'}, {status:'ok',transport:'feathers-v5'},'/api/health'))
 assert.throws(()=>assertHealth({status:200,contentType:'text/html'},{status:'ok'},'/api/health'))
 assert.throws(()=>assertHealth({status:502,contentType:'application/json'},{status:'ok',transport:'feathers-v5'},'/api/health'))
})
test('Edge suite tests SSR HTML, hydration, CRUD and responsive layout',()=>{
 const page=readFileSync(resolve('examples/quasar-ssr/e2e/r17-generated-ssr.pw.mjs'),'utf8')
 assert.match(page,/SSR prefetch renders/)
 assert.match(page,/QInput hydrates/)
 assert.match(page,/390,1280/)
 assert.match(page,/JSON and does not fall back/)
 const runner=readFileSync(resolve('examples/r17/scripts/certify-quasar-ssr-generated.mjs'),'utf8')
 assert.match(runner,/taskkill/)
 assert.match(runner,/Port \$\{port\} occupied/)
 assert.match(runner,/--config=playwright.generated-ssr.config.mjs/)
})

test('generated SSR Edge uses accessible QInput role, never a nested input selector',()=>{
 const current=readFileSync(resolve('examples/quasar-ssr/e2e/r17-generated-ssr.pw.mjs'),'utf8')
 const certified=readFileSync(resolve('examples/quasar-ssr/e2e/quasar-ssr-browser.pw.mjs'),'utf8')
 const accessible=/getByRole\('textbox',\s*\{\s*name:\s*'Titre de la nouvelle note',\s*exact:\s*true\s*\}\)/
 assert.match(certified,accessible)
 assert.match(current,accessible)
 assert.doesNotMatch(current,/\[data-testid=["']note-title-input["']\]\s+input/)
 assert.match(current,/await expect\(input\)\.toBeEnabled\(\)/)
 assert.match(current,/await expect\(input\)\.toHaveValue\(title\)/)
})
