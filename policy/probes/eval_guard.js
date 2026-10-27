// Independent check of a trained guard policy on the CURRENT live engine (shipped harrier policy on): player-like
// budget-fill teams on dealt boards, paired seeds; your survival time and win% with the trained guard weights vs the live default (the shipped guard policy, if any).
// Usage: node policy/probes/eval_guard.js <state.json> [N] [seedBase]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const M = require(path.join(__dirname, '..', 'move_model.js'));
const A = require(path.join(__dirname, '..', '..', 'sim.js'));
if (!isMainThread){ parentPort.postMessage(workerData.jobs.map(j => { const c = Object.assign({}, j.cfg); if (j.W) c.movePolicy = {harrier: A._internals.LIVE.harrier, guard: j.W}; const w = A.simulate(c); return {k: j.k, i: j.i, s: w.result.score, won: w.result.survived ? 1 : 0}; })); return; }
const [file, n, sb] = process.argv.slice(2), N = +n || 1200, s = require(path.resolve(file)), W = M.unflat(s.P0, s.best.theta, s.config.mode), TERR = Object.keys(A.TERRAINS), jobs = [];
for (let i = 0; i < N; i++){ const tr = TERR[i % 4], R = A.rng((+sb || 9001) + i * 31), board = A.dealBoard(Math.floor(R() * 1e9) + 1, {terrain: tr}); const o = board.slice(); for (let k = o.length - 1; k > 0; k--){ const q = Math.floor(R() * (k + 1)); [o[k], o[q]] = [o[q], o[k]]; } const team = []; let left = A.RULES.budget; for (const id of o) if (A.BY_ID[id].price <= left){ team.push(id); left -= A.BY_ID[id].price; }
  const cfg = {team, board, terrain: tr, mode: 'wild', mount: A.defaultMount(team), seed: Math.floor(R() * 2e9) + 1}; jobs.push({k: 'base', i, cfg, W: null}, {k: 'guard', i, cfg, W}); }
Promise.all([0, 1, 2, 3].map(k => new Promise(res => { const w = new Worker(__filename, {workerData: {jobs: jobs.filter((_, q) => q % 4 === k)}}); w.on('message', res); }))).then(p => {
  const X = {base: [], guard: []}; p.flat().forEach(o => X[o.k][o.i] = o); const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const d = X.base.map((b, i) => X.guard[i].s - b.s), dw = X.base.map((b, i) => X.guard[i].won - b.won), se = a => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1) / a.length); };
  console.log(`${file}: ${N} fights, live engine | survival ${mean(X.base.map(o => o.s)).toFixed(1)} -> ${mean(X.guard.map(o => o.s)).toFixed(1)} s (${mean(d) >= 0 ? '+' : ''}${mean(d).toFixed(1)} ± ${se(d).toFixed(1)}) | win ${(100 * mean(X.base.map(o => o.won))).toFixed(1)}% -> ${(100 * mean(X.guard.map(o => o.won))).toFixed(1)}% (${(100 * mean(dw)).toFixed(1)} ± ${(100 * se(dw)).toFixed(1)} pts)`);
});
