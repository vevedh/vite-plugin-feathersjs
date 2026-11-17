import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, realpathSync, unlinkSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/** SHA-256 allowlist of legacy r11/r12/r13/r13-r1 registration modules. */
export const legacyHashes = Object.freeze({
  'server/notes.ts': Object.freeze([
    'ac3f1717c608c3975e36a67ad2964bb7cbff8b7332a7a5b474f59f0e65e3057d',
    '789475a4a049a6eacd1f8a71670a184adeea456883d9d6847f66fb4492a21262',
  ]),
  'server/health.ts': Object.freeze([
    'd906079f879b0264c03b28da9152071b0fb10a8623e5a047c5a60bd42f503bb1',
    'ae8dca312a578c79e4942bc4ffae27b0da8fc8ccb77d1e98fa463c564b426269',
  ]),
})

/** Remove only exact known legacy files left behind after an Expand-Archive -Force overlay.
 * Unknown/edited files and filesystem links fail closed: never overwrite user work.
 * @param {string} root
 * @param {Record<string, readonly string[]>} approved
 */
export function migrateLegacyRegistrations(root, approved = legacyHashes) {
  const serverDir = resolve(root, 'server')
  const removed = []
  for (const [relative, hashes] of Object.entries(approved)) {
    if (!/^server\/(notes|health)\.ts$/.test(relative)) throw new Error('Unsafe migration file name')
    const file = resolve(root, relative)
    if (!existsSync(file)) {
      // A dangling symlink is still an unsafe filesystem object.
      try { lstatSync(file) }
      catch (error) { if (error?.code === 'ENOENT') continue; throw error }
    }
    const stat = lstatSync(file)
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Refusing non-regular legacy file: ${relative}`)
    const actualDir = realpathSync(dirname(file))
    if (actualDir.toLowerCase() !== realpathSync(serverDir).toLowerCase()) throw new Error(`Legacy directory is a link: ${relative}`)
    const digest = createHash('sha256').update(readFileSync(file)).digest('hex')
    if (!hashes.includes(digest)) {
      throw new Error(`Modified/unknown legacy file: ${relative}. Back it up and remove manually after review; migration did not delete it.`)
    }
    removed.push(file)
  }
  // All files validated before any unlink to avoid partial migration on an unknown file.
  for (const file of removed) unlinkSync(file)
  return removed.map(file => file.slice(resolve(root).length + 1).split(sep).join('/'))
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const removed = migrateLegacyRegistrations(root)
  console.log(removed.length ? `PASS: removed verified obsolete registrations: ${removed.join(', ')}` : 'PASS: no obsolete flat Feathers registrations')
}
