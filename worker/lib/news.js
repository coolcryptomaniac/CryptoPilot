const SOURCES=[
  {id:'coindesk',name:'CoinDesk',url:'https://www.coindesk.com/arc/outboundfeeds/rss/'},
  {id:'cointelegraph',name:'Cointelegraph',url:'https://cointelegraph.com/rss'},
  {id:'investing',name:'Investing.com',url:'https://www.investing.com/rss/news_301.rss'}
];
const dec=s=>String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const field=(block,name)=>{const m=block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'));return m?dec(m[1]):''};
export function parseRss(xml,source,limit=20){
  const items=[...String(xml||'').matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,limit).map(m=>m[1]);
  return items.map((b,i)=>{const link=field(b,'link')||field(b,'guid'),published=field(b,'pubDate')||field(b,'dc:date')||field(b,'date'),summary=(field(b,'description')||field(b,'content:encoded')).slice(0,320);return {id:`${source.id}-${i}-${b.length}`,source:source.name,sourceId:source.id,title:field(b,'title'),url:link,published,summary};}).filter(x=>x.title&&x.url);
}
async function fetchSource(source,limit){
  try{
    const r=await fetch(source.url,{headers:{accept:'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.5','user-agent':'CryptoPilot/2.1 news reader (+https://github.com/coolcryptomaniac/CryptoPilot)'}});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);const xml=await r.text(),items=parseRss(xml,source,limit);if(!items.length)throw new Error('No RSS items parsed');return {source:source.id,ok:true,items};
  }catch(e){return {source:source.id,ok:false,error:e.message,items:[]};}
}
export async function aggregateNews({source='all',q='',limit=30}={}){
  const max=Math.max(1,Math.min(60,Number(limit)||30)),selected=source==='all'?SOURCES:SOURCES.filter(s=>s.id===source);if(!selected.length)throw new Error('Unsupported news source');
  const results=await Promise.all(selected.map(s=>fetchSource(s,Math.max(10,Math.ceil(max/selected.length)+5)))),needle=String(q||'').trim().toLowerCase();
  let items=results.flatMap(r=>r.items);if(needle)items=items.filter(x=>(`${x.title} ${x.summary}`).toLowerCase().includes(needle));
  items.sort((a,b)=>(Date.parse(b.published)||0)-(Date.parse(a.published)||0));
  return {items:items.slice(0,max),sources:results.map(r=>({source:r.source,ok:r.ok,error:r.error||null,count:r.items.length})),fetchedAt:new Date().toISOString(),copyright:'Headlines, short excerpts and source links only. Full articles remain with the publishers.'};
}
export const NEWS_SOURCES=SOURCES.map(({id,name,url})=>({id,name,url}));
