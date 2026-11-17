/**
 * P1-R3C: session-bound JWTs for a host-configured Feathers v5 AuthenticationService.
 * No HTTP routes are registered here. Session persistence is an application decision.
 * This module never accepts client-supplied roles, `user`, or `authentication.payload`.
 */
import { randomBytes } from 'node:crypto'
import type { TrustedPrincipal } from './rbac-policy.js'
import type { VerifiedTokenResolver } from './feathers-rbac.js'

const ID_RE = /^[A-Za-z0-9_-]{32,128}$/
const SUBJECT_RE = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,255}$/
const MAX_LIFETIME_SECONDS = 3600
const CLOCK_SKEW_MS = 5000

export type SessionRecord = Readonly<{
  id: string
  subject: string
  expiresAt: number
}>

/** Atomic methods: the production adapter must use database transactions/CAS. */
export interface JwtSessionStore {
  create(record: SessionRecord): Promise<void>
  isActive(id: string, subject: string, now: number): Promise<boolean>
  rotate(previousId: string, subject: string, replacement: SessionRecord, now: number): Promise<boolean>
  revoke(id: string, subject: string): Promise<boolean>
  revokeSubject(subject: string): Promise<number>
}

/** Local process / automated test ONLY. Never for clustered or persistent production. */
export class MemoryJwtSessionStore implements JwtSessionStore {
  readonly #entries = new Map<string, SessionRecord & { active: boolean }>()
  readonly #limit: number

  constructor(limit = 10000) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100000) throw new TypeError('Invalid session capacity')
    this.#limit = limit
  }

  async create(record: SessionRecord): Promise<void> {
    validateRecord(record)
    if (record.expiresAt <= Date.now() || this.#entries.has(record.id) || this.#entries.size >= this.#limit) {
      throw new Error('Session unavailable')
    }
    this.#entries.set(record.id, { ...record, active: true })
  }

  async isActive(id: string, subject: string, now: number): Promise<boolean> {
    const record = this.#entries.get(id)
    return record !== undefined && record.active && record.subject === subject && record.expiresAt > now
  }

  async rotate(previousId: string, subject: string, replacement: SessionRecord, now: number): Promise<boolean> {
    validateRecord(replacement)
    if (replacement.subject !== subject || replacement.id === previousId || replacement.expiresAt <= now || this.#entries.has(replacement.id) || this.#entries.size >= this.#limit) return false
    const current = this.#entries.get(previousId)
    if (!current || !current.active || current.subject !== subject || current.expiresAt <= now) return false
    // Synchronous commit before any await: no two concurrent rotations can consume the same token.
    this.#entries.set(previousId, { ...current, active: false })
    this.#entries.set(replacement.id, { ...replacement, active: true })
    return true
  }

  async revoke(id: string, subject: string): Promise<boolean> {
    const current = this.#entries.get(id)
    if (!current || !current.active || current.subject !== subject) return false
    this.#entries.set(id, { ...current, active: false })
    return true
  }

  async revokeSubject(subject: string): Promise<number> {
    if (!SUBJECT_RE.test(subject)) return 0
    let count = 0
    for (const [id, record] of this.#entries) {
      if (record.subject === subject && record.active) {
        this.#entries.set(id, { ...record, active: false })
        count++
      }
    }
    return count
  }
}

export interface SessionFeathersAuthentication {
  authenticate(data: { strategy: 'jwt'; accessToken: string }, params: object, ...strategies: ['jwt']): Promise<unknown>
  createAccessToken(payload: Readonly<Record<string, never>>, options?: Readonly<{ subject: string; jwtid: string; expiresIn: number }>): Promise<string>
}

export type TrustedAccountLoader = (subject: string) => Promise<TrustedPrincipal | null> | TrustedPrincipal | null

export type SessionController = Readonly<{
  verify: VerifiedTokenResolver
  /** Must only be called after server-side credential verification. Never expose raw subject minting. */
  issueForTrustedSubject: (subject: string, lifetimeSeconds: number) => Promise<string>
  rotate: (currentToken: string, lifetimeSeconds: number) => Promise<string>
  revoke: (currentToken: string) => Promise<boolean>
  /** Privileged server-side administrative action only; never use client-supplied roles. */
  revokeSubject: (subject: string) => Promise<number>
}>

function validateRecord(record: SessionRecord): void {
  if (!record || typeof record !== 'object' || !ID_RE.test(record.id) || !SUBJECT_RE.test(record.subject)
    || !Number.isSafeInteger(record.expiresAt) || record.expiresAt <= 0) throw new TypeError('Invalid session record')
}

function lifetime(seconds: number): number {
  if (!Number.isSafeInteger(seconds) || seconds < 30 || seconds > MAX_LIFETIME_SECONDS) {
    throw new TypeError('Invalid token lifetime')
  }
  return seconds
}

function ownField(source: unknown, field: string): unknown {
  if (source === null || typeof source !== 'object' || Array.isArray(source)) return undefined
  const descriptor = Object.getOwnPropertyDescriptor(source, field)
  return descriptor && 'value' in descriptor ? descriptor.value as unknown : undefined
}

function principalSubject(principal: unknown, expected: string): principal is TrustedPrincipal {
  if (!principal || typeof principal !== 'object' || ownField(principal, 'subject') !== expected) return false
  const roles = ownField(principal, 'roles')
  return Array.isArray(roles) && roles.length <= 32 && roles.every(role => typeof role === 'string' && /^[a-z][a-z0-9:_-]{0,63}$/.test(role))
}

type VerifiedSession = Readonly<{ subject: string; id: string; expMs: number }>

/**
 * Cryptographically authenticate FIRST, then accept only server-verified JWT claims.
 * Never read claims by decoding the unverified token on the client or in middleware.
 */
export function createFeathersJwtSessionController(
  auth: SessionFeathersAuthentication,
  sessions: JwtSessionStore,
  loadAccount: TrustedAccountLoader,
): SessionController {
  if (!auth || typeof auth.authenticate !== 'function' || typeof auth.createAccessToken !== 'function'
      || !sessions || typeof sessions.isActive !== 'function' || typeof sessions.create !== 'function'
      || typeof sessions.rotate !== 'function' || typeof sessions.revoke !== 'function'
      || typeof sessions.revokeSubject !== 'function' || typeof loadAccount !== 'function') {
    throw new TypeError('Invalid session configuration')
  }

  async function authenticatedSession(accessToken: string): Promise<VerifiedSession | null> {
    if (typeof accessToken !== 'string' || accessToken.length < 1 || accessToken.length > 8192) return null
    try {
      const result = await auth.authenticate({ strategy: 'jwt', accessToken }, {}, 'jwt')
      const user = ownField(result, 'user')
      const payload = ownField(ownField(result, 'authentication'), 'payload')
      const userId = ownField(user, 'id')
      const sub = ownField(payload, 'sub')
      const id = ownField(payload, 'jti')
      const exp = ownField(payload, 'exp')
      const subject = typeof userId === 'number' && Number.isSafeInteger(userId) ? String(userId) : userId
      if (typeof sub !== 'string' || !SUBJECT_RE.test(sub) || subject !== sub
          || typeof id !== 'string' || !ID_RE.test(id) || typeof exp !== 'number' || !Number.isSafeInteger(exp)) return null
      const expMs = exp * 1000
      if (!Number.isSafeInteger(expMs) || expMs <= Date.now()) return null
      return { subject: sub, id, expMs }
    } catch {
      return null
    }
  }

  async function trusted(subject: string): Promise<boolean> {
    if (!SUBJECT_RE.test(subject)) return false
    try { return principalSubject(await loadAccount(subject), subject) } catch { return false }
  }

  async function mint(subject: string, seconds: number): Promise<{ token: string; record: SessionRecord }> {
    const ttl = lifetime(seconds)
    if (!(await trusted(subject))) throw new Error('Session unavailable')
    const record: SessionRecord = {
      id: randomBytes(32).toString('base64url'),
      subject,
      expiresAt: Date.now() + ttl * 1000 - CLOCK_SKEW_MS,
    }
    validateRecord(record)
    let token: string
    try {
      token = await auth.createAccessToken({}, { subject, jwtid: record.id, expiresIn: ttl })
    } catch { throw new Error('Session unavailable') }
    if (typeof token !== 'string' || token.length > 8192 || token.length === 0) throw new Error('Session unavailable')
    return { token, record }
  }

  const verify: VerifiedTokenResolver = async accessToken => {
    const session = await authenticatedSession(accessToken)
    if (!session) return null
    try {
      if (!(await sessions.isActive(session.id, session.subject, Date.now()))) return null
      const principal = await loadAccount(session.subject)
      return principalSubject(principal, session.subject) ? principal : null
    } catch { return null }
  }

  return Object.freeze({
    verify,
    async issueForTrustedSubject(subject: string, seconds: number): Promise<string> {
      const { token, record } = await mint(subject, seconds)
      try { await sessions.create(record) } catch { throw new Error('Session unavailable') }
      return token
    },
    async rotate(token: string, seconds: number): Promise<string> {
      const previous = await authenticatedSession(token)
      if (!previous) throw new Error('Session unavailable')
      try {
        if (!(await sessions.isActive(previous.id, previous.subject, Date.now()))) throw new Error('Session unavailable')
      } catch { throw new Error('Session unavailable') }
      const { token: next, record } = await mint(previous.subject, seconds)
      try {
        if (!(await sessions.rotate(previous.id, previous.subject, record, Date.now()))) throw new Error('Session unavailable')
      } catch { throw new Error('Session unavailable') }
      return next
    },
    async revoke(token: string): Promise<boolean> {
      const existing = await authenticatedSession(token)
      if (!existing) return false
      try { return await sessions.revoke(existing.id, existing.subject) } catch { return false }
    },
    async revokeSubject(subject: string): Promise<number> {
      if (!SUBJECT_RE.test(subject)) throw new TypeError('Invalid subject')
      try { return await sessions.revokeSubject(subject) } catch { throw new Error('Session unavailable') }
    },
  })
}
