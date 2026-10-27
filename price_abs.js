// Board-mode value by controlled experiment (replaces the regression in price_board.js, which was biased: with
// player-like budget fills, "cheap animal left on their side" mostly means "you bought big animals", so cheap
// animals looked harmful). For each catalog item X and each of N random base boards (11 animals, X's species
// excluded) with a random 3-animal base team: run the same seed with X absent, X on your side, X on theirs.
// swing = mine − theirs (seconds of survival gained by moving X across). Paired differences give the SE.
// Usage: node price_abs.js [N per item] [out.json] [ids,comma,separated (default: all)]; env BASE=<$> = budget-fill base teams
// detail per item also has seMine/seTheirs and asym = mine - |theirs| (± seAsym): how far "Helps" and "Threat" disagree.
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const SIM = process.env.SIM || './sim.js';
const A = require(SIM);
if (!isMainThread){ parentPort.postMessage(workerData.jobs.map(j => ({k: j.k, i: j.i, s: A.simulate({team: j.team, board: j.board, terrain: j.tr, mode: 'wild', mount: A.defaultMount(j.team), seed: j.seed}).result.score}))); return; }
const BASE = +process.env.BASE || 0, N = +process.argv[2] || 240, OUT = process.argv[3], TERR = Object.keys(A.TERRAINS), NW = 4;
const IDS = process.argv[4] ? process.argv[4].split(',') : A.ANIMALS.map(a => a.id), sp = id => A.BY_ID[id].species || id;
const jobs = [];
for (const x of IDS) for (let i = 0; i < N; i++){
  const tr = TERR[i % 4], R = A.rng(i * 104729 + 17);
  if (A.dealsOn ? !A.ANIMALS.some(a => (a.id === x || a.species === x) && A.dealsOn(a.id, tr)) : A.BY_ID[x].cold < .3 && A.TERRAINS[tr].cold) continue; // never dealt there (cold-blooded on the tundra, habitat); a lone form never dealt is measured where its group goes
  const base = A.dealBoard(i * 7919 + 5, {terrain: tr}).filter(id => sp(id) !== sp(x)).slice(0, 11);
  const order = base.slice(); for (let k = order.length - 1; k > 0; k--){ const q = Math.floor(R() * (k + 1)); [order[k], order[q]] = [order[q], order[k]]; }
  // base team: 3 random board animals (default), or with env BASE=<budget> a budget fill up to that many dollars (a team of
  // typical strength, so X has headroom both ways: with 3-animal teams you last ~60 s, so 'theirs' can't fall below -60)
  let team = order.slice(0, 3); const seed = 1000 + i;
  if (BASE){ team = []; let left = BASE; for (const id of order) if (A.BY_ID[id].price <= left){ team.push(id); left -= A.BY_ID[id].price; } }
  jobs.push({k: x + '|absent', i, team, board: base, tr, seed}, {k: x + '|mine', i, team: team.concat([x]), board: base.concat([x]), tr, seed}, {k: x + '|theirs', i, team, board: base.concat([x]), tr, seed});
}
const t0 = Date.now();
Promise.all([...Array(NW).keys()].map(wi => new Promise(res => { const w = new Worker(__filename, {workerData: {jobs: jobs.filter((_, i) => i % NW === wi)}}); w.on('message', res); }))).then(p => {
  const M = {}; p.flat().forEach(o => { (M[o.k] = M[o.k] || {})[o.i] = o.s; });
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length, se = a => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1) / a.length); };
  const res = {};
  { const ab = []; for (const x of IDS) for (const i of Object.keys(M[x + '|absent'] || {})) ab.push(M[x + '|absent'][i]); console.log(`base teams (${BASE ? 'budget fill $' + BASE : '3 random animals'}): mean score without X ${mean(ab).toFixed(0)} s`); }
  console.log(`price_abs: ${jobs.length} fights in ${((Date.now() - t0) / 1000).toFixed(0)}s (${N} boards per item, ${BASE ? "budget-fill $" + BASE : "random 3-animal"} base teams)`);
  console.log('item         price   mine vs absent   theirs vs absent   swing ± SE   | sav  riv  for  tun');
  for (const x of IDS){
    const ix = Object.keys(M[x + '|absent'] || {}); if (!ix.length) continue;
    const mi = ix.map(i => M[x + '|mine'][i] - M[x + '|absent'][i]), th = ix.map(i => M[x + '|theirs'][i] - M[x + '|absent'][i]), sw = ix.map(i => M[x + '|mine'][i] - M[x + '|theirs'][i]);
    const as = ix.map(i => M[x + '|mine'][i] + M[x + '|theirs'][i] - 2 * M[x + '|absent'][i]); // mismatch: mine − |theirs|
    res[x] = {swing: +mean(sw).toFixed(1), se: +se(sw).toFixed(1), mine: +mean(mi).toFixed(1), theirs: +mean(th).toFixed(1), seMine: +se(mi).toFixed(1), seTheirs: +se(th).toFixed(1), asym: +mean(as).toFixed(1), seAsym: +se(as).toFixed(1)};
  }
  Object.entries(res).sort((a, b) => b[1].swing - a[1].swing).forEach(([x, r]) => {
    const ix = Object.keys(M[x + '|absent']);
    const pm = TERR.map((tr, t) => { const s = ix.filter(i => i % 4 === t).map(i => M[x + '|mine'][i] - M[x + '|theirs'][i]); return s.length ? mean(s).toFixed(0).padStart(4) : '   -'; }).join(' ');
    console.log(`${x.padEnd(12)} $${String(A.BY_ID[x].price).padEnd(5)} ${(r.mine >= 0 ? '+' : '') + r.mine.toFixed(0)}`.padEnd(36) + `${(r.theirs >= 0 ? '+' : '') + r.theirs.toFixed(0)}`.padEnd(19) + `${r.swing.toFixed(0).padStart(5)} ± ${r.se.toFixed(0).padEnd(4)} | ${pm}`);
  });
  if (OUT) require('fs').writeFileSync(OUT, JSON.stringify({N, swing: Object.fromEntries(Object.entries(res).map(([k, r]) => [k, r.swing])), detail: res}, null, 1));
});
