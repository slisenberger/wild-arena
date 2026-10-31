// Milestone 4: features.js's 63 option features + the guard situation around each target ('plus' feature set; a scorer
// with P.feat === 'plus' uses it). The cat diagnosis (SPECIATION.md) says the bottleneck is getting through your guards, so
// these say who is free to stop the attacker: guards near the target (within 10 m), how many are free (not in contact with
// something), the free ones' strength vs the attacker's pack, and how many other enemies are already tying them up.
// For the human they describe your bodyguards; for one of your animals, its neighbours. 'none' and 'feed' get zeros.
const path = require('path');
const A = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'));
const F = require('./features.js'), I = A._internals;
const PLUS = ['gNear', 'gFree', 'gBusyFrac', 'gFreeStrLog', 'enemiesOnGuards', 'alliesOnTarget', 'humanGuardsFree', 'humanFreeStrLog'];
const NAMES = [...F.NAMES, ...PLUS], DIM = NAMES.length;
const lg = x => Math.log(Math.max(1e-6, x));
function around(w, u, t, my){
  let near = 0, free = 0, freeStr = 0, tied = 0;
  for (const g of w.units){
    if (g === t || g.side !== 'P' || !I.active(g) || g.state === 'flee' || g.withdrawn || I.dist(g, t) > 10) continue;
    near++; if (I.busy(g)){ for (const e of w.units) if (e !== u && e.side === 'E' && I.active(e) && (e.target === g || e.latchOn === g) && I.dist(e, g) < e.r + g.r + e.s.reach + 1.5){ tied++; break; } }
    else { free++; freeStr += I.strength(g); }
  }
  return {near, free, freeStr, tied, rel: freeStr / my};
}
function extract(w, u, herb){
  const {opts, X} = F.extract(w, u, herb), my = I.packStrength(w, u), H = w.human;
  const hs = around(w, u, H, my);
  const Xp = opts.map((o, i) => {
    if (o.kind !== 'target') return X[i].concat(new Array(PLUS.length).fill(0));
    const t = o.t, a = t === H ? hs : around(w, u, t, my);
    let allies = 0; for (const e of w.units) if (e !== u && e.side === 'E' && I.active(e) && e.target === t) allies++;
    return X[i].concat([Math.min(4, a.near) / 4, Math.min(4, a.free) / 4, a.near ? (a.near - a.free) / a.near : 0, Math.log1p(a.rel) / 2,
      Math.min(3, a.tied) / 3, Math.min(3, allies) / 3, t === H ? Math.min(4, hs.free) / 4 : 0, t === H ? Math.log1p(hs.rel) / 2 : 0]);
  });
  return {opts, X: Xp};
}
module.exports = { NAMES, DIM, PLUS, extract, heuristicIndex: F.heuristicIndex, herbHeuristic: F.herbHeuristic };
