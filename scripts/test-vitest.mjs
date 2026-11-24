import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync,realpathSync,readFileSync,rmSync,readdirSync } from 'node:fs'
import { join,dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
const root=fileURLToPath(new URL('../',import.meta.url))
const require=createRequire(import.meta.url)
const expected=["app.test.ts", "hmr-utils.test.ts", "options.test.ts", "p1-r2-feathers-network.integration.test.ts", "p1-r3-crypto-jwt.integration.test.ts", "p1-r3b-native-feathers-jwt.integration.test.ts", "p1-r3c-sessions.integration.test.ts", "r10-external-socket.integration.test.ts", "r9-api-bridge.test.ts", "r9-hmr-fingerprints.test.ts", "transport.integration.test.ts", "vite-managed-hmr.integration.test.ts", "vite-start-stop.integration.test.ts"]
assert.deepEqual(readdirSync(join(root,'tests')).filter(n=>n.endsWith('.test.ts')).sort(),expected,'Vitest suite inventory drift')
const dir=realpathSync.native(mkdtempSync(join(realpathSync.native(tmpdir()),'feathers-vitest-')))
try{
 const output=join(dir,'report.json')
 const run=spawnSync(process.execPath,[join(dirname(require.resolve('vitest/package.json')),'vitest.mjs'),'run','--maxWorkers=2','--no-file-parallelism','--reporter=json',`--outputFile=${output}`,...expected.map(n=>'tests/'+n),'examples/basic/test/basic.test.ts'],{cwd:root,shell:false,stdio:'inherit',timeout:600000})
 assert.equal(run.status,0,'Vitest failed')
 const report=JSON.parse(readFileSync(output,'utf8'))
 assert.equal(report.success,true);assert.equal(report.numFailedTests,0);assert.equal(report.numPendingTests,0);assert.equal(report.numTodoTests,0);assert.ok(report.numTotalTests>0);assert.equal(report.numPassedTests,report.numTotalTests)
 assert.equal(report.testResults.length,expected.length+1,'Suite count drift')
 console.log(`VITEST=PASS | TESTS=${report.numTotalTests}`)
}finally{rmSync(dir,{recursive:true,force:true})}
