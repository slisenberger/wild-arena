// ?smart=1 prototype (owner playtest): learned target choice from milestone 4, as one cfg.policy for a fight. Networks only
// (owner, Oct 28: nothing may need in-game loading, so no lookahead at play time): enemy chargers use charger_target_m1
// (fresh +0.239 ± 0.036), your guards guard_target_m3 (fresh +0.129 ± 0.021), enemy cats cat_target_e1 (expert iteration with a
// 20-s lookahead teacher, rich inputs, gain regression: fresh +0.090 ± 0.030, style 1.00), enemy brawlers brawler_target_e1 (expert iteration with
// rich inputs and gain regression: fresh +0.094 ± 0.030, style 1.00). Off unless the page asks; without it every fight is the shipped game.
require('./policy.js'); // registers the target choosers with the engine
const W = n => { const w = require(n); const {meta, ...p} = w; return p; };
function smartPolicy(){ return {byArch: {cat: W('./weights/cat_target_e1.json'), charger: W('./weights/charger_target_m1.json'), brawler: W('./weights/brawler_target_e1.json'), guard: W('./weights/guard_target_m3.json')}}; }
module.exports = smartPolicy;
if (typeof window !== 'undefined') window.ArenaSmart = smartPolicy;
