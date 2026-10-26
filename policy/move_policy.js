// Milestone 3: requiring this registers the movement-intent chooser with the engine (A._internals.moveChoose). A fight
// uses it when cfg.movePolicy = {<archetype>: weights} (see move_model.js, move_arch.js). Optional sink on the cfg (never
// changes the fight): cfg.moveStats = {} -> per-archetype decision counts per intent, e.g. {harrier: [n_commit, ...]}.
const path = require('path');
const A = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'));
const M = require('./move_model.js');
const { arch: archOf } = require('./move_arch.js');
function moveChoose(w, u, t, d, P, arch){
  const a = P.fixed !== undefined ? P.fixed : P.rule ? RULES[P.rule](w, u, t, d) : M.act(P, archOf(arch).F.extract(w, u, t, d));
  const st = w.cfg.moveStats; if (st){ const c = st[arch] || (st[arch] = new Array(archOf(arch).nout).fill(0)); c[a]++; }
  return a;
}
// hand-written probe rules ({rule: name}), for headroom probes only (guard intents: 0 hold, 1 screen, 2 intercept,
// 3 space, 4 help, 5 fall back)
const I = A._internals;
const hTargeted = w => w.units.some(e => e.side === 'E' && I.active(e) && (e.target === w.human || e.latchOn === w.human));
const predOnH = w => w.units.some(e => e.side === 'E' && I.active(e) && e.s.pred && e.target === w.human);
const collateral = w => w.units.some(e => e.side === 'E' && I.active(e) && e.target && e.target !== w.human && I.dist(e, w.human) < 12 && (I.has(e, 'sweep') || e.s.gait === 'charge'));
const RULES = {
  spaceElseIntercept: w => hTargeted(w) ? 2 : 3,          // space out unless you're targeted, then intercept
  screenPred: w => predOnH(w) ? 1 : 0,                    // screen when a predator targets you, else the heuristic
  spaceIfCollateral: w => collateral(w) ? 3 : 0,          // step out when a sweeper / charger is fighting near you
  interceptIfTargeted: w => hTargeted(w) ? 2 : 0,         // intercept whatever is on you, else the heuristic
};
A._internals.moveChoose = moveChoose;
module.exports = { moveChoose, RULES, A };
