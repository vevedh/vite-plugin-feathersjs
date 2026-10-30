/** Canonical service contract shared by browser and server. Safe to import on either side. */
export const notesPath = 'notes' as const
export const notesMethods = ['find', 'get', 'create', 'patch', 'remove'] as const
export const notesEvents = ['created', 'patched', 'removed'] as const
export interface Note { id: number; title: string }
export interface NoteData { title: string }
export type NoteEvent = typeof notesEvents[number]

export function isNote(value: unknown): value is Note {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.id === 'number' && Number.isSafeInteger(candidate.id) && candidate.id > 0
    && typeof candidate.title === 'string' && candidate.title.length > 0 && candidate.title.length <= 120
}
export function validateNotes(value: unknown): Note[] {
  if (!Array.isArray(value) || !value.every(isNote)) throw new Error('Invalid notes response')
  return value
}
export function normalizeTitle(value: string): string {
  const title = value.trim()
  if (title.length < 1 || title.length > 120) throw new Error('Title must contain 1–120 characters')
  return title
}
