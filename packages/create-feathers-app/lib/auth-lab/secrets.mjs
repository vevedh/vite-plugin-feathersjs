import { readFile, lstat } from 'node:fs/promises'
const allowed = Object.freeze({jwt:'/run/secrets/p5_jwt_secret',admin:'/run/secrets/p5_admin_password'})
export async function readAuthSecret(kind) {
  const wanted = allowed[kind]
  const actual = kind === 'jwt' ? process.env.P5_JWT_SECRET_FILE : process.env.P5_ADMIN_PASSWORD_FILE
  if (!wanted || wanted !== actual) throw Error('AUTH_SECRET_PATH_REFUSED')
  const stat = await lstat(actual)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 32 || stat.size > 256) throw Error('AUTH_SECRET_INVALID')
  const secret = (await readFile(actual,'utf8')).replace(/\r?\n$/, '')
  if (secret.length < 32 || secret.length > 256 || /[\u0000-\u001f\u007f]/.test(secret)) throw Error('AUTH_SECRET_INVALID')
  return secret
}
