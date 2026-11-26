const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.dataset={};this.events={};this.style={setProperty:(k,v)=>this.attrs[k]=v};this.scrollWidth=1600;this.className='';this.classList={add:value=>this.className+=' '+value};}
 append(...nodes){this.children.push(...nodes)}replaceChildren(...nodes){this.children=nodes}setAttribute(k,v){this.attrs[k]=v}addEventListener(k,fn){this.events[k]=fn}
 querySelectorAll(tag){return this.children.flatMap(child=>[...(child.tag===tag?[child]:[]),...child.querySelectorAll(tag)])}
 cloneNode(){const e=new Element(this.tag);e.className=this.className;e.textContent=this.textContent;e.href=this.href;e.children=this.children.map(child=>child.cloneNode());return e}
}
function setup(){const nodes={tickerTrack:new Element('div'),newsTicker:new Element('div'),tickerPause:new Element('button')};const ctx=vm.createContext({URL,URLSearchParams,document:{getElementById:id=>nodes[id],createElement:tag=>new Element(tag)}});vm.runInContext(fs.readFileSync(require.resolve('../js/official.js'),'utf8'),ctx);return {ctx,nodes};}
test('banner keeps identical groups, hides duplicate controls and uses text content',()=>{
 const {ctx,nodes}=setup();const data=[{url:'https://www.invima.gov.co/alertas-sanitarias/test',title:'<img src=x> Titular',region:'Colombia'}];ctx.data=data;ctx.target=nodes.tickerTrack;vm.runInContext('renderNewsBanner(target,data)',ctx);
 const [group,copy]=nodes.tickerTrack.children;assert.equal(group.children.length,1);assert.equal(copy.children.length,1);assert.equal(copy.attrs['aria-hidden'],'true');assert.equal(copy.attrs.inert,undefined);assert.equal(copy.querySelectorAll('a')[0].attrs.tabindex,'-1');assert.equal(group.querySelectorAll('a')[0].textContent,'Colombia · <img src=x> Titular');assert.equal(group.querySelectorAll('a')[0].rel,'noopener noreferrer');assert.equal(nodes.newsTicker.dataset.ready,'true');
 vm.runInContext('renderNewsBanner(target,data)',ctx);assert.equal(nodes.tickerTrack.children[0],group);
});
test('banner toggles pause accessibly and handles missing sources',()=>{
 const {ctx,nodes}=setup();vm.runInContext('initNewsBanner()',ctx);nodes.tickerPause.events.click();assert.equal(nodes.newsTicker.dataset.paused,'true');assert.equal(nodes.tickerPause.attrs['aria-pressed'],'true');assert.match(nodes.tickerPause.attrs['aria-label'],/Reanudar/);
 nodes.tickerPause.events.click();assert.equal(nodes.newsTicker.dataset.paused,'false');ctx.target=nodes.tickerTrack;vm.runInContext('renderNewsBanner(target,[])',ctx);assert.equal(nodes.newsTicker.dataset.ready,'false');assert.equal(nodes.tickerTrack.children[0].querySelectorAll('a')[0].href,'#/noticias');
});
