// Milestone 4 diagnostic: YOUR cats (and, for comparison, your other guards by class) in the live game (every shipped policy on).
// Per species: damage dealt (to anything / per minute alive), kills, deaths and killers, time engaged / guarding / fleeing, and
// what it spends its engaged time on: an enemy predator or herbivore, its mass ratio, whether that enemy was busy with
// someone else or coming for you. Usage: node policy/probes/guard_cat_diag.js [N]
const path = require('path'), R = require(path.join(__dirname, '..', 'move_run.js'));
require(path.join(__dirname, '..', 'live.js'));
const A = R.A, I = A._internals, N = +process.argv[2] || 400;
const isCat = s => s.pred && !!s.latch && (s.gait === 'stalk' || s.gait === 'rush');
const fights = R.fightSet('probe', 51, N, {arch: 'guard', seed: 9, withLive: true}), S = {};
let nf = 0;
for (const f of fights){
  const w = A.setup({team: f.team, board: f.board, terrain: f.tr, mode: 'wild', mount: f.mount, seed: f.seed});
  const us = w.units.filter(u => u.side === 'P');
  if (!us.some(u => isCat(u.s))) continue; nf++;
  const T = new Map(us.map(u => [u, {st: {}, on: {}}]));
  while (!w.over){
    A.step(w);
    for (const u of us){ if (!I.active(u) || u.rider) continue; const t = T.get(u), k = u.latchOn ? 'latched' : u.state; t.st[k] = (t.st[k] || 0) + .1;
      const e = u.target; if (e && I.active(e) && u.state === 'engage'){
        const r = e.s.mass / u.s.mass, kind = `${e.s.pred ? 'predator' : 'herbivore'} ${r < 1 ? '<1x' : r < 3 ? '1-3x' : r < 8 ? '3-8x' : '8x+'}${e.target === w.human ? ' (on you)' : I.locked(e) ? ' (busy w/ ours)' : ''}`;
        if (process.env.WHY && !e.s.pred && r >= 3){ const why = u.latchOn === e ? 'latched on it' : e.target === u || e.latchOn === u ? 'it is attacking the cat' : u.grudge === e ? 'grudge' : u.gT === e ? 'guard intent (help/intercept)' : 'cat chose it'; t.on['WHY ' + why] = (t.on['WHY ' + why] || 0) + .1; }
        t.on[kind] = (t.on[kind] || 0) + .1; } }
  }
  for (const u of us){
    const id = isCat(u.s) ? u.s.id : 'other:' + (u.s.gait === 'charge' ? 'charger' : u.s.gait === 'orbit' ? 'canid' : u.s.mass >= 2000 ? 'big' : 'other');
    const s = S[id] = S[id] || {n: 0, dealt: 0, alive: 0, kills: 0, died: 0, by: {}, st: {}, on: {}, protect: 0};
    s.n++; s.dealt += u.st.dealt; s.alive += u.st.alive; s.kills += u.st.kills; s.protect += u.st.protect || 0;
    if (u.state === 'dead'){ s.died++; s.by[u.killedBy] = (s.by[u.killedBy] || 0) + 1; }
    const t = T.get(u); for (const f of ['st', 'on']) for (const [k, v] of Object.entries(t[f])) s[f][k] = (s[f][k] || 0) + v;
  }
}
const pct = (o, top) => { const tot = Object.values(o).reduce((x, y) => x + y, 0) || 1; return Object.entries(o).sort((x, y) => y[1] - x[1]).slice(0, top || 9).map(([k, v]) => `${k} ${(100 * v / tot).toFixed(0)}%`).join(', '); };
console.log(`your side in ${nf} live fights with one of your cats (probe 51):`);
for (const [id, s] of Object.entries(S).sort((x, y) => (x[0] > y[0] ? 1 : -1))){
  console.log(`  ${id.padEnd(14)} n ${String(s.n).padStart(4)} | dealt ${(s.dealt / s.n).toFixed(0).padStart(5)}/fight, ${(60 * s.dealt / Math.max(1, s.alive)).toFixed(0).padStart(5)}/min | kills ${(s.kills / s.n).toFixed(2)} | died ${(100 * s.died / s.n).toFixed(0)}% (${pct(s.by, 3).replace(/ \d+%/g, '')}) | time: ${pct(s.st, 4)}`);
  if (!id.startsWith('other')) console.log(`  ${''.padEnd(14)} engaged on: ${pct(Object.fromEntries(Object.entries(s.on).filter(([k]) => !k.startsWith('WHY'))), 7)}`);
  if (!id.startsWith('other') && process.env.WHY) console.log(`  ${''.padEnd(14)} why on a big herbivore: ${pct(Object.fromEntries(Object.entries(s.on).filter(([k]) => k.startsWith('WHY')).map(([k, v]) => [k.slice(4), v])))}`);
}
