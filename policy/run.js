// One board fight with the enemy predators driven by the heuristic (P = null) or a policy net, and the numbers the
// trainer and the realism gates need. Used by es.js (training + validation) and final.js (paired evaluation).
//   foe     damage the other side's predators dealt to your side (you + your animals; feud damage excluded)
//   killed  1 if a predator killed you
//   deaths  enemy predators that died;  won / score: your result
//   dis     share of the net's own decisions that differ from the heuristic's (0 for the heuristic)
//   T       (with prof) predator-seconds per species per time category, see CATS
const path = require('path');
const A = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'));
require('./policy.js');
const CATS = ['you', 'animals', 'feud', 'feed', 'rest', 'flee', 'none'];
function cat(u){
  if (u.state === 'flee' || u.state === 'cool' || u.heatstroke) return 'flee';
  if (u.state === 'feed') return 'feed';
  if (u.state === 'rest') return 'rest';
  if (u.target && u.state === 'engage') return u.target.side === 'H' ? 'you' : u.target.side === 'P' ? 'animals' : 'feud';
  if (u.latchOn) return u.latchOn.side === 'H' ? 'you' : 'animals';
  return 'none';
}
function cfgOf(j){ return {team: j.team, board: j.board, terrain: j.tr, mode: 'wild', mount: j.mount, seed: j.seed}; }
function fight(j, P, prof){
  const c = cfgOf(j); if (P){ c.policy = P; c.policyStats = {}; }
  const w = A.setup(c), T = prof ? {} : null;
  if (prof){
    while (!w.over){ A.step(w);
      for (const u of w.units) if (u.side === 'E' && u.s.pred && u.state !== 'dead' && !u.escaped && !u.penned){
        const t = T[u.s.id] || (T[u.s.id] = Object.fromEntries(CATS.map(k => [k, 0]))); t[cat(u)] += A.DT; } }
  } else while (!w.over) A.step(w);
  const pr = w.units.filter(u => u.side === 'E' && u.s.pred), r = w.result;
  const deathsBy = {}; for (const u of pr) if (u.state === 'dead') deathsBy[u.s.id] = (deathsBy[u.s.id] || 0) + 1;
  const present = {}; for (const u of pr) present[u.s.id] = (present[u.s.id] || 0) + 1;
  return {foe: pr.reduce((s, u) => s + u.st.foe, 0), dmg: pr.reduce((s, u) => s + u.st.dealt, 0),
    killed: !r.survived && r.killer && A.BY_ID[r.killer] && A.BY_ID[r.killer].pred ? 1 : 0, killer: r.survived ? null : r.killer || null,
    deaths: pr.filter(u => u.state === 'dead').length, nPred: pr.length, won: r.score >= 300 ? 1 : 0, score: r.score,
    dis: P && c.policyStats.n ? 1 - (c.policyStats.agree || 0) / c.policyStats.n : 0, nDec: P ? c.policyStats.n || 0 : 0,
    T, deathsBy, present};
}
module.exports = { A, CATS, cat, cfgOf, fight };
