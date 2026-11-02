// Ship check for an expert-iteration student that may change targets AND movement intents (expert_iter.js --intents):
// paired fresh fights, every live policy on; base = the live set; student = its target net (best.theta) + its 'move-adv'
// intent correction over the live movement net (best.thetaI, best.kappaI). Reports the class goal ± SE, style / gates /
// drift, your survival and time alive.   node policy/probes/eval_student.js <state.json> [N=2000] [probeIndex=23] [--out=f]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), os = require('os'), fs = require('fs');
const R = require(path.join(__dirname, '..', 'move_run.js')), RW = require(path.join(__dirname, '..', 'move_reward.js'));
const LIVE = require(path.join(__dirname, '..', 'live.js')); require(path.join(__dirname, '..', 'policy.js'));
if (!isMainThread){ parentPort.postMessage(workerData.jobs.map(j => ({k: j.k, i: j.i, rec: R.runFight(j.f, j.W, workerData.arch)}))); return; }
const a = process.argv.slice(2), pos = a.filter(x => !x.startsWith('--')), opt = Object.fromEntries(a.filter(x => x.startsWith('--')).map(x => { const [k, v] = x.slice(2).split('='); return [k, v]; }));
const s = JSON.parse(fs.readFileSync(path.resolve(pos[0]), 'utf8')), c = s.config, arch = c.arch, N = +pos[1] || 2000, idx = +pos[2] || 23, T = +opt.threads || Math.max(1, Math.min(16, os.cpus().length));
const b = s.best, base = LIVE[arch];
const W = Object.assign({}, s.P0, {theta: b.theta, targetsOnly: true, margin: Math.max(b.margin != null ? b.margin : s.P0.margin, .001)},
  b.thetaI && base ? {moveOverride: {kind: 'move-adv', v: 1, only: arch === 'guard' ? c.only || null : null, set: base.set, base, nin: base.nin, nout: base.nout, kappa: b.kappaI, D: b.thetaI}} : {});
const LT = R.A._internals.LIVE_TARGET[arch] || null; // base arm: the live target net for this class (if any) and live movement
const fights = R.fightSet('probe', idx, N, {arch, seed: 91, withLive: true, goal: c.goal, spec: c.spec, withCat: arch === 'guard' && c.only === 'cat'}), jobs = [];
fights.forEach((f, i) => { jobs.push({k: 'live', i, f, W: LT}, {k: 'student', i, f, W}); });
Promise.all([...Array(T).keys()].map(k => new Promise(res => { const w = new Worker(__filename, {workerData: {arch, jobs: jobs.filter((_, q) => q % T === k)}}); w.on('message', res); }))).then(p => {
  const A = {}; p.flat().forEach(o => { (A[o.k] = A[o.k] || [])[o.i] = o.rec; });
  const q = RW.paired(A.live, A.student, RW.reference(A.live)), m = RW.mean, alive = r => r.survived ? 300 : Math.min(300, r.t);
  const ds = A.student.map((r, i) => r.survived - A.live[i].survived), dt = A.student.map((r, i) => alive(r) - alive(A.live[i]));
  const out = `${pos[0]} (${arch}${c.only ? ', only ' + c.only : ''}; ${b.from}${b.thetaI ? ', with intents' : ''}) vs the live set, ${N} fresh fights (probe ${idx}): goal ${q.diff >= 0 ? '+' : ''}${q.diff.toFixed(3)} ± ${q.se.toFixed(3)}${Math.abs(q.diff) > 2 * q.se ? ' (beyond 2 SE)' : ' (within 2 SE)'} | style ${q.styleB.style.toFixed(3)} gates [${q.styleB.failed}] drift [${q.driftB.join('; ')}] | you survive ${(100 * m(ds)).toFixed(1)} ± ${(100 * RW.se(ds)).toFixed(1)} pts, alive ${m(dt) >= 0 ? '+' : ''}${m(dt).toFixed(1)} s`;
  console.log(out); if (opt.out) fs.writeFileSync(opt.out, out + '\n');
});
