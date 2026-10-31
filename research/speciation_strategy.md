# Speciation strategy: two-sided training with realism vectors (design, Oct 31)

Owner goal: "Simultaneous speciation training of actors in this game on both attack and defense, using realism vectors to
also shape reward in addition to achieving the objective."

This note picks one architecture and one training scheme, says how realism vectors enter training, and lays out a staged
plan with cheap tests first. It builds on `research/network_components.md` (named inputs, species residuals, classes as
data, species specs, joint rounds, control ladder) and on the results in `policy/SPECIATION.md` and `policy/README.md`.
It is a design. Nothing here is built yet. **[S]** marks speculation, meaning nothing in our own results backs it yet.

## 0. The short version
- **Build:** joint **expert iteration** (search distillation) over all classes on both sides, with a **realism-regularized
  teacher**. The teacher is the fair lookahead we already have, scored as goal gain minus realism-band violations, and
  turned into **soft labels around a per-species behaviour prior** (piKL-style). Students are small per-class nets with a
  **species code** (traits + a learned residual + realism-vector numbers) that modulates the hidden layer (FiLM). Each net
  has factored heads: target, intent, and later signature timing.
- **Train both sides together in rounds** against a small **league** of past sets. Accept a class's update only if it
  passes its realism constraints, which are enforced by **per-species Lagrange multipliers updated between rounds**. Judge
  the result against fixed yardsticks (heuristic, live set). Ship once as a set, then reprice once.
- **Why this one:** per-decision branch labels are the only credit signal that has worked here (PPO failed, ES works only
  for small nets). Search distillation is the method behind AlphaZero and Expert Iteration. KL-regularized search toward a
  behaviour prior is the method that keeps strong play human-like (or, for us, animal-like).
- **The key insight for speciation:** optimizing only the goal *removes* species differences that don't pay. The chargers
  collapsed to one rule because the teacher's labels for buffalo and bison really are alike. Species-specific realism
  priors and constraints are what make species differ in sourced ways. Species conditioning in the net is necessary but
  not sufficient.

## 1. Recommendation and runners-up

### 1.1 Recommended: realism-regularized joint expert iteration (RR-JEI)
1. **Teacher (training only):** at sampled decisions of any class, copy the fight (`policy/lookahead.js`) and play each
   option for H s, with own-dice rolls (`policy/plan.js`). Everyone else plays the current nets. Each option gets:
   - a gain estimate Ĝ(a) ± SE from its rolls;
   - a realism-violation cost V(a), measured inside the branch against the species' realism bands. This generalizes
     today's `real` term, which only measures idleness and sprinting.
2. **Labels:** a soft target distribution per decision,
   `π*(a) ∝ π_prior,s(a)^α_s · exp((Ĝ(a) − λ_s·V(a)) / τ)`. Here π_prior,s is the species' behaviour prior: today's
   heuristic, sharpened or tilted by the realism vector (§2). α_s is a per-species prior weight. τ is set from the label
   noise (the larger the SE, the softer the label). This is piKL ([Jacob et al. 2022](https://arxiv.org/abs/2112.07544)):
   search regularized toward a behaviour prior keeps the gains while staying close to the prior's style.
3. **Students:** one net per class, shared across that class's species, conditioned on the species code (§4). It is
   trained by cross-entropy on π* plus a KL term to the previous round's net (a trust region). Training data comes from
   DAgger states, so the net learns on the states it reaches itself
   ([Ross et al. 2011](https://arxiv.org/abs/1011.0686)), as `expert_iter.js` already does.
4. **Constraints between rounds:** after each round, measure each species' realism metrics on validation fights. Raise λ_s
   for every band that is violated (dual ascent) and lower it for bands that are satisfied, so the next round's labels
   price realism higher where it slipped. This is the Lagrangian of `move_reward.js`, moved from ES fitness into the
   teacher's labels, at round granularity (RCPO-like: [Tessler et al. 2018](https://arxiv.org/abs/1805.11074); CPO:
   [Achiam et al. 2017](https://arxiv.org/abs/1705.10528)).
5. **Two sides, one league:** all classes on both sides learn in the same collection pass. Opponents are drawn from the
   current set, past accepted sets, and the heuristic (§3).
6. **Optional big teacher net [S]:** if a small student captures too little of the teacher's gain, train a larger offline
   net (set encoder, ensemble), then distil it into the small student on many cheap states (§4.4).

**Why:**
- *Credit.* Each decision gets its own counterfactual label from simulation. This is COMA's counterfactual baseline
  ([Foerster et al. 2017](https://arxiv.org/abs/1705.08926)), computed exactly by branching instead of learned by a
  critic. Our PPO failure (one fight-level advantage spread over 10k–50k decisions, `SPECIATION.md`) is exactly what this
  avoids.
- *Proven here.* Expert iteration shipped brawler_target_e1 (+0.094 fresh) and cat_target_e1 (+0.090 fresh), and matched
  ES on guards (e3 ≈ m3, +0.18). Expert Iteration ([Anthony et al. 2017](https://arxiv.org/abs/1705.08439)) and
  AlphaZero ([Silver et al. 2017](https://arxiv.org/abs/1712.01815)) use the same loop.
- *Realism inside the label, not after it.* Today realism only gates the result. Every imitation failure (cats idling
  5% → 40%, sprintRate, stillLong) came from a teacher that didn't care about style. Putting the realism cost and the
  prior into π* means the student never sees a label that asks for unrealistic play.
- *Phone-cheap.* Search runs only in training. Only small nets ship (owner rule, Oct 28).

### 1.2 Runners-up
- **A. ES everywhere with species-conditioned nets and a population (PBT-style league).** This is proven for chargers
  (+0.239) and guards (+0.13–0.18), and it optimizes the true fight goal with no label noise. **Why not first:** ES credit
  is fight-level. Signal per species shrinks with the share of fights a species appears in (lion, buffalo, bison ≈ 55–60
  of 600 fights), so species-specific behaviour averages out. That is our likely reason the chargers didn't speciate. ES
  also scales poorly past ~1–2k parameters, and it collapsed from cold starts. **Keep it as a fine-tune stage**:
  warm-start from the RR-JEI net, clip θ, small σ, same Lagrangian. That is where ES has worked
  ([Salimans et al. 2017](https://arxiv.org/abs/1703.03864); PBT [Jaderberg et al. 2017](https://arxiv.org/abs/1711.09846)).
- **B. Centralized training, decentralized execution with a learned critic (MAPPO / QMIX / COMA critic).**
  ([MAPPO](https://arxiv.org/abs/2103.01955), [QMIX](https://arxiv.org/abs/1803.11485)) **Why not:** these replace
  simulation-based counterfactuals with a learned value function, which needs millions of decisions to become accurate.
  Our branch labels are already an exact (if noisy) counterfactual. A learned critic is worth trying only as a
  *variance-reduction baseline* inside labels [S], not as the training method.
- **C. Adversarial motion prior / GAIL discriminator for realism.**
  ([AMP](https://arxiv.org/abs/2104.02180), [GAIL](https://arxiv.org/abs/1606.03476)) **Why not:** we have no real animal
  trajectories. The only "realistic data" is the heuristic itself, so a discriminator would just be a learned, hackable
  version of "stay close to the heuristic", which a KL term does exactly and cheaply. Revisit only if sourced field data
  (GPS hunt tracks, ethograms coded from video) is ever digitized.
- **Rejected: live planning.** It keeps the full +0.2 for cats, but the owner rule (Oct 28) is that nothing may need
  in-game search or loading.

## 2. Realism vectors: format and use

### 2.1 What a realism vector is
One file per species in an append-only registry (`policy/registry/realism/<species>.json`; it extends `species_spec.json`
in network_components §4). Each entry is one sourced tendency:

```json
{ "id": "buffalo.mobsPredator",
  "claim": "Bulls stand their ground and turn on lions attacking the herd; big herds lose fewer members",
  "source": ["https://ace.mandela.ac.za/Management-Advice-from-our-Science/Protection-from-Buffalo-Herds"],
  "confidence": 0.8,
  "when":    "predatorWithin(15) || predatorOnKin()",
  "measure": "pick.isPredator",
  "kind":    "band",                     // band | direction | never | signature | prior
  "band":    {"min": "ref", "tol": 0.05},   // 'ref' = the heuristic's own rate, measured on calibration fights
  "exposure":{"metric": "time.predatorWithin15", "min": "ref", "tol": 0.10},
  "use":     ["prior", "label", "constraint", "check"],
  "holdout": false }
```

- **`when`** is a context predicate over engine state, built from the pure helpers that already exist (`predCandidates`
  filters, `packStrength`, `guardsAround`, `locked`, fleeing).
- **`measure`** is a decision-level or telemetry quantity. Decision-level quantities come from `cfg.pickLog`; telemetry
  comes from `move_run.js` records or the `sig()` counters.
- **`kind`:**
  - `band`: the rate in context must stay in a range;
  - `direction`: changes relative to the heuristic must not go the wrong way (today's speciation report checks are this
    kind);
  - `never`: a hard gate;
  - `signature`: the species' signature move must not disappear (the 'down' metrics);
  - `prior`: tilts π_prior only.
- **`exposure`** guards against the commonest hack of a conditional rule: avoiding the condition. A buffalo that never
  goes near a lion trivially "mobs every lion it's near".
- **`confidence`** sets α_s and the λ ceiling. A tendency from one anecdote can't outweigh the goal the way a peer-reviewed
  one can.
- **`holdout: true`** entries are never used in training. They are only checked at ship time, so Goodhart drift shows up
  (§2.4).

The *vector* is the numeric part, one number per entry: the tilt it puts on the prior and its band edges. The vector is
also fed to the net as species-code input (§4.2), so similar tendencies share structure across species.

### 2.2 How each use becomes a training term
| use | where | form | changes the optimum? |
|---|---|---|---|
| `prior` | label π* | π_prior,s(a) ∝ π_heur(a)·exp(β_k·[a satisfies k in context]) | yes, softly (α_s) |
| `label` | teacher branch score | Ĝ(a) − λ_s,k·V_k(a): V_k = the share of the branch spent outside band k in context | yes, priced by λ |
| `constraint` | between rounds | λ_s,k ← clip(λ_s,k + η·(violation_k on val), 0, λmax·confidence) | yes, enforced |
| `check` / `never` | validation and ship | must pass; fail = round rejected for that class | hard |
| shaping (rare) | teacher score | potential-based F = γΦ(s') − Φ(s) | **no** |

A point that is easy to get wrong: **potential-based shaping
([Ng, Harada & Russell 1999](https://people.eecs.berkeley.edu/~pabbeel/cs287-fa09/readings/NgHaradaRussell-shaping-ICML1999.pdf))
provably leaves the optimal policy unchanged.** So it can't make a buffalo mob lions if mobbing doesn't pay. It only
speeds learning toward whatever the goal already prefers. Use it only where we want faster learning of goal-optimal
behaviour (for example, ring slots for the musk ox role head). **Realism that must change behaviour has to come from the
prior, the label cost, or the constraint.** Reward machines ([Icarte et al. 2022](https://arxiv.org/abs/2010.03950)) are
a good way to write multi-step tendencies such as stalk → spotted → abandon as small automata whose state feeds `when`
and `measure`. The same automaton can then score branches and telemetry.

### 2.3 Worked examples
**Buffalo (charger, both sides).** Known flaw: the learned charger changes picks *away* from predators (−0.56,
`SPECIATION.md`), but real buffalo turn on lions. Sources: the Addo lion–buffalo study (Tambling et al., summarized at
[ACE, Nelson Mandela Univ.](https://ace.mandela.ac.za/Management-Advice-from-our-Science/Protection-from-Buffalo-Herds));
herd rescues, anecdotal ([Latest Sightings](https://latestsightings.com/single-post/buffaloes-try-saving-buffalo-from-hunting-lions)).
- Entries:
  - `mobsPredator`: band, when a predator is within 15 m or on a herdmate, P(target = that predator) ≥ heuristic − .05,
    with exposure ≥ heuristic − 10%;
  - `vindictive` (exists): signature, the grudge rate must not fall;
  - `prior`: β = +0.7 on predator options in that context.
- Effect: in a decision where the lookahead slightly prefers charging you over the lion on a herdmate, π* still puts real
  mass on the lion. If validation shows the mob rate under band, λ_buffalo rises and the next labels favour the lion
  more.
- The cost is goal. The owner rule (realism first) says to pay it. Report it per species ("buffalo realism costs
  0.0x goal").
- Bison and musk ox don't share this entry: bison have no sourced lion-mobbing, so they keep the plain goal-optimal rule.
  **That difference is the speciation.**

**Cougar (enemy cat, and yours).** Source already in the repo: Laundré & Hernández 2003 (spotted cats don't run prey
down; `SPEC_X.cat.farSprint`), plus rear attack and nape bite (ExplorersWeb, cited in CLAUDE.md).
- Entries:
  - `abandonSpotted`: a reward-machine tendency. When the cat is creeping and its target turns to face it within 15 m
    (spotted), within 3 s it chooses abandon / cover / reposition rather than commit, with rate ≥ the heuristic's;
  - `rearApproach`: direction, the blindside intent share must not fall;
  - `never`: longChase > 8 s at speed (exists);
  - `prior` on intents: β = +0.5 on abandon/cover when spotted.
- The intent head (§4.3) is what can express this. A target-only net can't.
- Already consistent with today's report: the learned cougar peels off you onto closer targets (78%). The entry makes
  that a checked property instead of a lucky one.

**Wolf pack (harrier).** Sources: MacNulty, Mech & Smith 2007, the hunting-stage ethogram (approach, watch,
attack-group, attack-individual; [J. Mammalogy](https://bioone.org/journals/Journal-of-Mammalogy/volume-88/issue-3/06-MAMM-A-119R1.1/A-Proposed-Ethogram-of-Large-Carnivore-Predatory-Behavior-Exemplified-by/10.1644/06-MAMM-A-119R1.1.full));
wolves test prey, and prey that stands its ground is usually left (Wikipedia: Hunting behavior of gray wolves, already
cited for `tester`).
- Entries:
  - `commitOnFlight`: direction, P(commit | target fleeing) − P(commit | target standing) ≥ the heuristic's difference
    (no smaller);
  - `testThenLeave`: band, after 2+ rebuffed darts on a standing target the switch / disengage rate ≥ heuristic −
    tol;
  - `regroupBeforeAttack`: band on regroup share. harrier_v1 already regroups on 44% of decisions, so the band stops it
    rising to idle levels;
  - `never`: longIdle (exists).
- Exposure: share of time with a fleeing target in range must not drop (wolves can't dodge the check by never making
  anything run).
- A group-role head (lead / flank / hold) later lets "attack-group then attack-individual" show up as roles. Shape it with
  a potential Φ = −distance to the role's slot, which speeds learning without changing the optimum.

**Musk ox herd (main's roster: herd, `standsGround`, `ring`).** Source: NPS Gates of the Arctic, circle defense: a line
facing a single predator, a ring when there are many, a bull charges out and quickly rejoins
([NPS](https://www.nps.gov/gaar/learn/nature/muskox-circle-defense.htm); also `research/mid_tier_candidates.md`).
- Entries:
  - `lineVsOne` / `ringVsMany`: band. With 1 predator within 30 m, herd members are abreast facing it (a line). With 2+,
    they sit on a ring 4–10 m around the protected point (you on your side; the herd centroid on theirs), facing out, for
    ≥ the heuristic's share of the time;
  - `sortieReturn`: band, a charge-out ends ≤ 15 m from the ring and the animal is back within 10 s;
  - `never`: a lone musk ox more than 25 m from the herd while predators are near;
  - exposure: time with 2+ predators near must not drop.
- Today the engine's `ring` tag does this by rule. Until a role head exists (ladder rung 4), these entries are **checks
  only**: a target or intent net must not break the ring. Once the role head exists, the ring slots give a potential Φ for
  faster learning, and the bands become constraints.

### 2.4 Safeguards against reward hacking (each one answers a failure we've seen)
1. **Bands, not bonuses.** No term rewards *more* of a behaviour without limit. Counting signature moves invites spam
   (bluff 20 times). Every `label` / `constraint` term is a one-sided penalty for leaving a band around the heuristic's
   measured rate (or a sourced number), as `move_reward.js` already does.
2. **Exposure checks** for every conditional rule (see buffalo), so a rule can't be met by avoiding its context.
3. **Bounded shaping.** The total realism cost in a label is capped at a fraction (say 0.5) of the decision's gain spread,
   and λ ≤ λmax·confidence, so a mis-specified entry can't dominate the goal. Over-constraint shows up as zero gain, not as
   strange play.
4. **The 'none' / idle trap.** The lookahead never labels 'none', which made cats idle 30–87%. Keep `targetsOnly` and
   the noContact / stillLong / longIdle gates for every class.
5. **Held-out realism checks** (`holdout: true`, about one in four entries per species), plus the existing drift flags,
   are never used in training. A net that passes trained entries but fails held-out ones is overfitting the spec (Goodhart:
   [Skalse et al. 2022](https://arxiv.org/abs/2209.13085)).
6. **KL floor to the heuristic** per species (α_s > 0 always), so small-sample species stay near today's behaviour.
7. **Human review.** Before shipping, read the speciation report and a fixed replay reel per species (same game links on
   every release). Realism is judged by people, not only by metrics.

## 3. Simultaneous two-sided training

### 3.1 Round structure
Round k starts from the current set S_k = {net or heuristic per class: enemy cat, brawler, harrier, charger, bulldozer,
kicker, lurker; your guards (cats, canids, chargers, big)}.
1. **Collect.** Run N fresh fights. The opponent side for each fight is drawn as: 60% S_k, 25% a past accepted set from
   the league (prioritised toward sets S_k does worst against, like AlphaStar's PFSP:
   [Vinyals et al. 2019](https://www.nature.com/articles/s41586-019-1724-z)), 15% the heuristic. In each fight, label a
   budgeted sample of decisions from every class (sampling rates per class so each gets ~equal labels per round; rare
   species upweighted). Inside branches, everyone plays the fight's own nets.
2. **Train.** Each class, from its warm start: cross-entropy on π* over all its data so far, with a KL term to the S_k net.
   Classes train independently and in parallel.
3. **Validate each class alone.** The class's new net, with everything else in S_k, against S_k, on fresh fights: goal
   ± SE, style, gates, the realism bands, exposure. Accept or keep the old net, per class.
4. **Validate the assembled set S_k+1.**
   - Each side against the other side's league (it must not lose more than tolerance to any past opponent set: a
     cycling and forgetting check).
   - Against both yardsticks (today's heuristic, the live set).
5. **Update λ.** Per species and entry, from validation violations. Add S_k+1 to the league.

**What is frozen:** within a round, every opponent (and every other class on your own side) is frozen at S_k. Updates are
simultaneous across classes but small: trust region, plus acceptance against S_k. That makes the scheme a damped
fictitious play: each side best-responds to a mix of the other side's past, which is what stops cycling
([Heinrich & Silver 2016, NFSP](https://arxiv.org/abs/1603.01121); [PSRO, Lanctot et al. 2017](https://arxiv.org/abs/1711.00832)).

### 3.2 Non-stationarity, cycling, exploitability
- **Fixed yardsticks.** Every report shows goal vs heuristic and vs live set. The moving set is never the only reference
  (network_components §8).
- **The league is small and curated.** Keep about 6–8 past sets: every accepted set from the last 3 rounds plus the live
  set, the heuristic and one "exploiter" per side **[S]**. An exploiter is a set trained for 1–2 rounds against S_k only
  (AlphaStar's main exploiters); it exists to find holes, never ships.
- **Exploitability measure.** Build the cross-play matrix M[i][j] = mean goal of E-set i vs P-set j over the league
  (plain fights only, cheap). Report the meta-Nash value and each set's Nash-averaged score
  ([Balduzzi et al. 2018, "Re-evaluating evaluation"](https://arxiv.org/abs/1806.02643)). Elo works poorly here: the game
  is two-population and not transitive. A new set is accepted only if its worst case over the league doesn't drop beyond
  2 SE.
- **General-sum caveat.** The attack goal (checkmate) and the defence goal (guard) aren't exact opposites: they carry
  their own death and idle terms. Nash averaging is applied to each side's own goal. Report both.

### 3.3 Determinism and byte-identity
- **Zero output = today, per class and per species.** Students keep the skip form, margin·[heuristic pick] + f, with the
  output layer at 0. FiLM starts at γ = 1, β = 0; the species residual starts at 0.
- `target_ident_test.js` and `check_identical.js` must run on every class in the routing table.
- Branch dice derive from fight state (as now), so labels reproduce.
- Training float order: fixed batch order (`pool` already sorts results).
- Exported nets are plain JSON evaluated in JS doubles, the same on a phone and in Node.

### 3.4 How it ships
- **One release, one reprice.** The assembled set ships as a whole. Before that, per-class ablations each swap one class
  back to live: about 10 arms × 2,000 plain fights, about 11 CPU-h. They show what each class contributes. A class whose
  ablation shows no gain at 2 SE ships as "heuristic", or as its previous net.
- **The ship bar applies per class and per side:**
  - ≥ 2 SE over today's targets on 2,000+ fresh fights;
  - style 1.00, no gates;
  - all trained and held-out realism entries pass;
  - the replay reel reviewed.
- Then `price_abs.js` and `board.js`, as for any engine change. **Difficulty stays a pricing question.** If your guards
  improve more than the attackers, prices absorb it. Training never targets a survival rate.

## 4. Model architecture

### 4.1 Inputs (named, extensible)
These follow network_components §1. Each net lists the names it reads; a missing name reads 0.
- **Per option:** `features_plus` / `guard_features` / `features_rich` names. For intents: `move_*_features` names.
- **Per unit context:** HP, wound, stamina, morale, time pressure, zone, guards around the human, human HP and mount.
- **Set summary (optional):** a pooled encoder over the 16 nearest units (`set_model.js`), kept small. It adds nothing for
  your cats yet (§4.5).
- **Species code:** see 4.2.

### 4.2 Species conditioning (why shared nets collapse, and the fix)
- **Why the chargers collapsed** (our results plus [S]):
  - (a) The labels really are alike across charger species. The goal doesn't care whether a buffalo or a bison hits you.
  - (b) ES credit per species is diluted (§1.2 A).
  - (c) The trait vector reaches a target-mlp only through tanh units. Those units are shared and saturate on the common
    case.

  Shared parameters plus little species-specific signal give one rule. That is the classic finding for naive parameter
  sharing ([Christianos et al. 2021, SePS](https://arxiv.org/abs/2102.07475); [Li et al. 2021, CDS](https://arxiv.org/abs/2106.02195)).
- **Fix in the signal:** species-specific realism priors and constraints (§2). Without them, nothing *should* differ.
- **Fix in the net:**
  - species code c_s = [traits v2 (62), learned residual e_s (8, init 0), realism-vector numbers r_s (≤ 16)];
  - **FiLM** ([Perez et al. 2017](https://arxiv.org/abs/1709.07871)) on the hidden layer: h = tanh(γ_s ⊙ (W x + b) + β_s),
    with [γ_s, β_s] = G c_s. At export, γ_s and β_s are **precomputed per species into a table** (~40 species × 2 × 32
    numbers ≈ 2.6k), so the phone does a lookup, not a hypernetwork pass. A new species not yet trained uses G applied to
    its traits (zero-shot), with e_s = 0;
  - **per-species loss weighting:** each species' decisions weighted to an equal effective count per round, capped at 4×,
    so a buffalo's 60 fights count;
  - **species-split validation:** the speciation report gets per-species SEs (bootstrap over fights) so "speciated" is a
    measured claim.
- **Not recommended:**
  - full mixture of experts or per-species nets: data per species is too thin, and every expert is extra weights on the
    phone;
  - hypernetworks at play time (a FiLM table is the cheap form of the same thing).

### 4.3 Heads per decision type (factored, each labelled by the teacher on its own)
- **Target head** (exists): option scorer with the skip margin; `targetsOnly` for lookahead-trained nets.
- **Intent head:** logits over the class's intents (commit / wait / flank / regroup / disengage; cat: pounce / creep /
  abandon / soften / cover / blindside), *given the chosen target*. It shares the trunk with the target head.
  - Labels: the teacher branches intents for the teacher's best target only. That costs (targets + intents) branches, not
    targets × intents.
  - This is the "joint target + intent" lever the cat diagnosis pointed to.
- **Signature-timing head** (ladder rung 3): a binary now/hold per eligible signature (pounce, charge start, bluff vs real,
  box vs kick, drag). The engine checks eligibility, cooldown and sourced counts; the head only times the move.
- **Role head** (rung 4, later): lead / flank / hold / encircle / ring slot for packs and herds, with packmates' current
  roles as inputs.

### 4.4 Size budget and distillation
- **Student** per class: x ≈ 100–140 named inputs, hidden 32, FiLM table, heads (target 1, intent ≤ 7, timing ≤ 4).
  - Weights: 140·32 + 32·12 + FiLM table 2.6k ≈ 7.5k numbers per class.
  - About 10 classes ≈ 75k numbers ≈ 300–600 kB of JSON (less as float16 base64).
  - Compute: one 140×32 matrix-vector product per option per decision, a few times a second per animal. That is the same
    order as today's ?smart=1 build.
  - Ask the owner whether ~8k per class (vs ~5k now) is acceptable (§6).
- **Teacher net [S], built only if Stage 1 says capture is the bottleneck:** a 3–5 model ensemble with set attention over
  16 entities ([Set Transformer](https://arxiv.org/abs/1810.00825); entity encoders as in AlphaStar and
  [OpenAI Five](https://arxiv.org/abs/1912.06680)), 50–200k weights, trained offline on lookahead labels. It then labels
  millions of *cheap* states from plain fights with soft targets, and the student is distilled from those
  ([Hinton et al. 2015](https://arxiv.org/abs/1503.02531); [policy distillation, Rusu et al. 2015](https://arxiv.org/abs/1511.06295)).
  Distillation onto many more states regularizes the student better than 100k noisy labels can. It needs no extra
  lookahead CPU.

### 4.5 Why gain regression captured only 1/4–1/2, and what to try
Likely causes, in order. Stage 1 tests the first two.
1. **Label noise and winner's curse.** With 3 rolls of a chaotic 8–20 s future, an option's SE is close to the gain
   differences between options. Regressing on the argmax of noisy estimates is biased toward options that got lucky rolls.
   The part of the teacher's +0.2 that the *state* can predict may be well under +0.2.
   - **Measure the ceiling:** split each decision's rolls into two halves. The correlation of the two halves' gain vectors
     is the label reliability. A net's attainable R² is ≤ that reliability.
   - Our guess: high for chargers, middling for enemy cats, near zero for your cats. That would explain every capture
     ratio we have [S].
2. **Common random numbers for labels.** Fair dice are right for evaluating the *teacher's play*: shared dice let the
   teacher see the future. For *estimating gain differences*, though, using the same dice across options within one roll
   is unbiased (each option's expectation is unchanged) and can cut variance a lot over short horizons. Chaos decorrelates
   long branches, so the benefit may fade by 8–20 s [S]. This is cheap to test (Stage 1).
3. **Hard labels and an unknown switch threshold.** Replace argmax labels and the κ threshold with soft π* (temperature
   from the SE) and an SE-weighted ranking loss. Add shrinkage toward the heuristic (empirical Bayes), so a noisy small
   gain doesn't flip a pick. Gumbel-style policy improvement ([Danihelka et al. 2022](https://openreview.net/forum?id=bERaNdoegnO))
   is the principled form of "improve on the prior with few branch samples".
4. **Capacity and inputs.** Only after 1–3. Bigger teacher nets, then distillation (4.4).

**Your cats** (no learnable signal with per-option, rich, hidden-state or whole-field inputs, `SPECIATION.md`). Three
readings, each testable:
- (i) **Label noise:** reliability ≈ 0. The +0.203 is averaging over chaotic close-quarters futures, so there is nothing a
  state can predict. Then stop working on your-cat *targets*.
- (ii) **The decision isn't the lever:** the gain is real but sits in *when* and *how*, and the target labels mix it.
  Test with the joint target + intent lookahead (Stage 3), with intents such as hold off until the threat is engaged, or
  go for the flank of something locked on you.
- (iii) **The lever belongs to another class:** your cats do better when the *other* guards cover them (guard_target_m3,
  +0.18 on cat fights). Joint training captures exactly this.

## 5. Staged experiment plan (smallest first)
Costs assume ~130 CPU-s per lookahead-labelled fight (one class, 3 rolls, 8 s) and ~1–2 CPU-s per plain fight with nets.
64 CPUs ≈ 64 CPU-h per wall hour.

**Stage 0: realism registry, checks only (no training).** Write realism vectors for 8 species: buffalo, bison, cougar,
leopard, jaguar, wolf pack, musk ox herd, grizzly. Each gets ~4 entries, one held out. Implement `when` / `measure` /
`exposure` on `pickLog` and telemetry.
- *Validity test:* today's heuristic passes every entry on 2,000 fresh fights (by construction for 'ref' bands). The
  current ?smart=1 set must **fail** `buffalo.mobsPredator`; that is the known flaw, so a check that passes is broken.
- Compute: ~4,000 plain fights ≈ 2 CPU-h.
- If it fails: the context predicates are too rare or too noisy. Widen the contexts before using them in training.

**Stage 1: label reliability and CRN (the cheap diagnostic that decides the rest).** For chargers, enemy cats, your cats
and bulldozers: 150 fights each, 6 rolls per option, run twice (fair dice; CRN across options).
- *Measures:* split-half reliability of the gain vectors; the share of decisions where the best option is stable; how much
  CRN cuts SE. Then retrain the existing gain regression on CRN labels from the same states.
- Compute: 4 × 150 × 130 × 2 (6 rolls) × 2 (fair + CRN) ≈ 312k CPU-s ≈ **87 CPU-h** (~1.5 h on 64 CPUs).
- *Success:*
  - reliability ranks the classes as capture did (chargers > enemy cats > your cats ≈ 0);
  - CRN raises reliability by ≥ 30% relative at H = 8 s.
- *If it fails:*
  - low reliability everywhere means capture is near its ceiling. Stop chasing per-decision capture and move effort to
    intents and roles;
  - high reliability with low capture means the student is the bottleneck. Build the teacher-net / distillation path.

**Stage 2: realism-regularized charger (one class, the known flaw).**
- *Headroom / validity test, nearly free:* re-label the **stored** charger branch data (gains are already per option)
  with π* using the buffalo prior and band cost. Train offline. Check held-out regret and the buffalo's predator share on
  the stored states before any new fight.
- Then expert iteration, 4 rounds × 600 fights with the FiLM student, species weighting and λ updates:
  4 × 600 × 130 ≈ 312k CPU-s ≈ **87 CPU-h**, plus val/test on plain fights ≈ 10 CPU-h.
- *Success:*
  - ≥ 2 SE over today on 2,000 fresh fights (goal ≥ +0.15; the realism-free net had +0.239);
  - buffalo changes onto predators ≥ 0 at 2 SE (it was −0.56);
  - bison / black rhino / rhino stay distinguishable in the speciation report (per-species SE);
  - style 1.00, held-out entries pass.
- *If it fails:*
  - realistic buffalo costs more goal than the band allows: the owner decides the trade (§6);
  - or the net can't hold species apart: try a per-species residual head before giving up.

**Stage 3: joint target + intent for cats (both sides).**
- *Headroom test:* a lookahead over the best target × {commit, creep, abandon, cover, blindside} on 300 fights per side,
  about 2.5× the target-only cost: 2 × 300 × 325 ≈ 195k CPU-s ≈ **54 CPU-h**. Run the Stage 1 reliability split on the
  same data.
- *Success:* joint headroom ≥ target-only (+0.2) + 0.05 at 2 SE, with intent-label reliability well above your cats'
  target-label reliability. Only then train: 4 rounds × 600 fights × 2 sides ≈ **170 CPU-h**.
- *Ship bar for the result:* ≥ 2 SE on fresh fights, cougar `abandonSpotted` passes, style 1.00.
- *If it fails:* timing isn't the cat lever either. Leave your cats to the guard-set effect and close that track ("none
  found so far").

**Stage 4: two-sided pilot, two classes.** Enemy cats vs your guards: the pair with known coupling (your cats live or die
by guard cover). Run 3 rounds with the §3 loop and a 3-set league, plus the cross-play matrix.
- Compute: 3 × 900 labelled fights ≈ 98 CPU-h, plus cross-play 6 × 6 × 300 plain fights ≈ 11k CPU-s ≈ 3 CPU-h, plus val
  ≈ 10 CPU-h. About **110 CPU-h**.
- *Success:*
  - both classes beat the heuristic and S_0 at 2 SE;
  - no league member gains > 2 SE on the new set (no forgetting);
  - the two sides' gains don't cancel round over round (no cycling: M's diagonal trend is monotone).
- *If it fails:* note the cycling. Raise the KL weight and the league share before scaling up.

**Stage 5: full joint rounds (all classes, both sides) and one release.** Starting nets: every shipped net, plus Stage
2–4 winners.
- Per round: 1,500 fights with budgeted labels for all classes (~200 CPU-s each) ≈ 83 CPU-h, plus per-class val
  (10 × 800 × 2 × 1.5 s) ≈ 7 CPU-h, plus cross-play ≈ 5 CPU-h. About **95 CPU-h per round**; 6 rounds ≈ **570 CPU-h**
  (~9 h on 64 CPUs, under 1 h on 1,000).
- Then the ship check (ablations ≈ 11 CPU-h, 2,000-fight tests) and the reprice.
- *Success:* the assembled set passes the ship bar per class, the speciation report shows sourced per-species
  differences with SEs, and the replay reel is reviewed.

**Stage 6 (optional, after a release): ES fine-tune and quality diversity [S].**
- ES fine-tunes the shipped students under the same Lagrangian. Warm, θ-clip and small σ are known to work.
- Quality diversity per species ([MAP-Elites](https://arxiv.org/abs/1504.04909); near-optimal diversity,
  [DOMiNO](https://arxiv.org/abs/2205.13521)) uses behaviour descriptors taken from the realism vector (for example,
  share onto you × engage distance). The result is a small archive of equally strong, realistic styles per species,
  dealt per game for variety.
- Ask the owner before building it: it adds replayability, not difficulty.

Total through Stage 5: about 1,000 CPU-h (16 h of the 64-CPU quota, or about 1 h at 1,000 CPUs), at spot prices on the
order of tens of dollars. As before, evaluation and review take most of the calendar time, not compute.

## 6. Risks and owner decisions
**Decisions (add to DECISIONS.md):**
1. **Realism vs strength trade per species.** When a sourced tendency costs goal (a buffalo that mobs lions instead of
   charging you), how much goal may it cost? *Recommendation:* realism wins up to the full gain over the heuristic. A
   species may end up exactly as strong as today, never weaker, and the report states the cost.
2. **Who writes and reviews realism vectors.** Each entry needs a source and a confidence. *Recommendation:* a
   zoology-review subagent drafts them (as for the roster), the owner spot-checks 8 species before Stage 2, and anecdotal
   sources get confidence ≤ .5.
3. **Net size on phones:** ~8k weights per class (FiLM table, intent head) vs ~5k today. *Recommendation:* allow it;
   check frame time on a mid-range phone in the ?smart=1 build.
4. **Compute.** Stages 1–4 fit in 64 CPUs (~400 CPU-h). Stage 5 benefits from the 1,000-CPU raise. *Recommendation:*
   raise the quota only after Stage 4 passes.
5. **Both sides improving changes how the game feels**, even after repricing (smarter enemies are a different
   underdog fantasy). *Recommendation:* the owner playtests the joint set behind `?smart=1` before it ships.

**Risks:**
- *Capture ceiling.* If Stage 1 shows low label reliability, joint training adds coordination but not much per-class
  strength. Expect uneven gains by class, with "heuristic" as the per-class fallback.
- *Spec gaming.* Mitigated by bands, exposure checks, held-out entries, a KL floor and human review (§2.4). It can't be
  ruled out; that is why the reel review is part of the ship bar.
- *Engine churn.* Any sim.js change invalidates labels and nets. Named inputs plus warm starts keep retrains incremental.
  A full JEI cycle after an engine change is ~1 day.
- *Two-population evaluation noise.* Cross-play cells need ~300 fights each to resolve 2-SE differences of ~0.05, so the
  league must stay small.
- *Species with little data* (rares at 30% of boards, pack variants) will stay close to their prior. That is acceptable
  and honest: speciation there comes mainly from realism priors, not learned residuals.

## Sources
Multi-agent structure: [AlphaStar](https://www.nature.com/articles/s41586-019-1724-z),
[OpenAI Five](https://arxiv.org/abs/1912.06680), [PBT](https://arxiv.org/abs/1711.09846),
[NFSP](https://arxiv.org/abs/1603.01121), [PSRO](https://arxiv.org/abs/1711.00832), [MAPPO](https://arxiv.org/abs/2103.01955),
[QMIX](https://arxiv.org/abs/1803.11485), [COMA](https://arxiv.org/abs/1705.08926), [SePS](https://arxiv.org/abs/2102.07475),
[CDS](https://arxiv.org/abs/2106.02195), [Nash averaging](https://arxiv.org/abs/1806.02643).
Credit and distillation: [Expert Iteration](https://arxiv.org/abs/1705.08439), [AlphaZero](https://arxiv.org/abs/1712.01815),
[DAgger](https://arxiv.org/abs/1011.0686), [AWR](https://arxiv.org/abs/1910.00177), [AWAC](https://arxiv.org/abs/2006.09359),
[Gumbel policy improvement](https://openreview.net/forum?id=bERaNdoegnO), [distillation](https://arxiv.org/abs/1503.02531),
[policy distillation](https://arxiv.org/abs/1511.06295), [ES](https://arxiv.org/abs/1703.03864).
AWR/AWAC are the offline-RL form of our soft labels: weighting by exp(advantage/τ) is π* with a uniform prior.
Realism: [piKL](https://arxiv.org/abs/2112.07544), [CPO](https://arxiv.org/abs/1705.10528), [RCPO](https://arxiv.org/abs/1805.11074),
[AMP](https://arxiv.org/abs/2104.02180), [GAIL](https://arxiv.org/abs/1606.03476), [reward machines](https://arxiv.org/abs/2010.03950),
[potential-based shaping](https://people.eecs.berkeley.edu/~pabbeel/cs287-fa09/readings/NgHaradaRussell-shaping-ICML1999.pdf),
[reward hacking](https://arxiv.org/abs/2209.13085).
Diversity and architecture: [MAP-Elites](https://arxiv.org/abs/1504.04909), [DOMiNO](https://arxiv.org/abs/2205.13521),
[FiLM](https://arxiv.org/abs/1709.07871), [Set Transformer](https://arxiv.org/abs/1810.00825).
Animals: [buffalo vs lions, Addo (ACE)](https://ace.mandela.ac.za/Management-Advice-from-our-Science/Protection-from-Buffalo-Herds),
[wolf hunting ethogram (MacNulty et al. 2007)](https://bioone.org/journals/Journal-of-Mammalogy/volume-88/issue-3/06-MAMM-A-119R1.1/A-Proposed-Ethogram-of-Large-Carnivore-Predatory-Behavior-Exemplified-by/10.1644/06-MAMM-A-119R1.1.full),
[musk ox circle defense (NPS)](https://www.nps.gov/gaar/learn/nature/muskox-circle-defense.htm); cougar and others as
cited in CLAUDE.md and `policy/move_reward.js`.
