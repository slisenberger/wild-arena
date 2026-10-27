// The learned policies the live game uses by default (Milestone 3). sim.js loads this in Node; build.js bundles it
// (with the policy modules and weights) into index.html for the browser. A fight uses them unless its cfg sets
// movePolicy itself or livePolicy:false (the training harness does, so its baseline stays the heuristic).
const path = require('path');
const A = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'));
require('./move_policy.js'); // registers the intent chooser with the engine
A._internals.LIVE.harrier = require('./weights/harrier_v1.json'); // enemy wolves and hyenas: regroup before going in
A._internals.LIVE.guard = require('./weights/guard_v1.json');     // your guards: pile in to help the most hurt ally
A._internals.LIVE.cat = require('./weights/cat_v1.json');         // enemy big cats: creep in closer before committing
module.exports = A._internals.LIVE;
