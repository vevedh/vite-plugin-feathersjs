/** Strictly parse a bounded positive integer environment variable.
 * Missing or whitespace-only values use the documented default.
 */
export function boundedEnvInteger(value, name, fallback, min, max) {
  const normalized = value?.trim() ?? ''
  if (normalized === '') return fallback
  if (!/^[0-9]+$/.test(normalized)) throw new Error(`Invalid ${name} (${min}..${max})`)
  const parsed = Number(normalized)
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid ${name} (${min}..${max})`)
  }
  return parsed
}

/** Resolve one of the supported Vite config loaders. The Windows environment
 * may contain an inherited blank variable; treat blank as unset, not invalid.
 */
export function boundedEnvChoice(value, name, fallback, choices) {
  const normalized = value?.trim() ?? ''
  if (normalized === '') return fallback
  if (!choices.includes(normalized)) throw new Error(`Invalid ${name} (${choices.join('|')})`)
  return normalized
}
