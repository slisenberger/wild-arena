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

- Expert iteration, round 2 (Oct 28): labels averaged over 3 fair rolls (ROLLS=3; the lookahead itself stays +0.195 ± 0.038).
  bc_cat3 (16 hidden, 22k decisions): **+0.134 ± 0.034** in play, you 56.3% -> 50.9%, but fails sprintRate (style 0.79; idle
  5% -> 33%). x0.7 output: +0.062 ± 0.031, style 0.83. + one DAgger round (9k decisions on the learner's own states): bc_cat4
  +0.057 ± 0.031, style 0.90, no gate; 48 hidden: +0.062 ± 0.032, same. Imitation plateaus at ~1/3 of the lookahead once
  realism holds; ES fine-tune from bc_cat3 under the style constraint is running (tgt12). Running the lookahead live
  (planning cats) keeps the whole +0.2 with clean style: waiting for the owner's call (?plan=1 prototype).
- Guards: guard_target_m2 replicates (tgt11: 4 of 5 seeds significant; m3 = 16 hidden: fresh +0.129 ± 0.021, cat fights +0.180).

- **Owner rule (Oct 28): nothing may need in-game loading.** The lookahead is a training-only teacher; only networks ship.
- **Fix (Oct 28): a lookahead-trained net may only re-rank targets (P.targetsOnly).** The lookahead never labels 'none', and
  its untrained score made cats idle 30-87% (every imitation gate failure). bc_cat3 with the fix: +0.054 ± 0.025, style 1.00
  (cat_target_bc3m, in the ?smart=1 build).
- Expert iteration on GCP with the fix (ei3b your cats, ei4 enemy cats; 6 rounds x 900 fights, DAgger): held-out tests
  +0.025 ± 0.017 and +0.032 ± 0.026 (round-to-round validation noise large; best-of-6 selection inflates val).
- Gain regression (bc_target.js --loss=adv: predict s_i - s_teach, switch only above a threshold kappa), 129k enemy-cat decisions:
  held-out gain 0.065 of 0.181 possible; in play kappa .02 +0.058 ± 0.027, .05 +0.040 ± 0.020, .1 +0.039 ± 0.016 (no drift).
  A network keeps ~1/4 of the lookahead's +0.2 so far.
- **Your cats: the inputs are the bottleneck.** On 217k decisions the gain regression learns nothing (mse flat, gain 0.003 of
  0.10); no guard-feature difference correlates with an option's gain above 0.017 (enemy cats: up to 0.17, isHuman, smaller
  targets). The lookahead's +0.203 for your cats rests on information the features don't carry (timing, geometry, who reaches
  whom, can it finish the target). Next: richer decision inputs (time to contact, hits to kill / be killed, facing / flank,
  the threat's ETA to you, who else is on the target), re-collect, retrain.

- Rich inputs (features_rich.js) + gain regression, ei5 (Oct 28): your cats' held-out gain still 0.001-0.008 of ~0.09, validation
  -0.04 to +0.03; enemy cats test +0.025 ± 0.029 (no better than bc3m); a local 80-fight check: strongest rich correlation .053
  (keep the current target), but a sticky rule changes 1% of picks (-0.009 ± 0.009). So far, per-option summary inputs don't
  carry what the lookahead uses for your cats. Next candidate: a state encoder (every animal's relative position, speed, HP,
  species traits and target links pooled into the option scorer), i.e. the dense-input network of the original milestone plan.
  Until then the best help for your cats is learning all guards together (guard_target_m2 / m3: +0.18-0.19 on cat fights).

- State encoder (set_model.js 'target-set', ei6, Oct 28): your cats' held-out gain 0.001-0.007 of ~0.10 (small and large
  encoders), validation -0.03 to +0.04; enemy cats 0.06 of 0.18, test +0.044 ± 0.028 (like the per-option nets). Adding the
  engine's hidden state (attack / charge / pounce readiness, morale, stamina, agitation, heat, slow, stun: feat 'richh') gives
  no correlate above .038 either. **Your cats: no network-learnable target signal found so far** with per-option, rich,
  hidden-state or whole-field inputs; the lookahead's +0.203 looks like averaging over chaotic close-quarters futures that
  the present state doesn't predict. Best available help for your cats stays learning all guards together (guard_target_m2/m3).

- Lookahead headroom for every enemy archetype (probes/arch_lookahead.js, 300 fresh fights, fair dice, 8 s): bulldozer
  +0.193 ± 0.056 (you 56.0% -> 49.0%, style .94), kicker +0.211 ± 0.065 (fails farHunt), brawler +0.257 ± 0.064 (you 53.7% ->
  43.7%, style 1.00); cats +0.207 ± 0.032. Better targeting is worth ~+0.2 for everyone; how much a network can learn varies
  (chargers by ES: +0.24 fresh; enemy cats ~+0.05; your cats ~0). Expert iteration for bulldozers and brawlers: sweep m4_expert_s7.

- Expert iteration ei7 (Oct 29, rich inputs + gain regression): **brawlers: brawler_target_e1, held-out +0.085 ± 0.032, fresh
  +0.094 ± 0.030, style 1.000, no drift** (you 53.2% -> 49.5%, -10 s); in the ?smart=1 build. Bulldozers: the network fits the
  branch gains best of all (0.186 of 0.271 held out) yet plays worse every round (-0.08 to -0.18, damage halved): what wins an
  8-s branch for a bulldozer (taking fewer hits) loses the fight; a longer horizon or a whole-fight score is the next try.
  (eval_arch fix: its zero baseline now always uses margin .25; a learned threshold of 0 had made the baseline pick 'none'.)

- ei8 (Oct 29): **enemy cats with a 20-s lookahead teacher: cat_target_e1, held-out +0.064 ± 0.031, fresh +0.090 ± 0.030, style
  1.000, no drift** (you 56.3% -> 52.6%; replaces cat_target_bc3m in ?smart=1). Brawler replication: held-out +0.101 ± 0.033,
  fresh +0.068 ± 0.031 (brawler_target_e1 stays). Bulldozers with a 20-s horizon: still worse every round (-0.10 to -0.29,
  damage per fight a third): the paradox isn't the horizon; bulldozers keep today's targets.

- ei9 (Oct 29): **your cats with a 20-s teacher: none found so far** (val +0.017 at best, held-out +0.009 ± 0.015, within noise;
  the 8-s teacher found nothing either). Enemy cats with a 30-s teacher: held-out +0.066 ± 0.030 (round 4 val +0.115 but failed
  stillLong), below cat_target_e1's +0.090, so e1 stays: a longer horizon past 20 s doesn't add. All-guard 20-s run still going
  (round 0 val +0.061; `gcp.js resume --only=` relaunches single runs).
  Its round 3 (val +0.169) exported as guard_target_e3 and checked head to head (guard_target_rules, ALL=1): 1,200 fresh fights
  (probe 23) e3 +0.184 ± 0.021 vs m3 +0.182 ± 0.022 (you survive +10.6 vs +10.7 pts); 800 cat fights (probe 65) e3 +0.192 ± 0.025
  vs m3 +0.180 ± 0.028. A tie: e3 deviates less (20% vs 27%) with style 1.00 and no drift, but doesn't beat m3, so m3 stays in
  ?smart=1. The 20-s teacher brings guards to where ES got them, not past it.
  Run finished: rounds 4-5 fell back (val +0.102, +0.093); its own held-out test of round 3 (= e3) +0.135 ± 0.020, you survive
  +7.5 pts. ei9 done; nothing replaces m3.

- **Speciation report (Oct 31, probes/speciation.js 600, ?smart=1 networks, decisions with 2+ options).** Where a network changes
  today's pick, which way (share onto you / off you, log mass and distance of the new target vs today's, predator or not):
  - Enemy cats speciated: cougar and leopard leave you (78%, 71% of their changes) for a closer (-5.5 m), bigger, often predator
    target; the jaguar goes onto you (67%) and onto smaller targets (log mass -1.42); the lion coalition onto you (48%); the tiger
    both ways but much closer (-9.7 m), the opportunist. (Cats change 20-35% of picks.)
  - Brawlers speciated: grizzly onto you (46%), polar bear off you (61%) onto bigger animals and predators, black bear mixed,
    honey badger barely changes (20%).
  - Chargers did not: every species changes ~45-60% of picks the same way (onto you ~30-40%, onto smaller animals, away from
    predators). One rule for the archetype; the buffalo avoids predators most (-0.56), against its realism (it mobs lions).
  - Your guards did not: every species changes ~30% of picks, all slightly toward hurt and bigger targets.
  Descriptive only (no SE per species; lion / buffalo / bison ~55-60 fights).
- ei10 (Oct 31): expert iteration for the archetypes never trained with the teacher: enemy wolves / hyenas (harrier) and kickers
  (plain, and with the realism-aware teacher real=1).

## Phases (each measured before the next)
1. Plumbing: joint (target, intent) hook for every archetype, zero/heuristic policy byte-identical to today
   (`check_identical.js`), features + trait vector, harness tests.
2. Behaviour cloning: agreement with the heuristic on held-out decisions; paired fights within noise.
3. PPO pilot on cats (weakest today: 60% of approaches fail, ~1.1 deaths per fight of ~1.7 cats): goal, survival,
   realism, speciation lines for tiger / lion / cougar / leopard / jaguar / smilodon.
4. All archetypes on GCP; joint evaluation with every policy live; reprice.

- **m4/speciation-2 (Oct 31), branched from main 348c5bf (live: charger_m1, guard_m2, cat_e1, brawler_e1):** the training
  tooling ported onto main: plan.js, lookahead.js, expert_iter.js, bc_target.js, set_model.js, dist.js / dist_helper.js
  (helper VMs), traits v2, gcp.js / vm_runner (resume --only / --commit, helpers), probes/speciation.js and
  guard_target_rules.js; policy.js keeps main's layout and gains the training-only hooks (target-look, target-set, 'richh',
  P.commit holds, cfg.pickLog); sim.js's rng gains state/seek (no change in play). Checks: target_ident_test (cat, brawler,
  bulldozer, guard) pass; ship_ident vs main: 400/400 identical with and without the live policies, and index.html in a vm
  40/40 identical to the Node modules; lookahead_test: 53/53 copied fights play on exactly like the original (new species
  included); every class (harrier, charger with traits v2, kicker, cat, guard, bulldozer, brawler) runs a smoke round.
  Training here uses main's live set (move_run adds the live target nets for the classes not being trained).

- **Stage 1, label reliability (Oct 31, sweep st1, main's live set, probes/label_reliability.js: 150 fights per class, 6 rolls
  per option split 3 / 3, H 8 s).** Split-half r of the gain vs today's pick (fair dice -> common random numbers), best option
  agreeing between halves vs chance:
  | class | r fair | r CRN | best agrees (chance) | mean abs gain / SE of a 3-roll gain |
  |---|---|---|---|---|
  | chargers | .61 | .66 | .59 (.32) | .31 / .20 |
  | enemy cats | .70 | .77 | .52 (.30) | .44 / .25 |
  | elephant group (bulldozers) | .62 | .64 | .61 (.31) | .29 / .18 |
  | your cats | .32 | .37 | .49 (.29) | .25 / .23 |
  Per species (fair): chargers .35 (boar) to .73 (triceratops); enemy cats .47 (jaguar, cougar) to .80 (tiger); your cats
  .19 (jaguar) to .44 (lion); elephant .73, gorilla .59, walrus .62, mammoth .37.
  - **Labels are not the bottleneck** for chargers, enemy cats and bulldozers: 60-77% of a 3-roll label's variance repeats,
    yet nets kept 1/7 (chargers, expert iteration), 1/4-1/2 (cats) and less than none in play (bulldozers). So the student
    (inputs, loss, capacity) or the play-vs-label gap is the bottleneck: per §5, next is a capacity test on the stored labels
    (bigger offline models), then the teacher-net / distillation path. The bulldozer paradox is not label noise either.
  - **Your cats have predictable signal** (r .32, best option repeats 49% vs 29% chance), just noisier; "no signal" was
    the students' inputs, not the labels. Worth one more try once a stronger student exists.
  - **CRN helps a little** (r +.02 to +.07, SE -5 to -24%), below the 30% bar but free: new runs use --crn.
- Old-base pilot ei10: **enemy wolves / hyenas (harrier) +0.070 ± 0.031 on 1,200 held-out fights, style 1.00, no gates**
  (round 1 of 6; you survive -3.1 pts). First class beyond 2 SE with no target net before; retraining on main (ei12).
  Kickers: none found so far (every round failed farHunt, with the realism-aware teacher too).
- **Student capacity and horizon (Oct 31, stored ei11 charger labels: 132k decisions, 20-s teacher, 3 rolls).** Gain regression
  with 32 hidden units: held-out gain 13.5% of the noisy-oracle gain, prediction error 0.93 vs label variance 0.92 (explains
  ~0%); 128 hidden: 15.0%, error 0.93. **Capacity isn't the limit.** Reliability at 20 s (probes/label_reliability.js, 40
  charger fights, index 2): r .43 fair / .44 CRN (at 8 s: .61 / .66), best option repeats 56% / 65% vs 33% chance. So a
  20-s label is less reliable than an 8-s one but still ~40% repeatable, while the per-option inputs predict ~none of it:
  the repeatable part depends on things the inputs don't carry. Expert iteration for chargers stays far below ES's +0.239
  (fight-level credit, which learns the ranking it needs without predicting branch gains). Next for chargers: ES on the
  species-aware net (traits v2) with the realism-band Lagrangian, warm from charger_target_m1; for the other classes the
  student, not the label, is what to change (inputs, ranking loss), or ES fine-tuning after expert iteration.
- **Harrier ship check (Oct 31, eval_target.js vs main's live set, 2 × 2,000 fresh fights):** ei12 on main (eim_harr,
  helpers) held-out +0.027 ± 0.028 (within noise; harrier_target_e1, not live). The old-base pilot harrier_target_p1 on main:
  probe 23 **+0.092 ± 0.025**, you -3.5 pts; probe 41 +0.019 ± 0.026 (within noise), you -0.6 pts; style 1.00, no gates,
  wolves/hyenas onto you 7% -> 23% of picks both times. Pooled about +0.055 ± 0.018, but draw 2 misses the 2 SE bar: not
  sent for shipping. Next: train harriers on main with ES fine-tuning from p1 (fight-level credit), then re-check.
- **Buffalo realism check validity:** the live charger_target_m1 fails mobsPred (with one of your predators within 15 m,
  share targeting a predator 0.576 -> 0.349; 1,000 fights, eval_target BASE=none), so the check catches the known flaw.
- **Realistic chargers, first try (Oct 31, es13 + ev14, open maps; ES from charger_target_m1 widened to traits v2, buffalo
  gates, refZero, 2 seeds × 60 gens).** No candidate beat m1 while passing the buffalo gates (candidates that kept m1's
  extra +0.07 to +0.105 kept failing mobsPred; clean ones were -0.03 to +0.02 vs m1). The final centres (v2a, v2b; not live),
  2,000 fresh fights each: vs today's heuristic v2a +0.120 ± 0.031 (fails mobsPred .571 -> .489) and +0.182 ± 0.031 (clean);
  v2b +0.134 / +0.143 but fails mobsPred on both draws (.47); vs live m1: v2a -0.011 ± 0.028, v2b +0.003 ± 0.029 (as strong
  as m1). Speciation report (600 fights, probe 71, merged main): with a predator in the picture, buffalo's changed picks
  shift away from predators -0.24 (m1: -0.53), buffalo herds -0.23 (m1: -0.55): half way back to today's heuristic, but the
  buffalo still avoids predators more than the bison (-0.07), so not yet the sourced difference. Not shipped.
  Next: more realism pressure in ES (higher λ ceiling / gate penalty for mobsPred, a per-species direction check: buffalo's
  'pred a-h' ≥ 0), or pricing realism into expert-iteration labels (research §2.2). (Fixed: speciation.js workers ignored
  --net, so its first ev14 reports showed m1.)
- **Owner rule (Oct 31): "realism can be violated ONLY IF it allows for the grounding assumption of animals know their team
  and ultimate objective (protect or kill the human)."** Kickers may hunt on offense: their farHunt gate is lifted for
  training (`--ungate=farHunt`, `RW.ungate`). Gates on physical ability and species signatures (charge rate, the honey
  badger's fearlessness, cat stalking geometry) stay, since those aren't choices the objective can justify. Open question
  for the owner: buffalo leaving lions alone to go for the human also serves the objective; does the rule lift the buffalo
  gate too? Until answered, the buffalo gate stays (es15).
- **Owner clarification (Oct 31): "I dont care about predatoe vs lion. I just am opining it doesnt violate game spirit the
  way disengaging does."** The buffalo-vs-lion tendency is allowed, not required: mobsPred / mobExposure are report-only now,
  and the realistic-charger runs (es13/es15/es17) were stopped; live charger_target_m1 is fine as it is. **The rule for
  training is: no disengaging.** Animals know their team and the objective; any choice that serves it is in spirit (kickers
  hunting you, buffalo ignoring lions to reach you), while idling, stalling, avoiding the fight or giving up is not. The
  engagement gates (idle, noContact, longIdle, stillLong, the quiet ending) are the ones that matter; species realism stays
  in the engine's physics and signature moves.
- **Owner framing (Oct 31): "everyone should engage the way they'd realistically would conditioned on being part of a hunting
  team against the human."** Species realism stays in training; it gives way only where it directly conflicts with going for
  the objective. Implemented in the realism telemetry (move_run.js): closing on you never counts against longChase, farHunt or
  farSprint, and the buffalo check counts only while the buffalo is not going for you (fighting your animals is helping).
  Re-check, 600 fights vs the heuristic: live charger_target_m1 still fails it (with one of your lions within 15 m and not
  going for you, a buffalo targets the lion .83 -> .26); live cat_target_e1 passes every gate (style 1.00).
- **cfg.objective prototype (Oct 31, owner: every enemy animal takes part in killing the human).** Kicker-only first version
  (floor .8 + 1.2·drive before the distance discount; 1,200 fights): kickers targeted you 10× more (giraffe 0.6% -> 7.6% of
  life, ostrich 0.2% -> 9.9%) but never came within 6 m, no change in score or survival. Trace: they picked you from ~50 m and
  switched to one of your animals within ~1.4 s (26 of 28). Tuned: floor applied after the distance discount (.45 + 1.0·drive,
  ×1.6 while already going for you), and while going for you an enemy herbivore turns only on what hits it, comes at it or
  blocks it within 8 m. Trace (60 fights): closest approach median 50 -> 25 m; 41 of 46 switches away are interceptions by your
  animals (realistic: the team's blockers get fought). Per-class measurement on maps2: sweep obj19.
- Kickers by ES (kick16, farHunt lifted, species-aware, from zero): none found so far (best stayed at today's targets).
  Harrier ES fine-tune from p1 (es15 harr_es1): best stayed at p1 through gen 56.
- **cfg.objective, per-class measurement (obj19, Nov 1 UTC, 1,200 maps2 fights per class, main #53, off -> on).** Share of an
  animal's life spent targeting you: gorilla .8 -> 6.1%, elephant 5.3 -> 8.2, mammoth 2.4 -> 5.3, walrus 1.7 -> 9.1; giraffe
  1.1 -> 22.1, ostrich .3 -> 36.2, giant kangaroo .1 -> 14.9; chargers already 11-27%, barely changed. Within 6 m of you and hits
  on you hardly move (kickers .3% -> .3%; your guards intercept them, the traced switches away are 41/46 interceptions);
  distance kept while engaged rises for kickers (ostrich 21 -> 28 m). Outcomes within noise: your survival -0.9 / -1.7 / -0.8
  pts (± 1.3-1.6), class goal +0.024 / +0.040 / +0.020 (± .03), quiet endings 1.4 -> 1.2% / 1.1 -> .9% / .9 -> .5%, longest
  no-damage stretch unchanged (median 6-7 s, p90 22-29 s). So every class now takes part in the attack by intent, with no
  measurable shift in balance and no more stalling. Harrier ES fine-tune (es15 harr_es1): nothing beat p1.
