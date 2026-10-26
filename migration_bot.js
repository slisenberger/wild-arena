// Migration balance probe: a greedy bot plays N runs (buys the most valuable animal it can afford, by MEASURED swing,
// until nothing fits; never sells; takes the first boon offered). Reports how many fights runs survive.
// node migration_bot.js [runs=200] [workers=3] [seed0=1]   (env overrides of MIG constants: MIG='{"BONUS":200}')
const {Worker, isMainThread, parentPort, workerData} = require('worker_threads');
if (isMainThread){
  const N = +process.argv[2] || 200, NW = +process.argv[3] || 3, S0 = +process.argv[4] || 1;
  const out = []; let done = 0;
  const t0 = Date.now();
  for (let k = 0; k < NW; k++){
    const seeds = []; for (let i = k; i < N; i += NW) seeds.push(S0 + i);
    const wk = new Worker(__filename, {workerData: {seeds, mig: process.env.MIG || '{}'}});
    wk.on('message', m => out.push(m));
    wk.on('exit', () => { if (++done === NW) report(out, t0); });
  }
} else {
  const M = require('./migration.js'), A = require('./sim.js');
  Object.assign(M.MIG, JSON.parse(workerData.mig));
  const val = id => { const m = A.MEASURED[id]; return m ? m.mine - m.theirs : 0; };
  for (const seed of workerData.seeds){
    const run = M.newRun(seed);
    const fights = [];
    while (!run.over){
      if (run.boonOffer) M.pickBoon(run, run.boonOffer[0]);
      for (;;){ // greedy: the most valuable thing it can still afford
        const c = run.board.filter(id => M.canBuy(run, id)).sort((a, b) => val(b) - val(a) || A.BY_ID[b].price - A.BY_ID[a].price);
        if (!c.length) break; M.buy(run, c[0]);
      }
      const w = A.simulate(M.cfgFor(run));
      const e = M.applyResult(run, w);
      fights.push({k: e.k, t: e.t, survived: e.survived, earned: e.earned, money: run.money, teamN: run.team.length, hp: run.hp, down: e.down, kind: e.kind, terrain: e.terrain});
    }
    parentPort.postMessage({seed, survived: run.survived, total: run.total, won: run.won, fights});
  }
}
function report(out, t0){
  const N = out.length, hist = Array(8).fill(0);
  for (const r of out) hist[r.survived]++;
  const pct = x => (100 * x / N).toFixed(1) + '%';
  console.log(`${N} runs in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  console.log('fights survived: ' + hist.map((n, i) => `${i}:${n}`).join('  '));
  const reach = k => out.filter(r => r.survived >= k).length;
  console.log('reached fight k (survived k-1): ' + [1,2,3,4,5,6,7].map(k => `${k}:${pct(reach(k - 1))}`).join('  ') + `  won:${pct(reach(7))}`);
  const sv = out.map(r => r.survived).sort((a, b) => a - b), mean = sv.reduce((a, b) => a + b, 0) / N;
  console.log(`mean fights survived ${mean.toFixed(2)}, median ${sv[N >> 1]}, p75 ${sv[Math.floor(N * .75)]}, p90 ${sv[Math.floor(N * .9)]}`);
  // per fight: death rate among runs that reached it, money after it, team size
  for (let k = 0; k < 7; k++){
    const f = out.map(r => r.fights[k]).filter(Boolean); if (!f.length) continue;
    const d = f.filter(x => !x.survived).length, ok = f.filter(x => x.survived);
    const avg = (a, g) => a.length ? (a.reduce((s, x) => s + g(x), 0) / a.length) : 0;
    console.log(`fight ${k + 1} (${f[0].kind}): ${f.length} played, death rate ${(100 * d / f.length).toFixed(0)}%, earned $${avg(ok, x => x.earned).toFixed(0)}, money after $${avg(ok, x => x.money).toFixed(0)}, team ${avg(ok, x => x.teamN).toFixed(1)}, your hp ${(100 * avg(ok, x => x.hp)).toFixed(0)}%, time ${avg(f, x => x.t).toFixed(0)} s`);
  }
}
