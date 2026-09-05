import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePlatformFeeInr,platformFeePolicy,rampConfig,rampPreview } from '../lib/ramps.js';

test('default CryptoPilot ramp fee is 25 bps with INR min/cap',()=>{
  assert.equal(calculatePlatformFeeInr(100),1);
  assert.equal(calculatePlatformFeeInr(1000),2.5);
  assert.equal(calculatePlatformFeeInr(100000),25);
});

test('fee policy is bounded to at most one percent',()=>{
  const p=platformFeePolicy({RAMP_PLATFORM_FEE_BPS:'999'});
  assert.equal(p.bps,100);
});

test('fee collection is off until provider partner-fee support is explicitly confirmed',()=>{
  assert.equal(platformFeePolicy({}).collectionEnabled,false);
  assert.equal(platformFeePolicy({RAMP_PLATFORM_FEE_COLLECTION_ENABLED:'true'}).collectionEnabled,true);
});

test('public ramp config never exposes OnMeta API secret',()=>{
  const cfg=rampConfig({ONMETA_WIDGET_API_KEY:'client-id',ONMETA_API_SECRET:'super-secret'});
  assert.equal(cfg.providers.onmeta.widgetClientId,'client-id');
  assert.equal(JSON.stringify(cfg).includes('super-secret'),false);
});

test('preview is disclosure-only and not an executable provider quote',()=>{
  const q=rampPreview({}, {amountInr:1000,token:'USDC',chainId:'137'});
  assert.equal(q.cryptoPilotFeeTargetInr,2.5);
  assert.equal(q.executableQuote,false);
  assert.match(q.providerFees,/provider live quote/i);
});

test('preview rejects unsupported amounts, token and chain',()=>{
  assert.throws(()=>rampPreview({}, {amountInr:99,token:'USDC',chainId:'137'}));
  assert.throws(()=>rampPreview({}, {amountInr:1000,token:'BTC',chainId:'137'}));
  assert.throws(()=>rampPreview({}, {amountInr:1000,token:'USDC',chainId:'1'}));
});
