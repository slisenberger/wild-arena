// Milestone-2 prototype: evolution strategies (antithetic, rank-shaped) over the policy weights, starting from the
// behavior-cloned net. Reward is the other side's predators' (the policy controls only them):
//   + damage they deal / 1000 + KILL_BONUS if a predator kills you − DEATH_PEN per predator that dies
//   − LAMBDA × (share of the net's own decisions that disagree with the heuristic)   (realism regularizer)
// Every candidate in a generation plays the same fights (common random numbers); fresh fights each generation.
// Usage: node policy/es.js [generations=5] [pairs=8] [fightsPerCandidate=24] [sigma=0.05] [lr=0.03] [lambda=2]
// Writes policy/es_weights.json (a prototype; not tuned, not validated beyond the printed numbers).
const { isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), fs = require('fs');
const KILL_BONUS = 5, DEATH_PEN = 1;
if (!isMainThread){
  const { A, cfgOf } = require('./common.js'); require('./policy.js');
  const out = [];
  for (const j of workerData.jobs){
    const c = cfgOf(j); c.policy = workerData.cands[j.ci]; c.policyStats = {};
    const w = A.simulate(c), pr = w.units.filter(u => u.side === 'E' && u.s.pred), r = w.result;
    const killed = !r.survived && r.killer && A.BY_ID[r.killer] && A.BY_ID[r.killer].pred ? 1 : 0;
    out.push({ci: j.ci, dmg: pr.reduce((s, u) => s + u.st.dealt, 0), killed, deaths: pr.filter(u => u.state === 'dead').length,
      dis: c.policyStats.n ? 1 - (c.policyStats.agree || 0) / c.policyStats.n : 0, won: r.score >= 300 ? 1 : 0});
  }
  parentPort.postMessage(out); return;
}
const { A, boardJobs, pool, mean } = require('./common.js');
const M = require('./model.js');
const [G, NPAIR, NF, SIG, LR, LAM] = [5, 8, 24, .05, .03, 2].map((d, i) => +process.argv[2 + i] || d);
const B = JSON.parse(fs.readFileSync(path.join(__dirname, 'bc_weights.json'), 'utf8')), {nin, nh} = B, mu = B.norm.mu, sd = B.norm.sd;
// standardized-space parameters (so one sigma means the same for every input), folded back for the sim
const unfold = P => { const Q = JSON.parse(JSON.stringify(P)); for (let j = 0; j < nh; j++) for (let i = 0; i < nin; i++){ Q.W1[j * nin + i] = P.W1[j * nin + i] * sd[i]; Q.b1[j] += P.W1[j * nin + i] * mu[i]; } return Q; };
const fold = P => { const Q = JSON.parse(JSON.stringify(P)); for (let j = 0; j < nh; j++) for (let i = 0; i < nin; i++){ Q.W1[j * nin + i] = P.W1[j * nin + i] / sd[i]; Q.b1[j] -= P.W1[j * nin + i] * mu[i] / sd[i]; } return Q; };
let theta = M.flat(unfold(B));
const R = A.rng(7), gauss = () => { let u = 0; while (!u) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); };
const reward = r => r.dmg / 1000 + KILL_BONUS * r.killed - DEATH_PEN * r.deaths - LAM * r.dis;
(async () => {
  const t0 = Date.now();
  for (let g = 0; g < G; g++){
    const eps = Array.from({length: NPAIR}, () => theta.map(() => gauss()));
    const cands = [theta, ...eps.flatMap(e => [theta.map((v, i) => v + SIG * e[i]), theta.map((v, i) => v - SIG * e[i])])].map(v => fold(M.unflat(v, nin, nh)));
    const fights = boardJobs(1, Math.ceil(NF / 4), 5000 + g).slice(0, NF);
    const jobs = []; cands.forEach((_, ci) => fights.forEach(f => jobs.push(Object.assign({ci}, f))));
    const rows = await pool(__filename, jobs, {cands});
    const by = cands.map((_, ci) => rows.filter(r => r.ci === ci)), Rw = by.map(rs => mean(rs.map(reward)));
    // centered ranks over the perturbed candidates (index 0 = the current theta, for reporting only)
    const pert = Rw.slice(1), order = pert.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]), rank = new Array(pert.length);
    order.forEach(([, i], k) => rank[i] = k / (pert.length - 1) - .5);
    const grad = theta.map(() => 0);
    for (let p = 0; p < NPAIR; p++){ const a = rank[2 * p] - rank[2 * p + 1]; for (let i = 0; i < grad.length; i++) grad[i] += a * eps[p][i]; }
    theta = theta.map((v, i) => v + LR / (NPAIR * SIG) * grad[i]);
    const c0 = by[0];
    console.log(`gen ${g + 1}: current net reward ${Rw[0].toFixed(2)} (dmg ${mean(c0.map(r => r.dmg)).toFixed(0)}, killed you ${(100 * mean(c0.map(r => r.killed))).toFixed(0)}%, pred deaths ${mean(c0.map(r => r.deaths)).toFixed(2)}, disagree ${(100 * mean(c0.map(r => r.dis))).toFixed(1)}%, your wins ${(100 * mean(c0.map(r => r.won))).toFixed(0)}%); best perturbation ${Math.max(...pert).toFixed(2)}, mean ${mean(pert).toFixed(2)}; ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  const out = fold(M.unflat(theta, nin, nh)); out.names = B.names; out.norm = B.norm; out.note = `ES prototype: ${G} generations from bc_weights.json`;
  fs.writeFileSync(path.join(__dirname, 'es_weights.json'), JSON.stringify(out));
  console.log('wrote policy/es_weights.json');
})();
