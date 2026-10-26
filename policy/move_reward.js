// Milestone 3 rewards, from move_run.js fight records.
//  goal(rec)            per fight, for the archetype's units (collectively); harrier records have no `arch`, guard
//                       records carry arch: 'guard' (move_run.js), and every function below dispatches on that;
//                       cat / charger / bulldozer / brawler / kicker records carry their arch and use the harrier goal
//                       (pressure on you and your side, small self-death weight, idle penalty) with their own style
//  metrics(recs)        pooled style/telemetry metrics over a fight set (ratio of sums, so every fight is weighted by
//                       how long the units were in it); the same function for every arm of a paired comparison
//  grade(m, ref)        style grade in [0,1] against the heuristic's own measured profile, plus realism gates
//  drift(m, ref, N)     telemetry outside the heuristic's normal range (tolerance + 2 SE at this many fights)
const GOAL = {kill: 1, death: .1, idlePerMin: .05, animalScale: 1000}; // death .25 -> .1 (Oct 26): at .25 self-preservation dominated the goal and hanging back scored best
// guard goal (your side's guards): survival time / 300, minus the human's damage taken (prevented damage scores), plus a
// small bonus for damage dealt, minus guard deaths (small) and minus guard-minutes standing idle while the fight is on
const GOAL_G = {human: .5, dealtScale: 20000, death: .03, idlePerMin: .05};
function goalPartsGuard(r){
  return {surv: r.survived ? 1 : Math.min(1, r.t / 300), human: -GOAL_G.human * r.dmgHuman / r.hmax, dealt: r.dealt / GOAL_G.dealtScale,
    deaths: -GOAL_G.death * r.deaths, idle: -GOAL_G.idlePerMin * r.standbyT / 60};
}
// damage to your animals per goal unit, per archetype: chargers and bulldozers deal ~10× what a harrier does (3-4k HP a
// fight), so at 1,000 the animals term would swamp killing you; at 10,000 it is ~0.3-0.4 a fight like the others'
const ANIMAL_SCALE = {charger: 10000, bulldozer: 10000};
// 'checkmate' goal (opt-in, --goal=checkmate): the whole side shares one outcome, credited to every archetype on it. Kill
// the human (+1, whoever lands it), sooner is better (1 - time alive / 300; surviving to 5:00 = 0), plus partial credit for
// the human's health lost to anyone; own deaths and idle time as before. Damage to the human's animals isn't rewarded:
// tying up or removing guards should emerge as a means.
const GOAL_C = {kill: 1, speed: 1, human: .5};
function goalPartsCheckmate(r){
  const T = r.survived ? 300 : Math.min(300, r.t);
  return {kill: GOAL_C.kill * (r.survived ? 0 : 1), speed: GOAL_C.speed * (1 - T / 300), human: GOAL_C.human * Math.min(1, r.dmgHumanAll / r.hmax),
    deaths: -GOAL.death * r.deaths, idle: -GOAL.idlePerMin * r.noContactT / 60};
}
function goalParts(r){
  if (r.arch === 'guard') return goalPartsGuard(r);
  if (r.goalMode === 'checkmate') return goalPartsCheckmate(r);
  return {human: r.dmgHuman / r.hmax, kill: GOAL.kill * r.killedYou, animals: (r.dmgFoe - r.dmgHuman) / (ANIMAL_SCALE[r.arch] || GOAL.animalScale),
    deaths: -GOAL.death * r.deaths, idle: -GOAL.idlePerMin * r.noContactT / 60};
}
function goal(r){ const p = goalParts(r); let g = 0; for (const v of Object.values(p)) g += v; return g; } // parts in insertion order (harrier: human + kill + animals + deaths + idle)

// metric = num/den over the pooled records. kind: 'two' (either way is a deviation), 'up' (only an increase is
// penalised: realism gates and anti-gaming checks), 'tel' (telemetry only: drift flags, not in the grade), 'info'
// (reported only: neither graded nor drift-flagged).
// 'down' (only a decrease is penalised: a signature move that must not disappear).
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
// guard style: per species class (cat / canid / charger / big / other) time shares and how much of its time it spends
// within 8 m of you, plus pooled shares, distance kept from you and per-guard-minute rates of signature moves; gates: a
// cat body-blocking a big herbivore face to face for > 3 s, and a guard glued to you (< 4 m, not fighting) while
// something is on you for > 2 s
const METRICS_G = {};
for (const c of ['cat', 'canid', 'charger', 'big', 'other']){
  METRICS_G[c + 'Fight'] = {num: r => r[c + 'Fight'], den: r => r[c + 'Life'], kind: 'two', tol: .08};
  METRICS_G[c + 'Idle'] = {num: r => r[c + 'Idle'], den: r => r[c + 'Life'], kind: 'two', tol: .08};
  METRICS_G[c + 'Near'] = {num: r => r[c + 'Near'], den: r => r[c + 'Life'], kind: 'two', tol: .1};
}
Object.assign(METRICS_G, {
  closeShare: {num: r => r.close, den: r => r.life, kind: 'two', tol: .08},
  fleeShare:  {num: r => r.flee, den: r => r.life, kind: 'two', tol: .08},
  meanDistH:  {num: r => r.distH, den: r => r.life, kind: 'two', rel: .25},
  holdRate:   {num: r => r.sig_hold * 60, den: r => r.life, kind: 'two', rel: .3},
  knockRate:  {num: r => r.sig_knock * 60, den: r => r.life, kind: 'two', rel: .3},
  dodgeRate:  {num: r => r.sig_dodge * 60, den: r => r.life, kind: 'two', rel: .3},
  sweepRate:  {num: r => r.sig_sweep * 60, den: r => r.life, kind: 'two', rel: .3},
  pounceRate: {num: r => r.sig_pounce * 60, den: r => r.life, kind: 'two', rel: .3},
  catBlock:   {num: r => r.catBlockT, den: r => r.catLife, kind: 'up', tol: .02, gate: true},
  glued:      {num: r => r.gluedT, den: r => r.life, kind: 'up', tol: .01, gate: true},
  standby:    {num: r => r.standbyT, den: r => r.life, kind: 'up', tol: .05},
  deathRate:  {num: r => r.deaths, den: r => r.n, kind: 'tel', tol: .1},
  withdrawRate: {num: r => r.withdrawn, den: r => r.n, kind: 'tel', tol: .1},
  // 'info': what the goal is meant to move (reported, never graded or drift-flagged)
  survival:   {num: r => r.survived, den: () => 1, kind: 'info'},
  collateralShare: {num: r => r.dmgCollateral, den: r => r.dmgHuman, kind: 'info'},
  collateralPerFight: {num: r => r.dmgCollateral, den: () => 1, kind: 'info'},
  humanDmgPerFight: {num: r => r.dmgHuman, den: () => 1, kind: 'info'},
  dealtPerFight: {num: r => r.dealt, den: () => 1, kind: 'info'},
});
// the other side's other archetypes (cat, charger, bulldozer, brawler, kicker): the harrier profile without the dart
// rhythm, plus per-archetype signature rates and realism gates (kind 'down': only a decrease is penalised):
//   cat: pounce rhythm; gates: no long chases (a stalker doesn't run prey down for > 8 s at speed) and no face-on brawls
//   charger: gate: the charge rate (charges per engaged minute) must not collapse
//   brawler: gate: the honey badger stays fearless (no time spent waiting, regrouping or backing off while engaged)
//   kicker: gate: no hunting across the field (closing on something > 20 m away)
const BASE_X = Object.fromEntries(Object.entries(METRICS).filter(([k]) => k !== 'dartRate'));
const nogate = d => Object.assign({}, d, {gate: false});
const METRICS_X = {
  cat: Object.assign({}, BASE_X, {
    pounceRate: {num: r => r.pounces * 60, den: r => r.engT, kind: 'two', rel: .3},
    longChase:  {num: r => r.longChaseT, den: r => r.life, kind: 'up', tol: .02, gate: true}}),
  charger: Object.assign({}, BASE_X, {faceOn: nogate(BASE_X.faceOn),
    chargeRate: {num: r => r.charges * 60, den: r => r.engT, kind: 'down', rel: .25, gate: true}}),
  bulldozer: Object.assign({}, BASE_X, {faceOn: nogate(BASE_X.faceOn)}),
  brawler: Object.assign({}, BASE_X, {faceOn: nogate(BASE_X.faceOn),
    badgerBack: {num: r => r.badgerBackT, den: r => r.badgerLife, kind: 'up', tol: .02, gate: true}}),
  kicker: Object.assign({}, BASE_X, {
    farHunt:    {num: r => r.farHuntT, den: r => r.life, kind: 'up', tol: .02, gate: true}}),
};
const DEFS = Object.assign({harrier: METRICS, guard: METRICS_G}, METRICS_X);
// spec metrics (opt-in, --spec; behavior-spec doc reviewed Oct 26): absolute targets only where an opened source supports
// them ('abs': penalised above cap), plus 'info' telemetry the spec cares about but has no number for
const SPEC_INFO = {
  rearShare:   {num: r => r.rearHits, den: r => r.hitsOnMoving, kind: 'info'},   // hits from behind a moving target
  fleeContact: {num: r => r.fleeContactT, den: r => r.fight, kind: 'info'},     // contact while the target flees
  farSprint:   {num: r => r.farSprintT, den: r => r.life, kind: 'info'},        // sprinting at a target > 30 m off
};
const SPEC_X = {
  // cats: the rush starts within ~15-30 m; a spotted cat doesn't run prey down from range (Laundre & Hernandez 2003; Schaller
  // 1967). Cap = the heuristic's own level (~2% of life, 80 fights), so learning can't add long-range sprints
  cat: {farSprint: {num: r => r.farSprintT, den: r => r.life, kind: 'abs', cap: .02, tol: .01}},
};
const DEFS_SPEC = Object.fromEntries(Object.keys(DEFS).filter(a => a !== 'guard').map(a => [a, Object.assign({}, DEFS[a], SPEC_INFO, SPEC_X[a] || {})]));
const defsOf = (arch, spec) => { const d = (spec ? DEFS_SPEC : DEFS)[arch || 'harrier'] || (spec && DEFS[arch || 'harrier']); if (!d) throw new Error('no reward metrics for archetype ' + arch); return d; };
const archOfRecs = recs => (recs[0] && recs[0].arch) || 'harrier', specOfRecs = recs => !!(recs[0] && recs[0].spec);
function metrics(recs){
  const m = {};
  for (const [k, d] of Object.entries(defsOf(archOfRecs(recs), specOfRecs(recs)))){ let a = 0, b = 0; for (const r of recs){ a += d.num(r); b += d.den(r); } m[k] = b > 0 ? a / b : 0; }
  return m;
}
// ratio-estimator standard error of each pooled metric over these fights
function metricSE(recs){
  const m = metrics(recs), out = {};
  for (const [k, d] of Object.entries(defsOf(archOfRecs(recs), specOfRecs(recs)))){
    let b = 0, s = 0; for (const r of recs) b += d.den(r);
    for (const r of recs) s += (d.num(r) - m[k] * d.den(r)) ** 2;
    out[k] = b > 0 ? Math.sqrt(s) / b : 0;
  }
  return out;
}
function tolOf(k, ref){ const d = defsOf(ref.arch, ref.spec)[k]; return d.rel ? Math.max(1e-9, d.rel * Math.abs(ref.m[k])) : d.tol; }
// the heuristic's own sampling noise at N fights (2 SE, scaled from the calibration set) is added to every tolerance, so
// the zero-weight policy scores ~1 on any fresh fight set of that size instead of being marked down for luck
function noiseOf(k, ref, N){ return N ? 2 * (ref.se[k] || 0) * Math.sqrt(ref.n / Math.max(1, N)) : 0; }
function excess(k, m, ref, N){ const d = defsOf(ref.arch, ref.spec)[k], R = ref.m, dev = d.kind === 'abs' ? m[k] - d.cap : d.kind === 'up' ? m[k] - R[k] : d.kind === 'down' ? R[k] - m[k] : Math.abs(m[k] - R[k]); return Math.max(0, dev - tolOf(k, ref) - noiseOf(k, ref, N)); }
// ref: reference(heuristic records); N: fights behind m. style = mean metric score over the 'two' and 'up' metrics
// (1 within tolerance, falling linearly to 0 at twice it); gates = the hard 'gate' metrics, which must score 1
function grade(m, ref, N){
  const per = {}, R = ref.m; let s = 0, n = 0; const failed = [];
  for (const [k, d] of Object.entries(defsOf(ref.arch, ref.spec))){
    if (d.kind === 'tel' || d.kind === 'info') continue;
    const sc = Math.max(0, 1 - excess(k, m, ref, N) / tolOf(k, ref)); per[k] = sc; s += sc; n++;
    if (d.gate && sc < 1) failed.push(k);
  }
  return {style: n ? s / n : 1, per, gatesPass: failed.length === 0, failed};
}
// drift: any metric (telemetry included) beyond tolerance + 2 SE of the heuristic at N fights (SE scaled from calibration)
function drift(m, ref, N){
  const flags = [];
  for (const [k, d] of Object.entries(defsOf(ref.arch, ref.spec))) if (d.kind !== 'info' && excess(k, m, ref, N) > 0) flags.push(`${k} ${ref.m[k].toFixed(3)}→${m[k].toFixed(3)}`);
  return flags;
}
function reference(recs){ const a = archOfRecs(recs), ref = {n: recs.length, m: metrics(recs), se: metricSE(recs)}; if (a !== 'harrier') ref.arch = a; if (specOfRecs(recs)) ref.spec = true; return ref; }
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
module.exports = { GOAL, GOAL_G, GOAL_C, ANIMAL_SCALE, METRICS, METRICS_G, METRICS_X, defsOf, goal, goalParts, metrics, metricSE, grade, drift, reference, paired, mean, sd, se };
