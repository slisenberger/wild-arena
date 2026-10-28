# Milestone 4: speciation from open control (design, Oct 27)

Owner direction: broad archetypes + species tuning + open control over every decision + a general reward should make
each species develop its own realistic fighting style. This note is the plan; the pilot notes below say what is built.

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

- Built (Oct 27, branch m4/guard-target): target hooks for all three sides of the decision: enemy predators (`cfg.policy.byArch`,
  `predCandidates`), enemy herbivores (`herbCandidates`, `chooseHerb`) and your guards (`guardCandidates`, `chooseGuard`,
  `policy/guard_features.js`: 78 features incl. the enemy's species trait vector). Zero weights reproduce the shipped game
  byte for byte, every live policy on (`policy/target_ident_test.js`). tgt3 (GCP) trains guard targeting with ES.
- Linear scorers can't speciate: a feature that is the same for every option (the unit's own context, its species) adds
  the same amount to every score and cancels. `target-mlp` (`policy/target_model.js`) puts the unit's trait vector through
  a hidden layer with the candidate's features, so a cougar and a lion coalition can weigh the same prey differently. Zero
  output layer = heuristic; trained by PPO (`ppo_target.js --nh=16`), exact gradient (checked numerically).
- PPO sampling temperature: at tau 1 the sampled policy deviated from the heuristic on 55% of decisions (noise swamps the
  paired advantage); tau = margin / 2 = .125 gives ~14%.

- Results, first target-choice rounds (Oct 27; ES = train.js, held-out test on 1,200 fights vs zero weights):
  chargers ch_t_s1 **+0.143 ± 0.030**, clean (style 1.00); cats on cat_v1 +0.055 ± 0.026 but fail the stillLong gate;
  brawler +0.061 ± 0.033, bulldozers +0.036 / −0.003, guards +0.024 / +0.028 (within noise); kickers and old-engine cats: no
  update beat zero weights. Target choice has leverage for chargers (a charge spent on the right animal), little so far for others.
- PPO pilot (ppo1: cats linear/MLP, beta .1/.5; guard and charger MLP): every test within noise (−0.001 to +0.011). The
  learned policy barely moves (greedy deviation 1–4%; guards 0%), while ES's charger winner deviates far more. Diagnosis: one
  fight-level advantage spread over ~10k decisions (guards ~50k) is too weak a credit signal. Next for PPO: per-decision
  credit, e.g. paired branch fights that differ from the heuristic at a single sampled decision, or a learned value baseline.

- Species-aware charger (tgt5 ch_mlp_s1, target-mlp, ES): held-out +0.129 ± 0.034, fresh re-check +0.187 ± 0.035 (linear a1
  +0.158 ± 0.029; difference within noise so far); human survival 50.3% -> 43.7%, own deaths -0.13/fight.
- **Cats: where the headroom isn't (Oct 27, probes/cat_diag.js, cat_approach.js, cat_target_rules.js; live game, cat_v1 on).**
  - Cats do ~1/10 of chargers' damage to your side (65-210 per fight vs 700-1,900; tiger 736 per minute alive, bison herd
    3,400). 50-74% of enemy cats die, mostly to big herbivores on your side.
  - They have real target choices (53 decisions per fight, 67% with 2+ targets), but 24 hand-set target rules (busy, hurt,
    beatable, unguarded, close, the charger winner's weights, small or big game, sticky, avoid much stronger, ...) are all
    within noise or worse. 'Go for big game' is −0.085 ± 0.042, and holding back costs −0.27.
  - Approaches: 16% land a hit; 52% end in a switch, the commonest being 'you -> a big guard near you' (35% of switches; the
    guard was not attacking the cat), then back again (12%). Sticking with you trips stillLong (waitForOpening circles), and
    switching sends it into a rhino. Being intercepted (hurt by someone other than its target) is the commonest harm (16%).
  - Reading: under today's movement, whom a cat targets has little leverage; the bottleneck is getting through your guards.
    The cat lever is likely joint (timing + target: go for you when your guards are busy elsewhere, together with the
    chargers), i.e. the joint target+intent decision with features of the guards around the human, not target choice alone.

- Afternoon (Oct 27), fresh re-checks on 1,200 probe fights (index 23) after held-out tests:
  - Chargers, species-aware (ch_mlp_s2): **+0.239 ± 0.036** (you survive 50.3% -> 41.6%, -27.5 s) -> charger_target_m1.
  - Your guards, species-aware (gd_mlp_s1): +0.044 ± 0.021 overall; on fights with your cat +0.084 ± 0.027 (you +5.1 pts,
    +12.3 s; your cats deal 424 -> 472, die 75% -> 77%) -> guard_target_m1. Learning all guards together helps your cat
    fights more than cat-only learning: the cat-only runs (tgt7/8/9, leash on or off, margin .05/.25, trust region 0/1/3)
    have found nothing so far (best = zero weights on every finished run).
  - Enemy cats with the guard situation (features_plus): two held-out passes (+0.083 ± 0.028, +0.084 ± 0.033) shrank to
    +0.042 ± 0.028 and +0.016 ± 0.032 on fresh fights. With ~16 cat runs, two 2-SE passes is about chance. Enemy cat target
    choice: none confirmed so far. Their learned direction (both runs): avoid stronger targets and strong free guards, prefer
    close / visible targets, rivals and feuds, go for you more when your guards are busy.
  - Your cats die ~75% of fights whatever they target: 46-68% of their time on big herbivores comes from guard_v1's help /
    intercept intent (the chooser now re-judges those). Refusing giants saves cats (78% -> 61% deaths) but costs you 4-5 pts.

- **Lookahead (Oct 27 night): cat target choice has real headroom.** At each enemy cat decision with 2+ targets, copy the fight
  (policy/lookahead.js), play each option 15 s, take the best (probes/cat_lookahead.js). Shared dice (oracle): +0.310 ± 0.067.
  Own dice per branch (fair): +0.195 ± 0.071 (300), **+0.207 ± 0.032 (1,200)**, +0.206 ± 0.070 (300, another draw); you
  survive 52.7% -> 44.7%, -21.7 s; cat deaths 0.98 -> 0.90; style 0.98, no gate. Behaviour: more stalk-pounces (2.4 -> 3.5 /min),
  damage 207 -> 287 per fight, more approaches that don't land (fruitless .65 -> .81). It changes 62% of picks with a choice;
  the heuristic picks the best branch 38%. So the earlier learners failed on credit (one fight result over ~50 decisions),
  not for lack of better targets.
  - Imitation (bc_target.js, target-mlp 16 hidden on 29k lookahead decisions): held-out regret 0.438 -> 0.339, but in play
    +0.016 ± 0.035 and gates fail (idle 5% -> 40%, you as target 20% -> 48%). A commitment window (hold a departure 4 / 10 s)
    doesn't fix it (-0.03 / -0.02): the net learned 'target the human' without the situations that make it pay. Labels are one
    noisy 15-s roll each. Next for imitation: denoise (several rolls per branch), DAgger, richer state.
  - Alternative: run the lookahead itself live (planning cats). Cost ~3 s of CPU per fight (one thread), i.e. ~1% of a
    5-minute real-time fight in the browser, and deterministic (the branch dice derive from the fight state), so replays and
    game links still work. Tools that run thousands of fights (pricing, board.js) get ~12x slower for fights with enemy cats.

## Phases (each measured before the next)
1. Plumbing: joint (target, intent) hook for every archetype, zero/heuristic policy byte-identical to today
   (`check_identical.js`), features + trait vector, harness tests.
2. Behaviour cloning: agreement with the heuristic on held-out decisions; paired fights within noise.
3. PPO pilot on cats (weakest today: 60% of approaches fail, ~1.1 deaths per fight of ~1.7 cats): goal, survival,
   realism, speciation lines for tiger / lion / cougar / leopard / jaguar / smilodon.
4. All archetypes on GCP; joint evaluation with every policy live; reprice.
