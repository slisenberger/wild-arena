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
module.exports = { train, DEF };

if (require.main === module){
  const R = require('./move_run.js');
  const [files, out, ...rest] = process.argv.slice(2);
  const o = Object.assign({}, DEF, Object.fromEntries(rest.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, isNaN(+v) ? v : +v]; })));
  const D = files.split(',').flatMap(f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)));
  const r = train(D, o, console.log), b = r.best;
  const st = {format: 'wild-arena/bc-target', simHash: R.simHash(), harnessHash: R.harnessHash(), data: files, opts: o, features: FP.NAMES,
    config: {arch: o.arch, goal: 'checkmate', spec: true, withLive: true, target: true, mode: 'linear', feat: 'plus', nh: o.nh, trainer: 'bc-lookahead'},
    P0: Object.assign({}, r.P, {theta: r.th0}), theta: b.th, best: {theta: b.th, it: b.ep, val: -b.regret, from: `epoch ${b.ep} (held-out regret ${b.regret.toFixed(4)} vs heuristic ${r.base.regret.toFixed(4)})`}, test: null, phase: 'done'};
  fs.writeFileSync(out, JSON.stringify(st));
  console.log(`wrote ${out}: best epoch ${b.ep}, held-out regret ${b.regret.toFixed(4)} (heuristic ${r.base.regret.toFixed(4)})`);
}
