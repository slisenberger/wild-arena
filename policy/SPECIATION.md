# Milestone 4: speciation from open control (design, Oct 27)

Owner direction: broad archetypes + species tuning + open control over every decision + a general reward should make
each species develop its own realistic fighting style. This note is the plan; nothing here is built yet.

## Where decisions live today (sim.js)
| Decision | Who decides | Hook |
|---|---|---|
| Enemy predator's target (or feed / roam) | `predatorTarget` formula: meat x vulnerability / deterrence | `cfg.policy` (milestone 2, opt-in), candidates from `predCandidates` |
| Enemy herbivore's target | `herbivoreTarget`: engage radius, agitation, drive | none |
| Guard's target | `guardThreat` ranking; only the intercept/help intents can switch | partial, via `cfg.movePolicy.guard` |
| How to approach the chosen target | gait code; learned intent every 0.5 s (commit, wait, flank, regroup, disengage) | `cfg.movePolicy[arch]` (milestone 3) |
| Bluff vs real charge; pounce; break off | fixed rules (`bluffP`, pounce range, morale) | none |

## Target design
1. **One decision per unit, every ~0.5 s: (target, intent).** Options = each candidate target (the `predCandidates`
   filters for every unit, herbivores and guards included) x each intent, plus "no target" (roam / hold / feed). The
   network scores each option; the engine keeps all physics: speed, reach, stamina, armor, morale, line of sight.
2. **New intents** that today are engine rules: bluff (display / mock charge), break off a spotted stalk and
   reposition, hold in cover until a guard is busy. They map onto existing engine moves where possible.
3. **Inputs** = per-candidate target features (`policy/features.js`, 63: isMount, logStrVsSelf, busyElsewhere,
   fleeing, hpFrac, guardRatio, ...) + the unit's movement features (`policy/move_arch_features.js`, 61) + new:
   - species/trait vector: mass, top speed, sprint stamina, weapon type, armor, pierce, reach, strikeH, pack/solo, swim;
   - matchup: my weapon vs its armor, my reach vs its height, it counters me (yieldsTo), its current target;
   - context: human HP, guards within 15 m of the human, the human's mount.
4. **Model**: one network per archetype, shared across its species (species enter through the trait vector), option
   scorer `score(option) = MLP([unit, candidate, intent one-hot])`, softmax during training, argmax when shipped.
5. **Reward**: the side's checkmate goal (attack) or the guard goal (protect) + self-preservation (own deaths, sized
   per archetype from the spec's risk tolerance).
6. **Training**: (a) behaviour-clone the current heuristic + shipped intents until it matches (milestone 1 reached
   99%), so the start = today's game; (b) PPO on per-decision log-probs with the episode's goal as return, a KL
   penalty to the cloned policy, and the spec's per-species ranges and never-gates as constraints (Lagrangian, as now).
   ES stays for the small linear policies; it does not scale to this many parameters.
7. **Success metric: a speciation report.** Per species: does learned behaviour move away from the heuristic in the
   directions the reviewed spec sources (cougars quit spotted stalks sooner than lion coalitions; moose renew attacks
   on a downed target, white rhinos don't; wolves commit on fleeing prey), plus the goal on held-out fights and the
   human's survival and time alive.

## Pilot notes
- tgt1 (Oct 27): the 'target-lin' scorer only reaches predators (cat, brawler, harrier): kickers and bulldozers
  (herbivores) pick targets in `herbivoreTarget`, so their --target runs were no-ops and were stopped. Phase 1 must add a
  herbivore (and guard) target hook before those archetypes can learn whom.

## Phases (each measured before the next)
1. Plumbing: joint (target, intent) hook for every archetype, zero/heuristic policy byte-identical to today
   (`check_identical.js`), features + trait vector, harness tests.
2. Behaviour cloning: agreement with the heuristic on held-out decisions; paired fights within noise.
3. PPO pilot on cats (weakest today: 60% of approaches fail, ~1.1 deaths per fight of ~1.7 cats): goal, survival,
   realism, speciation lines for tiger / lion / cougar / leopard / jaguar / smilodon.
4. All archetypes on GCP; joint evaluation with every policy live; reprice.
