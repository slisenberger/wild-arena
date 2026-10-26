// Milestone 3 harness checks. node policy/harness_test.js [--quick] [--full] [--arch=harrier|guard|cat|...[,more]]
// Sections 1-4 run per archetype (harrier = the other side's pack hunters, guard = your guards, and the other side's cat /
// charger / bulldozer / brawler / kicker); section 0 and 5 once. Every archetype gets section 1's zero = heuristic and
// determinism checks; whole dry runs / resume and sections 2-4 run for harrier, guard and SAMPLE (cat, charger, brawler),
// or for every archetype with --full (or the ones named with --arch).
// 0 engine: without cfg.movePolicy, fights identical to the engine before the newest hook (REF_SIM=path, else the newest
//   git revision of sim.js without `guardDecide`); a harrier-only policy leaves your guards untouched and vice versa.
// 1 determinism & plumbing: zero weights / intent-0 probe / zero output layer over a random hidden layer identical to no
//   policy; serial = worker threads = 4 shards merged; CLI shards + merge = local run; resume = no resume.
// 2 reward sanity: probe policies (intent 0 = heuristic; a clearly bad probe is worse; anti-gaming); style symmetric
//   across a paired comparison; per-component variance and fights needed for 2 SE.
// 3 seed pools disjoint, held-out map excluded from train/val and present in test.
// 4 reward-hacking: probes get drift flags; the heuristic doesn't.
// 5 engineering: versions + engine hash refuse a stale state; dry runs under a minute.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { Worker } = require('worker_threads');
const R = require('./move_run.js');
const M = require('./move_model.js');
const RW = require('./move_reward.js');
const WK = require('./train_worker.js');
const T = require('./train.js');
const { arch: archOf } = require('./move_arch.js');

const QUICK = process.argv.includes('--quick');
const ONLY = (process.argv.find(a => a.startsWith('--arch=')) || '').slice(7) || null; // one archetype, or a comma list
const FULL = process.argv.includes('--full');
const SAMPLE = ['cat', 'charger', 'brawler'];
const NF = QUICK ? 40 : 160;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'm3test-'));
const node = process.execPath, here = __dirname;
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c){ pass++; console.log('  PASS ' + msg); } else { fail++; console.log('  FAIL ' + msg); } };
const strip = s => JSON.stringify(s, (k, v) => ['wall', 'fps', 'created'].includes(k) ? undefined : v);
const jobsOf = (cands, fights, arch) => ({format: WK.JOBS_FORMAT, version: WK.VERSION, simHash: R.simHash(), harnessHash: R.harnessHash(), arch, cands, sets: [{name: 'x', cands: cands.map((_, i) => i), fights}]});
const byCand = (res, nc, n) => [...Array(nc).keys()].map(c => res.slice(c * n, (c + 1) * n).map(x => x.rec));
const same = (a, b) => a.every((x, i) => x.fp === b[i].fp && x.t === b[i].t);
const f3 = v => (v >= 0 ? '+' : '') + v.toFixed(3);

// fingerprints with a given sim.js file, in a fresh thread (so it gets its own module instance); mp = cfg.movePolicy
function plainFP(simPath, fights, mp){
  const code = `const {parentPort, workerData} = require('worker_threads'); const crypto = require('crypto'); const A = require(workerData.sim);
    if (workerData.mp){ process.env.SIM = workerData.sim; require(workerData.pol); }
    parentPort.postMessage(workerData.fights.map(f => { const c = {team: f.team, board: f.board, terrain: f.tr, mode: 'wild', mount: f.mount, seed: f.seed, livePolicy: false}; if (workerData.mp) c.movePolicy = workerData.mp;
      const w = A.simulate(c), h = crypto.createHash('sha1'); h.update(JSON.stringify(w.events)); h.update(JSON.stringify(w.units.map(u => [u.x, u.y, u.hp, u.state]))); return h.digest('hex').slice(0, 16) + '|' + w.result.t; }));`;
  return new Promise((res, rej) => { const w = new Worker(code, {eval: true, workerData: {sim: simPath, fights, mp, pol: path.join(here, 'move_policy.js')}}); w.on('message', res); w.on('error', rej); });
}
function refSim(){
  if (process.env.REF_SIM) return path.resolve(process.env.REF_SIM);
  const root = path.join(__dirname, '..');
  try {
    const revs = execFileSync('git', ['log', '--format=%H', '-n', '40', '--', 'sim.js'], {cwd: root}).toString().trim().split('\n');
    for (const h of revs){ const src = execFileSync('git', ['show', h + ':sim.js'], {cwd: root, maxBuffer: 1 << 26}).toString(); if (!src.includes('guardDecide')){ const f = path.join(tmp, 'ref_sim.js'); fs.writeFileSync(f, src); return {f, h}; } }
  } catch (e) { /* no git */ }
  return null;
}

// the other side's other archetypes (cat, charger, bulldozer, brawler, kicker): same intents as the harriers
const XARCH = ['cat', 'charger', 'bulldozer', 'brawler', 'kicker'];
const ALL = ['harrier', 'guard', ...XARCH];
const gateOf = (r, g) => r.P.styleB.failed.includes(g);
function xprobe(arch){
  return {names: ['commit', 'wait', 'flank', 'regroup', 'disengage'], check(rows, arms){
    const [hc, hw, , , hd] = rows;
    ok(hd.P.diff < -2 * hd.P.se, `${arch}: always disengage: goal clearly worse (beyond 2 SE)`);
    ok(hw.P.styleB.style < T.DEFAULTS.styleThr && hd.P.styleB.style < T.DEFAULTS.styleThr, `${arch}: always wait / always disengage: style ${hw.P.styleB.style.toFixed(2)} / ${hd.P.styleB.style.toFixed(2)} below the ${T.DEFAULTS.styleThr} threshold`);
    ok(hw.P.mB.noContact > hc.P.mB.noContact + .1, `${arch}: circling without contact counts as idle (no-contact share ${(100 * hc.P.mB.noContact).toFixed(0)}% -> ${(100 * hw.P.mB.noContact).toFixed(0)}% for always-wait)`);
    ok(gateOf(hw, 'longIdle') && gateOf(hd, 'longIdle'), `${arch}: always wait / always disengage fail the long-idle gate`);
    ok(hw.P.driftB.length > 0 && hd.P.driftB.length > 0, `${arch}: always wait / disengage get telemetry drift flags: ` + rows.slice(1).map(r => `${r.name} ${r.P.driftB.length}`).join(', '));
    if (arch === 'charger') ok(gateOf(hw, 'chargeRate') && hw.P.mB.chargeRate < .5 * hc.P.mB.chargeRate, `charger: always wait fails the charge-rate gate (charges per engaged minute ${hc.P.mB.chargeRate.toFixed(1)} -> ${hw.P.mB.chargeRate.toFixed(1)})`);
    if (arch === 'brawler'){
      const nb = arms[0].filter(r => r.badgerLife > 0).length;
      if (nb) ok(gateOf(hd, 'badgerBack') && hc.P.mB.badgerBack === 0, `brawler: the heuristic honey badger never backs off; always disengage fails the fearless gate (${nb} fights with a badger; ${(100 * hd.P.mB.badgerBack).toFixed(0)}% of its time)`);
      else console.log('  SKIP fearless gate: no honey badger in these fights');
    }
    if (arch === 'cat') ok(hw.P.mB.pounceRate < hc.P.mB.pounceRate, `cat: always wait pounces less (${hc.P.mB.pounceRate.toFixed(2)} -> ${hw.P.mB.pounceRate.toFixed(2)} per engaged minute)`);
  }};
}

// per-archetype expectations for the probe section
const PROBES = {
  harrier: {names: ['commit', 'wait', 'flank', 'regroup', 'disengage'], check(rows){
    const [hc, hw, , , hd] = rows;
    ok(hd.P.diff < -2 * hd.P.se, 'always disengage: goal clearly worse (beyond 2 SE)');
    ok(hw.parts.idle <= 2 * hc.parts.idle && hw.P.mB.noContact > hc.P.mB.noContact + .1, `always wait: idle penalty at least 2× the heuristic's (${hc.parts.idle.toFixed(3)} -> ${hw.parts.idle.toFixed(3)} per fight)`);
    ok(hw.P.styleB.style < T.DEFAULTS.styleThr, `always wait: style ${hw.P.styleB.style.toFixed(2)} below the ${T.DEFAULTS.styleThr} threshold`);
    ok(hw.P.mB.noContact > hc.P.mB.noContact + .1, `circling without contact counts as idle (no-contact share ${(100 * hc.P.mB.noContact).toFixed(0)}% -> ${(100 * hw.P.mB.noContact).toFixed(0)}% for always-wait)`);
    ok(rows.slice(1).every(r => r.P.driftB.length > 0), 'every fixed-intent probe gets telemetry drift flags: ' + rows.slice(1).map(r => `${r.name} ${r.P.driftB.length}`).join(', '));
  }},
  guard: {names: ['hold', 'screen', 'intercept', 'space', 'help', 'fallback'], check(rows, arms){
    const [hh, hs, , hp, , hf] = rows, base = arms[0], sp = arms[3];
    const dc = sp.map((r, i) => r.dmgCollateral - base[i].dmgCollateral), dsv = sp.map((r, i) => (r.survived ? 300 : r.t) - (base[i].survived ? 300 : base[i].t));
    const dh = sp.map((r, i) => r.dmgHuman - base[i].dmgHuman);
    console.log(`  always space out: collateral damage to you ${RW.mean(base.map(r => r.dmgCollateral)).toFixed(1)} -> ${RW.mean(sp.map(r => r.dmgCollateral)).toFixed(1)} per fight (${f3(RW.mean(dc))} ± ${RW.se(dc).toFixed(1)}), all damage to you ${f3(RW.mean(dh))} ± ${RW.se(dh).toFixed(1)}, survival ${f3(RW.mean(dsv))} ± ${RW.se(dsv).toFixed(1)} s (${Math.abs(RW.mean(dsv)) > 2 * RW.se(dsv) ? 'beyond' : 'within'} 2 SE)`);
    ok(RW.mean(dc) < 2 * RW.se(dc), `always space out does not add collateral damage to you (${f3(RW.mean(dc))} ± ${RW.se(dc).toFixed(1)} HP per fight; small effect since the front-only elephant sweep)`);
    ok(hf.P.diff < -2 * hf.P.se, 'always fall back: goal clearly worse (beyond 2 SE)');
    ok(hf.P.styleB.style < T.DEFAULTS.styleThr, `always fall back: style ${hf.P.styleB.style.toFixed(2)} below the ${T.DEFAULTS.styleThr} threshold`);
    ok(hf.P.mB.standby > hh.P.mB.standby + .05, `holding a spot beside you without contact counts as standing by (standby share ${(100 * hh.P.mB.standby).toFixed(0)}% -> ${(100 * hf.P.mB.standby).toFixed(0)}% for always-fall-back; its fights are shorter, so the per-fight penalty moves less)`);
    const moving = [hs, hp, hf]; // the intents that change where guards stand (intercept / help only re-pick targets)
    ok(moving.every(r => r.P.driftB.length > 0), 'every movement probe gets telemetry drift flags: ' + rows.slice(1).map(r => `${r.name} ${r.P.driftB.length}`).join(', '));
  }},
};
for (const a of XARCH) PROBES[a] = xprobe(a);

async function suite(arch, slow){
  const AR = archOf(arch), F = AR.F, NO = AR.nout;
  console.log(`\n==================== archetype: ${arch} (${F.DIM} features, ${NO} intents: ${AR.intents.join(' / ')})`);
  const fights = R.fightSet('probe', 0, NF, {seed: 1, arch});
  console.log(`${fights.length} probe fights (${[...new Set(fights.map(f => f.tr))].join('/')})`);

  console.log(`\n1. Determinism and plumbing [${arch}]`);
  const Z = M.zeros(F.DIM, 0, 1, NO), ZH = M.withHidden(M.zeros(F.DIM, 16, 0, NO), R.A.rng(3));
  const cands = [null, Z, {fixed: 0}, ZH, M.zeros(F.DIM, 0, 0, NO)];
  const t1 = Date.now(), res = await WK.runShard(jobsOf(cands, fights, arch), 0, 1, 4), fps = res.length / ((Date.now() - t1) / 1000);
  const [rn, rz, rc, rh, r0] = byCand(res, cands.length, fights.length);
  ok(same(rn, rz), 'zero weights (margin 1) = no policy, every fight (event log + final positions)');
  ok(same(rn, r0), 'zero weights with margin 0 (all-tie logits -> intent 0) = no policy');
  ok(same(rn, rc), `always-${AR.intents[0]} probe = no policy`);
  ok(same(rn, rh), 'random hidden layer with a zero output layer = no policy');
  console.log(`  (${fps.toFixed(1)} fights/s on 4 threads with features on)`);
  const sub = fights.slice(0, QUICK ? 12 : 24), pc = [Z, M.unflat(Z, M.flat(Z).map((_, i) => Math.sin(i * 7.3) * .4))];
  const J = jobsOf(pc, sub, arch);
  const ser = await WK.runShard(J, 0, 1, 1), thr = await WK.runShard(J, 0, 1, 4);
  const sh = []; for (let i = 0; i < 4; i++) sh.push(...await WK.runShard(J, i, 4, 1)); sh.sort((a, b) => a.k - b.k);
  ok(JSON.stringify(ser) === JSON.stringify(thr), 'serial = 4 worker threads (full records)');
  ok(JSON.stringify(ser) === JSON.stringify(sh), 'serial = 4 shards merged (full records)');
  ok(!same(ser.slice(0, sub.length).map(x => x.rec), ser.slice(sub.length).map(x => x.rec)), 'a non-zero policy changes fights (the hook is live)');
  if (!slow){ console.log(`  (whole runs, resume and sections 2-4 sampled out for ${arch}: --full runs them)`); return {fA: null}; }

  // whole runs: local serial vs local threads vs CLI shards (jobs -> 3 worker processes -> merge), and resume
  const dry = {arch, calibFights: 16, calibPerturb: 1, pairs: 2, fights: 8, gens: 2, valEvery: 1, valFights: 8, testFights: 8};
  const mk = name => { const f = path.join(tmp, arch + name + '.json'); T.save(f, T.init({cfg: dry})); return f; };
  const fA = mk('A'), fB = mk('B'), fC = mk('C'), fD = mk('D');
  const sA = await T.runLocal(fA, {serial: true, quiet: true}), sC = await T.runLocal(fC, {threads: 4, quiet: true});
  for (let step = 0; step < 10; step++){
    const s = T.load(fB); if (s.phase === 'done') break;
    const jf = path.join(tmp, `${arch}B_jobs_${step}.json`); execFileSync(node, [path.join(here, 'train.js'), 'jobs', fB, jf]);
    const outs = [0, 1, 2].map(i => { const o = path.join(tmp, `${arch}B_out_${step}_${i}.json`); execFileSync(node, [path.join(here, 'train_worker.js'), jf, o, `${i}/3`]); return o; });
    execFileSync(node, [path.join(here, 'train.js'), 'merge', fB, jf, ...outs]);
  }
  const sB = T.load(fB);
  ok(sA.phase === 'done' && sA.config.arch === arch && strip(sA) === strip(sC), 'whole dry run: serial = 4 threads (final state incl. θ, λ, history, validation, test)');
  ok(strip(sA) === strip(sB), 'whole dry run: CLI jobs -> 3 worker processes -> merge = local run');
  await T.runLocal(fD, {serial: true, steps: 2, quiet: true});                 // calib + gen 0, then "crash"
  const sD = await T.runLocal(fD, {serial: true, quiet: true});                // resume from the checkpoint file
  ok(strip(sA) === strip(sD), 'resume from a mid-run checkpoint = uninterrupted run (same next generations and result)');
  ok(sA.history.length === 2 && sA.val.length === 2 && sA.val[0].valIndex !== sA.val[1].valIndex, 'each validation check used a fresh validation draw');
  ok(sA.P0.nout === NO && sA.theta.length === NO * (F.DIM + 1) && sA.intents.length === NO, `state carries the ${arch} model shape (${NO} intents × ${F.DIM} features + bias)`);

  console.log(`\n2. Reward sanity [${arch}]`);
  const PR = PROBES[arch], pr = [Z, ...PR.names.slice(1).map((_, i) => ({fixed: i + 1}))];
  const res2 = await WK.runShard(jobsOf(pr.slice(1), fights, arch), 0, 1, 4), arms = [rz, ...byCand(res2, pr.length - 1, fights.length)];
  const ref = RW.reference(rz);
  const rows = arms.map((a, i) => { const P = RW.paired(rz, a, ref); const parts = Object.keys(RW.goalParts(a[0])).map(k => [k, RW.mean(a.map(r => RW.goalParts(r)[k]))]);
    return {name: PR.names[i], P, parts: Object.fromEntries(parts)}; });
  for (const r of rows) console.log(`  ${r.name.padEnd(9)} goal ${r.P.goalB.toFixed(3)}  vs heuristic ${f3(r.P.diff)} ± ${r.P.se.toFixed(3)}  style ${r.P.styleB.style.toFixed(2)} gates [${r.P.styleB.failed}]  idle ${r.parts.idle.toFixed(3)}  drift ${r.P.driftB.length}${arch === 'guard' ? `  survival ${(100 * r.P.mB.survival).toFixed(0)}%  dmg to you ${r.P.mB.humanDmgPerFight.toFixed(0)} (collateral ${r.P.mB.collateralPerFight.toFixed(0)})` : `  noContact ${(100 * r.P.mB.noContact).toFixed(0)}%  fruitless ${(100 * r.P.mB.fruitless).toFixed(0)}%`}`);
  ok(rows[0].P.diff === 0 && rows[0].P.styleB.style === 1, `always ${PR.names[0]} = heuristic: goal diff 0, style 1`);
  PR.check(rows, arms);
  const Pab = RW.paired(rz, arms[1], ref), Pba = RW.paired(arms[1], rz, ref);
  ok(Pab.styleA.style === Pba.styleB.style && Pab.styleB.style === Pba.styleA.style && Pab.diff === -Pba.diff, 'style and goal symmetric when the arms of a paired comparison are swapped');
  const strip2 = a => a.map(r => Object.assign({}, r, {intents: null}));
  ok(JSON.stringify(RW.metrics(strip2(rn))) === JSON.stringify(RW.metrics(strip2(rz))), 'telemetry and metrics identical for no-policy and zero-weight arms (style computed the same way per fight)');
  // variance and sample size (the calibration phase does the same on its own pool and sets N from it)
  const st = T.init({cfg: {arch, calibFights: fights.length}}); st.ref = ref;
  const sg = T.DEFAULTS.sigma, eps = T.noise(st, -1, 99), NP = QUICK ? 4 : eps.length;
  const pert = await WK.runShard(jobsOf(eps.slice(0, NP).map(e => T.weightsOf(st, st.theta.map((v, i) => v + sg * e[i]))), fights, arch), 0, 1, 4);
  const pa = byCand(pert, NP, fights.length);
  const gz = rz.map(RW.goal);
  console.log(`  heuristic goal per fight ${RW.mean(gz).toFixed(3)} (sd ${RW.sd(gz).toFixed(3)}); components:`);
  for (const k of Object.keys(RW.goalParts(rz[0]))){ const a = rz.map(r => RW.goalParts(r)[k]); console.log(`    ${k.padEnd(8)} mean ${RW.mean(a).toFixed(3)} sd ${RW.sd(a).toFixed(3)}`); }
  const dd = pa.map(p => p.map((r, i) => RW.goal(r) - gz[i])), feas = pa.map(p => { const g = RW.grade(RW.metrics(p), ref, p.length); return g.style >= T.DEFAULTS.styleThr && g.gatesPass; });
  const nc = pa.map(p => { const z = () => new Array(NO).fill(0), it = p.reduce((a, r) => (r.intents || z()).map((v, k) => a[k] + v), z()); return 1 - it[0] / it.reduce((a, b) => a + b, 0); });
  const sdOf = ds => Math.sqrt(RW.mean(ds.map(d => RW.sd(d) ** 2))), sdAll = sdOf(dd), fd = dd.filter((_, i) => feas[i]), sdF = fd.length ? sdOf(fd) : NaN;
  console.log(`  σ = ${sg} perturbations vs heuristic (goal diff ± SE, share of non-${AR.intents[0]} decisions, realistic = style >= threshold and gates pass):`);
  dd.forEach((d, i) => console.log(`    ${f3(RW.mean(d))} ± ${RW.se(d).toFixed(3)}  non-${AR.intents[0]} ${(100 * nc[i]).toFixed(0)}%  ${feas[i] ? 'realistic' : 'unrealistic'}`));
  console.log(`  paired per-fight sd: all ${sdAll.toFixed(3)}, realistic only ${isNaN(sdF) ? 'n/a' : sdF.toFixed(3)} (unpaired ${RW.sd(gz).toFixed(3)})`);
  const sdN = isNaN(sdF) ? sdAll : sdF;
  for (const eff of [.01, .02, .05, .1]) console.log(`    fights for a 2 SE detection of ${eff}: ${Math.ceil((2 * sdN / eff) ** 2)}`);
  if (fd.length) ok(sdF < RW.sd(gz), 'pairing reduces per-fight noise for realistic perturbations (paired sd < unpaired sd)');
  else console.log('  SKIP pairing check: no realistic perturbation in this sample');

  console.log(`\n3. Anti-overfitting (seed pools) [${arch}]`);
  const o = {seed: 1, holdMap: 'forest', arch}, sets = {train: [0, 1, 2].map(i => R.fightSet('train', i, 40, o)), val: [0, 1].map(i => R.fightSet('val', i, 40, o)), test: [R.fightSet('test', 0, 40, o)], calib: [R.fightSet('calib', 0, 40, o)]};
  const key = f => f.seed, bkey = f => f.bseed + '|' + f.tr, all = {}, ball = {};
  let clash = 0, bclash = 0;
  for (const [p, ss] of Object.entries(sets)) ss.forEach((s, i) => s.forEach(f => { const k = key(f); if (all[k] && all[k] !== p + i) clash++; all[k] = p + i; const b = bkey(f); if (ball[b] && ball[b] !== p + i) bclash++; ball[b] = p + i; }));
  ok(clash === 0 && bclash === 0, 'train / val / test / calib pools (and each generation\'s / check\'s draw) share no fight seeds or boards');
  ok(![...sets.train, ...sets.val].flat().some(f => f.tr === 'forest') && sets.test[0].some(f => f.tr === 'forest'), 'held-out map (holdMap) never in train/val, present in test');
  ok(fights.every(f => AR.has(f.board, f.team, f.mount)), arch === 'guard' ? 'every fight has at least one guard on your side' : `every fight has ${arch === 'harrier' ? 'harriers' : 'a ' + arch} on the other side`);
  if (arch !== 'guard'){ const n = rz.map(r => r.n); ok(n.every(v => v > 0), `every ${arch} fight records at least one ${arch} unit (mean ${RW.mean(n).toFixed(2)} per fight)`); }
  ok(fights.every(f => { let left = R.A.RULES.budget; for (const id of f.team) left -= R.A.BY_ID[id].price; return left >= 0 && f.team.every(id => f.board.includes(id)); }), `every team is a player-like draft from its dealt board within the $${R.A.RULES.budget} budget`);

  console.log(`\n4. Reward-hacking checks [${arch}]`);
  ok(RW.drift(RW.metrics(rz), ref, rz.length).length === 0, 'the heuristic itself is not flagged');
  return {fA};
}

(async () => {
  const t00 = Date.now();
  console.log(`harness test${QUICK ? ' (quick)' : ''}, tmp ${tmp}`);
  console.log('\n0. Engine: no policy = the engine before the guard hook; archetypes stay independent');
  const rs = refSim();
  const fg = R.fightSet('probe', 0, NF, {seed: 1, arch: 'guard'}), fh = R.fightSet('probe', 0, NF, {seed: 1, arch: 'harrier'});
  if (rs){
    const all = QUICK ? fg.concat(fh) : fg.concat(fh, require('./common.js').boardJobs(2, 40, 31337)); // + check_identical.js's 320 board fights
    const a = await plainFP(rs.f || rs, all), b = await plainFP(R.SIM, all);
    ok(a.every((x, i) => x === b[i]), `no movePolicy: ${all.length} fights identical to the pre-guard-hook engine (${rs.h ? 'git ' + rs.h.slice(0, 7) : rs}); events, final positions/HP/states, end time`);
    // a harrier-only policy must not touch your guards: the old engine with that policy = the new one
    const hp = {harrier: {fixed: 2}}, a2 = await plainFP(rs.f || rs, fh, hp), b2 = await plainFP(R.SIM, fh, hp);
    ok(a2.every((x, i) => x === b2[i]), `harrier-only policy (always flank): ${fh.length} fights identical to the pre-guard-hook engine (guards untouched)`);
  } else console.log('  SKIP pre-hook comparison (set REF_SIM=path/to/pre-hook/sim.js)');
  const gOnly = await plainFP(R.SIM, fh, {guard: {fixed: 0}, harrier: {fixed: 2}}), hOnly = await plainFP(R.SIM, fh, {harrier: {fixed: 2}});
  ok(gOnly.every((x, i) => x === hOnly[i]), 'adding a zero (always-hold) guard policy next to a harrier policy changes nothing');
  // the other archetypes: zero weights for all five next to the live game's shipped harrier + guard weights = those alone
  // (so the live default is untouched by the new hooks), and each archetype's policy only moves its own units
  const LV = R.A._internals.LIVE, fxs = R.fightSet('probe', 0, QUICK ? 20 : 60, {seed: 3, arch: 'cat'}).concat(R.fightSet('probe', 0, QUICK ? 20 : 60, {seed: 3, arch: 'charger'}));
  const zx = {}; for (const a of XARCH) zx[a] = M.zeros(archOf(a).F.DIM, 0, 1, archOf(a).nout);
  const live = {harrier: LV.harrier, guard: LV.guard}, l0 = await plainFP(R.SIM, fxs, live), l1 = await plainFP(R.SIM, fxs, Object.assign({}, live, zx));
  ok(LV.harrier && LV.guard && l0.every((x, i) => x === l1[i]), `zero weights for ${XARCH.join(' / ')} next to the shipped harrier + guard policies: ${fxs.length} fights identical to the shipped policies alone`);
  const c1 = await plainFP(R.SIM, fxs, {cat: {fixed: 2}}), c2 = await plainFP(R.SIM, fxs, Object.assign({cat: {fixed: 2}}, zx, {cat: {fixed: 2}}));
  ok(c1.every((x, i) => x === c2[i]), `a cat-only policy (always flank) gives the same fights with zero weights for every other archetype next to it`);

  let fA = null;
  // every archetype gets section 1's zero = heuristic and determinism checks; the slow ones (whole dry runs, resume, probe
  // sanity, seed pools, drift) run for harrier, guard and a sample of the others (SAMPLE, or every one with --full)
  for (const a of ALL) if (!ONLY || ONLY.split(',').includes(a)){ const r = await suite(a, FULL || !XARCH.includes(a) || SAMPLE.includes(a) || !!ONLY); fA = fA || r.fA; }

  console.log('\n5. Engineering');
  const sv = JSON.parse(fs.readFileSync(fA, 'utf8'));
  ok(sv.version === 1 && sv.simHash === R.simHash() && sv.harnessHash === R.harnessHash() && sv.config.seed === 1, 'state records version, sim.js hash, harness hash, seed and config');
  const fx = path.join(tmp, 'stale.json'); T.save(fx, Object.assign({}, sv, {simHash: 'deadbeef'}));
  let threw = false; try { T.load(fx); } catch (e) { threw = /engine changed/.test(e.message); } ok(threw, 'a state from a different sim.js is refused');
  T.save(fx, Object.assign({}, sv, {version: 99})); threw = false; try { T.load(fx); } catch (e) { threw = true; } ok(threw, 'an unknown state version is refused');
  const jfile = fs.readdirSync(tmp).find(f => /B_jobs_0\.json$/.test(f));
  const jx = JSON.parse(fs.readFileSync(path.join(tmp, jfile), 'utf8')); jx.simHash = 'deadbeef'; threw = false; try { WK.checkJobs(jx); } catch (e) { threw = true; } ok(threw, 'a worker refuses jobs built for a different engine');
  ok(jx.seed === 1 && jx.config && jx.sets[0].fights.every(f => f.seed && f.bseed), 'jobs record seed, config and every fight\'s board/fight seed');
  threw = false; try { T.init({cfg: {arch: 'nope'}}); } catch (e) { threw = /unknown archetype/.test(e.message); } ok(threw, 'an unknown archetype is refused at init');
  for (const a of ALL) if (!ONLY || ONLY.split(',').includes(a)){
    const fdry = path.join(tmp, `dry_${a}.json`), t2 = Date.now();
    execFileSync(node, [path.join(here, 'train.js'), 'init', fdry, '--dry-run', '--arch=' + a]); execFileSync(node, [path.join(here, 'train.js'), 'run', fdry]);
    const dt = (Date.now() - t2) / 1000; ok(T.load(fdry).phase === 'done' && T.load(fdry).config.arch === a && dt < 60, `${a} dry run (init --arch=${a} + calib + 1 gen + val + test) finished in ${dt.toFixed(1)} s`);
    ok(fs.readFileSync(fdry + '.log', 'utf8').includes('[gen 0]'), `${a}: per-generation log line written`);
  }

  console.log(`\n${pass} passed, ${fail} failed (${((Date.now() - t00) / 1000).toFixed(0)} s)`);
  fs.rmSync(tmp, {recursive: true, force: true});
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
