import { BadRequest } from '@feathersjs/errors'
import { normalizeTitle } from '../../../shared/feathers/notes.schema'

/** Server-only boundary validation. Shared DTO types stay browser-safe. */
export function parseNoteId(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number') throw new BadRequest('Invalid id')
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id < 1) throw new BadRequest('Invalid id')
  return id
}

export function parseNoteTitle(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || !('title' in value))
    throw new BadRequest('Expected an object with a title')
  const title = (value as { title: unknown }).title
  if (typeof title !== 'string') throw new BadRequest('Title must be a string')
  try { return normalizeTitle(title) }
  catch { throw new BadRequest('Title must contain 1-120 characters') }
}
