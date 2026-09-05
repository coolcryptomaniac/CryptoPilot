import { json,requestJson,requireDb,audit,nowIso,uuid } from './lib/util.js';
import { authUser,createWalletChallenge,verifyWalletChallenge } from './lib/auth.js';
import { getRiskProfile,persistRiskProfile,riskLimits,riskProfile } from './lib/risk.js';
import { listConnections,saveConnection,setLiveEnabled } from './lib/vault.js';
import { ALLOWED_EXCHANGES,coinbaseSandboxOrder,executeOrder } from './lib/exchanges.js';
import { backtestSmaCross,dexQuote,fetchCandles,gdelt } from './lib/market.js';
import { createPaymentSession,processPaymentWebhook } from './lib/payments.js';
import { createUsdtIntent,verifyUsdtPayment,usdtStatus } from './lib/usdt.js';
import { aggregateNews,NEWS_SOURCES } from './lib/news.js';
import { grantRadar } from './lib/grants.js';
import { auditExport,institutionalReport,INSTITUTIONAL_CONTROLS } from './lib/institutional.js';
import { createDeveloperKey,listDeveloperKeys,revokeDeveloperKey,authenticateApiKey,recordApiUsage,usageSummary } from './lib/developer-api.js';
import { integrationRegistry,centrifugePools,defiLlamaProtocols,pythLatest,kalshiMarkets,circleCctpStatus,roamwisePartner } from './lib/integrations.js';
import { pilotConfig,isPilotWalletAllowed } from './lib/pilot.js';
import { createInvestorInterest,investorSummary,hyperliquidMids } from './lib/v23.js';
import { rampConfig,rampPreview } from './lib/ramps.js';

function connectorCapabilities(env){
  return {
    Coinbase:{auth:'CDP JWT',execution:'Advanced Trade production + legacy static sandbox',userCredentials:true},
    Binance:{auth:'HMAC SHA-256',execution:'Spot + Spot Testnet',userCredentials:true},
    Kraken:{auth:'API-Key + API-Sign',execution:'REST AddOrder',userCredentials:true},
    'Robinhood Crypto':{auth:'Ed25519 x-signature',execution:'Official Crypto Trading API; regional eligibility applies',userCredentials:true},
    '0x DEX':{auth:env.ZEROX_API_KEY?'operator API key configured':'operator API key missing',execution:'quote only; user wallet signs transaction',userCredentials:false},
    Uniswap:{auth:'user wallet',execution:'backend-free custom-link microtrade + future Trading API',userCredentials:false},
    Hyperliquid:{auth:'public data; trading signer intentionally not enabled here',execution:'allMids market data',userCredentials:false},
    USDC:{provider:'Coinbase Payment Acceptance',configured:Boolean(env.COINBASE_PAYMENT_API_KEY_ID&&env.COINBASE_PAYMENT_API_KEY_SECRET)},
    USDT:{provider:'Tether-compatible EVM merchant verification',...usdtStatus(env)}
  };
}
async function telegram(env,body){
  if(!env.TELEGRAM_BOT_TOKEN)return json({ok:false,error:'Telegram bot token not configured'},503);
  const msg=body.message;if(!msg?.chat?.id)return json({ok:true});const t=(msg.text||'').trim();
  let answer='CryptoPilot: /status, /risk, /pause. Trading commands are deliberately not accepted over Telegram.';
  if(t==='/status')answer=`CryptoPilot backend online. Full live: ${env.ENABLE_LIVE_TRADING==='true'?'enabled':'off'}. Pilot: ${env.ENABLE_PILOT_TRADING==='true'?'enabled':'off'}.`;
  if(t==='/pause')answer='For security, pause is applied only from an authenticated app session. Telegram remains alerts/status only.';
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:msg.chat.id,text:answer})});return json({ok:true});
}
async function developerRoute(request,env,url,path){
  const key=await authenticateApiKey(request,env);let data;
  if(path==='/v1/news')data=await aggregateNews({source:url.searchParams.get('source')||'all',q:url.searchParams.get('q')||'',limit:url.searchParams.get('limit')||30});
  else if(path==='/v1/grants')data=grantRadar({ecosystem:url.searchParams.get('ecosystem')||'',status:url.searchParams.get('status')||''});
  else if(path==='/v1/integrations')data={integrations:integrationRegistry(env)};
  else if(path==='/v1/rwa/pools')data={provider:'Centrifuge',pools:await centrifugePools(url.searchParams.get('limit')||20)};
  else if(path==='/v1/defi/protocols')data={provider:'DefiLlama',protocols:await defiLlamaProtocols(url.searchParams.get('limit')||25)};
  else if(path==='/v1/prediction/markets')data={provider:'Kalshi',mode:'market-data-only',data:await kalshiMarkets(env,{limit:url.searchParams.get('limit')||20,seriesTicker:url.searchParams.get('series_ticker')||''})};
  else if(path==='/v1/hyperliquid/mids')data=await hyperliquidMids();
  else if(path==='/v1/oracle/pyth')data={provider:'Pyth',data:await pythLatest(env,url.searchParams.getAll('id'))};
  else if(path==='/v1/risk/quote'&&request.method==='POST'){const b=await requestJson(request),score=riskProfile(b),profile={learned_risk:score,investable_networth:Number(b.networth||50000),single_asset_cap_pct:Number(b.singleCap||28),paused:0};data={score,limits:riskLimits(profile,env),note:'Deterministic sizing output only; not investment advice or an execution authorization.'};}
  else return json({error:'Developer API endpoint not found'},404);
  await recordApiUsage(env,key,path,200);return json({...data,api:{tier:key.tier,dailyLimit:key.dailyLimit,dailyUsedBeforeCall:key.dailyUsed}});
}

async function route(request,env){
  if(request.method==='OPTIONS')return json({ok:true});
  const url=new URL(request.url),path=url.pathname;
  if(path.startsWith('/v1/'))return developerRoute(request,env,url,path);
  if(path==='/api/health')return json({ok:true,service:'CryptoPilot Worker',version:'2.3-social-microtrade-investor',persistence:Boolean(env.DB),globalLiveTrading:env.ENABLE_LIVE_TRADING==='true',pilot:pilotConfig(env),usdt:usdtStatus(env)});
  if(path==='/api/connectors'){const user=await authUser(request,env,false);return json({connectors:connectorCapabilities(env),userConnections:user?await listConnections(env,user.id):[]});}
  if(path==='/api/integrations')return json({integrations:integrationRegistry(env)});
  if(path==='/api/ramp/config'&&request.method==='GET')return json(rampConfig(env));
  if(path==='/api/ramp/preview'&&request.method==='POST')return json(rampPreview(env,await requestJson(request)));
  if(path==='/api/partner/roamwise')return json(roamwisePartner());
  if(path==='/api/hyperliquid/mids')return json(await hyperliquidMids());
  if(path==='/api/investor/summary')return json(await investorSummary(env));
  if(path==='/api/investor/interest'&&request.method==='POST')return json(await createInvestorInterest(env,await requestJson(request)),201);

  if(path==='/api/auth/wallet/challenge'&&request.method==='POST')return json(await createWalletChallenge(env,(await requestJson(request)).address));
  if(path==='/api/auth/wallet/verify'&&request.method==='POST')return json(await verifyWalletChallenge(env,await requestJson(request)));
  if(path==='/api/auth/me'){const user=await authUser(request,env);return json({user:{id:user.id,walletAddress:user.wallet_address,email:user.email}});}
  if(path==='/api/pilot/status'){const user=await authUser(request,env,false),cfg=pilotConfig(env);return json({enabled:cfg.enabled,maxOrderUsd:cfg.maxOrderUsd,maxDailyNotionalUsd:cfg.maxDailyNotionalUsd,maxDailyOrders:cfg.maxDailyOrders,walletAllowed:user?isPilotWalletAllowed(user,env):false,fullLiveTrading:env.ENABLE_LIVE_TRADING==='true',notice:'Pilot limits reduce operational risk but do not create a tax, licensing, AML or consumer-law exemption.'});}

  if(path==='/api/news/curated')return json(await aggregateNews({source:url.searchParams.get('source')||'all',q:url.searchParams.get('q')||'',limit:url.searchParams.get('limit')||30}));
  if(path==='/api/news/sources')return json({sources:NEWS_SOURCES});
  if(path==='/api/news'){const x=await gdelt(url.searchParams.get('q')||'bitcoin OR ethereum OR crypto');return json(x.data,x.status);}
  if(path==='/api/grants')return json(grantRadar({ecosystem:url.searchParams.get('ecosystem')||'',status:url.searchParams.get('status')||''}));
  if(path==='/api/institutional/controls')return json({controls:INSTITUTIONAL_CONTROLS});
  if(path==='/api/institutional/report'){const user=await authUser(request,env);return json(await institutionalReport(env,user.id));}
  if(path==='/api/institutional/audit-export'){const user=await authUser(request,env);return json(await auditExport(env,user.id,url.searchParams.get('limit')||250));}
  if(path==='/api/rwa/centrifuge')return json({provider:'Centrifuge',pools:await centrifugePools(url.searchParams.get('limit')||20)});
  if(path==='/api/defi/protocols')return json({provider:'DefiLlama',protocols:await defiLlamaProtocols(url.searchParams.get('limit')||25)});
  if(path==='/api/prediction/kalshi')return json({provider:'Kalshi',mode:'market-data-only',data:await kalshiMarkets(env,{limit:url.searchParams.get('limit')||20,seriesTicker:url.searchParams.get('series_ticker')||''})});
  if(path==='/api/oracle/pyth')return json({provider:'Pyth',data:await pythLatest(env,url.searchParams.getAll('id'))});
  if(path==='/api/circle/cctp')return json(await circleCctpStatus({sourceDomain:url.searchParams.get('sourceDomain'),txHash:url.searchParams.get('txHash'),testnet:url.searchParams.get('testnet')==='true'}));
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
  if(path==='/api/subscription/usdt/intent'&&request.method==='POST'){const user=await authUser(request,env),body=await requestJson(request);return json(await createUsdtIntent(env,user,body.plan));}
  if(path==='/api/subscription/usdt/verify'&&request.method==='POST'){const user=await authUser(request,env);return json(await verifyUsdtPayment(env,user,await requestJson(request)));}
  if(path==='/api/subscription'&&request.method==='GET'){const user=await authUser(request,env),row=await requireDb(env).prepare('SELECT * FROM subscriptions WHERE user_id=?').bind(user.id).first();return json({subscription:row||{plan:'Free',status:'active'}});}
  if(path==='/api/webhooks/coinbase-payments'&&request.method==='POST')return processPaymentWebhook(request,env);

  if(path==='/api/developer/keys'&&request.method==='POST'){const user=await authUser(request,env),body=await requestJson(request);return json(await createDeveloperKey(env,user,body.name));}
  if(path==='/api/developer/keys'&&request.method==='GET'){const user=await authUser(request,env);return json({keys:await listDeveloperKeys(env,user.id)});}
  const keyDelete=path.match(/^\/api\/developer\/keys\/([^/]+)$/);if(keyDelete&&request.method==='DELETE'){const user=await authUser(request,env);return json(await revokeDeveloperKey(env,user.id,keyDelete[1]));}
  if(path==='/api/developer/usage'){const user=await authUser(request,env);return json(await usageSummary(env,user.id));}

  if(path==='/api/telegram/webhook'&&request.method==='POST')return telegram(env,await requestJson(request));
  return json({error:'not found'},404);
}

export default{async fetch(request,env){try{return await route(request,env)}catch(e){const message=e?.message||String(e);const status=/Missing bearer|invalid or expired|signature is invalid|Challenge|X-CryptoPilot-Key|Invalid CryptoPilot API key/i.test(message)?401:/required|Unsupported|blocked|disabled|permission|cap|quota|circuit breaker|mode|not configured|allowlist|confirmations|recent expression|Indicative amount|acknowledgement|must be between/i.test(message)?400:500;return json({error:message},status)}}};
export { riskProfile,riskLimits,backtestSmaCross };
