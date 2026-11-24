import { spawnSync } from 'node:child_process'
import { lstatSync, readdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
const root=fileURLToPath(new URL('../',import.meta.url))
const expected = ["keycloak-events-network-r14-a2.3.integration.test.mjs", "keycloak-events-r14-a2.3.test.mjs", "keycloak-network-r14-a2.2-r5.integration.test.mjs", "keycloak-oidc-r14-a2.2.test.mjs", "keycloak-transport-r14-a2.2-r5.test.mjs", "p1-p2-feathers-bridges.test.mjs", "p1-p2-foundations.test.mjs", "p3-r2-realtime-state.test.mjs", "p3-r3-notes-bridge.test.mjs", "p3-ssr-scope.test.mjs", "release-packaging.test.mjs"]
assert.equal(process.argv.length,2)
const actual=readdirSync(new URL('../tests/',import.meta.url)).filter(x=>x.endsWith('.test.mjs')).sort()
assert.deepEqual(actual,expected,'Native suite inventory drift')
for(const n of expected){const s=lstatSync(new URL('../tests/'+n,import.meta.url));assert.ok(s.isFile()&&!s.isSymbolicLink())}
const r=spawnSync(process.execPath,['--test','--test-concurrency=1','--test-reporter=tap',...expected.map(n=>'tests/'+n)],{cwd:root,shell:false,encoding:'utf8',timeout:600000,maxBuffer:16*1024*1024})
process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'')
assert.equal(r.status,0,'Native tests failed')
for(const key of ['fail','skipped','todo'])assert.match(r.stdout,new RegExp('^# '+key+' 0$','m'))
assert.match(r.stdout,/^# tests [1-9][0-9]*$/m)
console.log('NODE_CONTRACTS=PASS')
