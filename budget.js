// Budget/price schemes, done properly: screen every full-spend team cheaply, then simulate the
// contenders many times. A team's result does not depend on prices, so screens are shared across schemes.
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), fs = require('fs');
const A = require('./sim.js');
const TERR = Object.keys(A.TERRAINS);
function tallest(t){ let b = null, h = 0; for (const id of t){ const m = A.BY_ID[id].mountH; if (m > h){ h = m; b = id; } } return b; }
if (!isMainThread){
  const out = workerData.jobs.map(j => { const s = []; let wins = 0; const killers = {};
    for (const seed of j.seeds){ const w = A.simulate({team: j.team, terrain: j.tr, mode: 'wild', mount: tallest(j.team), seed}); s.push(w.result.score); if (w.result.survived) wins++; else killers[w.result.killer] = (killers[w.result.killer] || 0) + 1; }
    return {k: j.k, s, wins, killers}; });
  parentPort.postMessage(out); return;
}
const LOG = path.join(__dirname, 'budget.log'); fs.writeFileSync(LOG, '');
const log = m => fs.appendFileSync(LOG, `[${new Date().toISOString().slice(11, 19)}] ${m}\n`);
function run(jobs){ return new Promise(res => { let done = 0; const all = []; [0, 1].forEach(wi => { const w = new Worker(__filename, {workerData: {jobs: jobs.filter((_, i) => i % 2 === wi)}}); w.on('message', m => { all.push(...m); if (++done === 2) res(all); }); w.on('error', e => { log('ERROR ' + e.stack); process.exit(1); }); }); }); }
async function batched(jobs, label){ const out = []; const B = 600, t0 = Date.now(); for (let i = 0; i < jobs.length; i += B){ out.push(...await run(jobs.slice(i, i + B))); const el = (Date.now() - t0) / 1000, f = Math.min(1, (i + B) / jobs.length); log(`${label} ${Math.min(i + B, jobs.length)}/${jobs.length} ~${Math.round(el / f - el)}s left`); } return out; }
const seeds = (b, n) => Array.from({length: n}, (_, i) => b + i * 7919);
const BASE = Object.fromEntries(A.ANIMALS.map(a => [a.id, a.price]));
const SCHEMES = {
  'A  $1,200, current prices': {budget: 1200, price: {}},
  'B  $1,200, elephant $600': {budget: 1200, price: {elephant: 600}},
  'C  $1,200, elephant $700, rhino $500': {budget: 1200, price: {elephant: 700, rhino: 500}},
  'base  $1,000, current prices': {budget: 1000, price: {}},
};
const cost = (t, sc) => t.reduce((s, id) => s + (sc.price[id] || BASE[id]), 0);
(async () => {
  const n = A.ANIMALS.length, ids = A.ANIMALS.map(a => a.id);
  // full-spend teams per scheme: nothing else affordable could be added
  const sets = {};
  for (const [nm, sc] of Object.entries(SCHEMES)){
    sets[nm] = [];
    for (let m = 1; m < (1 << n); m++){ const t = []; for (let i = 0; i < n; i++) if (m >> i & 1) t.push(ids[i]); const c = cost(t, sc); if (c > sc.budget) continue;
      if (ids.some(id => !t.includes(id) && c + (sc.price[id] || BASE[id]) <= sc.budget)) continue; sets[nm].push(t.join('+')); }
    log(`${nm}: ${sets[nm].length} full-spend teams`);
  }
  const union = [...new Set(Object.values(sets).flat())];
  log(`screening ${union.length} distinct teams, 4 runs per map`);
  const j1 = []; for (const t of union) for (const tr of TERR) j1.push({k: t + '|' + tr, team: t.split('+'), tr, seeds: seeds(17, 4)});
  const r1 = await batched(j1, 'screen');
  const scr = {}; for (const r of r1){ const [t] = r.k.split('|'); scr[t] = (scr[t] || 0) + r.s.reduce((a, b) => a + b, 0); }
  fs.writeFileSync(path.join(__dirname, 'screen.json'), JSON.stringify({sets, scr}));
  // contenders: top 25 per scheme by screened time alive
  const deep = new Set(); const tops = {};
  for (const nm of Object.keys(SCHEMES)){ tops[nm] = sets[nm].slice().sort((a, b) => scr[b] - scr[a]).slice(0, 25); tops[nm].forEach(t => deep.add(t)); }
  log(`deep runs: ${deep.size} contenders, 100 runs per map`);
  const j2 = []; for (const t of deep) for (const tr of TERR) j2.push({k: t + '|' + tr, team: t.split('+'), tr, seeds: seeds(990001, 100)});
  const r2 = await batched(j2, 'deep');
  fs.writeFileSync(path.join(__dirname, 'deep.json'), JSON.stringify({tops, r2, schemes: SCHEMES, sets: Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.length]))}));
  log('ALL DONE');
})();
