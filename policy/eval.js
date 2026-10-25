// Heuristic vs policy on the same board fights (common seeds): your win rate, mean score, the enemy predators'
// damage to your side, kills of you, deaths, how they spend their time (overall and per species), and the realism gates
// (gates.js). Differences are paired per fight (same board, team, seed), with ± standard errors.
// Usage: node policy/eval.js [weights=policy/bc_weights.json] [boardsPerMap=100] [seeds=1] [seedBase=3003] [json-out]
const { isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), fs = require('fs');
if (!isMainThread){
  const { fight } = require('./run.js');
  const out = [];
  for (const j of workerData.jobs){ const k = j.tr + '|' + j.seed + '|' + j.board.join(',');
    out.push(Object.assign(fight(j, null, true), {k, tr: j.tr, arm: 'heur'}), Object.assign(fight(j, workerData.P, true), {k, tr: j.tr, arm: 'net'})); }
  parentPort.postMessage(out); return;
}
const { boardJobs, pool, TERR } = require('./common.js');
const { CATS } = require('./run.js'), G = require('./gates.js'), { mean, se } = G;
const wf = process.argv[2] || path.join(__dirname, 'bc_weights.json');
const P = JSON.parse(fs.readFileSync(wf, 'utf8'));
const jobs = boardJobs(+process.argv[3] || 100, +process.argv[4] || 1, +process.argv[5] || 3003);
const t0 = Date.now();
pool(__filename, jobs, {P}).then(rows => {
  const Hm = {}, Nm = {}; for (const r of rows) (r.arm === 'heur' ? Hm : Nm)[r.k] = r;
  const keys = Object.keys(Hm).filter(k => Nm[k]).sort(), H = keys.map(k => Hm[k]), N = keys.map(k => Nm[k]);
  const dec = N.reduce((a, r) => [a[0] + r.dis * r.nDec, a[1] + r.nDec], [0, 0]);
  console.log(`heuristic vs ${path.basename(wf)}: ${keys.length} board fights (${jobs.length / 4}/map, player-like teams, seed base ${+process.argv[5] || 3003}), common seeds; ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(`on-policy agreement with the heuristic (net's own decisions): ${(100 - 100 * dec[0] / dec[1]).toFixed(1)}% of ${dec[1]}`);
  const f = (v, d) => v.toFixed(d), pm = (v, d) => (v >= 0 ? '+' : '') + f(v, d);
  const row = (name, g, d, scale) => {
    scale = scale || 1; const a = H.map(r => g(r) * scale), b = N.map(r => g(r) * scale), df = b.map((v, i) => v - a[i]);
    console.log(`${name.padEnd(30)} ${(f(mean(a), d) + ' ± ' + f(se(a), d)).padStart(16)} ${(f(mean(b), d) + ' ± ' + f(se(b), d)).padStart(16)} ${(pm(mean(df), d) + ' ± ' + f(se(df), d)).padStart(16)}`);
  };
  console.log(`${''.padEnd(30)} ${'heuristic'.padStart(16)} ${'policy'.padStart(16)} ${'paired diff'.padStart(16)}`);
  row('your win %', r => r.won, 1, 100);
  row('mean score (s)', r => r.score, 1);
  row('pred. damage to your side', r => r.foe, 0);
  row('pred. killed you %', r => r.killed, 1, 100);
  row('pred. deaths / fight', r => r.deaths, 2);
  row('ES reward (game)', r => r.foe / 1000 + 5 * r.killed - r.deaths, 3);
  const tot = r => Object.values(r.T).reduce((s, t) => s + CATS.reduce((a, k) => a + t[k], 0), 0);
  console.log('enemy predators\' time share (% of predator-seconds alive, per fight):');
  for (const c of CATS) row('  ' + c, r => { const T = tot(r); return T ? Object.values(r.T).reduce((s, t) => s + t[c], 0) / T : 0; }, 1, 100);
  const g = G.check(H, N);
  console.log(`\nper species, pooled predator-seconds: share heuristic -> policy (points) for ${CATS.join(' / ')}; deaths per appearance; kills of you`);
  const sps = Object.keys(g.pH).sort((a, b) => g.pH[b].sec - g.pH[a].sec);
  for (const sp of sps){ const a = g.pH[sp], b = g.pN[sp]; if (!b) continue;
    const app = H.reduce((s, r) => s + (r.present[sp] || 0), 0), dH = H.reduce((s, r) => s + (r.deathsBy[sp] || 0), 0), dN = N.reduce((s, r) => s + (r.deathsBy[sp] || 0), 0);
    const kH = H.filter(r => r.killer === sp).length, kN = N.filter(r => r.killer === sp).length;
    console.log(`  ${sp.padEnd(12)} ${String(Math.round(a.sec)).padStart(6)}s  ` + CATS.map(c => `${f(a.share[c], 0)}->${f(b.share[c], 0)}`).join(' / ') + `  deaths ${f(dH / app, 2)}->${f(dN / app, 2)}  kills you ${kH}->${kN}`); }
  console.log(`\nrealism gates (±${G.PROFILE_PTS} pts on ${G.GATED.join('/')} for species with ≥${G.MIN_SEC} s, appetite order, deaths): ${g.pass ? 'PASS' : 'FAIL: ' + g.fails.join('; ')}${g.warns.length ? '\n  warnings: ' + g.warns.join('; ') : ''}`);
  console.log('\nper map (win %, heuristic -> policy, paired diff ± SE; damage to your side):');
  for (const tr of TERR){ const ix = keys.map((k, i) => i).filter(i => H[i].tr === tr), df = ix.map(i => 100 * (N[i].won - H[i].won)), dd = ix.map(i => N[i].foe - H[i].foe);
    console.log(`  ${tr.padEnd(8)} ${f(mean(ix.map(i => 100 * H[i].won)), 1)} -> ${f(mean(ix.map(i => 100 * N[i].won)), 1)}  (${pm(mean(df), 1)} ± ${f(se(df), 1)}; damage ${pm(mean(dd), 0)} ± ${f(se(dd), 0)}; ${ix.filter(i => H[i].won !== N[i].won).length}/${ix.length} fights changed outcome)`); }
  if (process.argv[6]) fs.writeFileSync(process.argv[6], JSON.stringify({H, N}));
});
