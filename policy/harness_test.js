// Milestone 3 harness checks. node policy/harness_test.js [--quick]   (~3-5 min on 4 cores; --quick ~1 min)
// 1 determinism & plumbing: no-hook engine identical to the pre-hook sim.js (REF_SIM=path, else the newest git
//   revision of sim.js without the hook); zero weights / always-commit / zero output layer over a random hidden layer
//   identical to no policy; serial = worker threads = 4 shards merged; CLI shards + merge = local run; resume = no resume.
// 2 reward sanity: probe policies (commit = heuristic, disengage < heuristic on goal, wait: idle penalty up, style down);
//   style symmetric across a paired comparison; per-component variance and fights needed for 2 SE.
// 3 seed pools disjoint, held-out map excluded from train/val and present in test.
// 4 reward-hacking: probes get drift flags; pointless circling counts as no-contact time.
// 5 engineering: versions + engine hash refuse a stale state; dry run under a minute.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { Worker } = require('worker_threads');
const R = require('./move_run.js');
const M = require('./move_model.js');
const F = require('./move_features.js');
const RW = require('./move_reward.js');
const WK = require('./train_worker.js');
const T = require('./train.js');

const QUICK = process.argv.includes('--quick');
const NF = QUICK ? 40 : 160;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'm3test-'));
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c){ pass++; console.log('  PASS ' + msg); } else { fail++; console.log('  FAIL ' + msg); } };
const strip = s => JSON.stringify(s, (k, v) => ['wall', 'fps', 'created'].includes(k) ? undefined : v);
const jobsOf = (cands, fights) => ({format: WK.JOBS_FORMAT, version: WK.VERSION, simHash: R.simHash(), harnessHash: R.harnessHash(), arch: 'harrier', cands, sets: [{name: 'x', cands: cands.map((_, i) => i), fights}]});
const byCand = (res, nc, n) => [...Array(nc).keys()].map(c => res.slice(c * n, (c + 1) * n).map(x => x.rec));

// fingerprints with a given sim.js file, in a fresh thread (so it gets its own module instance)
function plainFP(simPath, fights){
  const code = `const {parentPort, workerData} = require('worker_threads'); const crypto = require('crypto'); const A = require(workerData.sim);
    parentPort.postMessage(workerData.fights.map(f => { const w = A.simulate({team: f.team, board: f.board, terrain: f.tr, mode: 'wild', mount: f.mount, seed: f.seed});
      const h = crypto.createHash('sha1'); h.update(JSON.stringify(w.events)); h.update(JSON.stringify(w.units.map(u => [u.x, u.y, u.hp, u.state]))); return h.digest('hex').slice(0, 16) + '|' + w.result.t; }));`;
  return new Promise((res, rej) => { const w = new Worker(code, {eval: true, workerData: {sim: simPath, fights}}); w.on('message', res); w.on('error', rej); });
}
function refSim(){
  if (process.env.REF_SIM) return path.resolve(process.env.REF_SIM);
  const root = path.join(__dirname, '..');
  try {
    const revs = execFileSync('git', ['log', '--format=%H', '-n', '40', '--', 'sim.js'], {cwd: root}).toString().trim().split('\n');
    for (const h of revs){ const src = execFileSync('git', ['show', h + ':sim.js'], {cwd: root, maxBuffer: 1 << 26}).toString(); if (!src.includes('movePolicy')){ const f = path.join(tmp, 'ref_sim.js'); fs.writeFileSync(f, src); return {f, h}; } }
  } catch (e) { /* no git */ }
  return null;
}

(async () => {
  const t00 = Date.now();
  const fights = R.fightSet('probe', 0, NF, {seed: 1});
  console.log(`harness test: ${fights.length} probe fights (${[...new Set(fights.map(f => f.tr))].join('/')}), tmp ${tmp}`);

  console.log('\n1. Determinism and plumbing');
  const rs = refSim();
  if (rs){
    const a = await plainFP(rs.f || rs, fights), b = await plainFP(R.SIM, fights);
    ok(a.every((x, i) => x === b[i]), `no movePolicy: ${fights.length} fights identical to the pre-hook engine (${rs.h ? 'git ' + rs.h.slice(0, 7) : rs}); events, final positions/HP/states, end time`);
  } else console.log('  SKIP pre-hook comparison (set REF_SIM=path/to/pre-hook/sim.js)');
  const Z = M.zeros(F.DIM, 0, 1), ZH = M.withHidden(M.zeros(F.DIM, 16, 0), R.A.rng(3));
  const cands = [null, Z, {fixed: 0}, ZH, M.zeros(F.DIM, 0, 0)];
  const t1 = Date.now(), res = await WK.runShard(jobsOf(cands, fights), 0, 1, 4), fps = res.length / ((Date.now() - t1) / 1000);
  const [rn, rz, rc, rh, r0] = byCand(res, cands.length, fights.length);
  const same = (a, b) => a.every((x, i) => x.fp === b[i].fp && x.t === b[i].t);
  ok(same(rn, rz), 'zero weights (margin 1) = no policy, every fight (event log + final positions)');
  ok(same(rn, r0), 'zero weights with margin 0 (all-tie logits -> commit) = no policy');
  ok(same(rn, rc), 'always-commit probe = no policy');
  ok(same(rn, rh), 'random hidden layer with a zero output layer = no policy');
  console.log(`  (${fps.toFixed(1)} fights/s on 4 threads with features on)`);
  const sub = fights.slice(0, QUICK ? 12 : 24), pc = [Z, M.unflat(Z, M.flat(Z).map((_, i) => Math.sin(i * 7.3) * .4))];
  const J = jobsOf(pc, sub);
  const ser = await WK.runShard(J, 0, 1, 1), thr = await WK.runShard(J, 0, 1, 4);
  const sh = []; for (let i = 0; i < 4; i++) sh.push(...await WK.runShard(J, i, 4, 1)); sh.sort((a, b) => a.k - b.k);
  ok(JSON.stringify(ser) === JSON.stringify(thr), 'serial = 4 worker threads (full records)');
  ok(JSON.stringify(ser) === JSON.stringify(sh), 'serial = 4 shards merged (full records)');

  // whole runs: local serial vs local threads vs CLI shards (jobs -> 3 worker processes -> merge), and resume
  const dry = {calibFights: 16, calibPerturb: 1, pairs: 2, fights: 8, gens: 2, valEvery: 1, valFights: 8, testFights: 8};
  const mk = name => { const f = path.join(tmp, name + '.json'); T.save(f, T.init({cfg: dry})); return f; };
  const fA = mk('A'), fB = mk('B'), fC = mk('C'), fD = mk('D');
  const sA = await T.runLocal(fA, {serial: true, quiet: true}), sC = await T.runLocal(fC, {threads: 4, quiet: true});
  const node = process.execPath, here = __dirname;
  for (let step = 0; step < 10; step++){
    const s = T.load(fB); if (s.phase === 'done') break;
    const jf = path.join(tmp, `B_jobs_${step}.json`); execFileSync(node, [path.join(here, 'train.js'), 'jobs', fB, jf]);
    const outs = [0, 1, 2].map(i => { const o = path.join(tmp, `B_out_${step}_${i}.json`); execFileSync(node, [path.join(here, 'train_worker.js'), jf, o, `${i}/3`]); return o; });
    execFileSync(node, [path.join(here, 'train.js'), 'merge', fB, jf, ...outs]);
  }
  const sB = T.load(fB);
  ok(sA.phase === 'done' && strip(sA) === strip(sC), 'whole dry run: serial = 4 threads (final state incl. θ, λ, history, validation, test)');
  ok(strip(sA) === strip(sB), 'whole dry run: CLI jobs -> 3 worker processes -> merge = local run');
  await T.runLocal(fD, {serial: true, steps: 2, quiet: true});                 // calib + gen 0, then "crash"
  const sD = await T.runLocal(fD, {serial: true, quiet: true});                // resume from the checkpoint file
  ok(strip(sA) === strip(sD), 'resume from a mid-run checkpoint = uninterrupted run (same next generations and result)');
  ok(sA.history.length === 2 && sA.val.length === 2 && sA.val[0].valIndex !== sA.val[1].valIndex, 'each validation check used a fresh validation draw');

  console.log('\n2. Reward sanity');
  const pr = [Z, {fixed: 1}, {fixed: 2}, {fixed: 3}, {fixed: 4}], names = ['commit', 'wait', 'flank', 'regroup', 'disengage'];
  const res2 = await WK.runShard(jobsOf(pr.slice(1), fights), 0, 1, 4), arms = [rz, ...byCand(res2, 4, fights.length)];
  const ref = RW.reference(rz);
  const rows = arms.map((a, i) => { const P = RW.paired(rz, a, ref); const parts = Object.keys(RW.goalParts(a[0])).map(k => [k, RW.mean(a.map(r => RW.goalParts(r)[k]))]);
    return {name: names[i], P, parts: Object.fromEntries(parts)}; });
  for (const r of rows) console.log(`  ${r.name.padEnd(9)} goal ${r.P.goalB.toFixed(3)}  vs heuristic ${(r.P.diff >= 0 ? '+' : '') + r.P.diff.toFixed(3)} ± ${r.P.se.toFixed(3)}  style ${r.P.styleB.style.toFixed(2)} gates [${r.P.styleB.failed}]  idle ${r.parts.idle.toFixed(3)}  noContact ${(100 * r.P.mB.noContact).toFixed(0)}%  fruitless ${(100 * r.P.mB.fruitless).toFixed(0)}%  drift ${r.P.driftB.length}`);
  const [hc, hw, , , hd] = rows;
  ok(hc.P.diff === 0 && hc.P.styleB.style === 1, 'always commit = heuristic: goal diff 0, style 1');
  ok(hd.P.diff < -2 * hd.P.se, 'always disengage: goal clearly worse (beyond 2 SE)');
  ok(hw.parts.idle <= 2 * hc.parts.idle && hw.P.mB.noContact > hc.P.mB.noContact + .1, `always wait: idle penalty at least 2× the heuristic's (${hc.parts.idle.toFixed(3)} -> ${hw.parts.idle.toFixed(3)} per fight)`);
  ok(hw.P.styleB.style < T.DEFAULTS.styleThr, `always wait: style ${hw.P.styleB.style.toFixed(2)} below the ${T.DEFAULTS.styleThr} threshold`);
  const Pab = RW.paired(rz, arms[1], ref), Pba = RW.paired(arms[1], rz, ref);
  ok(Pab.styleA.style === Pba.styleB.style && Pab.styleB.style === Pba.styleA.style && Pab.diff === -Pba.diff, 'style and goal symmetric when the arms of a paired comparison are swapped');
  const strip2 = a => a.map(r => Object.assign({}, r, {intents: null}));
  ok(JSON.stringify(RW.metrics(strip2(rn))) === JSON.stringify(RW.metrics(strip2(rz))), 'telemetry and metrics identical for no-policy and zero-weight arms (style computed the same way per fight)');
  // variance and sample size (the calibration phase does the same on its own pool and sets N from it)
  const st = T.init({cfg: {calibFights: fights.length}}); st.ref = ref;
  const pert = await WK.runShard(jobsOf([0, 1, 2, 3].map(k => T.weightsOf(st, st.theta.map((v, i) => v + .2 * T.noise(st, -1, 99)[k][i]))), fights), 0, 1, 4);
  const pa = byCand(pert, 4, fights.length);
  const gz = rz.map(RW.goal);
  console.log(`  heuristic goal per fight ${RW.mean(gz).toFixed(3)} (sd ${RW.sd(gz).toFixed(3)}); components:`);
  for (const k of Object.keys(RW.goalParts(rz[0]))){ const a = rz.map(r => RW.goalParts(r)[k]); console.log(`    ${k.padEnd(8)} mean ${RW.mean(a).toFixed(3)} sd ${RW.sd(a).toFixed(3)}`); }
  const dd = pa.map(p => p.map((r, i) => RW.goal(r) - gz[i]));
  const sdPair = Math.sqrt(RW.mean(dd.map(d => RW.sd(d) ** 2)));
  console.log(`  σ = .2 perturbations vs heuristic: ${dd.map(d => `${RW.mean(d).toFixed(3)}±${RW.se(d).toFixed(3)}`).join(', ')}; paired per-fight sd ${sdPair.toFixed(3)}`);
  for (const eff of [.01, .02, .05, .1]) console.log(`    fights for a 2 SE detection of ${eff}: ${Math.ceil((2 * sdPair / eff) ** 2)}`);
  ok(sdPair < RW.sd(gz), 'pairing reduces per-fight noise (paired sd < unpaired sd)');

  console.log('\n3. Anti-overfitting (seed pools)');
  const o = {seed: 1, holdMap: 'forest'}, sets = {train: [0, 1, 2].map(i => R.fightSet('train', i, 40, o)), val: [0, 1].map(i => R.fightSet('val', i, 40, o)), test: [R.fightSet('test', 0, 40, o)], calib: [R.fightSet('calib', 0, 40, o)]};
  const key = f => f.seed, bkey = f => f.bseed + '|' + f.tr, all = {}, ball = {};
  let clash = 0, bclash = 0;
  for (const [p, ss] of Object.entries(sets)) ss.forEach((s, i) => s.forEach(f => { const k = key(f); if (all[k] && all[k] !== p + i) clash++; all[k] = p + i; const b = bkey(f); if (ball[b] && ball[b] !== p + i) bclash++; ball[b] = p + i; }));
  ok(clash === 0 && bclash === 0, 'train / val / test / calib pools (and each generation\'s / check\'s draw) share no fight seeds or boards');
  ok(![...sets.train, ...sets.val].flat().some(f => f.tr === 'forest') && sets.test[0].some(f => f.tr === 'forest'), 'held-out map (holdMap) never in train/val, present in test');
  ok(fights.every(f => f.board.some(id => !f.team.includes(id) && R.A.BY_ID[id].gait === 'orbit')), 'every fight has harriers on the other side');

  console.log('\n4. Reward-hacking checks');
  ok(rows.slice(1).every(r => r.P.driftB.length > 0), 'every fixed-intent probe gets telemetry drift flags: ' + rows.slice(1).map(r => `${r.name} ${r.P.driftB.length}`).join(', '));
  ok(hw.P.mB.noContact > hc.P.mB.noContact + .1, `circling without contact counts as idle (no-contact share ${(100 * hc.P.mB.noContact).toFixed(0)}% -> ${(100 * hw.P.mB.noContact).toFixed(0)}% for always-wait)`);
  ok(RW.drift(RW.metrics(rz), ref, rz.length).length === 0, 'the heuristic itself is not flagged');

  console.log('\n5. Engineering');
  const sv = JSON.parse(fs.readFileSync(fA, 'utf8'));
  ok(sv.version === 1 && sv.simHash === R.simHash() && sv.harnessHash === R.harnessHash() && sv.config.seed === 1, 'state records version, sim.js hash, harness hash, seed and config');
  const fx = path.join(tmp, 'stale.json'); T.save(fx, Object.assign({}, sv, {simHash: 'deadbeef'}));
  let threw = false; try { T.load(fx); } catch (e) { threw = /engine changed/.test(e.message); } ok(threw, 'a state from a different sim.js is refused');
  T.save(fx, Object.assign({}, sv, {version: 99})); threw = false; try { T.load(fx); } catch (e) { threw = true; } ok(threw, 'an unknown state version is refused');
  const jx = JSON.parse(fs.readFileSync(path.join(tmp, 'B_jobs_0.json'), 'utf8')); jx.simHash = 'deadbeef'; threw = false; try { WK.checkJobs(jx); } catch (e) { threw = true; } ok(threw, 'a worker refuses jobs built for a different engine');
  ok(jx.seed === 1 && jx.config && jx.sets[0].fights.every(f => f.seed && f.bseed), 'jobs record seed, config and every fight\'s board/fight seed');
  const fdry = path.join(tmp, 'dry.json'), t2 = Date.now();
  execFileSync(node, [path.join(here, 'train.js'), 'init', fdry, '--dry-run']); execFileSync(node, [path.join(here, 'train.js'), 'run', fdry]);
  const dt = (Date.now() - t2) / 1000; ok(T.load(fdry).phase === 'done' && dt < 60, `dry run (init + calib + 1 gen + val + test) finished in ${dt.toFixed(1)} s`);
  ok(fs.readFileSync(fdry + '.log', 'utf8').includes('[gen 0]'), 'per-generation log line written');

  console.log(`\n${pass} passed, ${fail} failed (${((Date.now() - t00) / 1000).toFixed(0)} s)`);
  fs.rmSync(tmp, {recursive: true, force: true});
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
