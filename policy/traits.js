// Species trait vector (milestone 4, policy/SPECIATION.md): the body a species fights with, so one network per archetype
// can tell a cougar from a lion coalition and learn species-specific styles. Fixed per species (from the roster in sim.js),
// cheap to append to any feature vector; groups (packs, herds) add their size. The vector can grow: add a name to NAMES and
// its value to traits().
const path = require('path');
const A = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'));
const GAITS = ['stalk', 'rush', 'orbit', 'charge', 'lumber', 'keepaway', 'lunge'];
const TAGS = ['pack', 'latch', 'ambush', 'bluff', 'sweep', 'giant', 'fearless', 'waterbound', 'hatesPredators', 'herd'];
const NAMES = ['logMass', 'spd', 'stam', 'logDps', 'armor', 'reach', 'strikeH', 'mountH', 'swim', 'vision', 'aggr', 'flee', 'corner',
  'pred', 'charge', 'climb', 'pounce', 'bluffP', 'group', ...GAITS.map(g => 'gait_' + g), ...TAGS.map(t => 'tag_' + t)];
const DIM = NAMES.length;
// v2 (P.traitsV = 2, new nets only; shipped nets keep v1 byte for byte): + the signature tags that bear on whom an animal goes
// for, so a species-aware scorer can tell a buffalo (vindictive, lionKiller) from a bison, or a musk ox ring from a lone charger.
// Tags this engine doesn't have read 0.
const SIG = ['vindictive', 'lionKiller', 'standsGround', 'territorial', 'scavenger', 'blindCharger', 'bred', 'chasesMovement',
  'catSense', 'guardian', 'bigGame', 'tester', 'lookout', 'riderSnatcher', 'boneCrush', 'upends', 'stomp', 'placid',
  'ring', 'facesDown', 'shoreGuard', 'snowPlough', 'usurps', 'pinDown', 'tuskStab', 'forestRunner'];
const NAMES2 = [...NAMES, ...SIG.map(t => 'sig_' + t)], DIM2 = NAMES2.length;
const cache = {}, cache2 = {};
function traits(s){
  if (cache[s.id]) return cache[s.id];
  const tags = new Set(s.tags || []);
  const v = [Math.log(s.mass) / 9, s.spd / 20, Math.min(1, (s.stam || 0) / 40), Math.log1p((s.dmg || 0) / Math.max(.3, s.cd || 1)) / 6,
    s.armor || 0, (s.reach || 0) / 4, (s.strikeH || 0) / 5, (s.mountH || 0) / 3.5, (s.swim || 0) / 5, (s.vision || 0) / 60,
    s.aggr || 0, s.flee || 0, (s.corner || 1) - 1, +!!s.pred, +!!s.charge, +!!s.climb, (s.pounce || 0) / 12,
    s.bluffP === undefined ? (tags.has('bluff') ? 1 : 0) : s.bluffP, Math.min(6, s.group || 1) / 6,
    ...GAITS.map(g => +(s.gait === g)), ...TAGS.map(t => +(tags.has(t) || (t === 'latch' && !!s.latch)))];
  if (v.length !== DIM || v.some(x => !Number.isFinite(x))) throw new Error('traits: bad vector for ' + s.id);
  return (cache[s.id] = v);
}
// traitsV(s, v): v 2 = v1 + the SIG block; anything else = v1 (the same array traits() returns)
function traitsV(s, v){
  if (v !== 2) return traits(s);
  if (cache2[s.id]) return cache2[s.id];
  const tags = new Set(s.tags || []);
  return (cache2[s.id] = traits(s).concat(SIG.map(t => +(tags.has(t) || !!s[t]))));
}
const dimV = v => v === 2 ? DIM2 : DIM;
module.exports = { NAMES, DIM, traits, GAITS, TAGS, SIG, NAMES2, DIM2, traitsV, dimV };
if (require.main === module){ // node policy/traits.js: print the vector per species
  for (const s of A.ANIMALS) console.log(s.id.padEnd(12), traits(s).map(x => x.toFixed(2)).join(' '));
  console.log(`${DIM} traits: ${NAMES.join(', ')}`);
}
