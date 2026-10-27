# Wild Arena

An autobattler built from the "You have $1,000 — build a team of animals to protect you from the rest"
meme. **Board model (Oct 2026):** each game deals a random board of animals from the roster; you draft from
it on a fixed budget, and **every board animal you don't pick is on the other side** (`RULES`, `dealBoard`
in sim.js; `cfg.board`). With `RULES.total` set, every board's prices add up to the same total. Score is
**time alive, capped at 5:00** (surviving to 5:00, clearing the board, or the other side giving up all
count as 5:00). Live site: GitHub Pages serves `index.html` from `main`.

## Working with the owner (distilled Oct 27 from many sessions; follow unless told otherwise)
- **Autonomy is the default.** The owner sets direction in short messages, often from a phone, then leaves ("drive the open
  tracks forward and push to live"). Verified work (tests pass, balance validated, determinism checked) gets merged to main
  without asking. Report results when back, outcome first, in plain words.
- **Riffs are design input, not orders.** "Idk", "maybe", "just riffing" means: capture it, judge it, and propose. A new mode
  or big feature gets a short design doc (`research/`), then a playable prototype **behind a URL flag** (`?five=1` style).
  It never goes on the main screen until the owner has played it. Half-baked features get switched off, so don't ship one.
- **Realism first.** Real animals only (extinct is fine if it really lived; real proportions, e.g. a turkey-sized
  feathered Velociraptor). Every number and behaviour needs a source, and every animal needs one distinct visible
  signature ("Smash Bros roster").
- **The fantasy is being the underdog.** Don't make the game easier to fix a problem. Ask before changing difficulty knobs:
  budget, board total, rare rate. Fix balance through variety and pricing. "Good animals are too good" is a known problem,
  so dominant picks get made rarer or countered, never buffed around.
- **Don't change knobs the owner didn't ask about.** When a proposal moves a number they care about, explain the why in
  one or two plain sentences ("the total is the other side's budget, so...").
- **Science wording:** a null result is "none found **so far**", never "there's no headroom". Keep trying with better setups.
- **Mobile first.** The owner plays and screenshots on a phone (~412 px). Check every UI change with a Playwright
  screenshot at phone width and look at it, not just for page errors.
- **Bug reports are terse** ("this is broken", "the streak was wrong"). Reproduce, fix the most likely cause, and say the
  assumption in one line, so they can correct it if it's wrong. Don't block on clarifying questions.
- **One decisions list.** Keep the owner's pending decisions in `DECISIONS.md` (with a recommendation each) instead of
  repeating questions across messages. End a report with at most a 3-item "needs you" list pointing there.
- **Pricing rules:** $100 steps, the elephant stays affordable ($700 cap), budget $1,200. Re-measure after any roster or
  behaviour change.

## Files
- `sim.js` — the whole simulation engine. Pure JS, no DOM, deterministic per seed (`rng(seed)`).
  Exports `window.Arena` in the browser and `module.exports` in Node.
- `ui.js` — the game UI (arena → draft → deploy → fight → lab), canvas rendering, Lab batch runs.
  Mobile UX pass (Oct 27, `research/ux_audit/`): a sticky bottom action bar (`renderActBar`) carries each step's next action
  (Fight straight from the draft with auto formation, Skip to result, Play again / New board); `audit.js` re-measures taps
  and scroll on phone/360/desktop, `modes_check.js` checks the hidden modes, daily and share links through the bar.
- `template.html` — page shell + CSS with placeholders `/*FACES*/`, `/*SIM*/`, `/*UI*/`.
- `faces.json` — 28 base64 portraits (112×112) keyed by species id, cropped from public-domain/CC0 (giant kangaroo: CC BY 3.0)
  Wikimedia Commons images (the original meme crops were replaced: unknown rights). `CREDITS.md` lists each
  source; `build.js` turns its table into the in-game Image credits panel. Pack items reuse their species' face.
- `build.js` — `node build.js` assembles everything into the single self-contained `index.html`.
  **Always rebuild and commit `index.html` after changing sim.js/ui.js/template.html** — Pages serves it.
- Analysis tools (Node, use `worker_threads`, 2 workers):
  - `quick.js [teams] [seeds]` — ~1-minute tuning probe on a fixed sample of full-budget teams: how much
    of the variance is team vs map, each animal's value (seconds) per map, leading teams per map.
  - `tourney.js` — exhaustive tournament over all legal $1,000 teams with successive halving
    (screen → top 80/map × 100 runs → top 10/map × every mount × 200 runs). ~45 min. `analyze.js` reports.
  - `budget.js` + `budget_report.js` — budget/price schemes: screen every full-spend team, then the top
    25 per scheme get 100 runs per map. Team results don't depend on prices (the other side is always
    "everything not picked"), so screens are shared across schemes.
  - `idle.js` — measures time-to-first-hit, longest idle stretch and early "gave up" endings per map.
  - `camp.js [teams] [seeds] [gridSeeds]` — camping/anti-pattern probe (4 workers, ~3 min at 200 4 12):
    how fights end, how long the other side presses, tree/ride time, enemies loitering without a target;
    then an exploit search over your start position, with the best spot re-checked on 40 fresh seeds.
- `board.js [boards] [screenSeeds] [verifySeeds] [sizes] [budget] [total]` — board validation: deals boards with
  the game's `dealBoard` (env `PRICES=` candidate prices, `RAREP=`), screens every full-spend team on each
  board, re-runs the best 3 on fresh seeds, reports how winnable boards are.
- `price_abs.js [N] [out.json] [ids]` — **the pricing measurement to use.** Controlled experiment per catalog
  item: the same random base boards, 3-animal base teams and seeds with the item absent, on your side, on
  theirs; swing = mine − theirs ± paired SE (~4 min for all items at N=240). `price_scheme.js <abs out> <s per
  $100> <giant cap> <out>` turns it into prices ($100 steps, min $100, giants capped) and a board total.
- `price_board.js <config.json> <out.json>` — (superseded: biased) board-mode regression pricing: random boards + player-like random teams, one
  fight each; least-squares fit of each animal's swing value (seconds gained by moving it from their side to
  yours), proposed prices ∝ swing ($100 steps, min $100). Note: the older whole-roster tools (`quick.js`,
  `camp.js`, `budget.js`, `tourney.js`) predate the board model and now fight all 22 animals.
- `migration.js` — the roguelike **Migration** mode (**switched off in the UI by the owner, Oct 26, until properly designed**; `?migration=1` shows it; `MIG_ON` in ui.js)'s rules (pure JS, bundled by `build.js` after sim.js as
  `window.Migration`): 7 fights, money, carry-over wounds, trading post, boons, escalation (`MIG` constants).
  Engine hooks in sim.js `setup` (all opt-in; absent = byte-identical, checked on 80 fixed fights with and without the
  live policies): `cfg.startHp = {id: fraction | [fraction per surviving pack member]}` (array length = group size),
  `cfg.humanHp`, `cfg.boons = [ids of BOONS]` (read as `w.bn` in strike/heat/speedOf/canSee/morale/allyTarget), and
  `dealBoard` `rules.exclude` (ids never dealt). `migration_bot.js [runs] [workers]` = greedy-bot balance probe
  (env `MIG='{...}'` overrides constants). UI: arena "Migration" panel, `s-mig` run screen, the draft screen doubles as
  the trading post; the run lives in localStorage `wa-mig` (resumes after reload), best `wa-mig-best`, daily
  `wa-mig-daily:<date>`. A fight's result is applied the moment it's simulated.
- `BACKLOG.md` — every idea captured so far (realism, anti-camping, pricing, herds, maps, animals,
  mechanics, replayability) with status and suggested order. Add new ideas there.

## Methodology rule
Don't rank teams on a few runs each. **Screen cheaply, then simulate contenders many times** (100+ per
map) with fresh seeds, so screening luck doesn't carry into the final numbers. Use common seeds within a
round. Report ± standard errors.

## Engine summary (sim.js)
100 × 66 m field, 0.1 s ticks. Units are circles (radius from mass). Health = 22·mass^0.6.
- **Damage pipeline:** base × mass ratio^0.2 × environment (heat/cold/water) × morale × momentum
  (chargers up to +70%) × situational (ambush ×1.7/×2 forest, pounce ×1.4, cornered, buffalo vs lion,
  gorilla guarding you, maul every 3rd swipe ×2, elephant sweep 35% to others) × **mobbing**
  (+15% per extra attacker, −10% armor each) × **flank** (chargers turning or hit from behind: ×1.25,
  half armor) × (1 − armor·(1 − pierce)).
- **Gaits:** charge (rhino/buffalo/bison/hippo commit to a line, overshoot, wheel), stalk + pounce
  (tiger 9 m, jaguar 7, cougar 12), rush (lion), orbit + dart (wolf, hyena), lunge (croc), keep-away
  (giraffe), lumber (elephant, bears, gorilla).
- **Height:** each animal has `strikeH`; riders sit at the mount's `mountH`; trees 4.5 m. Small mounts
  (<700 kg) and the giraffe evade instead of fighting. Overheated mounts kneel (you climb down);
  panicking mounts throw you 50% of the time.
- **AI:** predators score targets by meat × vulnerability ÷ guard deterrence; herbivores engage within
  a radius that grows with agitation and time pressure; your guards rank threats by intent × strength.
  Morale breaks → flee; broken twice / <30% HP → enemies rout out of the arena, yours withdraw.
- **Other side is one team.** No infighting except rare rival feuds (lion–hyena, buffalo–lion).
- **Swimming:** each animal has `swim` = deep-water speed in m/s (hippo 2.5, polar 3, croc 5, big cats ~2,
  elephant 1.5, gorilla .5, you 1), with the usual fatigue/heat/slow multipliers.
- **Wounds:** below half health an animal loses up to 30% speed and 20% damage (on top of the morale hit).
- **Packs:** `pack` animals (lion, wolf, hyena) are nervous alone (−.12 morale) but bolder with another pack
  animal within 15 m (+.1 each, max +.2), converge on a packmate's target, and don't spread out as guards.
  Natural rivals (lion–hyena) never count as packmates.
- **Opportunists:** predators value targets already locked in a fight (×1.5) or badly hurt; a guard that's
  busy fighting only deters half as much.
- **You fight back:** on foot, you kick/punch whatever is on you (weak, but it can finish something).
- **Closing arena** (wild mode, `cfg.hazard:false` disables): from 30 s to 180 s (was 60–240 s) the safe box shrinks from the
  whole field to 36 × 24 m around a point near mid-field (random per seed). Outside: fire (savanna, forest;
  2.5% max HP/s + heat), flood (river; slows non-swimmers, non-swimmers lose 1.5%/s), blizzard (tundra; slow,
  stamina drain, 1.2%/s). Everyone steers inside except routing animals. "They gave up" only counts after
  the arena has fully closed. `zoneAt(w, t)` gives the box for rendering.
- **Morale from losses** is species- and proximity-based: a death shakes its own kind fully and anything within
  15 m that saw it (0.4); it no longer demoralizes the whole side (that made weak animals and packs liabilities).
- **Roster (28 species, 34 picks with packs/herds):** the original 16 plus black rhino (1.2 t, irritable blind charger — the white rhino is now
  placid, no `blindCharger`), fighting bull (`bred`: always worked up), moose (snow-proof, strong swimmer,
  front-hoof stomper), ostrich (lookout + kicker, fast evasive mount), honey badger (`fearless`: morale never
  breaks, takes on anything), and the rare triceratops (`rare`, `giant`: 8 t charger, rideable at 3 m; only
  on ~10% of boards). Hippo armor .5 (5–6 cm skin). Polar bear `snowCamo`: hard to see beyond 15 m on tundra.
  Then (26): rare woolly mammoth (`sweep` like the elephant, cold-proof, heat-intolerant), black bear (timid,
  climbs), leopard (ambush stalker, climbs), wild boar (cheap tusked charger, `standsGround`).
  Then (27): rare giant kangaroo (Procoptodon, 230 kg; zoology-reviewed). `boxer`: grabs a lighter attacker (stun .7,
  ×.6) then kicks ×1.4; the kick shoves anything under 1.5× its mass back up to 1.5 m. `kicker` on the other side
  (doesn't hunt you) but boxes freely on guard; `drowner`: chased by a lighter predator it heads for water within
  30 m and holds swimmers under (2.5 s, 3% max HP/s); `thumper`: first predator sighting gives its side 8 s of
  ×1.25 vision (`w.alarm`); sidesteps much bigger herbivores like the cats. $100, swing 18 ± 4 s.
  Then (28): rare Smilodon fatalis (260 kg, zoology-reviewed; spd 14, stam 4, strikeH 3 so it can't reach riders on
  giants, no climbing). `pinStab`: forelimb pin (hold dmg ×.4, shake-off ×.6), after 1.2 s pinned (or on a stunned
  target) a killing stab ×3, half armor, 8 s bleed, then it lets go and circles at 8 m (`backT`) while it bleeds.
  Canine break 3% (+30% unheld or big fresh prey, +35% armor ≥ .45): dmg ×.7 for good. `bigGame` prey ×1.5 at
  1.5–4× its mass; avoids armor ×.3; cougar yields to it. $100, swing 27 ± 4 s (mine +17 vs tiger +14).
- **Light-pick identity pass (Oct 26, subagent; ROSTER.md has the table):** one visible signature each, a `sig()` counter,
  no stat changes. Tags: `musk` (honey badger: a predator that bites it or closes to touch reels away, flees 2.5–4 s and
  ignores it 15 s via `repelBy/repelUntil`; 12 s cooldown), `clawKick` (ostrich: kicks on ≤ 4× its mass bleed 6 s and
  stun/shove; it kicks what comes for you within 8 m), `napeBite` (cougar: a pounce on prey ≤ 5× not facing it ×1.5,
  half armor, stun 1.2 s), `swimStalk` (jaguar: unseen beyond 7 m in water, re-arms its ambush there), `tester` (lone wolf:
  nips herbivores ≤ 1 t coming your way, kites just ahead of a > 3× chaser, away from you), `boneCrush` (hyena, replaces
  its hamstring: +10% lasting `limp` per bite up to 40%, prefers lamed prey), `repeatBluff` (black bear: up to 3 mock
  charges; a rattled target its size is run off), `chestBeat` (gorilla: something coming for you within 14 m → nearby
  enemies −.2 morale and those under 2× its strength switch onto it; 12 s cooldown), `upends` (boar: a charge hit on
  ≤ 2.5× its mass stuns 1 s and breaks the target's hold), `backLeap` (lion: latches onto non-predators up to 6× its mass
  that are busy fighting its side), `hiddenGuard` (your leopard on guard, ambush ready: unseen beyond 6 m and not counted
  by `guardsAround`). Sources: musk/loose skin (Latest Sightings; Science Focus), ostrich claw kick (Africa Freak),
  cougar rear attack + nape bite (ExplorersWeb; Seattle Times 2000), jaguar swimming up to caimans (NatGeo 2013;
  Roundglass), lone wolves on moose/bison (Wikipedia: Hunting behavior of gray wolves), hyena endurance (Holekamp Lab),
  repeated bluff charges (bear.org; USFS), chest beats signal size (Wright et al. 2021, Sci. Rep.), boar posterior-thigh
  tusk wounds (Wilderness Environ. Med. 2018 case), lions on a buffalo's back (Singita 2026), leopard concealment.
  Rates/fight (`audit.js 100 1200`): musk .06, claw kick .42, nape bite .12, water ambush .11, leads a chase .39, cracks
  bone 1.2, drives it off .12, upends .65, chest-beat .64, leaps on its back .09, springs from hiding .09. Swing
  (price_abs N=240, paired): lion +8, leopard +7, gorilla +5 (mine +12), jaguar +3, others within ±4 except lone hyena
  −7 ± 5; big enemies' "theirs" rose 4–10 s (no single mechanic > 4 s). Boards without these species: byte-identical.
- **Pack items:** `wolfpack` ×4 (dealt 3 in 4), rare `wolfpack6` ×6, `hyenapack` ×4, `lionpack` ×2 (coalition),
  `buffaloherd` ×3, `bisonherd` ×3 are extra catalog entries (`species` points at the base animal, `group` = size,
  `dealWeight`; `sp(s)` gives the species for rivals/yields/snow checks). A board deals each species once, solo or
  as a group. One pick brings the whole group; left on the board, all of it is
  against you. Whole-roster mode (no `cfg.board`) ignores pack items.
- **Croc:** on a map with water it only takes prey within 5 m of the water and lurks submerged otherwise (it
  used to walk out and spend 86% of the fight on land). Away from water it bites as hard as ever but moves at
  70% and tires fast. Cold-blooded animals (cold < .3: the croc) are never dealt on the tundra.
- **Realism audit (Oct 2026, two zoology reviews + `audit.js` behavior telemetry):**
  - Other-side herbivores notice you by sight (`canSee`) or by sound/smell of movement within 30 m.
  - Mock charges via `bluff` + `bluffP` (gorilla always; elephant/mammoth .6, black bear .7, grizzly .5,
    black rhino/bison .3), never against a grudge or while guarding you.
  - `vindictive` buffalo: 40 s grudge, steadier morale. Gorilla guardian: morale floor while you're targeted.
  - `stomp` (moose), `submerges` (hippo hidden at 10 m), `chasesMovement` (bull), `looseSkin` (honey badger:
    5× shake-off, half hold damage), per-species `latchMax` (tiger/cougar 4, jaguar 3.5, lion 3),
    `yieldsTo` lists (cougar to bears and wolf packs; leopard to lion, tiger, hyena).
  - Pack bonds are same-species only; `packStrength` (an animal + packmates within 15 m) drives a pack's
    choice of prey and lets your packs engage big threats. Hyena clan ×4; two lions = "Lion coalition".
  - `aggr` now matters for predators (commit threshold scaled by .4 + aggr). Stalkers break cover and run
    when the prey flees or turns on them; stalkers have tall-grass cover on the savanna (12 m).
  - **Waiting for an opening** (`waitForOpening`): an enemy predator facing a target ringed by stronger guards
    circles ~16 m out until a guard is busy, the target is hurt or running, or its patience runs out.
  - Croc drags held prey lighter than itself into the water. White rhino placid and yields to elephants.
  - **Default mount = a giant (`defaultMount`: mountH ≥ 3) else on foot**: riding a rhino/hippo/bison/moose/
    giraffe measured worse than running on foot; riding a giant is much better (ELE team 84% vs 63%).
- **Map variety** (`mapVariant(tid, seed)`, `cfg.mapSeed` / `cfg.seed`; `cfg.variant:false` = exact old map):
  savanna waterhole ~44%, river width/ford jitter + a third ford ~36%, forest 22–38 trees, clearing ~39%,
  pool ~29%, tundra deep/light snow ~25%/27% and a half-frozen lake ~44% (cold water slows and drains
  stamina by cold tolerance). World water is `w.band` (river) + `w.ponds`; `w.wet` if any.
- **Trees:** animals steer around trunks and detour when wedged; an elephant pushing a trunk ~1 s knocks it
  over (`w.fallen` keeps the time, so replays show it standing until then).
- **Maps:** savanna (sun climbs: heat ramps for everyone; acacia shade), river (vertical river x 47–57
  with two fords; swimmers start in it; land animals wade at 40%; charges founder in deep water;
  submerged croc nearly invisible until 7 m), forest (vision ×0.55, ambush ×2, chargers crash into
  trees), tundra (deep snow slows by weight — elephant 53% — and cold drains stamina).
- **Deployment:** drag anyone, including you, anywhere on your side (`zoneFor`). Within `ESCORT_R`
  (9 m) of you = escort; farther = guard post that defends a 14 m radius (`POST_R`).

## Findings so far (current engine)
- The elephant is the dominant pick on every map and the other side's top killer when you don't take
  it (trunk reaches any rider height; one hit kills a human). Accepted as realistic.
- Rhino was a second "must pick" before the map overhaul; now strong mainly on the savanna.
- $1,200 named-team win rates (100 runs/map): Elephant+Rhino+Tiger+Grizzly 100%; Elephant+Rhino+Hippo
  ("big three") 92% (tiger/jaguar leap onto your elephant); no-elephant teams ≤ 9%.
- Budget schemes (top-25 contenders, 100 runs/map):
  - $1,000 current prices: best 93%, median 74%.
  - A: $1,200 current prices: best 99%, median 94% (too easy).
  - B: $1,200, elephant $600: identical to $1,000 for elephant teams.
  - C: $1,200, elephant $700, rhino $500: best 65%, median 42%, **different champion on every map**.

## Engine v2 (Oct 2026): swim speeds, jaguar 16 / cougar 18 m/s, wounds, packs, opportunists, closing arena
- Measured with `camp.js 200 4 12`: "gave up" share of 5:00 results 67% → 29%; no tree exploit; start-spot
  advantage only for weak teams (+7 to +11 s, teams that die by ~30 s anyway).
- Named teams (80 runs/map, old → new win%): ELE+RHI+TIG 84/95/98/79 → 78/73/89/74; ELE+RHI+HIP ~91 → 95/91/89/84;
  ELE+BUF+GRZ+HYE ~67 → 53/53/78/51. Elephant still dominant (+74/+79/+139/+84 s value). Pricing is next.

## Camping probe (post-audit engine before v2, Oct 2026, `camp.js 200 4 12`)
- No player-side camping exploit: corner/back-wall starts help weak teams slightly (+4 to +18 s) and strong
  teams not at all; >10 s in a tree always ended in death.
- The "they gave up" ending is honest: with it switched off, 97%+ of would-be quiet wins still reach 5:00.
- The real issue is the other side stalling: 67% of 5:00 results are "gave up"; strong teams settle the
  fight in ~1.5–2 min, then ~6 enemies loiter targetless. Fix ideas in BACKLOG.md §2 (before pricing).

## Learned predator targeting (policy/, milestone 1 done Oct 2026)
- Opt-in hook: `cfg.policy = weights` (net picks enemy-predator targets) or `{teacher:true}` (heuristic through
  the hook); without it the engine is byte-identical. Require `policy/policy.js` to load the chooser.
- 61-feature options (none / feed / each candidate), shared MLP 61→32→1, argmax. Behavior-cloned from the heuristic:
  99.0% held-out agreement; 400 paired fights match within noise. `policy/README.md` has the milestone-2 plan
  (evolution strategies + realism penalty; needs ~200 fights per candidate; overnight-scale compute).
- `predCandidates` in sim.js mirrors `predatorTarget`'s eligibility filters: change both together.
- Milestone 2 (Oct 2026): BC retrained on the current engine (63 features, 98.9% held-out, paired eval within noise).
  ES (full net and a 39-dim linear skip term), directed probes and a validation-gated walk found nothing that beats BC on
  fresh fights within the realism gates (final 400 fresh fights: reward −0.000 ± 0.094); no `es_weights.json`. Target
  choice alone has little leverage (even "always attack the human" gains only ~4 pts of kills while losing damage);
  next: give the policy actions such as "wait for an opening". Details: `policy/README.md`, tools `es.js`, `probe.js`,
  `gates.js`, `run.js`. sim.js has a stat-only `st.foe` (damage to your side).
- Milestone 3 harness (Oct 2026): opt-in `cfg.movePolicy = {harrier: weights}` (movement intents commit / wait / flank /
  regroup / disengage for enemy orbit-gait packs; zero weights = heuristic), goal + style rewards with a Lagrangian, a
  sharded ES trainer (`policy/train.js` + `train_worker.js`, plain JSON, resumable) and `policy/harness_test.js`.
  Usage, sharding and pilot results: `policy/README.md` "Milestone 3 harness".
- **Milestone 3 shipped (Oct 26): the live game uses learned movement policies by default** (`policy/live.js` loads
  `policy/weights/harrier_v1.json` + `guard_v1.json`; `setup` applies them unless the cfg sets `movePolicy` or
  `livePolicy:false`; `build.js` bundles the modules + weights into index.html). Opting out is byte-identical to the
  heuristic engine; the harness and Milestone 2 tools opt out so their baseline stays the heuristic.
  - Enemy wolves/hyenas (`harrier_v1`, warm-started from the 'patient' rule): +0.118 ± 0.016 goal vs heuristic on fresh
    fights (+0.073 vs 'patient'); they regroup before going in (44% of decisions), die less, kill you +2.3 pts.
  - Your guards (`guard_v1`): survival +13.3 ± 2.9 s, win +7.5 ± 1.2 pts (1,200 fights, live engine); they pile in to
    help the most hurt ally (55%). Hand-written guard rules found nothing; the learner did.
  - **Enemy big cats (`cat_v1`, shipped Oct 27; cat intents, `set:'cat'`)**: sweep `m3_cat_s1` run cat_cp_c1 (warm start from
    the cougarPounce rule, `--thetaClip=1`). Test +0.097 ± 0.024 vs heuristic; fresh re-checks (`policy/probes/eval_arch.js`)
    +0.080 ± 0.021 (1,500, probe 41) and +0.053 ± 0.017 (2,000, probe 53), style 1.00, no gate or drift. They creep closer on
    74% of decisions (commit 24%) and kill you +3 pts more often. Fights without an enemy cat are byte-identical. The cats'
    'no headroom found so far' held for hand-written rules only: the learner found it.
  - Training runs on GitHub Actions (`.github/workflows/train.yml`, sweeps in `policy/sweeps/`); `collect.yml` copies
    results to the `training-results` branch (artifact storage isn't reachable from the dev container).
  - GCP spot training: `policy/gcp/gcp.js` (launch/status/resume/stop/collect, failure handling in `policy/gcp/README.md`);
    needs GCP_PROJECT + GCP_SA_KEY in the environment.
  - Other-side archetypes (Oct 26, opt-in, not live): `cat` (stalk/rush), `charger`, `bulldozer` (lumbering herbivores),
    `brawler` (lumbering predators), `kicker` (keepaway); croc heuristic. Per-gait intent geometry `INTENT_GEO` in sim.js,
    `policy/move_arch_features.js`, `probes/arch_rules.js`. Probe winners confirmed on a fresh draw: bulldozer flankBusy
    +0.170 ± 0.030, brawler patient +0.067 ± 0.021; cats: no headroom found so far (generic intents, hand-written rules only). Sweep `policy/sweeps/m3_arch_s1.json`.
  - Cat intents (Oct 26, opt-in: weights with `set:'cat'`): `CAT_INTENTS` pounce / creep / abandon / soften / cover / blindside, features
    `policy/move_cat_features.js`, probe `policy/probes/cat_rules.js`: no rule confirmed at 2 SE yet (cougarPounce +0.008 ± 0.005 twice,
    directional); learning next: sweep `policy/sweeps/m3_cat_s1.json`.
  - Lesson: ES from zero collapsed (the style penalty drove every candidate back to "always commit", then exploration
    died: |θ| grew, non-commit 0%). Warm starts and small σ work; big σ collapses.

## Pricing findings (Oct 2026)
- The regression in `price_board.js` is biased in board mode: with budget-fill teams, a cheap animal left on
  their side mostly means you bought big animals, so cheap animals looked worth −10 to −43 s. Controlled
  measurement (`price_abs.js`) shows every animal is worth something: elephant 190 s, triceratops 172,
  mammoth/rhino/hippo ~108, black rhino/bison 83, moose/buffalo ~68, polar 59, bull 57, hyena clan 54,
  croc 46, lion coalition 44, tiger/grizzly 42, giraffe 36, … leopard/cougar 10, honey badger 8, lone wolf 2.
- Owner rule: the elephant must stay affordable (strictly proportional pricing would put it at ~$1,900), so
  giants are capped (`price_scheme.js`).
- **Adopted scheme (in sim.js):** 20 s of swing per $100, giants capped (elephant $700, triceratops $800), herds $700
  (buffalo herd 188 s, bison herd 198 s), $1,000 budget, every board dealt to $2,800 (±$100). Validation, 16
  fixed-total boards, top 3 per board re-run on 24 fresh seeds: median board's best team $900 → 50%, **$1,000 → 75%**
  (min 50, p25 63), $1,100 → 92%; boards with/without the elephant both 75%; 14 distinct best teams over 16 boards;
  typical full-spend team ~84 s. Runner-up: 25 s per $100 at $800 / board $2,400 → also 75% but coarser, a
  29% board, and not the meme's $1,000.
- **Budget raised to $1,200 (owner: $1,000 felt hard)** after the less-idle changes: median board's best team
  92% (min 50, p25 83), typical full-spend team median 169 s (vs 84 s at $1,000), 56% of teams win at least one
  screen run, 15 distinct best teams over 16 boards. $1,100: best 88%, typical 101 s.
- **Current prices (after the species-based morale fix, `abs_r5`):** 24 s of swing per $100, giants/herds capped
  at $700 (triceratops $800), board total $2,800, budget $1,200. Validation: median board's best team 88% (min 50,
  p25 83; with/without elephant both 88%), typical full-spend team median 167 s, 51% of teams win at least one
  screen run, 13 distinct best teams over 16 boards. `MEASURED` (written by `apply_values.js`) keeps each animal's
  measured mine/theirs; the cards no longer show it (owner, Oct 27: they show the signature move and your own record).
- **Battle drive + contextual targets (Oct 2026, owner: every animal is there to win the fight):** `drive(u)` builds
  from 3 s of idleness over 12 s (`u.idleT` drains, doesn't reset; the other side starts at 6). It widens herbivores'
  notice radius (+60 m, hearing the fight) and their interest in you, lowers predators' commit threshold (a sated one
  hunts again), and lets your guards range +30 m. Kickers on the other side now fight. Herbivores mob a predator only
  when it's within 12 m or coming for them. Guard cats jump on big herbivores `locked(e)` in a fight with your side.
  Idle (audit, $1,200): yours 53.5% → ~40%, theirs 33.8% → ~23%. Cost: cats' value on your side fell (~+5–15 s).
  Ridden-mount experiments: evading with a non-giant mount made riding worse (reverted); giraffe/ostrich getaway ride
  (rarely throws you unless grabbed, kicks while carrying) is neutral within noise.
- **Elephant is a rare (owner, Oct 27: more variety; keep the board total, the underdog side is the game):** `rare:true`, so it's
  dealt only through the rare slot (~8% of boards, was 56%). Same prices, board total $2,600. Validation (16 boards, `RAREP=.3`):
  median board's best team 88% (min 33, p25 75), typical full-spend team 160 s, 16 distinct best teams over 16 boards, no
  elephant in any; best teams spread over rhino 6, hippo 6, tiger 4, giraffe 4, croc 4 (was elephant 5, rhino 4). For
  comparison, total $2,500 gave 96% / 181 s (not adopted: it would make the other side weaker).
- **Current prices (`abs_r14`, with `cat_v1` live):** 20 s of swing per $100, board total $2,600, budget $1,200, rares 30%.
  Validation: median board's best team 92% (min 50, p25 79), typical full-spend team 175 s, 15 distinct best teams over 16
  boards. Changes: buffalo $300, grizzly $200, bull $200, lion coalition $200, black rhino $200. (22 s/$100 → $2,500: 96%,
  209 s, too easy.) Enemy tiger's threat −18 s (was the most threatening cat).
- *Previous* prices (`abs_r13`, after the light-picks identity pass): 20 s of swing per $100, board total $2,500, budget
  $1,200, rares 30%. Validation: median board's best team 92% (min 50, p25 79), typical full-spend team 197 s, 15
  distinct best teams over 16 boards. Changes: rhino $400, grizzly $100, tiger $100, lion coalition $100.
  (22 s/$100 → $2,400: typical 300 s, too easy; 18 s/$100 → $2,700: 83%, 153 s.)
- *GCP branch prices* (`abs_s1`, before merging into main; superseded by the reprice after the merge, Oct 27: realism-pass engine + bulldozer_v1 and charger_v1 live with harrier_v1, guard_v1):**
  21 s of swing per $100, giants/herds capped at $700 (triceratops now $700 too), board total $2,500, budget $1,200,
  rares 30%. Validation (`RAREP=.3 node board.js 16 2 24 12 1200 2500`): median board's best team 88% (min 58, p25 79;
  with/without elephant both 88%), typical full-spend team 169 s, 16 distinct best teams over 16 boards. Changes: rhino
  $400, bison $200, grizzly $100, triceratops $700, lion coalition $100. (22 s/$100 -> $2,400: 96%, 300 s, too easy;
  20 s/$100 -> $2,600: 79%, 162 s.)
- *Previous* prices (`abs_r12`, with the learned harrier + guard policies live): 22 s of swing per $100, board total
  $2,600, budget $1,200, rares 30%. Validation: median board's best team 92% (min 38, p25 83), typical full-spend team
  173 s, 15 distinct best teams over 16 boards. Changes: rhino $300, croc $100, bull $100, triceratops $800.
  (20 s/$100 → $2,700: 83%, 164 s.)
- *Previous* prices (`abs_r9`, after the battle drive): 22 s of swing per $100, board total $2,600, budget $1,200,
  rares 30%. Validation: median board's best team 96% (min 46, p25 83), typical full-spend team 184 s, 15 distinct best
  teams over 16 boards. (24 s/$100 → $2,500: 100%, 210 s; 20 s/$100 before targets: 79%, 109 s.)
- *Previous* prices (`abs_r6` after the cat pass, giant kangaroo, sabre-toothed cat; rares on 30% of boards):
  20 s of swing per $100, giants/herds capped at $700 (triceratops $800), board total $2,700, budget $1,200. Validation
  (16 boards, `RAREP=.3`): median board's best team 92% (min 54, p25 88), typical full-spend team median 170 s, 60% of
  teams win at least one screen run, 15 distinct best teams over 16 boards. At 24 s/$100 (total $2,500) it was far too
  easy (median 100%, typical 300 s); at 17 s/$100 (total $2,900) too hard (79%, 81 s).
- Guards no longer attack enemies that are minding their own business far from you (they used to rank a
  peaceful elephant as a top threat and provoke it).

- **Helps/Threat pass (subagent, Oct 2026):** the card bars depend on the base team. With 3-animal base teams (~63 s)
  "theirs" can't go below ~−60 while "mine" has ~240 s of room, so giants and herds look harmless. Budget-fill bases
  (`BASE=900`/`1200` env in `price_abs.js`) flip that: elephant +147/−32 (3 random) vs +53/−131 ($1,200 fill).
  Robust under every base: giraffe and croc are harmless helpers (realistic), the tiger is slightly more threat than help.
  With full teams, 38% of your damage is collateral (charges and sweeps aimed at your animals hit you). Of 11 ideas only
  a stale-dodge bug fix survived on the current engine.

## In flight (Oct 26, for a new session)
- **v2 sweep (run 40372090395, `m3_v2`) found nothing that beats v1 so far; v1 stays live.** Training tests: only the
  warm harrier run h2_c1_s1 passed (+0.033 ± 0.016 vs harrier_v1); on fresh fights (`eval_state.js … 1200 33`, v1 arm) the
  top three harriers were +0.011 ± 0.014, +0.031 ± 0.018, +0.008 ± 0.017 vs v1. Guards: the warm runs didn't move (most
  ended at init); g2_c2_s1 looked +7.9 ± 3.7 s vs guard_v1 on 1,200 fresh fights but +2.5 ± 2.8 s, win −0.4 ± 1.1 on 2,000
  more. `--thetaClip` cold runs did learn (harrier +0.099 ± 0.016 vs heuristic, guard +0.065 ± 0.021) but don't beat v1.
  Next: new inputs or actions (latched cat decisions, species-aware features), not more of the same sweep.
- Cat sweep `m3_cat_s1` (run 40404764891): shipped as `cat_v1` (see Milestone 3). Runner-ups beat the heuristic too
  (creepUnseen +0.094 ± 0.021 but fails the longIdle gate; stalkerPounce +0.061 ± 0.020; cold small σ +0.076 ± 0.020).
- GCP: run `node policy/gcp/gcp.js check` (then `check --vm`) to confirm the credentials, then launch sweeps there.
- Archetype policies (cats, chargers, bulldozers, brawlers, kickers) are being built in the original session's worktree;
  if that work isn't on the branch yet, it hasn't been merged.

## Open threads (full list in BACKLOG.md)
1. Realism: owner decision on a more fragile human. (Done Oct 2026: lion coalitions encircle — the second lion swings to
   the far side of a shared target, `sig 'encircles'` ~1.5/fight, value neutral.)
2. Policy: give the net timing decisions (wait for an opening vs commit, pack timing) — target choice alone has no leverage.
3. Movement policy pilot for pack harriers (wolves/hyenas) with an idle penalty.
4. Identity: keep strengthening the light picks (ROSTER.md). (Done: counters 'lookout spots a threat' ~3/fight,
   'chases movement' (bull) ~2, 'charges blind at a sound' (black rhino) ~3 — telemetry only.)
5. Replayability: verified leaderboard, rotating rosters, new animals. (Done: daily challenge —
   `Daily challenge` button; the local date (Wordle-style, was UTC until Oct 27: evening play in the Americas inflated the streak) hashes to the map, board and fight seed; rematch keeps the seed; today's best in
   localStorage `wa-daily:<date>`; a share line in the result banner.)
   - Done (Oct 2026, ui.js only): **Pick N** draft mode and Daily Pick-3 were built, then **removed by the owner (Oct 27: "Pick N is
     bad")**; old links with `d:pN` open as budget games. **Game links**
     `#g=1,m:,b:,s:,d:b|pN[,t:,r:,p:][,sc:]` (`gameLink`/`parseLink`/`applyLink`; positions are stored to the cm at drag
     time and encoded exactly, so a link replays the same fight; bad links fall back to a fresh board with a notice),
     and a **daily streak** (`wa-streak`).
   - **Cards and personal stats (Oct 27):** each card shows its species' signature move (`SIGNATURE` in ui.js) and your own
     record with it; the Helps / Threat bars are gone. Every fight played (not migration) is recorded at simulation time in
     localStorage `wa-stats` (`recordStats`): per pick games/wins/kills/damage/protecting/deaths/MVPs, per enemy games
     faced and times it killed you, per map games/wins/best, your own kills, and the last 50 games with replay links. The
     arena's "Your stats" panel (`renderStats`) shows maps, your animals, nemesis, top killer and recent games.
   - Prototype (Oct 27, ui.js only, **hidden unless `?five=1`**, `FIVE_ON`): **5 in a Row**: today's five boards (each its own
     map; `fiveSeed(date, k, 'board'|'fight'|'retry')`), full-budget draft each, a board counts only if you survive to 5:00,
     one retry per run (new fight seed, redraft allowed). Run saved in `wa-five-run` (resumes after reload), best per day
     `wa-five-best:<date>` ({wins, time}), share line with 🟩🟨🟧🟥⬜ pips. Arena panel (`#fivePanel`) lists today's five maps up front and run progress. Owner to playtest before it goes on the arena screen.
