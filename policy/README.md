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
  and each candidate target predatorTarget would consider. Each option gets a 61-number vector: option type;
  target features (distance, mass and strength relative to the predator and to its pack, health, you / your
  animal / feud, appetite, guard strength around it (busy guards half), busy / fleeing / latched / stunned /
  overheated, height vs. reach, rival, yields-to, giant, packmates already on it, current target, grudge,
  visible, in water, carrying you); feed features (carcass appeal, distance, meat); predator context (hunger,
  health, morale, aggression, stamina, heat, packmates, appetite for people, tags, map one-hot, time, pressure).
- **Model (`model.js`).** Shared MLP scorer 61 → 32 (tanh) → 1 per option, softmax over options; argmax at
  inference with ties to the earlier option. Weights are plain JSON (`bc_weights.json`, input
  standardization folded into the first layer).
- **Behavior cloning (`bc.js`).** Teacher mode (`cfg.policy = {teacher: true}`) runs the heuristic through
  the hook and logs (features, heuristic choice). Train fights and test fights use different boards and seeds.
- **Evaluation (`eval.js`).** Heuristic vs a weights file on the same board fights (paired, common seeds).
- **ES prototype (`es.js`).** A few generations of evolution strategies from the BC net (see below).

### Results (Oct 2026 engine)
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

## Milestone 2: training beyond imitation

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
