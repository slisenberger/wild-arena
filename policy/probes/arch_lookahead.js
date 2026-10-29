// Milestone 4 headroom test for any enemy archetype: its target choice by the fair lookahead (plan.js, own dice per branch,
// H s, cool 0) vs today's, paired on fresh fights. Usage: node policy/probes/arch_lookahead.js <arch> [N] [H] [probeIndex]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), os = require('os');
const R = require(path.join(__dirname, '..', 'move_run.js')), RW = require(path.join(__dirname, '..', 'move_reward.js')), PL = require(path.join(__dirname, '..', 'plan.js'));
require(path.join(__dirname, '..', 'live.js')); require(path.join(__dirname, '..', 'policy.js'));
if (!isMainThread){ const {arch, H} = workerData; parentPort.postMessage(workerData.jobs.map(j => { const t0 = Date.now();
  const W = j.k === 'look' ? PL.makePlanner({arch, side: 'E', H, cool: 0}) : {kind: 'target-lin', v: 1, nin: 200, margin: .25, wt: new Array(200).fill(0)};
  const r = R.runFight(j.f, W, arch); r.ms = Date.now() - t0; if (j.k === 'look') r.look = {n: W.n, b: W.branched, c: W.changed}; return {k: j.k, i: j.i, rec: r}; })); return; }
const [arch, n, h, idx] = process.argv.slice(2), N = +n || 300, H = +h || 8;
const fights = R.fightSet('probe', +idx || 71, N, {arch, seed: 17, withLive: true, goal: 'checkmate', spec: true}), jobs = [];
fights.forEach((f, i) => { jobs.push({k: 'base', i, f}, {k: 'look', i, f}); });
const T = Math.max(1, Math.min(8, os.cpus().length));
Promise.all([...Array(T).keys()].map(k => new Promise(res => { const w = new Worker(__filename, {workerData: {arch, H, jobs: jobs.filter((_, q) => q % T === k)}}); w.on('message', res); }))).then(p => {
  const D = {}; p.flat().forEach(x => { (D[x.k] = D[x.k] || [])[x.i] = x.rec; });
  const q = RW.paired(D.base, D.look, RW.reference(D.base)), m = RW.mean, alive = r => r.survived ? 300 : Math.min(300, r.t);
  const lk = D.look.reduce((a, r) => ({n: a.n + r.look.n, b: a.b + r.look.b, c: a.c + r.look.c}), {n: 0, b: 0, c: 0});
  console.log(`enemy ${arch}: lookahead ${H} s (own dice) vs today, ${N} fresh fights (probe ${+idx || 71}): goal ${q.diff >= 0 ? '+' : ''}${q.diff.toFixed(3)} ± ${q.se.toFixed(3)} | style ${q.styleB.style.toFixed(2)} [${q.styleB.failed}] | you survive ${(100 * m(D.base.map(r => r.survived))).toFixed(1)}% -> ${(100 * m(D.look.map(r => r.survived))).toFixed(1)}%, ${(m(D.look.map(alive)) - m(D.base.map(alive))).toFixed(1)} s | decisions with 2+ targets ${lk.b}, changed ${(100 * lk.c / Math.max(1, lk.b)).toFixed(0)}% | CPU ${m(D.base.map(r => r.ms)).toFixed(0)} -> ${m(D.look.map(r => r.ms)).toFixed(0)} ms`);
});
