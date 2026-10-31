// Milestone 4 expert iteration: train a target scorer to imitate lookahead choices (policy/plan.js data, or
// policy/probes/cat_lookahead.js COLLECT=...). Each record is one enemy decision with 2+ targets: the options the lookahead
// tried (features_plus rows), each branch's score, the heuristic's pick among them, and the unit's species traits. The model
// is a 'target-mlp' over [option features, traits] (zero output = the heuristic, as in the game); the loss is cross-entropy
// to softmax(branch score / temp) ('hard': the best branch), with the heuristic margin inside the model as at play time.
// CLI writes a train.js-shaped state for eval_arch.js; train() is used by policy/expert_iter.js.
//   node policy/bc_target.js <data.jsonl[,more.jsonl]> <out state.json> [--nh=16 --epochs=40 --lr=.003 --temp=hard --margin=.25
//        --l2=1e-4 --batch=256 --holdout=.1 --seed=1 --arch=cat]
const fs = require('fs'), path = require('path');
const TM = require('./target_model.js'), FP = require('./features_plus.js'), TR = require('./traits.js');
const DEF = {nh: 16, epochs: 40, lr: .003, temp: 'hard', margin: .25, l2: 1e-4, batch: 256, holdout: .1, seed: 1, arch: 'cat', feat: 'plus', only: null, wide: false};

// D: records; o: options; init: optional {theta} to continue from; log: line sink. Returns {P (with theta = best), base, best}
function train(D, o, log, init){
  o = Object.assign({}, DEF, o); log = log || (() => {});
  D = D.filter(d => d.X.length >= 2).slice();
  let s = (o.seed >>> 0) || 1; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = D.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [D[i], D[j]] = [D[j], D[i]]; }
  const nv = Math.floor(D.length * o.holdout), V = D.slice(0, nv), Tn = D.slice(nv);
  const nin = D.length ? D[0].X[0].length + D[0].tr.length : FP.DIM + TR.DIM; // option features (features_plus, or guard_features for your guards) + traits
  const P = TM.mlp(nin, o.nh, o.margin, o.seed * 31 + 7, true); if (o.feat) P.feat = o.feat; if (o.only) P.only = o.only; if (o.wide) P.wide = true;
  const NP = TM.npar(P), th0 = TM.thetaOf(P).slice(), th = init && init.theta && init.theta.length === NP ? init.theta.slice() : th0.slice();
  const m = new Array(NP).fill(0), v = new Array(NP).fill(0); let t = 0;
  const inp = d => d.X.map(x => x.concat(d.tr));
  const argmax = a => { let b = 0; a.forEach((x, i) => { if (x > a[b] + 1e-12) b = i; }); return b; };
  const target = d => { if (o.temp === 'hard'){ const b = argmax(d.s); return d.s.map((_, i) => +(i === b)); }
    const mx = Math.max(...d.s), e = d.s.map(x => Math.exp((x - mx) / o.temp)), z = e.reduce((a, b) => a + b, 0); return e.map(x => x / z); };
  const soft = (d, X) => { const sc = TM.scores(P, X, d.teach, th), mx = Math.max(...sc), e = sc.map(x => Math.exp(x - mx)), z = e.reduce((a, b) => a + b, 0); return e.map(x => x / z); };
  function evalSet(S){ // accuracy vs the best branch, agreement with the heuristic, mean regret (best branch - chosen branch), loss
    let acc = 0, keep = 0, reg = 0, loss = 0;
    for (const d of S){ const X = inp(d), p = soft(d, X), q = target(d), a = argmax(p), b = argmax(d.s);
      acc += a === b; keep += a === d.teach; reg += d.s[b] - d.s[a]; q.forEach((x, i) => { if (x > 0) loss -= x * Math.log(Math.max(1e-12, p[i])); }); }
    const n = S.length || 1; return {acc: acc / n, keep: keep / n, regret: reg / n, loss: loss / n};
  }
  const base = (() => { let reg = 0, acc = 0; for (const d of V){ const b = argmax(d.s), h = Math.max(0, d.teach); reg += d.s[b] - d.s[h]; acc += h === b; } return {acc: acc / (V.length || 1), regret: reg / (V.length || 1)}; })();
  log(`${D.length} decisions (${Tn.length} train, ${V.length} held out), ${NP} weights; heuristic on held out: picks the best branch ${(100 * base.acc).toFixed(1)}%, regret ${base.regret.toFixed(4)}`);
  let best = {regret: evalSet(V).regret, th: th.slice(), ep: -1};
  for (let ep = 0; ep < o.epochs; ep++){
    for (let i = Tn.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [Tn[i], Tn[j]] = [Tn[j], Tn[i]]; }
    for (let b0 = 0; b0 < Tn.length; b0 += o.batch){
      const g = new Array(NP).fill(0), B = Tn.slice(b0, b0 + o.batch);
      for (const d of B){ const X = inp(d), p = soft(d, X), q = target(d); X.forEach((x, i) => TM.addGrad(g, th, P, x, (p[i] - q[i]) / B.length)); }
      t++; for (let k = 0; k < NP; k++){ const gk = g[k] + o.l2 * (th[k] - th0[k]); m[k] = .9 * m[k] + .1 * gk; v[k] = .999 * v[k] + .001 * gk * gk;
        th[k] -= o.lr * (m[k] / (1 - Math.pow(.9, t))) / (Math.sqrt(v[k] / (1 - Math.pow(.999, t))) + 1e-8); }
    }
    const e = evalSet(V); if (e.regret < best.regret) best = {regret: e.regret, th: th.slice(), ep};
    log(`[ep ${ep}] held out: best branch ${(100 * e.acc).toFixed(1)}%, keeps the heuristic ${(100 * e.keep).toFixed(1)}%, regret ${e.regret.toFixed(4)}, loss ${e.loss.toFixed(3)}${best.ep === ep ? '  -> best' : ''}`);
  }
  return {P: Object.assign({}, P, {theta: best.th}), th0, base, best};
}
// Gain regression (loss 'adv'): predict each tried option's gain over today's pick, a_i = s_i - s_teach, as f(x_i) - f(x_teach)
// (Huber loss: the labels are single noisy rolls), then choose the switching threshold kappa (the model's margin at play time:
// switch only when the predicted gain beats kappa) that maximizes the realized held-out gain mean(s_chosen - s_teach).
// Unlike imitating the argmax, this uses how much an option wins by, so noise-level 'wins' stop pulling the policy around.
function trainAdv(D, o, log, init){
  o = Object.assign({}, DEF, {huber: .5, kappas: [0, .02, .05, .1, .15, .2, .3, .5]}, o); log = log || (() => {});
  D = D.filter(d => d.X.length >= 2 && d.teach >= 0).slice();
  let s = (o.seed >>> 0) || 1; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = D.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [D[i], D[j]] = [D[j], D[i]]; }
  const nv = Math.floor(D.length * o.holdout), V = D.slice(0, nv), Tn = D.slice(nv);
  const nin = D[0].X[0].length + D[0].tr.length, P = TM.mlp(nin, o.nh, 0, o.seed * 31 + 7, true); if (o.feat) P.feat = o.feat; if (o.only) P.only = o.only; if (o.wide) P.wide = true;
  P.targetsOnly = true;
  const NP = TM.npar(P), th0 = TM.thetaOf(P).slice(), th = init && init.theta && init.theta.length === NP ? init.theta.slice() : th0.slice();
  const m = new Array(NP).fill(0), v = new Array(NP).fill(0); let t = 0;
  const inp = d => d.X.map(x => x.concat(d.tr)), f = X => TM.scores(P, X, -1, th);
  const pick = (d, q, k) => { let b = d.teach, bv = 0; for (let i = 0; i < q.length; i++){ const g = q[i] - q[d.teach]; if (i !== d.teach && g - k > bv){ bv = g - k; b = i; } } return b; };
  function evalSet(S){ const r = o.kappas.map(k => ({k, gain: 0, dev: 0})); let mse = 0, n = 0;
    for (const d of S){ const q = f(inp(d)); for (let i = 0; i < q.length; i++) if (i !== d.teach){ const e = (q[i] - q[d.teach]) - (d.s[i] - d.s[d.teach]); mse += e * e; n++; }
      r.forEach(x => { const b = pick(d, q, x.k); x.gain += d.s[b] - d.s[d.teach]; x.dev += b !== d.teach; }); }
    r.forEach(x => { x.gain /= S.length || 1; x.dev /= S.length || 1; }); return {mse: mse / (n || 1), r}; }
  const oracle = V.reduce((a, d) => a + Math.max(...d.s) - d.s[d.teach], 0) / (V.length || 1);
  log(`${D.length} decisions (${Tn.length} train, ${V.length} held out), ${NP} weights; held-out gain if every best branch were taken: ${oracle.toFixed(4)}`);
  let best = {gain: 0, k: 1e9, th: th.slice(), ep: -1};
  for (let ep = 0; ep < o.epochs; ep++){
    for (let i = Tn.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [Tn[i], Tn[j]] = [Tn[j], Tn[i]]; }
    for (let b0 = 0; b0 < Tn.length; b0 += o.batch){
      const g = new Array(NP).fill(0), B = Tn.slice(b0, b0 + o.batch);
      for (const d of B){ const X = inp(d), q = f(X), k = d.teach;
        for (let i = 0; i < X.length; i++){ if (i === k) continue; const e = (q[i] - q[k]) - (d.s[i] - d.s[k]), c = (Math.abs(e) <= o.huber ? e : o.huber * Math.sign(e)) / B.length;
          TM.addGrad(g, th, P, X[i], c); TM.addGrad(g, th, P, X[k], -c); } }
      t++; for (let k = 0; k < NP; k++){ const gk = g[k] + o.l2 * (th[k] - th0[k]); m[k] = .9 * m[k] + .1 * gk; v[k] = .999 * v[k] + .001 * gk * gk;
        th[k] -= o.lr * (m[k] / (1 - Math.pow(.9, t))) / (Math.sqrt(v[k] / (1 - Math.pow(.999, t))) + 1e-8); }
    }
    const e = evalSet(V), bk = e.r.reduce((a, x) => x.gain > a.gain ? x : a, {gain: -1e9});
    if (bk.gain > best.gain) best = {gain: bk.gain, k: bk.k, dev: bk.dev, th: th.slice(), ep};
    log(`[ep ${ep}] held out: gain-prediction mse ${e.mse.toFixed(4)} | realized gain by kappa ${e.r.map(x => `${x.k}: ${x.gain >= 0 ? '+' : ''}${x.gain.toFixed(4)} (${(100 * x.dev).toFixed(0)}%)`).join(', ')}${best.ep === ep ? '  -> best' : ''}`);
  }
  return {P: Object.assign({}, P, {theta: best.th, margin: best.k === 1e9 ? 1e3 : best.k}), th0, best, oracle};
}
// the same gain regression for the state encoder (policy/set_model.js 'target-set'): records carry U (each nearby animal's fixed
// row) and T (each tried option's per-animal target rows), logged by plan.js with set: true
function trainAdvSet(D, o, log, init){
  const SM = require('./set_model.js');
  o = Object.assign({}, DEF, {huber: .5, K: 16, kappas: [0, .02, .05, .1, .15, .2, .3, .5]}, o); log = log || (() => {});
  D = D.filter(d => d.X.length >= 2 && d.teach >= 0 && d.U).slice();
  let s = (o.seed >>> 0) || 1; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = D.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [D[i], D[j]] = [D[j], D[i]]; }
  const nv = Math.floor(D.length * o.holdout), V = D.slice(0, nv), Tn = D.slice(nv);
  const dec = d => d._D || (d._D = {x: d.X.map(x => x.concat(d.tr)), U: d.U, T: d.T});
  const P = SM.make(D[0].X[0].length + D[0].tr.length, o.K, o.nh, 0, o.seed * 31 + 7); if (o.feat) P.feat = o.feat; if (o.only) P.only = o.only; if (o.wide) P.wide = true; P.targetsOnly = true;
  const NP = P.theta.length, th0 = P.theta.slice(), th = init && init.theta && init.theta.length === NP ? init.theta.slice() : th0.slice();
  const m = new Array(NP).fill(0), v = new Array(NP).fill(0); let t = 0;
  const f = d => SM.scores(P, dec(d), -1, th);
  const pick = (d, q, k) => { let b = d.teach, bv = 0; for (let i = 0; i < q.length; i++){ const g = q[i] - q[d.teach]; if (i !== d.teach && g - k > bv){ bv = g - k; b = i; } } return b; };
  function evalSet(S){ const r = o.kappas.map(k => ({k, gain: 0, dev: 0})); let mse = 0, n = 0;
    for (const d of S){ const q = f(d); for (let i = 0; i < q.length; i++) if (i !== d.teach){ const e = (q[i] - q[d.teach]) - (d.s[i] - d.s[d.teach]); mse += e * e; n++; }
      r.forEach(x => { const b = pick(d, q, x.k); x.gain += d.s[b] - d.s[d.teach]; x.dev += b !== d.teach; }); }
    r.forEach(x => { x.gain /= S.length || 1; x.dev /= S.length || 1; }); return {mse: mse / (n || 1), r}; }
  const oracle = V.reduce((a, d) => a + Math.max(...d.s) - d.s[d.teach], 0) / (V.length || 1);
  log(`${D.length} decisions (${Tn.length} train, ${V.length} held out), state encoder ${NP} weights; held-out gain if every best branch were taken: ${oracle.toFixed(4)}`);
  let best = {gain: 0, k: 1e9, th: th.slice(), ep: -1};
  for (let ep = 0; ep < o.epochs; ep++){
    for (let i = Tn.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [Tn[i], Tn[j]] = [Tn[j], Tn[i]]; }
    for (let b0 = 0; b0 < Tn.length; b0 += o.batch){
      const g = new Array(NP).fill(0), B = Tn.slice(b0, b0 + o.batch);
      for (const d of B){ const Dd = dec(d), q = SM.scores(P, Dd, -1, th), k = d.teach;
        for (let i = 0; i < q.length; i++){ if (i === k) continue; const e = (q[i] - q[k]) - (d.s[i] - d.s[k]), c = (Math.abs(e) <= o.huber ? e : o.huber * Math.sign(e)) / B.length;
          SM.addGrad(g, th, P, Dd, i, c); SM.addGrad(g, th, P, Dd, k, -c); } }
      t++; for (let k = 0; k < NP; k++){ const gk = g[k] + o.l2 * (th[k] - th0[k]); m[k] = .9 * m[k] + .1 * gk; v[k] = .999 * v[k] + .001 * gk * gk;
        th[k] -= o.lr * (m[k] / (1 - Math.pow(.9, t))) / (Math.sqrt(v[k] / (1 - Math.pow(.999, t))) + 1e-8); }
    }
    const e = evalSet(V), bk = e.r.reduce((a, x) => x.gain > a.gain ? x : a, {gain: -1e9});
    if (bk.gain > best.gain) best = {gain: bk.gain, k: bk.k, dev: bk.dev, th: th.slice(), ep};
    log(`[ep ${ep}] held out: gain-prediction mse ${e.mse.toFixed(4)} | realized gain by kappa ${e.r.map(x => `${x.k}: ${x.gain >= 0 ? '+' : ''}${x.gain.toFixed(4)} (${(100 * x.dev).toFixed(0)}%)`).join(', ')}${best.ep === ep ? '  -> best' : ''}`);
  }
  for (const d of D) delete d._D;
  return {P: Object.assign({}, P, {theta: best.th, margin: best.k === 1e9 ? 1e3 : best.k}), th0, best, oracle};
}
module.exports = { train, trainAdv, trainAdvSet, DEF };

if (require.main === module){
  const R = require('./move_run.js');
  const [files, out, ...rest] = process.argv.slice(2);
  const o = Object.assign({}, DEF, Object.fromEntries(rest.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, isNaN(+v) ? v : +v]; })));
  const rd = f => (f.endsWith('.gz') ? require('zlib').gunzipSync(fs.readFileSync(f)).toString('utf8') : fs.readFileSync(f, 'utf8')).split('\n').filter(Boolean).map(l => JSON.parse(l));
  const D = files.split(',').flatMap(rd);
  if (o.loss === 'adv'){ // --loss=adv: gain regression; writes the state with the chosen kappa as the margin
    const r = trainAdv(D, o, console.log), b = r.best;
    const st = {format: 'wild-arena/bc-target', simHash: R.simHash(), harnessHash: R.harnessHash(), data: files, opts: o, features: o.arch === 'guard' ? require('./guard_features.js').NAMES : FP.NAMES,
      config: Object.assign({arch: o.arch, target: true, mode: 'linear', nh: o.nh, trainer: 'adv-lookahead', withLive: true}, o.arch === 'guard' ? {goal: null, spec: false, only: o.only} : {goal: 'checkmate', spec: true, feat: 'plus'}),
      P0: Object.assign({}, r.P, {theta: r.th0}), theta: b.th, best: {theta: b.th, it: b.ep, val: b.gain, from: `epoch ${b.ep}, kappa ${b.k} (held-out gain ${b.gain.toFixed(4)} of ${r.oracle.toFixed(4)}, switches ${(100 * (b.dev || 0)).toFixed(0)}%)`}, test: null, phase: 'done'};
    fs.writeFileSync(out, JSON.stringify(st)); console.log(`wrote ${out}: ${st.best.from}`); process.exit(0);
  }
  const r = train(D, o, console.log), b = r.best;
  const st = {format: 'wild-arena/bc-target', simHash: R.simHash(), harnessHash: R.harnessHash(), data: files, opts: o, features: FP.NAMES,
    config: {arch: o.arch, goal: 'checkmate', spec: true, withLive: true, target: true, mode: 'linear', feat: 'plus', nh: o.nh, trainer: 'bc-lookahead'},
    P0: Object.assign({}, r.P, {theta: r.th0}), theta: b.th, best: {theta: b.th, it: b.ep, val: -b.regret, from: `epoch ${b.ep} (held-out regret ${b.regret.toFixed(4)} vs heuristic ${r.base.regret.toFixed(4)})`}, test: null, phase: 'done'};
  fs.writeFileSync(out, JSON.stringify(st));
  console.log(`wrote ${out}: best epoch ${b.ep}, held-out regret ${b.regret.toFixed(4)} (heuristic ${r.base.regret.toFixed(4)})`);
}
