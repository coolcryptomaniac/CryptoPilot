/**
 * Reown AppKit integration seam for CryptoPilot.
 * A real REOWN_PROJECT_ID is required before this can be bundled into the production frontend.
 * Any EIP-1193 provider returned by AppKit can use the same challenge -> personal_sign -> verify
 * flow implemented by production.js. Never request or persist a seed phrase/private key.
 *
 * Future bundled frontend packages:
 *   npm i @reown/appkit @reown/appkit-adapter-wagmi wagmi viem
 */
export function assertReownProjectId(projectId){
  if(!projectId||String(projectId).length<8)throw new Error('A Reown Project ID is required');
  return String(projectId);
}

export async function authenticateProvider(provider,apiBase){
  const [address]=await provider.request({method:'eth_requestAccounts'});
  const c=await fetch(`${apiBase}/api/auth/wallet/challenge`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address})}).then(r=>r.json());
  const signature=await provider.request({method:'personal_sign',params:[c.message,address]});
  return fetch(`${apiBase}/api/auth/wallet/verify`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address,message:c.message,signature})}).then(r=>r.json());
}
