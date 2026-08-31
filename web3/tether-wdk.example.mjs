// CryptoPilot x Tether WDK integration seam.
// Install in a dedicated client/local wallet package, not in the public GitHub Pages bundle:
// npm i @tetherto/wdk @tetherto/wdk-wallet-evm @tetherto/wdk-protocol-bridge-usdt0-evm
//
// IMPORTANT: keep the seed phrase on the user's device/local secure runtime. Never POST it to CryptoPilot Worker.

import WDK from '@tetherto/wdk';
import { WalletAccountEvm } from '@tetherto/wdk-wallet-evm';
import Usdt0ProtocolEvm from '@tetherto/wdk-protocol-bridge-usdt0-evm';

export function createLocalWdk(seedPhrase){
  if(!seedPhrase)throw new Error('A locally-held seed phrase is required');
  return new WDK(seedPhrase);
}

export function createUsdt0BridgeAccount(seedPhrase,{provider,path="0'/0/0",bridgeMaxFee=1000000000000000n}={}){
  if(!provider)throw new Error('An EVM RPC provider is required');
  const account=new WalletAccountEvm(seedPhrase,path,{provider});
  const bridge=new Usdt0ProtocolEvm(account,{bridgeMaxFee});
  return {account,bridge};
}

// CryptoPilot policy pattern:
// 1. Ask the Worker for a payment/trade intent with hard limits.
// 2. Simulate/inspect locally.
// 3. Require the user's wallet/WDK signer to approve the exact transaction.
// 4. Send.
// 5. Let the Worker independently verify the resulting chain receipt.
//
// Do not expose a generic "sign anything the LLM asks" tool.
export function policyEnvelope({kind,asset,usdValue,target,chainId}){
  return {kind,asset,usdValue:Number(usdValue),target,chainId,createdAt:new Date().toISOString(),requiresHumanOrScopedPolicyApproval:true};
}
