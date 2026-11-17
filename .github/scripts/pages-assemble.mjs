import assert from 'node:assert/strict'
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep, dirname, extname } from 'node:path'
import { tmpdir } from 'node:os'

const root = realpathSync(process.cwd())
const proposed = process.env.PAGES_OUTPUT_DIR
assert.ok(proposed && isAbsolute(proposed), 'PAGES_OUTPUT_DIR_ABSOLUTE_REQUIRED')
const target = resolve(proposed)
const tempBase = realpathSync(process.env.RUNNER_TEMP || tmpdir())
assert.ok(target.startsWith(tempBase + sep), 'PAGES_OUTPUT_MUST_BE_IN_TEMP')
assert.ok(!target.startsWith(root + sep) && target !== root, 'PAGES_OUTPUT_MUST_BE_OUTSIDE_SOURCE')
assert.ok(!existsSync(target), 'PAGES_OUTPUT_ALREADY_EXISTS')
let parent = target
while (true) {
  if (existsSync(parent)) assert.equal(lstatSync(parent).isSymbolicLink(), false, 'SYMLINK_PARENT_REFUSED')
  const previous = dirname(parent)
  if (previous === parent) break
  parent = previous
}
const sites = [
  { name: 'PLUGIN', dir: 'docs/.vitepress/dist', base: '/vite-plugin-feathersjs/', prefix: '' },
  { name: 'CLI', dir: 'packages/create-feathers-app/docs/.vitepress/dist', base: '/vite-plugin-feathersjs/cli/', prefix: 'cli' },
]
const forbidden = /(?:^|[/\\])(?:docs-private|patch-memory|node_modules|\.git|\.env(?:\.|$)|\.agents|\.claude|\.codex)(?:[/\\]|$)/i
const eligible = new Set(['.html','.css','.js','.json','.svg','.png','.webp','.jpg','.jpeg','.gif','.ico','.woff','.woff2','.ttf','.txt','.xml','.webmanifest','.avif','.map'])
function collect(directory) {
  assert.ok(existsSync(directory), `BUILD_OUTPUT_MISSING:${relative(root, directory)}`)
  assert.ok(lstatSync(directory).isDirectory() && !lstatSync(directory).isSymbolicLink(), 'BUILD_DIR_INVALID')
  const files = []
  function walk(dir, sub = '') {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const rel = sub ? `${sub}/${item.name}` : item.name
      assert.ok(!forbidden.test(rel), 'PRIVATE_PATH_IN_BUILD')
      const full = join(dir, item.name)
      const stat = lstatSync(full)
      assert.ok(!stat.isSymbolicLink(), 'BUILD_SYMLINK_REFUSED')
      if (stat.isDirectory()) walk(full, rel)
      else {
        assert.ok(stat.isFile(), 'BUILD_NON_FILE_REFUSED')
        assert.ok(!item.name.startsWith('.'), 'BUILD_DOTFILE_REFUSED')
        assert.ok(eligible.has(extname(item.name).toLowerCase()), `BUILD_EXTENSION_NOT_ALLOWLISTED:${rel}`)
        files.push(rel)
      }
    }
  }
  walk(directory)
  files.sort()
  assert.ok(files.includes('index.html') && files.length >= 2, 'BUILD_NO_INDEX_OR_ASSETS')
  return files
}
const plans = sites.map(site => {
  const source = resolve(root, site.dir)
  const files = collect(source)
  const html = readFileSync(join(source, 'index.html'), 'utf8')
  assert.ok(html.includes(site.base), `INCORRECT_BASE:${site.name}`)
  return { ...site, source, files }
})
mkdirSync(target)
let copied = 0
for (const site of plans) {
  for (const rel of site.files) {
    const from = join(site.source, rel)
    const to = join(target, site.prefix, rel)
    mkdirSync(dirname(to), { recursive: true })
    assert.ok(!existsSync(to), 'PAGES_OUTPUT_COLLISION')
    copyFileSync(from, to)
    assert.deepEqual(readFileSync(to), readFileSync(from), 'COPIED_CONTENT_DRIFT')
    copied++
  }
  console.log(`PAGES_${site.name}=PASS | FILES=${site.files.length} | BASE=${site.base}`)
}
assert.ok(existsSync(join(target, 'index.html')) && existsSync(join(target, 'cli', 'index.html')))
console.log(`PAGES_ARTIFACT=PASS | FILES=${copied} | SINGLE_ARTIFACT=YES | PRIVATE_PATHS=0`)
