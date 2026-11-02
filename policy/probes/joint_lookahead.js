// Research Stage 3 (research/speciation_strategy.md): is there headroom in choosing the movement intent together with the
// target? Paired fresh fights (main's default, every live policy on), three arms for one class: live; the fair lookahead
// choosing targets only (as plan.js trains on); the lookahead choosing the target and then the best movement intent for it,
// held 2 s. Reports each lookahead arm vs live (goal ± SE, style / gates, your survival) and joint vs target-only.
//   node policy/probes/joint_lookahead.js <cat|guard> [N=300] [probeIndex=61] [--H=8 --rolls=2 --only=cat] [--out=f]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), os = require('os'), fs = require('fs');
const R = require(path.join(__dirname, '..', 'move_run.js')), RW = require(path.join(__dirname, '..', 'move_reward.js')), PL = require(path.join(__dirname, '..', 'plan.js'));
require(path.join(__dirname, '..', 'live.js')); require(path.join(__dirname, '..', 'policy.js')); require(path.join(__dirname, '..', 'force_intent.js'));
const NOUT = {cat: 7, guard: 6};
if (!isMainThread){
  const {jobs, o} = workerData, g = o.arch === 'guard';
  parentPort.postMessage(jobs.map(j => { const W = j.k === 'live' ? null : PL.makePlanner({H: o.H, max: 3, cool: 2, rolls: o.rolls, arch: o.arch, side: g ? 'P' : 'E', only: g ? o.only : null, wide: g, crn: true, intents: j.k === 'joint' ? NOUT[o.arch] : 0});
    const rec = R.runFight(j.f, W, o.arch); if (W) rec.plan = {n: W.branched, changed: W.changed, ib: W.intentBranched || 0, ic: W.intentChanged || 0}; return {k: j.k, i: j.i, rec}; }));
  return;
}
const a = process.argv.slice(2), pos = a.filter(x => !x.startsWith('--')), opt = Object.fromEntries(a.filter(x => x.startsWith('--')).map(x => { const [k, v] = x.slice(2).split('='); return [k, isNaN(+v) ? v : +v]; }));
const o = {arch: pos[0] || 'cat', H: opt.H || 8, rolls: opt.rolls || 2, only: opt.only || (pos[0] === 'guard' ? 'cat' : null)}, N = +pos[1] || 300, idx = +pos[2] || 61, T = opt.threads || Math.max(1, Math.min(16, os.cpus().length));
const g = o.arch === 'guard', fights = R.fightSet('probe', idx, N, {arch: o.arch, seed: 97, withLive: true, goal: g ? null : 'checkmate', spec: !g, withCat: g && o.only === 'cat'}), jobs = [];
fights.forEach((f, i) => { for (const k of ['live', 'target', 'joint']) jobs.push({k, i, f}); });
const L = [], say = l => { console.log(l); L.push(l); };
Promise.all([...Array(T).keys()].map(k => new Promise((res, rej) => { const w = new Worker(__filename, {workerData: {o, jobs: jobs.filter((_, q) => q % T === k)}}); w.on('message', res); w.on('error', rej); }))).then(p => {
  const A = {}; p.flat().forEach(x => { (A[x.k] = A[x.k] || [])[x.i] = x.rec; });
  const m = RW.mean, ref = RW.reference(A.live), cmp = (b, c, name) => { const q = RW.paired(A[b], A[c], ref), ds = m(A[c].map(r => r.survived)) - m(A[b].map(r => r.survived));
    say(`  ${name.padEnd(22)} goal ${q.diff >= 0 ? '+' : ''}${q.diff.toFixed(3)} ± ${q.se.toFixed(3)}${Math.abs(q.diff) > 2 * q.se ? ' *' : '  '} | style ${q.styleB.style.toFixed(3)} gates [${q.styleB.failed}] | you survive ${ds >= 0 ? '+' : ''}${(100 * ds).toFixed(1)} pts`); };
  say(`joint lookahead (${o.arch}${o.only ? ', only ' + o.only : ''}): ${N} fresh fights (probe ${idx}), H ${o.H} s, ${o.rolls} CRN rolls, live policies on`);
  cmp('live', 'target', 'target-only vs live'); cmp('live', 'joint', 'target+intent vs live'); cmp('target', 'joint', 'joint vs target-only');
  const pl = A.joint.map(r => r.plan || {}); say(`  joint: decisions branched ${pl.reduce((s, x) => s + (x.n || 0), 0)}, target changed ${pl.reduce((s, x) => s + (x.changed || 0), 0)}, intent overridden ${pl.reduce((s, x) => s + (x.ic || 0), 0)} of ${pl.reduce((s, x) => s + (x.ib || 0), 0)}`);
  if (opt.out) fs.writeFileSync(opt.out, L.join('\n') + '\n');
});
