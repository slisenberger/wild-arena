// Milestone 3, the cat-specific intent set (sim.js CAT_INTENTS: commit / pounce / creep / abandon / soften / cover /
// blindside): observation for one engaged big cat on the other side. The archetype vector (move_arch_features.js, 61)
// followed by what a stalking cat decides on: distance in pounce ranges, within 1.3× pounce range, whether the target
// is heading at me / I'm behind it / it can see me / it's after me, its speed, cover (a trunk within 10 m), softer prey
// (how much softer the best alternative within 25 m is, whether that's you, how guarded you are), time since my last
// strike and whether anything is after me (the ambush comes back after ~8 s out of the action with nothing after it),
// sabre-tooth state (broken canine, letting a stabbed target bleed), the species, and my previous cat intent.
// Pure: nothing here mutates the fight or consumes its rng (canSee, guardsAround, predCandidates, catSoftness are pure).
const path = require('path');
const A = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'));
const I = A._internals;
const X = require('./move_arch_features.js');
const CAT_INTENTS = I.CAT_INTENTS || []; // (|| []: loadable against an engine without the cat intents)
const SPECIES = ['tiger', 'lion', 'jaguar', 'cougar', 'leopard', 'smilodon'];

const CAT = ['dPounce', 'in13', 'tHeadsMe', 'behind', 'tSeesMe', 'tSpeed', 'treeNear', 'treeDist', 'softGain', 'softExists',
  'softHuman', 'hGuardLog', 'hDist', 'tSoft', 'atkIdle', 'chased', 'hasAmbush', 'climber', 'fangBroken', 'bleeding',
  ...SPECIES.map(s => 'sp_' + s), 'coalition', ...CAT_INTENTS.map(k => 'prevC_' + k)];
const NAMES = [...X.NAMES, ...CAT];
const DIM = NAMES.length;
const cl = (v, a, b) => Math.max(a, Math.min(b, v));

function extract(w, u, t, d){
  const x = X.extract(w, u, t, d), s = u.s, P = s.pounce || 5, H = w.human;
  const h = I.headingOf(t), rx = (u.x - t.x) / (d || 1), ry = (u.y - t.y) / (d || 1), cosMe = h ? rx * h.x + ry * h.y : 0;
  let td = 99; for (const tr of w.trees) td = Math.min(td, Math.hypot(tr.x - u.x, tr.y - u.y) - tr.r);
  const st = I.catSoftness(w, u, t), alt = I.catSofter(w, u, t);
  const my = I.packStrength(w, u), hOk = H && I.active(H);
  let chased = 0; for (const o of w.units) if (o !== u && o.target === u && I.active(o)){ chased = 1; break; }
  const sp = I.sp(s);
  x.push(Math.min(4, d / P) / 2, +(d <= P * 1.3), cosMe, +(cosMe < -.5), +I.canSee(w, t, u), Math.min(20, Math.hypot(t.vx, t.vy)) / 10,
    +(td < 10), Math.min(30, Math.max(0, td)) / 10, alt ? cl(Math.log(I.catSoftness(w, u, alt) / Math.max(1e-6, st)), 0, 3) : 0, +!!alt,
    +!!(alt && alt.side === 'H'), hOk ? Math.log1p(I.guardsAround(w, H, u) / my) : 0, hOk ? Math.min(60, I.dist(u, H)) / 30 : 2,
    cl(Math.log(Math.max(1e-6, st)), -3, 3) / 2, cl(-u.atk / 8, 0, 1.5), chased, +!!I.has(u, 'ambush'), +!!s.climb, +!!u.fangBroken, +((u.backT || 0) > 0),
    ...SPECIES.map(k => +(sp === k)), +((s.group || 1) > 1), ...CAT_INTENTS.map((_, k) => +((u.intent || 0) === k)));
  return x;
}
module.exports = { NAMES, DIM, CAT, SPECIES, extract };
