import { audit,nowIso,requireDb,uuid } from './util.js';
import { PLANS } from './payments.js';

const TRANSFER_TOPIC='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const INTENT_TTL_MS=30*60*1000;
const norm=a=>String(a||'').toLowerCase();
const topicAddress=a=>'0x'+String(a||'').replace(/^0x/,'').slice(-40).toLowerCase();

function cfg(env){
  const c={rpcUrl:env.USDT_PAYMENT_RPC_URL,token:norm(env.USDT_TOKEN_ADDRESS),target:norm(env.USDT_PAYMENT_TARGET_ADDRESS),chainId:Number(env.USDT_CHAIN_ID||0),decimals:Number(env.USDT_DECIMALS||6),network:env.USDT_NETWORK||'evm',confirmations:Math.max(1,Number(env.USDT_MIN_CONFIRMATIONS||2))};
  if(!c.rpcUrl||!/^0x[0-9a-f]{40}$/.test(c.token)||!/^0x[0-9a-f]{40}$/.test(c.target)||!c.chainId)throw new Error('USDT payment rail is not fully configured');
  return c;
}
async function rpc(url,method,params=[]){const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}),j=await r.json();if(!r.ok||j.error)throw new Error(`RPC ${method} failed: ${j.error?.message||r.status}`);return j.result;}
const amountUnits=(amount,decimals)=>BigInt(Math.round(Number(amount)*10**decimals));

export async function createUsdtIntent(env,user,plan){
  const amount=PLANS[plan];if(!amount)throw new Error('Paid plan must be Pilot, Pro, or Collective');
  const c=cfg(env),actualChain=Number(BigInt(await rpc(c.rpcUrl,'eth_chainId')));if(actualChain!==c.chainId)throw new Error(`USDT RPC chain mismatch: configured ${c.chainId}, RPC returned ${actualChain}`);
  const id=uuid(),units=amountUnits(amount,c.decimals).toString(),db=requireDb(env),created=nowIso();
  await db.prepare('INSERT INTO crypto_payments(id,user_id,asset,network,plan,amount,amount_units,target_address,token_address,chain_id,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,user.id,'USDT',c.network,plan,amount,units,c.target,c.token,c.chainId,'pending',created).run();
  await audit(env,user.id,'subscription.usdt_intent',{id,plan,amount,chainId:c.chainId});
  return {intentId:id,asset:'USDT',plan,amount,amountUnits:units,decimals:c.decimals,chainId:c.chainId,network:c.network,tokenAddress:c.token,targetAddress:c.target,minConfirmations:c.confirmations,expiresAt:new Date(Date.parse(created)+INTENT_TTL_MS).toISOString(),expiresInMinutes:30};
}

export async function verifyUsdtPayment(env,user,{intentId,txHash}={}){
  if(!intentId||!/^0x[0-9a-fA-F]{64}$/.test(String(txHash||'')))throw new Error('intentId and a valid EVM transaction hash are required');
  const c=cfg(env),db=requireDb(env),row=await db.prepare('SELECT * FROM crypto_payments WHERE id=? AND user_id=? LIMIT 1').bind(intentId,user.id).first();
  if(!row)throw new Error('USDT payment intent not found');if(row.status==='confirmed')return {confirmed:true,replay:true,plan:row.plan,txHash:row.tx_hash};
  if(Date.now()-Date.parse(row.created_at)>INTENT_TTL_MS){await db.prepare("UPDATE crypto_payments SET status='expired' WHERE id=? AND status='pending'").bind(intentId).run();throw new Error('USDT payment intent expired; create a new intent');}
  if(Number(row.chain_id)!==c.chainId||norm(row.token_address)!==c.token||norm(row.target_address)!==c.target)throw new Error('USDT payment configuration changed after intent creation; create a new intent');
  const actualChain=Number(BigInt(await rpc(c.rpcUrl,'eth_chainId')));if(actualChain!==c.chainId)throw new Error(`USDT RPC chain mismatch: configured ${c.chainId}, RPC returned ${actualChain}`);
  const reused=await db.prepare('SELECT id FROM crypto_payments WHERE tx_hash=? AND id<>? LIMIT 1').bind(txHash,intentId).first();if(reused)throw new Error('Transaction hash has already been used');
  const receipt=await rpc(c.rpcUrl,'eth_getTransactionReceipt',[txHash]);if(!receipt)throw new Error('Transaction not mined yet');if(receipt.status!=='0x1')throw new Error('USDT transfer transaction reverted');
  const current=BigInt(await rpc(c.rpcUrl,'eth_blockNumber')),block=BigInt(receipt.blockNumber),confirmations=Number(current-block+1n);if(confirmations<c.confirmations)throw new Error(`Waiting for confirmations: ${confirmations}/${c.confirmations}`);
  const expected=BigInt(row.amount_units),wallet=norm(user.wallet_address);let paid=0n;
  for(const log of receipt.logs||[]){if(norm(log.address)!==c.token||norm(log.topics?.[0])!==TRANSFER_TOPIC||log.topics?.length<3)continue;const from=topicAddress(log.topics[1]),to=topicAddress(log.topics[2]);if(from===wallet&&to===c.target)paid+=BigInt(log.data||'0x0');}
  if(paid<expected)throw new Error(`USDT transfer is below required amount (${paid}/${expected} base units)`);
  const verified=nowIso();await db.prepare("UPDATE crypto_payments SET tx_hash=?,status='confirmed',verified_at=? WHERE id=?").bind(txHash,verified,intentId).run();
  await db.prepare(`INSERT INTO subscriptions(user_id,plan,status,provider,external_session_id,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,status='active',provider=excluded.provider,external_session_id=excluded.external_session_id,updated_at=excluded.updated_at`).bind(user.id,row.plan,'active','usdt_evm',txHash,verified).run();
  await audit(env,user.id,'subscription.usdt_confirmed',{intentId,txHash,plan:row.plan,amount:Number(row.amount),confirmations,chainId:c.chainId},'warning');
  return {confirmed:true,plan:row.plan,amount:Number(row.amount),asset:'USDT',txHash,confirmations,chainId:c.chainId};
}

export function usdtStatus(env){try{const c=cfg(env);return {configured:true,network:c.network,chainId:c.chainId,tokenAddress:c.token,targetAddress:c.target,minConfirmations:c.confirmations}}catch(e){return {configured:false,error:e.message}}}
