import { bytesToB64Url,nowIso,requireDb,sha256Hex,uuid } from './util.js';

export const API_TIERS=Object.freeze({Free:{daily:100},Pilot:{daily:1000},Pro:{daily:5000},Collective:{daily:50000}});
function randomKey(){const b=crypto.getRandomValues(new Uint8Array(30));return `cp_live_${bytesToB64Url(b)}`;}
async function currentPlan(env,userId){const row=await requireDb(env).prepare('SELECT plan,status FROM subscriptions WHERE user_id=?').bind(userId).first();return row?.status==='active'&&API_TIERS[row.plan]?row.plan:'Free';}

export async function createDeveloperKey(env,user,name='Default API key'){
  const db=requireDb(env),raw=randomKey(),hash=await sha256Hex(raw),plan=await currentPlan(env,user.id),id=uuid(),prefix=raw.slice(0,16);
  await db.prepare('INSERT INTO api_keys(id,user_id,name,key_hash,key_prefix,tier,active,created_at) VALUES(?,?,?,?,?,?,1,?)').bind(id,user.id,String(name).slice(0,80),hash,prefix,plan,nowIso()).run();
  return {id,name:String(name).slice(0,80),apiKey:raw,prefix,tier:plan,dailyLimit:API_TIERS[plan].daily,warning:'This key is shown once. Store it like a password.'};
}
export async function listDeveloperKeys(env,userId){const r=await requireDb(env).prepare('SELECT id,name,key_prefix,tier,active,created_at,last_used_at FROM api_keys WHERE user_id=? ORDER BY created_at DESC').bind(userId).all();return r.results||[];}
export async function revokeDeveloperKey(env,userId,id){await requireDb(env).prepare('UPDATE api_keys SET active=0 WHERE id=? AND user_id=?').bind(id,userId).run();return {revoked:true,id};}

export async function authenticateApiKey(request,env){
  const raw=request.headers.get('x-cryptopilot-key');if(!raw)throw new Error('X-CryptoPilot-Key is required');const db=requireDb(env),hash=await sha256Hex(raw),key=await db.prepare('SELECT * FROM api_keys WHERE key_hash=? AND active=1 LIMIT 1').bind(hash).first();if(!key)throw new Error('Invalid CryptoPilot API key');
  const tier=API_TIERS[key.tier]?key.tier:'Free',limit=API_TIERS[tier].daily,since=new Date(Date.now()-24*3600*1000).toISOString(),row=await db.prepare('SELECT COUNT(*) AS n FROM api_usage WHERE api_key_id=? AND created_at>=?').bind(key.id,since).first(),used=Number(row?.n||0);if(used>=limit)throw new Error(`API daily quota reached (${limit})`);
  await db.prepare('UPDATE api_keys SET last_used_at=? WHERE id=?').bind(nowIso(),key.id).run();return {...key,tier,dailyLimit:limit,dailyUsed:used};
}
export async function recordApiUsage(env,key,endpoint,status=200,units=1){if(!env.DB||!key)return;await env.DB.prepare('INSERT INTO api_usage(id,api_key_id,user_id,endpoint,status,units,created_at) VALUES(?,?,?,?,?,?,?)').bind(uuid(),key.id,key.user_id,endpoint,status,units,nowIso()).run();}
export async function usageSummary(env,userId){const db=requireDb(env),since=new Date(Date.now()-24*3600*1000).toISOString(),r=await db.prepare('SELECT k.id,k.name,k.key_prefix,k.tier,k.active,k.last_used_at,COUNT(u.id) AS calls_24h FROM api_keys k LEFT JOIN api_usage u ON u.api_key_id=k.id AND u.created_at>=? WHERE k.user_id=? GROUP BY k.id ORDER BY k.created_at DESC').bind(since,userId).all();return {tiers:API_TIERS,keys:r.results||[]};}
