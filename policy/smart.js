// ?smart=1 prototype (owner playtest): learned target choice from milestone 4, as one cfg.policy for a fight. Networks only
// (owner, Oct 28: nothing may need in-game loading, so no lookahead at play time): enemy chargers use charger_target_m1
// (fresh +0.239 ± 0.036), your guards guard_target_m3 (fresh +0.129 ± 0.021); enemy cats join once their network (trained
// to imitate the lookahead, offline) is significant and clean. Off unless the page asks; without it every fight is the shipped game.
require('./policy.js'); // registers the target choosers with the engine
const W = n => { const w = require(n); const {meta, ...p} = w; return p; };
function smartPolicy(){ return {byArch: {charger: W('./weights/charger_target_m1.json'), guard: W('./weights/guard_target_m3.json')}}; }
module.exports = smartPolicy;
if (typeof window !== 'undefined') window.ArenaSmart = smartPolicy;
