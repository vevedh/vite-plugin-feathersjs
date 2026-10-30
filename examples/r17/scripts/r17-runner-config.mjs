/** Shared R17 identity, case mapping and option guards; independent of installed deps. */
const CASES = Object.freeze({
  'quasar-spa': 'generated/r17-quasar-spa',
  'daisyui-spa': 'generated/r17-daisyui-spa',
  'daisyui-ssr': 'daisyui-ssr',
  'daisyui-ssg': 'daisyui-ssg',
})
export function caseDirectory(name) {
  if (!Object.hasOwn(CASES, name)) throw new Error(`Unsupported R17 case: ${name}; choose ${Object.keys(CASES).join(', ')}`)
  return CASES[name]
}
export function browserMode(name) { return name.endsWith('-spa') ? 'spa' : name.endsWith('-ssr') ? 'ssr' : 'ssg' }
export function parseRunOptions(args) {
  const options = { case: '', project: '', adapter: 'koa', socket: false, production: false, preflight: false }
  const seen = new Set()
  for(let i = 0;i<args.length;i++) {
    const flag = args[i]
    if (seen.has(flag) || !['--case','--project','--adapter','--socket','--production','--preflight'].includes(flag)) throw new Error(`Invalid/duplicate option: ${flag}`)
    seen.add(flag)
    if (flag === '--case' || flag === '--adapter' || flag === '--project') {
      const value = args[++i]
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`)
      options[flag.slice(2)] = value
    } else options[flag.slice(2)] = true
  }
  caseDirectory(options.case)
  if (!['koa','express'].includes(options.adapter)) throw new Error('--adapter must be koa or express')
  if (options.project && !/^[a-z][a-z0-9-]{0,47}$/.test(options.project)) throw new Error('--project requires a safe single directory name')
  if (options.socket && !options.case.endsWith('-spa')) throw new Error('R17 --socket only supported for SPA until SSR/SSG proxy certification')
  if (options.production && options.case.endsWith('-spa')) throw new Error('R17 SPA production server not supported by this harness; run without --production')
  return options
}
export function assertExampleHtml(html, name) {
  caseDirectory(name)
  if (!/<meta\s+name=["']r17-example["']\s+content=["']([^"']+)["']\s*\/?>/i.test(html)) {
    throw new Error(`Wrong R17 example on port 5173: missing HTML identity marker for ${name}`)
  }
  const got = html.match(/<meta\s+name=["']r17-example["']\s+content=["']([^"']+)["']/i)?.[1]
  if (got !== name) throw new Error(`Wrong R17 example on port 5173: expected ${name}, found ${got}`)
  if (!/<title>/.test(html)) throw new Error('Wrong R17 example: invalid HTML shell')
}
