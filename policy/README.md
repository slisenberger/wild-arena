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

## Milestone 3 harness (Oct 2026): movement intents, goal + style, sharded ES

A training harness for per-archetype **movement-intent** policies. It runs locally on worker threads today and fans
out to any number of machines (GitHub Actions matrix, a VM, several VMs) without code changes, because every step is
plain JSON in and plain JSON out. First archetype: the other side's pack harriers (gait `orbit`: wolf, hyena,
`wolfpack`, `wolfpack6`, `hyenapack`).

### Engine hook (sim.js, opt-in)
- `cfg.movePolicy = {harrier: weights}`. `archetypeOf(u)` maps a unit to an archetype (`'harrier'` = side E, gait
  orbit). While such a unit is engaged, `intentMove` picks an intent every 0.5 s (and on a target change) through
  `A._internals.moveChoose` (registered by `policy/move_policy.js`), and the engine does the steering:
  0 **commit** = the existing chain (`waitForOpening`, else `gaitMove`: orbit + darts), i.e. the heuristic;
  1 **wait** = shadow at ~16 m (the `waitForOpening` circle); 2 **flank** = swing round to the target's rear (opposite
  its heading, or its own target), then dart in from there; 3 **regroup** = close on packmates within 40 m, then hang
  back with them; 4 **disengage** = back off to ~10 m outside reach.
- One call site in the engage branch plus `intentMove`/`intentGo`/`archetypeOf` next to the other policy hooks; nothing
  else changed. Without `cfg.movePolicy` the engine is byte-identical (see the checks below).

### Policy (`move_features.js`, `move_model.js`, `move_policy.js`)
- 41 features, all from the engine's pure helpers (`packStrength`, `guardsAround`, `busy`, `wound`, `strength`,
  `packMate`, …; nothing mutates the fight or touches its rng): distance and gap to the target, target is you / riding /
  hurt / busy / fleeing / easy / on me, log strength ratio vs my pack, guards around it (and whether they'd make the
  heuristic wait), packmates near / alive / on the same target, attackers on me, own HP, wound, stamina, morale, heat,
  hunger, dart ready, time, pressure, closing-zone progress and distance to its edge, in water, appetite for people,
  hyena, map one-hot, previous intent one-hot.
- `logit[a] = margin·[a = commit] + bl[a] + Wl[a]·x + W2[a]·tanh(W1·x + b1)`, argmax with ties to commit. All-zero
  `bl, Wl, W2` = always commit = the heuristic, whatever the hidden layer holds; `margin` (default 1) is a trust region a
  perturbation has to overcome before behaviour changes. `mode: 'linear'` trains `[bl, Wl]` (210 numbers); `'full'`
  also trains `W2` over a fixed random hidden layer (`nh`). Probe policies: `{fixed: k}`.

### Rewards (`move_reward.js`, telemetry in `move_run.js`)
- **Goal** (per fight, the side's harriers together): damage to you / your max HP + 1 if a harrier killed you + damage
  to your animals / 1000 − 0.25 per harrier death − 0.05 per harrier-minute without contact. "Without contact" = idle
  *or closing in* for more than 10 s without touching anything, so circling or approaching that never arrives is
  penalised like standing still (the anti-gaming rule).
- **Style** in [0, 1], from per-fight telemetry pooled over the fight set (ratio of sums), graded against the heuristic's
  own profile measured on the calibration fights: time shares fight / close / idle / flee (±8 pts), dart rate per
  engaged minute (the dart-in-and-out rhythm, ±25%), share of engaged time within 10 m (commit vs circle, ±10 pts),
  mean distance kept from the target (±25%); one-sided: face-on time (in reach of something fighting it back, not darting,
  > 3 s), long idle (> 30 s without contact), no-contact share, fruitless approaches. A metric scores 1 inside tolerance
  + 2 SE of the heuristic's sampling noise at that fight count, falling to 0 at twice the tolerance; style = the mean.
  **Gates** (must score 1): face-on and long idle. `w.sig` counts both sides, so the dart rhythm is counted per unit
  from `u.mv.k === 'dart'` starts instead.
- **Drift flags**: every metric, plus telemetry-only death rate, escape rate, your-share of their damage and damage per
  fight, checked against the heuristic's normal range (tolerance + 2 SE). Logged per candidate every generation; a
  validation accept requires no flags (`acceptNoDrift`).
- **Combined**: Lagrangian, fitness = goal + λ·(style_eff − threshold) with style_eff = style − 0.25 per failed gate,
  λ ← max(0, λ + 4·(threshold − mean candidate style)) after each generation; threshold 0.9, λ₀ = 1.

### Trainer (`train.js` coordinator, `train_worker.js` workers)
- Phases in one state file: `calib` → `train` (gens) → `val` (final centre) → `test` → `done`.
  - calib: zero weights + a few σ-perturbations on 300–400 calibration fights → the heuristic's reference profile, the
    variance of each goal component, the paired per-fight SD, and N (below).
  - train: OpenAI-ES, `pairs` antithetic pairs, all candidates on the same fresh `train` fights (common seeds),
    centred ranks with tie-averaging, Adam. Every `valEvery` gens and after the last one: the centre vs the best so far
    on a **fresh** draw from the validation pool (never reused); accept only at > 2 SE with style ≥ threshold, gates
    passing and no drift flags.
  - test: zero weights vs the best on the held-out test pool, per map.
- **Seed pools**: `train` (one draw per generation), `val` (one per check), `test`, `calib`, `probe` are separate rng
  streams; boards come from `A.dealBoard` per map, player-like teams, and only fights with harriers on the other side.
  `holdMap=<map>` also keeps a map out of train/val (the test always covers all four).
- **N from the variance, not by hand** (`fights`, `valFights`, `testFights` = `'auto'`): realistic effect δ = the spread of
  true effects among the calibration perturbations that stay realistic (style ≥ threshold, gates pass), floored at
  0.1 × the heuristic's per-fight goal SD; validation/test N = (2·sd_pair/δ)² (2 SE detection, capped by `valMax` /
  `testMax`, the log says when the cap binds); train N = 2·(sd_pair/δ)² clamped to [`fightsMin`, `fightsMax`].
- **Checkpoints**: the state file is rewritten atomically after every step and holds everything the next step needs
  (θ, Adam moments, λ, best, validation index, history). ES noise is drawn from `(seed, gen)`, so resuming after a crash,
  a 6-hour CI limit or on another machine gives exactly the same run.
- **Versioning**: state, jobs and results carry `format` + `version`, the `sim.js` hash and the harness hash
  (`move_*.js`). A changed engine or harness is refused (`ALLOW_ENGINE_CHANGE=1` / `ALLOW_ENGINE_MISMATCH=1` to
  override). Every jobs file records the config, the seed and every fight's board seed and fight seed.
- **Logs**: `<state>.log`, one line per generation: mean / best goal, the heuristic's goal on the same fights
  (`baseline`, on by default: one extra zero-weight arm, not used in the update, so the curve isn't fight-set luck), mean / min style, feasible share, λ, non-commit
  share, drift-flagged candidates, |θ|, fights, wall time, fights/s; each flagged candidate; each validation check.
  The state's `history[g].cands` keeps per-candidate telemetry (time shares, dart rate, distance, deaths, your share
  of damage, intent shares).

### Usage
```
node policy/train.js init  run/state.json [--pairs=8 --gens=8 --sigma=.1 --lr=.08 --holdMap=forest ...] [--dry-run]
node policy/train.js run   run/state.json [--threads=4] [--serial] [--steps=N]   # local loop; rerun to resume
node policy/train.js report run/state.json
node policy/train.js retest run/state.json [--which=center|best] [--fights=400] [--index=1]   # read-only extra test draw
node policy/harness_test.js [--quick]     # the checks below (~8 min / ~4 min on a shared 4-core box)
```
`--dry-run` presets a tiny run (24 calibration fights, 2 pairs × 12 fights, 1 generation, 12-fight val/test): ~25 s.

**Sharded step** (any machines with the same checkout; the coordinator is just these three commands):
```
node policy/train.js jobs  run/state.json run/jobs.json                 # next step's jobs (calib / gen g / val / test)
node policy/train_worker.js run/jobs.json run/out_3.json 3/16 --threads=4   # on each of 16 machines, i = 0..15
node policy/train.js merge run/state.json run/jobs.json run/out_*.json  # checks coverage + hashes, updates, checkpoints
```
GitHub Actions: one workflow run per step. Job `plan` restores `state.json` (artifact or a branch), runs `jobs`, uploads
`jobs.json`; job `work` with `strategy.matrix.shard: [0..15]` runs `train_worker.js jobs.json out_${{ matrix.shard }}.json
${{ matrix.shard }}/16 --threads=4` and uploads its output; job `merge` downloads all outputs, runs `merge`, and saves
the state (re-dispatching itself until `report` says `done`). Each step is minutes, far under the 6-hour job limit. A VM
does the same with `run` (threads) or a shell loop over `jobs` / workers / `merge`.

File formats: jobs `{format:'wild-arena/move-jobs', version, id, simHash, harnessHash, arch, phase, gen, seed, config,
cands:[weights], sets:[{name, cands:[index], fights:[{pool, index, i, tr, bseed, board, team, mount, seed}]}]}`; task k
enumerates sets × their candidates × their fights in order, shard i takes k % n = i. Results `{format:'wild-arena/
move-results', version, jobsId, simHash, harnessHash, shard:[i,n], nTasks, wall, host, results:[{k, rec}]}` with `rec`
the per-fight telemetry (`move_run.js runFight`). State `{format:'wild-arena/move-state', version, simHash, harnessHash,
config, features, intents, P0, phase, gen, theta, adam, lambda, best, valIndex, calib, ref, N, history, val, test}`.

### Harness checks (`node policy/harness_test.js`, 31/31 pass; `logs/m3_harness_test.txt`)
- No `movePolicy`: 480 fights (160 harrier board fights + `check_identical.js`'s 320) identical to the pre-hook engine
  (git 8f24f13): event log, final positions / HP / states, end time. Zero weights (margin 1 and margin 0), the
  always-commit probe and a random hidden layer with a zero output layer: identical to no policy on every fight.
  (The pre-hook reference is the newest git revision of sim.js without `movePolicy`, or `REF_SIM=`; once other engine
  changes land after the hook, that comparison stops being meaningful and the zero-weight checks carry the guarantee.)
- Serial = 4 threads = 4 shards merged (full records); a whole dry run gives the same final state serial, on 4 threads
  and as CLI `jobs` → 3 worker processes → `merge`; stopping after 2 steps and resuming from the checkpoint gives the
  same run as never stopping; every validation check used its own draw.
- Probes on 160 fights (goal diff vs heuristic, style): commit +0.000, 1.00; wait −0.172 ± 0.047, 0.64 (long-idle gate
  fails, no-contact 16% → 38%, idle penalty ×3.5); flank −0.151 ± 0.051, 0.91; regroup −0.138 ± 0.057, 0.35; disengage
  −0.275 ± 0.049, 0.47. Every non-commit probe is drift-flagged; the heuristic is not. Style and goal are symmetric
  under swapping the arms.
- Variance (heuristic, per fight): goal −0.31 (sd 0.63); components human 0.04 (sd 0.16), kill 0.04 (0.19), your
  animals 0.20 (0.25), harrier deaths −0.58 (0.46), idle −0.008 (0.016). Harrier deaths dominate both mean and variance.
  σ = 0.1 perturbations: paired per-fight sd 0.51 (realistic ones) vs 0.63 unpaired; fights for 2 SE detection: 0.05 →
  ~420, 0.1 → ~105, 0.02 → ~2,600.

### Pilot (Oct 2026, `logs/m3_pilot.txt`): harriers, linear mode, 6 pairs × 6 gens, 6.6 min + 1 min retest
Config: σ 0.1, Adam 0.08, margin 1, style threshold 0.9, λ₀ 1, baseline arm on. Calibration (300 fights × 5 arms):
heuristic goal −0.400 (sd 0.563), paired sd 0.362, realistic effect 0.074 → N train 100, val 95, test 95 (auto).

| gen | candidates' mean goal − heuristic (same fights) | best candidate | mean style | λ | non-commit | drift-flagged |
|---|---|---|---|---|---|---|
| 0 | +0.042 | +0.139 | 0.944 | 1.00 | 28% | 2/12 |
| 1 | −0.008 | +0.336 (flagged) | 0.902 | 0.82 | 54% | 6/12 |
| 2 | −0.013 | +0.063 | 0.830 | 0.81 | 64% | 5/12 |
| 3 | +0.001 | +0.147 | 0.996 | 1.09 | 53% | 2/12 |
| 4 | +0.004 | +0.072 | 0.944 | 0.71 | 53% | 3/12 |
| 5 | +0.005 | +0.098 | 0.992 | 0.54 | 50% | 2/12 |

Validation (centre vs best = zero, fresh 95-fight draws): after 2 updates −0.027 ± 0.048, after 4 −0.082 ± 0.070,
after 6 +0.047 ± 0.053: nothing accepted, so the official test is zero vs zero. Read-only retest of the final centre
on 600 fresh test fights: **−0.029 ± 0.019 (within 2 SE)**, style 1.00, no drift; it flanks on 44% of decisions (which
mostly ends in the usual dart from behind) and its telemetry barely moved (dart rate 9.6 → 9.1 per engaged minute,
distance 22.9 → 23.5 m, deaths per harrier 0.65 → 0.67). **Null result: nothing beats zero weights.**

What the pilot shows about the problem (more than about the optimiser):
- The goal's easy gains are unrealistic. The best candidate in a generation was usually drift-flagged: harriers that
  hang back (mean distance 23 → 34–38 m, dart rate 9.6 → 2–5, no-contact share 15% → 35–55%) die less (0.66 → 0.41–0.47
  per harrier) and so score up to +0.34. The style constraint and gates kept them out (λ rose when mean style fell
  to 0.83), and the anti-gaming no-contact term counts their circling as idle.
- Realistic perturbations move the goal by a few hundredths, and that is the size of the noise at 100 fights per
  candidate (paired sd 0.36–0.51): to resolve 0.03 at 2 SE takes ~600–1,200 paired fights. Next runs: N train
  300–400 via `fightsMin`, val/test ≥ 1,000 (`valMax`/`testMax`), more pairs (12–16), 20+ generations: ~2–3 h on
  4 cores, or one GitHub Actions matrix of 16 shards per step (~5–10 min per generation).
- Consider weighting harrier deaths less (or by HP lost) so the goal is less about self-preservation, and a richer
  style profile per species (hyena vs wolf) before trusting a positive result.

## Milestone 3, round 2 (Oct 26): headroom found
- **Probe** (`policy/probes/harrier_rules.js`, paired vs the heuristic): hand-written conditional rules for enemy harriers.
  `patient` (wait while stronger guards block the target and it isn't busy or easy) beat the heuristic: +0.047 ± 0.018
  on 800 fights, then **+0.061 ± 0.012 on 1,200 fresh fights**, style 1.00, no drift. Variants (wait when guards merely
  deter; regroup when alone) match. flankBusy, humanOnly lose; packUp, hitRun are neutral.
- **Why the pilot missed it:** zero weights + commit margin 1 means a σ=.1 perturbation almost never flips a decision in
  the right states; ES never sees the gain.
- **Fixes:** `--initRule=patient` warm start (the rule encoded in the linear term: +0.027 ± 0.013 vs zero on 800 fresh
  test fights) and smaller `--margin`. Sweep 2 (`policy/sweeps/m3_s2.json`) runs these on GitHub Actions next to sweep 1.
- **Compute:** `.github/workflows/train.yml` (public repo: free); each sweep entry trains on its own 4-core runner for up
  to 5.5 h and uploads `state.json`, its log and a report as an artifact; `resume_run` continues a sweep.


## Milestone 3, second archetype: your guards (Oct 2026)

Why guards: with full teams ~40% of the damage to you is collateral (an enemy elephant's sweep while it fights your
escort, then herd charges), and your guards idle ~40% of the time. The harness now takes `--arch=guard`; `harrier` is
unchanged (same features, intents, rewards and fight sets; existing state files load as before).

### Engine hook (sim.js, opt-in: `cfg.movePolicy.guard = weights`)
- `archetypeOf(u)` = `'guard'` for your side's animals that aren't carrying you (`!u.rider`; a ridden mount is never a
  guard, evasive mounts included). It applies in `'guard'` state and while engaged.
- `guardDecide` (decisions loop, before retargeting) asks `moveChoose` for an intent every 0.5 s (`GUARD_INTENTS`):
  0 **hold** = the heuristic; 1 **screen** = target the most threatening enemy (`guardThreat`: aimed at you, heading your
  way within 25 m, or within 12 m) and stand ~5 m from you on its line, fighting it once it arrives; 2 **intercept** =
  target the most threatening enemy aimed at / heading for you, chased with the usual gait; 3 **space out** = fight
  ≥ 8 m from you and from the far side of the target, so its sweeps and charges point away from you (in guard state:
  wait ≥ 9 m out); 4 **help ally** = target the strongest enemy on the most hurt of your animals in a fight
  (`guardHelpTarget`); 5 **fall back** = get back within ~3 m of you and only fight what is in reach there.
- Screen / intercept / help set `u.gT`, which `chooseTarget` keeps as the target until the next decision; screen / space /
  fall back steer through `guardGo` (engage branch, via the existing `intentMove` call) and `guardIdleGo` (guard state).
  Four call sites (one line each) plus the helpers next to the harrier hook; threat helpers use `sideSees` (teamSees
  without its lookout side effect) so features and decisions never change the fight.
- Checks (`harness_test.js` section 0): without `movePolicy`, 640 fights (160 guard + 160 harrier board fights + 320
  `check_identical.js` fights) identical to the pre-guard-hook engine (git 8f90345: event log, final positions / HP /
  states, end time); a harrier-only policy gives the same fights on both engines (guards untouched); a zero guard policy
  next to a harrier policy changes nothing. Zero weights (margin 1 and 0), always-hold and a zero output layer over a
  random hidden layer = no policy on every fight.

### Features (`move_guard_features.js`, 55)
Own HP / wound / stamina / morale / heat / battle drive, species class (cat, charger, big, small, pack), distance to
you, attackers on me; my target (distance, on me, on you, log strength ratio, sweeper, charging, locked in a fight);
you (HP, riding, targeted, how many on you, in contact, held), the main threat (distance to you and to me, strength ratio,
aimed vs coming); collateral risk (sweepers and chargers fighting within 12–15 m of you, enemies and fights within
10 m); allies near you / alive, enemies alive, the most hurt ally under attack (HP, distance); time, zone progress and
edge, in water, map one-hot, previous intent one-hot. Model: `move_model.js` with `nout` 6 (`zeros(nin, nh, margin,
nout)`); `move_arch.js` is the archetype registry (features, intents, which fights qualify).

### Rewards (`move_reward.js`, records from `move_run.js runGuardFight`, tagged `arch: 'guard'`)
- **Goal** (per fight): survival time / 300 (1 if you survive) − 0.5 · damage to you / your max HP + guards' damage dealt /
  20,000 − 0.03 per guard death − 0.05 per guard-minute standing by while the fight is on (idle, or "closing in" for
  > 10 s without contact = holding a spot). Heuristic per fight: 0.16 (sd 0.75): surv 0.49, human −0.33, dealt 0.22,
  deaths −0.17, idle −0.05.
- **Style**: per species class (cat / canid / charger / big / other) fight and idle shares and share of time within 8 m
  of you; pooled close / flee shares, mean distance from you; signature rates per guard-minute (hold, knockback, dodge,
  sweep, pounce). **Gates**: a cat body-blocking a big herbivore (> 3× its mass) face to face for > 3 s; a guard glued to
  you (< 4 m, not fighting) for > 2 s while something is on you. Up-only: standby share. Drift-only: death and withdraw
  rates. Reported, never graded or flagged (`kind: 'info'`, what the goal is meant to move): survival, damage to you,
  collateral damage and share, damage dealt. Same Lagrangian, thresholds and acceptance rules as the harriers.
- Fights: player-like budget-fill teams ($1,200) on `A.dealBoard` boards, default mount, the policy on every guard;
  same seed pools, paired seeds and `holdMap` as the harriers (a fight qualifies if your team has a guard).

### Headroom probe first (`node policy/guard_probe.js 800`; `logs/m3_guard_headroom.txt`, ~3 min on 3 threads)
800 paired fights per arm vs the heuristic (survival 143.5 s, win 35.1%, damage to you 198 per fight of which 80
collateral, 5.5 guard deaths):

| arm | survival (s) | win (pts) | dmg to you | collateral | goal | style |
|---|---|---|---|---|---|---|
| always screen | +2.3 ± 4.1 | +2.0 ± 1.7 | −3 ± 5 | +2 ± 5 | +0.005 ± 0.024 | 0.96 |
| always intercept | −19.6 ± 4.1 | −7.5 ± 1.6 | +23 ± 5 | −19 ± 5 | −0.123 ± 0.024 | 1.00 |
| always space out | −12.3 ± 4.1 | −6.1 ± 1.7 | +20 ± 5 | **−15 ± 5** | −0.109 ± 0.024 | 0.85 |
| always help | −16.1 ± 4.7 | −1.4 ± 1.8 | +6 ± 5 | −33 ± 5 | −0.033 ± 0.027 | 0.98 |
| always fall back | −69.4 ± 4.3 | −22.6 ± 1.7 | +69 ± 5 | +85 ± 5 | −0.444 ± 0.025 | 0.66 |
| space unless targeted, then intercept | −24.5 ± 4.1 | −10.0 ± 1.6 | +30 ± 5 | −16 ± 5 | −0.169 ± 0.024 | 0.89 |
| screen when a predator targets you | −0.7 ± 3.9 | +0.4 ± 1.6 | +2 ± 5 | +3 ± 5 | −0.016 ± 0.023 | 0.96 |
| space out when a sweeper/charger fights near you | −0.7 ± 1.9 | −0.9 ± 0.8 | +3 ± 2 | −1 ± 3 | −0.008 ± 0.010 | 1.00 |
| intercept whatever targets you | −22.3 ± 4.0 | −8.1 ± 1.6 | +24 ± 4 | −10 ± 5 | −0.138 ± 0.023 | 1.00 |

The only positive arm, always screen, did not hold up on 2,400 fresh fights: −3.8 ± 2.6 s, win −1.2 ± 1.0 pts.
**Nothing simple beats the heuristic.** Spacing out does cut collateral damage (−15 ± 5 HP per fight, about −19%), but
the hits it saves come back as direct attacks on you (+35) because the guards are no longer between you and the threat.
Intercept and help trade collateral for direct damage the same way. Collateral damage is a symptom of guards fighting
next to you, and that is also what keeps things off you. A learned policy would have to time these intents (space out
only when nothing is coming for you, screen only when the threat is a predator and nobody is on it); the conditional
rules tried here were neutral at best. Treat the sweep as a long shot unless the features expose something the rules
missed.

### Tests (`node policy/harness_test.js`, 65/65 pass, ~9 min on 4 cores; `--quick` ~4 min; `--arch=guard` for one)
Every check in sections 1–4 runs for both archetypes: zero = heuristic (4 variants), the hook is live for a non-zero
policy, serial = 4 threads = 4 shards (full records), whole dry runs serial = threads = CLI jobs/workers/merge, resume =
no resume, fresh validation draws, the model shape in the state, probes, style symmetry, variance and N, disjoint seed
pools, `holdMap`, player-like teams within budget, the heuristic not drift-flagged. Guard-specific: always space out cuts
collateral damage to you (160 fights: 65 → 54 per fight, −11 ± 12; survival −23 ± 10 s, beyond 2 SE, so it **hurts**
survival), always fall back is clearly worse and fails style (0.66), holding a spot beside you counts as standing by
(standby share 25% → 39%), and screen / space / fall back get drift flags. Intercept gets none: it only re-picks targets,
the way the heuristic does. Guard per-fight noise: goal sd 0.75, paired sd ~0.4 → ~280 fights for a 2 SE detection of
0.05 and ~1,700 for 0.02.

### Sweep (`policy/sweeps/m3_guard_s1.json`, 8 runs)
Linear ×3 seeds, linear σ .25 / lr .15 and σ .05 / lr .04, MLP nh 16 ×2 seeds and nh 16 σ .25 / lr .15; 16 pairs × 60
generations, validation every 4 at 1,000 fights, test 1,200. Run with the `train` workflow, `sweep:
policy/sweeps/m3_guard_s1.json`. Locally: `node policy/train.js init run/g.json --arch=guard [...]` then `run`.

## Milestone 3, round 3 (Oct 26): it works, shipped
Sweeps on GitHub Actions (each run on its own 4-core runner; results in the `training-results` branch):

| sweep | runs | significant gains on 1,200 held-out fights (goal vs heuristic) |
|---|---|---|
| m3_s1 (harriers, cold start) | 12 | 5: lin_small +0.083, mlp16 +0.053, mlp8 +0.053, lin_s2 +0.049, lin_s3 +0.028; 6 collapsed to 0 |
| m3_s2 (harriers, warm start / margins) | 8 | 4: **warm_s1 +0.136 ± 0.015**, warm_full16 +0.078, warm_s2 +0.075, warm_m25 +0.041; big σ and m≤.25 collapsed |
| m3_guard_s1 (guards) | 8 | 2: **g_lin_big +0.107 ± 0.017**, g_lin_small +0.101 ± 0.020; the rest collapsed |

- **Collapse:** a run whose early candidates drift in style gets pushed by λ toward "always commit/hold"; the weights
  grow until no perturbation flips a decision (non-commit 0%, val 0.000 ± 0.000 forever). Warm starts and small σ
  avoid it. Fix to try next: clip |θ| / decay toward the start, or a stochastic policy during training.
- **Independent checks** (`policy/probes/eval_state.js`, `eval_guard.js`, current engine, fresh seeds):
  harrier_v1 +0.118 ± 0.016 vs heuristic, +0.073 ± 0.016 vs 'patient' (style 0.96; drift: they keep ~30 m instead of
  22 m and close more — a pack regrouping, 44% of decisions); guard_v1 survival +13.3 ± 2.9 s, win +7.5 ± 1.2 pts
  (help the most hurt ally 55%, hold 45%).
- **Shipped** as the live default (`policy/live.js`, weights in `policy/weights/`), bundled into index.html.

