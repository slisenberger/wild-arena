// Milestone 4: a copied fight (policy/lookahead.js) must play on exactly like the original: N live fights (every shipped
// policy on), copied at t = 20 / 60 / 120 s, both played to the end, compared on the events after the copy and every unit's
// final position, HP and state (a copy starts with an empty event log).
//   node policy/lookahead_test.js [N]
const R = require('./move_run.js'), L = require('./lookahead.js'), A = R.A; require('./live.js');
const N = +process.argv[2] || 60, fights = R.fightSet('probe', 91, N, {arch: 'guard', seed: 5});
let ok = 0, n = 0;
for (const f of fights) for (const t0 of [20, 60, 120]){
  const cfg = Object.assign(R.cfgOf(f), {livePolicy: true}); delete cfg.movePolicy;
  const w = A.setup(cfg); while (!w.over && w.t < t0) A.step(w); if (w.over) continue;
  const e0 = w.events.length, c = L.cloneWorld(w); while (!w.over) A.step(w); while (!c.over) A.step(c);
  const fp = (x, ev) => JSON.stringify([ev, x.t, x.units.map(u => [u.x, u.y, u.hp, u.state])]);
  n++; if (fp(w, w.events.slice(e0)) === fp(c, c.events)) ok++; else console.log('differs: fight', f.i, 'board', f.board.join(','), 't0', t0);
}
console.log(`${ok}/${n} copied fights identical to the original`); if (ok !== n) process.exit(1);
