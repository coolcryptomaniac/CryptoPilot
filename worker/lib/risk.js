import { clamp } from './util.js';

export function riskProfile(x={}){
  const style={Conservative:27,Balanced:50,Aggressive:72}[x.style]??50;
  let n=style+(Number(x.max_drawdown_pct??x.drawdown??18)-18)*.65+(Number(x.single_asset_cap_pct??x.singleCap??28)-28)*.35-Number(x.less_risk_clicks??x.lessRiskClicks??0)*4-Number(x.panic_stops??0)*2;
  const nw=Number(x.investable_networth??x.networth??0);
  if(nw<20000)n-=6;
  if(nw>500000)n+=3;
  return clamp(Math.round(n),15,82);
}
export function riskLimits(profile={},env={}){
  const risk=Number(profile.learned_risk??46),nw=Math.max(0,Number(profile.investable_networth??50000));
  const operatorCap=Number(env.MAX_LIVE_ORDER_USD||250),riskPct=clamp(risk/2500,.005,.035);
  return {maxOrderUsd:Math.max(10,Math.min(operatorCap,nw*riskPct)),maxDailyOrders:Number(env.MAX_DAILY_LIVE_ORDERS||20),cashFloorPct:Math.max(8,Math.round(30-risk*.25)),singleAssetCapPct:Number(profile.single_asset_cap_pct??28),paused:Boolean(profile.paused)};
}
export async function getRiskProfile(env,userId){
  let p=await env.DB.prepare('SELECT * FROM risk_profiles WHERE user_id=?').bind(userId).first();
  if(!p){await env.DB.prepare('INSERT INTO risk_profiles(user_id) VALUES(?)').bind(userId).run();p=await env.DB.prepare('SELECT * FROM risk_profiles WHERE user_id=?').bind(userId).first();}
  return p;
}
export async function persistRiskProfile(env,userId,input={}){
  const current=await getRiskProfile(env,userId);
  const next={style:input.style||current.style,investable_networth:Number(input.investable_networth??input.networth??current.investable_networth),max_drawdown_pct:Number(input.max_drawdown_pct??input.drawdown??current.max_drawdown_pct),single_asset_cap_pct:Number(input.single_asset_cap_pct??input.singleCap??current.single_asset_cap_pct),less_risk_clicks:Number(input.less_risk_clicks??current.less_risk_clicks),panic_stops:Number(input.panic_stops??current.panic_stops),samples:Number(current.samples||0)+1};
  next.learned_risk=riskProfile(next);
  await env.DB.prepare('UPDATE risk_profiles SET style=?,investable_networth=?,max_drawdown_pct=?,single_asset_cap_pct=?,learned_risk=?,less_risk_clicks=?,panic_stops=?,samples=?,updated_at=? WHERE user_id=?')
    .bind(next.style,next.investable_networth,next.max_drawdown_pct,next.single_asset_cap_pct,next.learned_risk,next.less_risk_clicks,next.panic_stops,next.samples,new Date().toISOString(),userId).run();
  return getRiskProfile(env,userId);
}
