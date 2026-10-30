// Repository wrapper around the same generator used by the independently published CLI.
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGenerator } from '../../packages/create-feathers-app/lib/scaffold.mjs'
const root=resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const {parse,generate}=createGenerator({outputRoot:resolve(root,'examples/r17/generated'),templatesRoot:resolve(root,'examples/r17/templates'),examplesRoot:resolve(root,'examples/r17'),reportRoot:root})
