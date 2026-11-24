import { verify } from './release-package-common.mjs'
if(process.argv.length!==2) throw new Error('Unexpected arguments')
console.log(`R30_B1_STAGE_VERIFY=PASS | FILES=${verify()} | NPM_PUBLISH=NO`)
