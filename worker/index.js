import { json,requestJson,requireDb,audit,nowIso,uuid } from './lib/util.js';
import { authUser,createWalletChallenge,verifyWalletChallenge } from './lib/auth.js';
import { getRiskProfile,persistRiskProfile,riskLimits,riskProfile } from './lib/risk.js';
import { listConnections,saveConnection,setLiveEnabled } from './lib/vault.js';
import { ALLOWED_EXCHANGES,coinbaseSandboxOrder,executeOrder } from './lib/exchanges.js';
import { backtestSmaCross,dexQuote,fetchCandles,gdelt } from './lib/market.js';
import { createPaymentSession,processPaymentWebhook } from './lib/payments.js';

function connectorCapabilities(env){
  return {
    Coinbase:{auth:'CDP JWT',execution:'Advanced Trade production + legacy static sandbox',userCredentials:true},
    Binance:{auth:'HMAC SHA-256',execution:'Spot + Spot Testnet',userCredentials:true},
    Kraken:{auth:'API-Key + API-Sign',execution:'REST AddOrder',userCredentials:true},
    'Robinhood Crypto':{auth:'Ed25519 x-signature',execution:'Official Crypto Trading API; regional eligibility applies',userCredentials:true},
    '0x DEX':{auth:env.ZEROX_API_KEY?'operator API key configured':'operator API key missing',execution:'quote only; user wallet signs transaction',userCredentials:false},
    payments:{provider:'Coinbase Payment Acceptance',configured:Boolean(env.COINBASE_PAYMENT_API_KEY_ID&&env.COINBASE_PAYMENT_API_KEY_SECRET)}
  };
}
async function telegram(env,body){
  if(!env.TELEGRAM_BOT_TOKEN)return json({ok:false,error:'Telegram bot token not configured'},503);
  const msg=body.message;if(!msg?.chat?.id)return json({ok:true});const t=(msg.text||'').trim();
  let answer='CryptoPilot: /status, /risk, /pause. Trading commands are deliberately not accepted over Telegram.';
  if(t==='/status')answer=`CryptoPilot backend online. Global live switch: ${env.ENABLE_LIVE_TRADING==='true'?'enabled':'off'}.`;
  if(t==='/pause')answer='For security, pause is applied only from an authenticated app session. Telegram remains alerts/status only.';
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:msg.chat.id,text:answer})});return json({ok:true});
}

async function route(request,env){
  if(request.method==='OPTIONS')return json({ok:true});
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/health')return json({ok:true,service:'CryptoPilot Worker',version:'2.0-production-layer',persistence:Boolean(env.DB),globalLiveTrading:env.ENABLE_LIVE_TRADING==='true'});
  if(path==='/api/connectors'){const user=await authUser(request,env,false);return json({connectors:connectorCapabilities(env),userConnections:user?await listConnections(env,user.id):[]});}

  if(path==='/api/auth/wallet/challenge'&&request.method==='POST')return json(await createWalletChallenge(env,(await requestJson(request)).address));
  if(path==='/api/auth/wallet/verify'&&request.method==='POST')return json(await verifyWalletChallenge(env,await requestJson(request)));
  if(path==='/api/auth/me'){const user=await authUser(request,env);return json({user:{id:user.id,walletAddress:user.wallet_address,email:user.email}});}

  if(path==='/api/news'){const x=await gdelt(url.searchParams.get('q')||'bitcoin OR ethereum OR crypto');return json(x.data,x.status);}
  if(path==='/api/dex/quote'){const x=await dexQuote(env,url);return json(x.data,x.status);}
  if(path==='/api/market/candles'){const product=url.searchParams.get('product')||'BTC-USD';return json({product,candles:await fetchCandles(product,Number(url.searchParams.get('granularity')||3600))});}
  if(path==='/api/backtest'&&request.method==='POST'){
    const body=await requestJson(request),product=body.product||'BTC-USD',candles=await fetchCandles(product,body.granularity||3600),result=backtestSmaCross(candles,body),user=await authUser(request,env,false);
    if(user&&env.DB)await env.DB.prepare('INSERT INTO strategy_runs(id,user_id,strategy,product_id,params_json,result_json,created_at) VALUES(?,?,?,?,?,?,?)').bind(uuid(),user.id,'sma-cross',product,JSON.stringify(body),JSON.stringify(result),nowIso()).run();
    return json(result);
  }

  if(path==='/api/risk/profile'&&request.method==='POST'){
    const body=await requestJson(request),user=await authUser(request,env,false);if(!user)return json({risk:riskProfile(body),persisted:false});
    const profile=await persistRiskProfile(env,user.id,body);return json({profile,limits:riskLimits(profile,env),persisted:true});
  }
  if(path==='/api/risk/profile'&&request.method==='GET'){const user=await authUser(request,env),profile=await getRiskProfile(env,user.id);return json({profile,limits:riskLimits(profile,env)});}
  if((path==='/api/risk/pause'||path==='/api/risk/resume')&&request.method==='POST'){
    const user=await authUser(request,env),pause=path.endsWith('/pause'),body=await requestJson(request);
    await requireDb(env).prepare('UPDATE risk_profiles SET paused=?,paused_reason=?,panic_stops=panic_stops+?,updated_at=? WHERE user_id=?').bind(pause?1:0,pause?String(body.reason||'user emergency stop'):null,pause?1:0,nowIso(),user.id).run();
    await audit(env,user.id,pause?'risk.paused':'risk.resumed',{reason:body.reason||null},pause?'warning':'info');return json({paused:pause});
  }

  const exMatch=path.match(/^\/api\/exchanges\/([a-z-]+)$/);
  if(path==='/api/exchanges'&&request.method==='GET'){const user=await authUser(request,env);return json({connections:await listConnections(env,user.id)});}
  if(exMatch&&request.method==='POST'){const user=await authUser(request,env);return json(await saveConnection(env,user.id,exMatch[1],await requestJson(request)));}
  if(exMatch&&request.method==='DELETE'){const user=await authUser(request,env);await requireDb(env).prepare('DELETE FROM exchange_connections WHERE user_id=? AND exchange=?').bind(user.id,exMatch[1]).run();await audit(env,user.id,'exchange.deleted',{exchange:exMatch[1]});return json({ok:true});}
  const liveMatch=path.match(/^\/api\/exchanges\/([a-z-]+)\/live$/);
  if(liveMatch&&request.method==='POST'){const user=await authUser(request,env),body=await requestJson(request);return json(await setLiveEnabled(env,user.id,liveMatch[1],Boolean(body.enabled)));}

  const orderMatch=path.match(/^\/api\/orders\/([a-z-]+)$/);
  if(orderMatch&&request.method==='POST'){const exchange=orderMatch[1];if(!ALLOWED_EXCHANGES.has(exchange))return json({error:'Unsupported exchange'},404);const user=await authUser(request,env);return json(await executeOrder(request,env,user,exchange,await requestJson(request)));}
  if(path==='/api/order/coinbase-sandbox'&&request.method==='POST'){const x=await coinbaseSandboxOrder(await requestJson(request));return json(x.data,x.status);}

  if(path==='/api/subscription/checkout'&&request.method==='POST'){const user=await authUser(request,env),body=await requestJson(request);return json(await createPaymentSession(env,user,body.plan));}
  if(path==='/api/subscription'&&request.method==='GET'){const user=await authUser(request,env),row=await requireDb(env).prepare('SELECT * FROM subscriptions WHERE user_id=?').bind(user.id).first();return json({subscription:row||{plan:'Free',status:'active'}});}
  if(path==='/api/webhooks/coinbase-payments'&&request.method==='POST')return processPaymentWebhook(request,env);
  if(path==='/api/telegram/webhook'&&request.method==='POST')return telegram(env,await requestJson(request));
  return json({error:'not found'},404);
}

export default{async fetch(request,env){try{return await route(request,env)}catch(e){const message=e?.message||String(e);const status=/Missing bearer|invalid or expired|signature is invalid|Challenge|requires D1/i.test(message)?401:/required|Unsupported|blocked|disabled|permission|cap|circuit breaker|mode|not configured/i.test(message)?400:500;return json({error:message},status)}}};
export { riskProfile,riskLimits,backtestSmaCross };
