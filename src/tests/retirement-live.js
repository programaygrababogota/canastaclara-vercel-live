(async()=>{
 const out=document.getElementById('results');let passed=0;
 const cases=[['Antiguo endpoint GET retirado',()=>fetch('/api/off-contribution'),404],['Antiguo endpoint POST retirado',()=>fetch('/api/off-contribution',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'validate'})}),404],['Módulo de navegador retirado',()=>fetch('/js/contribution.js'),404],['Manual actualizado disponible',()=>fetch('/manual'),200]];
 for(const [name,fn,want]of cases){try{const r=await fn();const ok=r.status===want;if(ok)passed++;const p=document.createElement('p');p.textContent=`${ok?'PASS':'FAIL'} ${name} HTTP ${r.status}`;out.append(p);}catch{const p=document.createElement('p');p.textContent='FAIL '+name;out.append(p);}}
 const p=document.createElement('h2');p.textContent=`DONE ${passed}/${cases.length}`;out.append(p);
})();
