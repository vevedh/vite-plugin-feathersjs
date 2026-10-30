#!/usr/bin/env node
/**
 * R17 examples maintenance. Dry-run by default.
 * Only known, generated projects can be moved; no recursive deletion.
 */
import { lstat, mkdir, readFile, readdir, rename, writeFile, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export function parseOptions(argv) {
  const options = { root: process.cwd(), apply: false, quarantine: undefined, report: undefined }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--apply') options.apply = true
    else if (['--root', '--quarantine', '--report'].includes(argument)) {
      const value = argv[++index]
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`)
      options[argument.slice(2)] = value
    } else throw new Error(`Unsupported option: ${argument}`)
  }
  return options
}

function isInside(parent, candidate) {
  const rel = relative(parent, candidate)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

async function assertPlainDirectory(path) {
  const metadata = await lstat(path)
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(`Unsafe directory: ${path}`)
}

export async function inspectExamples(options) {
  const root = resolve(options.root)
  const generated = join(root, 'examples', 'r17', 'generated')
  await assertPlainDirectory(root)
  await assertPlainDirectory(join(root, 'examples'))
  await assertPlainDirectory(join(root, 'examples', 'r17'))
  await assertPlainDirectory(generated)
  const checked = []
  const names = (await readdir(generated)).sort()
  for (const name of names) {
    const candidate = join(generated, name)
    const info = await lstat(candidate)
    if (!info.isDirectory() || info.isSymbolicLink()) {
      checked.push({ name, state: 'skip-not-directory' })
      continue
    }
    try {
      const manifestPath = join(candidate, 'package.json')
      const manifestStat = await lstat(manifestPath)
      if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) {
        checked.push({ name, state: 'skip-unsafe-manifest' })
        continue
      }
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
      const packageName = typeof manifest.name === 'string' ? manifest.name : ''
      const recognized = /^(?:r17-|npm-)/u.test(name) && /^(?:r17-|npm-|@[^/]+\/r17-)/u.test(packageName)
      checked.push({ name, state: recognized ? 'candidate' : 'skip-unrecognized', packageName })
    } catch {
      checked.push({ name, state: 'skip-no-valid-package-json' })
    }
  }
  return { root, generated, checked }
}

export async function cleanExamples(options) {
  const inventory = await inspectExamples(options)
  const candidates = inventory.checked.filter(item => item.state === 'candidate')
  if (options.apply) {
    if (!options.quarantine || !isAbsolute(options.quarantine)) {
      throw new Error('--apply requires an absolute --quarantine path outside the project')
    }
    const destination = resolve(options.quarantine)
    if (isInside(inventory.root, destination) || isInside(destination, inventory.root)) {
      throw new Error('Quarantine must not contain or be inside the project root')
    }
    await mkdir(destination, { recursive: true })
    await assertPlainDirectory(destination)
    const destinationReal = await realpath(destination)
    const rootReal = await realpath(inventory.root)
    if (isInside(rootReal, destinationReal) || isInside(destinationReal, rootReal)) {
      throw new Error('Resolved quarantine must be outside the project')
    }
    // Never modify tracked source. If .git is present, tracked generated projects forbid applying.
    const tracked = spawnSync('git', ['ls-files', '--', 'examples/r17/generated'], { cwd: inventory.root, encoding: 'utf8' })
    if (tracked.status === 0 && tracked.stdout.trim()) {
      throw new Error('Generated entries are tracked by Git; refusing to move them')
    }
    for (const candidate of candidates) {
      const source = join(inventory.generated, candidate.name)
      const target = join(destination, candidate.name)
      await assertPlainDirectory(source)
      try {
        await lstat(target)
        throw new Error(`Destination exists, will not overwrite: ${target}`)
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error
      }
      try {
        await rename(source, target)
      } catch (error) {
        if (error?.code === 'EXDEV') throw new Error('Cross-volume quarantine not supported; choose a destination on the same drive')
        throw error
      }
      candidate.state = 'moved'
    }
  }
  const report = {
    mode: options.apply ? 'quarantine' : 'dry-run',
    target: 'examples/r17/generated',
    selected: candidates.length,
    entries: inventory.checked,
    protected: ['examples/basic', 'examples/quasar-ssr', 'examples/r17/templates']
  }
  if (options.report) {
    const reportPath = resolve(options.report)
    if (!isInside(inventory.root, reportPath)) throw new Error('Report must remain inside project root')
    const reportDirectory = resolve(reportPath, '..')
    await mkdir(reportDirectory, { recursive: true })
    const reportParentReal = await realpath(reportDirectory)
    const rootReal = await realpath(inventory.root)
    if (!isInside(rootReal, reportParentReal)) throw new Error('Report directory resolves outside project')
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
  }
  return report
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await cleanExamples(parseOptions(process.argv.slice(2)))
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
