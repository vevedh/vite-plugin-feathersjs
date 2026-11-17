/** P5-R5-R4-R2: only server-validated identities determine Feathers/CASL permissions. */
import { randomUUID } from 'node:crypto'
import { AbilityBuilder, createMongoAbility } from '@casl/ability'
import { BadRequest, NotAuthenticated } from '@feathersjs/errors'
                                                       
import { z } from 'zod'

const id = z.string().uuid()
const title = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9 _.-]+$/)
const create = z.object({ title }).strict()
const patch = z.object({ title }).strict()
const list = z.object({
  $limit: z.coerce.number().int().min(0).max(50).optional(),
  $skip: z.coerce.number().int().min(0).max(100).optional(),
}).strict()
const empty = z.object({}).strict()

                                                
                                        
            
            
                  
                        
  

export function validateIdentity(input         )                  {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new NotAuthenticated('Identity unavailable')
  }
  const value = input                           
  const parsed = z.object({
    id,
    role: z.enum(['viewer','editor','admin']),
    status: z.literal('active'),
    sessionVersion: z.number().int().positive().safe(),
  }).passthrough().safeParse(value)
  if (!parsed.success) throw new NotAuthenticated('Identity unavailable')
  return parsed.data
}

export function serverAbility(identity                 ) {
  const { can, rules } = new AbilityBuilder(createMongoAbility)
  if (identity.role === 'admin') {
    can('manage', 'all')
  } else {
    can('find', 'documents', ['id','title','ownerId'], { ownerId: identity.id })
    can('get', 'documents', ['id','title','ownerId'], { ownerId: identity.id })
    if (identity.role === 'editor') {
      can('create', 'documents')
      can('patch', 'documents', ['title'], { ownerId: identity.id })
    }
  }
  return createMongoAbility(rules)
}

                                               
                                            
                                            
 

/** Must run after real Feathers authenticate('jwt') and before CASL authorize(). */
export function documentPolicy(revalidate                                           ) {
  return async (context             )                => {
    if (['get', 'patch', 'remove'].includes(context.method) && !id.safeParse(context.id).success) throw new BadRequest('Invalid id')
    const params = context.params                  
    if (!params.provider) throw new NotAuthenticated('Authenticated transport required')
    const token = params.authentication?.accessToken
    if (typeof token !== 'string' || token.length < 24 || token.length > 4096) {
      throw new NotAuthenticated('Authentication required')
    }
    // Never use params.user, client JWT roles, client-supplied ability, or stale socket permissions.
    const identity = validateIdentity(await revalidate(token))
    params.ability = serverAbility(identity)
    const query = (context.method === 'find' ? list : empty).safeParse(params.query ?? {})
    if (!query.success) throw new BadRequest('Invalid query')
    context.params.query = query.data
    if (context.method === 'create' || context.method === 'patch') {
      const parsed = (context.method === 'create' ? create : patch).safeParse(context.data           )
      if (!parsed.success) throw new BadRequest('Invalid data')
      context.data = context.method === 'create'
        ? { ...parsed.data, id: randomUUID(), ownerId: identity.id, internal: null }
        : parsed.data
    }
  }
}
