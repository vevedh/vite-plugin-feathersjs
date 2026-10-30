// Small pure router, separately unit-tested; no client-controlled proxy target.
export function selectTarget(pathname) {
  if (pathname === '/api' || pathname.startsWith('/api/')) return 'api'
  if (pathname === '/socket.io' || pathname.startsWith('/socket.io/')) return 'socket'
  return 'ssr'
}
export function targetConfig(kind, env = process.env) {
  if (!['api', 'socket', 'ssr'].includes(kind)) throw new TypeError('unknown target')
  const port = Number(kind === 'api' ? (env.FEATHERS_API_PORT || 3030)
    : kind === 'socket' ? (env.FEATHERS_SOCKET_PORT || 3031)
    : (env.QUASAR_SSR_PORT || 9100))
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('invalid target port')
  return { hostname: '127.0.0.1', port }
}
