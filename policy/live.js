// The learned policies the live game uses by default (Milestone 3). sim.js loads this in Node; build.js bundles it
// (with the policy modules and weights) into index.html for the browser. A fight uses them unless its cfg sets
// movePolicy itself or livePolicy:false (the training harness does, so its baseline stays the heuristic).
const path = require('path');
const A = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'));
require('./move_policy.js'); // registers the intent chooser with the engine
require('./policy.js'); // registers the learned target choosers (milestone 4: herbivore archetypes through chooseHerb)
// policy/weights/live.json names the shipped weights per archetype (harrier = enemy wolves and hyenas, guard = your guards,
// cat / charger / bulldozer / brawler / kicker = the rest of the other side)
const SHIP = require('./weights/live.json');
// "target" = learned target choice per archetype (milestone 4; on top of that archetype's movement policy), e.g. chargers
for (const [arch, file] of Object.entries(SHIP)) if (arch[0] !== '_' && arch !== 'target') A._internals.LIVE[arch] = require('./weights/' + file);
if (A._internals.LIVE_TARGET) for (const [arch, file] of Object.entries(SHIP.target || {})) A._internals.LIVE_TARGET[arch] = require('./weights/' + file);
module.exports = A._internals.LIVE;
