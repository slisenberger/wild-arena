// Milestone 4: policy-gradient (PPO-style) training of an archetype's learned TARGET choice ('target-lin', policy/policy.js),
// the scalable alternative to ES (train.js) for larger models. Each iteration: N fresh fights played twice, by the heuristic
// and by the stochastic policy (softmax over candidates, private sampling stream); the fight's advantage is the paired goal
// difference (checkmate goal by default); every sampled decision gets its fight's advantage; clipped-ratio update with Adam,
// plus a penalty beta * (1 - p(heuristic's pick)) that anchors the policy to today's behaviour. Sampling at tau = margin / 2
// keeps the heuristic's pick ~70% of the time (tau 1 deviated on 55% of decisions: too noisy for a paired advantage). Validation: the greedy policy
// vs the heuristic on fixed fresh fights, accepted only with the style gates passing (move_reward.js grade, spec on).
// State JSON is train.js-compatible (P0, best.theta, config), so export_weights.js and probes/eval_arch.js read it.
//   node policy/ppo_target.js <state.json> [--arch=cat --iters=40 --fights=200 --threads=4 --lr=.02 --clip=.2 --epochs=4
//        --tau=.125 --margin=.25 --beta=.5 --valEvery=5 --val=600 --test=1200 --seed=1 --goal=checkmate --spec=true --nh=0 --self=true]
// --nh=16: a 'target-mlp' scorer with 16 hidden units (and, with --self, the unit's species traits as inputs); 0 = linear
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs'), path = require('path'), os = require('os');
const R = require('./move_run.js'), RW = require('./move_reward.js'), P = require('./policy.js'), TM = require('./target_model.js');
if (!isMainThread){ parentPort.postMessage(workerData.jobs.map(j => ({k: j.k, i: j.i, rec: R.runFight(j.f, j.W, workerData.arch)}))); return; }

// subcommands as in train.js (for policy/gcp/vm_runner.sh): init <state> [opts] | run <state> [--threads --hours] | report <state>;
// without one: create the state if missing, then run
const CMDS = ['init', 'run', 'report'], av = process.argv.slice(2), cmd = CMDS.includes(av[0]) ? av.shift() : 'auto';
const [file, ...rest] = av;
const opt = Object.fromEntries(rest.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v === undefined ? true : isNaN(+v) ? (v === 'true' ? true : v === 'false' ? false : v) : +v]; }));
const DEF = {arch: 'cat', iters: 40, fights: 200, threads: Math.min(8, os.cpus().length), lr: .02, clip: .2, epochs: 4, tau: .125, margin: .25,
  beta: .5, nh: 0, self: true, valEvery: 5, val: 600, test: 1200, seed: 1, goal: 'checkmate', spec: true, withLive: true, styleThr: .9};
const log = m => { console.log(m); fs.appendFileSync(file + '.log', m + '\n'); };
const save = s => { fs.writeFileSync(file + '.tmp', JSON.stringify(s)); fs.renameSync(file + '.tmp', file); };
const archOf = () => (opt.arch || (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).config.arch : DEF.arch));
const F = archOf() === 'guard' ? require('./guard_features.js') : require('./features.js'); // guards: their own options and features
let s = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
if (cmd === 'report'){ if (!s) process.exit(1); const b = s.best, t = s.test;
  console.log(`[it ${s.iter}/${s.config.iters}] best ${b.from} val ${b.val >= 0 ? '+' : ''}${(+b.val).toFixed(3)} | ${s.config.arch} ${s.P0.kind} ppo`);
  if (t) console.log(`test: ${t.diff.toFixed(3)} ± ${t.se.toFixed(3)} (${Math.abs(t.diff) > 2 * t.se ? 'beyond' : 'within'} noise), style ${t.style.toFixed(3)}`);
  process.exit(0); }
if (cmd === 'init' && s) throw new Error(file + ' exists');
if (cmd === 'run' && !s) throw new Error('no state ' + file);
if (!s){
  const c = Object.assign({}, DEF, opt, {target: true, mode: 'linear', trainer: 'ppo'}); if (c.arch === 'guard'){ c.goal = null; c.spec = false; } // guards: the protect goal
  s = {format: 'wild-arena/ppo-target', simHash: R.simHash(), harnessHash: R.harnessHash(), config: c, features: F.NAMES,
    P0: c.nh ? TM.mlp(F.DIM + (c.self ? TM.TRAITS : 0), c.nh, c.margin, c.seed * 7 + 3, c.self) : {kind: 'target-lin', v: 1, nin: F.DIM, margin: c.margin, wt: new Array(F.DIM).fill(0)},
    iter: 0, phase: 'train', history: [], test: null};
  const n = TM.npar(s.P0), th0 = TM.thetaOf(s.P0).slice(); Object.assign(s, {theta: th0, adam: {m: new Array(n).fill(0), v: new Array(n).fill(0), t: 0}, best: {theta: th0.slice(), it: -1, val: 0, from: 'init'}});
  log(`[init] ${file}: ${c.arch}, ${s.P0.kind} ${n} weights (${s.P0.nin} inputs), ${JSON.stringify(c)}`); save(s);
} else if (s.simHash !== R.simHash() && !process.env.ALLOW_ENGINE_MISMATCH) throw new Error(`${file} was made with sim ${s.simHash}; this checkout has ${R.simHash()}`);
if (cmd === 'init') process.exit(0);
const c = s.config, T0 = Date.now(), HOURS = +opt.hours || 0; if (cmd === 'run' && opt.threads) c.threads = +opt.threads; // run's --threads / --hours apply to this run only
const fo = {arch: c.arch, seed: c.seed, withLive: c.withLive, goal: c.goal, spec: c.spec};
const NP = TM.npar(s.P0), ZW = {kind: 'target-lin', v: 1, nin: F.DIM, margin: c.margin, wt: new Array(F.DIM).fill(0)}; // the base arm: zero scorer = the heuristic's targets
const Wof = (theta, sample) => theta === null ? ZW : Object.assign(TM.withTheta(s.P0, theta), {sample: !!sample, tau: c.tau});
const ZERO = null;

function run(jobs){
  const T = c.threads;
  return Promise.all([...Array(T).keys()].map(k => new Promise((res, rej) => { const w = new Worker(__filename, {workerData: {arch: c.arch, jobs: jobs.filter((_, q) => q % T === k)}}); w.on('message', res); w.on('error', rej); })))
    .then(p => { const A = {}; p.flat().forEach(o => { (A[o.k] = A[o.k] || [])[o.i] = o.rec; }); return A; });
}
// softmax over one decision's options with the current weights: {p, xbar}
// softmax over one decision's options with the current weights; gsc(i) = d score_i / d theta, ga(i) = gsc(i) - E_p[gsc]
function soft(theta, d){
  const sc = TM.scores(s.P0, d.X, d.teach, theta).map(v => v / c.tau);
  const m = Math.max(...sc), e = sc.map(v => Math.exp(v - m)), z = e.reduce((a, b) => a + b, 0), p = e.map(v => v / z);
  const gbar = new Array(NP).fill(0); d.X.forEach((x, i) => TM.addGrad(gbar, theta, s.P0, x, p[i]));
  const ga = i => { const g = new Array(NP).fill(0); TM.addGrad(g, theta, s.P0, d.X[i], 1); for (let k = 0; k < NP; k++) g[k] -= gbar[k]; return g; };
  return {p, ga};
}
function update(dec){ // dec: [{X, teach, a, p (old prob of a), A (advantage)}]
  for (let ep = 0; ep < c.epochs; ep++){
    const g = new Array(NP).fill(0); let clipped = 0, dev = 0;
    for (const d of dec){
      const {p, ga} = soft(s.theta, d), r = p[d.a] / Math.max(1e-9, d.p);
      const live = !((d.A > 0 && r > 1 + c.clip) || (d.A < 0 && r < 1 - c.clip)); if (!live) clipped++;
      const wa = live ? d.A * r / c.tau : 0, wt = c.beta * p[d.teach] / c.tau; // ascent on the clipped surrogate; on beta * p(heuristic's pick)
      if (d.a === d.teach){ if (wa + wt){ const q = ga(d.a); for (let k = 0; k < NP; k++) g[k] += (wa + wt) * q[k]; } }
      else { if (wa){ const q = ga(d.a); for (let k = 0; k < NP; k++) g[k] += wa * q[k]; } if (wt){ const q = ga(d.teach); for (let k = 0; k < NP; k++) g[k] += wt * q[k]; } }
      dev += 1 - p[d.teach];
    }
    const ad = s.adam; ad.t++;
    for (let k = 0; k < NP; k++){ const gk = g[k] / dec.length; ad.m[k] = .9 * ad.m[k] + .1 * gk; ad.v[k] = .999 * ad.v[k] + .001 * gk * gk;
      s.theta[k] += c.lr * (ad.m[k] / (1 - Math.pow(.9, ad.t))) / (Math.sqrt(ad.v[k] / (1 - Math.pow(.999, ad.t))) + 1e-8); }
    if (ep === c.epochs - 1) return {clipped: clipped / dec.length, dev: dev / dec.length};
  }
}
async function evalGreedy(theta, pool, idx, n){
  const fights = R.fightSet(pool, idx, n, fo), jobs = [];
  fights.forEach((f, i) => { jobs.push({k: 'base', i, f, W: Wof(null)}, {k: 'pol', i, f, W: Wof(theta, false)}); });
  const A = await run(jobs), ref = RW.reference(A.base), q = RW.paired(A.base, A.pol, ref);
  const surv = RW.mean(A.pol.map(r => r.survived)) - RW.mean(A.base.map(r => r.survived));
  const dev = RW.mean(A.pol.map(r => { const t = r.intents || [0, 0]; return (t[1] || 0) / Math.max(1, (t[0] || 0) + (t[1] || 0)); }));
  return {diff: q.diff, se: q.se, style: q.styleB.style, gates: q.styleB.failed, drift: q.driftB, surv, dev, n};
}
(async () => {
  while (s.iter < c.iters){
    if (HOURS && Date.now() - T0 > HOURS * 3600e3){ log(`[time] ${HOURS} h used at it ${s.iter}; resume to continue`); return; }
    const t0 = Date.now(), fights = R.fightSet('train', s.iter, c.fights, fo), jobs = [];
    fights.forEach((f, i) => { jobs.push({k: 'base', i, f, W: Wof(null)}, {k: 'pol', i, f, W: Wof(s.theta, true)}); }); // base = zero scorer: the heuristic's targets, the arch's shipped movement kept
    const A = await run(jobs);
    const adv = A.pol.map((r, i) => RW.goal(r) - RW.goal(A.base[i])), mu = RW.mean(adv), sd = RW.sd(adv) || 1;
    const dec = []; A.pol.forEach((r, i) => { for (const d of r.trace || []) dec.push(Object.assign(d, {A: (adv[i] - mu) / sd})); });
    const u = dec.length ? update(dec) : {clipped: 0, dev: 0};
    const h = {it: s.iter, goal: mu, se: sd / Math.sqrt(adv.length), decisions: dec.length, dev: u.dev, clipped: u.clipped, norm: Math.hypot(...s.theta), sec: (Date.now() - t0) / 1000};
    s.history.push(h); s.iter++;
    log(`[it ${h.it}] sampled policy vs heuristic ${mu >= 0 ? '+' : ''}${mu.toFixed(3)} ± ${h.se.toFixed(3)} | ${dec.length} decisions, deviates ${(100 * u.dev).toFixed(1)}%, clipped ${(100 * u.clipped).toFixed(0)}% | |w| ${h.norm.toFixed(3)} | ${h.sec.toFixed(0)} s`);
    if (s.iter % c.valEvery === 0 || s.iter === c.iters){
      const v = await evalGreedy(s.theta, 'val', 0, c.val), ok = !v.gates.length && v.style >= c.styleThr;
      log(`  [val] greedy vs heuristic on ${v.n} fights: ${v.diff >= 0 ? '+' : ''}${v.diff.toFixed(3)} ± ${v.se.toFixed(3)} | style ${v.style.toFixed(3)} gates [${v.gates}] drift [${v.drift.join('; ')}] | survival ${(100 * v.surv).toFixed(1)} pts | deviates ${(100 * v.dev).toFixed(1)}%${ok && v.diff > s.best.val ? '  -> new best' : ''}`);
      if (ok && v.diff > s.best.val){ s.best = {theta: s.theta.slice(), it: s.iter, val: v.diff, from: 'after ' + s.iter + ' iterations'}; }
    }
    save(s);
  }
  if (!s.test){ const t = await evalGreedy(s.best.theta, 'test', 0, c.test); s.test = t; s.phase = 'done'; save(s);
    log(`[test] best (${s.best.from}) vs heuristic on ${t.n} held-out fights: ${t.diff >= 0 ? '+' : ''}${t.diff.toFixed(3)} ± ${t.se.toFixed(3)} (${Math.abs(t.diff) > 2 * t.se ? 'beyond' : 'within'} 2 SE) | style ${t.style.toFixed(3)} gates [${t.gates}] | survival ${(100 * t.surv).toFixed(1)} pts | deviates ${(100 * t.dev).toFixed(1)}%`); }
})().catch(e => { console.error(e); process.exit(1); });
