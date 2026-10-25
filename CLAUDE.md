# Wild Arena

An autobattler built from the "You have $1,000 — build a team of animals to protect you from the rest"
meme. **Board model (Oct 2026):** each game deals a random board of animals from the roster; you draft from
it on a fixed budget, and **every board animal you don't pick is on the other side** (`RULES`, `dealBoard`
in sim.js; `cfg.board`). With `RULES.total` set, every board's prices add up to the same total. Score is
**time alive, capped at 5:00** (surviving to 5:00, clearing the board, or the other side giving up all
count as 5:00). Live site: GitHub Pages serves `index.html` from `main`.

## Files
- `sim.js` — the whole simulation engine. Pure JS, no DOM, deterministic per seed (`rng(seed)`).
  Exports `window.Arena` in the browser and `module.exports` in Node.
- `ui.js` — the game UI (arena → draft → deploy → fight → lab), canvas rendering, Lab batch runs.
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
  screen run, 13 distinct best teams over 16 boards. Cards show measured "Helps you" / "Threat if left"
  (`MEASURED`, written by `apply_values.js`).
- **Battle drive + contextual targets (Oct 2026, owner: every animal is there to win the fight):** `drive(u)` builds
  from 3 s of idleness over 12 s (`u.idleT` drains, doesn't reset; the other side starts at 6). It widens herbivores'
  notice radius (+60 m, hearing the fight) and their interest in you, lowers predators' commit threshold (a sated one
  hunts again), and lets your guards range +30 m. Kickers on the other side now fight. Herbivores mob a predator only
  when it's within 12 m or coming for them. Guard cats jump on big herbivores `locked(e)` in a fight with your side.
  Idle (audit, $1,200): yours 53.5% → ~40%, theirs 33.8% → ~23%. Cost: cats' value on your side fell (~+5–15 s).
  Ridden-mount experiments: evading with a non-giant mount made riding worse (reverted); giraffe/ostrich getaway ride
  (rarely throws you unless grabbed, kicks while carrying) is neutral within noise.
- **Current prices (`abs_r9`, after the battle drive):** 22 s of swing per $100, board total $2,600, budget $1,200,
  rares 30%. Validation: median board's best team 96% (min 46, p25 83), typical full-spend team 184 s, 15 distinct best
  teams over 16 boards. (24 s/$100 → $2,500: 100%, 210 s; 20 s/$100 before targets: 79%, 109 s.)
- *Previous* prices (`abs_r6` after the cat pass, giant kangaroo, sabre-toothed cat; rares on 30% of boards):
  20 s of swing per $100, giants/herds capped at $700 (triceratops $800), board total $2,700, budget $1,200. Validation
  (16 boards, `RAREP=.3`): median board's best team 92% (min 54, p25 88), typical full-spend team median 170 s, 60% of
  teams win at least one screen run, 15 distinct best teams over 16 boards. At 24 s/$100 (total $2,500) it was far too
  easy (median 100%, typical 300 s); at 17 s/$100 (total $2,900) too hard (79%, 81 s).
- Guards no longer attack enemies that are minding their own business far from you (they used to rank a
  peaceful elephant as a top threat and provoke it).

## Open threads (full list in BACKLOG.md)
1. Realism: lions (coalitions) encircle prey instead of charging in a line; owner decision on a more fragile human.
2. Policy: give the net timing decisions (wait for an opening vs commit, pack timing) — target choice alone has no leverage.
3. Movement policy pilot for pack harriers (wolves/hyenas) with an idle penalty.
4. Identity: signature counters for lookout, bull chases, rhino blind charges; keep strengthening the light picks (ROSTER.md).
5. Replayability: daily challenge (shared seed) + verified leaderboard, fixed-animal-count mode, rotating rosters, new animals.
