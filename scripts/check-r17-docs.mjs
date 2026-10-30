#!/usr/bin/env node
/** Validate VitePress source docs without requiring VitePress installation. */
import { readFile, access, readdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findUnsafeTableCodePipes } from './r17/vitepress-markdown-lint.mjs'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const docs=resolve(root,'docs/cli')
const config=await readFile(resolve(docs,'.vitepress/config.mts'),'utf8')
const pages=[]
async function walk(where){for(const name of await readdir(where,{withFileTypes:true})){
  if(name.isDirectory() && !['.vitepress','node_modules'].includes(name.name))await walk(resolve(where,name.name))
  else if(name.isFile() && name.name.endsWith('.md'))pages.push(resolve(where,name.name))
}}
await walk(docs)
for(const item of config.matchAll(/link:\s*'([^']+)'/g)){
  const dest=item[1];if(!dest.startsWith('/'))continue
  const target=dest==='/'?resolve(docs,'index.md'):resolve(docs,dest.slice(1)+'.md')
  try{await access(target)}catch{throw Error(`Broken VitePress navigation: ${dest}`)}
}
for(const page of pages){
  const body=await readFile(page,'utf8')
  if(body.includes('docs-private/') || /mention\s+(?:IA|AI)|génér[ée] par IA/i.test(body))throw Error(`Private docs or forbidden editorial content: ${page}`)
  if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(body))throw Error(`Invalid control character in ${page}`)
  const badTableCells = findUnsafeTableCodePipes(body)
  if(badTableCells.length)throw Error(`Invalid Markdown table (unescaped pipe in backticks): ${page}:${badTableCells[0].line}`)
}
const manifest=JSON.parse(await readFile(resolve(docs,'package.json'),'utf8'))
if(manifest.private!==true||manifest.devDependencies.vitepress!=='1.6.4')throw Error('Docs dependency/version mismatch')
console.log(`PASS: VitePress 1.6.4 source validated, ${pages.length} pages, navigation and public docs policy`)
