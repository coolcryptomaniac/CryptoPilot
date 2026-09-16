import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { base } from '@reown/appkit/networks';

const projectId = '28f3b36f06bcb96419282baf75e7e388';
const appKit = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [base],
  defaultNetwork: base,
  projectId,
  metadata: {
    name: 'CryptoPilot',
    description: 'Self-custody Base USDC pilot',
    url: 'https://coolcryptomaniac.github.io',
    icons: []
  },
  features: { email: true, socials: ['google'], emailShowWallets: true, swaps: false, onramp: false },
  allWallets: 'SHOW'
});

window.__cryptoPilotWalletReady = true;
appKit.subscribeState(state => { window.__cryptoPilotWalletModalOpened = Boolean(state?.open); });
export function getConnectedProvider() {
  return appKit.getWalletProvider?.() || null;
}
export async function openWalletConnection() {
  window.__cryptoPilotWalletModalOpened = false;
  await appKit.open({ view: 'Connect' });
}
export function subscribeWalletProvider(callback) {
  return appKit.subscribeProviders(state => callback(state?.eip155 || null));
}
export function subscribeWalletAccount(callback) {
  return appKit.subscribeAccount(callback);
}
export { appKit };
