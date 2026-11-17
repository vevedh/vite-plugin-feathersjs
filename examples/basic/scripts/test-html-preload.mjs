import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { htmlPreloadPlugin, resolveHtmlPreload } from './html-preload.mjs'

const root = mkdtempSync(join(tmpdir(), 'feathers-html-preload-'))
try {
  mkdirSync(join(root, 'public/fonts'), { recursive: true })
  writeFileSync(join(root, 'public/hero.webp'), 'test')
  writeFileSync(join(root, 'public/fonts/normal.woff2'), 'test')
  writeFileSync(join(root, 'public/secret.js'), 'test')
  assert.deepEqual(resolveHtmlPreload({}, root), [])
  for (const blank of ['', '  ', '\t']) assert.deepEqual(resolveHtmlPreload({ VITE_HTML_PRELOAD: blank }, root), [])
  assert.deepEqual(resolveHtmlPreload({ VITE_HTML_PRELOAD: 'off', VITE_HTML_PRELOAD_ASSETS: 'https://unsafe' }, root), [])
  assert.deepEqual(resolveHtmlPreload({ VITE_HTML_PRELOAD: 'assets' }, root), [])
  const env = { VITE_HTML_PRELOAD: 'assets', VITE_HTML_PRELOAD_ASSETS: '/hero.webp,/fonts/normal.woff2' }
  const tags = resolveHtmlPreload(env, root)
  assert.equal(tags.length, 2)
  assert.deepEqual(tags.map(item => [item.attrs.href, item.attrs.as]), [['/hero.webp', 'image'], ['/fonts/normal.woff2', 'font']])
  assert.equal(tags[1].attrs.crossorigin, '')
  assert.deepEqual(htmlPreloadPlugin(env, root).transformIndexHtml.handler(), tags)
  for (const unsafe of ['/secret.js', 'https://a.example/image.webp', '/hero.webp?x=1', '/../../secret.webp', '/fonts//normal.woff2', '/missing.png', '/hero.webp,/hero.webp', '/hero.webp,<img src=x>', '/fonts/.hidden.woff2']) {
    assert.throws(() => resolveHtmlPreload({ VITE_HTML_PRELOAD: 'assets', VITE_HTML_PRELOAD_ASSETS: unsafe }, root), unsafe)
  }
  assert.throws(() => resolveHtmlPreload({ VITE_HTML_PRELOAD: 'oops' }, root))
  assert.throws(() => resolveHtmlPreload({ VITE_HTML_PRELOAD: 'assets', VITE_HTML_PRELOAD_ASSETS: Array(9).fill('/hero.webp').join(',') }, root))
  try {
    symlinkSync(join(root, 'public/hero.webp'), join(root, 'public/alias.webp'))
    assert.throws(() => resolveHtmlPreload({ VITE_HTML_PRELOAD: 'assets', VITE_HTML_PRELOAD_ASSETS: '/alias.webp' }, root))
  }
  catch (cause) { if (!['EPERM', 'EACCES'].includes(cause?.code)) throw cause }
  console.log('PASS: HTML preload off by default, local font/image opt-in, safe paths, no remote/script injection')
}
finally { rmSync(root, { recursive: true, force: true }) }
