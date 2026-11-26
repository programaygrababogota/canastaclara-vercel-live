(async()=>{
 const target=document.getElementById('results');
 for(const mode of ['documents','news']){
  try{
   const r=await fetch('/api/official?mode='+mode);const d=await r.json();
   for(const s of d.sources){
    const p=document.createElement('p');
    p.textContent=`${s.status==='ok'?'PASS':'UNAVAILABLE'} ${mode} ${s.id} ${s.region} HTTP ${r.status} ${s.title||''} items=${s.items?.length??'-'} references=${s.references?.length??'-'}`;
    target.append(p);
    if(s.id==='alerts'){const detail=document.createElement('p');detail.textContent='INVIMA filtro: '+s.listingUrl+' | '+(s.items?.[0]?.title||'Sin entradas');target.append(detail);}
   }
  }catch(e){const p=document.createElement('p');p.textContent='FAIL '+mode+' '+e.message;target.append(p);}
 }
 const r=await fetch('/api/official?mode=invalid');const p=document.createElement('p');p.textContent=(r.status===400?'PASS':'FAIL')+' invalid mode HTTP '+r.status;target.append(p);
 const end=document.createElement('h2');end.textContent='DONE';target.append(end);
})();
