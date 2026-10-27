// Milestone 3 headroom probe for the cat-specific intents (sim.js CAT_INTENTS: commit / pounce / creep / abandon / soften /
// cover / blindside; features move_cat_features.js): do fixed cat intents or simple hand-written CONDITIONAL cat rules beat
// the heuristic? A winner is something for a learner to find, and a warm start (train.js --arch=cat --initRule=<rule>).
// Paired: every arm vs no policy on the same fights (the other side's cats only; everything else as in the fight set).
//   node policy/probes/cat_rules.js [fightsPerArm=800] [arms=all|name,name]
//   IDX=<probe pool index> (default 7; another index = a fresh draw to confirm a winner), SEED=<pool seed> (default 26),
//   THREADS=<n> (default 4), LIVE=1 (the shipped harrier/guard policies run in every fight, as in the live game)
// Per species: the goal difference on the fights where that cat is on the other side (a fight can have several cats).
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const P = require(path.join(__dirname, '..', 'move_policy.js')), F = require(path.join(__dirname, '..', 'move_cat_features.js'));
const R = require(path.join(__dirname, '..', 'move_run.js')), RW = require(path.join(__dirname, '..', 'move_reward.js'));
const AR = require(path.join(__dirname, '..', 'move_arch.js'));
const I = P.A._internals, ix = Object.fromEntries(F.NAMES.map((n, i) => [n, i]));
const [COMMIT, POUNCE, CREEP, ABANDON, SOFTEN, COVER, BLIND] = [0, 1, 2, 3, 4, 5, 6];
// x = move_cat_features.js vector. 'Spotted' = the target can see me and is heading at me or coming for me.
const spotted = x => x[ix.tSeesMe] && (x[ix.tHeadsMe] > .5 || x[ix.tOnMe]);
const far = x => !x[ix.inPounce];   // outside the heuristic's pounce range
const RULES = {
  // spotted with the ambush spent: withdraw, lie low until the ambush is back, then come in again
  reStalk: x => x[ix.hasAmbush] && !x[ix.ambushReady] && spotted(x) && far(x) && !x[ix.tEasy] && !x[ix.tBusy] ? ABANDON : COMMIT,
  // the current target is guarded: switch to softer prey nearby if there is any
  softer: x => (x[ix.guardsBlock] || x[ix.guardLog] > .5) && x[ix.softExists] ? SOFTEN : COMMIT,
  // facing a target that faces me and isn't busy: take its blind side before pouncing
  blindFirst: x => far(x) && !x[ix.behind] && x[ix.tHeadsMe] > 0 && !x[ix.tBusy] && !x[ix.tEasy] ? BLIND : COMMIT,
  // the target is busy (or easy): pounce now from up to 1.3× pounce range
  busyPounce: x => (x[ix.tBusy] || x[ix.tEasy]) && x[ix.in13] && x[ix.pounceReady] ? POUNCE : COMMIT,
  // ambush ready, unseen, cover close by and the prey coming my way: wait for it in cover
  coverAmbush: x => x[ix.ambushReady] && !x[ix.tSeesMe] && x[ix.treeNear] && x[ix.tHeadsMe] > .5 && far(x) ? COVER : COMMIT,
  // a softer target nearby is you: go for you
  forYou: x => x[ix.softExists] && x[ix.softHuman] && !x[ix.tHuman] ? SOFTEN : COMMIT,
  // round 2 (after the first probe: the cougar gained from busyPounce, cats die in 59% of fights)
  // hurt and mobbed: break off and lie low (the ambush comes back), then come in again (the bulldozer's hurtBack, cat-style)
  hurtLieLow: x => x[ix.hp] < .5 && x[ix.attackersOnMe] > 0 && !x[ix.tEasy] ? ABANDON : COMMIT,
  // busyPounce for the cougar only (the longest leap: 12 m, so up to 15.6 m)
  cougarPounce: x => x[ix.sp_cougar] && (x[ix.tBusy] || x[ix.tEasy]) && x[ix.in13] && x[ix.pounceReady] ? POUNCE : COMMIT,
  // busyPounce for the stalkers (not the lion, whose rush already closes)
  stalkerPounce: x => !x[ix.sp_lion] && (x[ix.tBusy] || x[ix.tEasy]) && x[ix.in13] && x[ix.pounceReady] ? POUNCE : COMMIT,
  // unseen with the ambush ready: creep in on the blind side instead of the heuristic's straight stalk
  creepUnseen: x => x[ix.ambushReady] && !x[ix.tSeesMe] && far(x) && !x[ix.tBusy] ? CREEP : COMMIT,
};
const FIXED = {pounce: POUNCE, creep: CREEP, abandon: ABANDON, soften: SOFTEN, cover: COVER, blindside: BLIND};
module.exports = { RULES, FIXED, spotted };
if (require.main !== module && isMainThread) return;

if (!isMainThread){
  const live = I.moveChoose; // the shipped harrier / guard policies (LIVE=1) still decide for their own units
  I.moveChoose = (w, u, t, d, Pw, arch) => {
    if (arch !== 'cat') return live(w, u, t, d, Pw, arch);
    const a = Pw.fixed !== undefined ? Pw.fixed : RULES[Pw.rule](F.extract(w, u, t, d));
    const st = w.cfg.moveStats; if (st){ const c = st[arch] || (st[arch] = new Array(7).fill(0)); c[a]++; }
    return a;
  };
  parentPort.postMessage(workerData.jobs.map(j => ({k: j.k, i: j.i, rec: R.runFight(j.f, j.w, 'cat')}))); return;
}
const N = +process.argv[2] || 800, ARMS = process.argv[3] && process.argv[3] !== 'all' ? process.argv[3].split(',') : null;
const IDX = process.env.IDX !== undefined ? +process.env.IDX : 7, SEED = +process.env.SEED || 26, NT = +process.env.THREADS || 4, LIVE = !!process.env.LIVE;
const arms = [...Object.keys(FIXED).map(k => ({k, w: {fixed: FIXED[k], set: 'cat'}})), ...Object.keys(RULES).map(k => ({k, w: {rule: k, set: 'cat'}}))].filter(o => !ARMS || ARMS.includes(o.k));
const fights = R.fightSet('probe', IDX, N, {arch: 'cat', seed: SEED, withLive: LIVE}), jobs = [];
fights.forEach((f, i) => { jobs.push({k: 'base', i, f, w: null}); for (const o of arms) jobs.push({k: o.k, i, f, w: o.w}); });
const cats = f => [...new Set(f.board.filter(id => !f.team.includes(id) && AR.enemyArch(id) === 'cat').map(id => I.sp(P.A.BY_ID[id])))];
const SPECIES = ['tiger', 'lion', 'leopard', 'jaguar', 'cougar', 'smilodon'];
const t0 = Date.now();
Promise.all([...Array(NT).keys()].map(k => new Promise((res, rej) => { const w = new Worker(__filename, {workerData: {jobs: jobs.filter((_, q) => q % NT === k)}}); w.on('message', res); w.on('error', rej); }))).then(p => {
  const M = {}; p.flat().forEach(o => { (M[o.k] = M[o.k] || [])[o.i] = o.rec; });
  const base = M.base, ref = RW.reference(base), n = base.length, sp = fights.map(cats);
  const fmt = (d, s) => `${d >= 0 ? '+' : ''}${d.toFixed(3)} ± ${s.toFixed(3)}${Math.abs(d) > 2 * s ? (d > 0 ? ' **\\***' : ' *') : ''}`;
  console.log(`cat intent probe: ${jobs.length} fights, ${((Date.now() - t0) / 1000).toFixed(0)} s (probe pool index ${IDX}, seed ${SEED}${LIVE ? ', live harrier/guard policies on' : ''}); goal diff vs the heuristic on the same fights, * = beyond 2 SE`);
  console.log(`${n} fights, ${RW.mean(base.map(r => r.n)).toFixed(2)} cats per fight, heuristic goal ${RW.mean(base.map(RW.goal)).toFixed(3)}, kills of you ${(100 * RW.mean(base.map(r => r.killedYou))).toFixed(1)}%; fights per species: ${SPECIES.map(s => s + ' ' + sp.filter(a => a.includes(s)).length).join(', ')}`);
  console.log('| arm | goal ± SE | style | gates | drift | kills of you (pts) | non-commit | ' + SPECIES.join(' | ') + ' |');
  console.log('|---|---|---|---|---|---|---|' + SPECIES.map(() => '---|').join(''));
  for (const o of arms){
    const r = M[o.k], q = RW.paired(base, r, ref), yk = base.map((b, i) => (r[i].killedYou || 0) - (b.killedYou || 0));
    const it = r.reduce((s, x) => (x.intents || new Array(7).fill(0)).map((v, k) => s[k] + v), new Array(7).fill(0)), tot = it.reduce((s, v) => s + v, 0) || 1;
    const per = SPECIES.map(s => { const d = base.map((b, i) => sp[i].includes(s) ? RW.goal(r[i]) - RW.goal(b) : null).filter(v => v !== null); return d.length > 20 ? fmt(RW.mean(d), RW.se(d)) : 'n/a'; });
    console.log(`| ${o.k} | ${fmt(q.diff, q.se)} | ${q.styleB.style.toFixed(2)} | ${q.styleB.failed.join(', ') || '-'} | ${q.driftB.join('; ') || '-'} | ${(100 * RW.mean(yk)) >= 0 ? '+' : ''}${(100 * RW.mean(yk)).toFixed(1)} ± ${(100 * RW.se(yk)).toFixed(1)} | ${(100 * (1 - it[0] / tot)).toFixed(0)}% | ${per.join(' | ')} |`);
  }
});
