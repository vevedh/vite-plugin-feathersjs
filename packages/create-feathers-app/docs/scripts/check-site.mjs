import assert from 'node:assert/strict'
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const built = resolve(root, '.vitepress/dist')
const file = path => existsSync(path) && lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink()
const config = readFileSync(join(root, '.vitepress/config.mts'), 'utf8')
assert.match(config, /srcExclude:\s*\[\s*['"]site\/\*\*['"]\s*\]/, 'Legacy site must be excluded')
assert.doesNotMatch(config, /ignoreDeadLinks\s*:\s*true/, 'Broken link validation cannot be disabled')
const pages = []
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (dir === root && ['node_modules', '.vitepress', 'site', 'public'].includes(name)) continue
    const path = join(dir, name)
    const stat = lstatSync(path)
    assert.equal(stat.isSymbolicLink(), false, `Untrusted symlink: ${relative(root, path)}`)
    if (stat.isDirectory()) walk(path)
    else if (stat.isFile() && extname(path) === '.md') pages.push(path)
  }
}
walk(root)
assert.equal(pages.length, 16, 'Unexpected number of canonical pages')
assert.ok(!existsSync(join(root, 'maintenance/pages-github.md')), 'Private GitHub Pages runbook must not be served')
function checkLink(href, from) {
  if (!href.startsWith('/') || href.startsWith('//')) return
  const raw = decodeURIComponent(href.split(/[?#]/, 1)[0])
  assert.ok(!raw.includes('\\'), `Invalid link: ${href}`)
  const normalized = raw === '/' ? '/index' : raw.replace(/\/$/, '/index')
  const isAsset = /\.(?:svg|png|webp|jpe?g|gif|ico)$/i.test(normalized)
  const target = resolve(root, '.' + (isAsset ? `/public${normalized}` : normalized.endsWith('.md') ? normalized : `${normalized}.md`))
  assert.ok(target.startsWith(root + sep), `Link escapes documentation root: ${href}`)
  assert.ok(file(target), `Broken link in ${relative(root, from)}: ${href}`)
}
for (const page of pages) {
  const content = readFileSync(page, 'utf8')
  assert.match(content, /^(?:# |---\n)/, `Page title missing: ${relative(root, page)}`)
  for (const match of content.matchAll(/!?\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)) checkLink(match[1], page)
}
for (const match of config.matchAll(/\blink:\s*['"](\/[^'"]*)['"]/g)) checkLink(match[1], join(root,'.vitepress/config.mts'))
for (const asset of ['public/logo.svg','public/screenshots/cli-generation-annotee.png','public/screenshots/cli-fichiers-annotes.png']) {
  assert.ok(file(join(root,asset)), `Missing site asset ${asset}`)
}
if (process.argv.includes('--built')) {
  assert.ok(!existsSync(join(built, 'maintenance/pages-github.html')), 'Private GitHub Pages output leaked')
  for (const asset of ['index.html', 'guide/parcours-illustre.html', 'reference/commandes.html', 'screenshots/cli-generation-annotee.png', 'screenshots/cli-fichiers-annotes.png']) {
    assert.ok(file(join(built,asset)), `Missing compiled asset: ${asset}`)
  }
  for (const asset of ['site/index.html', 'site/guide/demarrage.html', 'site/reference/options.html']) {
    assert.ok(!existsSync(join(built, asset)), `Legacy site leaked into the public output: ${asset}`)
  }
}
console.log(`CLI_SITE=PASS | PAGES=${pages.length} | MODE=${process.argv.includes('--built') ? 'BUILT' : 'SOURCE'}`)
