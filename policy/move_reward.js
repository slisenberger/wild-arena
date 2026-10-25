// Milestone 3 rewards, from move_run.js fight records.
//  goal(rec)            per fight, for the archetype's units on the other side (collectively)
//  metrics(recs)        pooled style/telemetry metrics over a fight set (ratio of sums, so every fight is weighted by
//                       how long the units were in it); the same function for every arm of a paired comparison
//  grade(m, ref)        style grade in [0,1] against the heuristic's own measured profile, plus realism gates
//  drift(m, ref, N)     telemetry outside the heuristic's normal range (tolerance + 2 SE at this many fights)
const GOAL = {kill: 1, death: .25, idlePerMin: .05, animalScale: 1000};
function goalParts(r){
  return {human: r.dmgHuman / r.hmax, kill: GOAL.kill * r.killedYou, animals: (r.dmgFoe - r.dmgHuman) / GOAL.animalScale,
    deaths: -GOAL.death * r.deaths, idle: -GOAL.idlePerMin * r.noContactT / 60};
}
function goal(r){ const p = goalParts(r); return p.human + p.kill + p.animals + p.deaths + p.idle; }

// metric = num/den over the pooled records. kind: 'two' (either way is a deviation), 'up' (only an increase is
// penalised: realism gates and anti-gaming checks), 'tel' (telemetry only: drift flags, not in the grade).
// tol: allowed deviation (abs, or rel × the reference when rel is set) before the grade drops; at 2·tol it scores 0.
const METRICS = {
  fightShare:  {num: r => r.fight, den: r => r.life, kind: 'two', tol: .08},
  closeShare:  {num: r => r.close, den: r => r.life, kind: 'two', tol: .08},
  idleShare:   {num: r => r.idle, den: r => r.life, kind: 'two', tol: .08},
  fleeShare:   {num: r => r.flee, den: r => r.life, kind: 'two', tol: .08},
  dartRate:    {num: r => r.darts * 60, den: r => r.engT, kind: 'two', rel: .25},  // dart-in-and-out rhythm (darts per engaged minute)
  nearShare:   {num: r => r.nearT, den: r => r.engT, kind: 'two', tol: .1},       // commits (within 10 m) vs circles wide
  meanDist:    {num: r => r.distSum, den: r => r.engT, kind: 'two', rel: .25},    // distance kept from its target
  faceOn:      {num: r => r.faceOnT, den: r => r.life, kind: 'up', tol: .01, gate: true},   // trades blows face-on for > 3 s
  longIdle:    {num: r => r.longIdleT, den: r => r.life, kind: 'up', tol: .02, gate: true}, // > 30 s without contact
  noContact:   {num: r => r.noContactT, den: r => r.life, kind: 'up', tol: .05},  // includes circling/closing that never arrives
  fruitless:   {num: r => r.fruitless, den: r => r.appr, kind: 'up', tol: .1},    // approaches that never reach contact
  deathRate:   {num: r => r.deaths, den: r => r.n, kind: 'tel', tol: .1},
  escapeRate:  {num: r => r.escaped, den: r => r.n, kind: 'tel', tol: .1},
  humanShare:  {num: r => r.dmgHuman, den: r => r.dmgFoe, kind: 'tel', tol: .1},   // damage to you vs your animals
  dmgPerFight: {num: r => r.dmgFoe, den: () => 1, kind: 'tel', rel: .25},
};
function metrics(recs){
  const m = {};
  for (const [k, d] of Object.entries(METRICS)){ let a = 0, b = 0; for (const r of recs){ a += d.num(r); b += d.den(r); } m[k] = b > 0 ? a / b : 0; }
  return m;
}
// ratio-estimator standard error of each pooled metric over these fights
function metricSE(recs){
  const m = metrics(recs), out = {};
  for (const [k, d] of Object.entries(METRICS)){
    let b = 0, s = 0; for (const r of recs) b += d.den(r);
    for (const r of recs) s += (d.num(r) - m[k] * d.den(r)) ** 2;
    out[k] = b > 0 ? Math.sqrt(s) / b : 0;
  }
  return out;
}
function tolOf(k, ref){ const d = METRICS[k]; return d.rel ? Math.max(1e-9, d.rel * Math.abs(ref[k])) : d.tol; }
// the heuristic's own sampling noise at N fights (2 SE, scaled from the calibration set) is added to every tolerance, so
// the zero-weight policy scores ~1 on any fresh fight set of that size instead of being marked down for luck
function noiseOf(k, ref, N){ return N ? 2 * (ref.se[k] || 0) * Math.sqrt(ref.n / Math.max(1, N)) : 0; }
function excess(k, m, ref, N){ const d = METRICS[k], R = ref.m, dev = d.kind === 'up' ? m[k] - R[k] : Math.abs(m[k] - R[k]); return Math.max(0, dev - tolOf(k, R) - noiseOf(k, ref, N)); }
// ref: reference(heuristic records); N: fights behind m. style = mean metric score over the 'two' and 'up' metrics
// (1 within tolerance, falling linearly to 0 at twice it); gates = the hard 'gate' metrics, which must score 1
function grade(m, ref, N){
  const per = {}, R = ref.m; let s = 0, n = 0; const failed = [];
  for (const [k, d] of Object.entries(METRICS)){
    if (d.kind === 'tel') continue;
    const sc = Math.max(0, 1 - excess(k, m, ref, N) / tolOf(k, R)); per[k] = sc; s += sc; n++;
    if (d.gate && sc < 1) failed.push(k);
  }
  return {style: n ? s / n : 1, per, gatesPass: failed.length === 0, failed};
}
// drift: any metric (telemetry included) beyond tolerance + 2 SE of the heuristic at N fights (SE scaled from calibration)
function drift(m, ref, N){
  const flags = [];
  for (const k of Object.keys(METRICS)) if (excess(k, m, ref, N) > 0) flags.push(`${k} ${ref.m[k].toFixed(3)}→${m[k].toFixed(3)}`);
  return flags;
}
function reference(recs){ return {n: recs.length, m: metrics(recs), se: metricSE(recs)}; }
const mean = a => a.length ? a.reduce((p, q) => p + q, 0) / a.length : 0;
const sd = a => a.length > 1 ? Math.sqrt(a.reduce((p, q) => p + (q - mean(a)) ** 2, 0) / (a.length - 1)) : 0;
const se = a => a.length > 1 ? sd(a) / Math.sqrt(a.length) : 0;
// paired comparison of arm b vs arm a on the same fights: goal diff ± SE, both styles
function paired(recsA, recsB, ref){
  const d = recsA.map((r, i) => goal(recsB[i]) - goal(r));
  const ma = metrics(recsA), mb = metrics(recsB);
  return {n: d.length, goalA: mean(recsA.map(goal)), goalB: mean(recsB.map(goal)), diff: mean(d), se: se(d),
    styleA: grade(ma, ref, d.length), styleB: grade(mb, ref, d.length), mA: ma, mB: mb, driftB: drift(mb, ref, d.length)};
}
module.exports = { GOAL, METRICS, goal, goalParts, metrics, metricSE, grade, drift, reference, paired, mean, sd, se };
