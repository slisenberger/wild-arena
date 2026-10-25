// Milestone 2: evolution strategies (OpenAI-ES style) over the policy weights, starting from the behavior-cloned net.
// Reward for the other side's predators (the policy controls only them), per fight:
//   game  = damage they deal to your side / 1000 + KILL_BONUS if a predator kills you − DEATH_PEN per predator that dies
//   train = game − λ × (share of the net's own decisions that differ from the heuristic's)  (realism; λ annealed, never 0)
// Each generation: PAIRS antithetic perturbations (σ, standardized input space), every candidate plays the same fresh
// fights (FMAP boards per map, 1 fight each, a new seed stream per generation), centered-rank fitness shaping, Adam step.
// Every VAL_EVERY generations the current net plays a FIXED validation set (VMAP boards per map, common seeds) and is
// compared, fight by fight, with the best net so far (game reward) and with the heuristic (realism gates, gates.js):
//   paired gain > ACCEPT_SE standard errors and gates pass -> new best (checkpointed);
//   paired loss > REVERT_SE standard errors                -> back to the best net (Adam state reset).
// Usage: node policy/es.js [outDir=policy/es_run]   env: MODE=full|linear INIT GENS PAIRS FMAP SIG LR LAM0 LAM1 VAL_EVERY VMAP MINUTES RESUME=1
// Writes outDir/log.txt, outDir/state.json (resume), outDir/best.json (best validated weights), outDir/best_<gen>.json.
const { isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), fs = require('fs');
const KILL_BONUS = 5, DEATH_PEN = 1;
const game = r => r.foe / 1000 + KILL_BONUS * r.killed - DEATH_PEN * r.deaths;
if (!isMainThread){
  const { fight } = require('./run.js');
  parentPort.postMessage(workerData.jobs.map(j => Object.assign(fight(j, j.ci < 0 ? null : workerData.cands[j.ci], workerData.prof), {i: j.i, ci: j.ci})));
  return;
}
const { A, boardJobs, pool } = require('./common.js');
const M = require('./model.js'), G = require('./gates.js'), { mean, se } = G;
const E = k => process.env[k];
const GENS = +E('GENS') || 60, PAIRS = +E('PAIRS') || 10, FMAP = +E('FMAP') || 40, SIG = +E('SIG') || .15, LR = +E('LR') || .02,
  LAM0 = +E('LAM0') || 4, LAM1 = +E('LAM1') || 1, VAL_EVERY = +E('VAL_EVERY') || 2, VMAP = +E('VMAP') || 100, MINUTES = +E('MINUTES') || 150;
const ACCEPT_SE = 1, REVERT_SE = 2;
const out = path.resolve(process.argv[2] || path.join(__dirname, 'es_run')); fs.mkdirSync(out, {recursive: true});
const logf = path.join(out, 'log.txt'), log = s => { console.log(s); fs.appendFileSync(logf, s + '\n'); };
const B = JSON.parse(fs.readFileSync(path.join(__dirname, 'bc_weights.json'), 'utf8')), {nin, nh} = B, mu = B.norm.mu, sd = B.norm.sd;
// parameters live in standardized-input space (one σ means the same for every input); folded back for the sim
const unfold = P => { const Q = JSON.parse(JSON.stringify(P)); for (let j = 0; j < nh; j++) for (let i = 0; i < nin; i++){ Q.W1[j * nin + i] = P.W1[j * nin + i] * sd[i]; Q.b1[j] += P.W1[j * nin + i] * mu[i]; } return Q; };
const fold = P => { const Q = JSON.parse(JSON.stringify(P)); for (let j = 0; j < nh; j++) for (let i = 0; i < nin; i++){ Q.W1[j * nin + i] = P.W1[j * nin + i] / sd[i]; Q.b1[j] -= P.W1[j * nin + i] * mu[i] / sd[i]; } return Q; };
// MODE=full: ES over every weight of the net. MODE=linear: the behavior-cloned net is frozen and ES trains a linear skip
// term Wl over the option-specific inputs (option type, target and feed features; context inputs are the same for every
// option of a decision, so a linear term on them could not change a choice). Far fewer dimensions = far less gradient noise.
const MODE = E('MODE') || 'full';
const F = require('./features.js'), LIN = F.NAMES.map((n, i) => i).filter(i => i < F.NAMES.indexOf('hunger')); // everything before the context block
const toW = MODE === 'linear'
  ? th => { const Q = JSON.parse(JSON.stringify(B)); delete Q.names; delete Q.norm; delete Q.note; Q.Wl = new Array(nin).fill(0); LIN.forEach((i, k) => Q.Wl[i] = th[k] / sd[i]); return Q; }
  : th => fold(M.unflat(th, nin, nh));
const save = (f, th, note) => { const o = toW(th); o.names = B.names; o.norm = B.norm; o.note = note; fs.writeFileSync(f, JSON.stringify(o)); };
const nP = MODE === 'linear' ? LIN.length : M.flat(B).length;

async function runSet(jobs, cands, prof){ // -> rows[ci][i]
  const js = []; cands.forEach((_, ci) => jobs.forEach((j, i) => js.push(Object.assign({}, j, {i, ci: cands[ci] ? ci : -1}))));
  const rows = await pool(__filename, js, {cands, prof});
  const by = cands.map(() => new Array(jobs.length)); for (const r of rows) by[r.ci < 0 ? cands.indexOf(null) : r.ci][r.i] = r;
  return by;
}
const paired = (a, b, f) => { const d = a.map((r, i) => f(b[i]) - f(r)); return {m: mean(d), s: se(d)}; };
const summ = rows => `game ${mean(rows.map(game)).toFixed(3)}, dmg ${mean(rows.map(r => r.foe)).toFixed(0)}, killed you ${(100 * mean(rows.map(r => r.killed))).toFixed(1)}%, deaths ${mean(rows.map(r => r.deaths)).toFixed(2)}, your wins ${(100 * mean(rows.map(r => r.won))).toFixed(1)}%, disagree ${(100 * mean(rows.map(r => r.dis))).toFixed(1)}%`;

(async () => {
  const t0 = Date.now(), el = () => ((Date.now() - t0) / 60000).toFixed(1) + ' min';
  const theta0 = MODE === 'linear' ? new Array(nP).fill(0) : M.flat(unfold(B));
  // INIT (linear mode): start the walk from a screened bias, e.g. INIT=isHuman:2,humanAppetite:4 (standardized units);
  // the best-so-far stays the behavior-cloned net until the walk beats it on the validation set
  const init = theta0.slice(); if (E('INIT')) for (const kv of E('INIT').split(',')){ const [n, v] = kv.split(':'), k = LIN.indexOf(F.NAMES.indexOf(n)); if (k < 0) throw new Error('INIT: ' + n); init[k] = +v; }
  const V = boardJobs(VMAP, 1, 4004);
  const sf = path.join(out, 'state.json');
  let S;
  if (E('RESUME') && fs.existsSync(sf)){ S = JSON.parse(fs.readFileSync(sf, 'utf8')); log(`resumed at generation ${S.gen}`); }
  else {
    log(`ES (${MODE}) from bc_weights.json: ${nP} params, GENS ${GENS}, PAIRS ${PAIRS}, ${4 * FMAP} fights/candidate/gen, σ ${SIG}, Adam lr ${LR}, λ ${LAM0}->${LAM1}${E('INIT') ? ', init ' + E('INIT') : ''}, validation ${V.length} fights every ${VAL_EVERY} gens, accept > ${ACCEPT_SE} SE, revert < -${REVERT_SE} SE`);
    const [Hr, Br] = await runSet(V, [null, toW(theta0)], true);
    const g = G.check(Hr, Br);
    log(`validation heuristic: ${summ(Hr)}\nvalidation BC:        ${summ(Br)}; gates ${g.pass ? 'pass' : 'FAIL: ' + g.fails.join('; ')}  (${el()})`);
    S = {gen: 0, theta: init.slice(), best: theta0.slice(), bestGen: 0, Hr, bestRows: Br, m1: new Array(nP).fill(0), m2: new Array(nP).fill(0), t: 0, history: []};
    save(path.join(out, 'best.json'), theta0, 'ES best = BC (generation 0)');
  }
  const R = A.rng(7 + 1000 * S.gen), gauss = () => { let u = 0; while (!u) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); };
  while (S.gen < GENS && (Date.now() - t0) / 60000 < MINUTES){
    const g = S.gen, lam = LAM1 + (LAM0 - LAM1) * Math.max(0, 1 - g / (GENS * .75));
    const eps = Array.from({length: PAIRS}, () => Array.from({length: nP}, gauss));
    const cands = [S.theta, ...eps.flatMap(e => [S.theta.map((v, i) => v + SIG * e[i]), S.theta.map((v, i) => v - SIG * e[i])])].map(toW);
    const fights = boardJobs(FMAP, 1, 10000 + g);
    const by = await runSet(fights, cands, false);
    const Rw = by.map(rs => mean(rs.map(r => game(r) - lam * r.dis)));
    const pert = Rw.slice(1), order = pert.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]), rank = new Array(pert.length);
    order.forEach(([, i], k) => rank[i] = k / (pert.length - 1) - .5);
    const grad = new Array(nP).fill(0);
    for (let p = 0; p < PAIRS; p++){ const a = rank[2 * p] - rank[2 * p + 1]; for (let i = 0; i < nP; i++) grad[i] += a * eps[p][i] / (PAIRS * SIG); }
    S.t++; const b1 = .9, b2 = .999, c1 = 1 - b1 ** S.t, c2 = 1 - b2 ** S.t;
    for (let i = 0; i < nP; i++){ S.m1[i] = b1 * S.m1[i] + (1 - b1) * grad[i]; S.m2[i] = b2 * S.m2[i] + (1 - b2) * grad[i] ** 2; S.theta[i] += LR * (S.m1[i] / c1) / (Math.sqrt(S.m2[i] / c2) + 1e-8); }
    S.gen++;
    const drift = Math.sqrt(S.theta.reduce((a, v, i) => a + (v - theta0[i]) ** 2, 0) / nP);
    log(`gen ${S.gen} (λ ${lam.toFixed(2)}): centre ${summ(by[0])} | perturbations reward mean ${mean(pert).toFixed(3)} best ${Math.max(...pert).toFixed(3)}, disagree ${(100 * mean(by.slice(1).flatMap(rs => rs.map(r => r.dis)))).toFixed(1)}% | rms drift from BC ${drift.toFixed(4)} (${el()})`);
    if (S.gen % VAL_EVERY === 0 || S.gen >= GENS){
      const [Nr] = await runSet(V, [toW(S.theta)], true);
      const vb = paired(S.bestRows, Nr, game), vh = paired(S.Hr, Nr, game), gt = G.check(S.Hr, Nr);
      let act = 'keep walking'; const prevGen = S.bestGen;
      if (vb.m > ACCEPT_SE * vb.s && gt.pass){ S.best = S.theta.slice(); S.bestGen = S.gen; S.bestRows = Nr; act = 'NEW BEST';
        save(path.join(out, 'best.json'), S.best, `ES best: generation ${S.gen} of es.js from bc_weights.json; validation game reward vs heuristic ${vh.m.toFixed(3)} ± ${vh.s.toFixed(3)}`);
        save(path.join(out, `best_${S.gen}.json`), S.best, `ES generation ${S.gen}`); }
      else if (vb.m < -REVERT_SE * vb.s){ S.theta = S.best.slice(); S.m1.fill(0); S.m2.fill(0); S.t = 0; act = `revert to best (gen ${S.bestGen})`; }
      log(`  VALIDATION gen ${S.gen}: ${summ(Nr)}\n    vs best (gen ${prevGen}) ${vb.m >= 0 ? '+' : ''}${vb.m.toFixed(3)} ± ${vb.s.toFixed(3)}, vs heuristic ${vh.m >= 0 ? '+' : ''}${vh.m.toFixed(3)} ± ${vh.s.toFixed(3)}; gates ${gt.pass ? 'pass' : 'FAIL: ' + gt.fails.join('; ')} -> ${act}`);
      S.history.push({gen: S.gen, vb, vh, pass: gt.pass, fails: gt.fails, act});
    }
    save(path.join(out, 'current.json'), S.theta, `ES current, generation ${S.gen}`);
    fs.writeFileSync(sf, JSON.stringify(S));
  }
  log(`done: ${S.gen} generations, best = generation ${S.bestGen} (${el()})`);
})();
