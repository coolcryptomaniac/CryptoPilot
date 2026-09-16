/* Loads independently of the wallet bundle so a broken module never leaves a dead button. */
(() => {
  const button = document.getElementById('connectBtn');
  const status = document.getElementById('walletStatus');
  if (!button || !status) return;
  let attempt = 0;
  const show = (message, kind = 'warn') => { status.className = `status ${kind}`; status.textContent = message; };
  button.addEventListener('click', () => {
    const current = ++attempt;
    show('Opening wallet connection…');
    setTimeout(() => {
      if (current !== attempt || window.__cryptoPilotWalletModalOpened) return;
      if (!window.__cryptoPilotWalletReady) {
        show('Wallet connection failed to initialize. Try refreshing. If this persists, send us this message; do not approve any transactions.', 'bad');
      } else {
        show('Wallet dialog did not open. Check that this site is allowed in your wallet browser, then retry. No transaction was initiated.', 'bad');
      }
    }, 5000);
  }, { capture: true });
  window.addEventListener('error', event => {
    if (!window.__cryptoPilotWalletReady) show(`Wallet setup error: ${event.message || 'JavaScript failed to load'}. Please refresh and report this error.`, 'bad');
  });
  window.addEventListener('unhandledrejection', event => {
    if (!window.__cryptoPilotWalletReady) show(`Wallet setup failed: ${event.reason?.message || 'Initialization rejected'}. Please refresh and report this error.`, 'bad');
  });
})();
