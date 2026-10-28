// ?smart=1 prototype (owner playtest): every learned target choice from milestone 4 at once, as one cfg.policy for a fight.
// Enemy cats plan by lookahead (plan.js); enemy chargers use charger_target_m1 (fresh +0.239 ± 0.036); your guards use
// guard_target_m3 (fresh +0.129 ± 0.021). Off unless the page asks for it; without it every fight is the shipped game.
require('./policy.js'); // registers the target choosers with the engine
const PL = require('./plan.js');
const W = n => { const w = require(n); const {meta, ...p} = w; return p; };
function smartPolicy(o){ return {byArch: {cat: PL.makePlanner(o), charger: W('./weights/charger_target_m1.json'), guard: W('./weights/guard_target_m3.json')}}; }
module.exports = smartPolicy;
if (typeof window !== 'undefined') window.ArenaSmart = smartPolicy;
