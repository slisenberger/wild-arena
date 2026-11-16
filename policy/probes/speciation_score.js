// Speciation score for one class (owner, Nov 3: "Strong with speciation good"): how differently the class's species choose
// their targets, live set vs a candidate net, on the same fresh fights. Per decision (2+ options, cfg.pickLog) the chosen
// target is described by 4 numbers: onto you, log mass ratio (target / self), distance (m / 10), target is a predator. Each
// species' profile = the mean over its decisions; the score = mean pairwise distance between species profiles (each feature
// divided by its pooled SD). Bootstrap over fights (200 reps) gives the SE of each arm's score and of the paired difference.
//   node policy/probes/speciation_score.js --arch=harrier --net=policy/weights/harrier_target_e2.json [--N=600 --index=71 --min=150 --out=f]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), os = require('os'), fs = require('fs');
const R = require(path.join(__dirname, '..', 'move_run.js'));
require(path.join(__dirname, '..', 'live.js')); require(path.join(__dirname, '..', 'policy.js'));
const A = R.A, I = A._internals;
const OPT = isMainThread ? Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v]; })) : workerData.opt;
if (!isMainThread){
  const NET = (({meta, ...x}) => x)(JSON.parse(fs.readFileSync(path.resolve(OPT.net), 'utf8')));
  const out = [];
  for (const f of workerData.fights) for (const arm of ['live', 'net']){
    const by = {}; for (const [k, v] of Object.entries(I.LIVE_TARGET || {})) if (v) by[k] = v; if (arm === 'net') by[OPT.arch] = NET;
    else if (!by[OPT.arch]) by[OPT.arch] = {kind: 'target-lin', v: 1, nin: 200, margin: .25, wt: new Array(200).fill(0)}; // no live net: today's targets through the hook (identical play), so its picks are logged
    const cfg = Object.assign(R.cfgOf(f), {livePolicy: true, policy: {byArch: by}, pickLog: []}); delete cfg.movePolicy;
    const w = A.setup(cfg), H = w.human; while (!w.over) A.step(w);
    const rows = [];
    for (const d of cfg.pickLog){ const u = d.u, t = d.a; if (!t || I.archetypeOf(u) !== OPT.arch || u.side !== 'E') continue;
      rows.push([u.s.id, +(t === H), Math.log(t.s.mass / u.s.mass), I.dist(u, t) / 10, +!!t.s.pred]); }
    out.push({i: f.i, arm, rows}); }
  parentPort.postMessage(out); return;
}
const N = +OPT.N || 600, MIN = +OPT.min || 150, T = +OPT.threads || Math.max(1, Math.min(16, os.cpus().length));
const fights = R.fightSet('probe', +OPT.index || 71, N, {arch: OPT.arch, seed: 19, withLive: true});
Promise.all([...Array(T).keys()].map(k => new Promise((res, rej) => { const w = new Worker(__filename, {workerData: {opt: OPT, fights: fights.filter((_, q) => q % T === k)}}); w.on('message', res); w.on('error', rej); }))).then(parts => {
  const per = {live: [], net: []}; for (const x of parts.flat()) per[x.arm][x.i] = x.rows; // rows per fight
  const score = (arm, idx) => { // idx: the fights (with repeats) to use
    const acc = {}; for (const i of idx) for (const r of per[arm][i] || []){ const a = acc[r[0]] = acc[r[0]] || {n: 0, s: [0, 0, 0, 0], q: [0, 0, 0, 0]}; a.n++; for (let k = 0; k < 4; k++){ a.s[k] += r[k + 1]; a.q[k] += r[k + 1] ** 2; } }
    const sp = Object.entries(acc).filter(([, a]) => a.n >= MIN); if (sp.length < 2) return {score: NaN, n: sp.length, prof: {}};
    let tn = 0; const ts = [0, 0, 0, 0], tq = [0, 0, 0, 0]; for (const [, a] of sp){ tn += a.n; for (let k = 0; k < 4; k++){ ts[k] += a.s[k]; tq[k] += a.q[k]; } }
    const sd = ts.map((s, k) => Math.sqrt(Math.max(1e-9, tq[k] / tn - (s / tn) ** 2)));
    const prof = Object.fromEntries(sp.map(([id, a]) => [id, a.s.map((s, k) => s / a.n / sd[k])]));
    const ids = Object.keys(prof); let d = 0, m = 0;
    for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++){ d += Math.hypot(...prof[ids[x]].map((v, k) => v - prof[ids[y]][k])); m++; }
    return {score: d / m, n: ids.length, prof: Object.fromEntries(Object.entries(acc).filter(([, a]) => a.n >= MIN).map(([id, a]) => [id, {n: a.n, onYou: a.s[0] / a.n, logMass: a.s[1] / a.n, dist10: a.s[2] / a.n, pred: a.s[3] / a.n}]))};
  };
  const all = fights.map(f => f.i), L = score('live', all), Nt = score('net', all);
  let s = 12345; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const bl = [], bn = [], bd = []; for (let b = 0; b < 200; b++){ const idx = all.map(() => all[Math.floor(rnd() * all.length)]); const l = score('live', idx).score, n = score('net', idx).score; bl.push(l); bn.push(n); bd.push(n - l); }
  const sd = a => { a = a.filter(Number.isFinite); const m = a.reduce((p, q) => p + q, 0) / a.length; return Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / (a.length - 1)); };
  const lines = [`speciation score, ${OPT.arch}: ${N} fresh fights (probe ${+OPT.index || 71}), species with ≥ ${MIN} decisions; live vs ${OPT.net}`,
    `  live ${L.score.toFixed(3)} ± ${sd(bl).toFixed(3)} (${L.n} species) | net ${Nt.score.toFixed(3)} ± ${sd(bn).toFixed(3)} (${Nt.n} species) | net - live ${(Nt.score - L.score) >= 0 ? '+' : ''}${(Nt.score - L.score).toFixed(3)} ± ${sd(bd).toFixed(3)}`];
  for (const [arm, X] of [['live', L], ['net', Nt]]) for (const [id, p] of Object.entries(X.prof)) lines.push(`  ${arm.padEnd(4)} ${id.padEnd(14)} n ${String(p.n).padStart(6)} | onto you ${(100 * p.onYou).toFixed(1)}%, log mass ${p.logMass.toFixed(2)}, dist ${(10 * p.dist10).toFixed(1)} m, predator ${(100 * p.pred).toFixed(1)}%`);
  console.log(lines.join('\n')); if (OPT.out) fs.writeFileSync(OPT.out, lines.join('\n') + '\n');
});
