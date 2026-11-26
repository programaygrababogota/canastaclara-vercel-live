const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('OFF write implementation and browser module are removed',()=>{
 for(const file of ['api/off-contribution.js','lib/off-contribution.js','js/contribution.js'])assert.equal(fs.existsSync(path.join(root,file)),false);
 const views=fs.readFileSync(path.join(root,'js/views.js'),'utf8');assert.ok(!views.includes('initContribution'));assert.ok(!views.includes('contributionPanel'));
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.ok(!html.includes('js/contribution.js'));
 assert.match(views,/id="openFoodFactsWeb"[^>]*href="https:\/\/world\.openfoodfacts\.org\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
});
test('manual describes external contribution, not a credential-activated POST',()=>{
 const manual=fs.readFileSync(path.join(root,'manual.html'),'utf8');assert.ok(manual.includes('no comparte ni transfiere automáticamente'));assert.ok(!manual.includes('OFF_PASSWORD'));assert.ok(!manual.includes('OFF_USERNAME'));assert.ok(!manual.includes('OFF_CONTRIBUTOR_SALT'));
});
