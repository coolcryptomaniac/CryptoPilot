import { generateJwt } from '@coinbase/cdp-sdk/auth';
import nacl from 'tweetnacl';
import { audit,b64ToBytes,bytesToB64,hmacHex,nowIso,sha256Bytes,te,uuid } from './util.js';
import { connectionFor } from './vault.js';
import { getRiskProfile,riskLimits } from './risk.js';

export const ALLOWED_EXCHANGES=new Set(['coinbase','binance','kraken','robinhood']);
async function krakenSign(path,nonce,body,secret){
  const hash=await sha256Bytes(te.encode(nonce+body)),p=te.encode(path),msg=new Uint8Array(p.length+hash.length);msg.set(p);msg.set(hash,p.length);
  const key=await crypto.subtle.importKey('raw',b64ToBytes(secret),{name:'HMAC',hash:'SHA-512'},false,['sign']);
  return bytesToB64(new Uint8Array(await crypto.subtle.sign('HMAC',key,msg)));
}
async function coinbaseOrder(credentials,o){
  const host='api.coinbase.com',path='/api/v3/brokerage/orders';
  const body={client_order_id:o.client_order_id||uuid(),product_id:o.product_id||o.symbol||'BTC-USD',side:String(o.side||'BUY').toUpperCase(),order_configuration:o.order_configuration||{market_market_ioc:o.quote_size?{quote_size:String(o.quote_size)}:{base_size:String(o.base_size||o.quantity)}}};
  const jwt=await generateJwt({apiKeyId:credentials.apiKeyId,apiKeySecret:credentials.apiKeySecret.replace(/\\n/g,'\n'),requestMethod:'POST',requestHost:host,requestPath:path,expiresIn:120});
  const r=await fetch(`https://${host}${path}`,{method:'POST',headers:{authorization:`Bearer ${jwt}`,'content-type':'application/json'},body:JSON.stringify(body)});
  return {status:r.status,data:await r.json()};
}
export async function coinbaseSandboxOrder(o={}){
  const body={client_order_id:o.client_order_id||uuid(),product_id:o.product_id||'BTC-USD',side:String(o.side||'BUY').toUpperCase(),order_configuration:o.order_configuration||{market_market_ioc:{quote_size:String(o.quote_size||'10')}}};
  const r=await fetch('https://api-sandbox.coinbase.com/api/v3/brokerage/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};
}
async function binanceOrder(connection,o){
  const endpoint=connection.mode==='testnet'?'https://testnet.binance.vision':'https://api.binance.com';
  const p=new URLSearchParams({symbol:o.symbol,side:String(o.side).toUpperCase(),type:String(o.type||'MARKET').toUpperCase(),timestamp:String(Date.now()),recvWindow:'5000'});
  if(o.quoteOrderQty)p.set('quoteOrderQty',String(o.quoteOrderQty)); if(o.quantity)p.set('quantity',String(o.quantity)); if(o.price)p.set('price',String(o.price)); if(o.timeInForce)p.set('timeInForce',String(o.timeInForce)); if(o.client_order_id)p.set('newClientOrderId',String(o.client_order_id).slice(0,36));
  p.set('signature',await hmacHex(connection.credentials.apiSecret,p.toString()));
  const r=await fetch(`${endpoint}/api/v3/order`,{method:'POST',headers:{'X-MBX-APIKEY':connection.credentials.apiKey,'content-type':'application/x-www-form-urlencoded'},body:p});return {status:r.status,data:await r.json()};
}
async function krakenOrder(connection,o){
  const path='/0/private/AddOrder',nonce=String(Date.now()*1000),p=new URLSearchParams({nonce,ordertype:String(o.type||'market').toLowerCase(),type:String(o.side||'buy').toLowerCase(),volume:String(o.volume||o.quantity),pair:o.pair||o.symbol});if(o.price)p.set('price',String(o.price));
  const body=p.toString(),sig=await krakenSign(path,nonce,body,connection.credentials.apiSecret);
  const r=await fetch(`https://api.kraken.com${path}`,{method:'POST',headers:{'API-Key':connection.credentials.apiKey,'API-Sign':sig,'content-type':'application/x-www-form-urlencoded'},body});return {status:r.status,data:await r.json()};
}
async function robinhoodOrder(connection,o){
  const path='/api/v1/crypto/trading/orders/',method='POST',payload={client_order_id:o.client_order_id||uuid(),side:String(o.side||'buy').toLowerCase(),type:String(o.type||'market').toLowerCase(),symbol:String(o.symbol||'BTC-USD').toUpperCase()};
  const type=payload.type;
  if(type==='market')payload.market_order_config=o.market_order_config||(o.asset_quantity||o.quantity?{asset_quantity:String(o.asset_quantity||o.quantity)}:{quote_amount:String(o.quote_amount)});
  else if(o[`${type}_order_config`])payload[`${type}_order_config`]=o[`${type}_order_config`]; else throw new Error(`${type}_order_config is required for Robinhood ${type} orders`);
  const body=JSON.stringify(payload),timestamp=Math.floor(Date.now()/1000).toString(),seed=b64ToBytes(connection.credentials.privateKeyBase64);
  if(seed.byteLength!==32)throw new Error('Robinhood privateKeyBase64 must decode to a 32-byte Ed25519 seed');
  const secretKey=nacl.sign.keyPair.fromSeed(seed).secretKey,message=`${connection.credentials.apiKey}${timestamp}${path}${method}${body}`,signature=bytesToB64(nacl.sign.detached(te.encode(message),secretKey));
  const r=await fetch(`https://trading.robinhood.com${path}`,{method,headers:{'x-api-key':connection.credentials.apiKey,'x-timestamp':timestamp,'x-signature':signature,'content-type':'application/json; charset=utf-8'},body});return {status:r.status,data:await r.json()};
}
function inferNotional(o){for(const x of [o.notional_usd,o.quote_amount,o.quoteOrderQty,o.quote_size])if(Number(x)>0)return Number(x);return 0;}
async function gateOrder(env,userId,connection,order){
  const profile=await getRiskProfile(env,userId),limits=riskLimits(profile,env); if(limits.paused)throw new Error(`Trading is paused${profile.paused_reason?`: ${profile.paused_reason}`:''}`); if(!connection.permissions.includes('trade'))throw new Error('Connector lacks trade permission');
  const paper=connection.mode==='paper',testnet=connection.exchange==='binance'&&connection.mode==='testnet';
  if(!paper&&!testnet){if(env.ENABLE_LIVE_TRADING!=='true')throw new Error('Global live trading switch is disabled');if(!connection.live_enabled)throw new Error('User-level live trading switch is disabled for this connector');}
  const notional=inferNotional(order);if(!paper&&!notional)throw new Error('notional_usd or a quote amount is required for deterministic live risk checks');if(!paper&&notional>limits.maxOrderUsd)throw new Error(`Order blocked: $${notional.toFixed(2)} exceeds current $${limits.maxOrderUsd.toFixed(2)} hard order cap`);
  if(!paper&&env.DB){const since=new Date(Date.now()-24*3600*1000).toISOString(),count=await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE user_id=? AND mode!='paper' AND created_at>=?").bind(userId,since).first();if(Number(count?.n||0)>=limits.maxDailyOrders)throw new Error('Daily live/test order count circuit breaker reached');}
  return {paper,testnet,notional};
}
export async function executeOrder(request,env,user,exchange,body={}){
  const key=request.headers.get('x-idempotency-key')||body.idempotency_key;if(!key||key.length>128)throw new Error('X-Idempotency-Key is required (1-128 characters)');
  const existing=await env.DB.prepare('SELECT * FROM orders WHERE idempotency_key=? LIMIT 1').bind(key).first();if(existing)return {replay:true,order:existing,response:existing.response_json?JSON.parse(existing.response_json):null};
  const connection=await connectionFor(env,user.id,exchange);connection.exchange=exchange;const gate=await gateOrder(env,user.id,connection,body),orderId=uuid(),symbol=body.symbol||body.product_id||body.pair||'UNKNOWN',created=nowIso();
  await env.DB.prepare("INSERT INTO orders(id,user_id,exchange,mode,symbol,side,order_type,quantity,quote_amount,notional_usd,status,idempotency_key,request_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,'pending',?,?,?,?)").bind(orderId,user.id,exchange,connection.mode,symbol,String(body.side||''),String(body.type||'market'),Number(body.quantity||body.volume||0)||null,Number(body.quote_amount||body.quoteOrderQty||body.quote_size||0)||null,gate.notional||null,key,JSON.stringify(body),created,created).run();
  if(gate.paper){const response={success:true,paper:true,order_id:orderId,symbol,side:body.side,notional_usd:gate.notional||null,message:'Paper order recorded; no exchange request was sent.'};await env.DB.prepare("UPDATE orders SET status='paper_filled',response_json=?,updated_at=? WHERE id=?").bind(JSON.stringify(response),nowIso(),orderId).run();await audit(env,user.id,'order.paper',{exchange,symbol,side:body.side,notional:gate.notional});return response;}
  try{
    const upstream=exchange==='coinbase'?await coinbaseOrder(connection.credentials,body):exchange==='binance'?await binanceOrder(connection,body):exchange==='kraken'?await krakenOrder(connection,body):await robinhoodOrder(connection,body),ok=upstream.status>=200&&upstream.status<300,external=upstream.data?.order_id||upstream.data?.orderId||upstream.data?.id||upstream.data?.order?.order_id||null;
    await env.DB.prepare('UPDATE orders SET status=?,external_order_id=?,response_json=?,updated_at=? WHERE id=?').bind(ok?'submitted':'rejected',external,JSON.stringify(upstream.data),nowIso(),orderId).run();await audit(env,user.id,ok?'order.submitted':'order.rejected',{exchange,symbol,status:upstream.status,notional:gate.notional},ok?'warning':'error');return {localOrderId:orderId,upstreamStatus:upstream.status,data:upstream.data};
  }catch(e){await env.DB.prepare("UPDATE orders SET status='error',response_json=?,updated_at=? WHERE id=?").bind(JSON.stringify({error:e.message}),nowIso(),orderId).run();await audit(env,user.id,'order.error',{exchange,symbol,error:e.message},'error');throw e;}
}
