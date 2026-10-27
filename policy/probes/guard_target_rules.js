// Milestone 4: YOUR cats' target choice. Hand-set 'target-lin' rules over guard_features.js, applied only to your big cats
// (P.only 'cat'; your other guards keep today's targets), paired vs the heuristic on fresh fights where your team has a cat,
// every shipped policy live (guard_v1 movement and its intents kept; the chooser re-judges their targets). Reports the guard
// goal, your survival / time alive, and your cats' deaths and damage. RULES='{"name":{feature:w}}' replaces the list.
//   node policy/probes/guard_target_rules.js [N] [probeIndex]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), os = require('os');
const R = require(path.join(__dirname, '..', 'move_run.js')), RW = require(path.join(__dirname, '..', 'move_reward.js')), G = require(path.join(__dirname, '..', 'guard_features.js'));
require(path.join(__dirname, '..', 'live.js'));
if (!isMainThread){ parentPort.postMessage(workerData.jobs.map(j => ({k: j.k, i: j.i, rec: R.runFight(j.f, j.W, 'guard')}))); return; }
const [n, idx] = process.argv.slice(2), N = +n || 600;
const W = o => { const wt = new Array(G.DIM).fill(0); for (const [k, v] of Object.entries(o)){ const i = G.NAMES.indexOf(k); if (i < 0) throw new Error('no feature ' + k); wt[i] = v; } return {kind: 'target-lin', v: 1, nin: G.DIM, margin: .25, wt, only: 'cat'}; };
let RULES = {
  zero: {}, catOnPred: {catOnPred: 1}, noGiants: {logMassRatio: -1, isTarget: 1}, noGiants2: {logMassRatio: -2, isTarget: 2},
  onYou: {onHuman: 1, comingHuman: .5}, predOrYou: {catOnPred: 1, onHuman: 1, comingHuman: .5}, weaker: {logStrVsSelf: -1, isTarget: 1},
  sensible: {catOnPred: .7, onHuman: .7, comingHuman: .4, logMassRatio: -.7, isTarget: .7}, stayHome: {isNone: 1},
};
if (process.env.RULES) RULES = JSON.parse(process.env.RULES);
// fights where your team has a big cat: draw extra and keep those
const isCat = id => { const s = R.A.ANIMALS.find(a => a.id === id); return !!(s && s.pred && s.latch); };
const all = R.fightSet('probe', +idx || 61, 3 * N, {arch: 'guard', seed: 13, withLive: true}), fights = all.filter(f => f.team.some(isCat)).slice(0, N), jobs = [];
const FILES = (process.env.WFILES || '').split(',').filter(Boolean); // WFILES=a.json,b.json: also run these weights files (as they are: all guards unless the file says only)
for (const p of FILES){ const k = path.basename(p, '.json'); RULES[k] = null; }
fights.forEach((f, i) => { for (const r of Object.keys(RULES)) jobs.push({k: r, i, f, W: RULES[r] ? W(RULES[r]) : RULES[r] === null ? (({meta, ...x}) => x)(require(path.resolve(FILES.find(p => path.basename(p, '.json') === r)))) : W({})}); });
const T = Math.max(1, Math.min(8, os.cpus().length));
Promise.all([...Array(T).keys()].map(k => new Promise(res => { const w = new Worker(__filename, {workerData: {jobs: jobs.filter((_, q) => q % T === k)}}); w.on('message', res); }))).then(p => {
  const A = {}; p.flat().forEach(o => { (A[o.k] = A[o.k] || [])[o.i] = o.rec; });
  const B = A.zero, ref = RW.reference(B), alive = r => r.survived ? 300 : Math.min(300, r.t), m = RW.mean;
  const cd = X => m(X.map(r => r.catDeaths)) / Math.max(1e-9, m(X.map(r => r.catN))), cdl = X => m(X.map(r => r.catDealt));
  console.log(`your cats' target choice: ${fights.length} fresh fights with your cat (probe ${+idx || 61}); heuristic: you survive ${(100 * m(B.map(r => r.survived))).toFixed(1)}%, your cats die ${(100 * cd(B)).toFixed(0)}%, deal ${cdl(B).toFixed(0)}/fight`);
  for (const r of Object.keys(RULES)){ if (r === 'zero') continue;
    const q = RW.paired(B, A[r], ref), X = A[r], dev = m(X.map(x => (x.intents[1] || 0) / Math.max(1, x.intents[0] + x.intents[1])));
    const dt = m(X.map((x, i) => alive(x) - alive(B[i]))), ds = m(X.map(x => x.survived)) - m(B.map(x => x.survived));
    console.log(`  ${r.padEnd(11)} goal ${q.diff >= 0 ? '+' : ''}${q.diff.toFixed(3)} ± ${q.se.toFixed(3)}${Math.abs(q.diff) > 2 * q.se ? ' *' : '  '} | you survive ${ds >= 0 ? '+' : ''}${(100 * ds).toFixed(1)} pts, alive ${dt >= 0 ? '+' : ''}${dt.toFixed(1)} s | cats die ${(100 * cd(X)).toFixed(0)}%, deal ${cdl(X).toFixed(0)} | deviates ${(100 * dev).toFixed(0)}% | style ${q.styleB.style.toFixed(2)} [${q.styleB.failed}]`);
  }
});
