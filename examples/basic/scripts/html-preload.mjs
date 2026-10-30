import { existsSync, lstatSync } from 'node:fs'
import { extname, join, relative, resolve, sep } from 'node:path'

const EXTENSIONS = new Map([
  ['.woff2', ['font', 'font/woff2']],
  ['.woff', ['font', 'font/woff']],
  ['.webp', ['image', 'image/webp']],
  ['.avif', ['image', 'image/avif']],
  ['.png', ['image', 'image/png']],
  ['.jpg', ['image', 'image/jpeg']],
  ['.jpeg', ['image', 'image/jpeg']],
  ['.svg', ['image', 'image/svg+xml']],
])
const VALID_PATH = /^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*$/

/** Strict opt-in: no remote URLs, HTML, scripts, traversal, or symlink escapes. */
export function resolveHtmlPreload(env, root) {
  const mode = (env.VITE_HTML_PRELOAD ?? '').trim() || 'off'
  if (!['off', 'assets'].includes(mode)) throw new Error('VITE_HTML_PRELOAD must be off or assets')
  if (mode === 'off') return []
  const raw = (env.VITE_HTML_PRELOAD_ASSETS ?? '').trim()
  if (!raw) return [] // no speculative preloading of PWA icons or route chunks
  const entries = raw.split(',').map(entry => entry.trim())
  if (entries.length > 8 || entries.some(entry => !entry)) throw new Error('Preload must list 1-8 nonempty public assets')
  const base = resolve(root, 'public')
  const unique = new Set()
  /** @type {import('vite').HtmlTagDescriptor[]} */
  const tags = []
  for (const href of entries) {
    if (!VALID_PATH.test(href) || href.split('/').includes('..') || href.split('/').includes('.'))
      throw new Error(`Invalid HTML preload path: ${href}`)
    if (unique.has(href)) throw new Error(`Duplicate HTML preload asset: ${href}`)
    unique.add(href)
    const entry = EXTENSIONS.get(extname(href).toLowerCase())
    if (!entry) throw new Error(`Unsupported preload asset extension: ${href}`)
    const candidate = resolve(base, href.slice(1))
    const rel = relative(base, candidate)
    if (rel.startsWith(`..${sep}`) || rel === '..' || !rel) throw new Error('Preload path escapes public/')
    // Reject symlinks in any component, not only the leaf.
    let current = base
    for (const segment of rel.split(sep)) {
      current = join(current, segment)
      if (!existsSync(current)) throw new Error(`Preload asset missing in public/: ${href}`)
      if (lstatSync(current).isSymbolicLink()) throw new Error('Preload symlinks are not permitted')
    }
    if (!lstatSync(candidate).isFile())
      throw new Error(`Preload asset is not an ordinary file: ${href}`)
    const [as, type] = entry
    tags.push({ tag: 'link', attrs: {
      rel: 'preload', href, as, type,
      ...(as === 'font' ? { crossorigin: '' } : {}),
    }, injectTo: 'head' })
  }
  return tags
}

/** Keep native production modulepreload untouched; this only adds opted-in public assets. */
/** @returns {import('vite').Plugin} */
export function htmlPreloadPlugin(env, root) {
  const tags = resolveHtmlPreload(env, root)
  return {
    name: 'feathers-example-html-preload',
    transformIndexHtml: {
      order: 'post',
      handler() { return tags.map(tag => ({ ...tag, attrs: { ...tag.attrs } })) },
    },
  }
}
