import { b64ToBytes,b64UrlToBytes,bytesToB64Url,td,te,nowIso,uuid,audit } from './util.js';

const ALLOWED=new Set(['coinbase','binance','kraken','robinhood']);
async function encryptionKey(env){
  if(!env.CREDENTIAL_MASTER_KEY)throw new Error('CREDENTIAL_MASTER_KEY is not configured');
  const raw=b64ToBytes(env.CREDENTIAL_MASTER_KEY);
  if(raw.byteLength!==32)throw new Error('CREDENTIAL_MASTER_KEY must be base64 for exactly 32 bytes');
  return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
}
export async function encryptJson(env,value){
  const key=await encryptionKey(env),iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,te.encode(JSON.stringify(value))));
  return `${bytesToB64Url(iv)}.${bytesToB64Url(ciphertext)}`;
}
export async function decryptJson(env,payload){
  const [ivPart,dataPart]=String(payload||'').split('.');
  if(!ivPart||!dataPart)throw new Error('Encrypted credential payload is malformed');
  const key=await encryptionKey(env);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64UrlToBytes(ivPart)},key,b64UrlToBytes(dataPart));
  return JSON.parse(td.decode(plain));
}
function validate(exchange,c){
  const req={coinbase:['apiKeyId','apiKeySecret'],binance:['apiKey','apiSecret'],kraken:['apiKey','apiSecret'],robinhood:['apiKey','privateKeyBase64']}[exchange];
  if(!req)throw new Error('Unsupported exchange');
  if(!c||typeof c!=='object')throw new Error('credentials object is required');
  for(const k of req)if(!c[k])throw new Error(`${exchange} credential ${k} is required`);
}
export async function saveConnection(env,userId,exchange,body={}){
  exchange=exchange.toLowerCase(); if(!ALLOWED.has(exchange))throw new Error('Unsupported exchange'); validate(exchange,body.credentials);
  const permissions=Array.isArray(body.permissions)?body.permissions.map(String):['read'];
  if(permissions.some(x=>/withdraw|transfer/i.test(x)))throw new Error('Withdrawal/transfer permissions are not accepted by CryptoPilot');
  const mode=['paper','testnet','live'].includes(body.mode)?body.mode:'paper';
  if(exchange==='robinhood'&&mode==='testnet')throw new Error('Robinhood has no CryptoPilot testnet mode; use paper before live');
  const encrypted=await encryptJson(env,body.credentials),existing=await env.DB.prepare('SELECT id FROM exchange_connections WHERE user_id=? AND exchange=?').bind(userId,exchange).first();
  if(existing)await env.DB.prepare("UPDATE exchange_connections SET encrypted_credentials=?,permissions_json=?,mode=?,live_enabled=0,status='configured',updated_at=? WHERE id=?").bind(encrypted,JSON.stringify(permissions),mode,nowIso(),existing.id).run();
  else await env.DB.prepare("INSERT INTO exchange_connections(id,user_id,exchange,encrypted_credentials,permissions_json,mode,live_enabled,status,created_at,updated_at) VALUES(?,?,?,?,?,?,0,'configured',?,?)").bind(uuid(),userId,exchange,encrypted,JSON.stringify(permissions),mode,nowIso(),nowIso()).run();
  await audit(env,userId,'exchange.credentials_saved',{exchange,permissions,mode});
  return {exchange,permissions,mode,liveEnabled:false,status:'configured'};
}
export async function connectionFor(env,userId,exchange){
  const row=await env.DB.prepare('SELECT * FROM exchange_connections WHERE user_id=? AND exchange=? LIMIT 1').bind(userId,exchange).first();
  if(!row)throw new Error(`${exchange} is not configured for this user`);
  return {...row,permissions:JSON.parse(row.permissions_json||'[]'),credentials:await decryptJson(env,row.encrypted_credentials)};
}
export async function listConnections(env,userId){
  const rows=(await env.DB.prepare('SELECT exchange,permissions_json,mode,live_enabled,status,updated_at FROM exchange_connections WHERE user_id=? ORDER BY exchange').bind(userId).all()).results||[];
  return rows.map(x=>({exchange:x.exchange,permissions:JSON.parse(x.permissions_json||'[]'),mode:x.mode,liveEnabled:Boolean(x.live_enabled),status:x.status,updatedAt:x.updated_at}));
}
export async function setLiveEnabled(env,userId,exchange,enabled){
  const c=await env.DB.prepare('SELECT permissions_json,mode FROM exchange_connections WHERE user_id=? AND exchange=?').bind(userId,exchange).first(); if(!c)throw new Error('Connector not configured');
  const permissions=JSON.parse(c.permissions_json||'[]');
  if(enabled&&!permissions.includes('trade'))throw new Error('Connector needs trade permission before live execution can be enabled');
  if(enabled&&c.mode!=='live')throw new Error('Change connector mode to live before enabling live execution');
  await env.DB.prepare('UPDATE exchange_connections SET live_enabled=?,updated_at=? WHERE user_id=? AND exchange=?').bind(enabled?1:0,nowIso(),userId,exchange).run();
  await audit(env,userId,enabled?'exchange.live_enabled':'exchange.live_disabled',{exchange},enabled?'warning':'info');
  return {exchange,liveEnabled:Boolean(enabled)};
}
