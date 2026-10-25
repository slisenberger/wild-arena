// Decision interface for an enemy predator's retarget, and a fixed-length feature vector per option.
// Options (in this order; ties at inference go to the earlier one):
//   0: none  (no target: roam)
//   1: feed  (only when the heuristic could feed: wild mode, hunger > .3, a carcass within 35 m with meat left)
//   then every candidate target predatorTarget would consider (sim's predCandidates: hostile, seen or the human
//   within 70 m, the waterbound rule, reachable height), in w.units order.
// All sim logic comes from the engine's own helpers (A._internals); nothing here consumes the fight's rng.
const path = require('path');
const A = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'));
const I = A._internals;
const TERR = ['savanna', 'river', 'forest', 'tundra'];

const TYPE = ['isNone', 'isFeed', 'isTarget'];
const TGT = ['dist', 'logDist', 'logMassRatio', 'logMass', 'appetite', 'logStrVsPack', 'logStrVsSelf', 'muchStronger',
  'hpFrac', 'isHuman', 'isPlayerAnimal', 'isFeud', 'humanAppetite', 'guardLog', 'guardRatio', 'busyElsewhere',
  'fleeing', 'latchedBy', 'stunned', 'heatstroke', 'heightRatio', 'rival', 'yieldsTo', 'giant', 'packOn', 'packOnAny',
  'isMine', 'grudge', 'grudgeNear', 'visible', 'inWater', 'isMount'];
const FEED = ['feedLog', 'feedDist', 'feedMeat'];
const CTX = ['hunger', 'hpFrac', 'morale', 'aggr', 'stam', 'heat', 'packMates', 'preyHuman', 'fearless', 'waterbound',
  'pack', 'scavenger', 'inWater', ...TERR.map(t => 'map_' + t), 'allout', 'time', 'pressure', 'packBoost', 'wound', 'nCand'];
const NAMES = [...TYPE, ...TGT, ...FEED, ...CTX];
const DIM = NAMES.length;
const lg = x => Math.log(Math.max(1e-6, x));

// the options at this decision, plus the feed carcass when feeding is possible
function options(w, u){
  const opts = [{kind: 'none'}];
  if (w.mode === 'wild' && u.hunger > .3){ const c = I.bestCarcass(w, u); if (c.c) opts.push({kind: 'feed', c: c.c, score: c.score}); }
  for (const t of I.predCandidates(w, u)) opts.push({kind: 'target', t});
  return opts;
}

function context(w, u, nCand){
  const own = I.strength(u), my = I.packStrength(w, u);
  const c = [u.hunger, u.hp / u.maxhp, u.morale, u.s.aggr, u.stam, Math.min(1.5, u.heat), Math.min(3, I.packMates(w, u)) / 3,
    lg((u.s.prey && u.s.prey.human) || 1), +I.has(u, 'fearless'), +I.has(u, 'waterbound'), +I.has(u, 'pack'), +I.has(u, 'scavenger'),
    +I.inWater(w, u), ...TERR.map(t => +(w.T.id === t)), +(w.mode === 'allout'), w.t / 300, I.pressure(w), lg(my / own) / 2, I.wound(u),
    Math.min(8, nCand) / 8];
  return {c, own, my};
}

function targetFeats(w, u, t, own, my){
  const d = I.dist(u, t), ts = I.strength(t), isH = t.side === 'H', expo = .3 + .4 * u.hunger;
  const g = I.guardsAround(w, t, u) / my;
  let packOn = 0;
  if (I.has(u, 'pack')) for (const o of w.units) if (I.packMate(u, o) && o.target === t && I.dist(o, u) < 25) packOn++;
  const rv = u.s.rivals && u.s.rivals[I.sp(t.s)];
  return [d / 50, Math.log1p(d / 30), lg(t.s.mass / u.s.mass) / 3, lg(t.s.mass) / 8, expo * lg(t.s.mass) / 4, lg(ts / my) / 2, lg(ts / own) / 2,
    +(ts > my * 2.5), t.hp / t.maxhp, +isH, +(t.side === 'P'), +(t.side === 'E'), isH ? lg((u.s.prey && u.s.prey.human) || 1) : 0,
    Math.log1p(.45 * g), Math.min(5, g) / 5, +(t.side === 'P' && !!t.target && t.target !== u && I.busy(t)),
    +(t.state === 'flee'), +!!t.latchedBy, +(t.stun > 0), +!!t.heatstroke, I.heightOf(t) / Math.max(.5, u.s.strikeH), rv ? lg(rv) : 0,
    +I.yieldsTo(w, u, t), +(t.s.id === 'elephant' || I.has(t, 'giant')), Math.min(3, packOn) / 3, +(packOn > 0),
    +(u.target === t), +(u.grudge === t), +(u.grudge === t && d < 8), +I.canSee(w, u, t), +I.inWater(w, t), +!!t.rider];
}

// {opts, X}: X[i] is the feature vector (length DIM) of option i
function extract(w, u){
  const opts = options(w, u);
  const nCand = opts.filter(o => o.kind === 'target').length;
  const {c, own, my} = context(w, u, nCand);
  const zT = new Array(TGT.length).fill(0), zF = new Array(FEED.length).fill(0);
  const X = opts.map(o => {
    if (o.kind === 'none') return [1, 0, 0, ...zT, ...zF, ...c];
    if (o.kind === 'feed'){ const d = Math.hypot(o.c.x - u.x, o.c.y - u.y); return [0, 1, 0, ...zT, lg(o.score) / 2, d / 35, Math.min(1, o.c.meat / 500), ...c]; }
    return [0, 0, 1, ...targetFeats(w, u, o.t, own, my), ...zF, ...c];
  });
  return {opts, X};
}

// what the hand-tuned heuristic in chooseTarget would pick, as an index into opts (mirrors chooseTarget exactly)
function heuristicIndex(w, u, opts){
  const h = I.predatorTarget(w, u);
  if (w.mode === 'wild' && u.hunger > .3){
    const c = I.bestCarcass(w, u);
    if (c.c && c.score > h.score * 1.0) return opts.findIndex(o => o.kind === 'feed');
  }
  if (h.score * (.4 + u.s.aggr) > .3 && h.t){ const i = opts.findIndex(o => o.kind === 'target' && o.t === h.t); if (i < 0) throw new Error('heuristic target not among candidates'); return i; }
  return 0;
}

module.exports = { NAMES, DIM, TERR, options, extract, heuristicIndex };
