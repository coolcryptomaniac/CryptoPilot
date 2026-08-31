function allowedWallets(env={}){return String(env.PILOT_ALLOWED_WALLETS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);}
export function pilotConfig(env={}){
  return {
    enabled:env.ENABLE_PILOT_TRADING==='true',
    maxOrderUsd:Math.max(1,Number(env.PILOT_MAX_ORDER_USD||25)),
    maxDailyNotionalUsd:Math.max(1,Number(env.PILOT_MAX_DAILY_NOTIONAL_USD||100)),
    maxDailyOrders:Math.max(1,Number(env.PILOT_MAX_DAILY_ORDERS||5)),
    allowlistedWalletCount:allowedWallets(env).length
  };
}

export function isPilotWalletAllowed(user,env){
  const wallet=String(user?.wallet_address||'').toLowerCase();
  return Boolean(wallet&&allowedWallets(env).includes(wallet));
}

export async function assertPilotOrder(env,user,order,db){
  const cfg=pilotConfig(env);
  if(!cfg.enabled)throw new Error('Founder pilot trading is disabled');
  if(!isPilotWalletAllowed(user,env))throw new Error('Wallet is not allowlisted for founder pilot trading');
  const type=String(order.type||order.order_type||'market').toLowerCase();
  if(!['market','limit'].includes(type))throw new Error('Pilot mode permits spot market/limit orders only');
  if(order.leverage||order.margin||order.futures||order.borrow||order.reduce_only)throw new Error('Leverage, margin, futures and borrowing are disabled in pilot mode');
  const notional=Number(order.notional_usd||order.quote_amount||order.quoteOrderQty||order.quote_size||0);
  if(!Number.isFinite(notional)||notional<=0)throw new Error('Pilot orders require a positive USD quote/notional amount');
  if(notional>cfg.maxOrderUsd)throw new Error(`Pilot order blocked: $${notional.toFixed(2)} exceeds $${cfg.maxOrderUsd.toFixed(2)} pilot cap`);
  if(db){
    const since=new Date(Date.now()-24*3600*1000).toISOString();
    const row=await db.prepare("SELECT COUNT(*) AS n,COALESCE(SUM(notional_usd),0) AS usd FROM orders WHERE user_id=? AND mode='pilot' AND created_at>=?").bind(user.id,since).first();
    if(Number(row?.n||0)>=cfg.maxDailyOrders)throw new Error('Pilot daily order-count limit reached');
    if(Number(row?.usd||0)+notional>cfg.maxDailyNotionalUsd)throw new Error(`Pilot rolling-day notional would exceed $${cfg.maxDailyNotionalUsd.toFixed(2)}`);
  }
  return {notional,...cfg};
}
