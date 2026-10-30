import { copyFile, mkdir, readdir, realpath, stat } from 'node:fs/promises'
import path from 'node:path'

function isSamePath(a, b) {
  const norm = value => process.platform === 'win32' ? value.toLowerCase() : value
  return norm(path.normalize(a)) === norm(path.normalize(b))
}

/** Synchronize build files without ever copying a file onto itself (pnpm links/hardlinks). */
export async function syncLocalDist(sourceDist, destinationDist) {
  const srcReal = await realpath(sourceDist)
  const dstReal = await realpath(destinationDist).catch(() => null)
  if (dstReal && isSamePath(srcReal, dstReal)) {
    return { copied: 0, skipped: 1, linked: true }
  }
  await mkdir(destinationDist, { recursive: true })
  let copied = 0
  let skipped = 0
  const visit = async (from, to) => {
    for (const entry of await readdir(from, { withFileTypes: true })) {
      const source = path.join(from, entry.name)
      const target = path.join(to, entry.name)
      if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink in compiled dist: ${source}`)
      if (entry.isDirectory()) {
        await mkdir(target, { recursive: true })
        await visit(source, target)
      } else if (entry.isFile()) {
        const src = await stat(source)
        const dst = await stat(target).catch(error => {
          if (error?.code === 'ENOENT') return null
          throw error
        })
        if (dst && src.dev === dst.dev && src.ino === dst.ino) {
          skipped++
          continue
        }
        await copyFile(source, target)
        copied++
      }
    }
  }
  await visit(sourceDist, destinationDist)
  return { copied, skipped, linked: false }
}
