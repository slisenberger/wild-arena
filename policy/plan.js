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
const SM = require('./set_model.js'), FP = require('./features_plus.js'), FR = require('./features_rich.js'), G = require('./guard_features.js'), TR = require('./traits.js'), TM = require('./target_model.js');
function score(w){
  let pl = 0, pm = 0, el = 0, em = 0;
  for (const u of w.units){ const lost = u.maxhp - Math.max(0, u.state === 'dead' ? 0 : u.hp); if (u.side === 'E'){ el += lost; em += u.maxhp; } else { pl += lost; pm += u.maxhp; } }
  const H = w.human; return 2 * (H.maxhp - Math.max(0, H.state === 'dead' ? 0 : H.hp)) / H.maxhp + pl / pm - el / em + (H.state === 'dead' ? 2 : 0);
}
function makePlanner(o){
  o = Object.assign({H: 8, max: 3, cool: 2, rolls: 1, data: null, learner: null, real: 0, feat: null, set: false, arch: 'cat', side: 'E', only: null, wide: false}, o || {});
  // arch / side: whose choice is planned. 'guard' / 'P' = your guards (policy.js chooseGuard; scored for your side; only 'cat' =
  // just your big cats; wide = no leash); data / learner use features_plus for enemies and guard_features for your guards
  // real: a realism-aware teacher: each branch's score loses real x (the share of its H seconds this cat spent idle, i.e. slow and
  // not near its target, or sprinting > 8 m from its target); imitation of the plain teacher drifted into idle / sprint-heavy cats
  // training only (policy/expert_iter.js): rolls = fair rolls averaged per option; data = an array that collects each planned
  // decision (features_plus rows of the tried options, their branch scores, the heuristic's pick, the cat's traits);
  // learner = a target-mlp whose pick is played instead of the plan's (DAgger: the plan only labels) // 8 s measured at least as good as 15 s (+0.247 vs +0.195, same fights) at half the cost
  const P = {kind: 'target-look', n: 0, branched: 0, changed: 0, only: o.only, wide: o.wide};
  P.pick = (w, u, opts, teach) => {
    P.n++;
    const tg = opts.map((x, i) => i).filter(i => opts[i].kind === 'target');
    if (tg.length < 2) return teach;
    if (o.cool && u.planT !== undefined && w.t - u.planT < o.cool){ const k = opts.findIndex(x => x.kind === 'target' && x.t === u.planTo); if (k >= 0) return k; } // cool s: keep a fresh plan
    const I = A._internals, others = tg.filter(i => i !== teach).sort((i, j) => I.dist(u, opts[i].t) - I.dist(u, opts[j].t)).slice(0, o.max);
    const tries = (teach >= 0 ? [teach] : []).concat(others), ui = w.units.indexOf(u);
    const today = ['cat', 'brawler', 'harrier'].includes(o.arch) ? {teacher: true} : {kind: 'target-lin', v: 1, nin: 200, margin: .25, wt: new Array(200).fill(0)}; // predators: the teacher path; guards and herbivores: zero weights
    const inner = {policy: {byArch: Object.assign({}, w.cfg.policy.byArch, {[o.arch]: today})}}; // inside a branch: today's choices for this archetype, every other learned choice kept
    let best = teach, bs = -1e9; P.branched++;
    const sc = [];
    for (const i of tries){
      let v = 0;
      for (let k = 0; k < o.rolls; k++){
        const c = L.cloneWorld(w, inner), cu = c.units[ui];
        c.R.seek((w.R.state() ^ Math.imul(P.n * 97 + i + 1 + 7919 * k, 0x9e3779b9)) >>> 0);
        cu.forceT = c.units[w.units.indexOf(opts[i].t)]; cu.forceUntil = c.t + o.H; cu.target = cu.forceT; cu.state = 'engage'; cu.carcass = null;
        const t1 = c.t + o.H; let bad = 0;
        while (!c.over && c.t < t1){ A.step(c); if (o.real && I.active(cu)){ const sp = Math.hypot(cu.vx, cu.vy), tt = cu.target && I.active(cu.target) ? cu.target : null, d = tt ? I.dist(cu, tt) : 1e9;
          if ((sp < 1 && d > 10) || (sp > .7 * cu.s.spd && d > 8)) bad += .1; } }
        v += ((o.side === 'P' ? -score(c) : score(c)) - o.real * bad / o.H) / o.rolls; // your side: the other side's loss is your gain
      }
      sc.push(v); if (v > bs + 1e-9){ bs = v; best = i; }
    }
    const feats = () => (o.feat === 'rich' || o.feat === 'richh' ? FR.extract(w, u, {wide: o.wide, hidden: o.feat === 'richh'}) : o.arch === 'guard' ? G.extract(w, u, o.wide) : FP.extract(w, u)).X;
    if (o.data){ const X = feats(), r4 = x => Math.round(x * 1e4) / 1e4; const rec = {sp: u.s.id, tr: TR.traits(u.s), X: tries.map(i => X[i].map(r4)), s: sc.map(r4), teach: tries.indexOf(teach)};
      if (o.set){ const si = SM.setInputs(w, u, opts); rec.U = si.U.map(r => r.map(r4)); rec.T = tries.map(i => si.T[i] ? si.T[i].map(r => r.map(r4)) : null); } // state encoder data
      o.data.push(rec); }
    if (best !== teach) P.changed++;
    u.planT = w.t; u.planTo = opts[best] && opts[best].t;
    if (o.learner && o.learner.kind === 'target-set'){ const q = SM.scores(o.learner, SM.decision(w, u, opts, feats()), teach); let k = teach; q.forEach((x, j) => { if (opts[j].kind === 'target' && x > q[k]) k = j; }); return k; }
    if (o.learner){ const X = TM.inputs(o.learner, feats(), u), q = TM.scores(o.learner, X, teach); if (o.learner.targetsOnly) opts.forEach((x, j) => { if (x.kind !== 'target' && j !== teach) q[j] = -Infinity; }); let k = 0; q.forEach((x, j) => { if (x > q[k]) k = j; }); return k; }
    return best;
  };
  return P;
}
module.exports = { makePlanner, score };
