import test from 'node:test';
import assert from 'node:assert/strict';
import { authChallengeMessage } from '../lib/auth.js';
import { backtestSmaCross } from '../lib/market.js';
import { riskLimits,riskProfile } from '../lib/risk.js';
import { safeEqualHex } from '../lib/util.js';

test('risk score stays inside constitution bounds',()=>{
  assert.equal(riskProfile({style:'Conservative',networth:10000,drawdown:5,singleCap:5,lessRiskClicks:10}),15);
  assert.equal(riskProfile({style:'Aggressive',networth:1000000,drawdown:40,singleCap:50}),82);
});
test('risk limits respect operator hard cap',()=>{
  const limits=riskLimits({learned_risk:82,investable_networth:1000000,single_asset_cap_pct:25,paused:0},{MAX_LIVE_ORDER_USD:'300',MAX_DAILY_LIVE_ORDERS:'7'});
  assert.equal(limits.maxOrderUsd,300);assert.equal(limits.maxDailyOrders,7);assert.equal(limits.singleAssetCapPct,25);
});
test('wallet challenge cannot be confused with trade authorization',()=>{
  const message=authChallengeMessage('0x0000000000000000000000000000000000000001','nonce','start','end');assert.match(message,/does not authorize a trade or token transfer/i);
});
test('hex comparison rejects mismatches',()=>{assert.equal(safeEqualHex('aabb','aabb'),true);assert.equal(safeEqualHex('aabb','aabc'),false);assert.equal(safeEqualHex('aa','aaaa'),false)});
test('SMA baseline produces finite deterministic metrics',()=>{
  const candles=Array.from({length:80},(_,i)=>({time:i,close:100+Math.sin(i/4)*8+i*.15})),result=backtestSmaCross(candles,{fast:5,slow:12,capital:10000,feeBps:20});
  assert.equal(result.strategy,'sma-cross');assert.equal(result.candles,80);assert.ok(Number.isFinite(result.finalValue));assert.ok(result.maxDrawdownPct>=0);
});
