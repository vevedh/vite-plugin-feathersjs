import { configDefaults, defineConfig } from 'vitest/config'

// Vitest executes only its own TypeScript suites. The Node.js built-in
// runner handles *.test.mjs separately; generated apps have isolated gates.
export default defineConfig({
  test: {
    include: [
      'tests/**/*.test.ts',
      'examples/basic/test/basic.test.ts',
    ],
    exclude: [
      ...configDefaults.exclude,
      '**/docs-private/maintenance/**',
    ],
  },
})
