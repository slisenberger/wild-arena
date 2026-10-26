// Milestone 3 coordinator: evolution strategies for a movement-intent policy with a goal reward and a style constraint.
// A run is a state file that moves through phases: calib -> train (gens) -> test -> done. Every step is
//   jobs  : write the next step's jobs file (candidates × paired fights; plain JSON, self-contained)
//   work  : any number of `node policy/train_worker.js jobs.json out_i.json i/n` shards, anywhere
//   merge : read all shard outputs, update the state, checkpoint it (atomic write)
// `run` does jobs -> local worker threads -> merge in a loop, so a local run and a sharded CI run are the same code.
//
//   node policy/train.js init  state.json [--key=value ...] [--dry-run]
//   node policy/train.js jobs  state.json jobs.json
//   node policy/train.js merge state.json jobs.json out_0.json [out_1.json ...]
//   node policy/train.js run   state.json [--threads=4] [--serial] [--steps=N] [--until=test|done]
//   node policy/train.js report state.json
//   node policy/train.js retest state.json [--which=center|best] [--fights=400] [--index=1]   (read-only extra test draw)
// Resuming = running `run` (or jobs/merge) again on the same state file: the next step depends only on the state.
const fs = require('fs');
const path = require('path');
const R = require('./move_run.js');
const M = require('./move_model.js');
const { arch: archOf } = require('./move_arch.js');
const RW = require('./move_reward.js');
const WK = require('./train_worker.js');

const STATE_FORMAT = 'wild-arena/move-state', STATE_VERSION = 1;
const DEFAULTS = {
  arch: 'harrier',           // 'harrier' (the other side's pack hunters) or 'guard' (your guards); see move_arch.js
  seed: 1, mode: 'linear', nh: 0, margin: 1,
  sigma: .1, lr: .08, pairs: 8, gens: 8,
  fights: 'auto',            // fights per candidate per generation; 'auto' = from calibration (see calibN)
  fightsMin: 100, fightsMax: 300,
  calibFights: 400, calibPerturb: 4,
  valEvery: 2, valFights: 'auto', valMax: 800, testFights: 'auto', testMax: 1200,
  effect: 'auto',            // realistic effect size (goal units) for the 2 SE sample-size rule; auto = from calibration
  styleThr: .9, lambda0: 1, lambdaLr: 4, gatePenalty: .25,
  holdMap: null,             // a map kept out of train/validation (the test always covers every map)
  acceptNoDrift: true,       // validation acceptance also requires no telemetry drift flags
  baseline: true,            // also run zero weights on each generation's train fights: curves relative to the heuristic
  initRule: null,            // warm start: 'patient' = wait while stronger guards block and the target isn't busy or easy (probe winner, +0.06)
};
const DRY = {calibFights: 24, calibPerturb: 1, pairs: 2, fights: 12, gens: 1, valEvery: 1, valFights: 12, testFights: 12};

// ---------- state ----------
function load(file){
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (s.format !== STATE_FORMAT || s.version !== STATE_VERSION) throw new Error(`${file}: not a v${STATE_VERSION} ${STATE_FORMAT} file`);
  const sh = R.simHash(), hh = R.harnessHash();
  if ((s.simHash !== sh || s.harnessHash !== hh) && !process.env.ALLOW_ENGINE_CHANGE)
    throw new Error(`${file} was made with sim ${s.simHash} / harness ${s.harnessHash}; this checkout has ${sh} / ${hh}. The engine changed: start a new run (or ALLOW_ENGINE_CHANGE=1 to continue anyway).`);
  return s;
}
function save(file, s){ const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(s)); fs.renameSync(tmp, file); }
function logLine(file, line, quiet){ fs.appendFileSync(file + '.log', line + '\n'); if (!quiet) console.log(line); }
function init(opts){
  const cfg = Object.assign({}, DEFAULTS, opts.dry ? DRY : {}, opts.cfg);
  const AR = archOf(cfg.arch), F = AR.F;
  const P0 = M.zeros(F.DIM, cfg.nh, cfg.margin, AR.nout); if (cfg.nh) M.withHidden(P0, R.A.rng(cfg.seed * 31 + 7));
  const theta0 = M.flat(P0, cfg.mode);
  if (cfg.initRule){ // encode a hand-written rule in the linear term (the trainable vector starts [bl, Wl], Wl row-major per intent)
    const IN = AR.intents, NOUT = IN.length, f = n => F.NAMES.indexOf(n), wl = (a, n, v) => { theta0[NOUT + IN.indexOf(a) * F.DIM + f(n)] = v; };
    if (cfg.initRule === 'patient' && cfg.arch === 'harrier'){ const k = 2.5 * Math.max(1, cfg.margin); wl('wait', 'guardsBlock', k); wl('wait', 'tBusy', -k); wl('wait', 'tEasy', -k); }
    else throw new Error('unknown initRule ' + cfg.initRule + ' for ' + cfg.arch);
  }
  return {format: STATE_FORMAT, version: STATE_VERSION, simHash: R.simHash(), harnessHash: R.harnessHash(), created: new Date().toISOString(),
    config: cfg, features: F.NAMES, intents: AR.intents, P0, phase: 'calib', gen: 0, theta: theta0,
    adam: {m: null, v: null, t: 0}, lambda: cfg.lambda0, best: {theta: M.flat(P0, cfg.mode), gen: -1, from: 'zero'}, valIndex: 0,
    calib: null, ref: null, N: null, history: [], val: [], test: null};
}
const weightsOf = (s, theta) => M.unflat(s.P0, theta, s.config.mode);

// ES noise for generation g: deterministic from (seed, g), so a resumed run draws the same perturbations
function gauss(R0){ let u = 0; while (!u) u = R0(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R0()); }
function noise(s, g, salt){ const R0 = R.A.rng((s.config.seed * 1000003 + g * 7919 + (salt || 0)) >>> 0); return [...Array(s.config.pairs)].map(() => s.theta.map(() => gauss(R0))); }
const fopts = s => ({seed: s.config.seed, arch: s.config.arch, holdMap: s.config.holdMap});

// ---------- jobs ----------
// validation: the current centre vs the best so far, on a fresh draw from the validation pool (each check its own draw)
function valSet(s, add){ return {name: 'val', cands: [add(weightsOf(s, s.best.theta)), add(weightsOf(s, s.theta))], fights: R.fightSet('val', s.valIndex, s.N.val, fopts(s)), valIndex: s.valIndex}; }
function makeJobs(s){
  const c = s.config, sets = [], cands = [];
  const add = P => { cands.push(P); return cands.length - 1; };
  if (s.phase === 'calib'){
    // heuristic (zero weights) + a few ES-sized perturbations on the same calibration fights: reference profile,
    // reward variance and the paired-difference noise that sets N
    const Z = add(weightsOf(s, s.theta)), eps = noise(s, -1, 99), ids = [Z];
    for (let k = 0; k < c.calibPerturb; k++) ids.push(add(weightsOf(s, s.theta.map((v, i) => v + c.sigma * eps[k % eps.length][i]))));
    sets.push({name: 'calib', cands: ids, fights: R.fightSet('calib', 0, c.calibFights, fopts(s))});
  } else if (s.phase === 'train'){
    const eps = noise(s, s.gen), ids = [];
    for (const e of eps){ ids.push(add(weightsOf(s, s.theta.map((v, i) => v + c.sigma * e[i])))); ids.push(add(weightsOf(s, s.theta.map((v, i) => v - c.sigma * e[i])))); }
    if (c.baseline) ids.push(add(weightsOf(s, s.theta.map(() => 0)))); // last: the heuristic on the same fights (not in the ES update)
    sets.push({name: 'train', cands: ids, fights: R.fightSet('train', s.gen, s.N.train, fopts(s))});
    if (s.gen > 0 && s.gen % c.valEvery === 0) sets.push(valSet(s, add));
  } else if (s.phase === 'val'){ // the final centre (after the last update) gets its own validation check
    sets.push(valSet(s, add));
  } else if (s.phase === 'test'){
    sets.push({name: 'test', cands: [add(weightsOf(s, s.theta.map(() => 0))), add(weightsOf(s, s.best.theta))], fights: R.fightSet('test', 0, s.N.test, fopts(s))});
  } else throw new Error('nothing to do: phase ' + s.phase);
  const body = {format: WK.JOBS_FORMAT, version: WK.VERSION, simHash: s.simHash, harnessHash: s.harnessHash, arch: c.arch, phase: s.phase, gen: s.gen, seed: c.seed, config: c, cands, sets};
  body.id = require('crypto').createHash('sha1').update(JSON.stringify(body)).digest('hex').slice(0, 16);
  return body;
}

// ---------- merge ----------
function collect(jobs, outs){
  const tasks = WK.tasksOf(jobs), got = new Array(tasks.length);
  for (const o of outs){
    if (o.format !== WK.OUT_FORMAT || o.jobsId !== jobs.id) throw new Error(`result file is for jobs ${o.jobsId}, expected ${jobs.id}`);
    for (const r of o.results){ if (got[r.k]) throw new Error('task ' + r.k + ' twice'); got[r.k] = r.rec; }
  }
  const missing = got.reduce((n, r) => n + !r, 0) + (tasks.length - got.length);
  if (missing) throw new Error(`${missing} of ${tasks.length} tasks missing: run every shard`);
  // recs[set][candIdxInSet] = fight records in fight order
  return jobs.sets.map((st, si) => st.cands.map(c => tasks.filter(t => t.s === si && t.c === c).map(t => got[t.k])));
}
// decisions per intent summed over a fight set (records from a no-policy run count nothing)
function intentSums(recs, s){ const z = () => new Array(archOf(s.config.arch).nout).fill(0); return recs.reduce((a, r) => (r.intents || z()).map((v, k) => a[k] + v), z()); }
function candSummary(s, recs, N){
  const m = RW.metrics(recs), g = RW.grade(m, s.ref, N), goals = recs.map(RW.goal);
  const it = intentSums(recs, s), tot = it.reduce((a, b) => a + b, 0) || 1;
  const styleEff = g.style - s.config.gatePenalty * g.failed.length;
  return {goal: RW.mean(goals), goalSE: RW.se(goals), style: g.style, styleEff, gates: g.failed, drift: RW.drift(m, s.ref, N),
    intents: it.map(v => +(v / tot).toFixed(3)), tel: Object.fromEntries(Object.entries(m).map(([k, v]) => [k, +v.toFixed(4)]))};
}
// sample sizes from calibration: n for a 2 SE detection of effect δ with paired per-fight SD sd is (2·sd/δ)²
function calibN(s, z, perts){
  const c = s.config, gz = z.map(RW.goal);
  const parts = Object.keys(RW.goalParts(z[0])), comp = {};
  for (const p of parts){ const a = z.map(r => RW.goalParts(r)[p]); comp[p] = {mean: RW.mean(a), sd: RW.sd(a)}; }
  const pd = perts.map(pr => pr.map((r, i) => RW.goal(r) - gz[i]));
  const sdPair = pd.length ? Math.sqrt(RW.mean(pd.map(d => RW.sd(d) ** 2))) : RW.sd(gz);
  // realistic effect: the spread of true effects among ES-sized perturbations that stay realistic (style >= threshold,
  // gates pass; observed variance of their means minus sampling variance), floored at 0.1 × the heuristic's per-fight
  // goal SD. Unrealistic perturbations are excluded: they can move the goal a lot (e.g. harriers that hang back and
  // survive), which would make N look smaller than the effects ES can actually accept.
  const feas = perts.map(pr => { const g = RW.grade(RW.metrics(pr), s.ref, pr.length); return g.style >= c.styleThr && g.gatesPass; });
  const means = pd.map(RW.mean), fm = means.filter((_, i) => feas[i]), samp = RW.mean(pd.map(d => RW.se(d) ** 2));
  const trueSD = fm.length > 1 ? Math.sqrt(Math.max(0, RW.sd(fm) ** 2 - samp)) : fm.length === 1 ? Math.max(0, Math.abs(fm[0]) - Math.sqrt(samp)) : 0;
  const floor = .1 * RW.sd(gz);
  const effect = c.effect === 'auto' ? Math.max(trueSD, floor) : +c.effect;
  const nFor = d => Math.ceil((2 * sdPair / d) ** 2);
  // ES: an antithetic difference needs the gradient signal (≈ effect) above its noise (√2 · sdPair / √n) -> n ≈ 2·(sdPair/effect)², i.e. 1 SE
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const N = {
    train: c.fights === 'auto' ? clamp(Math.ceil(2 * (sdPair / effect) ** 2), c.fightsMin, c.fightsMax) : +c.fights,
    val: c.valFights === 'auto' ? Math.min(c.valMax, nFor(effect)) : +c.valFights,
    test: c.testFights === 'auto' ? Math.min(c.testMax, nFor(effect)) : +c.testFights,
  };
  return {N, calib: {n: z.length, goal: {mean: RW.mean(gz), sd: RW.sd(gz)}, components: comp, sdPair, perturbMeans: means, perturbFeasible: feas, perturbSE: Math.sqrt(samp), trueSD, effect,
    nDetect: {effect: nFor(effect), 'effect×2': nFor(2 * effect), '0.05': nFor(.05), '0.1': nFor(.1)}, capped: {val: N.val < nFor(effect), test: N.test < nFor(effect)}}};
}
// accept the centre theta as the new best only if it beats the best by > 2 SE on this fresh draw, its style clears the
// threshold, the realism gates pass and (acceptNoDrift) no telemetry drifted outside the heuristic's normal range
function validate(s, vs, recs, theta, out){
  const c = s.config, [rb, rc] = recs, P = RW.paired(rb, rc, s.ref);
  const ok = P.diff > 2 * P.se, styleOk = P.styleB.style >= c.styleThr && P.styleB.gatesPass, driftOk = !c.acceptNoDrift || !P.driftB.length;
  const accept = ok && styleOk && driftOk, label = `after ${s.phase === "train" ? s.gen : s.history.length} updates`;
  s.val.push({gen: s.gen, phase: s.phase, valIndex: vs.valIndex, n: P.n, diff: P.diff, se: P.se, goalBest: P.goalA, goalCenter: P.goalB, style: P.styleB.style, gates: P.styleB.failed, drift: P.driftB, accept, vsBest: s.best.from, center: label});
  const nc = recs.map(a => { const it = intentSums(a, s), n = it.reduce((x, y) => x + y, 0); return n ? 1 - it[0] / n : 0; });
  s.val[s.val.length - 1].nonCommit = {best: nc[0], center: nc[1]};
  out(`  [val #${vs.valIndex}] centre (${label}, non-commit ${(100 * nc[1]).toFixed(1)}%) vs best (${s.best.from}) on ${P.n} fresh fights: ${P.diff >= 0 ? '+' : ''}${P.diff.toFixed(3)} ± ${P.se.toFixed(3)} | style ${P.styleB.style.toFixed(3)} gates [${P.styleB.failed}] drift [${P.driftB.join('; ')}] -> ${accept ? 'ACCEPT' : 'keep best'}`);
  if (accept) s.best = {theta: theta.slice(), gen: s.gen, from: label};
  s.valIndex++;
}
function merge(s, jobs, outs, wall, file, quiet){
  if (jobs.phase !== s.phase || jobs.gen !== s.gen) throw new Error(`jobs are for ${jobs.phase} gen ${jobs.gen}, state is at ${s.phase} gen ${s.gen}`);
  const recs = collect(jobs, outs), c = s.config, nf = WK.tasksOf(jobs).length, fps = wall ? nf / wall : null;
  const out = file ? l => logLine(file, l, quiet) : () => {};
  if (s.phase === 'calib'){
    const [z, ...perts] = recs[0];
    s.ref = RW.reference(z);
    const {N, calib} = calibN(s, z, perts); s.N = N; s.calib = calib;
    const zs = candSummary(s, z, z.length);
    s.calib.heuristic = zs;
    out(`[calib] ${z.length} fights × ${recs[0].length} arms, ${wall ? wall.toFixed(0) + ' s, ' + fps.toFixed(1) + ' fights/s' : ''}`);
    out(`  heuristic goal ${calib.goal.mean.toFixed(3)} (sd ${calib.goal.sd.toFixed(3)}); parts ${Object.entries(calib.components).map(([k, v]) => `${k} ${v.mean.toFixed(3)}±sd${v.sd.toFixed(3)}`).join(', ')}`);
    out(`  paired per-fight sd ${calib.sdPair.toFixed(3)}; perturbation effects ${calib.perturbMeans.map(v => v.toFixed(3)).join(' ')} (SE ${calib.perturbSE.toFixed(3)}), true-effect sd ${calib.trueSD.toFixed(3)} -> effect ${calib.effect.toFixed(3)}`);
    out(`  fights for 2 SE: ${JSON.stringify(calib.nDetect)} -> N train ${N.train}, val ${N.val}${calib.capped.val ? ' (capped)' : ''}, test ${N.test}${calib.capped.test ? ' (capped)' : ''}`);
    s.phase = c.gens > 0 ? 'train' : 'test';
  } else if (s.phase === 'train'){
    const tr = recs[0].slice(0, 2 * c.pairs), base = c.baseline ? recs[0][2 * c.pairs] : null, sum = tr.map(r => candSummary(s, r, r.length));
    const g0 = base ? RW.mean(base.map(RW.goal)) : null;
    const fit = sum.map(q => q.goal + s.lambda * (q.styleEff - c.styleThr));
    // centered ranks, antithetic gradient, Adam ascent
    const order = fit.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), rank = new Array(fit.length);
    // ties (e.g. both arms of a pair still below the commit margin = identical fights) share their average rank, so an
    // unchanged pair contributes no gradient instead of a spurious one from index order
    for (let a = 0; a < order.length;){ let b = a; while (b + 1 < order.length && order[b + 1][0] === order[a][0]) b++; for (let q = a; q <= b; q++) rank[order[q][1]] = (a + b) / 2 / (fit.length - 1) - .5; a = b + 1; }
    const eps = noise(s, s.gen), g = s.theta.map(() => 0);
    eps.forEach((e, k) => { const w0 = rank[2 * k] - rank[2 * k + 1]; for (let i = 0; i < g.length; i++) g[i] += w0 * e[i]; });
    for (let i = 0; i < g.length; i++) g[i] /= 2 * eps.length * c.sigma;
    const A0 = s.adam; if (!A0.m){ A0.m = g.map(() => 0); A0.v = g.map(() => 0); } A0.t++;
    const b1 = .9, b2 = .999;
    for (let i = 0; i < g.length; i++){ A0.m[i] = b1 * A0.m[i] + (1 - b1) * g[i]; A0.v[i] = b2 * A0.v[i] + (1 - b2) * g[i] * g[i]; }
    const theta0 = s.theta.slice();
    s.theta = s.theta.map((v, i) => v + c.lr * (A0.m[i] / (1 - b1 ** A0.t)) / (Math.sqrt(A0.v[i] / (1 - b2 ** A0.t)) + 1e-8));
    const styleMean = RW.mean(sum.map(q => q.styleEff));
    const lambda0 = s.lambda; s.lambda = Math.max(0, s.lambda + c.lambdaLr * (c.styleThr - styleMean));
    const ib = fit.indexOf(Math.max(...fit));
    const h = {gen: s.gen, fights: nf, wall, fps, goalHeuristic: g0, goalMean: RW.mean(sum.map(q => q.goal)), goalBest: sum[ib].goal, styleMean, styleMin: Math.min(...sum.map(q => q.styleEff)),
      feasible: sum.filter(q => q.styleEff >= c.styleThr && !q.gates.length).length / sum.length, lambda: lambda0, lambdaNext: s.lambda,
      flagged: sum.filter(q => q.drift.length).length, step: Math.hypot(...s.theta.map((v, i) => v - theta0[i])), norm: Math.hypot(...s.theta),
      nonCommit: RW.mean(sum.map(q => 1 - q.intents[0])), cands: sum};
    out(`[gen ${s.gen}] goal mean ${h.goalMean.toFixed(3)} best ${h.goalBest.toFixed(3)}${g0 === null ? '' : ` (heuristic ${g0.toFixed(3)}: mean ${(h.goalMean - g0 >= 0 ? '+' : '') + (h.goalMean - g0).toFixed(3)})`} | style mean ${h.styleMean.toFixed(3)} min ${h.styleMin.toFixed(3)} feasible ${(100 * h.feasible).toFixed(0)}% | λ ${lambda0.toFixed(2)}→${s.lambda.toFixed(2)} | non-commit ${(100 * h.nonCommit).toFixed(1)}% | drift-flagged ${h.flagged}/${sum.length} | |θ| ${h.norm.toFixed(3)} | ${nf} fights${wall ? `, ${wall.toFixed(0)} s, ${fps.toFixed(1)}/s` : ''}`);
    for (const q of sum) if (q.drift.length || q.gates.length) out(`    flagged: goal ${q.goal.toFixed(3)} style ${q.style.toFixed(3)} gates [${q.gates}] drift [${q.drift.join('; ')}]`);
    s.history.push(h);
    if (recs[1]) validate(s, jobs.sets[1], recs[1], theta0, out);
    s.gen++;
    if (s.gen >= c.gens) s.phase = 'val';
  } else if (s.phase === 'val'){
    validate(s, jobs.sets[0], recs[0], s.theta, out);
    s.phase = 'test';
  } else if (s.phase === 'test'){
    const [rz, rb] = recs[0], fights = jobs.sets[0].fights, P = RW.paired(rz, rb, s.ref);
    const perMap = {};
    for (const tr of R.TERR){ const ix = fights.map((f, i) => f.tr === tr ? i : -1).filter(i => i >= 0); if (!ix.length) continue; const d = ix.map(i => RW.goal(rb[i]) - RW.goal(rz[i])); perMap[tr] = {n: ix.length, diff: RW.mean(d), se: RW.se(d)}; }
    const surv = a => RW.mean(a.map(r => r.survived)), kill = a => RW.mean(a.map(r => r.killedYou));
    s.test = {n: P.n, best: s.best.from, diff: P.diff, se: P.se, sig: Math.abs(P.diff) > 2 * P.se, goalZero: P.goalA, goalBest: P.goalB, style: P.styleB.style, gates: P.styleB.failed, drift: P.driftB, perMap,
      yourWin: {zero: surv(rz), best: surv(rb)}, killedYou: {zero: kill(rz), best: kill(rb)}, holdMap: c.holdMap};
    out(`[test] best (${s.best.from}) vs zero weights on ${P.n} held-out fights: ${P.diff >= 0 ? '+' : ''}${P.diff.toFixed(3)} ± ${P.se.toFixed(3)} (${s.test.sig ? 'beyond' : 'within'} 2 SE) | style ${P.styleB.style.toFixed(3)} gates [${P.styleB.failed}] drift [${P.driftB.join('; ')}]`);
    out(`  per map: ${Object.entries(perMap).map(([k, v]) => `${k} ${v.diff.toFixed(3)}±${v.se.toFixed(3)} (n ${v.n})`).join(', ')}; your win% ${(100 * s.test.yourWin.zero).toFixed(1)} -> ${(100 * s.test.yourWin.best).toFixed(1)}`);
    s.phase = 'done';
  }
  return s;
}

// ---------- local driver ----------
async function runLocal(file, opts){
  let s = load(file); const steps = opts.steps || Infinity, stopAt = opts.hours ? Date.now() + opts.hours * 3600e3 : Infinity;
  for (let k = 0; k < steps && s.phase !== 'done' && s.phase !== opts.until && Date.now() < stopAt; k++){ // --hours: wall-clock budget (CI job limits); the state is saved after every step
    const jobs = makeJobs(s), t0 = Date.now();
    const res = await WK.runShard(jobs, 0, 1, opts.serial ? 1 : (opts.threads || 4));
    const wall = (Date.now() - t0) / 1000;
    s = merge(s, jobs, [WK.resultsFile(jobs, 0, 1, res, wall)], wall, file, opts.quiet);
    save(file, s);
  }
  return s;
}
// extra read-only test: zero weights vs the centre (or best) on a fresh draw from the test pool (index >= 1; index 0 is
// the official test). For a null run (best = zero) this is the informative check of where ES ended up.
async function retest(file, opts){
  const s = load(file), theta = opts.which === 'best' ? s.best.theta : s.theta, n = opts.fights || 400, index = opts.index || 1;
  if (index < 1) throw new Error('index 0 is the official test draw');
  const fights = R.fightSet('test', index, n, fopts(s)), cands = [weightsOf(s, s.theta.map(() => 0)), weightsOf(s, theta)];
  const jobs = {format: WK.JOBS_FORMAT, version: WK.VERSION, simHash: s.simHash, harnessHash: s.harnessHash, arch: s.config.arch, phase: 'retest', gen: s.gen, seed: s.config.seed, config: s.config, cands, sets: [{name: 'retest', cands: [0, 1], fights}]};
  const t0 = Date.now(), res = await WK.runShard(jobs, 0, 1, opts.threads || 4), wall = (Date.now() - t0) / 1000;
  const rz = res.slice(0, n).map(r => r.rec), rc = res.slice(n).map(r => r.rec), P = RW.paired(rz, rc, s.ref);
  const it = intentSums(rc, s), tot = it.reduce((a, b) => a + b, 0) || 1;
  const tel = k => `${k} ${P.mA[k].toFixed(3)}→${P.mB[k].toFixed(3)}`;
  logLine(file, `[retest #${index}] ${opts.which === 'best' ? 'best' : 'centre'} vs zero on ${n} fresh test fights (${wall.toFixed(0)} s): ${P.diff >= 0 ? '+' : ''}${P.diff.toFixed(3)} ± ${P.se.toFixed(3)} (${Math.abs(P.diff) > 2 * P.se ? 'beyond' : 'within'} 2 SE) | style ${P.styleB.style.toFixed(3)} gates [${P.styleB.failed}] | intents ${it.map(v => (100 * v / tot).toFixed(1) + '%').join(' ')} | ${['dartRate', 'meanDist', 'noContact', 'deathRate', 'humanShare'].map(tel).join(', ')} | drift [${P.driftB.join('; ')}]`);
  return P;
}
function report(s){
  console.log(`state: phase ${s.phase}, gen ${s.gen}/${s.config.gens}, λ ${s.lambda.toFixed(2)}, best ${s.best.from}, sim ${s.simHash}`);
  if (s.calib) console.log(`calib: heuristic goal ${s.calib.goal.mean.toFixed(3)}, paired sd ${s.calib.sdPair.toFixed(3)}, effect ${s.calib.effect.toFixed(3)}, N ${JSON.stringify(s.N)}`);
  for (const h of s.history) console.log(`gen ${h.gen}: goal ${h.goalMean.toFixed(3)} / best ${h.goalBest.toFixed(3)}${h.goalHeuristic == null ? '' : ` / heuristic ${h.goalHeuristic.toFixed(3)}`}, style ${h.styleMean.toFixed(3)}, λ ${h.lambda.toFixed(2)}, non-commit ${(100 * h.nonCommit).toFixed(1)}%, flagged ${h.flagged}`);
  for (const v of s.val) console.log(`val gen ${v.gen} (#${v.valIndex}): ${v.diff.toFixed(3)} ± ${v.se.toFixed(3)} style ${v.style.toFixed(3)} ${v.accept ? 'ACCEPT' : ''}`);
  if (s.test) console.log(`test: ${s.test.diff.toFixed(3)} ± ${s.test.se.toFixed(3)} (${s.test.sig ? 'significant' : 'within noise'}), style ${s.test.style.toFixed(3)}`);
}
module.exports = { DEFAULTS, DRY, init, load, save, makeJobs, merge, runLocal, retest, report, weightsOf, noise };

if (require.main === module){
  const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--'));
  const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v === undefined ? true : v]; }));
  const num = v => v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v;
  const [cmd, file] = pos;
  (async () => {
    if (cmd === 'init'){
      const cfg = {}; for (const [k, v] of Object.entries(opt)) if (k in DEFAULTS) cfg[k] = num(v);
      const s = init({dry: !!opt['dry-run'], cfg}); save(file, s);
      logLine(file, `[init] ${file}: sim ${s.simHash}, harness ${s.harnessHash}, ${s.features.length} features (${s.config.arch}), ${s.theta.length} trainable, config ${JSON.stringify(s.config)}`);
    } else if (cmd === 'jobs'){
      const s = load(file), jobs = makeJobs(s); fs.writeFileSync(pos[2], JSON.stringify(jobs));
      console.log(`${s.phase} gen ${s.gen}: ${WK.tasksOf(jobs).length} fights -> ${pos[2]} (jobs ${jobs.id})`);
    } else if (cmd === 'merge'){
      const s = load(file), jobs = JSON.parse(fs.readFileSync(pos[2], 'utf8')), outs = pos.slice(3).map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
      const wall = Math.max(...outs.map(o => o.wall || 0)); merge(s, jobs, outs, wall, file); save(file, s);
    } else if (cmd === 'run'){
      await runLocal(file, {threads: +(opt.threads || 4), serial: !!opt.serial, steps: opt.steps ? +opt.steps : Infinity, until: opt.until, hours: opt.hours ? +opt.hours : 0});
    } else if (cmd === 'report'){ report(load(file)); }
    else if (cmd === 'retest'){ await retest(file, {which: opt.which, fights: opt.fights ? +opt.fights : 400, index: opt.index ? +opt.index : 1, threads: +(opt.threads || 4)}); }
    else { console.error('usage: node policy/train.js init|jobs|merge|run|report|retest state.json ...'); process.exit(2); }
  })().catch(e => { console.error(e.message); process.exit(1); });
}
