#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
const file=existsSync('.env')?'.env':'.env.example'
if (!existsSync(file))throw new Error('Missing .env.example')
loadEnvFile(file)
const env={...process.env}
const children=[]
let closed=false
function stop(code=0){if(closed)return;closed=true;for(const child of children.slice().reverse())if(child.exitCode===null)try{child.kill()}catch{};process.exitCode=code}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop(signal==='SIGINT'?130:143))
function start(label,command,args,opts={}) {
 const proc=spawn(command,args,{env,stdio:'inherit',windowsHide:true,...opts})
 children.push(proc)
 proc.on('error',error=>{console.error(label,error.message);stop(1)})
 proc.on('exit',code=>{if(!closed){console.error(label,'stopped',code);stop(code||1)}})
 return proc
}
start('Feathers',process.execPath,[`--env-file=${file}`,'api/server.mjs'])
let ready=false
for(let attempt=0;attempt<90 && !closed;attempt++){
 try{const res=await fetch('http://127.0.0.1:3030/api/health',{signal:AbortSignal.timeout(650)});if(res.ok){ready=true;break}}catch{}
 await sleep(200)
}
if(!ready){console.error('Feathers health unavailable on loopback');stop(1)}
if(!closed){
 start('Quasar SSR',process.platform==='win32'?'corepack.cmd':'corepack',['pnpm','run','dev:ssr'],{shell:process.platform==='win32'})
 let ssrReady=false
 for(let attempt=0;attempt<150 && !closed;attempt++){
  try{const res=await fetch('http://127.0.0.1:9100/',{signal:AbortSignal.timeout(800)});if(res.ok){ssrReady=true;break}}catch{}
  await sleep(350)
 }
 if(!ssrReady){console.error('Quasar SSR unavailable on loopback :9100');stop(1)}
 else start('Edge',process.execPath,['scripts/edge-proxy.mjs'])
}
