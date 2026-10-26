// Milestone 3 headroom probe: do simple hand-written CONDITIONAL intent rules for the other side's harriers beat the
// heuristic? If one does, there is something for a learner to find; if none does, the intent set lacks leverage.
// Usage: node policy/probes/harrier_rules.js [fightsPerRule] [rules,comma]   (paired: every rule vs no policy, same fights)
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const P = require(path.join(__dirname, '..', 'move_policy.js')), F = require(path.join(__dirname, '..', 'move_features.js'));
const R = require(path.join(__dirname, '..', 'move_run.js')), RW = require(path.join(__dirname, '..', 'move_reward.js'));
const I = P.A._internals, ix = Object.fromEntries(F.NAMES.map((n, i) => [n, i])), [COMMIT, WAIT, FLANK, REGROUP, DISENGAGE] = [0, 1, 2, 3, 4];
const RULES = {
  patient:   x => x[ix.guardsBlock] && !x[ix.tBusy] && !x[ix.tEasy] ? WAIT : COMMIT,               // wait out stronger guards
  flankBusy: x => x[ix.tBusy] && !x[ix.tEasy] ? FLANK : COMMIT,                                   // hit a busy target from behind
  packUp:    x => x[ix.matesAlive] > .34 && x[ix.mates15] === 0 && !x[ix.tEasy] ? REGROUP : COMMIT, // don't go in alone
  hitRun:    x => x[ix.hp] < .5 && x[ix.attackersOnMe] > 0 ? DISENGAGE : COMMIT,                  // break off when hurt and mobbed
  humanOnly: x => !x[ix.tHuman] && !x[ix.tEasy] && x[ix.guardsBlock] ? WAIT : COMMIT,             // circle until the human is open
  patient2:  x => (x[ix.guardsBlock] || x[ix.guardLog] > .5) && !x[ix.tBusy] && !x[ix.tEasy] ? WAIT : COMMIT,       // wait even when guards merely deter
  patientPack: x => x[ix.guardsBlock] && !x[ix.tBusy] && !x[ix.tEasy] ? (x[ix.matesAlive] > .34 && x[ix.mates15] === 0 ? REGROUP : WAIT) : COMMIT,
  combo:     x => x[ix.tEasy] ? COMMIT : x[ix.guardsBlock] && !x[ix.tBusy] ? WAIT : x[ix.matesAlive] > .34 && x[ix.mates15] === 0 ? REGROUP : x[ix.tBusy] ? FLANK : COMMIT,
};
if (!isMainThread){
  I.moveChoose = (w, u, t, d, Pw) => RULES[Pw.rule](F.extract(w, u, t, d));
  parentPort.postMessage(workerData.jobs.map(j => ({k: j.k, i: j.i, rec: R.runFight(j.f, j.rule ? {rule: j.rule} : null, 'harrier')}))); return;
}
const N = +process.argv[2] || 800, names = process.argv[3] ? process.argv[3].split(',') : Object.keys(RULES);
const IDX = +process.env.IDX || 7, fights = R.fightSet('probe', IDX, N, {arch: 'harrier', seed: 26}), jobs = [];
fights.forEach((f, i) => { jobs.push({k: 'base', i, f}); for (const r of names) jobs.push({k: r, i, f, rule: r}); });
const t0 = Date.now();
Promise.all([0, 1, 2, 3].map(k => new Promise(res => { const w = new Worker(__filename, {workerData: {jobs: jobs.filter((_, q) => q % 4 === k)}}); w.on('message', res); }))).then(p => {
  const M = {}; p.flat().forEach(o => { (M[o.k] = M[o.k] || [])[o.i] = o.rec; });
  const ref = RW.reference(M.base);
  console.log(`harrier rule probe: ${fights.length} fights × ${names.length + 1} arms, ${((Date.now() - t0) / 1000).toFixed(0)} s; goal per fight (heuristic ${RW.mean(M.base.map(RW.goal)).toFixed(3)})`);
  for (const r of names){ const q = RW.paired(M.base, M[r], ref); const yk = M.base.map((b, i) => (M[r][i].killedYou || 0) - (b.killedYou || 0));
    console.log(`${r.padEnd(10)} goal ${q.diff >= 0 ? '+' : ''}${q.diff.toFixed(3)} ± ${q.se.toFixed(3)} ${Math.abs(q.diff) > 2 * q.se ? '*' : ' '} | style ${q.styleB.style.toFixed(2)} gates [${q.styleB.failed}] drift [${q.driftB.join('; ')}] | kills of you ${(100 * RW.mean(yk)).toFixed(1)} pts`); }
});
