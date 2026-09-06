(()=>{
  const $=s=>document.querySelector(s);
  const loadCheckout=()=>import('./checkout/cryptopilot-checkout.js');
  const getState=()=>{try{return JSON.parse(localStorage.getItem('cryptopilot')||'{}')}catch{return {}}};
  const tabs=$('#tabs');if(!tabs)return;
  const tab=document.createElement('button');tab.className='btn tab';tab.dataset.tab='ramp';tab.textContent='Buy / Sell';
  const plans=[...tabs.children].find(x=>x.dataset?.tab==='plans');tabs.insertBefore(tab,plans||null);
  const panel=document.createElement('section');panel.className='panel';panel.id='ramp';panel.innerHTML='<div id="cpCheckoutMount"></div>';document.querySelector('main')?.appendChild(panel);
  let checkout=null;
  async function mount(){
    await loadCheckout();
    if(!checkout){checkout=document.createElement('cryptopilot-checkout');checkout.setAttribute('brand','CryptoPilot');checkout.setAttribute('theme','dark');checkout.setAttribute('source','cryptopilot-app');checkout.addEventListener('cp-checkout:complete',e=>console.info('CryptoPilot checkout complete',e.detail));$('#cpCheckoutMount').appendChild(checkout)}
    const state=getState();if(state.apiBase)checkout.setAttribute('api-base',state.apiBase);
    return checkout;
  }
  tab.onclick=async()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));tab.classList.add('active');panel.classList.add('active');await mount()};
})();
