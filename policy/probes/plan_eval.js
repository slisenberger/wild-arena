// planning cats (policy/plan.js) as the game runs them, paired vs today's cats on fresh fights; also CPU ms per fight.
//   node policy/probes/plan_eval.js [N] [H] [cool] [max] [probeIndex]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), os = require('os');
const R = require(path.join(__dirname, '..', 'move_run.js')), RW = require(path.join(__dirname, '..', 'move_reward.js')), PL = require(path.join(__dirname, '..', 'plan.js'));
require(path.join(__dirname, '..', 'live.js')); require(path.join(__dirname, '..', 'policy.js'));
if (!isMainThread){ parentPort.postMessage(workerData.jobs.map(j => { const t0 = Date.now(), W = j.k === 'plan' ? PL.makePlanner(workerData.o) : {kind: 'target-lin', v: 1, nin: 1, margin: .25, wt: new Array(80).fill(0)};
  const r = R.runFight(j.f, W, 'cat'); r.ms = Date.now() - t0; return {k: j.k, i: j.i, rec: r}; })); return; }
const [n, h, cool, max, idx] = process.argv.slice(2), N = +n || 300, o = {H: +h || 8, cool: +cool || 0, max: +max || 3, real: +process.env.REAL || 0}; // REAL=x: the realism-aware teacher
const fights = R.fightSet('probe', +idx || 71, N, {arch: 'cat', seed: 17, withLive: true, goal: 'checkmate', spec: true}), jobs = [];
fights.forEach((f, i) => { jobs.push({k: 'base', i, f}, {k: 'plan', i, f}); });
const T = Math.max(1, Math.min(8, os.cpus().length));
Promise.all([...Array(T).keys()].map(k => new Promise(res => { const w = new Worker(__filename, {workerData: {o, jobs: jobs.filter((_, q) => q % T === k)}}); w.on('message', res); }))).then(p => {
  const D = {}; p.flat().forEach(x => { (D[x.k] = D[x.k] || [])[x.i] = x.rec; });
  const q = RW.paired(D.base, D.plan, RW.reference(D.base)), m = RW.mean, alive = r => r.survived ? 300 : Math.min(300, r.t);
  console.log(`plan.js ${JSON.stringify(o)} vs today's cats, ${N} fresh fights (probe ${+idx || 71}): goal ${q.diff >= 0 ? '+' : ''}${q.diff.toFixed(3)} ± ${q.se.toFixed(3)} | style ${q.styleB.style.toFixed(2)} [${q.styleB.failed}] | you survive ${(100 * m(D.base.map(r => r.survived))).toFixed(1)}% -> ${(100 * m(D.plan.map(r => r.survived))).toFixed(1)}%, ${(m(D.plan.map(alive)) - m(D.base.map(alive))).toFixed(1)} s | CPU per fight ${m(D.base.map(r => r.ms)).toFixed(0)} -> ${m(D.plan.map(r => r.ms)).toFixed(0)} ms`);
});
