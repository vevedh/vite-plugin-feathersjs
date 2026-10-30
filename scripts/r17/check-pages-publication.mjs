#!/usr/bin/env node
/** Safety checks before publishing the CLI VitePress site from the legacy plugin repository. */
import { readFileSync, existsSync, readdirSync, lstatSync } from 'node:fs'
import { resolve, join, relative, sep } from 'node:path'
const repo=resolve(import.meta.dirname,'../..')
const docs=join(repo,'docs/cli')
const wf=join(repo,'.github/workflows/cli-vitepress-pages.yml')
let count=0
const walk=(p)=>{
  for (const entry of readdirSync(p)) {
    const full=join(p,entry), stat=lstatSync(full)
    const rel=relative(docs,full).split(sep).join('/')
    if (stat.isSymbolicLink()) throw new Error(`Symlink in docs: ${rel}`)
    // Installed dependencies and VitePress build output are local only. The
    // Git staging script copies explicit source paths, never these directories.
    if (['node_modules', '.vitepress/dist', '.vitepress/cache', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'].includes(rel)) continue
    if (/(^|\/)(node_modules|dist|docs-private|\.env|\.git|\.quasar)(\/|$)/.test(rel)) throw new Error(`Forbidden public file: ${rel}`)
    if (stat.isDirectory()) walk(full)
    else {
      count++
      if (stat.size>750_000) throw new Error(`Oversized public file: ${rel}`)
    }
  }
}
walk(docs)
const expected=['postcss.config.cjs','.vitepress/config.mts','package.json','index.md','public/logo.svg','guide/quasar-ssr.md','maintenance/pages-github.md']
for(const file of expected) if(!existsSync(join(docs,file)))throw new Error(`Missing Pages source ${file}`)
const postcss=readFileSync(join(docs,'postcss.config.cjs'),'utf8')
if(!postcss.includes('module.exports = { plugins: {} }')) throw new Error('VitePress must isolate PostCSS from the legacy root package')
const config=readFileSync(join(docs,'.vitepress/config.mts'),'utf8')
const workflow=readFileSync(wf,'utf8')
if(!config.includes('VITEPRESS_BASE') || !workflow.includes('VITEPRESS_BASE: /vite-plugin-feathersjs/'))throw new Error('Incorrect GitHub Pages base')
for(const pattern of ['actions/checkout@','actions/configure-pages@','actions/upload-pages-artifact@','actions/deploy-pages@','pages: write','id-token: write','docs/cli/**']){
 if(!workflow.includes(pattern)) throw new Error(`Missing Pages workflow contract: ${pattern}`)
}
if(!workflow.includes('branches: [main]'))throw new Error('Pages deployment must be limited to main')
console.log(`PASS: ${count} clean VitePress source files, 16 pages, workflow main-only and correct Pages subpath`)
