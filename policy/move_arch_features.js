// Milestone 3, the other side's non-harrier archetypes (cat, charger, bulldozer, brawler, kicker): observation for one
// engaged unit choosing a movement intent. The harrier vector (move_features.js, unchanged so harrier weights still
// load) followed by gait-relevant inputs: charge / pounce readiness and room, ambush ready, whether it can reach the
// target (a rider up on a giant), mass ratio, same-species allies (herd members, a lion coalition), grudge, agitation,
// battle drive, the target sweeping or charging, and a few species flags. Pure: nothing here mutates the fight or
// consumes its rng.
const path = require('path');
const A = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'));
const I = A._internals;
const H = require('./move_features.js');

const EXTRA = ['chargeReady', 'chargeRoom', 'pounceReady', 'inPounce', 'ambushReady', 'tReachable', 'tMassLog', 'logMass',
  'isPred', 'fearless', 'kinAlive', 'kin15', 'kinOnT', 'grudge', 'agit', 'drive', 'tSweeper', 'tCharging', 'tLocked', 'tBig'];
const NAMES = [...H.NAMES, ...EXTRA];
const DIM = NAMES.length;
const cl = (v, a, b) => Math.max(a, Math.min(b, v));
const lg = x => Math.log(Math.max(1e-6, x));

function extract(w, u, t, d){
  const x = H.extract(w, u, t, d), s = u.s, P = s.pounce || 5;
  let kin = 0, kin15 = 0, kinT = 0;
  for (const o of w.units){
    if (o === u || o.side !== u.side || !I.active(o) || I.sp(o.s) !== I.sp(s)) continue;
    kin++; if (I.dist(o, u) < 15) kin15++; if (o.target === t) kinT++;
  }
  x.push(+(u.chargeCd <= 0), +(d > 5 && d < 32), +(u.pounceCd <= 0), +(d <= P), +!!u.ambushReady,
    +(I.heightOf(t) <= s.strikeH), cl(lg(t.s.mass / s.mass) / 2, -2, 2), Math.log10(Math.max(1, s.mass)) / 2,
    +!!s.pred, +!!I.has(u, 'fearless'), Math.min(6, kin) / 3, Math.min(6, kin15) / 3, Math.min(6, kinT) / 3, +(u.grudge === t), cl(u.agit || 0, 0, 2),
    I.drive(u), +!!I.has(t, 'sweep'), +!!(t.mv && t.mv.k === 'charge'), +I.locked(t), +(t.s.mass >= 2000));
  return x;
}
module.exports = { NAMES, DIM, EXTRA, extract };
