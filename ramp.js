(()=>{
  const $=s=>document.querySelector(s);
  const getState=()=>{try{return JSON.parse(localStorage.getItem('cryptopilot')||'{}')}catch{return {}}};
  const apiBase=()=>String(getState().apiBase||'').replace(/\/$/,'');
  let cfg=null;

  const style=document.createElement('style');
  style.textContent=`
    .ramp-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:18px}
    .ramp-fee{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
    .ramp-note{font-size:12px;line-height:1.5}
    .ramp-status{padding:10px 12px;border-radius:13px;border:1px solid var(--line);margin-top:12px}
    #onmeta-widget{margin-top:14px;min-height:0}
    @media(max-width:900px){.ramp-grid{grid-template-columns:1fr}.ramp-fee{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const tab=document.createElement('button');
  tab.className='btn tab';tab.dataset.tab='ramp';tab.textContent='Buy / Sell';
  const tabs=$('#tabs');
  if(tabs){const plans=[...tabs.children].find(x=>x.dataset?.tab==='plans');tabs.insertBefore(tab,plans||null)}

  const panel=document.createElement('section');
  panel.className='panel';panel.id='ramp';
  panel.innerHTML=`
    <div class="ramp-grid">
      <div class="card">
        <div class="eyebrow">Regulated INR ramp</div>
        <h2>UPI → USDC / USDT</h2>
        <p class="muted">CryptoPilot routes the payment to the regulated provider. CryptoPilot does not custody your INR, crypto or private keys.</p>
        <label class="label">INR amount</label>
        <input class="input" id="rampAmount" type="number" min="100" max="200000" step="100" value="1000">
        <div class="row">
          <div style="flex:1;min-width:150px"><label class="label">Receive</label><select id="rampToken"><option>USDC</option><option>USDT</option></select></div>
          <div style="flex:1;min-width:180px"><label class="label">Network</label><select id="rampChain"><option value="137">Polygon</option><option value="8453">Base</option><option value="56">BNB Smart Chain</option></select></div>
        </div>
        <label class="label">Your receiving wallet</label>
        <input class="input" id="rampWallet" autocomplete="off" spellcheck="false" placeholder="0x…">
        <div class="ramp-fee">
          <div class="mini"><span class="muted">CryptoPilot fee target</span><b id="rampCpFee">₹2.50</b></div>
          <div class="mini"><span class="muted">Provider fees</span><b>Live quote</b></div>
          <div class="mini"><span class="muted">Custody</span><b>Provider</b></div>
        </div>
        <div class="ramp-status muted" id="rampStatus">Connect the Worker in the Connect tab to load regulated ramp configuration.</div>
        <div class="row" style="margin-top:14px"><button class="btn primary" id="rampBuy">Continue with UPI</button><button class="btn" id="rampSell">Sell crypto → INR</button></div>
        <div id="onmeta-widget"></div>
      </div>
      <div class="card">
        <div class="eyebrow">Fee & compliance guardrails</div>
        <h2>Small fee, fully disclosed</h2>
        <div class="signal"><strong>Default CryptoPilot fee</strong><span class="muted">0.25% · minimum ₹1 · maximum ₹25. Collection stays disabled until the ramp provider contract explicitly supports a partner/client fee.</span></div>
        <div class="signal"><strong>Provider charges stay separate</strong><span class="muted">Conversion spread, payment fee, network/gas fee and applicable tax/TDS must come from the provider's live quote before confirmation.</span></div>
        <div class="signal"><strong>KYC stays with the regulated ramp</strong><span class="muted">For India, the provider performs the required identity, AML and payment-account checks. CryptoPilot must not bypass them.</span></div>
        <div class="signal"><strong>Sell flow</strong><span class="muted">Crypto → INR off-ramp is backend/API-only and pays the provider-verified bank destination. Do not promise arbitrary UPI-ID cash-outs unless the provider explicitly enables them.</span></div>
        <p class="muted ramp-note">This is infrastructure, not a promise that conversion is free. The provider can still charge its own fees. CryptoPilot should select the cheapest executable regulated quote once multiple providers are enabled.</p>
      </div>
    </div>`;
  const main=document.querySelector('main');if(main)main.appendChild(panel);

  tab.onclick=()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
    tab.classList.add('active');panel.classList.add('active');loadConfig();
  };

  const feePreview=()=>{
    const amount=Number($('#rampAmount')?.value||0);
    const policy=cfg?.feePolicy||{bps:25,minInr:1,maxInr:25};
    const raw=amount*Number(policy.bps||0)/10000;
    const fee=Math.min(Number(policy.maxInr||25),Math.max(Number(policy.minInr||0),raw||0));
    if($('#rampCpFee'))$('#rampCpFee').textContent=`₹${fee.toFixed(2)}`;
  };
  $('#rampAmount')?.addEventListener('input',feePreview);

  async function loadConfig(){
    const base=apiBase();
    if(!base){$('#rampStatus').textContent='Worker not configured. Open Connect → API backend URL, save the deployed Worker, then return here.';feePreview();return}
    try{
      const r=await fetch(`${base}/api/ramp/config`);const j=await r.json();if(!r.ok)throw new Error(j.error||'Ramp config unavailable');cfg=j;feePreview();
      const onmeta=j.providers?.onmeta;
      $('#rampStatus').innerHTML=onmeta?.configured
        ? `<span class="green">OnMeta ${onmeta.environment} ready</span> · UPI on-ramp enabled · provider KYC applies.`
        : `Ramp UI ready, but OnMeta credentials are not configured in the Worker yet. Use staging credentials first; production requires merchant KYB.`;
    }catch(e){$('#rampStatus').textContent=`Ramp backend unavailable: ${e.message}`}
  }

  function loadScript(src){return new Promise((resolve,reject)=>{
    const old=[...document.scripts].find(s=>s.src===src);if(old){if(window.onMetaWidget)return resolve();old.addEventListener('load',resolve,{once:true});old.addEventListener('error',reject,{once:true});return}
    const s=document.createElement('script');s.src=src;s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load regulated-ramp SDK'));document.head.appendChild(s);
  })}

  async function launchOnmeta(){
    const amount=Number($('#rampAmount').value),wallet=$('#rampWallet').value.trim(),token=$('#rampToken').value,chainId=$('#rampChain').value;
    if(amount<100||amount>200000)return alert('Enter an INR amount between ₹100 and ₹2,00,000.');
    if(!/^0x[a-fA-F0-9]{40}$/.test(wallet))return alert('Enter a valid EVM receiving wallet address.');
    const base=apiBase();if(!base)return alert('Connect the CryptoPilot Worker first.');
    if(!cfg)await loadConfig();
    const p=cfg?.providers?.onmeta;if(!p?.configured)return alert('OnMeta is not configured yet. Add staging credentials to the Worker after merchant registration.');
    try{
      const previewRes=await fetch(`${base}/api/ramp/preview`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({amountInr:amount,token,chainId})});
      const preview=await previewRes.json();if(!previewRes.ok)throw new Error(preview.error||'Ramp preview failed');
      if(preview.cryptoPilotFeeCollectionEnabled!==true){$('#rampStatus').innerHTML='<span class="green">Provider checkout opening.</span> CryptoPilot fee is displayed as a target but is not collected until provider partner-fee support is contractually enabled.'}
      sessionStorage.setItem('cryptopilot-ramp-wallet',wallet);
      await loadScript(p.sdkUrl);
      if(typeof window.onMetaWidget!=='function')throw new Error('OnMeta widget SDK did not initialize');
      const host=$('#onmeta-widget');host.innerHTML='';
      const widget=new window.onMetaWidget({
        elementId:'onmeta-widget',apiKey:p.widgetClientId,environment:p.environment,fiatType:'inr',walletAddress:wallet,
        fiatAmount:amount,chainId,tokenSymbol:token,paymentMethod:'INR_UPI',onRamp:'enabled',offRamp:'disabled',
        metaData:{source:'cryptopilot',feePolicyBps:String(cfg.feePolicy?.bps||25)}
      });
      widget.init();
    }catch(e){$('#rampStatus').textContent=`Could not start ramp: ${e.message}`}
  }

  $('#rampBuy').onclick=launchOnmeta;
  $('#rampSell').onclick=()=>alert('Crypto → INR is intentionally not routed through the browser widget. OnMeta requires the server-side off-ramp API, KYC and a verified bank destination. The adapter is reserved for the production backend after KYB/IP whitelisting.');
  const saved=sessionStorage.getItem('cryptopilot-ramp-wallet');if(saved)$('#rampWallet').value=saved;
  feePreview();
})();
