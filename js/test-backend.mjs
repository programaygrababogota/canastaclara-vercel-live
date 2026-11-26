// Read-only live smoke suite. Run: BASE_URL=https://your-deployment node js/test-backend.mjs
import cases from '../tests/live-cases.js';
const base = process.env.BASE_URL || 'http://localhost:3000';
let passed = 0;
for (const [path, status, validate] of cases) {
  try {
    const r = await fetch(new URL(path, base), {signal: AbortSignal.timeout(15000)});
    const d = await r.json();
    const ok = r.status === status && validate(d);
    if (ok) passed++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${path} HTTP ${r.status}`);
  } catch (e) { console.log(`FAIL ${path} ${e.message}`); }
  await new Promise(resolve => setTimeout(resolve, 7000));
}
console.log(`${passed}/${cases.length} passed`);
process.exitCode = passed === cases.length ? 0 : 1;
