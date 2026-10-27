// Independent check of a learned target scorer ('target-lin' weights, milestone 4) on the CURRENT engine, from its weights
// file: paired fresh probe fights, every other archetype on its shipped policies (policy/live.js, as in training with
// --withLive), two arms: zero target weights (the heuristic's targets, the archetype's shipped movement kept) vs the weights.
// Reports the goal and its parts, style/gates/drift, and plain outcomes (human survival, time alive) with paired SEs.
// Usage: node policy/probes/eval_target.js <weights.json> <arch> [N] [probeIndex] [seed] [goal] [spec 0|1]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), os = require('os');
const M = require(path.join(__dirname, '..', 'move_model.js')), R = require(path.join(__dirname, '..', 'move_run.js')), RW = require(path.join(__dirname, '..', 'move_reward.js'));
require(path.join(__dirname, '..', 'live.js'));
if (!isMainThread){ parentPort.postMessage(workerData.jobs.map(j => ({k: j.k, i: j.i, rec: R.runFight(j.f, j.W, workerData.arch)}))); return; }
const [file, arch, n, idx, sd, goal, spec] = process.argv.slice(2), N = +n || 1200;
const W = require(path.resolve(file)); if (W.kind !== 'target-lin') throw new Error('not a target-lin weights file');
const B = M.zerosTarget(W.nin, W.margin), G = goal || 'checkmate', SP = spec === undefined ? true : spec === '1';
const fights = R.fightSet('probe', +idx || 71, N, {arch, seed: +sd || 2027, withLive: true, goal: G, spec: SP}), jobs = [];
fights.forEach((f, i) => { jobs.push({k: 'base', i, f, W: B}, {k: 'learned', i, f, W}); });
const T = Math.max(1, Math.min(8, os.cpus().length));
Promise.all([...Array(T).keys()].map(k => new Promise(res => { const w = new Worker(__filename, {workerData: {arch, jobs: jobs.filter((_, q) => q % T === k)}}); w.on('message', res); }))).then(p => {
  const A = {}; p.flat().forEach(o => { (A[o.k] = A[o.k] || [])[o.i] = o.rec; });
  const ref = RW.reference(A.base), q = RW.paired(A.base, A.learned, ref);
  const pd = f => { const d = A.learned.map((r, i) => f(r) - f(A.base[i])), m = RW.mean(d), sd = Math.sqrt(RW.mean(d.map(x => (x - m) ** 2)) * d.length / (d.length - 1)); return [m, sd / Math.sqrt(d.length)]; };
  const fmt = ([m, se], k) => `${m >= 0 ? '+' : ''}${m.toFixed(k)} ± ${se.toFixed(k)}`;
  const alive = r => r.survived ? 300 : Math.min(300, r.t), parts = Object.keys(RW.goalParts(A.base[0]));
  const dev = A.learned.map(r => r.intents || [0, 0]), nd = dev.reduce((a, x) => a + x[0] + x[1], 0), nv = dev.reduce((a, x) => a + x[1], 0);
  console.log(`${file}: ${arch}, ${N} fresh probe fights (index ${+idx || 71}, seed ${+sd || 2027}), goal ${G}${SP ? ' + spec' : ''}, base = zero target weights (the heuristic's targets)`);
  console.log(`  goal ${q.diff >= 0 ? '+' : ''}${q.diff.toFixed(3)} ± ${q.se.toFixed(3)} | parts ${parts.map(k => `${k} ${fmt(pd(r => RW.goalParts(r)[k]), 3)}`).join(', ')}`);
  console.log(`  style ${q.styleB.style.toFixed(3)} gates [${q.styleB.failed}] drift [${q.driftB.join('; ')}]`);
  console.log(`  human survival ${(100 * RW.mean(A.base.map(r => r.survived))).toFixed(1)}% -> ${(100 * RW.mean(A.learned.map(r => r.survived))).toFixed(1)}% (${fmt(pd(r => 100 * r.survived), 1)} pts) | time alive ${fmt(pd(alive), 1)} s | own deaths/fight ${fmt(pd(r => r.deaths), 3)}`);
  console.log(`  target decisions: ${nd}, deviated from the heuristic ${(100 * nv / Math.max(1, nd)).toFixed(1)}%`);
});
