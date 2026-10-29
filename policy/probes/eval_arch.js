// Independent check of a trained policy of any archetype on the CURRENT engine: paired fights on a fresh probe draw,
// the other archetypes on their shipped policies (as in training with --withLive), two arms: the heuristic (or the
// shipped weights the run continued from) vs the trained best. Reports the goal and its parts, style/gates/drift, and
// plain outcomes (human survival, time alive). Usage: node policy/probes/eval_arch.js <state.json> [N] [probeIndex]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), os = require('os');
const M = require(path.join(__dirname, '..', 'move_model.js')), R = require(path.join(__dirname, '..', 'move_run.js')), RW = require(path.join(__dirname, '..', 'move_reward.js'));
require(path.join(__dirname, '..', 'live.js'));
if (!isMainThread){ parentPort.postMessage(workerData.jobs.map(j => ({k: j.k, i: j.i, rec: R.runFight(j.f, j.W, workerData.arch)}))); return; }
const [file, n, idx] = process.argv.slice(2), N = +n || 1200, s = require(path.resolve(file)), c = s.config, arch = c.arch;
const W = M.unflat(s.P0, s.best.theta, c.mode), B = c.initWeights && !c.target ? M.unflat(s.P0, s.theta0, c.mode) : /^target-/.test(s.P0.kind) ? {kind: 'target-lin', v: 1, nin: s.P0.nin, margin: .25, wt: new Array(s.P0.nin).fill(0)} : null; // a target scorer's base = zero weights (the heuristic's targets, shipped movement kept)
if (process.env.COMMIT) W.commit = +process.env.COMMIT; // COMMIT=s: hold a learned departure s seconds (policy.js P.commit)
const fights = R.fightSet('probe', +idx || 23, N, {arch, seed: 91, withLive: c.withLive !== false, goal: c.goal, spec: c.spec, withCat: c.only === 'cat'}), jobs = [];
fights.forEach((f, i) => { jobs.push({k: 'base', i, f, W: B}, {k: 'learned', i, f, W}); });
const T = Math.max(1, Math.min(8, os.cpus().length));
Promise.all([...Array(T).keys()].map(k => new Promise(res => { const w = new Worker(__filename, {workerData: {arch, jobs: jobs.filter((_, q) => q % T === k)}}); w.on('message', res); }))).then(p => {
  const A = {}; p.flat().forEach(o => { (A[o.k] = A[o.k] || [])[o.i] = o.rec; });
  const ref = RW.reference(A.base), q = RW.paired(A.base, A.learned, ref), d = f => RW.mean(A.learned.map((r, i) => f(r) - f(A.base[i])));
  const alive = r => r.survived ? 300 : Math.min(300, r.t), parts = Object.keys(RW.goalParts(A.base[0]));
  console.log(`${file}: ${arch}, ${N} fresh probe fights (index ${+idx || 23}), goal ${c.goal || 'per-archetype'}${c.spec ? ' + spec' : ''}, base = ${B ? 'the shipped weights it continued from' : 'heuristic'}`);
  console.log(`  goal ${q.diff >= 0 ? '+' : ''}${q.diff.toFixed(3)} ± ${q.se.toFixed(3)} | parts ${parts.map(k => `${k} ${d(r => RW.goalParts(r)[k]) >= 0 ? '+' : ''}${d(r => RW.goalParts(r)[k]).toFixed(3)}`).join(', ')}`);
  console.log(`  style ${q.styleB.style.toFixed(3)} gates [${q.styleB.failed}] drift [${q.driftB.join('; ')}]`);
  console.log(`  human survival ${(100 * RW.mean(A.base.map(r => r.survived))).toFixed(1)}% -> ${(100 * RW.mean(A.learned.map(r => r.survived))).toFixed(1)}% | time alive ${d(alive) >= 0 ? '+' : ''}${d(alive).toFixed(1)} s | own deaths/fight ${d(r => r.deaths) >= 0 ? '+' : ''}${d(r => r.deaths).toFixed(3)}`);
});
