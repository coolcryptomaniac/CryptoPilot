const numberEnv=(value,fallback)=>{const n=Number(value);return Number.isFinite(n)?n:fallback};
const boolEnv=(value,fallback=false)=>value==null?fallback:String(value).toLowerCase()==='true';
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
export const CHECKOUT_VERSION='1.0.0';

export function platformFeePolicy(env={}){
  const bps=clamp(Math.round(numberEnv(env.RAMP_PLATFORM_FEE_BPS,25)),0,100);
  const minInr=Math.max(0,numberEnv(env.RAMP_PLATFORM_FEE_MIN_INR,1));
  const maxInr=Math.max(minInr,numberEnv(env.RAMP_PLATFORM_FEE_MAX_INR,25));
  return {
    bps,
    percent:bps/100,
    minInr,
    maxInr,
    collectionEnabled:boolEnv(env.RAMP_PLATFORM_FEE_COLLECTION_ENABLED,false),
    collectionMode:'provider-partner-fee-only'
  };
}

export function calculatePlatformFeeInr(amount,env={}){
  const value=Number(amount);
  if(!Number.isFinite(value)||value<=0)throw new Error('Positive INR amount required');
  const policy=platformFeePolicy(env);
  return Number(clamp(value*policy.bps/10000,policy.minInr,policy.maxInr).toFixed(2));
}

export function rampConfig(env={}){
  const onmetaEnvironment=env.ONMETA_ENV==='production'?'production':'staging';
  const onmetaEnabled=boolEnv(env.RAMP_ONMETA_ENABLED,true);
  const widgetClientId=String(env.ONMETA_WIDGET_API_KEY||'').trim();
  return {
    checkout:{
      version:CHECKOUT_VERSION,
      integrations:['web-component','hosted-page','iframe-postmessage'],
      hostedPath:'/checkout/',
      completionSignal:'provider-event; verify server-side webhook before valuable fulfillment'
    },
    enabled:boolEnv(env.RAMP_ENABLED,true),
    mode:'non-custodial-provider-ramp',
    fiat:'INR',
    defaultPaymentMethod:'INR_UPI',
    supportedTokens:['USDC','USDT'],
    supportedChains:[
      {name:'Polygon',chainId:'137'},
      {name:'Base',chainId:'8453'},
      {name:'BNB Smart Chain',chainId:'56'}
    ],
    feePolicy:platformFeePolicy(env),
    providers:{
      onmeta:{
        enabled:onmetaEnabled,
        configured:onmetaEnabled&&Boolean(widgetClientId),
        environment:onmetaEnvironment,
        widgetClientId:onmetaEnabled&&widgetClientId?widgetClientId:null,
        sdkUrl:onmetaEnvironment==='production'?'https://platform.onmeta.in/onmeta-sdk.js':'https://stg.platform.onmeta.in/onmeta-sdk.js',
        onRamp:true,
        offRamp:false,
        offRampApiCredentialsPresent:Boolean(String(env.ONMETA_API_SECRET||'').trim()&&widgetClientId),
        offRampAdapterEnabled:false,
        offRampNote:'OnMeta off-ramp is API-only and pays INR to a verified bank account; the browser widget does not provide sell.'
      },
      onrampMoney:{
        enabled:boolEnv(env.RAMP_ONRAMP_MONEY_ENABLED,false),
        configured:Boolean(String(env.ONRAMP_MONEY_APP_ID||'').trim()),
        appId:String(env.ONRAMP_MONEY_APP_ID||'').trim()||null,
        onRamp:true,
        offRamp:true,
        integrationState:'adapter-ready; enable only after partner onboarding and provider validation'
      }
    },
    disclosures:[
      'CryptoPilot never receives or holds the user’s INR or crypto in this ramp flow.',
      'Provider conversion, payment, spread, network and tax/TDS charges are separate and must be shown by the regulated ramp before confirmation.',
      'The CryptoPilot platform fee may be collected only through a provider-supported partner/client-fee mechanism; it must never be hidden in an exchange rate.',
      'Crypto-to-INR payout must go to the verified destination supported by the provider; do not advertise arbitrary UPI-ID payouts unless the provider explicitly enables them.'
    ]
  };
}

export function rampPreview(env={},body={}){
  const amount=Number(body.amountInr);
  if(!Number.isFinite(amount)||amount<100||amount>200000)throw new Error('INR amount must be between 100 and 200000');
  const token=String(body.token||'USDC').toUpperCase();
  if(!['USDC','USDT'].includes(token))throw new Error('Unsupported ramp token');
  const chainId=String(body.chainId||'137');
  if(!['137','8453','56'].includes(chainId))throw new Error('Unsupported ramp chain');
  const cfg=rampConfig(env),feeTargetInr=calculatePlatformFeeInr(amount,env);
  return {
    checkoutVersion:CHECKOUT_VERSION,
    amountInr:amount,
    token,
    chainId,
    paymentMethod:'INR_UPI',
    source:String(body.source||'').slice(0,80)||null,
    cryptoPilotFeeTargetInr:feeTargetInr,
    cryptoPilotFeeCollectionEnabled:cfg.feePolicy.collectionEnabled,
    providerFees:'shown in provider live quote',
    executableQuote:false,
    note:'This is a CryptoPilot fee preview, not an executable crypto price quote. The regulated provider supplies the final rate and all provider fees before payment.'
  };
}
