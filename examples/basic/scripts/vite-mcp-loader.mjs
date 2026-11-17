// Dynamic import deliberately deferred so an uninstalled optional development
// dependency cannot break the baseline r13 Vite boot or its offline E2E tests.
export async function createLocalViteMcpPlugin(enabled = process.env.FEATHERS_VITE_MCP === '1') {
  if (!enabled) return []
  const packageName = ['vite', 'plugin', 'mcp'].join('-')
  let imported
  try { imported = await import(packageName) }
  catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' || error?.code === 'MODULE_NOT_FOUND')
      throw new Error('Vite MCP is opt-in: install dependencies with Corepack/pnpm 10.30.2 before running dev:mcp', { cause: error })
    throw error
  }
  if (typeof imported.ViteMcp !== 'function') throw new Error('Unsupported vite-plugin-mcp: ViteMcp export absent')
  return [imported.ViteMcp({
    host: 'localhost', port: 3333, mcpRouteRoot: '/__mcp',
    updateConfig: false, // never rewrite editor MCP files or home directory
    printUrl: true,
  })]
}
