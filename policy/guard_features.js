// Milestone 4: options and features for a GUARD's learned target choice (your side's animals; sim.js guardCandidates).
// Options: 0 = none (no target: stand guard), then every candidate enemy in w.units order. A linear scorer adds the same
// value to every option for a feature that doesn't depend on the option, so the unit's own context enters only on the
// 'none' option (when to hold back) and its species only through interactions with the candidate (TRAITS_X); the enemy's
// species enters as its trait vector (policy/traits.js). Nothing here consumes the fight's rng or has side effects.
const path = require('path');
const A = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'));
const TR = require('./traits.js');
const I = A._internals;

const TYPE = ['isNone', 'isTarget'];
const TGT = ['dist', 'logDist', 'distHuman', 'onHuman', 'latchedHuman', 'onOurs', 'latchedOurs', 'comingHuman', 'logStrVsSelf',
  'logStrVsPack', 'logMassRatio', 'hpFrac', 'fleeing', 'stunned', 'heatstroke', 'locked', 'oursOnIt', 'current', 'grudge',
  'visible', 'reachable', 'yieldsTo', 'pred', 'giant', 'inWater', 'beyondPost', 'rival',
  // self x candidate: a cat on guard and a predator, a charger and a herbivore, small guard on a giant, packmates already on it
  'catOnPred', 'chargerOnHerb', 'smallOnGiant', 'packOnIt'];
const TRAITS_X = TR.NAMES.map(n => 'e_' + n);
const NONE = ['n_hpFrac', 'n_drive', 'n_morale', 'n_comingHuman', 'n_humanHp', 'n_post', 'n_distHuman', 'n_nCand', 'n_engaged'];
const NAMES = [...TYPE, ...TGT, ...TRAITS_X, ...NONE];
const DIM = NAMES.length;
const lg = x => Math.log(Math.max(1e-6, x));

function coming(e, H){
  const dh = I.dist(e, H), v = Math.hypot(e.vx, e.vy);
  return v > 1.5 && dh < 25 && ((H.x - e.x) * e.vx + (H.y - e.y) * e.vy) / ((dh || 1) * v) > .7;
}
function targetFeats(w, u, e, own, my){
  const H = w.human, d = I.dist(u, e), es = I.strength(e), t = e.target;
  let ours = 0, pack = 0;
  for (const a of w.units) if (a !== u && a.side === 'P' && I.active(a) && a.target === e){ ours++; if (I.packMate(u, a)) pack++; }
  const anchor = u.post, rv = u.s.rivals && u.s.rivals[I.sp(e.s)];
  return [d / 50, Math.log1p(d / 30), I.dist(e, H) / 50, +(t === H), +(e.latchOn === H), +(!!t && t.side === 'P'), +(!!e.latchOn && e.latchOn.side === 'P'),
    +coming(e, H), lg(es / own) / 2, lg(es / my) / 2, lg(e.s.mass / u.s.mass) / 3, e.hp / e.maxhp, +(e.state === 'flee'), +(e.stun > 0), +!!e.heatstroke,
    +I.locked(e), Math.min(3, ours) / 3, +(u.target === e), +(u.grudge === e), +I.canSee(w, u, e), +I.reachable(u, e), +I.yieldsTo(w, u, e),
    +!!e.s.pred, +(e.s.id === 'elephant' || I.has(e, 'giant')), +I.inWater(w, e), anchor ? Math.min(2, I.dist(e, anchor) / I.POST_R) / 2 : 0, rv ? lg(rv) : 0,
    +(!!u.s.pred && !!u.s.latch && !!e.s.pred), +(!!u.s.charge && !e.s.pred), +(es > 3 * my && I.has(e, 'giant')), Math.min(3, pack) / 3];
}
// {opts, X}: X[i] is option i's feature vector (length DIM)
function extract(w, u){
  const H = w.human, cands = I.guardCandidates(w, u), opts = [{kind: 'none'}, ...cands.map(t => ({kind: 'target', t}))];
  const own = I.strength(u), my = I.packStrength(w, u);
  let nComing = 0; for (const e of cands) if (e.target === H || coming(e, H)) nComing++;
  const none = [u.hp / u.maxhp, I.drive(u), u.morale, Math.min(3, nComing) / 3, H.hp / H.maxhp, +!!u.post, Math.min(1, I.dist(u, H) / 30),
    Math.min(8, cands.length) / 8, +(u.state === 'engage')];
  const zT = new Array(TGT.length).fill(0), zX = new Array(TRAITS_X.length).fill(0), zN = new Array(NONE.length).fill(0);
  const X = opts.map(o => o.kind === 'none' ? [1, 0, ...zT, ...zX, ...none] : [0, 1, ...targetFeats(w, u, o.t, own, my), ...TR.traits(o.t.s), ...zN]);
  return {opts, X};
}
// the heuristic's pick (allyTarget's result, passed in): its index in opts, -1 if it isn't a candidate
function heuristic(opts, t){ return t ? opts.findIndex(o => o.kind === 'target' && o.t === t) : 0; }
module.exports = { NAMES, DIM, extract, heuristic };
