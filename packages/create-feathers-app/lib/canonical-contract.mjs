// R14-S5-R5: CLI-only canonical metadata; never infer a schema from user data.
import { createHash } from 'node:crypto'
const methods = Object.freeze(['find', 'get', 'create', 'patch', 'remove'])
const namePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex')
function checkName(name) {
  if (typeof name !== 'string' || name.length > 48 || !namePattern.test(name) || ['constructor','prototype','__proto__'].includes(name)) throw Error('CANONICAL_NAME_REFUSED')
}
function stringify(contract) { return JSON.stringify(contract, null, 2) + '\n' }
function evidence(file, contents, registration, registrar) {
  if (typeof contents !== 'string' || !contents || typeof registrar !== 'string' || !registrar || !/^(?:schema\.(?:mjs|ts)|notes\.class\.mjs)$/.test(file) || !/^[a-z][a-z0-9-]*\.service\.(?:mjs|ts)$/.test(registration)) throw Error('CANONICAL_SOURCES_REFUSED')
  return { file, sha256: sha256(contents), registration, registrationSha256: sha256(registrar) }
}
function contract(name, schema, source) {
  return stringify({ version: 1, name, path: `api/${name}`, schema, docs: 'off', methods: [...methods], fields: [{ name: 'title', type: 'string', required: true, minLength: 1, maxLength: 120 }], source })
}
export function canonicalGeneratedContract({ name, schema, lang, schemaContents, registrarContents }) {
  checkName(name)
  if (!['typebox', 'json', 'zod'].includes(schema) || !['ts','js'].includes(lang)) throw Error('CANONICAL_PRESET_REFUSED')
  const ext = lang === 'ts' ? 'ts' : 'mjs'
  return contract(name, schema, evidence(`schema.${ext}`,schemaContents,`${name}.service.${ext}`,registrarContents))
}
// This is the audited public demonstration preset, not a claim of Zod/JSON-Schema coverage.
export function canonicalNotesContract(classContents, registrarContents) {
  const gitBlob = (text) => createHash('sha1').update(`blob ${Buffer.byteLength(text,'utf8')}\0`).update(text,'utf8').digest('hex')
  if (gitBlob(classContents) !== '03565f1cc8418ea31757096fb7a11e68ffe52b4d' || gitBlob(registrarContents) !== 'e825a2d7f60db00dfb64e52b9e5eb25c221c4c35') throw Error('NOTES_TEMPLATE_UNREVIEWED')
  return contract('notes','manual',evidence('notes.class.mjs',classContents,'notes.service.mjs',registrarContents))
}
