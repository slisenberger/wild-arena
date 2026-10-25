# Learned predator target selection

Goal: enemy predators pick their targets with a trained policy net that plays well but still behaves
recognizably like the animal it is. Milestone 1 (this folder) is the foundation; default behavior is unchanged.

## Milestone 1: what's here
- **Hook (sim.js).** `chooseTarget` gets one line: with `cfg.policy` set, an enemy predator's retarget
  (every ~0.5 s, after the latch and sated checks) is decided by `policy/policy.js` instead of the heuristic.
  Without `cfg.policy` nothing changes (checked: same `t`, `why`, `killer`, event count and event-log hash on
  320 board fights; `check_identical.js`). sim.js also exports `A._internals` (its targeting helpers plus
  `predCandidates`, the same eligibility filters as `predatorTarget`).
- **Decision interface (`features.js`).** Options: `none` (roam), `feed` (only when the heuristic could feed),
  and each candidate target predatorTarget would consider. Each option gets a 63-number vector (61 in milestone 1; milestone 2
  added `riding` and the cougar's `riderSnatcher` tag, which predatorTarget had started using): option type;
  target features (distance, mass and strength relative to the predator and to its pack, health, you / your
  animal / feud, appetite, guard strength around it (busy guards half), busy / fleeing / latched / stunned /
  overheated, height vs. reach, rival, yields-to, giant, packmates already on it, current target, grudge,
  visible, in water, carrying you); feed features (carcass appeal, distance, meat); predator context (hunger,
  health, morale, aggression, stamina, heat, packmates, appetite for people, tags, map one-hot, time, pressure).
- **Model (`model.js`).** Shared MLP scorer 63 → 32 (tanh) → 1 per option (plus an optional linear skip term `Wl`, milestone 2), softmax over options; argmax at
  inference with ties to the earlier option. Weights are plain JSON (`bc_weights.json`, input
  standardization folded into the first layer).
- **Behavior cloning (`bc.js`).** Teacher mode (`cfg.policy = {teacher: true}`) runs the heuristic through
  the hook and logs (features, heuristic choice). Train fights and test fights use different boards and seeds.
- **Evaluation (`eval.js`).** Heuristic vs a weights file on the same board fights (paired, common seeds).
- **ES prototype (`es.js`).** A few generations of evolution strategies from the BC net (see below).

### Results (milestone-1 engine, Oct 2026; superseded by the retrained BC below)
- No-policy and teacher-mode runs: 320/320 board fights identical to the pre-hook engine (t, why, killer,
  event count, event-log hash).
- BC: 160,671 train decisions (2,000 fights), 30,267 held-out decisions (400 fights on other boards/seeds);
  held-out top-1 agreement **99.0%** (none 100%, feed 99.5%, target 98.8%; every species 98.0–99.8%).
  Baselines: "keep current target else nearest" 66.3%, "always the human" 50.3%.
- Heuristic vs cloned net, 400 board fights, paired common seeds (on-policy agreement 98.9%):

  | metric | heuristic | BC policy | paired diff |
  |---|---|---|---|
  | your win % | 14.8 ± 1.8 | 14.0 ± 1.7 | −0.8 ± 1.1 |
  | mean score (s) | 92.6 ± 4.7 | 91.2 ± 4.7 | −1.5 ± 2.9 |
  | predator damage / fight | 515 ± 29 | 506 ± 28 | −10 ± 9 |
  | a predator killed you % | 14.8 ± 1.8 | 16.0 ± 1.8 | +1.3 ± 1.1 |
  | predator deaths / fight | 2.15 ± 0.08 | 2.15 ± 0.08 | +0.00 ± 0.04 |
  | time on you % | 47.2 ± 1.3 | 47.5 ± 1.3 | +0.3 ± 0.3 |
  | time on your animals % | 18.7 ± 0.8 | 18.8 ± 0.8 | +0.1 ± 0.3 |
  | time feeding % | 8.2 ± 0.6 | 8.4 ± 0.6 | +0.1 ± 0.2 |
  | time fleeing/overheated % | 11.1 ± 0.6 | 11.1 ± 0.6 | −0.0 ± 0.3 |
  | time with no target % | 11.7 ± 0.8 | 11.2 ± 0.7 | −0.5 ± 0.3 |

  All within noise; 21/400 fights changed outcome (small decision differences cascade in a chaotic sim).
- ES prototype (6 generations, 8 antithetic pairs, 48 fights/candidate, λ = 2): no improvement. Over 400 eval
  fights it drifted to 94.4% agreement, +3.6 ± 0.6 points more time on you, but −38 ± 17 damage and no change
  in kills of you. Lesson: 48 fights from one board per map per generation is far too noisy (generation-to-
  generation reward swung −3.3 … −0.2 on fight sets alone); use ≥200 fights over many boards per candidate,
  or a fixed validation set to accept/reject steps.

Run: `node policy/check_identical.js out.json`, `node policy/bc.js`, `node policy/eval.js [weights]`,
`node policy/es.js`. All use 4 worker threads.

## Milestone 2 plan (written after milestone 1)

**Optimizer: evolution strategies (OpenAI-ES style) over the ~2k weights.** The sim is deterministic, cheap
(~0.1 s per fight), non-differentiable and has sparse, delayed rewards; ES needs only episode returns, is
trivially parallel with worker_threads, and is robust to the long credit-assignment horizon. Antithetic
pairs, centered-rank fitness shaping, common fights for all candidates in a generation (common random
numbers), fresh fights each generation. CEM is a fine alternative; policy-gradient (REINFORCE with the
softmax) is possible later since the net already defines action probabilities.

**Reward (for the other side's predators collectively, per fight):**
damage dealt / 1000 + K·[a predator killed you] − D·(predators that died) (prototype: K = 5, D = 1).
Consider: credit only damage to your side (not feud damage), a small bonus for shortening your survival time.

**Realism regularizer.** Penalize divergence from the heuristic: λ × the share of the net's own
decisions that differ from the heuristic's (prototype), or better a KL term
KL(π_net ‖ softmax(log heuristic score / T)) on logged states, which keeps the net close where the heuristic is
confident and lets it differ where scores are close. Anneal λ down, never to 0.

**Realism checks (gates before a policy ships), per species, from `eval.js`/`audit.js`-style runs:**
- time-share profile (on you / your animals / feeding / resting / none) stays within bounds of the heuristic's
  (e.g. ±10 points), e.g. a cougar still yields to bears, a croc still never leaves the water's edge (that is
  enforced by the candidate filter anyway), a sated predator still rests (not a policy decision);
- prey choice by mass ratio: no wolf solo-hunting an elephant, no cat ignoring a fleeing, wounded target;
- "suicide rate": predator deaths per fight must not rise more than X%;
- appetite for people stays ordered by species (polar/tiger > lion > leopard/jaguar/wolf);
- watch replays of a dozen fights per map; any behavior a viewer would call "gamey" is a bug.

**Game balance.** A stronger other side makes every team weaker; the validated $1,000 / boards-to-$2,800
balance (best team ~75%) would need re-checking (`board.js`) with the policy on. Ship it as a rules option
(e.g. "Smart predators") first rather than replacing the default.

**Compute estimate.** ~0.12 s per fight per core with the net (feature extraction dominates; the MLP is
trivial; measured ~0.15 s/fight with the net). One ES generation of 16 pairs × 200 fights ≈ 6,600 fights
≈ 4 min on 4 workers; 100 generations ≈ 7 h (overnight), or proportionally less with fewer fights + a
fixed validation gate.
Validation of finalists: 400 fights × 2 arms ≈ 30 s per candidate; full balance re-check ≈ 45 min (board.js).

**Risks.**
- Exploiting sim quirks (e.g. kiting guards into the closing hazard, abusing the 70 m human-awareness rule,
  dithering between targets to reset commitment); mitigations: realism gates, KL penalty, replay review.
- Overfitting to the training boards/seeds: fresh fights every generation and a held-out validation set.
- Noisy fitness (win/kill is binary): use many fights per candidate and rank shaping; report ± SE.
- The heuristic's other rules (wait-for-an-opening shadowing, feeding, sated rest) still run around the
  net's choice; the net only picks *what* to go for. A later action could be "shadow" (wait for an opening).
- Drift when sim.js changes: candidate filters live in sim.js (`predCandidates`) and must stay in sync with
  `predatorTarget`; retrain BC after engine changes, and keep `check_identical.js` in CI-style use.

## Milestone 2: what was done and found (Oct 2026, engine at "Cats: scent-sense of hidden cats")

**Outcome: no trained weights ship.** Nothing beat the behavior-cloned net beyond noise on fresh fights while passing
the realism gates, so there is no `es_weights.json`. Within the target-selection action space and realistic bounds, the
hand-tuned heuristic is already at (or within ~0.1 reward of) a local optimum; the levers that would make predators
deadlier are in *how* they hunt (movement, timing, coordination), which this net does not control.

### Retrained behavior cloning on the current engine
- `predCandidates` was still in sync with `predatorTarget`'s filters. One scoring term was new (cougar
  `riderSnatcher` × target is riding), so two features were added (`riding`, `riderSnatcher`; 63 features now).
- `bc.js` (2,000 train fights / 162k decisions, 400 test fights on other boards/seeds): held-out top-1 agreement
  **98.9%** (none 99.7%, feed 99.3%, target 98.7%; species 98.1–99.9%). `logs/bc.txt`.
- Paired eval, 400 board fights (seed base 3003; `logs/eval_bc.txt`): on-policy agreement 99.1%; your win % 40.0 → 40.5
  (+0.5 ± 1.4), damage to your side +23 ± 14, kills of you −0.3 ± 1.3 pts, predator deaths +0.04 ± 0.04, time shares all
  within ±0.5 pts. Matches within noise.
- No-policy and teacher-mode runs are still identical to the engine before this milestone (320/320 fights,
  `check_identical.js`), including the one sim.js change: a stat-only counter `st.foe` (damage dealt to your side).

### Tools added / changed
- `run.js`: one fight with the heuristic or a net → reward parts (damage to your side, killed you, predator deaths,
  disagreement with the heuristic) and per-species time profile.
- `gates.js`: realism gates on paired fights. (1) per species with ≥1500 predator-seconds: share on you / your animals /
  feeding / no target within ±10 pts of the heuristic. The pooled share is noisy (even the 99%-agreement BC net showed
  "grizzly feed −11.1 ± 6.8 pts" on one 400-fight set: a different early kill = a different carcass), so a deviation
  fails only if it exceeds 10 pts by more than one paired SE (ratio-estimator SE over fights); otherwise it is printed
  as a warning. (2) appetite for people stays ordered: species pairs with ≥2× appetite whose on-you shares the heuristic
  separates by ≥5 pts keep their order. (3) predator deaths/fight not significantly up and not up more than 10%.
- `es.js`: OpenAI-ES, antithetic pairs, centered ranks, Adam, common fights per generation (fresh each generation, 40
  boards per map = 160 fights/candidate), λ·disagreement penalty annealed but never 0, fixed 400-fight validation set
  (seed base 4004) every 2 generations: paired gain > 1 SE over the best so far + gates pass → new best (checkpointed);
  loss > 2 SE → revert. `MODE=full` perturbs all 2,081 weights; `MODE=linear` freezes the BC net and trains a linear
  skip term over the 39 option-specific inputs (`model.js` `Wl`); `INIT=` starts the walk from a screened bias.
  Resumable (`RESUME=1`), logs to `<outDir>/log.txt`.
- `probe.js`: directed probes: add one interpretable bias (e.g. "+2 on isHuman") to the BC net and compare with the
  heuristic on the same 400 fights, with gates. `eval.js` now reports damage to your side, the ES reward, per-species
  profiles and the gates.

Reward (per fight, for the other side's predators): damage to your side / 1000 + 5 if a predator kills you − 1 per
predator death (feud damage excluded). Typical heuristic value −1.46 ± 0.14; its per-fight SD (~2.7) is dominated by the
binary kill bonus and deaths, so a 400-fight paired comparison resolves about ±0.2 (2 SE).

### Runs (≈2 h of 4-thread compute; logs in `logs/`)
| run | setup | result |
|---|---|---|
| ES full net (`es_full_net.txt`) | σ 0.15 (≈5% decisions changed), Adam 0.02, 8 pairs, λ 4→1, 8 gens | validation vs BC −0.10 … +0.04 (SE ≈ 0.1); random walk |
| ES linear (`es_linear.txt`) | 39-dim skip term, σ 1, Adam 0.1, 8 pairs, λ 4→1, 15 gens | validation −0.09 … −0.03; centre stayed at ~2% disagreement |
| probes (`probes.txt`) | 12 single biases, then 8 human-focus mixes, on screen set 5005 | "+2 isHuman": +0.28 ± 0.10, kills of you +4.5 ± 1.5 pts |
| re-check on validation set 4004 | the screened winners | "+2 isHuman" +0.14 ± 0.12 (fails cougar gate); screen winner "isHuman 2 + humanAppetite 4" −0.05 ± 0.11: winner's curse |
| ES linear from the screened bias (`es_linear_init.txt`) | σ 0.5, Adam 0.05, 10 pairs, λ 2→1, 29 gens | gen 10 accepted (+0.145 ± 0.111 vs BC on validation, gates pass); later gens −0.15 vs it |
| extreme probes, fresh set 8008 | "always the human", "never switch" … | even "always the human" gives only +4 ± 2 pts kills of you, at −223 damage and +0.2 deaths → reward −0.23 |

### Final paired evaluation: heuristic vs the ES best (gen 10), 400 fresh fights (seed base 7007, never used before)
`node policy/eval.js <best.json> 100 1 7007` (`logs/final_eval_es_best.txt`); on-policy agreement 96.9%.

| metric | heuristic | ES best | paired diff |
|---|---|---|---|
| your win % | 37.0 ± 2.4 | 38.5 ± 2.4 | +1.5 ± 1.9 |
| mean score (s) | 146.8 ± 6.1 | 149.2 ± 6.2 | +2.5 ± 4.5 |
| predator damage to your side | 473 ± 28 | 440 ± 26 | −33 ± 17 |
| a predator killed you % | 9.0 ± 1.4 | 10.0 ± 1.5 | +1.0 ± 1.2 |
| predator deaths / fight | 2.38 ± 0.10 | 2.40 ± 0.10 | +0.02 ± 0.05 |
| ES reward | −1.457 ± 0.136 | −1.458 ± 0.139 | −0.000 ± 0.094 |
| time on you % | 40.4 ± 1.3 | 41.6 ± 1.3 | +1.2 ± 0.6 |
| time on your animals % | 21.3 ± 0.9 | 20.2 ± 0.8 | −1.1 ± 0.5 |
| time feeding % | 9.6 ± 0.6 | 9.0 ± 0.6 | −0.5 ± 0.3 |
| time fleeing/overheated % | 11.6 ± 0.6 | 11.0 ± 0.6 | −0.6 ± 0.5 |
| time with no target % | 12.4 ± 0.8 | 13.4 ± 0.9 | +1.0 ± 0.4 |

Realism gates: pass. The +0.145 validation gain was selection on a re-used validation set; on fresh fights it is zero.

What the learned bias does (it is essentially its starting point: +2.1 on "target is you" and +3.75 on "you × the
species' appetite for people", small noise elsewhere): high-appetite hunters (tiger, polar bear, lions, hyena packs)
spend a few more points of their time on you and less on your animals (hyena pack: on you 37 → 41%, on your animals
36 → 26%; tiger: 71 → 75%, kills of you 6 → 13 in 400 fights, while polar kills went 11 → 7); low-appetite ones (honey
badger 8 → 2% on you) leave you alone even more. The net effect: a bit more pressure on you, less damage to your
animals, no more kills overall. In every probe the same trade-off appeared: focusing the human costs damage to your
animals roughly 1:1 in reward (likely because your guards rank threats by intent: a predator going for you draws
them onto it sooner; not measured directly).

### Lessons / next steps
- With this reward, ±0.1 is the size of any realistic improvement and ±0.1 is also one SE at 400 fights. A credible
  gain needs ~1,600+ validation fights per check (4× compute) or a lower-variance reward (e.g. expected-kill shaping:
  damage to you / your max HP instead of the binary kill bonus; deaths weighted by HP lost).
- Don't reuse a validation set for many accept decisions with a 1-SE threshold: the final fresh evaluation is what
  counts (here it erased the gain). Use 2 SE, or a fresh validation draw per check.
- Full-net ES over 2k weights with ~3k fights per generation is a random walk at this noise level; the linear skip term
  (39 dims) is the better parameterization, and directed probes are the most informative use of compute.
- To make predators genuinely smarter, give the policy actions that matter: "shadow / wait for an opening" (attack when
  the human's guards are busy), pack timing (wait for packmates before engaging), retreat-and-return. Target choice
  alone is nearly exhausted by the heuristic.
- Balance note for a future "smart predators" option: no gate-passing bias makes the game measurably harder (your win %
  moved by ≤3 points either way, within noise). The one hint is "+2 on isHuman" (uniform human focus): on the validation
  set it shortened your survival by 10.9 ± 4.6 s (win % −2.8 ± 1.9), but it fails the cougar gate (on you +14 pts) and
  was not confirmed on fresh fights.

## Milestone 3 plan (owner, Oct 2026): per-archetype policies with two rewards
- **Actions:** one small policy per archetype (stalker, sprinter, pack harrier, charger, lumberer, keep-away kicker,
  water ambusher) choosing a movement intent every ~0.5 s: commit, wait for an opening, flank or circle, get into
  position, disengage. The engine keeps doing the low-level steering.
- **Reward 1, the goal:** the team outcome (theirs: time-to-kill-you plus damage; yours: your survival time),
  with a small idle penalty.
- **Reward 2, style:** a grade against the animal's intended behaviour, built from the `sig` counters and
  `audit.js` state shares. Examples: stalk-then-pounce share, sprint-then-leap rate, rhino charge and overshoot,
  wolf dart-in-and-back-out rhythm, kicker fighting distance; plus realism gates ("a stalker never runs a long
  chase"). Score it against today's heuristic profile so the starting point passes.
- **Combine:** treat style as a constraint (Lagrangian: maximise the goal subject to style ≥ threshold), not as a
  fixed weighted sum, so neither reward can be gamed by collapsing onto the other.
- **Train:** ES on paired seeds, about 200 fights per candidate; per-archetype nets start at zero (= the heuristic) via
  the skip parameterisation. Validate on fresh fights at 2 SE.
