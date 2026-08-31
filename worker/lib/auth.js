import { getAddress,verifyMessage } from 'viem';
import { audit,bytesToB64Url,nowIso,sha256Hex,uuid } from './util.js';

export function authChallengeMessage(address,nonce,issuedAt,expiresAt){
  return ['CryptoPilot wants you to sign in with your wallet.','',`Address: ${address}`,`Nonce: ${nonce}`,`Issued At: ${issuedAt}`,`Expiration Time: ${expiresAt}`,'','This signature only authenticates you. It does not authorize a trade or token transfer.'].join('\n');
}
async function createSession(env,userId){
  const token=bytesToB64Url(crypto.getRandomValues(new Uint8Array(32))),tokenHash=await sha256Hex(token),expiresAt=new Date(Date.now()+30*24*3600*1000).toISOString();
  await env.DB.prepare('INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)').bind(uuid(),userId,tokenHash,expiresAt,nowIso()).run();
  return {token,expiresAt};
}
export async function authUser(request,env,required=true){
  if(!env.DB){if(required)throw new Error('Persistent auth requires D1');return null;}
  const auth=request.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer ')){if(required)throw new Error('Missing bearer session');return null;}
  const tokenHash=await sha256Hex(auth.slice(7).trim());
  const user=await env.DB.prepare(`SELECT u.id,u.wallet_address,u.email,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? LIMIT 1`).bind(tokenHash,nowIso()).first();
  if(!user&&required)throw new Error('Session is invalid or expired'); return user||null;
}
export async function createWalletChallenge(env,addressInput){
  if(!env.DB)throw new Error('D1 database is not bound as env.DB');
  const address=getAddress(addressInput),nonce=bytesToB64Url(crypto.getRandomValues(new Uint8Array(18))),issuedAt=nowIso(),expiresAt=new Date(Date.now()+10*60*1000).toISOString(),message=authChallengeMessage(address,nonce,issuedAt,expiresAt);
  await env.DB.prepare(`INSERT INTO wallet_challenges(wallet_address,nonce,message,expires_at,used,created_at) VALUES(?,?,?,?,0,?) ON CONFLICT(wallet_address) DO UPDATE SET nonce=excluded.nonce,message=excluded.message,expires_at=excluded.expires_at,used=0,created_at=excluded.created_at`).bind(address.toLowerCase(),nonce,message,expiresAt,issuedAt).run();
  return {address,message,expiresAt};
}
export async function verifyWalletChallenge(env,body={}){
  if(!env.DB)throw new Error('D1 database is not bound as env.DB');
  const address=getAddress(body.address),challenge=await env.DB.prepare('SELECT * FROM wallet_challenges WHERE wallet_address=? LIMIT 1').bind(address.toLowerCase()).first();
  if(!challenge||challenge.used||challenge.expires_at<=nowIso())throw new Error('Challenge is missing, used, or expired');
  if(challenge.message!==body.message)throw new Error('Signed message does not match the issued challenge');
  if(!await verifyMessage({address,message:body.message,signature:body.signature}))throw new Error('Wallet signature is invalid');
  await env.DB.prepare('UPDATE wallet_challenges SET used=1 WHERE wallet_address=?').bind(address.toLowerCase()).run();
  let user=await env.DB.prepare('SELECT * FROM users WHERE wallet_address=? LIMIT 1').bind(address.toLowerCase()).first();
  if(!user){
    const id=uuid(),now=nowIso();
    await env.DB.prepare('INSERT INTO users(id,wallet_address,created_at,updated_at) VALUES(?,?,?,?)').bind(id,address.toLowerCase(),now,now).run();
    await env.DB.prepare('INSERT INTO risk_profiles(user_id) VALUES(?)').bind(id).run();
    await env.DB.prepare('INSERT INTO portfolios(id,user_id,name,currency,mode) VALUES(?,?,?,?,?)').bind(uuid(),id,'Main','USD','paper').run();
    user=await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
  }
  const session=await createSession(env,user.id); await audit(env,user.id,'auth.wallet_login',{wallet:address.toLowerCase()});
  return {user:{id:user.id,walletAddress:address},...session};
}
