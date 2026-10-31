// Milestone 4 speciation report: with main's live target nets (plus --net=<weights> for --arch=<class>), per deciding species, how often its pick differs
// from today's (the heuristic) and which way: toward you, toward a bigger / smaller animal (log mass ratio), a hurt one, a
// closer one, a predator. Decisions with 2+ options only. Stat-only cfg.pickLog (policy.js); the fights are the shipped game
// otherwise. Usage: node policy/probes/speciation.js [N] [probeIndex] [--net=weights.json --arch=charger] [--out=f.txt]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path'), os = require('os');
const R = require(path.join(__dirname, '..', 'move_run.js')), fs = require('fs');
require(path.join(__dirname, '..', 'live.js')); require(path.join(__dirname, '..', 'policy.js'));
const OPT = isMainThread ? Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v]; })) : workerData.opt; // workers don't see the parent's argv
const NET = OPT.net ? (({meta, ...x}) => x)(JSON.parse(fs.readFileSync(path.resolve(OPT.net), 'utf8'))) : null;
const smart = () => { const by = {}; for (const [k, v] of Object.entries(R.A._internals.LIVE_TARGET || {})) if (v) by[k] = v; if (NET) by[OPT.arch] = NET; return {byArch: by}; };
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
const [n, idx] = process.argv.slice(2).filter(a => !a.startsWith('--')), N = +n || 400; const lines = [];
const fights = R.fightSet('probe', +idx || 71, N, {arch: 'guard', seed: 17});
const T = Math.max(1, Math.min(8, os.cpus().length));
const say = l => { console.log(l); lines.push(l); };
Promise.all([...Array(T).keys()].map(k => new Promise(res => { const w = new Worker(__filename, {workerData: {fights: fights.filter((_, q) => q % T === k), opt: OPT}}); w.on('message', res); }))).then(parts => {
  const all = {};
  for (const p of parts) for (const [k, o] of Object.entries(p)){ const t = all[k] = all[k] || {n: 0, dev: 0, toH: 0, fromH: 0, mass: 0, hp: 0, dist: 0, pred: 0, toNone: 0, fights: new Set()};
    for (const q of ['n', 'dev', 'toH', 'fromH', 'mass', 'hp', 'dist', 'pred', 'toNone']) t[q] += o[q]; o.fights.forEach(x => t.fights.add(x)); }
  say(`speciation: ${N} fights (probe ${+idx || 71}), live target nets${NET ? ' + ' + OPT.net + ' for ' + OPT.arch : ''}; per deciding species, decisions with 2+ options`);
  say('who'.padEnd(34) + 'fights  decisions  changed | of the changes: onto you, off you, log mass a/h, hp a-h, dist a-h (m), pred a-h');
  const rows = Object.entries(all).filter(([, o]) => o.fights.size >= 15).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [k, o] of rows){ const d = Math.max(1, o.dev), m = Math.max(1, o.dev - o.toNone);
    say(k.padEnd(34) + String(o.fights.size).padStart(6) + String(o.n).padStart(11) + `  ${(100 * o.dev / o.n).toFixed(1).padStart(5)}% | ${(100 * o.toH / d).toFixed(0).padStart(3)}% ${(100 * o.fromH / d).toFixed(0).padStart(3)}%  ${(o.mass / m).toFixed(2).padStart(6)}  ${(o.hp / m).toFixed(2).padStart(6)}  ${(o.dist / m).toFixed(1).padStart(6)}  ${(o.pred / m).toFixed(2).padStart(6)}`); }
  if (OPT.out) fs.writeFileSync(OPT.out, lines.join('\n') + '\n');
});
