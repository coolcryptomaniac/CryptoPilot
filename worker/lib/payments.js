import { generateJwt } from '@coinbase/cdp-sdk/auth';
import { audit,hmacHex,nowIso,safeEqualHex,uuid } from './util.js';

export const PLANS=Object.freeze({Free:0,Pilot:10,Pro:35,Collective:100});
export async function createPaymentSession(env,user,plan){
  const amount=PLANS[plan]; if(!amount)throw new Error('Paid plan must be Pilot, Pro, or Collective');
  if(!env.COINBASE_PAYMENT_API_KEY_ID||!env.COINBASE_PAYMENT_API_KEY_SECRET)throw new Error('Coinbase Payment Acceptance credentials are not configured');
  const host='api.cdp.coinbase.com',path='/platform/v2/payment-sessions';
  const target=env.PAYMENT_TARGET_ACCOUNT_ID?{accountId:env.PAYMENT_TARGET_ACCOUNT_ID,asset:env.PAYMENT_SETTLEMENT_ASSET||'usdc'}:env.PAYMENT_TARGET_ADDRESS?{address:env.PAYMENT_TARGET_ADDRESS,network:env.PAYMENT_TARGET_NETWORK||'base'}:null;
  if(!target)throw new Error('PAYMENT_TARGET_ACCOUNT_ID or PAYMENT_TARGET_ADDRESS must be configured');
  const token=await generateJwt({apiKeyId:env.COINBASE_PAYMENT_API_KEY_ID,apiKeySecret:env.COINBASE_PAYMENT_API_KEY_SECRET.replace(/\\n/g,'\n'),requestMethod:'POST',requestHost:host,requestPath:path,expiresIn:120});
  const body={amount:amount.toFixed(2),asset:'usdc',target,autoCapture:true,externalReferenceId:`cryptopilot-${user.id}-${uuid()}`,metadata:{user_id:user.id,plan}};
  if(env.PAYMENT_SUCCESS_URL||env.PAYMENT_FAILURE_URL)body.redirect={...(env.PAYMENT_SUCCESS_URL?{successUrl:env.PAYMENT_SUCCESS_URL}:{}),...(env.PAYMENT_FAILURE_URL?{failureUrl:env.PAYMENT_FAILURE_URL}:{})};
  const r=await fetch(`https://${host}${path}`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json','x-idempotency-key':uuid()},body:JSON.stringify(body)}),data=await r.json();
  if(!r.ok)throw new Error(`Payment session failed (${r.status}): ${JSON.stringify(data)}`);
  if(env.DB)await env.DB.prepare(`INSERT INTO subscriptions(user_id,plan,status,provider,external_session_id,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,provider=excluded.provider,external_session_id=excluded.external_session_id,updated_at=excluded.updated_at`).bind(user.id,plan,'pending','coinbase_payment_acceptance',data.paymentSessionId||null,nowIso()).run();
  await audit(env,user.id,'subscription.checkout_created',{plan,paymentSessionId:data.paymentSessionId});
  return {plan,amount,paymentSessionId:data.paymentSessionId,url:data.url,x402Url:data.x402Url,status:data.status};
}
async function verifyWebhook(request,env,rawBody){
  if(!env.COINBASE_WEBHOOK_SECRET)throw new Error('COINBASE_WEBHOOK_SECRET is not configured');
  const sig=request.headers.get('x-hook0-signature'); if(!sig)return false;
  const parts=Object.fromEntries(sig.split(',').map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)]}));
  if(!parts.t||!parts.v0)return false; const age=Math.abs(Date.now()-Number(parts.t)*1000);if(!Number.isFinite(age)||age>5*60*1000)return false;
  const expected=await hmacHex(env.COINBASE_WEBHOOK_SECRET,`${parts.t}.${rawBody}`);return safeEqualHex(expected,parts.v0);
}
export async function processPaymentWebhook(request,env){
  const raw=await request.text(); if(!await verifyWebhook(request,env,raw))return new Response(JSON.stringify({ok:false,error:'Invalid webhook signature'}),{status:400,headers:{'content-type':'application/json'}});
  const event=JSON.parse(raw),data=event.data||event,metadata=data.metadata||data.paymentSession?.metadata||data.payment_session?.metadata||{},userId=metadata.user_id,plan=metadata.plan,type=String(event.type||data.type||'').toLowerCase();
  if(env.DB&&userId&&plan&&Object.hasOwn(PLANS,plan)){
    let status='pending';if(/capture.*succeed|captured|payment.*captured/.test(type))status='active';if(/fail|void|refund|cancel/.test(type))status='inactive';
    await env.DB.prepare(`INSERT INTO subscriptions(user_id,plan,status,provider,external_session_id,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,provider=excluded.provider,external_session_id=COALESCE(excluded.external_session_id,subscriptions.external_session_id),updated_at=excluded.updated_at`).bind(userId,plan,status,'coinbase_payment_acceptance',data.paymentSessionId||data.payment_session_id||null,nowIso()).run();
    await audit(env,userId,'subscription.webhook',{type,status,plan});
  }
  return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json'}});
}
