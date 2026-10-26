// Milestone 3 headroom probe for the other side's other archetypes (cat, charger, bulldozer, brawler, kicker), the
// harrier_rules.js idea generalised: do fixed intents or simple hand-written CONDITIONAL rules beat the heuristic? If one
// does, there is something for a learner to find (and a warm start: train.js --initRule=<rule>).
// Paired: every arm vs no policy on the same fights (the archetype's units only; everything else stays heuristic).
//   node policy/probes/arch_rules.js [fightsPerArm=800] [archs=cat,charger,bulldozer,brawler,kicker] [arms=all|name,name]
//   IDX=<fight-set index> (default 7; use another to confirm a winner on a fresh draw), SEED=<pool seed> (default 26),
//   THREADS=<n> (default 4), LIVE=1 (the shipped harrier/guard policies run in every fight, as in the live game)
// Arms: fixed intents wait / flank / regroup / disengage, and per archetype 2-3 rules (RULES below).
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const P = require(path.join(__dirname, '..', 'move_policy.js')), F = require(path.join(__dirname, '..', 'move_arch_features.js'));
const R = require(path.join(__dirname, '..', 'move_run.js')), RW = require(path.join(__dirname, '..', 'move_reward.js'));
const I = P.A._internals, ix = Object.fromEntries(F.NAMES.map((n, i) => [n, i])), [COMMIT, WAIT, FLANK, REGROUP, DISENGAGE] = [0, 1, 2, 3, 4];
// shared conditions (x = move_arch_features.js vector)
const patient = x => x[ix.guardsBlock] && !x[ix.tBusy] && !x[ix.tEasy] ? WAIT : COMMIT;   // wait out stronger guards (harrier probe winner)
const flankBusy = x => x[ix.tBusy] && !x[ix.tEasy] ? FLANK : COMMIT;                        // hit a busy target from behind
const hurtBack = x => x[ix.hp] < .5 && x[ix.attackersOnMe] > 0 && !x[ix.tEasy] ? DISENGAGE : COMMIT; // break off when hurt and mobbed
const brave = f => x => x[ix.fearless] ? COMMIT : f(x);                                    // the honey badger never backs off
const RULES = {
  cat: {patient, flankBusy, hurtBack},
  // back off for charging room when too close to charge and the charge isn't ready (then charge again)
  charger: {patient, flankBusy, backForRoom: x => x[ix.dist] < .25 && !x[ix.chargeReady] && !x[ix.tEasy] ? DISENGAGE : COMMIT},
  bulldozer: {patient, flankBusy, hurtBack},
  brawler: {patient: brave(patient), flankBusy: brave(flankBusy), hurtBack: brave(hurtBack)},
  // a kicker only kicks what comes at it: keep its distance from anything that isn't after it
  kicker: {patient, flankBusy, onlyOnMe: x => !x[ix.tOnMe] && !x[ix.tEasy] ? WAIT : COMMIT},
};
const FIXED = {wait: WAIT, flank: FLANK, regroup: REGROUP, disengage: DISENGAGE};
module.exports = { RULES, FIXED };
if (require.main !== module && isMainThread) return;

if (!isMainThread){
  I.moveChoose = (w, u, t, d, Pw, arch) => {
    const a = Pw.fixed !== undefined ? Pw.fixed : RULES[arch][Pw.rule](F.extract(w, u, t, d));
    const st = w.cfg.moveStats; if (st){ const c = st[arch] || (st[arch] = new Array(5).fill(0)); c[a]++; }
    return a;
  };
  parentPort.postMessage(workerData.jobs.map(j => ({a: j.a, k: j.k, i: j.i, rec: R.runFight(j.f, j.w, j.a)}))); return;
}
const N = +process.argv[2] || 800, ARCHS = (process.argv[3] || 'cat,charger,bulldozer,brawler,kicker').split(','), ARMS = process.argv[4] && process.argv[4] !== 'all' ? process.argv[4].split(',') : null;
const IDX = process.env.IDX !== undefined ? +process.env.IDX : 7, SEED = +process.env.SEED || 26, NT = +process.env.THREADS || 4, LIVE = !!process.env.LIVE;
const jobs = [], plan = {};
for (const a of ARCHS){
  if (!RULES[a]) throw new Error('unknown archetype ' + a);
  const arms = [...Object.keys(FIXED).map(k => ({k, w: {fixed: FIXED[k]}})), ...Object.keys(RULES[a]).map(k => ({k, w: {rule: k}}))].filter(o => !ARMS || ARMS.includes(o.k));
  const fights = R.fightSet('probe', IDX, N, {arch: a, seed: SEED, withLive: LIVE});
  plan[a] = {fights, arms};
  fights.forEach((f, i) => { jobs.push({a, k: 'base', i, f, w: null}); for (const o of arms) jobs.push({a, k: o.k, i, f, w: o.w}); });
}
const t0 = Date.now();
Promise.all([...Array(NT).keys()].map(k => new Promise((res, rej) => { const w = new Worker(__filename, {workerData: {jobs: jobs.filter((_, q) => q % NT === k)}}); w.on('message', res); w.on('error', rej); }))).then(p => {
  const M = {}; p.flat().forEach(o => { const m = M[o.a] || (M[o.a] = {}); (m[o.k] = m[o.k] || [])[o.i] = o.rec; });
  console.log(`archetype rule probe: ${jobs.length} fights, ${((Date.now() - t0) / 1000).toFixed(0)} s (probe pool index ${IDX}, seed ${SEED}${LIVE ? ', live harrier/guard policies on' : ''}); goal diff vs the heuristic on the same fights, * = beyond 2 SE`);
  for (const a of ARCHS){
    const base = M[a].base, ref = RW.reference(base), n = base.length;
    console.log(`\n${a}: ${n} fights, ${(RW.mean(base.map(r => r.n))).toFixed(2)} units per fight, heuristic goal ${RW.mean(base.map(RW.goal)).toFixed(3)}, kills of you ${(100 * RW.mean(base.map(r => r.killedYou))).toFixed(1)}%`);
    console.log('| arm | goal ± SE | style | gates | drift | kills of you (pts) | non-commit |');
    console.log('|---|---|---|---|---|---|---|');
    for (const o of plan[a].arms){
      const r = M[a][o.k], q = RW.paired(base, r, ref), yk = base.map((b, i) => (r[i].killedYou || 0) - (b.killedYou || 0));
      const it = r.reduce((s, x) => (x.intents || [0, 0, 0, 0, 0]).map((v, k) => s[k] + v), [0, 0, 0, 0, 0]), tot = it.reduce((s, v) => s + v, 0) || 1;
      console.log(`| ${o.k} | ${q.diff >= 0 ? '+' : ''}${q.diff.toFixed(3)} ± ${q.se.toFixed(3)}${Math.abs(q.diff) > 2 * q.se ? (q.diff > 0 ? ' **\\***' : ' *') : ''} | ${q.styleB.style.toFixed(2)} | ${q.styleB.failed.join(', ') || '-'} | ${q.driftB.join('; ') || '-'} | ${(100 * RW.mean(yk)) >= 0 ? '+' : ''}${(100 * RW.mean(yk)).toFixed(1)} ± ${(100 * RW.se(yk)).toFixed(1)} | ${(100 * (1 - it[0] / tot)).toFixed(0)}% |`);
    }
  }
});
