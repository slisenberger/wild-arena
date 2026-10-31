// Milestone 4: copy a fight mid-way, so a decision can be tried several ways and each branch played forward (lookahead
// search: a teacher for target choice, and a test of how much better choices are worth). The world is plain data except its
// random generator (w.R), whose state sim.js's rng exposes (state / seek). The copy drops the event log (not needed to play
// on) and shares the read-only cfg weights; its policy sinks (stats, trace, log) are off.
const path = require('path');
const A = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'));
function cloneWorld(w, cfgOver){
  const R = w.R, cfg = w.cfg, ev = w.events;
  w.R = null; w.cfg = null; w.events = [];
  let c; try { c = structuredClone(w); } finally { w.R = R; w.cfg = cfg; w.events = ev; }
  c.R = A.rng(1); c.R.seek(R.state());
  c.cfg = Object.assign({}, cfg, {policyStats: null, policyTrace: null, policyLog: null, pickLog: null}, cfgOver || {});
  return c;
}
module.exports = { cloneWorld };
