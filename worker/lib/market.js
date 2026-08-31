import { clamp } from './util.js';

export async function dexQuote(env,url){
  if(!env.ZEROX_API_KEY)throw new Error('ZEROX_API_KEY is not configured');
  const qs=new URLSearchParams(url.searchParams),r=await fetch(`https://api.0x.org/swap/allowance-holder/quote?${qs}`,{headers:{'0x-api-key':env.ZEROX_API_KEY,'0x-version':'v2'}}),data=await r.json();
  if(data?.transaction?.to&&data?.issues?.allowance?.spender&&data.transaction.to.toLowerCase()===data.issues.allowance.spender.toLowerCase())data.securityWarning='Execution target and allowance spender unexpectedly match; do not approve the Settler. Re-check the 0x response.';
  return {status:r.status,data};
}
export async function gdelt(q){
  const u=new URL('https://api.gdeltproject.org/api/v2/doc/doc');u.searchParams.set('query',q||'crypto');u.searchParams.set('mode','ArtList');u.searchParams.set('format','json');u.searchParams.set('maxrecords','20');const r=await fetch(u);return {status:r.status,data:await r.json()};
}
export async function fetchCandles(product='BTC-USD',granularity=3600){
  const allowed=new Set([60,300,900,3600,21600,86400]);if(!allowed.has(Number(granularity)))throw new Error('Unsupported candle granularity');
  const u=new URL(`https://api.exchange.coinbase.com/products/${encodeURIComponent(product)}/candles`);u.searchParams.set('granularity',String(granularity));const r=await fetch(u,{headers:{'cache-control':'no-cache'}});if(!r.ok)throw new Error(`Coinbase candle request failed (${r.status})`);
  const raw=await r.json();return raw.map(c=>({time:Number(c[0]),low:Number(c[1]),high:Number(c[2]),open:Number(c[3]),close:Number(c[4]),volume:Number(c[5]||0)})).sort((a,b)=>a.time-b.time);
}
function sma(values,end,period){if(end+1<period)return null;let sum=0;for(let i=end-period+1;i<=end;i++)sum+=values[i];return sum/period;}
export function backtestSmaCross(candles,params={}){
  const fast=clamp(Number(params.fast||10),2,100),slow=clamp(Number(params.slow||30),fast+1,200),feeBps=clamp(Number(params.feeBps||25),0,200),initial=Number(params.capital||10000);let cash=initial,asset=0,peak=cash,maxDd=0,trades=0;const closes=candles.map(c=>c.close),start=Math.max(slow,2);
  for(let i=start;i<candles.length;i++){const f=sma(closes,i,fast),s=sma(closes,i,slow),pf=sma(closes,i-1,fast),ps=sma(closes,i-1,slow),price=closes[i];if(asset===0&&f>s&&pf<=ps){const fee=cash*feeBps/10000;asset=(cash-fee)/price;cash=0;trades++;}else if(asset>0&&f<s&&pf>=ps){const gross=asset*price;cash=gross*(1-feeBps/10000);asset=0;trades++;}const value=cash+asset*price;peak=Math.max(peak,value);maxDd=Math.max(maxDd,peak?(peak-value)/peak:0);}
  const endPrice=closes.at(-1)||0,finalValue=cash+asset*endPrice,bh=candles.length?(closes.at(-1)/closes[0]-1)*100:0;
  return {strategy:'sma-cross',fast,slow,feeBps,candles:candles.length,trades,initialCapital:initial,finalValue:Number(finalValue.toFixed(2)),returnPct:Number(((finalValue/initial-1)*100).toFixed(2)),buyHoldPct:Number(bh.toFixed(2)),maxDrawdownPct:Number((maxDd*100).toFixed(2))};
}
