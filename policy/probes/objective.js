// Prototype check for cfg.objective (owner, Oct 31: "all animals on attack should at least participate in the objective of
// killing the human"): paired fresh fights where the other side has the given class, every live policy on, off vs on. Reports
// the class goal (checkmate + spec) ± SE, your survival and time alive, how fights end (quiet / cleared / time), the longest
// no-damage stretch, and per species: time targeting you, time within 6 m of you, hits (on you), distance kept while engaged.
//   node policy/probes/objective.js <arch: bulldozer|kicker|charger> [N=1200] [probeIndex=23] [--obj=JSON] [--out=f]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), os = require('os'), fs = require('fs');
const R = require(path.join(__dirname, '..', 'move_run.js')), RW = require(path.join(__dirname, '..', 'move_reward.js'));
require(path.join(__dirname, '..', 'live.js')); require(path.join(__dirname, '..', 'policy.js'));
if (!isMainThread){ parentPort.postMessage(workerData.jobs.map(j => ({k: j.k, i: j.i, rec: R.runFight(j.f, null, workerData.arch)}))); return; }
const a = process.argv.slice(2), pos = a.filter(x => !x.startsWith('--')), opt = Object.fromEntries(a.filter(x => x.startsWith('--')).map(x => { const [k, v] = x.slice(2).split('='); return [k, v]; }));
const ARCH = pos[0] || 'kicker', N = +pos[1] || 1200, idx = +pos[2] || 23, OBJ = opt.obj ? JSON.parse(opt.obj) : true, T = +opt.threads || Math.max(1, Math.min(16, os.cpus().length));
const fights = R.fightSet('probe', idx, N, {arch: ARCH, seed: 93, withLive: true, goal: 'checkmate', spec: true}), jobs = [];
fights.forEach((f, i) => { jobs.push({k: 'off', i, f}, {k: 'on', i, f: Object.assign({}, f, {cfgX: {objective: OBJ}})}); });
Promise.all([...Array(T).keys()].map(k => new Promise(res => { const w = new Worker(__filename, {workerData: {arch: ARCH, jobs: jobs.filter((_, q) => q % T === k)}}); w.on('message', res); }))).then(p => {
  const A = {}; p.flat().forEach(o => { (A[o.k] = A[o.k] || [])[o.i] = o.rec; });
  const m = RW.mean, se = RW.se, alive = r => r.survived ? 300 : Math.min(300, r.t), L = [], say = l => { console.log(l); L.push(l); };
  const q = RW.paired(A.off, A.on, RW.reference(A.off)), ds = A.on.map((r, i) => r.survived - A.off[i].survived), dt = A.on.map((r, i) => alive(r) - alive(A.off[i]));
  say(`objective (${JSON.stringify(OBJ)}): ${N} fresh fights with an enemy ${ARCH} (probe ${idx}), maps default, live policies on; off -> on`);
  say(`  ${ARCH} goal ${q.diff >= 0 ? '+' : ''}${q.diff.toFixed(3)} ± ${q.se.toFixed(3)} | style ${q.styleB.style.toFixed(3)} gates [${q.styleB.failed}] drift [${q.driftB.join('; ')}]`);
  say(`  you survive ${(100 * m(A.off.map(r => r.survived))).toFixed(1)}% -> ${(100 * m(A.on.map(r => r.survived))).toFixed(1)}% (${(100 * m(ds)).toFixed(1)} ± ${(100 * se(ds)).toFixed(1)} pts), time alive ${m(dt) >= 0 ? '+' : ''}${m(dt).toFixed(1)} ± ${se(dt).toFixed(1)} s`);
  for (const k of ['off', 'on']){ const X = A[k], n = X.length, c = w => X.filter(r => r.why === w).length;
    const lq = X.map(r => r.longQuiet || 0).sort((x, y) => x - y);
    say(`  ${k.padEnd(3)} endings: quiet ${(100 * c('quiet') / n).toFixed(1)}%, cleared ${(100 * c('cleared') / n).toFixed(1)}%, time ${(100 * c('time') / n).toFixed(1)}%, you died ${(100 * X.filter(r => !r.survived).length / n).toFixed(1)}% | longest no-damage stretch: median ${lq[n >> 1].toFixed(0)} s, p90 ${lq[Math.floor(n * .9)].toFixed(0)} s`); }
  const ids = [...new Set(A.off.flatMap(r => Object.keys(r.sp || {})))];
  for (const id of ids){ const row = k => { let S = {life: 0, onHumanT: 0, nearHumanT: 0, engT: 0, distSum: 0, hits: 0, hitsHuman: 0, n: 0}; for (const r of A[k]) { const x = r.sp && r.sp[id]; if (!x) continue; S.n++; for (const f of Object.keys(S)) if (f !== 'n') S[f] += x[f]; } return S; };
    const o = row('off'), n = row('on'), f = S => `on you ${(100 * S.onHumanT / Math.max(1e-9, S.life)).toFixed(1)}% of life, within 6 m of you ${(100 * S.nearHumanT / Math.max(1e-9, S.life)).toFixed(1)}%, hits ${(S.hits / Math.max(1, S.n)).toFixed(1)}/fight (on you ${(S.hitsHuman / Math.max(1, S.n)).toFixed(2)}), distance kept ${(S.distSum / Math.max(1e-9, S.engT)).toFixed(1)} m`;
    say(`  ${id} (${o.n} fights): off ${f(o)}`); say(`  ${' '.repeat(id.length)}             on  ${f(n)}`); }
  if (opt.out) fs.writeFileSync(opt.out, L.join('\n') + '\n');
});
