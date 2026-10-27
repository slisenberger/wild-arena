// Milestone 4 diagnostic: what each enemy predator species achieves in the live game (every shipped policy on) and how it dies.
// Per species: fights, damage to your side per fight and per minute alive, kills, deaths (and of what), share of its time
// engaged / roaming / fleeing / resting / feeding / latched, and how often it is the one that kills you.
//   node policy/probes/cat_diag.js [N] [arch=cat]
const path = require('path'), R = require(path.join(__dirname, '..', 'move_run.js'));
require(path.join(__dirname, '..', 'live.js'));
const A = R.A, I = A._internals, [n, a] = process.argv.slice(2), N = +n || 300, arch = a || 'cat';
const fights = R.fightSet('probe', 41, N, {arch, seed: 5, withLive: true}), S = {}, killers = {};
for (const f of fights){
  const w = A.setup({team: f.team, board: f.board, terrain: f.tr, mode: 'wild', mount: f.mount, seed: f.seed});
  const us = w.units.filter(u => I.archetypeOf(u) === arch), T = new Map(us.map(u => [u, {}]));
  while (!w.over){ A.step(w); for (const u of us) if (I.active(u)){ const k = u.latchOn ? 'latched' : u.state; const t = T.get(u); t[k] = (t[k] || 0) + .1; } }
  for (const u of us){
    const s = S[u.s.id] = S[u.s.id] || {n: 0, foe: 0, alive: 0, kills: 0, died: 0, by: {}, st: {}, killedYou: 0, hitYou: 0};
    s.n++; s.foe += u.st.foe; s.alive += u.st.alive; s.kills += u.st.kills; if (u.state === 'dead'){ s.died++; s.by[u.killedBy] = (s.by[u.killedBy] || 0) + 1; }
    for (const [k, v] of Object.entries(T.get(u))) s.st[k] = (s.st[k] || 0) + v;
    if (w.human.state === 'dead' && w.human.lastHitBy === u) s.killedYou++;
  }
}
console.log(`${arch} species in ${N} live fights (probe 41):`);
for (const [id, s] of Object.entries(S).sort((x, y) => y[1].n - x[1].n)){
  const tot = Object.values(s.st).reduce((x, y) => x + y, 0) || 1, by = Object.entries(s.by).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ');
  console.log(`  ${id.padEnd(10)} n ${String(s.n).padStart(4)} | dmg to your side ${(s.foe / s.n).toFixed(0).padStart(4)}/fight, ${(60 * s.foe / Math.max(1, s.alive)).toFixed(0).padStart(4)}/min alive | kills ${(s.kills / s.n).toFixed(2)} | killed you ${(100 * s.killedYou / s.n).toFixed(0)}% | died ${(100 * s.died / s.n).toFixed(0)}% (${by}) | time: ${Object.entries(s.st).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${(100 * v / tot).toFixed(0)}%`).join(' ')}`);
}
