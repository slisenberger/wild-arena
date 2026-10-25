// Fast tuning probe: a fixed random sample of legal teams on every map. Reports how much maps matter,
// each animal's value per map, and the leading teams per map.
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const SIM = process.env.SIM || './sim.js';
const A = require(SIM);
function tallest(t){ return A.defaultMount(t); } // ride a giant, else on foot
if (!isMainThread){
  const out = workerData.jobs.map(j => { let s = 0; for (const seed of j.seeds) s += A.simulate({team: j.team, terrain: j.tr, mode: 'wild', mount: tallest(j.team), seed}).result.score; return {k: j.k, m: s / j.seeds.length}; });
  parentPort.postMessage(out); return;
}
const NT = +process.argv[2] || 500, NS = +process.argv[3] || 4, TERR = Object.keys(A.TERRAINS);
const n = A.ANIMALS.length, all = [];
for (let m = 1; m < (1 << n); m++){ let c = 0; const t = []; for (let i = 0; i < n; i++) if (m >> i & 1){ c += A.ANIMALS[i].price; t.push(A.ANIMALS[i].id); } if (c <= 1000 && c >= 800) all.push(t); }
const R = A.rng(77); const teams = [];
const pick = new Set(); while (pick.size < Math.min(NT, all.length)) pick.add(Math.floor(R() * all.length));
for (const i of pick) teams.push(all[i]);
// always include a few reference builds
for (const t of [['elephant','rhino','tiger'], ['elephant','rhino','grizzly'], ['elephant','hippo','tiger'], ['elephant','grizzly','tiger','jaguar','cougar'], ['polar','grizzly','lion','wolf','hyena'], ['rhino','giraffe','jaguar','hyena'], ['buffalo','bison','grizzly','hyena'], ['hippo','croc','jaguar','cougar'], ['lion','tiger','grizzly','hyena','wolf','jaguar']]) teams.push(A.ANIMALS.map(a => a.id).filter(id => t.includes(id)));
const jobs = [];
teams.forEach((t, i) => TERR.forEach(tr => jobs.push({k: i + '|' + tr, team: t, tr, seeds: Array.from({length: NS}, (_, j) => 31 + j * 7919)})));
const t0 = Date.now();
Promise.all([0, 1].map(wi => new Promise(res => { const w = new Worker(__filename, {workerData: {jobs: jobs.filter((_, i) => i % 2 === wi)}}); w.on('message', res); }))).then(parts => {
  const M = {}; parts.flat().forEach(r => { const [i, tr] = r.k.split('|'); (M[i] = M[i] || {})[tr] = r.m; });
  const ids = Object.keys(M); const g = ids.reduce((s, i) => s + TERR.reduce((a, tr) => a + M[i][tr], 0), 0) / (ids.length * 4);
  const tm = {}, mm = {}; ids.forEach(i => tm[i] = TERR.reduce((a, tr) => a + M[i][tr], 0) / 4); TERR.forEach(tr => mm[tr] = ids.reduce((a, i) => a + M[i][tr], 0) / ids.length);
  let sT = 0, sM = 0, sI = 0; ids.forEach(i => { sT += 4 * (tm[i] - g) ** 2; TERR.forEach(tr => sI += (M[i][tr] - tm[i] - mm[tr] + g) ** 2); }); TERR.forEach(tr => sM += ids.length * (mm[tr] - g) ** 2);
  const tot = sT + sM + sI;
  console.log(`${SIM}  ${ids.length} teams x 4 maps x ${NS} seeds, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(`variance: team ${(100 * sT / tot).toFixed(0)}%  map ${(100 * sM / tot).toFixed(0)}%  team x map ${(100 * sI / tot).toFixed(0)}%   map means: ${TERR.map(tr => tr + ' ' + mm[tr].toFixed(0)).join(' ')}`);
  const val = a => TERR.map(tr => { const on = [], off = []; ids.forEach(i => (teams[i].includes(a.id) ? on : off).push(M[i][tr])); const m = x => x.reduce((p, q) => p + q, 0) / Math.max(1, x.length); return m(on) - m(off); });
  console.log('animal value (s) sav/riv/for/tun:');
  A.ANIMALS.map(a => ({a, v: val(a)})).sort((x, y) => (y.v.reduce((p, q) => p + q) - x.v.reduce((p, q) => p + q))).forEach(r => console.log('  ' + r.a.abbr + '  ' + r.v.map(x => (x >= 0 ? '+' : '') + x.toFixed(0)).map(s => s.padStart(5)).join(' ') + '   spread ' + (Math.max(...r.v) - Math.min(...r.v)).toFixed(0)));
  for (const tr of TERR){
    const top = ids.slice().sort((x, y) => M[y][tr] - M[x][tr]).slice(0, 4);
    console.log(`${tr.padEnd(8)} top: ` + top.map(i => teams[i].map(id => A.BY_ID[id].abbr).join('+') + ' ' + M[i][tr].toFixed(0)).join(' | '));
  }
  const refs = teams.slice(-9); console.log('refs (sav/riv/for/tun):'); refs.forEach((t, k) => { const i = String(teams.length - 9 + k); console.log('  ' + t.map(id => A.BY_ID[id].abbr).join('+').padEnd(26) + TERR.map(tr => M[i][tr].toFixed(0).padStart(4)).join(' ')); });
});
