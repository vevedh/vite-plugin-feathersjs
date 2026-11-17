import { AuthenticationService, JWTStrategy, authenticate } from '@feathersjs/authentication'
import { LocalStrategy } from '@feathersjs/authentication-local'
import { NotAuthenticated } from '@feathersjs/errors'
import { feathersCasl, authorize } from 'feathers-casl'
import { documentPolicy, validateIdentity } from './policy.mjs'

class SessionAuthentication extends AuthenticationService {
  async getPayload(result) {
    const identity = validateIdentity(result.user)
    return { sessionVersion: identity.sessionVersion }
  }
  async create(data, params) {
    const result = await super.create(data, params)
    if (!result.user) return result
    const user = validateIdentity(result.user)
    // Explicit allowlist: never serialize the stored password or adapter metadata.
    return { ...result, user: { id: user.id, role: user.role, status: user.status, sessionVersion: user.sessionVersion } }
  }
}
class SessionJWT extends JWTStrategy {
  async authenticate(data, params) {
    const result = await super.authenticate(data, params)
    const identity = validateIdentity(result.user)
    if (identity.sessionVersion !== result.authentication?.payload?.sessionVersion) throw new NotAuthenticated('Invalid session')
    return result
  }
}
class ActiveLocal extends LocalStrategy {
  async authenticate(data, params) {
    const result = await super.authenticate(data, params)
    validateIdentity(result.user)
    return result
  }
}

/** Server-owned configuration only. Tables and indexes must be provisioned separately.
 * Register before opening any HTTP or Socket.IO listener. No account is seeded here.
 * The caller owns provider teardown. Existing generated capability guard remains authoritative.
 */
export function registerSecuredPersistence(app, providers, config) {
  if (!config || Object.keys(config).sort().join(',') !== 'alias,audience,documents,issuer,secret,users') throw Error('INVALID_SECURITY_CONFIG')
  if (typeof config.secret !== 'string' || config.secret.length < 48 || config.secret.length > 512 || /\s/.test(config.secret)) throw Error('INVALID_JWT_SECRET')
  for (const key of ['issuer','audience']) if (typeof config[key] !== 'string' || !/^[a-zA-Z0-9:_-]{3,100}$/.test(config[key])) throw Error('INVALID_JWT_SCOPE')
  for (const key of ['users','documents']) if (typeof config[key] !== 'string' || !/^[a-z][a-z0-9_]{0,55}$/.test(config[key])) throw Error('INVALID_STORAGE_NAME')
  if (config.users === config.documents || typeof config.alias !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(config.alias)) throw Error('INVALID_BINDING')
  if (!app || typeof app.use !== 'function' || !providers || typeof providers.get !== 'function') throw Error('INVALID_RUNTIME')
  for (const path of ['users','authentication','documents']) if (app.services?.[path]) throw Error('SERVICE_COLLISION')
  const provider = providers.get(config.alias)
  if (!provider || !['mongodb','postgresql','mariadb'].includes(provider.adapter)) throw Error('UNSUPPORTED_PROVIDER')
  const adapter = provider.adapter === 'mongodb' ? '@feathersjs/mongodb' : '@feathersjs/knex'
  const users = provider.service(config.users)
  const documents = provider.service(config.documents)
  if (provider.adapter === 'mongodb') {
    documents.options.filters = { ...documents.options.filters, $nor: true }
    documents.options.operators = [...new Set([...(documents.options.operators ?? []), '$nor', '$and'])]
  }
  app.configure(feathersCasl({ defaultAdapter: adapter }))
  app.set('authentication', {
    secret: config.secret, service: 'users', entity: 'user', authStrategies: ['jwt','local'], parseStrategies: ['jwt'],
    jwtOptions: { algorithm: 'HS256', expiresIn: '15m', issuer: config.issuer, audience: config.audience },
    local: { usernameField: 'email', passwordField: 'password', hashSize: 10 },
  })
  app.use('users', users, { methods: [], events: [] })
  const auth = new SessionAuthentication(app)
  auth.register('jwt', new SessionJWT())
  auth.register('local', new ActiveLocal())
  app.use('authentication', auth, { methods: ['create','remove'], events: [] })
  app.use('documents', documents, { methods: ['find','get','create','patch'], events: [] })
  const access = authorize({ adapter, modelName: 'documents' })
  app.service('documents').hooks({
    around: { all: [authenticate('jwt')] },
    before: { all: [documentPolicy(async accessToken => {
      const result = await auth.authenticate({ strategy: 'jwt', accessToken }, {}, 'jwt')
      return result.user
    }), access] },
    after: { all: [access] },
  })
  // No broadcast until recipient-level filtering has its own qualification.
  return Object.freeze({ paths: Object.freeze(['authentication','documents']) })
}
