// Milestone 4 diagnostic: how enemy cats' approaches end in the live game (every shipped policy on). An approach starts when a
// cat has a target more than 3 m beyond touching and ends at the first of: it deals damage ('hit'), it starts fleeing ('fled'),
// it dies, it switches target ('switched') or drops it ('dropped'). For each we note whether it was hurt on the way, and by
// whom (its target or someone else = intercepted). Per species and overall. Usage: node policy/probes/cat_approach.js [N]
const path = require('path'), R = require(path.join(__dirname, '..', 'move_run.js'));
require(path.join(__dirname, '..', 'live.js'));
const A = R.A, I = A._internals, N = +process.argv[2] || 300;
const fights = R.fightSet('probe', 41, N, {arch: 'cat', seed: 5, withLive: true}), S = {}, SW = {};
const kindOf = (u, t) => t.side === 'H' ? 'you' : t.rider ? 'your mount' : t.s.mass > 3 * u.s.mass ? 'big guard' : 'guard';
const add = (id, end, hurt, by, tgt, dur) => { const s = S[id] = S[id] || {n: 0, end: {}, hurtBy: {}, tgt: {}, dur: 0};
  s.n++; s.end[end] = (s.end[end] || 0) + 1; s.dur += dur; if (hurt) s.hurtBy[by] = (s.hurtBy[by] || 0) + 1; s.tgt[tgt] = (s.tgt[tgt] || 0) + 1; };
for (const f of fights){
  const w = A.setup({team: f.team, board: f.board, terrain: f.tr, mode: 'wild', mount: f.mount, seed: f.seed});
  const cats = w.units.filter(u => I.archetypeOf(u) === 'cat'), ap = new Map();
  const close = (u, a, end) => { add(u.s.id, end, a.hurt, a.by, a.kind, w.t - a.t0); ap.delete(u); };
  while (!w.over){
    A.step(w);
    for (const u of cats){
      const a = ap.get(u);
      if (a){
        if (u.state === 'dead'){ close(u, a, 'died'); continue; }
        if (u.st.dealt > a.dealt){ close(u, a, 'hit'); continue; }
        if (u.state === 'flee'){ close(u, a, 'fled'); continue; }
        if (u.st.taken > a.taken && !a.hurt){ a.hurt = true; const h = u.lastHitBy; a.by = !h ? 'env' : h === a.target ? 'its target' : 'someone else'; }
        if (u.target !== a.target){
          if (u.target){ const n = u.target, k = `${a.kind} -> ${kindOf(u, n)}${n.target === u || n.latchOn === u ? ' (it was on the cat)' : ''}${!I.active(a.target) ? ' (old target down)' : ''}`; SW[k] = (SW[k] || 0) + 1; }
          close(u, a, u.target ? 'switched' : 'dropped'); }
      }
      if (!ap.has(u) && I.active(u) && u.target && u.state === 'engage' && I.dist(u, u.target) > u.r + u.target.r + u.s.reach + 3){
        const t = u.target; ap.set(u, {target: t, t0: w.t, dealt: u.st.dealt, taken: u.st.taken, hurt: false, by: null, kind: kindOf(u, t)});
      }
    }
  }
}
const pct = (o, n) => Object.entries(o).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${(100 * v / n).toFixed(0)}%`).join(', ');
const all = {n: 0, end: {}, hurtBy: {}, tgt: {}, dur: 0}; for (const s of Object.values(S)){ all.n += s.n; all.dur += s.dur; for (const f of ['end', 'hurtBy', 'tgt']) for (const [k, v] of Object.entries(s[f])) all[f][k] = (all[f][k] || 0) + v; }
console.log(`cat approaches in ${N} live fights (probe 41):`);
for (const [id, s] of [['ALL', all], ...Object.entries(S).sort((x, y) => y[1].n - x[1].n)])
  console.log(`  ${id.padEnd(9)} ${String(s.n).padStart(5)} approaches, ${(s.dur / s.n).toFixed(1)} s avg | end: ${pct(s.end, s.n)} | hurt on the way by: ${pct(s.hurtBy, s.n)} | aimed at: ${pct(s.tgt, s.n)}`);
const nsw = Object.values(SW).reduce((x, y) => x + y, 0);
console.log(`switches (${nsw}): ${pct(SW, nsw)}`);
