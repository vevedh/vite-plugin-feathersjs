import ts from 'typescript'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const config=ts.readConfigFile('tsconfig.json',ts.sys.readFile);assert.ok(!config.error)
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,process.cwd());assert.equal(parsed.errors.length,0);assert.ok(parsed.options.strict);assert.ok(parsed.fileNames.length>0)
for(const file of parsed.fileNames){const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);assert.equal(source.parseDiagnostics.length,0,`Syntax: ${file}`)}
console.log(`TS_SYNTAX=PASS | FILES=${parsed.fileNames.length}`)
