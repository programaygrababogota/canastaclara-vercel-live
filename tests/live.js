(async()=>{
 const output=document.querySelector('pre');
 let passed=0;
 for(const [path,status,validate] of liveCases){
  const start=Date.now();
  try{
   const r=await fetch(path,{signal:AbortSignal.timeout(15000)}); const d=await r.json();
   const ok=r.status===status&&validate(d); if(ok)passed++;
   output.textContent+=`${ok?'PASS':'FAIL'} ${path} HTTP ${r.status} ${Date.now()-start}ms\n`;
  } catch(e){output.textContent+=`FAIL ${path} ${e.message}\n`;}
  // Keep this smoke suite below the documented legacy search request quota too.
  await new Promise(resolve=>setTimeout(resolve,7000));
 }
 output.textContent+=`DONE ${passed}/${liveCases.length} passed`;
})();
