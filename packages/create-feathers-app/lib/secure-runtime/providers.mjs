/** P5-R5-R4-R4-R1 — named Feathers providers. Internal-only, no HTTP routes. */
import { databaseDeclarations } from '../config/database-connections.generated.mjs'
const known = new Set(['postgresql', 'mariadb', 'mongodb'])
const tableName = /^[a-z][a-z0-9_]{0,56}$/
const hostName = /^(?:localhost|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*)$/
const accountName = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/
const text = (env,key,min,max)=> { const v=env[key]; if(typeof v!=='string'||v.length<min||v.length>max||v.trim()!==v)throw Error('INVALID_DB_ENV');return v }
function readSettings(env, entry){
  const prefix=entry.envPrefix
  const host=text(env,`${prefix}_HOST`,1,253)
  const rawPort=text(env,`${prefix}_PORT`,1,5)
  const user=text(env,`${prefix}_USER`,1,63)
  const password=text(env,`${prefix}_PASSWORD`,1,256)
  const database=text(env,`${prefix}_NAME`,1,63)
  const port=Number(rawPort)
  if(!hostName.test(host)||!Number.isSafeInteger(port)||port<1||port>65535||String(port)!==rawPort||!accountName.test(user)||!accountName.test(database)||/\p{C}/u.test(password))throw Error('INVALID_DB_ENV')
  return {host,port,user,password,database}
}
function validateDeclarations(){
  if(!Array.isArray(databaseDeclarations)||databaseDeclarations.length<1||databaseDeclarations.length>8)throw Error('INVALID_DECLARATIONS')
  const seen=new Set()
  for(const d of databaseDeclarations){
    if(!d||typeof d.alias!=='string'||!tableName.test(d.alias.replaceAll('-','_'))||!known.has(d.adapter)||typeof d.envPrefix!=='string'||!/^P5_DB_[A-Z][A-Z0-9_]*$/.test(d.envPrefix)||seen.has(d.alias))throw Error('INVALID_DECLARATIONS')
    seen.add(d.alias)
  }
}
export function validateNamedProviderEnvironment(env=process.env){
  validateDeclarations()
  for(const d of databaseDeclarations)readSettings(env,d)
  return databaseDeclarations.length
}
export async function openNamedDatabaseProviders(env=process.env){
  validateNamedProviderEnvironment(env)
  const providers=new Map()
  let closed=false
  const close=async()=>{
    if(closed)return
    closed=true
    const failures=[]
    for(const entry of [...providers.values()].reverse())try{await entry.close()}catch{failures.push(1)}
    providers.clear()
    if(failures.length)throw Error('DB_CLEANUP_FAILED')
  }
  try{
    for(const declaration of databaseDeclarations){
      const cfg=readSettings(env,declaration)
      if(declaration.adapter==='mongodb'){
        const { MongoClient }=await import('mongodb')
        const { MongoDBService }=await import('@feathersjs/mongodb')
        const client=new MongoClient(`mongodb://${cfg.host}:${cfg.port}`,{auth:{username:cfg.user,password:cfg.password},authSource:'admin',serverSelectionTimeoutMS:8000,maxPoolSize:3})
        try{await client.connect();await client.db(cfg.database).command({ping:1})}
        catch{await client.close();throw Error('DB_CONNECT_FAILED')}
        const db=client.db(cfg.database)
        providers.set(declaration.alias,{alias:declaration.alias,adapter:'mongodb',db,close:()=>client.close(), service(name){
          if(typeof name!=='string'||!tableName.test(name))throw Error('INVALID_TABLE_NAME')
          return new MongoDBService({Model:db.collection(name),id:'id',disableObjectify:true,paginate:false,disabledOperators:['$rename','$set','$inc','$unset','$push','$pull','$pop']})
        }})
      }else{
        const { default: knex }=await import('knex')
        const { KnexService }=await import('@feathersjs/knex')
        const db=knex({client:declaration.adapter==='postgresql'?'pg':'mysql2',connection:{host:cfg.host,port:cfg.port,user:cfg.user,password:cfg.password,database:cfg.database},pool:{min:0,max:3},acquireConnectionTimeout:8000})
        try{await db.raw('SELECT 1')}catch{await db.destroy();throw Error('DB_CONNECT_FAILED')}
        providers.set(declaration.alias,{alias:declaration.alias,adapter:declaration.adapter,db,close:()=>db.destroy(),service(name){
          if(typeof name!=='string'||!tableName.test(name))throw Error('INVALID_TABLE_NAME')
          return new KnexService({Model:db,name,id:'id',paginate:false})
        }})
      }
    }
    return Object.freeze({aliases:Object.freeze([...providers.keys()]),get(alias){
      if(closed||typeof alias!=='string'||!providers.has(alias))throw Error('DB_ALIAS_UNAVAILABLE')
      return providers.get(alias)
    },close})
  }catch{try{await close()}catch{};throw Error('DB_PROVIDER_BOOT_FAILED')}
}
