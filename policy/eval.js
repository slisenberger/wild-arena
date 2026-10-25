// Heuristic vs policy on the same board fights (common seeds): your win rate, mean score, the enemy predators'
// damage, kills of you, deaths, and how they spend their time (on you / your animals / feeding / nothing ...).
// Differences are paired per fight (same board, team, seed), with ± standard errors.
// Usage: node policy/eval.js [weights=policy/bc_weights.json] [boardsPerMap=25] [seeds=4] [seedBase=3003]
const { isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const CATS = ['you', 'animals', 'feud', 'feed', 'rest', 'flee/heat', 'none'];
function cat(u){
  if (u.state === 'flee' || u.state === 'cool' || u.heatstroke) return 'flee/heat';
  if (u.state === 'feed') return 'feed';
  if (u.state === 'rest') return 'rest';
  if (u.target && u.state === 'engage') return u.target.side === 'H' ? 'you' : u.target.side === 'P' ? 'animals' : 'feud';
  if (u.latchOn) return u.latchOn.side === 'H' ? 'you' : 'animals';
  return 'none';
}
if (!isMainThread){
  const { A, cfgOf } = require('./common.js'); require('./policy.js');
  const out = [];
  for (const j of workerData.jobs) for (const arm of ['heur', 'net']){
    const c = cfgOf(j); if (arm === 'net'){ c.policy = workerData.P; c.policyStats = {}; }
    const w = A.setup(c), T = Object.fromEntries(CATS.map(k => [k, 0]));
    while (!w.over){ A.step(w); for (const u of w.units) if (u.side === 'E' && u.s.pred && u.state !== 'dead' && !u.escaped && !u.penned) T[cat(u)] += A.DT; }
    const pr = w.units.filter(u => u.side === 'E' && u.s.pred), r = w.result;
    out.push({k: j.tr + '|' + j.seed, tr: j.tr, arm, won: r.score >= 300 ? 1 : 0, score: r.score, dmg: pr.reduce((s, u) => s + u.st.dealt, 0),
      killedYou: !r.survived && r.killer && A.BY_ID[r.killer] && A.BY_ID[r.killer].pred ? 1 : 0, deaths: pr.filter(u => u.state === 'dead').length, n: pr.length, T,
      agree: c.policyStats ? [c.policyStats.agree || 0, c.policyStats.n || 0] : null});
  }
  parentPort.postMessage(out); return;
}
const { boardJobs, pool, mean, se, TERR } = require('./common.js');
const fs = require('fs');
const wf = process.argv[2] || path.join(__dirname, 'bc_weights.json');
const P = JSON.parse(fs.readFileSync(wf, 'utf8'));
const jobs = boardJobs(+process.argv[3] || 25, +process.argv[4] || 4, +process.argv[5] || 3003);
const t0 = Date.now();
pool(__filename, jobs, {P}).then(rows => {
  const H = {}, N = {}; for (const r of rows) (r.arm === 'heur' ? H : N)[r.k] = r;
  const keys = Object.keys(H).filter(k => N[k]);
  const ag = keys.reduce((a, k) => [a[0] + N[k].agree[0], a[1] + N[k].agree[1]], [0, 0]);
  console.log(`heuristic vs ${path.basename(wf)}: ${keys.length} board fights (${jobs.length / 4}/map, player-like teams), common seeds; ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(`on-policy agreement with the heuristic (net's own decisions): ${(100 * ag[0] / ag[1]).toFixed(1)}% of ${ag[1]}`);
  const f = (v, d) => v.toFixed(d);
  const row = (name, g, d, scale) => {
    scale = scale || 1; const a = keys.map(k => g(H[k]) * scale), b = keys.map(k => g(N[k]) * scale), df = keys.map((k, i) => b[i] - a[i]);
    console.log(`${name.padEnd(30)} ${(f(mean(a), d) + ' ± ' + f(se(a), d)).padStart(16)} ${(f(mean(b), d) + ' ± ' + f(se(b), d)).padStart(16)} ${((mean(df) >= 0 ? '+' : '') + f(mean(df), d) + ' ± ' + f(se(df), d)).padStart(16)}`);
  };
  const hdr = () => console.log(`${''.padEnd(30)} ${'heuristic'.padStart(16)} ${'policy'.padStart(16)} ${'paired diff'.padStart(16)}`);
  hdr();
  row('your win %', r => r.won, 1, 100);
  row('mean score (s)', r => r.score, 1);
  row('pred. damage dealt / fight', r => r.dmg, 0);
  row('pred. killed you %', r => r.killedYou, 1, 100);
  row('pred. deaths / fight', r => r.deaths, 2);
  console.log('enemy predators\' time share (% of predator-seconds alive, per fight):');
  for (const c of CATS) row('  ' + c, r => { const tot = CATS.reduce((s, q) => s + r.T[q], 0); return tot ? r.T[c] / tot : 0; }, 1, 100);
  console.log('\nper map (win %, heuristic -> policy, paired diff ± SE):');
  for (const tr of TERR){ const ks = keys.filter(k => H[k].tr === tr), df = ks.map(k => 100 * (N[k].won - H[k].won));
    console.log(`  ${tr.padEnd(8)} ${f(mean(ks.map(k => 100 * H[k].won)), 1)} -> ${f(mean(ks.map(k => 100 * N[k].won)), 1)}  (${f(mean(df), 1)} ± ${f(se(df), 1)}; ${ks.filter(k => H[k].won !== N[k].won).length}/${ks.length} fights changed outcome)`); }
});
