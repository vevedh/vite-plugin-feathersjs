import { AuthenticationService, JWTStrategy, authenticate } from '@feathersjs/authentication'
import { LocalStrategy } from '@feathersjs/authentication-local'
import { NotAuthenticated, BadRequest } from '@feathersjs/errors'
import { createAuthStore } from './auth-store.mjs'
import { checkAuthSchema } from './auth-schema.mjs'
import { createNotesRbacHook } from './auth-rbac.mjs'

const ADMIN_EMAIL = 'lab-admin@example.invalid'
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
function safeUser(value) {
  if (!value || typeof value !== 'object' || !UUID.test(value.id) || value.status !== 'active' || !['viewer','editor','admin'].includes(value.role) || !Number.isSafeInteger(value.sessionVersion)) throw new NotAuthenticated('Identity unavailable')
  return { id:value.id, role:value.role, status:value.status, sessionVersion:value.sessionVersion }
}
export async function configureJwtLab(app, provider, secret) {
  if (process.env.NODE_ENV !== 'production' || process.env.P5_AUTH_MODE !== 'jwt-lab' || typeof secret !== 'string' || secret.length < 32) throw Error('AUTH_PROFILE_REFUSED')
  await checkAuthSchema(provider)
  const store = createAuthStore(provider)
  const usersService = {
    id: 'id',
    async get(id) { const user = await store.getById(id); if (!user) throw new NotAuthenticated('Identity unavailable'); return user },
    async find(params) {
      const query = params?.query
      if (!query || Object.keys(query).some(key => !['email','$limit'].includes(key)) || typeof query.email !== 'string') throw new BadRequest('Query refused')
      const user = await store.getByEmail(query.email)
      return user ? [user] : []
    },
  }
  // No transport methods: users are resolved internally by Feathers strategies.
  app.use('users', usersService, { methods: [] })
  app.set('authentication', {
    secret,
    entity: 'user', service: 'users',
    authStrategies: ['local', 'jwt'], parseStrategies: ['jwt'],
    jwtOptions: { header:{typ:'access'}, audience:'p5-jwt-lab', issuer:'p5-jwt-lab', algorithm:'HS256', expiresIn:'15m' },
    local: { usernameField:'email', passwordField:'password' },
  })
  class SafeLocalStrategy extends LocalStrategy {
    // Feathers LocalStrategy otherwise re-reads the user with a provider-tagged
    // get() call after password verification. The users service has no public
    // methods: return the verified internal record without opening that route.
    async getEntity(result) { return safeUser(result) }
    async authenticate(data, params) {
      const result = await super.authenticate(data, params)
      return { ...result, user: safeUser(result.user) }
    }
  }
  class DurableJWTStrategy extends JWTStrategy {
    // JWTStrategy's default external getEntity() repeats get() with provider=rest.
    // Resolve server-side instead: the users Feathers service remains internal.
    async getEntity(id) { return safeUser(await store.getById(id)) }
    async authenticate(data, params) {
      const result = await super.authenticate(data, params)
      const user = safeUser(result.user)
      const payload = result.authentication?.payload
      if (!payload || !UUID.test(payload.sid) || payload.ver !== user.sessionVersion || !await store.validSession(payload.sid,user.id,user.sessionVersion)) throw new NotAuthenticated('Session unavailable')
      return { ...result, user }
    }
  }
  class DurableAuthService extends AuthenticationService {
    async getPayload(authResult, params) {
      // JWT reauthentication must never mint a new durable session.
      if (authResult?.authentication?.strategy === 'jwt') throw new NotAuthenticated('JWT renewal refused')
      const payload = await super.getPayload(authResult,params)
      const user = safeUser(authResult.user)
      const sid = await store.createSession(user.id,user.sessionVersion)
      return { ...payload, sid, ver:user.sessionVersion }
    }
    async create(data, params) {
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new NotAuthenticated('Invalid login')
      if (data.strategy === 'jwt') {
        // Existing token only: a socket reconnect is not a login/refresh flow.
        if (Object.keys(data).length !== 2 || !Object.hasOwn(data,'accessToken') || !Object.hasOwn(data,'strategy')
          || typeof data.accessToken !== 'string' || data.accessToken.length < 40 || data.accessToken.length > 4096
          || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(data.accessToken)) throw new NotAuthenticated('Invalid JWT reauthentication')
        const result = await super.create(data,params)
        // Feathers JWTStrategy returns its input token unchanged; fail closed if that changes.
        if (result.accessToken !== data.accessToken) throw new NotAuthenticated('Unexpected JWT renewal')
        return { accessToken:data.accessToken, authentication:{strategy:'jwt'}, user:safeUser(result.user) }
      }
      if (data.strategy !== 'local' || Object.keys(data).some(key=>!['strategy','email','password'].includes(key)) || typeof data.email !== 'string' || data.email.length > 190 || typeof data.password !== 'string' || data.password.length > 256) throw new NotAuthenticated('Invalid login')
      const result = await super.create(data,params)
      return { accessToken:result.accessToken, authentication:{strategy:'local'}, user:safeUser(result.user) }
    }
  }
  const auth = new DurableAuthService(app)
  auth.register('jwt',new DurableJWTStrategy())
  auth.register('local',new SafeLocalStrategy())
  app.use('authentication',auth,{methods:['create']})
  const sessionsService = {
    async create(data, params) {
      if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length !== 1 || !['revoke','rotate'].includes(data.operation)) throw new BadRequest('Invalid session operation')
      const user = safeUser(params.user)
      const sid = params.authentication?.payload?.sid
      if (!UUID.test(sid) || !await store.consumeSession(sid,user.id,user.sessionVersion)) throw new NotAuthenticated('Session unavailable')
      if (data.operation === 'revoke') return { revoked:true }
      const replacement = await store.createSession(user.id,user.sessionVersion)
      const accessToken = await auth.createAccessToken({sid:replacement,ver:user.sessionVersion},{subject:user.id})
      return { accessToken, rotated:true }
    },
  }
  app.use('sessions',sessionsService,{methods:['create']})
  app.service('sessions').hooks({ before:{ create:[authenticate('jwt')] } })
  app.set('p5AuthStore',store)
  app.set('p5AuthConfigured',true)
}
export function protectNotesWithJwt(app) {
  if (app.get('p5AuthConfigured') !== true) throw Error('AUTH_NOT_CONFIGURED')
  app.service('notes').hooks({before:{all:[authenticate('jwt'),createNotesRbacHook(app.get('p5AuthStore'))]}})
  // Fail closed for server-to-client events. RPC responses still work.
  // Private per-record/tenant channels require their own future certification.
  for (const name of ['notes','sessions','authentication']) {
    const service = app.service(name)
    if (!service) throw Error('AUTH_EVENT_SERVICE_MISSING')
    if (typeof service.publish === 'function') service.publish(() => null)
    else if (typeof app.publish === 'function') throw Error('AUTH_EVENT_PUBLISHER_MISSING')
  }
  // Authentication login/logout are application-level EventEmitter notifications,
  // not publishable service events. Feathers handles them internally; no
  // authentication data is broadcast by the service-level publishers above.
}
export const bootstrapAdminEmail = ADMIN_EMAIL
