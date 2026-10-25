// Board-mode pricing: estimate each animal's swing value (seconds of survival gained by moving it from their side
// of the board to yours) and propose prices proportional to it.
// Each sample: deal a board of K animals (optionally with a fixed total price T), fill a team the way a player
// might (random order, take whatever still fits the budget B), run one fight on a random map. Then fit
//   score = map + Σ mine_i·a_i + Σ theirs_i·b_i     (least squares, light ridge)
// swing_i = a_i − b_i. Prices are set ∝ swing, rounded to $100, minimum $100.
// Usage: node price_board.js <config.json> <out.json>
//   config: {prices:{id:$}, K, B, T (optional), tol, rareP, N, seed, meanPrice | secPer100}
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const SIM = process.env.SIM || './sim.js';
const A = require(SIM);
function tallest(t){ let b = null, h = 0; for (const id of t){ const m = A.BY_ID[id].mountH; if (m > h){ h = m; b = id; } } return b; }
if (!isMainThread){ parentPort.postMessage(workerData.jobs.map(j => ({i: j.i, s: A.simulate({team: j.team, board: j.board, terrain: j.tr, mode: 'wild', mount: tallest(j.team), seed: j.seed}).result.score}))); return; }

const fs = require('fs');
const C = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), OUT = process.argv[3];
const P = Object.assign({}, ...A.ANIMALS.map(a => ({[a.id]: a.price})), C.prices || {});
const IDS = A.ANIMALS.map(a => a.id), TERR = Object.keys(A.TERRAINS), NW = 4;
// deal a board: K distinct animals; rare ones only with probability rareP; total price within tol of T if T given
function dealBoard(R, K, T, tol, rareP){
  const common = IDS.filter(id => !A.BY_ID[id].rare), rare = IDS.filter(id => A.BY_ID[id].rare);
  for (let tries = 0; tries < 20000; tries++){
    const pool = common.slice(); const b = [];
    if (rare.length && R() < rareP) b.push(rare[Math.floor(R() * rare.length)]);
    while (b.length < K){ const i = Math.floor(R() * pool.length); b.push(pool.splice(i, 1)[0]); }
    const tot = b.reduce((s, id) => s + P[id], 0);
    if (!T || Math.abs(tot - T) <= tol) return b;
  }
  throw new Error('could not deal a board with that total');
}
function fillTeam(R, board, B){
  const order = board.slice(); for (let i = order.length - 1; i > 0; i--){ const j = Math.floor(R() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const t = []; let left = B; for (const id of order) if (P[id] <= left){ t.push(id); left -= P[id]; }
  return t;
}
// least squares with ridge (no penalty on the map intercepts)
function solve(X, y, ridge, free){
  const p = X[0].length, M = Array.from({length: p}, () => new Float64Array(p)), v = new Float64Array(p);
  for (let r = 0; r < X.length; r++){ const x = X[r]; for (let i = 0; i < p; i++){ if (!x[i]) continue; v[i] += x[i] * y[r]; for (let j = 0; j < p; j++) if (x[j]) M[i][j] += x[i] * x[j]; } }
  for (let i = 0; i < p; i++) if (!free.includes(i)) M[i][i] += ridge;
  const n = p, aug = M.map((row, i) => [...row, ...Array.from({length: n}, (_, j) => +(i === j))]);
  for (let c = 0; c < n; c++){ let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(aug[r][c]) > Math.abs(aug[piv][c])) piv = r; [aug[c], aug[piv]] = [aug[piv], aug[c]];
    const d = aug[c][c]; for (let k = 0; k < 2 * n; k++) aug[c][k] /= d;
    for (let r = 0; r < n; r++) if (r !== c){ const f = aug[r][c]; if (f) for (let k = 0; k < 2 * n; k++) aug[r][k] -= f * aug[c][k]; } }
  const inv = aug.map(row => row.slice(n)), beta = inv.map(row => row.reduce((s, q, j) => s + q * v[j], 0));
  let sse = 0; for (let r = 0; r < X.length; r++){ let f = 0; for (let i = 0; i < p; i++) f += X[r][i] * beta[i]; sse += (y[r] - f) ** 2; }
  const s2 = sse / Math.max(1, X.length - p);
  return {beta, inv, s2};
}

const R = A.rng(C.seed || 1), jobs = [];
for (let i = 0; i < C.N; i++){
  const board = dealBoard(R, C.K, C.T, C.tol || 100, C.rareP || 0), team = fillTeam(R, board, C.B), tr = TERR[i % 4];
  jobs.push({i, board, team, tr, seed: 100000 + i * 7919 + (C.seed || 1)});
}
const t0 = Date.now();
Promise.all([...Array(NW).keys()].map(wi => new Promise(res => { const w = new Worker(__filename, {workerData: {jobs: jobs.filter((_, i) => i % NW === wi)}}); w.on('message', res); }))).then(parts => {
  const S = new Float64Array(C.N); parts.flat().forEach(r => S[r.i] = r.s);
  const n = IDS.length, p = 4 + 2 * n;
  const row = (j, mapOnly) => { const x = new Float64Array(p); x[TERR.indexOf(j.tr)] = 1; for (const id of j.board){ const k = IDS.indexOf(id); if (j.team.includes(id)) x[4 + k] = 1; else x[4 + n + k] = 1; } return x; };
  const fit = sub => solve(sub.map(j => row(j)), sub.map(j => S[j.i]), 2, [0, 1, 2, 3]);
  const all = fit(jobs), perMap = TERR.map(tr => fit(jobs.filter(j => j.tr === tr)));
  const swing = k => all.beta[4 + k] - all.beta[4 + n + k];
  const swingSE = k => Math.sqrt(all.s2 * (all.inv[4 + k][4 + k] + all.inv[4 + n + k][4 + n + k] - 2 * all.inv[4 + k][4 + n + k]));
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const scores = Array.from(S), wins = scores.filter(x => x >= 300).length;
  console.log(`price_board: K=${C.K} B=$${C.B}${C.T ? ' T=$' + C.T : ''} rareP=${C.rareP || 0}, ${C.N} fights in ${((Date.now() - t0) / 1000).toFixed(0)}s; mean score ${mean(scores).toFixed(0)} s, wins ${(100 * wins / C.N).toFixed(0)}%, mean team size ${mean(jobs.map(j => j.team.length)).toFixed(1)}`);
  // proposed prices ∝ swing, scaled so the mean price over common animals stays meanPrice
  const common = IDS.map((id, k) => ({id, k})).filter(o => !A.BY_ID[o.id].rare);
  const meanPrice = C.meanPrice || mean(common.map(o => P[o.id]));
  const pos = common.map(o => Math.max(0, swing(o.k)));
  const lam = mean(pos) / meanPrice;
  // either keep the mean price (default) or use a fixed exchange rate: secPer100 seconds of swing = $100
  const perDollar = C.secPer100 ? C.secPer100 / 100 : lam;
  const prop = {}; IDS.forEach((id, k) => { prop[id] = Math.max(100, Math.round(Math.max(0, swing(k)) / perDollar / 100) * 100); });
  console.log('animal        price  swing s ± SE   per $100 |  mine   theirs |  sav  riv  for  tun (swing per map) | proposed');
  IDS.map((id, k) => ({id, k, sw: swing(k)})).sort((a, b) => b.sw - a.sw).forEach(({id, k, sw}) => {
    const pm = perMap.map(f => (f.beta[4 + k] - f.beta[4 + n + k]).toFixed(0).padStart(4)).join(' ');
    console.log(`${id.padEnd(12)} $${String(P[id]).padEnd(5)} ${sw.toFixed(0).padStart(5)} ± ${swingSE(k).toFixed(0).padEnd(4)} ${(100 * sw / P[id]).toFixed(1).padStart(7)}  | ${all.beta[4 + k].toFixed(0).padStart(5)} ${all.beta[4 + n + k].toFixed(0).padStart(7)}  | ${pm} | $${prop[id]}`);
  });
  fs.writeFileSync(OUT, JSON.stringify({config: C, prices: P, swing: Object.fromEntries(IDS.map((id, k) => [id, +swing(k).toFixed(1)])), swingSE: Object.fromEntries(IDS.map((id, k) => [id, +swingSE(k).toFixed(1)])), proposed: prop, meanScore: mean(scores), winPct: 100 * wins / C.N}, null, 1));
});
