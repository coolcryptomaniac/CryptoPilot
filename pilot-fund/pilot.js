const BASE_CHAIN_ID = '0x2105'; // 8453
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const ERC20_BALANCE_OF = '0x70a08231';

const $ = (s) => document.querySelector(s);
const connectBtn = $('#connectBtn');
const switchBtn = $('#switchBtn');
const refreshBtn = $('#refreshBtn');
const tradeBtn = $('#tradeBtn');
const walletStatus = $('#walletStatus');
const tradeStatus = $('#tradeStatus');
const usdcBalance = $('#usdcBalance');
const riskCheck = $('#riskCheck');
const custodyCheck = $('#custodyCheck');
let provider = null;
let account = null;
let selectedAmount = 1;
let balance = 0;
let chainId = null;

function shortAddress(a){return a ? `${a.slice(0,6)}…${a.slice(-4)}` : ''}
function padAddress(a){return a.toLowerCase().replace(/^0x/,'').padStart(64,'0')}
function setWalletStatus(text, kind=''){walletStatus.className=`status ${kind}`.trim();walletStatus.textContent=text}
function setTradeStatus(text, kind='warn'){tradeStatus.className=`status ${kind}`.trim();tradeStatus.textContent=text}
function getProvider(){return window.ethereum || null}

async function connect(){
  provider = getProvider();
  if(!provider){
    setWalletStatus('No injected EVM wallet found. Open this page inside Coinbase Wallet or MetaMask, or install a compatible wallet.', 'bad');
    return;
  }
  try{
    const accounts = await provider.request({method:'eth_requestAccounts'});
    account = accounts?.[0] || null;
    chainId = await provider.request({method:'eth_chainId'});
    if(!account) throw new Error('No account returned');
    switchBtn.disabled = false;
    refreshBtn.disabled = false;
    setWalletStatus(`${shortAddress(account)} connected${chainId===BASE_CHAIN_ID?' on Base':' on another network'}.`, chainId===BASE_CHAIN_ID?'good':'warn');
    await refreshBalance();
    updateTradeState();
  }catch(err){
    setWalletStatus(err?.message || 'Wallet connection was cancelled.', 'bad');
  }
}

async function switchToBase(){
  if(!provider) return connect();
  try{
    await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:BASE_CHAIN_ID}]});
  }catch(err){
    if(err?.code===4902){
      await provider.request({method:'wallet_addEthereumChain',params:[{
        chainId:BASE_CHAIN_ID,
        chainName:'Base',
        nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},
        rpcUrls:['https://mainnet.base.org'],
        blockExplorerUrls:['https://basescan.org']
      }]});
    }else{
      setWalletStatus(err?.message || 'Could not switch network.', 'bad');
      return;
    }
  }
  chainId = await provider.request({method:'eth_chainId'});
  await refreshBalance();
  setWalletStatus(`${shortAddress(account)} connected on Base.`, 'good');
  updateTradeState();
}

async function refreshBalance(){
  if(!provider || !account){usdcBalance.textContent='—';return}
  try{
    chainId = await provider.request({method:'eth_chainId'});
    if(chainId!==BASE_CHAIN_ID){
      balance = 0;
      usdcBalance.textContent='Switch to Base';
      updateTradeState();
      return;
    }
    const data = ERC20_BALANCE_OF + padAddress(account);
    const raw = await provider.request({method:'eth_call',params:[{to:BASE_USDC,data},'latest']});
    balance = Number(BigInt(raw)) / 1_000_000;
    usdcBalance.textContent = balance.toLocaleString(undefined,{maximumFractionDigits:6});
    updateTradeState();
  }catch(err){
    balance = 0;
    usdcBalance.textContent='Unavailable';
    setTradeStatus('Could not read Base USDC balance from the connected wallet.', 'bad');
  }
}

function updateTradeState(){
  const onBase = chainId===BASE_CHAIN_ID;
  const accepted = riskCheck.checked && custodyCheck.checked;
  const enough = balance >= selectedAmount;
  tradeBtn.textContent = `Review $${selectedAmount} live swap`;
  tradeBtn.disabled = !(account && onBase && accepted && enough);
  if(!account) return setTradeStatus('Connect a wallet to start.', 'warn');
  if(!onBase) return setTradeStatus('Switch your wallet to Base.', 'warn');
  if(!enough) return setTradeStatus(`You need at least ${selectedAmount} USDC on Base for this test.`, 'warn');
  if(!accepted) return setTradeStatus('Accept both disclosures before continuing.', 'warn');
  setTradeStatus('Ready. The next step opens Uniswap; you still review and sign there.', 'good');
}

function openTrade(){
  if(tradeBtn.disabled) return;
  const amount = encodeURIComponent(String(selectedAmount));
  const input = encodeURIComponent(BASE_USDC);
  const url = `https://app.uniswap.org/swap?chain=base&inputCurrency=${input}&outputCurrency=ETH&value=${amount}`;
  window.open(url,'_blank','noopener,noreferrer');
}

document.querySelectorAll('[data-amount]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    selectedAmount = Number(btn.dataset.amount);
    document.querySelectorAll('[data-amount]').forEach(x=>x.classList.toggle('active',x===btn));
    updateTradeState();
  });
});

connectBtn.addEventListener('click',connect);
switchBtn.addEventListener('click',switchToBase);
refreshBtn.addEventListener('click',refreshBalance);
riskCheck.addEventListener('change',updateTradeState);
custodyCheck.addEventListener('change',updateTradeState);
tradeBtn.addEventListener('click',openTrade);

if(window.ethereum){
  window.ethereum.on?.('accountsChanged', async accounts=>{account=accounts?.[0]||null; await connect();});
  window.ethereum.on?.('chainChanged', async id=>{chainId=id; await refreshBalance(); if(account)setWalletStatus(`${shortAddress(account)} connected${id===BASE_CHAIN_ID?' on Base':' on another network'}.`, id===BASE_CHAIN_ID?'good':'warn');});
}
