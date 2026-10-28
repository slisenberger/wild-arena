// Milestone 4 headroom test: how much better could enemy cats do with better target choices? At every enemy cat decision
// with 2+ targets, copy the fight (policy/lookahead.js), try each option (the heuristic's pick + up to 3 others, nearest
// first) for H seconds with that cat holding the tried target and everyone else as usual, and take the option whose branch
// went best for the other side (your HP lost x2, your side's HP lost, minus their own HP lost, as shares of max HP). The
// branches share the fight's random stream, so this is an optimistic oracle: an upper bound on target choice's worth
// (FAIR=1: each branch gets its own random stream, so the lookahead can't know the fight's future dice).
// Paired vs today's cats on the same fresh fights. COLLECT=file.jsonl also writes each branched decision (expert iteration
// data for policy/bc_target.js). Usage: node policy/probes/cat_lookahead.js [N] [H seconds] [probeIndex]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), os = require('os');
const FP = require(path.join(__dirname, '..', 'features_plus.js')), TR = require(path.join(__dirname, '..', 'traits.js')), fs = require('fs');
const R = require(path.join(__dirname, '..', 'move_run.js')), RW = require(path.join(__dirname, '..', 'move_reward.js')), L = require(path.join(__dirname, '..', 'lookahead.js'));
require(path.join(__dirname, '..', 'live.js'));
const A = R.A;
function lookPolicy(H){
  const score = w => { let pl = 0, pm = 0, el = 0, em = 0; for (const u of w.units){ const lost = u.maxhp - Math.max(0, u.state === 'dead' ? 0 : u.hp);
      if (u.side === 'E'){ el += lost; em += u.maxhp; } else { pl += lost; pm += u.maxhp; } }
    const H0 = w.human; return 2 * (H0.maxhp - Math.max(0, H0.state === 'dead' ? 0 : H0.hp)) / H0.maxhp + pl / pm - el / em + (H0.state === 'dead' ? 2 : 0); };
  const P = {kind: 'target-look', n: 0, branched: 0, changed: 0, data: process.env.COLLECT ? [] : null}; // COLLECT: keep each branched decision's options (features_plus rows) and branch scores
  P.pick = (w, u, opts, teach) => {
    P.n++;
    const tg = opts.map((o, i) => i).filter(i => opts[i].kind === 'target');
    if (tg.length < 2) return teach;
    const others = tg.filter(i => i !== teach).sort((i, j) => A._internals.dist(u, opts[i].t) - A._internals.dist(u, opts[j].t)).slice(0, 3);
    const tries = (teach >= 0 ? [teach] : []).concat(others), ui = w.units.indexOf(u);
    let best = teach, bs = -1e9, sc = []; P.branched++;
    for (const i of tries){
      const c = L.cloneWorld(w, {policy: {byArch: {cat: {teacher: true}}}}), cu = c.units[ui];
      if (process.env.FAIR) c.R.seek((w.R.state() ^ Math.imul(P.n * 97 + i + 1, 0x9e3779b9)) >>> 0); // FAIR=1: each branch rolls its own dice (no knowledge of the fight's future)
      if (opts[i].kind === 'target'){ cu.forceT = c.units[w.units.indexOf(opts[i].t)]; cu.forceUntil = c.t + H; cu.target = cu.forceT; cu.state = 'engage'; cu.carcass = null; }
      const t1 = c.t + H; while (!c.over && c.t < t1) A.step(c);
      const v = score(c); sc.push(v); if (v > bs + 1e-9){ bs = v; best = i; }
    }
    if (best !== teach) P.changed++;
    if (P.data){ const X = FP.extract(w, u).X, r4 = x => Math.round(x * 1e4) / 1e4; // same option order as opts (features_plus extends features.js)
      P.data.push({sp: u.s.id, tr: TR.traits(u.s), X: tries.map(i => X[i].map(r4)), s: sc.map(r4), teach: tries.indexOf(teach)}); }
    return best;
  };
  return P;
}
if (!isMainThread){
  const out = workerData.jobs.map(j => { const W = j.k === 'look' ? lookPolicy(workerData.H) : {kind: 'target-lin', v: 1, nin: 1, margin: .25, wt: new Array(80).fill(0)};
    const r = R.runFight(j.f, W, 'cat'); if (j.k === 'look'){ r.look = {n: W.n, branched: W.branched, changed: W.changed}; if (W.data) fs.appendFileSync(process.env.COLLECT, W.data.map(d => JSON.stringify(d)).join('\n') + (W.data.length ? '\n' : '')); } return {k: j.k, i: j.i, rec: r}; });
  parentPort.postMessage(out); return;
}
const [n, h, idx] = process.argv.slice(2), N = +n || 120, H = +h || 15;
const fights = R.fightSet('probe', +idx || 71, N, {arch: 'cat', seed: 17, withLive: true, goal: 'checkmate', spec: true}), jobs = [];
fights.forEach((f, i) => { jobs.push({k: 'base', i, f}, {k: 'look', i, f}); });
const T = Math.max(1, Math.min(8, os.cpus().length)), t0 = Date.now();
Promise.all([...Array(T).keys()].map(k => new Promise(res => { const w = new Worker(__filename, {workerData: {H, jobs: jobs.filter((_, q) => q % T === k)}}); w.on('message', res); }))).then(p => {
  const D = {}; p.flat().forEach(o => { (D[o.k] = D[o.k] || [])[o.i] = o.rec; });
  const q = RW.paired(D.base, D.look, RW.reference(D.base)), m = RW.mean, alive = r => r.survived ? 300 : Math.min(300, r.t);
  const lk = D.look.reduce((a, r) => ({n: a.n + r.look.n, b: a.b + r.look.branched, c: a.c + r.look.changed}), {n: 0, b: 0, c: 0});
  console.log(`enemy cats, lookahead ${H} s${process.env.FAIR ? ' (fair: own dice per branch)' : ''} vs today, ${N} fresh fights (probe ${+idx || 71}), ${((Date.now() - t0) / 1000).toFixed(0)} s:`);
  console.log(`  goal ${q.diff >= 0 ? '+' : ''}${q.diff.toFixed(3)} ± ${q.se.toFixed(3)} | style ${q.styleB.style.toFixed(2)} [${q.styleB.failed}] | your survival ${(100 * m(D.base.map(r => r.survived))).toFixed(1)}% -> ${(100 * m(D.look.map(r => r.survived))).toFixed(1)}%, time alive ${(m(D.look.map(alive)) - m(D.base.map(alive))).toFixed(1)} s | cat deaths/fight ${m(D.base.map(r => r.deaths)).toFixed(2)} -> ${m(D.look.map(r => r.deaths)).toFixed(2)}`);
  console.log(`  drift [${q.driftB.join("; ")}]`);
  console.log(`  decisions ${lk.n}, with 2+ targets ${lk.b}, lookahead changed the pick ${lk.c} (${(100 * lk.c / Math.max(1, lk.b)).toFixed(0)}%)`);
});
