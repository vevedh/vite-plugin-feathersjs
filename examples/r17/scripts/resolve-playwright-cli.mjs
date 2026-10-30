/** Resolve the supported Playwright Test CLI export from the R16 Playwright project.
 * Works with pnpm's strict dependency graph and with the package exports map.
 * Does not download browsers or use global binaries.
 */
import { access } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

export async function resolveLocalPlaywrightCli(projectRoot) {
  const requireFromProject = createRequire(resolve(projectRoot, 'package.json'))
  let cli
  try {
    cli = requireFromProject.resolve('@playwright/test/cli')
  } catch (cause) {
    throw new Error(
      `Playwright Test CLI is not resolvable from ${projectRoot}. ` +
      'Run: cd examples/quasar-ssr; corepack pnpm install; ' +
      'corepack pnpm exec playwright --version. ' +
      `Resolver: ${cause.code || cause.name}: ${cause.message}`,
      { cause },
    )
  }
  try {
    await access(cli)
  } catch (cause) {
    throw new Error(`Playwright Test CLI export points to a missing file: ${cli}`, { cause })
  }
  return cli
}
