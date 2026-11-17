import assert from 'node:assert/strict'
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'

const base = '/vite-plugin-feathersjs/'
const host = 'vevedh.github.io'
const supplied = process.env.PAGES_OUTPUT_DIR
assert.ok(typeof supplied === 'string' && isAbsolute(supplied), 'QUALITY_OUTPUT_ABSOLUTE_REQUIRED')
const root = resolve(supplied)
assert.ok(existsSync(root) && lstatSync(root).isDirectory() && !lstatSync(root).isSymbolicLink(), 'QUALITY_OUTPUT_INVALID')
const forbidden = /(?:^|\/)(?:docs-private|patch-memory|node_modules|\.git|\.agents|\.claude|\.codex)(?:\/|$)/i
const paths = []
function walk(dir, prefix = '') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    assert.ok(!forbidden.test(rel), 'QUALITY_PRIVATE_PATH')
    const full = join(dir, entry.name)
    const stat = lstatSync(full)
    assert.equal(stat.isSymbolicLink(), false, 'QUALITY_SYMLINK_REFUSED')
    if (stat.isDirectory()) walk(full, rel)
    else {
      assert.ok(stat.isFile(), 'QUALITY_NON_FILE_REFUSED')
      paths.push(rel)
    }
  }
}
walk(root)
const files = new Set(paths)
const htmlFiles = paths.filter(path => extname(path).toLowerCase() === '.html')
assert.ok(htmlFiles.filter(p => !p.startsWith('cli/')).length >= 8, 'QUALITY_PLUGIN_PAGES_MISSING')
assert.ok(htmlFiles.filter(p => p.startsWith('cli/')).length >= 16, 'QUALITY_CLI_PAGES_MISSING')
assert.ok(files.has('index.html') && files.has('cli/index.html'), 'QUALITY_HOME_MISSING')
let checks = 0
const failures = []
function checkLink(raw, source) {
  if (!raw || /^(?:#|mailto:|tel:)/i.test(raw)) return
  if (/^(?:javascript:|vbscript:|blob:|file:)/i.test(raw)) { failures.push(`${source}:UNSAFE_SCHEME`); return }
  if (/^data:/i.test(raw)) {
    if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(raw)) return
    failures.push(`${source}:UNSAFE_DATA_URI`)
    return
  }
  if (/^\/\//.test(raw)) return
  let url
  try { url = new URL(raw, `https://${host}${base}${source}`) } catch { failures.push(`${source}:INVALID_URL`); return }
  if (url.host !== host) return
  const pathname = url.pathname
  if (!pathname.startsWith(base)) {
    failures.push(`${source}:WRONG_BASE:${pathname.slice(0,150)}`)
    return
  }
  const encodedPath = pathname.slice(base.length)
  let rel
  try { rel = decodeURIComponent(encodedPath) } catch { failures.push(`${source}:INVALID_ENCODING`); return }
  if (rel.includes('\\') || rel.split('/').includes('..') || rel.includes('\0') || forbidden.test(rel)) {
    failures.push(`${source}:UNSAFE_PATH`)
    return
  }
  rel = rel.replace(/\/$/, '')
  const candidates = rel === '' ? ['index.html'] : [rel, `${rel}.html`, `${rel}/index.html`]
  if (!candidates.some(candidate => files.has(candidate))) {
    failures.push(`${source}:MISSING:${rel.slice(0,150)}`)
    return
  }
  checks++
  if (url.hash) {
    const target = candidates.find(candidate => files.has(candidate) && candidate.endsWith('.html'))
    if (!target) return
    let fragment
    try { fragment = decodeURIComponent(url.hash.slice(1)) } catch { failures.push(`${source}:INVALID_FRAGMENT`); return }
    if (!fragment) return
    const content = readFileSync(join(root, target), 'utf8')
    const safeFragment = fragment.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
    if (!content.includes(`id="${safeFragment}"`) && !content.includes(`name="${safeFragment}"`)) failures.push(`${source}:MISSING_FRAGMENT:${fragment.slice(0,100)}`)
  }
}
function htmlLinks(content, source) {
  for (const m of content.matchAll(/\b(href|src|poster|srcset)\s*=\s*(["'])(.*?)\2/gi)) {
    const value = m[3]
    const urls = m[1].toLowerCase() === 'srcset' ? value.split(',').map(part=>part.trim().split(/\s+/)[0]) : [value]
    for (const url of urls) checkLink(url, source)
  }
}
for (const item of htmlFiles) {
  const content = readFileSync(join(root, item), 'utf8')
  assert.ok(/name=["']viewport["']/i.test(content), `QUALITY_NO_MOBILE_VIEWPORT:${item}`)
  htmlLinks(content, item)
}
// Validate cross-site navigation in the HTML that is actually delivered.
const pluginHome = readFileSync(join(root, 'index.html'), 'utf8')
const cliHome = readFileSync(join(root, 'cli/index.html'), 'utf8')
assert.ok(pluginHome.includes('vite-plugin-feathersjs/cli/'), 'QUALITY_PLUGIN_TO_CLI_MISSING')
assert.ok(cliHome.includes('vite-plugin-feathersjs/'), 'QUALITY_CLI_TO_PLUGIN_MISSING')
assert.deepEqual(failures, [], `QUALITY_BROKEN_LINKS:${JSON.stringify(failures.slice(0, 24))}`)
console.log(`PAGES_QUALITY=PASS | HTML=${htmlFiles.length} | LINKS=${checks} | BROKEN=0 | PRIVATE_PATHS=0 | MOBILE_VIEWPORT=YES | CROSS_NAV=YES`)
