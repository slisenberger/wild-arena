// Milestone 4 'rich' decision inputs: the base option features (features_plus.js for the other side, guard_features.js for
// your guards) + what a fight actually turns on, per candidate target t of unit u. Added because a lookahead found big gains
// for your cats (+0.203) that no guard feature correlated with (all |r| <= .017): timing, the kill race, openings, who is
// after whom. Rough, deterministic estimates from the engine's own stats; no rng, no side effects. 'none' / 'feed' get zeros.
const path = require('path');
const A = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'));
const FP = require('./features_plus.js'), G = require('./guard_features.js'), I = A._internals;
const RICH = ['tContact', 'tKill', 'tDie', 'killRace', 'tOnMe', 'tOnHuman', 'tOnAlly', 'allyHpOn', 'etaHuman', 'beatsMeToHuman',
  'facingAway', 'flankCos', 'tSpeedRel', 'tFleeingFast', 'alliesOnT', 'foesNearT', 'tLatched', 'tHpAbs', 'myHp', 'myStam'];
const lg1 = x => Math.log1p(Math.max(0, x));
// damage per hit of a on b: the engine's base x mass ratio^0.2 x (1 - armor x (1 - pierce)) (no situational terms)
const hit = (a, b) => Math.max(1, (a.s.dmg || 1) * Math.pow(a.s.mass / b.s.mass, .2) * (1 - (b.s.armor || 0) * (1 - (a.s.pierce || 0))));
function rich(w, u, t){
  const H = w.human, d = I.dist(u, t), my = Math.max(1, u.s.spd), closing = Math.max(1, my - Math.max(0, Math.hypot(t.vx, t.vy) * .5));
  const tKill = t.hp / hit(u, t) * (u.s.cd || 1), tDie = u.hp / hit(t, u) * (t.s.cd || 1);
  const tt = t.target && I.active(t.target) ? t.target : null, onAlly = !!tt && tt !== u && tt !== H && tt.side === u.side;
  const etaH = tt === H || I.dist(t, H) < 15 ? I.dist(t, H) / Math.max(1, t.s.spd) : 60, myToT = d / closing;
  const h = I.headingOf(t), tx = u.x - t.x, ty = u.y - t.y, tm = Math.hypot(tx, ty) || 1, cos = h ? (h.x * tx + h.y * ty) / tm : 0; // +1: t faces me
  let allies = 0, foes = 0;
  for (const o of w.units){ if (!I.active(o) || o === u || o === t) continue; const k = I.dist(o, t); if (k > 8) continue; if (o.side === u.side || (u.side !== 'E' && o.side === 'H')) { if (k < 4) allies++; } else foes++; }
  const sp = Math.hypot(t.vx, t.vy);
  return [Math.min(4, lg1(d / closing)), Math.min(4, lg1(tKill)), Math.min(4, lg1(tDie)), Math.max(-3, Math.min(3, Math.log((tDie + .5) / (tKill + .5)))),
    +(tt === u), +(tt === H), +onAlly, onAlly ? tt.hp / tt.maxhp : 0, Math.min(4, lg1(etaH)), +(tt === H && etaH < myToT),
    +(cos < -.3), -cos, Math.min(2, sp / my), +(t.state === 'flee' && sp > .6 * my), Math.min(4, allies) / 4, Math.min(5, foes) / 5,
    +!!(t.latchedBy || t.latchOn), Math.min(3, lg1(t.hp / 1000)), u.hp / u.maxhp, Math.min(1, u.stam || 0)];
}
// HIDDEN (feat 'richh'): the engine state an animal's next moves hinge on, which the lookahead sees and summary inputs don't:
// attack / charge / pounce readiness, morale, stamina, agitation, heat, slowdown, stun, for the target and the deciding unit
const HIDDEN = ['tAtkReady', 'tAtkWait', 'tMorale', 'tStam', 'tAgit', 'tChargeReady', 'tPounceReady', 'tHeat', 'tSlow', 'tStun', 'myAtkReady', 'myMorale', 'myHeat', 'myChargeReady'];
function hidden(w, u, t){ const r = x => +((x || 0) <= 0);
  return [r(t.atk), Math.min(2, Math.max(0, t.atk || 0)), Math.min(1.5, t.morale || 0), Math.min(1, t.stam || 0), Math.min(1, t.agit || 0), r(t.chargeCd), r(t.pounceCd),
    Math.min(1.5, t.heat || 0), Math.min(1, t.slow || 0), Math.min(2, t.stun || 0), r(u.atk), Math.min(1.5, u.morale || 0), Math.min(1.5, u.heat || 0), r(u.chargeCd)]; }
// {opts, X}: the base set's options and rows, each target row extended by RICH (others by zeros)
function extract(w, u, o){
  o = o || {}; const base = u.side === 'E' ? FP.extract(w, u, o.herb) : G.extract(w, u, o.wide), n = RICH.length + (o.hidden ? HIDDEN.length : 0), z = new Array(n).fill(0);
  return {opts: base.opts, X: base.opts.map((op, i) => base.X[i].concat(op.kind === 'target' ? (o.hidden ? rich(w, u, op.t).concat(hidden(w, u, op.t)) : rich(w, u, op.t)) : z))};
}
const NAMES_E = [...FP.NAMES, ...RICH], NAMES_G = [...G.NAMES, ...RICH], NAMES_EH = [...NAMES_E, ...HIDDEN], NAMES_GH = [...NAMES_G, ...HIDDEN];
module.exports = { RICH, HIDDEN, extract, NAMES_E, NAMES_G, NAMES_EH, NAMES_GH, DIM_E: NAMES_E.length, DIM_G: NAMES_G.length, DIM_EH: NAMES_EH.length, DIM_GH: NAMES_GH.length };
