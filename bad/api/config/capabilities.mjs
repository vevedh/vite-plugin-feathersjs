// Generated capability contract: never silently downgrade identity or persistence.
export const profile=Object.freeze({"auth":"none","databases":[{"alias":"main","adapter":"memory"}]})
export function assertCapabilities(){
  if (profile.auth !== 'none') throw new Error('Authentication '+profile.auth+' is a configuration blueprint; identity provider and JWT validation must be integrated and certified before serving requests')
  const missing=profile.databases.filter(item=>item.adapter!=='memory')
  if(missing.length)throw new Error('Database adapters not provisioned: '+missing.map(x=>x.alias+':'+x.adapter).join(', ')+'. Configure named adapters before serving requests')
}
