// Write a trained run's best weights as a shippable file (policy/weights/<name>.json, the format live.js loads).
// Usage: node policy/export_weights.js <state.json> <name> ["note on where it came from and how it tested"]
const fs = require('fs'), path = require('path');
const M = require('./move_model.js');
const [file, name, note] = process.argv.slice(2);
if (!file || !name) { console.error('usage: node policy/export_weights.js <state.json> <name> [note]'); process.exit(1); }
const s = JSON.parse(fs.readFileSync(file, 'utf8'));
const W = M.unflat(s.P0, s.best.theta, s.config.mode);
W.meta = {name, arch: s.config.arch, from: `${path.basename(path.dirname(file))} (${s.config.mode}${s.config.nh ? ', nh ' + s.config.nh : ''}), best ${s.best.from || 'after ' + s.best.gen + ' gens'}`,
  sim: s.simHash, goal: s.config.goal || 'per-archetype', spec: !!s.config.spec, note: note || '', exported: new Date().toISOString().slice(0, 10)};
const out = path.join(__dirname, 'weights', name + '.json');
fs.writeFileSync(out, JSON.stringify(W));
console.log(`wrote ${out}: ${s.config.arch}, ${W.nin} features, ${W.nout} intents, nh ${W.nh || 0}`);
