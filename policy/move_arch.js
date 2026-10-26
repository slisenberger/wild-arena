// Milestone 3: the archetype registry. Each archetype = the units it covers (A._internals.archetypeOf), its intents
// (index 0 = the heuristic), its feature extractor, and which fights it trains on.
//   harrier: the other side's pack hunters (orbit gait: wolf, hyena and their packs); intents commit / wait / flank /
//            regroup / disengage; fights where harriers are on the other side.
//   guard:   your side's animals that aren't carrying you (guard state or engaged); intents hold / screen / intercept /
//            space out / help ally / fall back; every fight with at least one guard on your side.
//   cat:     since the cat intents (Oct 26), its own set (see below); otherwise as the four that follow.
//   cat / charger / bulldozer / brawler / kicker: the rest of the other side by gait (sim.js archetypeOf: stalk + rush,
//            charge, lumbering herbivores, lumbering predators, keepaway; the croc stays heuristic). The harrier intents
//            (engine geometry per gait: INTENT_GEO), move_arch_features.js (the harrier vector + gait inputs), and fights
//            where at least one animal of that archetype is on the other side.
const path = require('path');
const A = require(process.env.SIM ? path.resolve(process.env.SIM) : path.join(__dirname, '..', 'sim.js'));
const I = A._internals;
const ARCH = {
  harrier: {F: require('./move_features.js'), intents: I.INTENTS,
    has: (board, team) => board.some(id => !team.includes(id) && A.BY_ID[id].gait === 'orbit')},
  guard: {F: require('./move_guard_features.js'), intents: I.GUARD_INTENTS || [], // (|| []: loadable against an engine without the guard hook)
    has: (board, team, mount) => team.some(id => id !== mount || (A.BY_ID[id].group || 1) > 1)},
};
// species -> archetype on the other side, from the engine's own rule (a stand-in unit on side E)
const enemyArch = id => I.archetypeOf({side: 'E', s: A.BY_ID[id]});
const SPECIES = {};
for (const name of ['cat', 'charger', 'bulldozer', 'brawler', 'kicker']){
  ARCH[name] = {F: require('./move_arch_features.js'), intents: I.INTENTS,
    has: (board, team) => board.some(id => !team.includes(id) && enemyArch(id) === name)};
  SPECIES[name] = Object.keys(A.BY_ID).filter(id => A.BY_ID[id].gait && enemyArch(id) === name);
}
// the cat gets its own intent set (sim.js CAT_INTENTS: commit / pounce / creep / abandon / soften / cover / blindside) and
// features (move_cat_features.js); its weights carry set: 'cat' so the engine reads intents 1-6 as cat intents. A cat
// policy without set (e.g. the generic {fixed: k} probes in probes/arch_rules.js) still uses the generic intents.
if (I.CAT_INTENTS) Object.assign(ARCH.cat, {F: require('./move_cat_features.js'), intents: I.CAT_INTENTS, set: 'cat'});
for (const a of Object.values(ARCH)) a.nout = a.intents.length;
// zero weights in an archetype's own shape (and intent set): the heuristic
function zerosFor(name, nh, margin){ const a = arch(name), P = require('./move_model.js').zeros(a.F.DIM, nh || 0, margin, a.nout); if (a.set) P.set = a.set; return P; }
function arch(name){ const a = ARCH[name || 'harrier']; if (!a) throw new Error('unknown archetype ' + name + ' (known: ' + Object.keys(ARCH).join(', ') + ')'); return a; }
module.exports = { ARCH, arch, enemyArch, SPECIES, zerosFor };
