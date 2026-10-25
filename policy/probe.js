// Directed probes: does target choice move the predators' reward at all, and in which direction? Each arm adds a
// linear bias Wl (in standardized units of one option feature) on top of the frozen behavior-cloned net and plays the
// same fights as the heuristic (paired, common seeds). Env ARMS='[["name", {feature: bias}], ...]' replaces the default arms.
// Usage: node policy/probe.js [boardsPerMap=100] [seedBase=5005] [scale=2]
const { isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), fs = require('fs');
if (!isMainThread){
  const { fight } = require('./run.js');
  parentPort.postMessage(workerData.jobs.map(j => Object.assign(fight(j, j.ci < 0 ? null : workerData.cands[j.ci], true), {i: j.i, ci: j.ci})));
  return;
}
const { boardJobs, pool } = require('./common.js'), G = require('./gates.js'), { mean, se } = G, F = require('./features.js');
const B = JSON.parse(fs.readFileSync(path.join(__dirname, 'bc_weights.json'), 'utf8'));
const NB = +process.argv[2] || 100, SB = +process.argv[3] || 5005, K = +process.argv[4] || 2;
const arm = bias => { const Q = JSON.parse(JSON.stringify(B)); delete Q.names; delete Q.norm; Q.Wl = new Array(Q.nin).fill(0);
  for (const [n, v] of Object.entries(bias)){ const i = F.NAMES.indexOf(n); if (i < 0) throw new Error(n); Q.Wl[i] = v / B.norm.sd[i]; } return Q; };
const ARMS = process.env.ARMS ? JSON.parse(process.env.ARMS) : [['BC', {}], ['you +', {isHuman: K}], ['you -', {isHuman: -K}], ['roam less', {isNone: -K}], ['roam more', {isNone: K}],
  ['feed less', {isFeed: -K}], ['wounded +', {hpFrac: -K}], ['guarded -', {guardLog: -K}], ['busy +', {busyElsewhere: K}],
  ['pack focus +', {packOn: K}], ['keep target +', {isMine: K}], ['near +', {dist: -K}], ['mount/rider +', {isMount: K, riding: K}]];
const jobs = boardJobs(NB, 1, SB), cands = [null, ...ARMS.map(a => arm(a[1]))];
const js = []; cands.forEach((c, ci) => jobs.forEach((j, i) => js.push(Object.assign({}, j, {i, ci: c ? ci : -1}))));
const t0 = Date.now();
pool(__filename, js, {cands}).then(rows => {
  const by = cands.map(() => []); for (const r of rows) by[r.ci < 0 ? 0 : r.ci][r.i] = r;
  const game = r => r.foe / 1000 + 5 * r.killed - r.deaths, H = by[0];
  console.log(`probes (bias ${K} standardized units) vs heuristic, ${jobs.length} paired fights, seed base ${SB}; ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  const d = (ci, f) => { const x = by[ci].map((r, i) => f(r) - f(H[i])); return `${(mean(x) >= 0 ? '+' : '') + mean(x).toFixed(f === game ? 3 : 2)} ± ${se(x).toFixed(f === game ? 3 : 2)}`; };
  console.log('arm'.padEnd(16) + ['game reward', 'dmg to you+yours', 'killed you %', 'deaths', 'your win %', 'disagree %'].map(s => s.padStart(18)).join('') + '  realism gates');
  ARMS.forEach((a, k) => { const ci = k + 1;
    console.log(a[0].padEnd(16) + [d(ci, game), d(ci, r => r.foe), d(ci, r => 100 * r.killed), d(ci, r => r.deaths), d(ci, r => 100 * r.won), (100 * mean(by[ci].map(r => r.dis))).toFixed(1)].map(s => s.padStart(18)).join('') + '  ' + (g => (g.pass ? 'pass' : 'FAIL: ' + g.fails.join('; ')) + (g.warns.length ? ' | warn: ' + g.warns.join('; ') : ''))(G.check(H, by[ci]))); });
});
