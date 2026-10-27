// Progressive mode: what a level is worth, by paired experiment (like price_abs.js). For each catalog item X and each of
// N random base boards with a random 3-animal base team plus X on your side: the same seed with X at level 0 and at
// level L (cfg.levels). gain = score(L) − score(0) ± paired SE; also X absent and X on their side, so the gain can be read
// against X's swing (mine − theirs) measured in the same fights.
// Usage: node level_abs.js [N per item=120] [level=3] [ids,comma (default: all)] [out.json]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const A = require(process.env.SIM || './sim.js');
const run = j => A.simulate({team: j.team, board: j.board, terrain: j.tr, mode: 'wild', mount: A.defaultMount(j.team), seed: j.seed, levels: j.lv ? {[j.x]: j.lv} : undefined}).result.score;
if (!isMainThread){ parentPort.postMessage(workerData.jobs.map(j => ({k: j.k, i: j.i, s: run(j)}))); return; }
const N = +process.argv[2] || 120, LV = +process.argv[3] || 3, OUT = process.argv[5], TERR = Object.keys(A.TERRAINS), NW = 4;
const IDS = process.argv[4] ? process.argv[4].split(',') : A.ANIMALS.map(a => a.id), sp = id => A.BY_ID[id].species || id;
const jobs = [];
for (const x of IDS) for (let i = 0; i < N; i++){
  const tr = TERR[i % 4], R = A.rng(i * 104729 + 17);
  if (A.BY_ID[x].cold < .3 && A.TERRAINS[tr].cold) continue;
  const base = A.dealBoard(i * 7919 + 5, {terrain: tr}).filter(id => sp(id) !== sp(x)).slice(0, 11);
  const order = base.slice(); for (let k = order.length - 1; k > 0; k--){ const q = Math.floor(R() * (k + 1)); [order[k], order[q]] = [order[q], order[k]]; }
  const team = order.slice(0, 3), seed = 1000 + i, board = base.concat([x]);
  jobs.push({k: x + '|0', i, x, team: team.concat([x]), board, tr, seed}, {k: x + '|L', i, x, lv: LV, team: team.concat([x]), board, tr, seed},
    {k: x + '|theirs', i, x, team, board, tr, seed});
}
const t0 = Date.now();
Promise.all([...Array(NW).keys()].map(wi => new Promise(res => { const w = new Worker(__filename, {workerData: {jobs: jobs.filter((_, i) => i % NW === wi)}}); w.on('message', res); }))).then(p => {
  const M = {}; p.flat().forEach(o => { (M[o.k] = M[o.k] || {})[o.i] = o.s; });
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length, se = a => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1) / a.length); };
  console.log(`level_abs: ${jobs.length} fights in ${((Date.now() - t0) / 1000).toFixed(0)} s, level ${LV} vs 0, ${N} boards per item`);
  console.log('item            gain ± SE    swing ± SE   gain/swing');
  const res = {}; let G = [], S = [];
  for (const x of IDS){
    const ix = Object.keys(M[x + '|0'] || {}); if (!ix.length) continue;
    const g = ix.map(i => M[x + '|L'][i] - M[x + '|0'][i]), s = ix.map(i => M[x + '|0'][i] - M[x + '|theirs'][i]);
    res[x] = {gain: +mean(g).toFixed(1), se: +se(g).toFixed(1), swing: +mean(s).toFixed(1), seSwing: +se(s).toFixed(1)};
    G = G.concat(g); S = S.concat(s);
    console.log(`${x.padEnd(14)} ${mean(g).toFixed(1).padStart(6)} ± ${se(g).toFixed(1).padEnd(5)} ${mean(s).toFixed(1).padStart(6)} ± ${se(s).toFixed(1).padEnd(5)} ${(100 * mean(g) / Math.max(1, mean(s))).toFixed(0).padStart(5)}%`);
  }
  console.log(`all items: gain ${mean(G).toFixed(2)} ± ${se(G).toFixed(2)} s, swing ${mean(S).toFixed(1)} s, pooled gain/swing ${(100 * mean(G) / mean(S)).toFixed(0)}%`);
  if (OUT) require('fs').writeFileSync(OUT, JSON.stringify(res, null, 1));
});
