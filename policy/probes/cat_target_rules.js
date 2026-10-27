// Milestone 4: where is the cats' headroom in target choice? (1) how many real options a cat has per decision; (2) hand-set
// 'target-lin' rules (weights on named features, margin .25: a weight of 1 overrides the heuristic) vs the heuristic, paired on
// fresh fights with every shipped policy live (cat_v1 movement kept). Usage: node policy/probes/cat_target_rules.js [N] [probeIndex] [arch]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), os = require('os');
const R = require(path.join(__dirname, '..', 'move_run.js')), RW = require(path.join(__dirname, '..', 'move_reward.js')), F = require(path.join(__dirname, '..', 'features.js'));
require(path.join(__dirname, '..', 'live.js'));
if (!isMainThread){ parentPort.postMessage(workerData.jobs.map(j => { const r = R.runFight(j.f, j.W, workerData.arch); if (r.trace) r.trace = r.trace.map(d => d.X.length); return {k: j.k, i: j.i, rec: r}; })); return; }
const [n, idx, a] = process.argv.slice(2), N = +n || 600, arch = a || 'cat';
const W = (o, extra) => { const wt = new Array(F.DIM).fill(0); for (const [k, v] of Object.entries(o)){ const i = F.NAMES.indexOf(k); if (i < 0) throw new Error('no feature ' + k); wt[i] = v; } return Object.assign({kind: 'target-lin', v: 1, nin: F.DIM, margin: .25, wt}, extra || {}); };
// every rule only re-ranks targets: a target-only feature with a negative weight gets an isTarget offset so targets don't fall below
// 'none' (a first version without it mostly meant 'hold back': -0.19 to -0.27, cats idle)
const RULES = {
  busy: {busyElsewhere: 1}, mount: {isMount: 1}, human: {isHuman: 1}, beatable: {logStrVsSelf: -1, isTarget: 1}, hurt: {hpFrac: -1, isTarget: 1},
  unguarded: {guardLog: -1, isTarget: 1}, close: {dist: -2, isTarget: 2}, opportunist: {busyElsewhere: .5, logStrVsSelf: -.5, hpFrac: -.5, guardLog: -.5, isTarget: 1},
  chargerLike: {visible: .3, heatstroke: .3, isHuman: .3, fleeing: -.3, busyElsewhere: .3, guardLog: -.3, dist: -.3, isTarget: .6}, // the charger winner's top weights
  bigGame: {logMassRatio: 1, isTarget: 1}, smallGame: {logMassRatio: -1, isTarget: 1}, notFleeing: {fleeing: -1, isTarget: 1}, engageMore: {isTarget: .3},
};
if (process.env.RULES) { const o = JSON.parse(process.env.RULES); for (const k of Object.keys(RULES)) delete RULES[k]; Object.assign(RULES, o); } // RULES='{"name":{feature:w}}' replaces the list
const fights = R.fightSet('probe', +idx || 31, N, {arch, seed: 77, withLive: true, goal: 'checkmate', spec: true}), jobs = [];
fights.forEach((f, i) => { jobs.push({k: 'base', i, f, W: W({})}); if (i < 200) jobs.push({k: 'count', i, f, W: W({}, {sample: true, tau: 1e-6})}); for (const r of Object.keys(RULES)) jobs.push({k: r, i, f, W: W(RULES[r])}); });
const T = Math.max(1, Math.min(8, os.cpus().length));
Promise.all([...Array(T).keys()].map(k => new Promise(res => { const w = new Worker(__filename, {workerData: {arch, jobs: jobs.filter((_, q) => q % T === k)}}); w.on('message', res); }))).then(p => {
  const A = {}; p.flat().forEach(o => { (A[o.k] = A[o.k] || [])[o.i] = o.rec; });
  const cnt = A.count.filter(Boolean).flatMap(r => r.trace || []), multi = cnt.filter(c => c >= 3).length; // options incl. 'none' (and feed): >= 3 = a real choice between 2+ targets
  console.log(`${arch}: ${N} fresh fights (probe ${+idx || 31}); decisions/fight ${(cnt.length / 200).toFixed(1)}, options/decision ${RW.mean(cnt).toFixed(2)}, with 2+ targets ${(100 * multi / cnt.length).toFixed(0)}%`);
  const ref = RW.reference(A.base), alive = r => r.survived ? 300 : Math.min(300, r.t);
  for (const r of Object.keys(RULES)){
    const q = RW.paired(A.base, A[r], ref), dev = RW.mean(A[r].map(x => (x.intents[1] || 0) / Math.max(1, x.intents[0] + x.intents[1])));
    const dt = RW.mean(A[r].map((x, i) => alive(x) - alive(A.base[i]))), ds = RW.mean(A[r].map(x => x.survived)) - RW.mean(A.base.map(x => x.survived));
    console.log(`  ${r.padEnd(13)} ${q.diff >= 0 ? '+' : ''}${q.diff.toFixed(3)} ± ${q.se.toFixed(3)}${Math.abs(q.diff) > 2 * q.se ? ' *' : '  '} | deviates ${(100 * dev).toFixed(0)}% | human survival ${ds >= 0 ? '+' : ''}${(100 * ds).toFixed(1)} pts, time alive ${dt >= 0 ? '+' : ''}${dt.toFixed(1)} s | style ${q.styleB.style.toFixed(2)} [${q.styleB.failed}]`);
  }
});
