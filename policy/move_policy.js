// Milestone 3: requiring this registers the movement-intent chooser with the engine (A._internals.moveChoose). A fight
// uses it when cfg.movePolicy = {<archetype>: weights} (see move_model.js). Optional sink on the cfg (never changes the
// fight): cfg.moveStats = {} -> per-archetype decision counts per intent, e.g. {harrier: [n_commit, n_wait, ...]}.
const path = require('path');
const A = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'));
const F = require('./move_features.js');
const M = require('./move_model.js');
function moveChoose(w, u, t, d, P, arch){
  const a = P.fixed !== undefined ? P.fixed : M.act(P, F.extract(w, u, t, d));
  const st = w.cfg.moveStats; if (st){ const c = st[arch] || (st[arch] = new Array(M.NOUT).fill(0)); c[a]++; }
  return a;
}
A._internals.moveChoose = moveChoose;
module.exports = { moveChoose, A };
