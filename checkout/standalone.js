await customElements.whenDefined('cryptopilot-checkout');
const el=document.querySelector('cryptopilot-checkout');
const params=new URLSearchParams(location.search);
const allowed=['apiBase','brand','theme','accent','amountInr','token','chainId','walletAddress','source','mode','supportUrl'];
const initial={};
for(const key of allowed){const v=params.get(key);if(v!=null&&v!=='')initial[key]=key==='amountInr'?Number(v):v}
if(initial.apiBase)sessionStorage.setItem('cp-checkout-api-base',initial.apiBase);
else initial.apiBase=sessionStorage.getItem('cp-checkout-api-base')||'';
el.setOptions(initial);

const parentOrigin=(()=>{try{return document.referrer?new URL(document.referrer).origin:null}catch{return null}})();
function post(name,detail){if(window.parent===window)return;window.parent.postMessage({type:`cryptopilot-checkout:${name}`,detail},parentOrigin||'*')}
['ready','config','preview','review','opened','provider-event','order','action','complete','error','closed','sell-gated'].forEach(name=>el.addEventListener(`cp-checkout:${name}`,e=>post(name,e.detail)));
window.addEventListener('message',event=>{
  if(event.source!==window.parent)return;
  if(parentOrigin&&event.origin!==parentOrigin)return;
  const data=event.data||{};if(data.type!=='cryptopilot-checkout:init'||!data.options||typeof data.options!=='object')return;
  el.setOptions(data.options);if(data.options.open!==false)el.open();post('initialized',{ok:true});
});

if(params.get('embed')==='1')document.documentElement.dataset.embed='true';
