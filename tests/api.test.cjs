const {test} = require('node:test');
const assert = require('node:assert/strict');
const {build,handler} = require('../api/_shared');
test('fixed HTTPS origins, encoded queries, bounded pagination',()=>{
 assert.equal(build('search',{q:'leche & café'}).searchParams.get('q'),'"leche" "&" "café"');
 assert.equal(build('product',{code:'3017620422003'}).hostname,'world.openfoodfacts.org');
 for (const q of [{q:'a',pageSize:'1000'},{q:'a',page:'-1'}]) assert.throws(()=>build('search',q));
 assert.throws(()=>build('product',{code:'https://localhost'}));
 assert.throws(()=>build('invima',{ds:'evil',q:'x'}));
 assert.throws(()=>build('category',{tag:'%%bad%%'}));
});
test('government query is server constructed and quotes escaped',()=>{
 const u=build('invima',{ds:'uhs6-qp53',q:"O'Brien%",'$where':'true'});
 assert.equal(u.searchParams.get('$where'),"contains(upper(razon_social), 'O''BRIEN%')");
});
test('timeouts, non-JSON, upstream failure, missing product and method handling',async()=>{
 const original=global.fetch;
 try {
 for(const [mock,status] of [
 [async()=>{throw Object.assign(new Error(),{name:'TimeoutError'})},504],
 [async()=>new Response('html',{headers:{'content-type':'text/html'}}),502],
 [async()=>new Response('{}',{status:429}),429],
 [async()=>new Response('{}',{status:404}),200]
 ]){
 global.fetch=mock;
 const res={setHeader(){},status(s){this.code=s;return this},json(d){this.data=d;return this}};
 await handler('product')({method:'GET',query:{code:'3017620422003'}},res);
 assert.equal(res.code,status);
 }
 } finally {global.fetch=original}
});

test('untrusted nutrition badges cannot inject markup',()=>{
 const fs=require('node:fs'); const vm=require('node:vm');
 const source=fs.readFileSync(require.resolve('../js/views.js'),'utf8');
 const context=vm.createContext({}); vm.runInContext(source,context);
 for (const expression of [`nutriscoreBadge('<img src=x onerror=alert(1)>')`, `novaBadge('<img src=x onerror=alert(1)>')`]) {
  assert.ok(!vm.runInContext(expression,context).includes('<img'));
 }
});

test('search and category use indexed filter names and literal user text',()=>{
 const u=build('category',{tag:'en:chocolates',colombiaOnly:'1'});
 assert.equal(u.hostname,'search.openfoodfacts.org');
 assert.equal(u.searchParams.get('q'),'categories:"en:chocolates" countries:"en:colombia"');
 const q=build('search',{q:'milk OR countries:france'}).searchParams.get('q');
 assert.equal(q,'"milk" "OR" "countries:france"');
});
test('Vercel handler posts identified requests and normalizes hits without detail fan-out',async()=>{
 const original=global.fetch; const calls=[];
 global.fetch=async(url,options)=>{
  calls.push([url.toString(),options]);
  return Response.json({hits:[{code:'3017620422003',product_name_es:'Leche',brands:['alpina'],countries:['en:colombia']}],count:1,page:1,page_size:2,is_count_exact:true});
 };
 try {
  const res={setHeader(){},status(s){this.code=s;return this},json(d){this.data=d;return this}};
  await handler('search')({method:'GET',query:{q:'leche',pageSize:'2'}},res);
  assert.equal(res.code,200); assert.equal(calls.length,1);
  assert.equal(calls[0][0],'https://search.openfoodfacts.org/search');
  const opts=calls[0][1]; assert.equal(opts.method,'POST');
  assert.match(opts.headers['User-Agent'],/^canastaclara\//);
  assert.equal(opts.redirect,'error');
  const body=JSON.parse(opts.body); assert.deepEqual(body.langs,['es','en']);
  assert.equal(body.page_size,2); assert.equal(body.q,'"leche"');
  assert.equal(res.data.products[0].product_name,'Leche');
  assert.equal(res.data.products[0].brands,'alpina');
  assert.deepEqual(res.data.products[0].countries_tags,['en:colombia']);
 } finally {global.fetch=original}
});
test('browser only calls same-origin proxy, never provider hosts',()=>{
 const fs=require('node:fs');const vm=require('node:vm');
 const calls=[]; const context=vm.createContext({URLSearchParams,AbortController,setTimeout,clearTimeout,fetch:async(url)=>{calls.push(url);return {ok:true,json:async()=>({products:[],count:0})}}});
 vm.runInContext(fs.readFileSync(require.resolve('../js/api.js'),'utf8'),context);
 return vm.runInContext('OFF.search("leche")',context).then(()=>assert.match(calls[0],/^\/api\/search\?/));
});
test('report storage validates shape, bounds text and rejects enum tampering',()=>{
 const fs=require('node:fs'),vm=require('node:vm'); let stored='{}';
 const ctx=vm.createContext({crypto:require('node:crypto').webcrypto,URL,localStorage:{getItem:()=>stored,setItem:(k,v)=>stored=v}});
 vm.runInContext(fs.readFileSync(require.resolve('../js/api.js'),'utf8'),ctx);
 assert.equal(vm.runInContext('Reports.all().length',ctx),0);
 assert.throws(()=>vm.runInContext('Reports.add({producto:"x",empresa:"y",tipo:"injected",gravedad:"alta"})',ctx));
 vm.runInContext(`Reports.add({producto:'  leche\\u0000 ',empresa:'A'.repeat(130),tipo:'Otro',gravedad:'baja',detalle:'x'.repeat(3000)})`,ctx);
 const saved=JSON.parse(stored)[0]; assert.equal(saved.producto,'leche');assert.equal(saved.empresa.length,120);assert.equal(saved.detalle.length,2000);
 assert.match(saved.id,/^[a-z0-9-]+$/i);
 stored=JSON.stringify([{...saved,id:'" onclick="alert(1)',gravedad:'alta'}]);
 assert.equal(vm.runInContext('Reports.all()[0].id',ctx),'');
});
test('image URLs are restricted and repeated numeric inputs rejected',()=>{
 const fs=require('node:fs'),vm=require('node:vm');const ctx=vm.createContext({URL});
 vm.runInContext(fs.readFileSync(require.resolve('../js/api.js'),'utf8'),ctx);
 for(const value of ['javascript:alert(1)','https://evil.example/pixel','https://images.openfoodfacts.org.evil.example/x','https://user:pass@images.openfoodfacts.org/x']) {
  assert.equal(vm.runInContext(`safeProductImage(${JSON.stringify(value)})`,ctx),'');
 }
 assert.equal(vm.runInContext('safeProductImage("https://images.openfoodfacts.org/x.jpg")',ctx),'https://images.openfoodfacts.org/x.jpg');
 assert.throws(()=>build('search',{q:'x',pageSize:['2']}));
 assert.throws(()=>build('search',{q:'test\x7f'}));
});
test('Speed Insights initializes once and strips query/hash from event URLs',()=>{
 const fs=require('node:fs'),vm=require('node:vm'); const window={};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/performance.js'),'utf8'),{window,URL,location:{origin:'https://example.com'}});
 assert.equal(window.siq.length,1); assert.equal(window.siq[0][0],'beforeSend');
 const clean=window.siq[0][1]({url:'https://example.com/?secret=private#/reportar?producto=private',metric:'LCP'});
 assert.equal(clean.url,'https://example.com/'); assert.equal(clean.metric,'LCP');
});
test('local finding evidence validates GTIN checksum, dates and HTTPS links',()=>{
 const fs=require('node:fs'),vm=require('node:vm');let saved='[]';
 const ctx=vm.createContext({URL,crypto:require('node:crypto').webcrypto,localStorage:{getItem:()=>saved,setItem:(k,v)=>saved=v}});
 vm.runInContext(fs.readFileSync(require.resolve('../js/api.js'),'utf8'),ctx);
 assert.equal(vm.runInContext('validGTIN("7802225510196")',ctx),true);
 assert.equal(vm.runInContext('validGTIN("7802225510197")',ctx),false);
 assert.equal(vm.runInContext('validGTIN("123456789")',ctx),false);
 const base={producto:'Privilegio',empresa:'Arcor',tipo:'Otro',gravedad:'baja'};
 for(const bad of [{code:'7802225510197'},{observado:'2026-02-30'},{observado:'2999-01-01'},{evidencia:'javascript:alert(1)'},{evidencia:'https://user:pass@example.com/'}]) {
  assert.throws(()=>vm.runInContext(`Reports.add(${JSON.stringify({...base,...bad})})`,ctx));
 }
 vm.runInContext(`Reports.add(${JSON.stringify({...base,code:'7802225510196',lote:'L-01',observado:'2026-01-01',lugar:'Bogotá',evidencia:'https://example.com/evidencia'})})`,ctx);
 assert.equal(JSON.parse(saved)[0].code,'7802225510196');
 assert.equal(vm.runInContext('Reports.all()[0].lote',ctx),'L-01');
 assert.equal(vm.runInContext('Reports.all()[0].evidencia',ctx),'https://example.com/evidencia');
});
test('nutrient bar percentages remain finite and between 0 and 100',()=>{
 const fs=require('node:fs'),vm=require('node:vm');const ctx=vm.createContext({});
 vm.runInContext(fs.readFileSync(require.resolve('../js/api.js'),'utf8'),ctx);
 for(const [value,reference,want] of [[-4,10,0],[20,10,100],[5,10,50],['NaN',10,0],[10,0,0]]) {
 assert.equal(vm.runInContext(`nutrientPercent(${JSON.stringify(value)},${reference})`,ctx),want);
 }
});
test('theme follows system, toggles, persists and tolerates blocked storage',()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const source=fs.readFileSync(require.resolve('../js/theme.js'),'utf8');
 for(const blocked of [false,true]) {
  const handlers={},root={dataset:{}},button={setAttribute(){},addEventListener:(name,fn)=>handlers[name]=fn};
  let saved=null;
  const ctx={window:{matchMedia:()=>({matches:true,addEventListener:(n,fn)=>handlers.system=fn}),addEventListener:(n,fn)=>handlers[n]=fn},document:{documentElement:root,getElementById:()=>button,addEventListener:(n,fn)=>handlers[n]=fn},localStorage:{getItem:()=>{if(blocked)throw Error();return saved},setItem:(k,v)=>{if(blocked)throw Error();saved=v}}};
  vm.runInNewContext(source,ctx);assert.equal(root.dataset.theme,'light');
  handlers.DOMContentLoaded();assert.equal(button.textContent,'Oscuro');
  handlers.click();assert.equal(root.dataset.theme,'dark');
  handlers.system({matches:true});assert.equal(root.dataset.theme,'dark');
  if(!blocked){assert.equal(saved,'dark');vm.runInNewContext(source,ctx);assert.equal(root.dataset.theme,'dark');}
  handlers.storage({key:'canastaclara_theme_v1',newValue:'light'});assert.equal(root.dataset.theme,'light');
 }
});
