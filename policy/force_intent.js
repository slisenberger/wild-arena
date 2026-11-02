// Training / probes only (never bundled): lets a lookahead hold a unit's movement intent. Wraps the engine's intent chooser
// (move_policy.js): a unit with u.forceIntent set and w.t < u.forceIntentUntil gets that intent; everyone else is unchanged.
const path = require('path');
const A = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'));
require('./move_policy.js');
const I = A._internals;
if (!I.moveChoose.forced){
  const orig = I.moveChoose;
  I.moveChoose = function(w, u, t, d, P, arch){ return u.forceIntent !== undefined && w.t < u.forceIntentUntil ? u.forceIntent : orig(w, u, t, d, P, arch); };
  I.moveChoose.forced = true;
}
module.exports = {};
