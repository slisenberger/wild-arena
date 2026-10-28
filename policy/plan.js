// Milestone 4 'planning cats' (prototype, ?smart=1): an enemy cat chooses its target by lookahead. At each decision with 2+
// targets it copies the fight (lookahead.js), plays each option (the heuristic's pick + up to 3 nearest others) for H seconds
// with the cat holding that target and everything else as usual, each copy rolling its own dice (derived from the fight's
// state, so a fight still replays exactly), and takes the option that went best for its side: your HP lost x2, your side's
// HP lost, minus its own side's, as shares of max HP. Measured (probes/cat_lookahead.js, FAIR): 15 s +0.207 ± 0.032 on 1,200
// fights; 8 s +0.247 ± 0.067 on 300 (15 s on the same: +0.195). probes/plan_eval.js measures this file as the game runs it.
// makePlanner() returns a fresh target policy per fight (its decision counter is part of the dice). cool: a cat keeps a plan
// that is under 2 s old (same gain, half the CPU: +0.241 ± 0.061, ~0.5 s per fight on a desktop thread).
const path = require('path');
const A = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'));
const L = require('./lookahead.js');
function score(w){
  let pl = 0, pm = 0, el = 0, em = 0;
  for (const u of w.units){ const lost = u.maxhp - Math.max(0, u.state === 'dead' ? 0 : u.hp); if (u.side === 'E'){ el += lost; em += u.maxhp; } else { pl += lost; pm += u.maxhp; } }
  const H = w.human; return 2 * (H.maxhp - Math.max(0, H.state === 'dead' ? 0 : H.hp)) / H.maxhp + pl / pm - el / em + (H.state === 'dead' ? 2 : 0);
}
function makePlanner(o){
  o = Object.assign({H: 8, max: 3, cool: 2}, o || {}); // 8 s measured at least as good as 15 s (+0.247 vs +0.195, same fights) at half the cost
  const P = {kind: 'target-look', n: 0, branched: 0, changed: 0};
  P.pick = (w, u, opts, teach) => {
    P.n++;
    const tg = opts.map((x, i) => i).filter(i => opts[i].kind === 'target');
    if (tg.length < 2) return teach;
    if (o.cool && u.planT !== undefined && w.t - u.planT < o.cool){ const k = opts.findIndex(x => x.kind === 'target' && x.t === u.planTo); if (k >= 0) return k; } // cool s: keep a fresh plan
    const I = A._internals, others = tg.filter(i => i !== teach).sort((i, j) => I.dist(u, opts[i].t) - I.dist(u, opts[j].t)).slice(0, o.max);
    const tries = (teach >= 0 ? [teach] : []).concat(others), ui = w.units.indexOf(u);
    const inner = {policy: {byArch: Object.assign({}, w.cfg.policy.byArch, {cat: {teacher: true}})}}; // inside a branch: today's cats, every other learned choice kept
    let best = teach, bs = -1e9; P.branched++;
    for (const i of tries){
      const c = L.cloneWorld(w, inner), cu = c.units[ui];
      c.R.seek((w.R.state() ^ Math.imul(P.n * 97 + i + 1, 0x9e3779b9)) >>> 0);
      cu.forceT = c.units[w.units.indexOf(opts[i].t)]; cu.forceUntil = c.t + o.H; cu.target = cu.forceT; cu.state = 'engage'; cu.carcass = null;
      const t1 = c.t + o.H; while (!c.over && c.t < t1) A.step(c);
      const v = score(c); if (v > bs + 1e-9){ bs = v; best = i; }
    }
    if (best !== teach) P.changed++;
    u.planT = w.t; u.planTo = opts[best] && opts[best].t;
    return best;
  };
  return P;
}
module.exports = { makePlanner, score };
