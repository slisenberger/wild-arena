// Milestone 4 speciation report: with the ?smart=1 networks (policy/smart.js), per deciding species, how often its pick differs
// from today's (the heuristic) and which way: toward you, toward a bigger / smaller animal (log mass ratio), a hurt one, a
// closer one, a predator. Decisions with 2+ options only. Stat-only cfg.pickLog (policy.js); the fights are the shipped game
// otherwise. Usage: node policy/probes/speciation.js [N] [probeIndex]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), os = require('os');
const R = require(path.join(__dirname, '..', 'move_run.js')), smart = require(path.join(__dirname, '..', 'smart.js'));
require(path.join(__dirname, '..', 'live.js'));
const A = R.A, I = A._internals;
if (!isMainThread){
  const out = {};
  for (const f of workerData.fights){
    const cfg = Object.assign(R.cfgOf(f), {livePolicy: true, policy: smart(), pickLog: []});
    delete cfg.movePolicy; const w = A.setup(cfg);
    while (!w.over) A.step(w);
    for (const d of cfg.pickLog){
      const u = d.u, side = u.side === 'E' ? 'enemy' : 'yours', k = side + ' ' + u.s.id + ' (' + I.archetypeOf(u) + ')';
      const o = out[k] = out[k] || {n: 0, dev: 0, toH: 0, fromH: 0, mass: 0, hp: 0, dist: 0, pred: 0, toNone: 0, fights: new Set()};
      o.n++; o.fights.add(f.i); if (d.a === d.h) continue; o.dev++;
      const H = w.human, a = d.a, h = d.h;
      if (a === H) o.toH++; if (h === H) o.fromH++;
      if (!a){ o.toNone++; continue; } if (!h) continue;
      o.mass += Math.log(a.s.mass / h.s.mass); o.hp += a.hp / a.maxhp - h.hp / h.maxhp; o.dist += I.dist(u, a) - I.dist(u, h); o.pred += (+!!a.s.pred) - (+!!h.s.pred);
    }
  }
  for (const o of Object.values(out)) o.fights = [...o.fights];
  parentPort.postMessage(out); return;
}
const [n, idx] = process.argv.slice(2), N = +n || 400;
const fights = R.fightSet('probe', +idx || 71, N, {arch: 'guard', seed: 17});
const T = Math.max(1, Math.min(8, os.cpus().length));
Promise.all([...Array(T).keys()].map(k => new Promise(res => { const w = new Worker(__filename, {workerData: {fights: fights.filter((_, q) => q % T === k)}}); w.on('message', res); }))).then(parts => {
  const all = {};
  for (const p of parts) for (const [k, o] of Object.entries(p)){ const t = all[k] = all[k] || {n: 0, dev: 0, toH: 0, fromH: 0, mass: 0, hp: 0, dist: 0, pred: 0, toNone: 0, fights: new Set()};
    for (const q of ['n', 'dev', 'toH', 'fromH', 'mass', 'hp', 'dist', 'pred', 'toNone']) t[q] += o[q]; o.fights.forEach(x => t.fights.add(x)); }
  console.log(`speciation: ${N} fights (probe ${+idx || 71}), ?smart=1 networks; per deciding species, decisions with 2+ options`);
  console.log('who'.padEnd(34) + 'fights  decisions  changed | of the changes: onto you, off you, log mass a/h, hp a-h, dist a-h (m), pred a-h');
  const rows = Object.entries(all).filter(([, o]) => o.fights.size >= 15).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [k, o] of rows){ const d = Math.max(1, o.dev), m = Math.max(1, o.dev - o.toNone);
    console.log(k.padEnd(34) + String(o.fights.size).padStart(6) + String(o.n).padStart(11) + `  ${(100 * o.dev / o.n).toFixed(1).padStart(5)}% | ${(100 * o.toH / d).toFixed(0).padStart(3)}% ${(100 * o.fromH / d).toFixed(0).padStart(3)}%  ${(o.mass / m).toFixed(2).padStart(6)}  ${(o.hp / m).toFixed(2).padStart(6)}  ${(o.dist / m).toFixed(1).padStart(6)}  ${(o.pred / m).toFixed(2).padStart(6)}`); }
});
