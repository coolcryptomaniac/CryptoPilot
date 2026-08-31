import { audit,nowIso,requireDb,sha256Hex,uuid } from './util.js';
import { encryptJson } from './vault.js';

const METHODS=new Set(['Crypto','Bank transfer','Credit card','Cash / other regulated settlement','Other']);
const text=(v,max=120)=>String(v??'').trim().slice(0,max);
const validEmail=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export function sanitizeInvestorInterest(body={}){
  const p={
    name:text(body.name,120),amountUsd:Number(body.amountUsd),email:text(body.email,254).toLowerCase(),phone:text(body.phone,60),
    country:text(body.country,80),city:text(body.city,80),method:text(body.method,60),methodDetail:text(body.methodDetail,120),
    riskAcknowledged:body.riskAcknowledged===true,nonBindingAcknowledged:body.nonBindingAcknowledged===true,
    ndaRequested:body.ndaRequested===true,contactConsent:body.contactConsent===true
  };
  if(!p.name||!p.email||!p.phone||!p.country||!p.city)throw new Error('Name, email, phone, country and city are required');
  if(!validEmail(p.email))throw new Error('A valid email address is required');
  if(!Number.isFinite(p.amountUsd)||p.amountUsd<1_000_000||p.amountUsd>100_000_000_000)throw new Error('Indicative amount must be from $1M to $100B');
  if(!METHODS.has(p.method))throw new Error('Unsupported preferred transfer method');
  if(!p.riskAcknowledged||!p.nonBindingAcknowledged||!p.ndaRequested||!p.contactConsent)throw new Error('All disclosure, non-binding, NDA and contact-consent acknowledgements are required');
  return p;
}

async function notifyFounder(env,p,id){
  if(!env.RESEND_API_KEY||!env.INVESTOR_NOTIFY_FROM)return {notified:false,reason:'email notification not configured'};
  const to=env.INVESTOR_NOTIFY_TO||'founder@roamwise.co.in';
  const lines=[
    'CryptoPilot non-binding expression of interest',`Reference: ${id}`,`Name/Firm: ${p.name}`,`Indicative amount: $${p.amountUsd.toLocaleString('en-US')}`,
    `Email: ${p.email}`,`Phone: ${p.phone}`,`Country / city: ${p.country} / ${p.city}`,`Preferred settlement: ${p.method}${p.methodDetail?` — ${p.methodDetail}`:''}`,
    '', 'Acknowledgements recorded: possible total loss; non-binding EOI; NDA/full-disclosure requested; explicit consent to share these details with founder@roamwise.co.in.',
    '', 'No funds were accepted by this form. Do not treat this EOI as committed/funded capital.'
  ];
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json','Idempotency-Key':`cryptopilot-eoi-${id}`},body:JSON.stringify({from:env.INVESTOR_NOTIFY_FROM,to:[to],subject:`CryptoPilot non-binding EOI — $${p.amountUsd.toLocaleString('en-US')}`,text:lines.join('\n'),reply_to:p.email})});
  if(!r.ok){const detail=await r.text();throw new Error(`Founder email notification failed (${r.status}): ${detail.slice(0,300)}`)}
  return {notified:true};
}

export async function createInvestorInterest(env,body={}){
  const p=sanitizeInvestorInterest(body),db=requireDb(env),id=uuid(),created=nowIso(),emailHash=await sha256Hex(p.email);
  const recent=new Date(Date.now()-10*60*1000).toISOString(),dupe=await db.prepare('SELECT id FROM investor_interest WHERE email_hash=? AND created_at>=? LIMIT 1').bind(emailHash,recent).first();
  if(dupe)throw new Error('A recent expression of interest from this email is already recorded');
  const encrypted=await encryptJson(env,p);
  await db.prepare("INSERT INTO investor_interest(id,amount_usd,country,email_hash,encrypted_payload,status,source,created_at) VALUES(?,?,?,?,?,'non_binding','cryptopilot',?)").bind(id,p.amountUsd,p.country,emailHash,encrypted,created).run();
  let notified=false,notificationError=null;
  try{const n=await notifyFounder(env,p,id);notified=n.notified;if(notified)await db.prepare('UPDATE investor_interest SET notified_at=? WHERE id=?').bind(nowIso(),id).run();}
  catch(e){notificationError=e.message;}
  await audit(env,null,'investor.eoi',{id,amountUsd:p.amountUsd,country:p.country,notified,notificationError},'info');
  return {id,status:'non_binding',notified,notificationError:notificationError?'Founder notification is pending; the EOI is stored.':null,disclaimer:'This is a non-binding expression of interest. No funds were accepted or committed.'};
}

export async function investorSummary(env){
  const row=await requireDb(env).prepare("SELECT COUNT(*) expressions,COALESCE(SUM(amount_usd),0) total_usd,COUNT(DISTINCT country) countries FROM investor_interest WHERE status='non_binding'").first();
  return {expressions:Number(row?.expressions||0),totalIndicativeUsd:Number(row?.total_usd||0),countries:Number(row?.countries||0),disclaimer:'Aggregate non-binding expressions of interest only; not funded, verified or committed capital.'};
}

export async function hyperliquidMids(){
  const r=await fetch('https://api.hyperliquid.xyz/info',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'allMids'})}),j=await r.json();
  if(!r.ok||!j||typeof j!=='object')throw new Error(`Hyperliquid public data request failed (${r.status})`);
  return {provider:'Hyperliquid',mode:'public-market-data-only',mids:j,note:'Trading is not exposed through this endpoint. Hyperliquid applies venue-side order constraints including minimum order value.'};
}
