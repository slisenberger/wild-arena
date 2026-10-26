// Milestone 3, guard archetype: observation for one of your guards (side P, not carrying you) choosing an intent.
// t = its current target or null (guard state). ~46 numbers, each roughly in [-2, 2]. Built only from the engine's pure
// helpers (A._internals): nothing here mutates the fight or consumes its rng (teamSees has a lookout side effect, so the
// threat helpers use sideSees instead).
const path = require('path');
const A = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'));
const I = A._internals;
const TERR = ['savanna', 'river', 'forest', 'tundra'];

const NAMES = ['bias',
  // me
  'hp', 'wound', 'stam', 'morale', 'heat', 'drive', 'isCat', 'isCharger', 'isBig', 'isSmall', 'isPack', 'distH', 'attackersOnMe',
  // my target
  'hasT', 'tDist', 'tOnMe', 'tOnH', 'tLogStr', 'tSweeper', 'tCharging', 'tLocked',
  // you (the human)
  'hHp', 'hRiding', 'hTargeted', 'nOnH', 'hContact', 'hHeld', 'threatDistH', 'threatDistMe', 'threatLogStr', 'threatComing',
  // collateral risk: fights near you
  'sweepNearH', 'chargerNearH', 'enemiesNearH', 'fightNearH',
  // allies
  'alliesNearH', 'alliesAlive', 'enemiesAlive', 'hurtAllyHp', 'hurtAllyDist',
  // time / zone / map
  'time', 'zoneP', 'zoneEdge', 'inWater', ...TERR.map(t => 'map_' + t), ...(I.GUARD_INTENTS || []).map(k => 'prev_' + k)];
const DIM = NAMES.length;
const lg = x => Math.log(Math.max(1e-6, x));
const cl = (v, a, b) => Math.max(a, Math.min(b, v));
const inReach = (a, b, pad) => I.dist(a, b) <= a.r + b.r + a.s.reach + (pad || 0);

function extract(w, u, t, d){
  const H = w.human, my = I.packStrength(w, u), dH = I.dist(u, H);
  let onMe = 0, onH = 0, contact = 0, sweepN = 0, chargeN = 0, enN = 0, fightN = 0, enAlive = 0;
  for (const o of w.units){
    if (!I.active(o)) continue;
    if (o.side === 'E'){
      enAlive++;
      const dh = I.dist(o, H);
      if (o.target === u && I.dist(o, u) < 8) onMe++;
      if (o.target === H || o.latchOn === H){ onH++; if (inReach(o, H, .5) || o.latchOn === H) contact++; }
      if (dh < 10){ enN++; if (I.locked(o)) fightN++; }
      if (dh < 12 && I.has(o, 'sweep') && o.target && o.target !== H) sweepN++;
      if (dh < 15 && o.s.gait === 'charge' && o.target && o.target !== H && (I.locked(o) || (o.mv && o.mv.k === 'charge'))) chargeN++;
    }
  }
  let allyNear = 0, allyAlive = 0, hurt = null;
  for (const o of w.units){
    if (o === u || o.side !== 'P' || !I.active(o)) continue;
    allyAlive++; if (I.dist(o, H) < 8) allyNear++;
    if (o.withdrawn) continue;
    let att = false; for (const e of w.units) if (e.side === 'E' && I.active(e) && (e.target === o || e.latchOn === o) && I.dist(e, o) < 8){ att = true; break; }
    if (att && (!hurt || o.hp / o.maxhp < hurt.hp / hurt.maxhp)) hurt = o;
  }
  const th = I.guardThreat(w, null, false);
  const thComing = th && (th.target === H || th.latchOn === H) ? 1 : th ? .5 : 0;
  const z = w.zb, zp = z ? z.p : 0, edge = z && zp > 0 ? Math.min(u.x - z.x0, z.x1 - u.x, u.y - z.y0, z.y1 - u.y) : 30;
  const big = u.s.mass >= 2000, cat = !!(u.s.pred && u.s.latch);
  return [1,
    u.hp / u.maxhp, I.wound(u), u.stam, u.morale, Math.min(1.4, u.heat), I.drive(u), +cat, +(u.s.gait === 'charge'), +big, +(u.s.mass < 150), +!!I.has(u, 'pack'),
    Math.min(40, dH) / 10, Math.min(3, onMe),
    +!!t, t ? Math.min(60, d) / 20 : 3, t ? +(t.target === u) : 0, t ? +(t.target === H) : 0, t ? cl(lg(I.strength(t) / my) / 2, -2, 2) : 0,
    t ? +!!I.has(t, 'sweep') : 0, t ? +!!(t.mv && t.mv.k === 'charge') : 0, t ? +I.locked(t) : 0,
    H.hp / H.maxhp, +(I.heightOf(H) > 0), +(onH > 0), Math.min(3, onH) / 2, Math.min(3, contact), +!!H.latchedBy,
    th ? Math.min(60, I.dist(th, H)) / 20 : 3, th ? Math.min(60, I.dist(th, u)) / 20 : 3, th ? cl(lg(I.strength(th) / my) / 2, -2, 2) : 0, thComing,
    Math.min(2, sweepN), Math.min(2, chargeN), Math.min(5, enN) / 3, Math.min(3, fightN) / 2,
    Math.min(5, allyNear) / 3, Math.min(8, allyAlive) / 4, Math.min(10, enAlive) / 5, hurt ? hurt.hp / hurt.maxhp : 1, hurt ? Math.min(60, I.dist(hurt, u)) / 20 : 3,
    w.t / 300, zp, cl(edge, -5, 30) / 10, +I.inWater(w, u), ...TERR.map(k => +(w.T.id === k)), ...I.GUARD_INTENTS.map((_, k) => +((u.gIntent || 0) === k))];
}
module.exports = { NAMES, DIM, extract };
