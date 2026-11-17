#!/usr/bin/env node
// Starts Feathers first, then the frontend, with one controlled shutdown.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'

const file=existsSync('.env') ? '.env' : '.env.example'
if(!existsSync(file))throw new Error('Missing .env.example')
loadEnvFile(file)
const usesVite=existsSync('src/main.ts')
const isSSG=existsSync('scripts/serve-static.mjs')
const env={...process.env}
const processes=[]
let stopped=false
function stop(code=0){
  if(stopped)return
  stopped=true
  for(const p of [...processes].reverse())if(p.exitCode===null)try{p.kill()}catch{}
  process.exitCode=code
}
process.on('SIGINT',()=>stop(130))
process.on('SIGTERM',()=>stop(143))
const api=spawn(process.execPath,[`--env-file=${file}`,'api/server.mjs'],{env,stdio:'inherit',windowsHide:true})
processes.push(api)
api.once('error',err=>{console.error('Feathers:',err.message);stop(1)})
api.once('exit',code=>{if(!stopped){console.error('Feathers stopped:',code);stop(code||1)}})
const port=Number(env.FEATHERS_API_PORT||3030)
let ready=false
for(let i=0;i<80 && !stopped;i++){
  if(api.exitCode!==null)break
  try {
    const res=await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(700)})
    if(res.ok && (await res.json()).transport==='feathers-v5'){ready=true;break}
  }catch{}
  await sleep(200)
}
if(!ready){console.error('API Feathers non disponible sur 127.0.0.1:'+port);stop(1)}
if(!stopped){
  const args=usesVite?['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort']
    :[isSSG?'node_modules/vite/bin/vite.js':'scripts/serve-ssr.mjs',...(isSSG?['--host','127.0.0.1','--port','5173','--strictPort']:[])]
  const ui=spawn(process.execPath,args,{env,stdio:'inherit',windowsHide:true})
  processes.push(ui)
  ui.once('error',err=>{console.error('Frontend:',err.message);stop(1)})
  ui.once('exit',code=>{if(!stopped){console.error('Frontend stopped:',code);stop(code||1)}})
}
