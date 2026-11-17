import { readFile, mkdir, writeFile, cp } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { render } = await import(pathToFileURL(resolve(root,'dist/server/entry-server.js')).href)
const template = await readFile(resolve(root,'dist/client/index.html'),'utf8')
for (const route of ['/', '/about']) {
  const content = await render(route) // public markup only: no Feathers fetch or token
  const directory = route === '/' ? resolve(root,'dist/ssg') : resolve(root,'dist/ssg/about')
  await mkdir(directory,{recursive:true})
  await writeFile(resolve(directory,'index.html'), template.replace('<!--app-html-->',content))
}
await cp(resolve(root,'dist/client/assets'), resolve(root,'dist/ssg/assets'),{recursive:true})
console.log('PASS: SSG generated / and /about without dynamic notes')
