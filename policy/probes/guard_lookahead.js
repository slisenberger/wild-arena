// Milestone 4 headroom test for YOUR side: how much better could your big cats do (or all your guards, ONLY=all) with better
// target choices? At each decision with 2+ targets, copy the fight, play each option (today's pick + up to 3 nearest others)
// for H s with that animal holding the target, each copy rolling its own dice, and take the best for your side (plan.js,
// side 'P'). Paired vs today on fresh fights where your team has a cat. Usage: node policy/probes/guard_lookahead.js [N] [H] [probeIndex]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), os = require('os');
const R = require(path.join(__dirname, '..', 'move_run.js')), RW = require(path.join(__dirname, '..', 'move_reward.js')), PL = require(path.join(__dirname, '..', 'plan.js'));
require(path.join(__dirname, '..', 'live.js')); require(path.join(__dirname, '..', 'policy.js'));
const only = process.env.ONLY === 'all' ? null : 'cat';
if (!isMainThread){ parentPort.postMessage(workerData.jobs.map(j => { const t0 = Date.now();
  const W = j.k === 'look' ? PL.makePlanner({arch: 'guard', side: 'P', only, wide: true, H: workerData.H, cool: 0}) : {kind: 'target-lin', v: 1, nin: 200, margin: .25, wt: new Array(200).fill(0), only};
  const r = R.runFight(j.f, W, 'guard'); r.ms = Date.now() - t0; if (j.k === 'look') r.look = {n: W.n, b: W.branched, c: W.changed}; return {k: j.k, i: j.i, rec: r}; })); return; }
const [n, h, idx] = process.argv.slice(2), N = +n || 200, H = +h || 8;
const fights = R.fightSet('probe', +idx || 65, N, {arch: 'guard', seed: 13, withLive: true, withCat: true}), jobs = [];
fights.forEach((f, i) => { jobs.push({k: 'base', i, f}, {k: 'look', i, f}); });
const T = Math.max(1, Math.min(8, os.cpus().length));
Promise.all([...Array(T).keys()].map(k => new Promise(res => { const w = new Worker(__filename, {workerData: {H, jobs: jobs.filter((_, q) => q % T === k)}}); w.on('message', res); }))).then(p => {
  const D = {}; p.flat().forEach(x => { (D[x.k] = D[x.k] || [])[x.i] = x.rec; });
  const q = RW.paired(D.base, D.look, RW.reference(D.base)), m = RW.mean, alive = r => r.survived ? 300 : Math.min(300, r.t);
  const cd = X => m(X.map(r => r.catDeaths)) / Math.max(1e-9, m(X.map(r => r.catN))), lk = D.look.reduce((a, r) => ({n: a.n + r.look.n, b: a.b + r.look.b, c: a.c + r.look.c}), {n: 0, b: 0, c: 0});
  console.log(`your ${only ? 'cats' : 'guards'}, lookahead ${H} s (own dice) vs today, ${N} fresh fights with your cat (probe ${+idx || 65}):`);
  console.log(`  goal ${q.diff >= 0 ? '+' : ''}${q.diff.toFixed(3)} ± ${q.se.toFixed(3)} | style ${q.styleB.style.toFixed(2)} [${q.styleB.failed}] drift [${q.driftB.join('; ')}]`);
  console.log(`  you survive ${(100 * m(D.base.map(r => r.survived))).toFixed(1)}% -> ${(100 * m(D.look.map(r => r.survived))).toFixed(1)}%, time alive ${(m(D.look.map(alive)) - m(D.base.map(alive))).toFixed(1)} s | your cats die ${(100 * cd(D.base)).toFixed(0)}% -> ${(100 * cd(D.look)).toFixed(0)}%, deal ${m(D.base.map(r => r.catDealt)).toFixed(0)} -> ${m(D.look.map(r => r.catDealt)).toFixed(0)} | CPU ${m(D.base.map(r => r.ms)).toFixed(0)} -> ${m(D.look.map(r => r.ms)).toFixed(0)} ms`);
  console.log(`  decisions ${lk.n}, with 2+ targets ${lk.b}, lookahead changed the pick ${lk.c} (${(100 * lk.c / Math.max(1, lk.b)).toFixed(0)}%)`);
});
