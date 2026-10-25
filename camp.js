// Camping / anti-pattern probe. Two parts:
//  A. Telemetry on a sample of full-budget teams: how fights end (dead / time / cleared / quiet), how long
//     the other side actually presses, time you spend in a tree or riding, enemies loitering without a target.
//  B. Exploit search: move YOU (and the default formation with you) over a grid of start positions. If edge
//     or corner starts score clearly better than the default spot, that's a camping spot.
// Usage: node camp.js [teams] [seeds] [gridSeeds]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const SIM = process.env.SIM || './sim.js';
const A = require(SIM);
function tallest(t){ let b = null, h = 0; for (const id of t){ const m = A.BY_ID[id].mountH; if (m > h){ h = m; b = id; } } return b; }

function run(j){
  const w = A.setup({team: j.team, terrain: j.tr, mode: 'wild', mount: tallest(j.team), seed: j.seed, human: j.human});
  const h = w.human; let tree = 0, ride = 0, press = 0, loiter = 0, wall = 0, n = 0, hit = 0, firstHit = null;
  while (!w.over){
    A.step(w); n++;
    if (h.onTree) tree += A.DT;
    if (h.riding) ride += A.DT;
    if (w.lastPress === w.t) press += A.DT;
    wall += Math.min(h.x, A.W - h.x, h.y, A.H - h.y);
    for (const u of w.units) if (u.side === 'E' && u.state !== 'dead' && !u.escaped && !u.target && u.state !== 'flee' && u.state !== 'feed' && u.state !== 'rest') loiter += A.DT;
    const taken = w.units.filter(u => u.side !== 'E').reduce((s, u) => s + u.st.taken, 0);
    if (taken > hit){ if (firstHit === null) firstHit = w.t; hit = taken; }
  }
  return {k: j.k, why: w.result.why || (w.result.survived ? 'time' : 'dead'), score: w.result.score, t: w.result.t, tree, ride, press, loiter, wall: wall / n, firstHit};
}
if (!isMainThread){ parentPort.postMessage(workerData.jobs.map(run)); return; }

const NT = +process.argv[2] || 120, NS = +process.argv[3] || 4, NG = +process.argv[4] || 6, TERR = Object.keys(A.TERRAINS), NW = 4;
const par = jobs => Promise.all([...Array(NW).keys()].map(wi => new Promise(res => { const w = new Worker(__filename, {workerData: {jobs: jobs.filter((_, i) => i % NW === wi)}}); w.on('message', res); }))).then(p => p.flat());
const n = A.ANIMALS.length, all = [];
for (let m = 1; m < (1 << n); m++){ let c = 0; const t = []; for (let i = 0; i < n; i++) if (m >> i & 1){ c += A.ANIMALS[i].price; t.push(A.ANIMALS[i].id); } if (c <= 1000 && c >= 800) all.push(t); }
const R = A.rng(91); const pick = new Set(); while (pick.size < Math.min(NT, all.length)) pick.add(Math.floor(R() * all.length));
const teams = [...pick].map(i => all[i]);
const mean = a => a.length ? a.reduce((p, q) => p + q, 0) / a.length : 0;
const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(0) + '%';
const t0 = Date.now();

(async () => {
  // ---- A. telemetry ----
  const jobsA = [];
  teams.forEach((t, i) => TERR.forEach(tr => { for (let s = 0; s < NS; s++) jobsA.push({k: i + '|' + tr, team: t, tr, seed: 500 + s * 7919}); }));
  const rA = await par(jobsA);
  console.log(`A. telemetry: ${teams.length} teams x 4 maps x ${NS} seeds (${rA.length} fights), ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log('map      dead  time  clear quiet | quiet-win median t | press % of fight | tree s | ride % | loiter enemy-s/min | wall dist | 1st hit med');
  for (const tr of TERR){
    const r = rA.filter(x => x.k.endsWith('|' + tr)), c = w => r.filter(x => x.why === w).length;
    const q = r.filter(x => x.why === 'quiet').map(x => x.t).sort((a, b) => a - b);
    const fh = r.map(x => x.firstHit === null ? 999 : x.firstHit).sort((a, b) => a - b);
    console.log(tr.padEnd(8), [c('dead'), c('time'), c('cleared'), c('quiet')].map(v => pct(v, r.length).padStart(5)).join(' '),
      '|', (q.length ? Math.round(q[q.length >> 1]) + 's' : '-').padStart(8), '          |', pct(mean(r.map(x => x.press / x.t)), 1).padStart(6),
      '          |', mean(r.map(x => x.tree)).toFixed(1).padStart(5), ' |', pct(mean(r.map(x => x.ride / x.t)), 1).padStart(5),
      ' |', mean(r.map(x => 60 * x.loiter / x.t)).toFixed(0).padStart(6), '            |', mean(r.map(x => x.wall)).toFixed(1).padStart(6), '   |', String(Math.round(fh[fh.length >> 1])).padStart(4) + 's');
  }
  const wins = rA.filter(x => x.score >= 300), qw = wins.filter(x => x.why === 'quiet');
  console.log(`share of 5:00 scores that are "they gave up": ${pct(qw.length, wins.length)} (${qw.length}/${wins.length})`);
  const treeQ = rA.filter(x => x.tree > 10);
  console.log(`fights where you spent >10 s in a tree: ${treeQ.length}; of those, quiet wins ${pct(treeQ.filter(x => x.why === 'quiet').length, treeQ.length)}, deaths ${pct(treeQ.filter(x => x.why === 'dead').length, treeQ.length)}`);

  // ---- B. exploit search over start positions ----
  const refTeams = {
    'just you': [], 'ELE+RHI+TIG': ['elephant', 'rhino', 'tiger'], 'GIR+JAG+HYE+RHI': ['rhino', 'giraffe', 'jaguar', 'hyena'],
    'swarm': ['grizzly', 'tiger', 'gorilla', 'jaguar', 'wolf', 'cougar', 'hyena'], 'HIP+CRO+JAG+CGR': ['hippo', 'croc', 'jaguar', 'cougar'],
  };
  const xs = [4, 14, 24, 34, 44], ys = [4, 18, 33, 48, 62];
  const jobsB = [];
  for (const [name, team] of Object.entries(refTeams)) for (const tr of TERR){
    const z = A.zoneFor(tr), home = A.homeFor(tr);
    const pts = [['home', home.x, home.y]]; for (const x of xs) for (const y of ys) pts.push([x + ',' + y, Math.min(x, z.x1 - 1), y]);
    if (A.TERRAINS[tr].water) pts.push(['bank 46,33', 46, 33], ['bank 46,10', 46, 10]);
    for (const [pk, x, y] of pts) for (let s = 0; s < NG; s++) jobsB.push({k: name + '|' + tr + '|' + pk, team, tr, seed: 9000 + s * 104729, human: {x, y}});
  }
  const tB = Date.now(); const rB = await par(jobsB);
  console.log(`\nB. start-position search: ${Object.keys(refTeams).length} teams x 4 maps x ${xs.length * ys.length + 1}+ spots x ${NG} seeds (${rB.length} fights), ${((Date.now() - tB) / 1000).toFixed(0)}s`);
  console.log('score in seconds (mean). "best" = best spot vs your default home spot; quiet = share of fights ending "they gave up".');
  const G = {}; rB.forEach(r => (G[r.k] = G[r.k] || []).push(r));
  for (const name of Object.keys(refTeams)) for (const tr of TERR){
    const spots = Object.keys(G).filter(k => k.startsWith(name + '|' + tr + '|')).map(k => { const r = G[k]; return {p: k.split('|')[2], m: mean(r.map(x => x.score)), q: r.filter(x => x.why === 'quiet').length / r.length, tree: mean(r.map(x => x.tree))}; });
    const home = spots.find(s => s.p === 'home'); spots.sort((a, b) => b.m - a.m);
    const corner = spots.filter(s => /^(4|44|34),(4|62)$/.test(s.p) || /^4,/.test(s.p));
    console.log(`${name.padEnd(17)} ${tr.padEnd(8)} home ${home.m.toFixed(0).padStart(3)} (quiet ${pct(home.q, 1)})  best ${spots[0].p.padEnd(10)} ${spots[0].m.toFixed(0).padStart(3)} (quiet ${pct(spots[0].q, 1)}, tree ${spots[0].tree.toFixed(0)}s)  2nd ${spots[1].p} ${spots[1].m.toFixed(0)}  worst ${spots[spots.length - 1].p} ${spots[spots.length - 1].m.toFixed(0)}  edge-avg ${mean(corner.map(s => s.m)).toFixed(0)}`);
  }
  // verify: the best spot of 26 is lucky by construction, so re-run best spot vs home on fresh seeds
  const NV = 40, jobsV = [], best = {};
  for (const [name, team] of Object.entries(refTeams)) for (const tr of TERR){
    const ks = Object.keys(G).filter(k => k.startsWith(name + '|' + tr + '|')).sort((a, b) => mean(G[b].map(x => x.score)) - mean(G[a].map(x => x.score)));
    const top = ks.find(k => !k.endsWith('|home')); best[name + '|' + tr] = top.split('|')[2];
    for (const k of [top, name + '|' + tr + '|home']){ const h = G[k][0].human || null; const src = jobsB.find(j => j.k === k);
      for (let s = 0; s < NV; s++) jobsV.push({k: (k.endsWith('|home') ? 'H|' : 'B|') + name + '|' + tr, team, tr, seed: 777 + s * 15485863, human: src.human}); }
  }
  const rV = await par(jobsV), V = {}; rV.forEach(r => (V[r.k] = V[r.k] || []).push(r));
  const se = a => { const m = mean(a); return Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / Math.max(1, a.length - 1) / a.length); };
  console.log(`\nverified on ${NV} fresh seeds (score s ± SE; q = quiet endings):`);
  for (const name of Object.keys(refTeams)) for (const tr of TERR){
    const b = V['B|' + name + '|' + tr].map(x => x.score), h = V['H|' + name + '|' + tr].map(x => x.score);
    const bq = V['B|' + name + '|' + tr].filter(x => x.why === 'quiet').length, hq = V['H|' + name + '|' + tr].filter(x => x.why === 'quiet').length;
    const d = mean(b) - mean(h), dse = Math.sqrt(se(b) ** 2 + se(h) ** 2);
    console.log(`${name.padEnd(17)} ${tr.padEnd(8)} home ${mean(h).toFixed(0).padStart(3)}±${se(h).toFixed(0).padEnd(3)} q${String(hq).padStart(2)}  vs ${best[name + '|' + tr].padEnd(10)} ${mean(b).toFixed(0).padStart(3)}±${se(b).toFixed(0).padEnd(3)} q${String(bq).padStart(2)}  diff ${(d >= 0 ? '+' : '') + d.toFixed(0)}${Math.abs(d) > 2 * dse ? ' *' : ''}`);
  }
  console.log(`total ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})();
