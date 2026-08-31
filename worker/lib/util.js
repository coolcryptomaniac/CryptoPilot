export const te = new TextEncoder();
export const td = new TextDecoder();

export function nowIso(){ return new Date().toISOString(); }
export function uuid(){ return crypto.randomUUID(); }
export function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
export function json(data,status=200,extra={}){
  return new Response(JSON.stringify(data,null,2),{status,headers:{
    'content-type':'application/json',
    'access-control-allow-origin':'*',
    'access-control-allow-headers':'content-type,authorization,x-idempotency-key',
    'access-control-allow-methods':'GET,POST,DELETE,OPTIONS',
    'cache-control':'no-store',...extra
  }});
}
export async function requestJson(request){ try{return await request.json()}catch{throw new Error('Invalid JSON body')} }
export function requireDb(env){ if(!env.DB) throw new Error('D1 database is not bound as env.DB'); return env.DB; }
export function bytesToB64(bytes){ let s=''; for(const b of bytes)s+=String.fromCharCode(b); return btoa(s); }
export function b64ToBytes(s){ const bin=atob(s); return Uint8Array.from(bin,c=>c.charCodeAt(0)); }
export function bytesToB64Url(bytes){ return bytesToB64(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,''); }
export function b64UrlToBytes(s){ s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4)s+='='; return b64ToBytes(s); }
export function hex(bytes){ return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join(''); }
export async function sha256Bytes(data){ return new Uint8Array(await crypto.subtle.digest('SHA-256',typeof data==='string'?te.encode(data):data)); }
export async function sha256Hex(data){ return hex(await sha256Bytes(data)); }
export async function hmacHex(secret,message,hash='SHA-256'){
  const key=await crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash},false,['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,te.encode(message))));
}
export function safeEqualHex(a,b){ if(!a||!b||a.length!==b.length||a.length%2)return false; let out=0; for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i); return out===0; }
export async function audit(env,userId,eventType,metadata={},severity='info'){
  if(!env.DB)return;
  await env.DB.prepare('INSERT INTO audit_events (id,user_id,event_type,severity,metadata_json,created_at) VALUES (?,?,?,?,?,?)')
    .bind(uuid(),userId||null,eventType,severity,JSON.stringify(metadata),nowIso()).run();
}
