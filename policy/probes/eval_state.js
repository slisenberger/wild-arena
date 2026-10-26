// Independent check of a trained harrier policy on the CURRENT engine: paired fights on a fresh probe draw, three arms
// (heuristic, the hand-written 'patient' rule, the trained best weights, and the shipped harrier weights when present). Usage: node policy/probes/eval_state.js <state.json> [N] [probeIndex]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const P = require(path.join(__dirname, '..', 'move_policy.js')), F = require(path.join(__dirname, '..', 'move_features.js'));
const M = require(path.join(__dirname, '..', 'move_model.js')), R = require(path.join(__dirname, '..', 'move_run.js')), RW = require(path.join(__dirname, '..', 'move_reward.js'));
const ix = Object.fromEntries(F.NAMES.map((n, i) => [n, i]));
if (!isMainThread){
  const base = P.A._internals.moveChoose;
  P.A._internals.moveChoose = (w, u, t, d, Pw, arch) => Pw.rule ? (() => { const x = F.extract(w, u, t, d); return x[ix.guardsBlock] && !x[ix.tBusy] && !x[ix.tEasy] ? 1 : 0; })() : base(w, u, t, d, Pw, arch);
  parentPort.postMessage(workerData.jobs.map(j => ({k: j.k, i: j.i, rec: R.runFight(j.f, j.W, 'harrier')}))); return;
}
const [file, n, idx] = process.argv.slice(2), N = +n || 1200, s = require(path.resolve(file));
const V1 = P.A._internals.LIVE.harrier || null, W = M.unflat(s.P0, s.best.theta, s.config.mode), fights = R.fightSet('probe', +idx || 21, N, {arch: 'harrier', seed: 77}), jobs = [];
fights.forEach((f, i) => { jobs.push({k: 'base', i, f, W: null}, {k: 'patient', i, f, W: {rule: 'patient'}}, {k: 'learned', i, f, W}); if (V1) jobs.push({k: 'v1', i, f, W: V1}); });
Promise.all([0, 1, 2, 3].map(k => new Promise(res => { const w = new Worker(__filename, {workerData: {jobs: jobs.filter((_, q) => q % 4 === k)}}); w.on('message', res); }))).then(p => {
  const A = {}; p.flat().forEach(o => { (A[o.k] = A[o.k] || [])[o.i] = o.rec; });
  const ref = RW.reference(A.base), show = (a, b) => { const q = RW.paired(A[a], A[b], ref); const kills = RW.mean(A[b].map((r, i) => (r.killedYou || 0) - (A[a][i].killedYou || 0))); const hum = RW.mean(A[b].map((r, i) => r.dmgHuman - A[a][i].dmgHuman)), foe = RW.mean(A[b].map((r, i) => r.dmgFoe - A[a][i].dmgFoe)), dth = RW.mean(A[b].map((r, i) => r.deaths - A[a][i].deaths));
    console.log(`${b.padEnd(8)} vs ${a.padEnd(8)} goal ${q.diff >= 0 ? '+' : ''}${q.diff.toFixed(3)} ± ${q.se.toFixed(3)} | style ${q.styleB.style.toFixed(2)} gates [${q.styleB.failed}] drift [${q.driftB.join('; ')}] | kills of you ${(100 * kills).toFixed(1)} pts, dmg to you ${hum.toFixed(1)}, dmg to your side ${foe.toFixed(0)}, own deaths ${dth.toFixed(2)}`); };
  console.log(`${file}: ${N} fresh probe fights (index ${+idx || 21}), current engine`); show('base', 'patient'); show('base', 'learned'); show('patient', 'learned'); if (V1) show('v1', 'learned');
});
