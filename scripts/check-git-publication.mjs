import { assertRepositoryRoot, isSensitiveTrackedPath, listAllTracked, listIgnoredTracked, runGit } from './git-publication-common.mjs'
// Exact, previously public example source blobs. No exception for ignored paths, configurations,
// new MCP paths or modified blobs. Changes to these example tools require a fresh policy review.
const reviewed = Object.freeze({
  "examples/basic/scripts/feathers-v5-mcp.mjs": "864de1c9e2640f0ce454268e08c45f48826bbe96",
  "examples/basic/scripts/start-vite-mcp.mjs": "1a50398d8827ddc8619c7466b70ba22d17fde48a",
  "examples/basic/scripts/test-feathers-v5-mcp.mjs": "362f1d6c70ad7ed109214e334f0b67cef70595b2",
  "examples/basic/scripts/test-vite-agent-setup.mjs": "fbd2c8619b49089c1330559f4e9e9a41211ec93a",
  "examples/basic/scripts/vite-mcp-loader.d.mts": "e507abc8b656d0cb06dc860eb49031d4f24db89e",
  "examples/basic/scripts/vite-mcp-loader.mjs": "fec5a5e4d22942102073657bc00bfb7297e2c164"
})
assertRepositoryRoot()
const violations = new Set(listIgnoredTracked())
for (const name of listAllTracked().filter(isSensitiveTrackedPath)) {
  const pinned = Object.hasOwn(reviewed,name) ? reviewed[name] : null
  const index = pinned ? runGit(['ls-files','--stage','--',name]).trim() : ''
  if (!pinned || !new RegExp('^100(?:644|755) '+pinned+' 0\\t').test(index) || index.split('\n').length!==1) violations.add(name)
}
if (violations.size) { console.error(`GIT_PUBLICATION=BLOCKED | PATHS=${violations.size}`); process.exitCode = 1 }
else console.log('GIT_PUBLICATION=PASS')
