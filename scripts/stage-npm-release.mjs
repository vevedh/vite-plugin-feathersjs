import { stage } from './release-package-common.mjs'
if(process.argv.length!==2) throw new Error('Unexpected arguments')
console.log(`R30_B1_STAGE=PASS | FILES=${stage()} | NPM_PUBLISH=NO`)
