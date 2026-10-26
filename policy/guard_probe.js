// Milestone 3, guard archetype: headroom probe. Every fixed intent and a few hand-written conditional rules for all your
// guards vs the heuristic on the same paired fights (player-like $1,200 teams on dealt boards).
//   node policy/guard_probe.js [fights=800] [--threads=3] [--index=7] [--arms=1,3]   (arm indices as listed; 0 = heuristic, always run)
// Prints per arm: survival time diff (s) ± paired SE, win % diff, damage to you and its collateral part (hits aimed at
// someone else), guard deaths, the guard goal diff, style (vs the heuristic profile measured on these fights), failed gates
// and drift flags.
const R = require('./move_run.js');
const RW = require('./move_reward.js');
const WK = require('./train_worker.js');

const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--'));
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
const N = +(pos[0] || 800), threads = +(opt.threads || 3), index = +(opt.index || 7);
const I = R.A._internals;
const ARMS = [['heuristic', null], ...I.GUARD_INTENTS.slice(1).map((k, i) => ['always ' + k, {fixed: i + 1}]),
  ['space unless targeted, then intercept', {rule: 'spaceElseIntercept'}],
  ['screen when a predator targets you', {rule: 'screenPred'}],
  ['space out when a sweeper/charger fights near you', {rule: 'spaceIfCollateral'}],
  ['intercept whatever targets you', {rule: 'interceptIfTargeted'}]];
if (opt.arms) { const keep = opt.arms.split(',').map(Number); if (!keep.includes(0)) keep.unshift(0); ARMS.splice(0, ARMS.length, ...keep.map(i => ARMS[i])); } // --arms=1,3: the heuristic plus these arms

(async () => {
  const fights = R.fightSet('probe', index, N, {seed: 1, arch: 'guard'}), t0 = Date.now();
  const jobs = {format: WK.JOBS_FORMAT, version: WK.VERSION, simHash: R.simHash(), harnessHash: R.harnessHash(), arch: 'guard',
    cands: ARMS.map(a => a[1]), sets: [{name: 'probe', cands: ARMS.map((_, i) => i), fights}]};
  const res = await WK.runShard(jobs, 0, 1, threads), recs = ARMS.map((_, c) => res.slice(c * N, (c + 1) * N).map(x => x.rec));
  const wall = (Date.now() - t0) / 1000, base = recs[0], ref = RW.reference(base);
  console.log(`guard headroom probe: ${N} paired fights per arm (${[...new Set(fights.map(f => f.tr))].join('/')}, probe pool #${index}), ${ARMS.length} arms, ${wall.toFixed(0)} s`);
  const f = (v, d) => (v >= 0 ? '+' : '') + v.toFixed(d === undefined ? 1 : d);
  const surv = r => r.survived ? 300 : r.t;
  console.log(`heuristic: survival ${RW.mean(base.map(surv)).toFixed(1)} s, win ${(100 * RW.mean(base.map(r => r.survived))).toFixed(1)}%, damage to you ${RW.mean(base.map(r => r.dmgHuman)).toFixed(0)}/fight (collateral ${RW.mean(base.map(r => r.dmgCollateral)).toFixed(0)}), guard deaths ${RW.mean(base.map(r => r.deaths)).toFixed(2)}/fight, goal ${RW.mean(base.map(RW.goal)).toFixed(3)}`);
  for (let a = 0; a < ARMS.length; a++){
    const B = recs[a], P = RW.paired(base, B, ref);
    const ds = B.map((r, i) => surv(r) - surv(base[i])), dw = B.map((r, i) => r.survived - base[i].survived);
    const dh = B.map((r, i) => r.dmgHuman - base[i].dmgHuman), dc = B.map((r, i) => r.dmgCollateral - base[i].dmgCollateral), dd = B.map((r, i) => r.deaths - base[i].deaths);
    const it = B.reduce((q, r) => (r.intents || [0, 0, 0, 0, 0, 0]).map((v, k) => q[k] + v), [0, 0, 0, 0, 0, 0]), tot = it.reduce((x, y) => x + y, 0);
    console.log(`${ARMS[a][0].padEnd(48)} survival ${f(RW.mean(ds))} ± ${RW.se(ds).toFixed(1)} s | win ${f(100 * RW.mean(dw))} ± ${(100 * RW.se(dw)).toFixed(1)} pts | dmg to you ${f(RW.mean(dh), 0)} ± ${RW.se(dh).toFixed(0)} (collateral ${f(RW.mean(dc), 0)} ± ${RW.se(dc).toFixed(0)}) | guard deaths ${f(RW.mean(dd), 2)} | goal ${f(P.diff, 3)} ± ${P.se.toFixed(3)} | style ${P.styleB.style.toFixed(2)} gates [${P.styleB.failed}] drift ${P.driftB.length}${tot ? ' | non-hold ' + (100 * (1 - it[0] / tot)).toFixed(0) + '%' : ''}`);
    if (P.driftB.length && a) console.log(`    drift: ${P.driftB.join('; ')}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
