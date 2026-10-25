// Behavior cloning: log (features, heuristic choice) from board fights with player-like teams, train the MLP to
// imitate the heuristic (Adam, cross-entropy over each decision's options), report held-out top-1 agreement.
// Train and test fights come from different boards and seeds (different seed streams).
// Usage: node policy/bc.js [trainBoardsPerMap=100] [trainSeeds=5] [testBoardsPerMap=25] [testSeeds=4] [epochs=30] [hidden=32]
// Writes policy/bc_weights.json. Env CACHE=dir keeps the logged datasets (binary) there for re-training.
const { isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs'), path = require('path');
if (!isMainThread){
  const { A, cfgOf } = require('./common.js'); require('./policy.js');
  const F = require('./features.js'), D = F.DIM;
  // per decision: [nOpts, y, speciesIndex] header + nOpts*D floats
  const hdr = [], xs = [];
  for (const j of workerData.jobs){
    const c = cfgOf(j); c.policy = {teacher: true}; c.policyLog = [];
    A.simulate(c);
    for (const r of c.policyLog){ hdr.push(r.X.length, r.y, A.ANIMALS.findIndex(a => a.id === r.sp)); for (const x of r.X) for (let i = 0; i < D; i++) xs.push(x[i]); }
  }
  const H = Int32Array.from(hdr), X = Float32Array.from(xs);
  parentPort.postMessage([{H, X}], [H.buffer, X.buffer]); return;
}
const { A, boardJobs, pool } = require('./common.js');
const F = require('./features.js'), M = require('./model.js'), D = F.DIM;
const [NB, NS, TB, TS, EP, NH] = [100, 5, 25, 4, 30, 32].map((d, i) => +process.argv[2 + i] || d);

function merge(parts){ // -> {n, off (option row offset per decision), no, y, spc, X (rows of D)}
  let n = 0, rows = 0; for (const p of parts){ n += p.H.length / 3; rows += p.X.length / D; }
  const no = new Int32Array(n), y = new Int32Array(n), spc = new Int32Array(n), off = new Int32Array(n + 1), X = new Float32Array(rows * D);
  let k = 0, r = 0;
  for (const p of parts){ X.set(p.X, r * D); for (let i = 0; i < p.H.length; i += 3){ no[k] = p.H[i]; y[k] = p.H[i + 1]; spc[k] = p.H[i + 2]; off[k] = r; r += no[k]; k++; } }
  off[n] = r; return {n, off, no, y, spc, X};
}
async function dataset(name, jobs){
  const f = process.env.CACHE && path.join(process.env.CACHE, `bc_${name}_${jobs.length}_${D}`);
  if (f && fs.existsSync(f + '.x')){ const hb = fs.readFileSync(f + '.h'), xb = fs.readFileSync(f + '.x');
    return merge([{H: new Int32Array(hb.buffer, hb.byteOffset, hb.length / 4), X: new Float32Array(xb.buffer, xb.byteOffset, xb.length / 4)}]); }
  const parts = await pool(__filename, jobs);
  if (f){ const d = merge(parts), H = new Int32Array(d.n * 3); for (let i = 0; i < d.n; i++){ H[3 * i] = d.no[i]; H[3 * i + 1] = d.y[i]; H[3 * i + 2] = d.spc[i]; }
    fs.writeFileSync(f + '.h', Buffer.from(H.buffer)); fs.writeFileSync(f + '.x', Buffer.from(d.X.buffer)); }
  return merge(parts);
}

// standardize features with train statistics, then fold the scaling into W1/b1 after training
function stats(d){
  const mu = new Float64Array(D), sd = new Float64Array(D), rows = d.X.length / D;
  for (let r = 0; r < rows; r++) for (let i = 0; i < D; i++) mu[i] += d.X[r * D + i];
  for (let i = 0; i < D; i++) mu[i] /= rows;
  for (let r = 0; r < rows; r++) for (let i = 0; i < D; i++) sd[i] += (d.X[r * D + i] - mu[i]) ** 2;
  for (let i = 0; i < D; i++) sd[i] = Math.sqrt(sd[i] / rows) || 1;
  return {mu, sd};
}
function standardize(d, s){ const rows = d.X.length / D; for (let r = 0; r < rows; r++) for (let i = 0; i < D; i++) d.X[r * D + i] = (d.X[r * D + i] - s.mu[i]) / s.sd[i]; }
function fold(P, s){
  const Q = JSON.parse(JSON.stringify(P));
  for (let j = 0; j < P.nh; j++) for (let i = 0; i < D; i++){ Q.W1[j * D + i] = P.W1[j * D + i] / s.sd[i]; Q.b1[j] -= P.W1[j * D + i] * s.mu[i] / s.sd[i]; }
  return Q;
}

function evaluate(P, d){ // top-1 agreement (argmax, ties to the earlier option) and mean cross-entropy
  let ok = 0, ce = 0; const perSp = {}, perY = {none: [0, 0], feed: [0, 0], target: [0, 0]};
  for (let k = 0; k < d.n; k++){
    const s = []; for (let o = 0; o < d.no[k]; o++) s.push(M.score(P, d.X.subarray((d.off[k] + o) * D, (d.off[k] + o + 1) * D)));
    let b = 0; for (let o = 1; o < s.length; o++) if (s[o] > s[b]) b = o;
    const m = Math.max(...s), z = s.reduce((a, v) => a + Math.exp(v - m), 0); ce += -(s[d.y[k]] - m - Math.log(z));
    const hit = +(b === d.y[k]); ok += hit;
    const id = A.ANIMALS[d.spc[k]].id; (perSp[id] = perSp[id] || [0, 0]); perSp[id][0] += hit; perSp[id][1]++;
    const yk = d.y[k] === 0 ? 'none' : d.X[(d.off[k] + d.y[k]) * D + 1] > 0 ? 'feed' : 'target'; perY[yk][0] += hit; perY[yk][1]++;
  }
  return {acc: ok / d.n, ce: ce / d.n, perSp, perY};
}

function train(tr, te){
  const R = A.rng(99), P = M.init(D, NH, R), nP = NH * D + 2 * NH + 1;
  const theta = new Float64Array(M.flat(P)), m1 = new Float64Array(nP), m2 = new Float64Array(nP), g = new Float64Array(nP);
  const B = 128, lr0 = 3e-3, l2 = 1e-5, b1 = .9, b2 = .999; let step = 0;
  const idx = Array.from({length: tr.n}, (_, i) => i);
  const h = new Float64Array(NH * 64), sc = new Float64Array(64);
  const W1o = 0, b1o = NH * D, W2o = NH * D + NH, b2o = NH * D + 2 * NH;
  for (let ep = 0; ep < EP; ep++){
    for (let i = idx.length - 1; i > 0; i--){ const q = Math.floor(R() * (i + 1)); [idx[i], idx[q]] = [idx[q], idx[i]]; }
    const lr = lr0 * (ep < EP * .6 ? 1 : ep < EP * .85 ? .3 : .1);
    for (let s0 = 0; s0 < idx.length; s0 += B){
      g.fill(0); const nb = Math.min(B, idx.length - s0);
      for (let bi = 0; bi < nb; bi++){
        const k = idx[s0 + bi], no = Math.min(64, tr.no[k]), base = tr.off[k];
        for (let o = 0; o < no; o++){
          const x = (base + o) * D; let s = theta[b2o];
          for (let j = 0; j < NH; j++){ let a = theta[b1o + j]; const wo = W1o + j * D; for (let i = 0; i < D; i++) a += theta[wo + i] * tr.X[x + i]; const t = Math.tanh(a); h[o * NH + j] = t; s += theta[W2o + j] * t; }
          sc[o] = s;
        }
        let m = -Infinity; for (let o = 0; o < no; o++) m = Math.max(m, sc[o]);
        let z = 0; for (let o = 0; o < no; o++){ sc[o] = Math.exp(sc[o] - m); z += sc[o]; }
        for (let o = 0; o < no; o++){
          const dl = (sc[o] / z - (o === tr.y[k] ? 1 : 0)) / nb; if (Math.abs(dl) < 1e-7) continue;
          const x = (base + o) * D; g[b2o] += dl;
          for (let j = 0; j < NH; j++){ const t = h[o * NH + j]; g[W2o + j] += dl * t; const da = dl * theta[W2o + j] * (1 - t * t); g[b1o + j] += da; const wo = W1o + j * D; for (let i = 0; i < D; i++) g[wo + i] += da * tr.X[x + i]; }
        }
      }
      step++;
      const c1 = 1 - Math.pow(b1, step), c2 = 1 - Math.pow(b2, step);
      for (let p = 0; p < nP; p++){ const gp = g[p] + l2 * theta[p]; m1[p] = b1 * m1[p] + (1 - b1) * gp; m2[p] = b2 * m2[p] + (1 - b2) * gp * gp; theta[p] -= lr * (m1[p] / c1) / (Math.sqrt(m2[p] / c2) + 1e-8); }
    }
    if (ep % 5 === 4 || ep === EP - 1){ const Q = M.unflat(Array.from(theta), D, NH), a = evaluate(Q, tr), b = evaluate(Q, te); console.log(`epoch ${ep + 1}: train acc ${(100 * a.acc).toFixed(2)}% ce ${a.ce.toFixed(3)} | test acc ${(100 * b.acc).toFixed(2)}% ce ${b.ce.toFixed(3)}`); }
  }
  return M.unflat(Array.from(theta), D, NH);
}

(async () => {
  const t0 = Date.now();
  const trJobs = boardJobs(NB, NS, 1001), teJobs = boardJobs(TB, TS, 2002);
  const tr = await dataset('train', trJobs), te = await dataset('test', teJobs);
  console.log(`logged ${tr.n} train decisions (${trJobs.length} fights), ${te.n} test decisions (${teJobs.length} fights, other boards/seeds); ${F.DIM} features, avg ${(tr.off[tr.n] / tr.n).toFixed(2)} options; ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  // reference baselines on the test set
  const base = (name, pick) => { let ok = 0; for (let k = 0; k < te.n; k++) ok += +(pick(k) === te.y[k]); console.log(`  baseline ${name}: ${(100 * ok / te.n).toFixed(1)}%`); };
  const col = n => F.NAMES.indexOf(n), at = (d, k, o, n) => d.X[(d.off[k] + o) * D + col(n)];
  base('keep current target, else nearest', k => { let b = -1, bd = 1e9; for (let o = 0; o < te.no[k]; o++){ if (at(te, k, o, 'isMine') > 0) return o; if (at(te, k, o, 'isTarget') > 0 && at(te, k, o, 'dist') < bd){ bd = at(te, k, o, 'dist'); b = o; } } return b < 0 ? 0 : b; });
  base('always the human if a candidate', k => { for (let o = 0; o < te.no[k]; o++) if (at(te, k, o, 'isHuman') > 0) return o; return 0; });
  const s = stats(tr); standardize(tr, s); standardize(te, s);
  const P = train(tr, te), Q = fold(P, s);
  const r = evaluate(P, te);
  console.log(`\nheld-out top-1 agreement: ${(100 * r.acc).toFixed(2)}% ± ${(100 * Math.sqrt(r.acc * (1 - r.acc) / te.n)).toFixed(2)} (binomial SE; decisions within a fight are correlated, so the true SE is larger)`);
  console.log('  by heuristic choice: ' + Object.entries(r.perY).map(([k, v]) => `${k} ${(100 * v[0] / Math.max(1, v[1])).toFixed(1)}% of ${v[1]}`).join(', '));
  console.log('  by species: ' + Object.entries(r.perSp).sort((a, b) => b[1][1] - a[1][1]).map(([k, v]) => `${k} ${(100 * v[0] / v[1]).toFixed(1)}% (${v[1]})`).join(', '));
  Q.names = F.NAMES; Q.norm = {mu: Array.from(s.mu), sd: Array.from(s.sd)}; // inference ignores norm (already folded into W1/b1); ES perturbs in standardized space Q.note = `behavior-cloned from the chooseTarget heuristic; held-out top-1 ${(100 * r.acc).toFixed(2)}%`;
  fs.writeFileSync(path.join(__dirname, 'bc_weights.json'), JSON.stringify(Q));
  console.log(`wrote policy/bc_weights.json; ${((Date.now() - t0) / 1000).toFixed(0)}s total`);
})();
