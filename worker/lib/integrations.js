import { b64ToBytes,bytesToB64,te } from './util.js';

function pemBytes(pem){return b64ToBytes(String(pem||'').replace(/-----BEGIN [^-]+-----/g,'').replace(/-----END [^-]+-----/g,'').replace(/\s+/g,''));}
async function kalshiHeaders(env,path){
  if(!env.KALSHI_API_KEY_ID||!env.KALSHI_PRIVATE_KEY_PEM)throw new Error('Kalshi market-data credentials are not configured');
  const ts=String(Date.now()),key=await crypto.subtle.importKey('pkcs8',pemBytes(env.KALSHI_PRIVATE_KEY_PEM),{name:'RSA-PSS',hash:'SHA-256'},false,['sign']),sig=new Uint8Array(await crypto.subtle.sign({name:'RSA-PSS',saltLength:32},key,te.encode(ts+'GET'+path)));
  return {'KALSHI-ACCESS-KEY':env.KALSHI_API_KEY_ID,'KALSHI-ACCESS-SIGNATURE':bytesToB64(sig),'KALSHI-ACCESS-TIMESTAMP':ts};
}
export function integrationRegistry(env={}){return [
  {id:'tether-wdk',category:'wallets/stablecoins',name:'Tether WDK + USDT',status:'prototype-ready',mode:'self-custodial',configured:Boolean(env.USDT_TOKEN_ADDRESS),notes:'WDK module example + verified EVM USDT merchant checkout; no server-side seed custody.'},
  {id:'circle-cctp-v2',category:'stablecoins/crosschain',name:'Circle CCTP V2',status:'adapter-ready',mode:'read/status',configured:true,notes:'CCTP V2 attestation/status endpoint; use Arc/Circle integrations for grant alignment.'},
  {id:'pyth',category:'oracle/market-data',name:'Pyth Core/Pro',status:'adapter-ready',mode:'read-only',configured:Boolean(env.PYTH_API_KEY),notes:'Uses post-Aug-26-2026 authenticated Hermes API.'},
  {id:'kalshi',category:'prediction-signals',name:'Kalshi',status:'adapter-ready',mode:'market-data-only',configured:Boolean(env.KALSHI_API_KEY_ID&&env.KALSHI_PRIVATE_KEY_PEM),notes:'Prediction-market data is an optional signal input. CryptoPilot does not autonomously place event-contract bets.'},
  {id:'centrifuge',category:'rwa',name:'Centrifuge',status:'live-public-api',mode:'read-only',configured:true,notes:'Public GraphQL RWA pool/token data; suitable for institutional RWA discovery.'},
  {id:'defillama',category:'defi-analytics',name:'DefiLlama',status:'live-public-api',mode:'read-only',configured:true,notes:'Protocol/TVL discovery and risk context.'},
  {id:'0x',category:'dex',name:'0x Swap API',status:'integrated',mode:'user-signed',configured:Boolean(env.ZEROX_API_KEY),notes:'Quote routing only; user wallet signs.'},
  {id:'coinbase',category:'cex',name:'Coinbase Advanced Trade',status:'integrated',mode:'paper/test/live/pilot',configured:true},
  {id:'binance',category:'cex',name:'Binance Spot',status:'integrated',mode:'paper/testnet/live/pilot',configured:true},
  {id:'kraken',category:'cex',name:'Kraken Spot',status:'integrated',mode:'paper/live/pilot',configured:true},
  {id:'robinhood',category:'cex',name:'Robinhood Crypto',status:'regional',mode:'paper/live/pilot',configured:true,notes:'Availability depends on user jurisdiction.'},
  {id:'alchemy',category:'wallet-infra',name:'Alchemy Wallet APIs',status:'integration-target',mode:'smart-wallets/session-keys',configured:Boolean(env.ALCHEMY_API_KEY)},
  {id:'jupiter',category:'solana-dex',name:'Jupiter',status:'integration-target',mode:'user-signed',configured:Boolean(env.JUPITER_API_KEY)},
  {id:'lifi',category:'crosschain',name:'LI.FI',status:'integration-target',mode:'user-signed',configured:Boolean(env.LIFI_API_KEY)},
  {id:'roamwise',category:'partner',name:'RoamWise',status:'founder-ecosystem-partner',mode:'referral/api',configured:true,notes:'Travel planning and travel-utility partner reference.'}
];}

export async function centrifugePools(limit=20){
  const n=Math.max(1,Math.min(100,Number(limit)||20)),query=`query CryptoPilotPools { pools(where:{isActive:true,name_not:null},limit:${n}) { items { id name centrifugeId isActive tokens { items { id name symbol totalIssuance tokenPrice } } } } }`;
  const r=await fetch('https://api.centrifuge.io',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query})}),j=await r.json();if(!r.ok||j.errors)throw new Error(`Centrifuge API failed: ${j.errors?.[0]?.message||r.status}`);return j.data?.pools?.items||[];
}
export async function defiLlamaProtocols(limit=25){const r=await fetch('https://api.llama.fi/protocols'),j=await r.json();if(!r.ok||!Array.isArray(j))throw new Error('DefiLlama protocols unavailable');return j.sort((a,b)=>Number(b.tvl||0)-Number(a.tvl||0)).slice(0,Math.max(1,Math.min(100,Number(limit)||25))).map(x=>({name:x.name,symbol:x.symbol,category:x.category,chains:x.chains,tvl:x.tvl,url:x.url,change_1d:x.change_1d,change_7d:x.change_7d}));}
export async function pythLatest(env,ids=[]){if(!env.PYTH_API_KEY)throw new Error('PYTH_API_KEY is not configured');const clean=ids.filter(Boolean).slice(0,20);if(!clean.length)throw new Error('At least one Pyth feed id is required');const qs=new URLSearchParams();for(const id of clean)qs.append('ids[]',id);const r=await fetch(`https://pyth.dourolabs.app/hermes/v2/updates/price/latest?${qs}`,{headers:{authorization:`Bearer ${env.PYTH_API_KEY}`}}),j=await r.json();if(!r.ok)throw new Error(`Pyth request failed (${r.status})`);return j;}
export async function kalshiMarkets(env,{limit=20,seriesTicker=''}={}){const path='/trade-api/v2/markets',q=new URLSearchParams({limit:String(Math.max(1,Math.min(100,Number(limit)||20)))});if(seriesTicker)q.set('series_ticker',seriesTicker);const r=await fetch(`https://external-api.kalshi.com${path}?${q}`,{headers:await kalshiHeaders(env,path)}),j=await r.json();if(!r.ok)throw new Error(`Kalshi market-data request failed (${r.status})`);return j;}
export async function circleCctpStatus({sourceDomain,txHash,testnet=false}={}){if(sourceDomain===undefined||!/^0x[0-9a-fA-F]{64}$/.test(String(txHash||'')))throw new Error('sourceDomain and transaction hash are required');const host=testnet?'https://iris-api-sandbox.circle.com':'https://iris-api.circle.com',r=await fetch(`${host}/v2/messages/${encodeURIComponent(sourceDomain)}?transactionHash=${encodeURIComponent(txHash)}`),j=await r.json();if(!r.ok)throw new Error(`Circle CCTP request failed (${r.status})`);return j;}
export function roamwisePartner(){return {name:'RoamWise',url:'https://www.roamwise.co.in/?utm_source=cryptopilot&utm_medium=partner&utm_campaign=founder_ecosystem',integrationIdeas:['stablecoin-paid travel plans','CryptoPilot subscriber travel benefit','API referral bundle','crypto-friendly trip intelligence'],disclaimer:'RoamWise is presented as a founder ecosystem/partner reference; no financial relationship is implied unless separately configured.'};}
