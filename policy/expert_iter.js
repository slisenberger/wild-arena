// Milestone 4 expert iteration for target choice (enemy cats; or --arch=guard: your guards, by default only your big cats): the lookahead (policy/plan.js) is a training-only teacher, the
// shipped result is a network that needs no in-game search (owner, Oct 28: nothing may need in-game loading).
// Each round: (1) collect: play fresh fights where every enemy cat decision with 2+ targets is labelled by the fair lookahead
// (each option's branch score, averaged over `rolls` own-dice rolls); round 0 plays the lookahead's picks, later rounds play
// the current network's (DAgger, so it learns on the states it reaches itself); (2) train the target-mlp on all data so far
// (policy/bc_target.js, continuing from the last network); (3) validate the greedy network vs today's ${c.arch} on fresh fights with
// the realism gates (move_reward.js); the best clean one is kept. Then a held-out test. Data: <state>.data.jsonl.gz.
//   node policy/expert_iter.js init <state.json> [--arch=cat --rounds=6 --fights=600 --rolls=3 --H=8 --max=3 --real=0 --nh=32 --epochs=20
//        --lr=.002 --val=800 --test=1200 --seed=1 --styleThr=.9 --dagger=true]
//   node policy/expert_iter.js run <state.json> [--threads=N --hours=H]
//   node policy/expert_iter.js report <state.json>
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib');
const R = require('./move_run.js'), RW = require('./move_reward.js'), PL = require('./plan.js'), BC = require('./bc_target.js');
require('./live.js'); require('./policy.js');
const ZW = {kind: 'target-lin', v: 1, nin: 200, margin: .25, wt: new Array(200).fill(0)}; // zero scorer: today's targets
if (!isMainThread){
  const {jobs, arch, o, learner} = workerData, out = [];
  for (const j of jobs){
    if (j.k === 'collect'){ const g = arch === 'guard', data = [], W = PL.makePlanner({H: o.H, max: o.max, cool: 0, rolls: o.rolls, data, learner, real: o.real, feat: o.feat === 'rich' || o.feat === 'richh' ? o.feat : null, set: o.model === 'set', arch, side: g ? 'P' : 'E', only: g ? o.only : null, wide: g && o.wide}); R.runFight(j.f, W, arch); out.push({k: j.k, i: j.i, data}); }
    else out.push({k: j.k, i: j.i, rec: R.runFight(j.f, j.k === 'base' ? Object.assign({}, ZW, arch === 'guard' ? {only: o.only} : {}) : j.W, arch)});
  }
  parentPort.postMessage(out); return;
}
const CMDS = ['init', 'run', 'report'], av = process.argv.slice(2), cmd = CMDS.includes(av[0]) ? av.shift() : 'run', [file, ...rest] = av;
const opt = Object.fromEntries(rest.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v === undefined ? true : isNaN(+v) ? (v === 'true' ? true : v === 'false' ? false : v) : +v]; }));
const DEF = {arch: 'cat', only: 'cat', wide: true, loss: 'ce', model: 'mlp', K: 16, rounds: 6, fights: 600, rolls: 3, H: 8, max: 3, real: 0, nh: 32, epochs: 20, lr: .002, val: 800, test: 1200, seed: 1, styleThr: .9, dagger: true, threads: Math.min(8, os.cpus().length)};
const DATA = file + '.data.jsonl.gz';
const log = m => { console.log(m); fs.appendFileSync(file + '.log', m + '\n'); };
const save = s => { fs.writeFileSync(file + '.tmp', JSON.stringify(s)); fs.renameSync(file + '.tmp', file); };
// the data outgrows one JS string (~0.5 GB) on long runs: write gzip members of 20k lines each (gunzip reads them as one stream)
// and parse the unzipped buffer line by line
const readData = () => { if (!fs.existsSync(DATA)) return []; const B = zlib.gunzipSync(fs.readFileSync(DATA)), out = [];
  for (let i = 0; i < B.length;){ let j = B.indexOf(10, i); if (j < 0) j = B.length; if (j > i) out.push(JSON.parse(B.toString('utf8', i, j))); i = j + 1; } return out; };
const writeData = D => { const fd = fs.openSync(DATA + '.tmp', 'w');
  for (let i = 0; i < D.length; i += 20000) fs.writeSync(fd, zlib.gzipSync(D.slice(i, i + 20000).map(d => JSON.stringify(d)).join('\n') + '\n'));
  fs.closeSync(fd); fs.renameSync(DATA + '.tmp', DATA); };
let s = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
if (cmd === 'report'){ if (!s) process.exit(1); const b = s.best, t = s.test;
  console.log(`[round ${s.round}/${s.config.rounds} ${s.phase}] best ${b.from}${b.val != null ? ` val ${b.val >= 0 ? '+' : ''}${(+b.val).toFixed(3)}` : ''} | ${s.config.arch} expert iteration, ${s.dataN || 0} decisions`);
  if (t) console.log(`test: ${t.diff.toFixed(3)} ± ${t.se.toFixed(3)} (${Math.abs(t.diff) > 2 * t.se ? 'beyond' : 'within'} noise), style ${t.style.toFixed(3)}`);
  process.exit(0); }
if (cmd === 'init'){
  if (s) throw new Error(file + ' exists');
  const c = Object.assign({}, DEF, opt, {trainer: 'expert', target: true, mode: 'linear', withLive: true}); const g = c.arch === 'guard';
  const rf = opt.feat === 'rich' || opt.feat === 'richh' ? opt.feat : null;
  Object.assign(c, g ? {feat: rf, goal: null, spec: false} : {feat: rf || 'plus', goal: 'checkmate', spec: true, only: null, wide: false}); // --feat=rich: + features_rich.js // your guards (arch guard): guard_features, the guard goal, only / wide; enemy cats: features_plus, checkmate
  const FRm = require('./features_rich.js'), FX = c.feat === 'richh' ? {DIM: g ? FRm.DIM_GH : FRm.DIM_EH, NAMES: g ? FRm.NAMES_GH : FRm.NAMES_EH} : c.feat === 'rich' ? {DIM: g ? FRm.DIM_G : FRm.DIM_E, NAMES: g ? FRm.NAMES_G : FRm.NAMES_E} : g ? require('./guard_features.js') : require('./features_plus.js');
  if (c.model === 'set') c.loss = 'adv'; // the state encoder trains by gain regression
  const P0 = Object.assign({}, c.model === 'set' ? require('./set_model.js').make(FX.DIM + require('./traits.js').DIM, c.K, c.nh, .25, c.seed * 31 + 7) : require('./target_model.js').mlp(FX.DIM + require('./traits.js').DIM, c.nh, .25, c.seed * 31 + 7, true), g ? {only: c.only, wide: !!c.wide} : {}, c.feat ? {feat: c.feat} : {});
  s = {format: 'wild-arena/expert-iter', simHash: R.simHash(), harnessHash: R.harnessHash(), config: c, features: FX.NAMES,
    P0, theta: P0.theta.slice(), round: 0, phase: 'collect', dataN: 0, best: {theta: P0.theta.slice(), round: -1, val: 0, from: 'init (= today\'s cats)'}, history: [], test: null};
  save(s); log(`[init] ${file}: ${JSON.stringify(c)}`); process.exit(0);
}
if (!s) throw new Error('no state ' + file + ' (run init first)');
if (s.simHash !== R.simHash() && !process.env.ALLOW_ENGINE_MISMATCH) throw new Error(`${file} was made with sim ${s.simHash}; this checkout has ${R.simHash()}`);
const c = s.config, T = +opt.threads || c.threads, HOURS = +opt.hours || 0, T0 = Date.now(), fo = {arch: c.arch, seed: c.seed, withLive: true, goal: c.goal, spec: c.spec, withCat: c.arch === 'guard' && c.only === 'cat'};
const W = theta => Object.assign({}, s.P0, {theta: theta.slice(), targetsOnly: true}, s.margin != null ? {margin: s.margin} : {}); // --loss=adv: the learned switching threshold // the net only re-ranks targets (its labels only compare targets)
function pool(jobs, extra){
  return Promise.all([...Array(T).keys()].map(k => new Promise((res, rej) => { const w = new Worker(__filename, {workerData: Object.assign({jobs: jobs.filter((_, q) => q % T === k), arch: c.arch, o: c}, extra || {})}); w.on('message', res); w.on('error', rej); }))).then(p => p.flat());
}
async function evalW(theta, poolName, idx, n){
  const fights = R.fightSet(poolName, idx, n, fo), jobs = []; fights.forEach((f, i) => { jobs.push({k: 'base', i, f}, {k: 'net', i, f, W: W(theta)}); });
  const A = {}; (await pool(jobs)).forEach(x => { (A[x.k] = A[x.k] || [])[x.i] = x.rec; });
  const q = RW.paired(A.base, A.net, RW.reference(A.base)), m = RW.mean;
  return {diff: q.diff, se: q.se, style: q.styleB.style, gates: q.styleB.failed, drift: q.driftB, surv: m(A.net.map(r => r.survived)) - m(A.base.map(r => r.survived)), n};
}
const timeUp = () => HOURS && Date.now() - T0 > HOURS * 3600e3;
(async () => {
  while (s.round < c.rounds){
    if (timeUp()){ log(`[time] ${HOURS} h used in round ${s.round} (${s.phase}); resume to continue`); return; }
    const r = s.round;
    if (s.phase === 'collect'){
      const t0 = Date.now(), fights = R.fightSet('train', r, c.fights, fo), learner = r > 0 && c.dagger ? W(s.theta) : null;
      const recs = (await pool(fights.map((f, i) => ({k: 'collect', i, f})), {learner})).flatMap(x => x.data);
      const D = readData().concat(recs); writeData(D); s.dataN = D.length; s.phase = 'train'; save(s);
      log(`[round ${r} collect] ${recs.length} decisions from ${fights.length} fights (${learner ? 'the network plays' : 'the lookahead plays'}), ${D.length} total, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    if (s.phase === 'train'){
      const t0 = Date.now(), res = (c.model === 'set' ? BC.trainAdvSet : c.loss === 'adv' ? BC.trainAdv : BC.train)(readData(), {K: c.K, nh: c.nh, epochs: c.epochs, lr: c.lr, seed: c.seed + r, feat: c.feat, only: c.arch === 'guard' ? c.only : null, wide: c.arch === 'guard' && c.wide}, m => { if (/decisions|\[ep (0|9|19|29)\]/.test(m)) log('  ' + m); }, r > 0 ? {theta: s.theta} : null);
      s.theta = res.P.theta; if (c.loss === 'adv') s.margin = res.P.margin; s.phase = 'val'; save(s);
      log(c.loss === 'adv' ? `[round ${r} train] held-out gain ${res.best.gain.toFixed(4)} of ${res.oracle.toFixed(4)}, threshold ${res.P.margin}, ${((Date.now() - t0) / 1000).toFixed(0)} s` : `[round ${r} train] held-out regret ${res.best.regret.toFixed(4)} (heuristic ${res.base.regret.toFixed(4)}), ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    if (s.phase === 'val'){
      const v = await evalW(s.theta, 'val', r, c.val), ok = !v.gates.length && v.style >= c.styleThr, better = ok && v.diff > (s.best.val || 0); // must beat today's cats (val 0) and every earlier clean round
      s.history.push(Object.assign({round: r, dataN: s.dataN}, v));
      if (better) s.best = {theta: s.theta.slice(), round: r, val: v.diff, from: `round ${r}`, margin: s.margin};
      log(`[round ${r} val] network vs today's ${c.arch} on ${v.n} fresh fights: ${v.diff >= 0 ? '+' : ''}${v.diff.toFixed(3)} ± ${v.se.toFixed(3)} | style ${v.style.toFixed(3)} gates [${v.gates}] drift [${v.drift.join('; ')}] | your survival ${(100 * v.surv).toFixed(1)} pts${better ? '  -> new best' : ok ? '' : '  (not clean)'}`);
      s.round++; s.phase = 'collect'; save(s);
    }
  }
  if (!s.test){
    s.margin = s.best.margin != null ? s.best.margin : s.P0.margin; const t = await evalW(s.best.theta, 'test', 0, c.test); // the init (today's game) keeps its own margin s.test = t; s.phase = 'done'; save(s);
    log(`[test] best (${s.best.from}) vs today's ${c.arch} on ${t.n} held-out fights: ${t.diff >= 0 ? '+' : ''}${t.diff.toFixed(3)} ± ${t.se.toFixed(3)} (${Math.abs(t.diff) > 2 * t.se ? 'beyond' : 'within'} 2 SE) | style ${t.style.toFixed(3)} gates [${t.gates}] drift [${t.drift.join('; ')}] | your survival ${(100 * t.surv).toFixed(1)} pts`);
  }
})().catch(e => { console.error(e); process.exit(1); });
