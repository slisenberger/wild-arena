// Milestone 4 target hooks: zero 'target-lin' weights must reproduce the shipped game exactly (every live policy on), for a
// predator archetype (cat), a herbivore one (bulldozer) and guards (the base arm: the arch's shipped movement, no target scorer of its own); nonzero weights must change fights; sampling must log a trace.
//   node policy/target_ident_test.js [fights per archetype]
const TM = require('./target_model.js'), FR = require('./features_rich.js'), R = require('./move_run.js'), F = require('./features.js'), G = require('./guard_features.js');
require('./live.js');
const L = R.A._internals.LIVE, n = +process.argv[2] || 24;
let bad = 0;
for (const arch of ['cat', 'brawler', 'bulldozer', 'guard']){
  const D = arch === 'guard' ? G.DIM : F.DIM, Z = {kind: 'target-lin', v: 1, nin: D, margin: .25, wt: new Array(D).fill(0)};
  const N = Object.assign({}, Z, {wt: Z.wt.map((_, i) => Math.sin(i * 3.1) * .6)}), fs = R.fightSet('probe', 5, n, {arch, seed: 7, withLive: true});
  const Zm = TM.mlp(D + TM.TRAITS, 8, .25, 11, true); // a fresh MLP scorer: hidden weights random, output zero
  const Zr = Object.assign(TM.mlp((arch === 'guard' ? FR.DIM_G : FR.DIM_E) + TM.TRAITS, 8, .001, 13, true), {feat: 'rich', targetsOnly: true}); // the same over the rich inputs, targets only
  let same = 0, differs = 0, trace = 0, dec = 0;
  for (const f of fs){
    const a = R.runFight(f, {kind: 'target-none'}, arch), b = R.runFight(f, Z, arch), bm = R.runFight(f, Zm, arch), br = R.runFight(f, Zr, arch); if (bm.fp !== a.fp || br.fp !== a.fp) same -= 1e3; c = R.runFight(f, N, arch), d = R.runFight(f, Object.assign({}, N, {sample: true}), arch);
    same += a.fp === b.fp; differs += a.fp !== c.fp; trace += (d.trace || []).length; dec += b.intents[0] + b.intents[1];
  }
  const ok = same === fs.length && differs > 0 && trace > 0 && dec > 0; if (!ok) bad++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${arch}: zero weights (linear, a fresh MLP, a fresh rich targets-only MLP) identical ${Math.max(-1, same)}/${fs.length}, nonzero changes ${differs}, ${dec} decisions, sampled trace ${trace}`);
}
process.exit(bad ? 1 : 0);
