import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function runGit(args, cwd = root) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

export function assertRepositoryRoot() {
  // Git's own relative-worktree status is stable across Windows drive aliases,
  // mixed path separators, case differences and linked worktrees. Comparing the
  // absolute paths returned by Git and Node can reject a valid temporary clone.
  let inside
  let prefix
  try {
    inside = runGit(['rev-parse', '--is-inside-work-tree']).trim()
    prefix = runGit(['rev-parse', '--show-prefix']).trim()
  } catch {
    throw new Error('Le dossier ne contient pas de dépôt Git. Conserver ou restaurer .git avant ce contrôle.')
  }
  if (inside !== 'true' || prefix !== '') {
    throw new Error('Git est initialisé dans un autre dossier : opération refusée.')
  }
}

export function listIgnoredTracked() {
  const raw = runGit(['ls-files', '--cached', '--ignored', '--exclude-standard', '-z'])
  return raw.split('\0').filter(Boolean).sort()
}

export function listAllTracked() {
  const raw = runGit(['ls-files', '--cached', '-z'])
  return raw.split('\0').filter(Boolean).sort()
}

export function isSensitiveTrackedPath(relative) {
  const parts = relative.replaceAll('\\', '/').split('/')
  const basename = parts.at(-1)?.toLowerCase() ?? ''
  if (basename === '.npmrc' || (basename.startsWith('.env') && basename !== '.env.example')) return true
  return parts.some((part) => /^(?:\.agents|\.agent|\.ai|\.assistant|\.codex|\.claude|\.cursor|\.gemini|\.gpt|\.opencode|\.windsurf|\.ecc|docs-private|\.release)$/i.test(part))
    || /^(?:agents|skills|claude|gemini|copilot)\.md$/i.test(basename)
    || /(?:^|[-.])mcp(?:[-.]|$)|(?:^|[-.])agent-setup(?:[-.]|$)/i.test(basename)
}
