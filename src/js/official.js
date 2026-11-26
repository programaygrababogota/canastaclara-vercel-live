"use strict";
const OFFICIAL_LINKS={
 eu:'https://food.ec.europa.eu/food-safety/food-improvement-agents/additives/database_en',
 efsa:'https://www.efsa.europa.eu/en/topics/topic/food-additives',
 co:'https://normograma.invima.gov.co/compilacion/docs/resolucion_minproteccion_2606_2009.htm',
};
const SCIENCE_NAMES={e100:'curcumin',e102:'tartrazine',e104:'quinoline yellow',e110:'sunset yellow FCF',e120:'carmine',e122:'carmoisine',e124:'ponceau 4R',e129:'allura red',e133:'brilliant blue FCF',e150d:'ammonia caramel',e202:'potassium sorbate',e211:'sodium benzoate',e220:'sulfur dioxide',e250:'sodium nitrite',e251:'sodium nitrate',e300:'ascorbic acid',e320:'butylated hydroxyanisole',e321:'butylated hydroxytoluene',e322:'lecithin',e330:'citric acid',e338:'phosphoric acid',e407:'carrageenan',e412:'guar gum',e415:'xanthan gum',e420:'sorbitol',e421:'mannitol',e433:'polysorbate 80',e450:'diphosphates',e451:'triphosphates',e452:'polyphosphates',e471:'mono diglycerides fatty acids',e475:'polyglycerol esters fatty acids',e476:'polyglycerol polyricinoleate',e500:'sodium carbonates',e621:'monosodium glutamate',e627:'disodium guanylate',e631:'disodium inosinate',e635:'disodium ribonucleotides',e950:'acesulfame potassium',e951:'aspartame',e952:'cyclamate',e954:'saccharin',e955:'sucralose',e960:'steviol glycosides',e967:'xylitol',e1442:'hydroxypropyl distarch phosphate'};
function componentCode(key){return /^e\d{3,4}[a-z]{0,3}$/i.test(key||'')?key.toLowerCase():null;}
function studyLink(key, reviews=false){
 const code=componentCode(key);if(!code)return null;
 const base=code.replace(/[a-z]+$/,'');
 const name=SCIENCE_NAMES[code]||SCIENCE_NAMES[base]||code.toUpperCase();
 const query=`"${name}" AND (food OR dietary) AND (safety OR toxicity OR exposure)`+(reviews?' AND systematic[sb]':'');
 return 'https://pubmed.ncbi.nlm.nih.gov/?'+new URLSearchParams({term:query,sort:'date'}).toString();
}
function ingredientStudyLink(name){
 const term=String(name||'').replace(/["\\\x00-\x1f]/g,' ').trim().slice(0,120);
 return 'https://pubmed.ncbi.nlm.nih.gov/?'+new URLSearchParams({term:`"${term}" AND (food OR dietary) AND (safety OR toxicity OR exposure)`,sort:'date'}).toString();
}
function referenceLinks(key){
 return `<div class="ext-links"><a class="ext-link" href="${OFFICIAL_LINKS.eu}" target="_blank" rel="noopener noreferrer">UE · condiciones de uso ↗</a><a class="ext-link" href="${OFFICIAL_LINKS.co}" target="_blank" rel="noopener noreferrer">Colombia · marco general ↗</a>${studyLink(key)?`<a class="ext-link" href="${esc(studyLink(key))}" target="_blank" rel="noopener noreferrer">Buscar estudios actuales ↗</a><a class="ext-link" href="${esc(studyLink(key,true))}" target="_blank" rel="noopener noreferrer">Revisiones sistemáticas ↗</a>`:''}</div>`;
}
function jurisdictionDisclosure(){return '<p class="field-hint"><span class="badge src">UE + Colombia · marcos de referencia</span> Procedencia de los documentos, no una aprobación conjunta ni una clasificación oficial del riesgo. EFSA evalúa; Comisión Europea/Estados miembros autorizan. Colombia aplica su propio marco y condiciones.</p>';}
function componentEvidence(key){
 const code=componentCode(key);if(!code)return '';
 const base=code.replace(/[a-z]+$/,'');
 return `<div class="official-component"><h4>${esc(code.toUpperCase())} · ${esc(ADDITIVES[code]?.nombre||SCIENCE_NAMES[code]||SCIENCE_NAMES[base]||'Componente sin ficha específica')}</h4>${jurisdictionDisclosure()}${ADDITIVES[code]?.officialReference?`<p class="field-hint">Extracción específica · ${esc(ADDITIVES[code].officialReference.region)} · EFSA</p><blockquote class="official-extract">${esc(ADDITIVES[code].officialReference.title)}</blockquote>`:'<p class="field-hint">Referencia específica del componente: no verificada en ambas jurisdicciones.</p>'}<p class="muted">Presencia declarada por Open Food Facts; faltan concentración, exposición y condiciones de uso para evaluar seguridad o cumplimiento de este producto.</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Unión Europea</th><th>Colombia</th></tr></thead><tbody><tr><td>Evaluación científica: EFSA. Autorización y usos: Comisión Europea / Estados miembros; lista de la Unión y condiciones por alimento.</td><td>Marco general: Resolución 2606 de 2009. Deben comprobarse las condiciones y dosis aplicables en las normas específicas.</td></tr><tr><td>Estado de este producto: no evaluado por CanastaClara; consultar categoría y límites.</td><td>Estado de este producto: no evaluado por CanastaClara; coincidencias INVIMA por marca no acreditan este componente.</td></tr></tbody></table></div>${referenceLinks(code)}</div>`;
}
let officialRequests={};
function loadOfficial(mode){
 const cached=officialRequests[mode];
 if(!cached || Date.now()-cached.time>=900000){
  const promise=fetchJSON('/api/official?mode='+mode).catch(error=>{delete officialRequests[mode];throw error;});
  officialRequests[mode]={time:Date.now(),promise};
 }
 return officialRequests[mode].promise;
}
function integrateOfficialComponents(data){
 let added=0;
 for(const source of data.sources||[]){
  if(source.id!=='efsa'||source.status!=='ok')continue;
  for(const ref of source.references||[]){
   const match=ref.title.match(/^E\s*(\d{3,4}[a-z]?)\b[\s–—:-]*(.*)$/i);
   if(!match)continue;
   const key='e'+match[1].toLowerCase();
   if(!ADDITIVES[key]){ADDITIVES[key]={nombre:match[2]||key.toUpperCase(),funcion:'Referencia detectada en EFSA; función pendiente de revisión',riesgo:'desconocido',nota:'Referencia oficial recuperada dinámicamente; no se infiere riesgo ni autorización.',fuente:ref.url};added++;}
   ADDITIVES[key].officialReference={region:source.region,title:ref.title,url:ref.url,checkedAt:source.checkedAt};
  }
 }
 return added;
}
function timeLabel(value){if(!value)return 'Fecha no indicada';const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString('es-CO'):'Fecha no indicada';}
function officialUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&['www.efsa.europa.eu','efsa.onlinelibrary.wiley.com','food.ec.europa.eu','normograma.invima.gov.co','www.invima.gov.co'].includes(u.hostname)?u.href:null;}catch{return null;}}
async function renderOfficialDocuments(target, keys=[]){
 if(!target)return;
 try{
  const data=await loadOfficial('documents');integrateOfficialComponents(data);if(!target.isConnected)return;
  target.innerHTML=`<p class="field-hint">Consulta del servidor: ${esc(timeLabel(data.fetchedAt))}. Revalidación nominal cada 15 minutos (puede haber desfase de caché); no es fecha de entrada en vigor de una norma.</p>${data.sources.map(source=>`<div class="news-item"><h5>${esc(source.region)} · ${esc(source.authority)}</h5><p>${source.status==='ok'?esc(source.title):'Fuente temporalmente no disponible.'}</p>${source.excerpt?`<blockquote class="official-extract">${esc(source.excerpt)}</blockquote>`:""}<p class="field-hint">${source.status==='ok'?'Documento recuperado · huella '+esc(source.fingerprint):'Actualización no verificada'}</p>${officialUrl(source.url)?`<a class="ext-link" href="${esc(officialUrl(source.url))}" target="_blank" rel="noopener noreferrer">Consultar original ↗</a>`:''}${(source.references||[]).filter(ref=>keys.some(key=>new RegExp('\\bE\\s*'+key.slice(1)+'(?![\\da-z])','i').test(ref.title))).slice(0,8).map(ref=>officialUrl(ref.url)?`<p><a href="${esc(officialUrl(ref.url))}" target="_blank" rel="noopener noreferrer">${esc(ref.title)}</a> · referencia coincidente; revisar su alcance</p>`:'').join('')}</div>`).join('')}<p class="notice">${esc(data.coverage)} Una huella identifica el texto recuperado; no interpreta cambios legales. La ausencia de referencias no prueba autorización ni ausencia de riesgo.</p>`;
 }catch{if(target.isConnected)target.innerHTML=errorBox('No se pudieron actualizar los documentos oficiales.','Los enlaces originales están disponibles en cada componente.');}
}
async function renderOfficialNews(target){
 try{
  const data=await loadOfficial('news');if(!target.isConnected)return;
  target.innerHTML=`<p class="field-hint">Consultado: ${esc(timeLabel(data.fetchedAt))}. Revalidación del servidor cada 15 minutos.</p><p class="notice">${esc(data.coverage)} Las noticias no actualizan automáticamente las conclusiones de seguridad de un producto.</p>${[...data.sources].sort((a,b)=>Number(b.id==='alerts')-Number(a.id==='alerts')).map(source=>`<section class="panel"><h3>${esc(source.region)} · ${esc(source.authority)}</h3>${source.status!=='ok'?'<p class="error-box">Actualización pendiente: fuente temporalmente no disponible.</p>':!(source.items||[]).length?'<p class="muted">Listado alimentario sin entradas recuperadas en esta consulta. Fuente completa disponible debajo.</p>':source.items.slice(0,10).map(item=>`<article class="news-item"><h4>${officialUrl(item.url)?`<a href="${esc(officialUrl(item.url))}" target="_blank" rel="noopener noreferrer">${esc(item.title)} ↗</a>`:esc(item.title)}</h4><p class="field-hint">${esc(timeLabel(item.publishedAt))} · ${esc(item.region)}</p><p>${esc(item.summary)}</p><p class="field-hint">${esc(item.type)}</p></article>`).join('')}${officialUrl(source.url)?`<a class="ext-link" href="${esc(officialUrl(source.url))}" target="_blank" rel="noopener noreferrer">Fuente completa ↗</a>`:''}</section>`).join('')}`;
  clearTimeout(target.refreshTimer);target.refreshTimer=setTimeout(()=>{if(target.isConnected)renderOfficialNews(target);},900000);
 }catch{if(target.isConnected)target.innerHTML=errorBox('No se pudieron actualizar noticias.','Los portales oficiales siguen disponibles en los enlaces inferiores.');}
}

function headlineItems(data){
 const all=(data.sources||[]).filter(s=>s.status==='ok').flatMap(s=>(s.items||[]).map(item=>({...item,sourceId:s.id})));
 const sorted=all.filter(item=>officialUrl(item.url)).sort((a,b)=>Number(b.sourceId==='alerts')-Number(a.sourceId==='alerts')||(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0));
 const seen=new Set();return sorted.filter(item=>{if(seen.has(item.url))return false;seen.add(item.url);return true;}).slice(0,5);
}
async function updateNewsBanner(){
 const target=document.getElementById('tickerTrack');if(!target)return;
 try{
  const data=await loadOfficial('news');const items=headlineItems(data);
  target.replaceChildren();
  if(!items.length){const a=document.createElement('a');a.href='#/noticias';a.textContent='Noticias oficiales de alimentación · EFSA e INVIMA';target.append(a);return;}
  for(const item of items){const a=document.createElement('a');a.href=officialUrl(item.url);a.target='_blank';a.rel='noopener noreferrer';a.textContent=`${item.region} · ${item.title}`;target.append(a);}
 }catch{target.replaceChildren();const a=document.createElement('a');a.href='#/noticias';a.textContent='Noticias y fuentes oficiales';target.append(a);}
}
