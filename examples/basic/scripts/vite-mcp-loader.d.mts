import type { Plugin } from 'vite'
/** Development-only MCP. Returns no plugins without an explicit opt-in. */
export declare function createLocalViteMcpPlugin(enabled?: boolean): Promise<Plugin[]>
