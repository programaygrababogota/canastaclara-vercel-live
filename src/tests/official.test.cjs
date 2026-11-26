const {test}=require('node:test');const assert=require('node:assert/strict');
const {SOURCES,safeLink,parseFeed,parseAlerts,parseDocument}=require('../lib/official');
test('official links reject SSRF-like and external URLs',()=>{
 for(const url of ['http://www.invima.gov.co/x','https://evil.example/x','javascript:alert(1)','https://user:pass@www.invima.gov.co/x'])assert.equal(safeLink(url,SOURCES.alerts.url),null);
 assert.equal(safeLink('/alertas-sanitarias/alimento',SOURCES.alerts.url),'https://www.invima.gov.co/alertas-sanitarias/alimento');
});
test('RSS strips HTML, preserves publisher/date and rejects entities',()=>{
 const result=parseFeed('<rss><channel><item><title><![CDATA[<img src=x onerror=alert(1)> Food]]></title><link>https://www.efsa.europa.eu/en/news/food</link><pubDate>Wed, 18 Nov 2026 12:00:00 GMT</pubDate><description><![CDATA[<p>Summary</p><script>bad</script>]]></description></item></channel></rss>',SOURCES.news);
 assert.equal(result[0].title,'Food');assert.equal(result[0].region,'UE');assert.match(result[0].publishedAt,/2026-11-18/);
 assert.throws(()=>parseFeed('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>',SOURCES.news));
 assert.throws(()=>parseFeed('<html>Access denied</html>',SOURCES.news));
});
test('INVIMA alerts keep food sector and ignore medicine-only cards',()=>{
 const html='<article>Alimentos y bebidas <a href="/alertas-sanitarias/alimento">Retiro del alimento de prueba</a> 20-11-2026</article><article>Medicamentos<a href="/alertas-sanitarias/medicine">Retiro de medicamento de prueba</a></article>';
 const items=parseAlerts(html,SOURCES.alerts);assert.equal(items.length,1);assert.equal(items[0].region,'Colombia');assert.match(items[0].publishedAt,/2026-11-20/);
});
test('document monitor uses content fingerprints not invented official risk ratings',()=>{
 const doc=parseDocument('<html><h1>Food additives</h1><main><a href="/en/news/e955">E 955 Sucralose</a><script>bad()</script></main></html>',SOURCES.efsa);
 assert.equal(doc.references[0].title,'E 955 Sucralose');assert.match(doc.fingerprint,/^[a-f0-9]{16}$/);assert.equal(doc.risk,undefined);
});
test('component study links quote search terms and label provenance as frameworks',()=>{
 const fs=require('node:fs'),vm=require('node:vm');const ctx=vm.createContext({URL,URLSearchParams});
 vm.runInContext(fs.readFileSync(require.resolve('../js/official.js'),'utf8'),ctx);
 const url=vm.runInContext('studyLink("e955",true)',ctx);assert.equal(new URL(url).hostname,'pubmed.ncbi.nlm.nih.gov');assert.match(new URL(url).searchParams.get('term'),/sucralose.*systematic\[sb\]/);
 assert.equal(vm.runInContext('studyLink("<img>")',ctx),null);
 assert.match(vm.runInContext('jurisdictionDisclosure()',ctx),/no una aprobación conjunta/);
});
test('INVIMA food filter uses only GET forms on the exact official listing',()=>{
 const {foodFilter}=require('../lib/official');
 assert.equal(foodFilter('<form><select name="sector"><option value="12">Alimentos y bebidas</option></select></form>',SOURCES.alerts),'https://www.invima.gov.co/alertas-sanitarias?sector=12');
 for(const form of ['<form action="https://evil.example/">','<form method="POST">','<form action="/admin">'])assert.equal(foodFilter(form+'<select name="sector"><option value="12">Alimentos y bebidas</option></select></form>',SOURCES.alerts),null);
});
test('new component discovery does not assign an official risk or overwrite existing editorial notes',()=>{
 const fs=require('node:fs'),vm=require('node:vm');const additives={e955:{nombre:'Sucralosa',riesgo:'debate'}};const ctx=vm.createContext({ADDITIVES:additives});
 vm.runInContext(fs.readFileSync(require.resolve('../js/official.js'),'utf8'),ctx);
 const data={sources:[{id:'efsa',status:'ok',region:'UE',references:[{title:'E 999 Quillaia extract',url:'https://www.efsa.europa.eu/en/example'},{title:'E 955 Sucralose',url:'https://www.efsa.europa.eu/en/example'}]}]};
 assert.equal(vm.runInContext(`integrateOfficialComponents(${JSON.stringify(data)})`,ctx),1);assert.equal(additives.e999.riesgo,'desconocido');assert.equal(additives.e955.riesgo,'debate');assert.equal(additives.e999.officialReference.region,'UE');
});
test('current INVIMA sector links override general listing and discard unrelated searches',()=>{
 const {foodFilter}=require('../lib/official');
 assert.equal(foodFilter('<a href="/alertas-sanitarias?q=bebidas&amp;direccion=da">Alimentos y bebidas</a>',SOURCES.alerts),'https://www.invima.gov.co/alertas-sanitarias?direccion=da');
 const html='<article class="inv-lst-tarjeta"><div class="inv-lst-direccion">Medicamentos</div><h2><a href="/alertas-sanitarias/medicine">Medicamento con alimentos en el texto</a></h2></article>';
 assert.equal(parseAlerts(html,SOURCES.alerts).length,0);
});
test('news banner selects official Colombia alerts then recent reports without duplicate links',()=>{
 const fs=require('node:fs'),vm=require('node:vm');const ctx=vm.createContext({URL,URLSearchParams});vm.runInContext(fs.readFileSync(require.resolve('../js/official.js'),'utf8'),ctx);
 const data={sources:[{id:'news',status:'ok',items:[{title:'EU',url:'https://www.efsa.europa.eu/en/news/item',publishedAt:'2026-11-26'}]},{id:'alerts',status:'ok',items:[{title:'CO',url:'https://www.invima.gov.co/alertas-sanitarias/item',publishedAt:'2026-11-25'},{title:'bad',url:'javascript:alert(1)'}]}]};
 const items=vm.runInContext(`headlineItems(${JSON.stringify(data)})`,ctx);assert.equal(items.length,2);assert.equal(items[0].title,'CO');
 const source=fs.readFileSync(require.resolve('../js/official.js'),'utf8');assert.ok(!source.includes('Volver a consultar'));
 const views=fs.readFileSync(require.resolve('../js/views.js'),'utf8');assert.ok(!views.includes('id="riskFilters"'));
});
