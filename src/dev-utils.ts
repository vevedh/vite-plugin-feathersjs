import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { userInfo } from 'node:os'

interface DevUser {
  name: string | undefined,
  email: string | undefined
}

export const getDevUser = async (): Promise<DevUser> => {
  const run = promisify(execFile)
  const giRaw = []
  try {
    giRaw.push(...(await Promise.all([
      run('/usr/bin/git', ['config', '--get', 'user.name']),
      run('/usr/bin/git', ['config', '--get', 'user.email'])
    ])))
  } catch { console.debug('Using default dev user') }
  const gi = giRaw.map(v => v.stdout?.trim().replace('<>','').replace('Replit user', ''))
  const name = gi[0] || globalThis.process?.env?.REPL_OWNER
  const email = gi[1] || (name ? `${name.replace(' ', '')}@example.com` : undefined)
  const result = { name, email }
  return result
}

export const getSandbox = (): string | undefined => {
  if (userInfo().username === 'runner' && globalThis.process?.env?.REPL_SLUG) {
    return 'replit'
  } else if (userInfo().username === 'blitz') {
    return 'stackblitz'
  } else {
    return
  }
}

// REASONING:
//   - Easily understand where it comes from
//   - Low risk of collision
//   - Easy to unset
// 2022-11-11: There is no way to make this async and compatible with CJS
if (globalThis.process?.env) {
  globalThis.process.env.VITE_FV_DEV_USER = JSON.stringify(await getDevUser())
}