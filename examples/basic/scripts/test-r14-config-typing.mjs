import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('../vite.config.ts', import.meta.url)), 'utf8')
// Guard against untyped async return inference. The actual type gate is vue-tsc --noEmit.
assert.match(source, /import type \{ UserConfig \} from ['"]vite['"]/, 'Import the canonical Vite 7 UserConfig type')
assert.match(source, /defineConfig\(async \(\{ mode \}\): Promise<UserConfig> =>/, 'Type the async callback return')
assert.match(source, /\} satisfies UserConfig\s*\n\}\)/, 'Check the entire returned config')
assert.doesNotMatch(source, /\bas (?:unknown )?as UserConfig\b/, 'Do not suppress Vite config typing with a cast')
assert.match(source, /htmlPreloadPlugin\(env, import\.meta\.dirname\)/)
assert.match(source, /FEATHERS_FAST_DEV/)
assert.match(source, /'virtual:pwa-register'/)
assert.match(source, /serviceFiles: 'server\/services\/\*\/\*\.service\.ts'/)
assert.match(source, /\.\.\.\(await createLocalViteMcpPlugin\(\)\)/)
console.log('PASS: async Vite 7 config uses an explicit UserConfig contract; r14 features preserved')
