import { requireDb } from './util.js';
import { getRiskProfile,riskLimits } from './risk.js';
import { listConnections } from './vault.js';
export const INSTITUTIONAL_CONTROLS=[
  {id:'non-custodial',label:'Non-custodial architecture',status:'implemented'},
  {id:'encrypted-credentials',label:'AES-GCM encrypted exchange credentials',status:'implemented'},
  {id:'wallet-auth',label:'Wallet-signature authentication',status:'implemented'},
  {id:'audit-log',label:'Immutable-style application audit trail',status:'implemented'},
  {id:'risk-gates',label:'Deterministic order caps and circuit breakers',status:'implemented'},
  {id:'kill-switch',label:'User and operator emergency stop',status:'implemented'},
  {id:'idempotency',label:'Duplicate-order/idempotency protection',status:'implemented'},
  {id:'user-signed-dex',label:'User-signed DEX transactions',status:'implemented'},
  {id:'segregated-custody',label:'Institutional segregated/MPC custody connector',status:'planned'},
  {id:'dual-approval',label:'Dual-control trade approvals',status:'planned'},
  {id:'soc2',label:'SOC 2 / independent controls report',status:'external-required'},
  {id:'contract-audit',label:'Independent smart-contract audit',status:'external-required'}
];
export async function institutionalReport(env,userId){const db=requireDb(env),profile=await getRiskProfile(env,userId),connections=await listConnections(env,userId),limits=riskLimits(profile,env),since=new Date(Date.now()-24*3600*1000).toISOString();const orderStats=await db.prepare("SELECT COUNT(*) n,COALESCE(SUM(notional_usd),0) notional FROM orders WHERE user_id=? AND created_at>=?").bind(userId,since).first(),auditStats=await db.prepare('SELECT COUNT(*) n FROM audit_events WHERE user_id=?').bind(userId).first(),subscription=await db.prepare('SELECT plan,status,current_period_end FROM subscriptions WHERE user_id=?').bind(userId).first();return {generatedAt:new Date().toISOString(),risk:{profile,limits},connections:connections.map(c=>({exchange:c.exchange,mode:c.mode,liveEnabled:Boolean(c.live_enabled),status:c.status,permissions:c.permissions})),activity24h:{orders:Number(orderStats?.n||0),notionalUsd:Number(orderStats?.notional||0)},auditEvents:Number(auditStats?.n||0),subscription:subscription||{plan:'Free',status:'active'},controls:INSTITUTIONAL_CONTROLS};}
export async function auditExport(env,userId,limit=250){const max=Math.max(1,Math.min(1000,Number(limit)||250)),rows=await requireDb(env).prepare('SELECT event_type,severity,metadata_json,created_at FROM audit_events WHERE user_id=? ORDER BY created_at DESC LIMIT ?').bind(userId,max).all();return {generatedAt:new Date().toISOString(),events:(rows.results||[]).map(r=>({...r,metadata:JSON.parse(r.metadata_json||'{}'),metadata_json:undefined}))};}
