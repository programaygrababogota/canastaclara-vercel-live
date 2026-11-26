const {load} = require('cheerio');
const {createHash} = require('node:crypto');
const SOURCES = Object.freeze({
 efsa: {region:'UE', authority:'EFSA (evaluación científica)', url:'https://www.efsa.europa.eu/en/topics/topic/food-additives'},
 eu: {region:'UE', authority:'Comisión Europea (marco legal)', url:'https://food.ec.europa.eu/food-safety/food-improvement-agents/additives/database_en'},
 co: {region:'Colombia', authority:'MinProtección / Normograma INVIMA (marco general)', url:'https://normograma.invima.gov.co/compilacion/docs/resolucion_minproteccion_2606_2009.htm'},
 news: {region:'UE',authority:'EFSA — Noticias',url:'https://www.efsa.europa.eu/en/press/rss'},
 publications: {region:'UE',authority:'EFSA — Publicaciones',url:'https://www.efsa.europa.eu/en/publications/rss'},
 alerts: {region:'Colombia',authority:'INVIMA — Alertas sanitarias',url:'https://www.invima.gov.co/alertas-sanitarias'},
});
function safeLink(value, base, extra = []) {
 try {
  const url = new URL(value,base);
  if (url.protocol !== 'https:' || url.username || url.password || ![new URL(base).hostname,...extra].includes(url.hostname)) return null;
  return url.href;
 } catch {return null;}
}
function plain(value,max=600) {const $=load(String(value||''));$('script,style').remove();return $.text().replace(/\s+/g,' ').trim().slice(0,max);}
async function retrieve(url) {
 const response=await fetch(url,{headers:{'User-Agent':'CanastaClara/1.4 (public food information; juan.gutierreztor@cun.edu.co)',Accept:'text/html, application/rss+xml, application/xml'},signal:AbortSignal.timeout(8000),redirect:'error'});
 if(!response.ok)throw new Error('upstream');
 let bytes=0,text='';const decoder=new TextDecoder();
 for await(const chunk of response.body){bytes+=chunk.byteLength;if(bytes>2000000)throw new Error('size');text+=decoder.decode(chunk,{stream:true});}
 return {text:text+decoder.decode(),lastModified:response.headers.get('last-modified')};
}
function parseFeed(xml, source) {
 if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Unsafe XML');
 const $=load(xml,{xmlMode:true});
 if (!$('rss,feed').length)throw new Error('Invalid feed');
 const items=[];
 $('item,entry').slice(0,40).each((_,el)=>{
  const node=$(el),title=plain(node.find('title').first().text(),300);
  const url=safeLink(node.find('link').first().attr('href')||node.find('link').first().text(),source.url,['efsa.onlinelibrary.wiley.com']);
  const dateText=node.find('pubDate,published,updated').first().text();
  const date=Number.isFinite(Date.parse(dateText))?new Date(dateText).toISOString():null;
  if(title&&url)items.push({title,url,publishedAt:date,summary:plain(node.find('description,summary').first().text()),region:source.region,authority:source.authority,type:'Publicación informativa; no es una norma ni alerta de este producto'});
 });
 if(!items.length)throw new Error('Empty feed');
 return items;
}
function parseAlerts(html,source) {
 const $=load(html);const items=[],seen=new Set();
 $('a[href]').each((_,el)=>{
  const a=$(el),url=safeLink(a.attr('href'),source.url);
  if(!url||!new URL(url).pathname.startsWith('/alertas-sanitarias/')||/\/pdf$/.test(url)||seen.has(url))return;
  const title=plain(a.text(),300);
  if(title.length<12)return;
  const card=a.closest('article,li,.views-row,.card');
  const context=plain(card.length?card.text():a.parent().text(),2500);
  const sector=plain(card.find('.inv-lst-direccion').text());
  // The portal mixes medicines/devices and food; never silently classify all as food.
  if(!/alimentos|bebidas/i.test(sector||context))return;
  const date=context.match(/\b(\d{2})-(\d{2})-(\d{4})\b/);
  const publishedAt=date?`${date[3]}-${date[2]}-${date[1]}T00:00:00.000Z`:null;
  seen.add(url);items.push({title,url,publishedAt,summary:'Referencia obtenida del listado oficial. Consulta producto, lote y alcance en la alerta original.',region:source.region,authority:source.authority,type:'Alerta de alimentos/bebidas; coincidencia no verificada con un producto concreto'});
 });
 return items.slice(0,20);
}
function foodFilter(html,source) {
 const $=load(html);let result=null;
 // Current INVIMA exposes sector navigation as anchors, not select controls.
 $('a[href]').each((_,el)=>{
  const url=safeLink($(el).attr('href'),source.url);
  if(!url || !/alimentos.*bebidas/i.test(plain($(el).text())))return;
  const parsed=new URL(url);
  if(parsed.pathname==='/alertas-sanitarias' && parsed.searchParams.get('direccion')==='da'){
   parsed.search='';parsed.searchParams.set('direccion','da');result=parsed.href;
  }
 });
 $('form').each((_,form)=>{
  if(result)return;
  const node=$(form);
  if((node.attr('method')||'GET').toUpperCase()!=='GET')return;
  const action=safeLink(node.attr('action')||source.url,source.url);
  if(!action || new URL(action).pathname!=='/alertas-sanitarias')return;
  node.find('select').each((_,select)=>{
   const name=$(select).attr('name');
   if(!name||!/^[a-zA-Z0-9_\[\]-]{1,64}$/.test(name))return;
   $(select).find('option').each((_,option)=>{
    const value=$(option).attr('value');
    if(value&&value.length<80&&/alimentos.*bebidas/i.test($(option).text())){
     const url=new URL(action);url.search='';url.searchParams.set(name,value);result=url.href;
    }
   });
  });
 });
 return result;
}
function parseDocument(html,source) {
 const $=load(html);$('script,style,nav,footer').remove();
 const title=plain($('h1').first().text()||$('title').text(),300);
 if(!title)throw new Error('Invalid document');
 const text=plain($('main').length?$('main').html():$('body').html(),150000);
 if(/access denied|security check|just a moment/i.test(title))throw new Error('Blocked document');
 const references=[];
 if(source===SOURCES.efsa) $('a[href]').each((_,el)=>{
  const ownLabel=plain($(el).text(),400);
  const context=plain($(el).closest('li').text(),400);
  const label=/\bE\s*\d{3,4}/i.test(ownLabel)?ownLabel:context||ownLabel,url=safeLink($(el).attr('href'),source.url,['efsa.onlinelibrary.wiley.com']);
  if(url&&/\bE\s*\d{3,4}/i.test(label))references.push({title:label,url});
 });
 return {title,excerpt:text.slice(0,1000),fingerprint:createHash('sha256').update(text).digest('hex').slice(0,16),references:references.slice(0,60),scope:'Marco o referencia general: no verifica autorización, dosis ni riesgo de un producto individual.'};
}
let cache=new Map();
async function collect(mode) {
 const old=cache.get(mode);if(old&&Date.now()-old.time<900000)return old.value;
 const keys=mode==='news'?['news','publications','alerts']:['efsa','eu','co'];
 const sources=await Promise.all(keys.map(async key=>{
  const source=SOURCES[key];
  try {
   let {text,lastModified}=await retrieve(source.url);
   let listingUrl=source.url;
   if(key==='alerts'){
    const filtered=foodFilter(text,source);
    if(filtered){const result=await retrieve(filtered);text=result.text;lastModified=result.lastModified;listingUrl=filtered;}
   }
   return {id:key,...source,status:'ok',listingUrl,checkedAt:new Date().toISOString(),lastModified,
    ...(mode==='news'?{items:key==='alerts'?parseAlerts(text,source):parseFeed(text,source)}:parseDocument(text,source))};
  } catch {return {id:key,...source,status:'unavailable',checkedAt:new Date().toISOString(),items:[],message:'No se pudo actualizar esta fuente. No equivale a ausencia de alertas o cambios.'};}
 }));
 const value={mode,fetchedAt:new Date().toISOString(),sources,coverage:mode==='news'?'EFSA: entradas presentes en RSS. INVIMA: solo alertas de alimentos/bebidas reconocibles en la primera página del filtro disponible o del listado general; no es histórico completo.':'Documentos oficiales de referencia, con procedencia y fecha de consulta.'};
 cache.set(mode,{time:Date.now(),value});return value;
}
module.exports={SOURCES,safeLink,parseFeed,parseAlerts,parseDocument,foodFilter,collect};
