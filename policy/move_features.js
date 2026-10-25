// Milestone 3: observation for a movement-intent decision (one engaged unit, its current target).
// ~38 numbers, each roughly in [-2, 2]. Built only from the engine's own pure helpers (A._internals): nothing here
// mutates the fight or consumes its rng (waitForOpening is stateful, so its test is re-derived here, not called).
const path = require('path');
const A = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'));
const I = A._internals;
const TERR = ['savanna', 'river', 'forest', 'tundra'];

const NAMES = ['bias', 'dist', 'gap', 'tHuman', 'tRiding', 'tHp', 'tWound', 'tBusy', 'tFlee', 'tEasy', 'tOnMe',
  'logStrVsPack', 'guardLog', 'guardsBlock', 'mates15', 'matesAlive', 'matesOnT', 'attackersOnMe', 'hp', 'wound', 'stam',
  'morale', 'heat', 'hunger', 'dartReady', 'time', 'pressure', 'zoneP', 'zoneEdge', 'inWater', 'preyHuman', 'isHyena',
  ...TERR.map(t => 'map_' + t), ...I.INTENTS.map(k => 'prev_' + k)];
const DIM = NAMES.length;
const lg = x => Math.log(Math.max(1e-6, x));

function extract(w, u, t, d){
  const my = I.packStrength(w, u), ts = I.strength(t), g = I.guardsAround(w, t, u);
  let alive = 0, onT = 0, onMe = 0;
  for (const o of w.units){
    if (!I.active(o)) continue;
    if (I.packMate(u, o)){ alive++; if (o.target === t) onT++; }
    else if (o.side !== u.side && o.side !== 'H' && o.target === u && I.dist(o, u) < 8) onMe++;
  }
  const z = w.zb, zp = z ? z.p : 0, edge = z && zp > 0 ? Math.min(u.x - z.x0, z.x1 - u.x, u.y - z.y0, z.y1 - u.y) : 30;
  const easy = t.state === 'flee' || t.stun > 0 || !!t.latchedBy || !!t.heatstroke;
  return [1, Math.min(60, d) / 20, Math.min(30, d - (u.r + t.r + u.s.reach)) / 10, +(t.side === 'H'), +(I.heightOf(t) > 0), t.hp / t.maxhp, I.wound(t),
    +I.busy(t), +(t.state === 'flee'), +easy, +(t.target === u),
    lg(ts / my) / 2, Math.log1p(g / my), +(g >= 1.2 * my), Math.min(5, I.packMates(w, u)) / 3, Math.min(6, alive) / 3, Math.min(6, onT) / 3,
    Math.min(3, onMe), u.hp / u.maxhp, I.wound(u), u.stam, u.morale, Math.min(1.4, u.heat), u.hunger, +(u.dartT <= 0),
    w.t / 300, I.pressure(w), zp, Math.max(-5, Math.min(30, edge)) / 10, +I.inWater(w, u), (u.s.prey && u.s.prey.human) || 0,
    +(I.sp(u.s) === 'hyena'), ...TERR.map(k => +(w.T.id === k)), ...I.INTENTS.map((_, k) => +((u.intent || 0) === k))];
}
module.exports = { NAMES, DIM, extract };
