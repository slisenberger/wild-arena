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
- `faces.json` — 16 base64 portrait crops (from the meme image) keyed by animal id. Animals added later
  (black rhino, fighting bull, moose, ostrich, honey badger, triceratops) have no portrait yet and show as
  lettered tokens in their price-tier color.
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
- `price_board.js <config.json> <out.json>` — board-mode pricing: random boards + player-like random teams, one
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
- **Closing arena** (wild mode, `cfg.hazard:false` disables): from 60 s to 240 s the safe box shrinks from the
  whole field to 36 × 24 m around a point near mid-field (random per seed). Outside: fire (savanna, forest;
  2.5% max HP/s + heat), flood (river; slows non-swimmers, non-swimmers lose 1.5%/s), blizzard (tundra; slow,
  stamina drain, 1.2%/s). Everyone steers inside except routing animals. "They gave up" only counts after
  the arena has fully closed. `zoneAt(w, t)` gives the box for rendering.
- **Roster (22):** the original 16 plus black rhino (1.2 t, irritable blind charger — the white rhino is now
  placid, no `blindCharger`), fighting bull (`bred`: always worked up), moose (snow-proof, strong swimmer,
  front-hoof stomper), ostrich (lookout + kicker, fast evasive mount), honey badger (`fearless`: morale never
  breaks, takes on anything), and the rare triceratops (`rare`, `giant`: 8 t charger, rideable at 3 m; only
  on ~10% of boards). Hippo armor .5 (5–6 cm skin). Polar bear `snowCamo`: hard to see beyond 15 m on tundra.
  Then (26): rare woolly mammoth (`sweep` like the elephant, cold-proof, heat-intolerant), black bear (timid,
  climbs), leopard (ambush stalker, climbs), wild boar (cheap tusked charger, `standsGround`).
- **Pack items:** `wolfpack` ×3, `hyenapack` ×3, `lionpack` ×2 are extra catalog entries (`species` points at the
  base animal, `group` = size; `sp(s)` gives the species for rivals/yields/snow checks). A board deals each
  species once, solo or as a pack (50/50). One pick brings the whole group; left on the board, all of it is
  against you. Whole-roster mode (no `cfg.board`) ignores pack items.
- **Croc:** on a map with water it only takes prey within 5 m of the water and lurks submerged otherwise (it
  used to walk out and spend 86% of the fight on land). Away from water it bites as hard as ever but moves at
  70% and tires fast. Cold-blooded animals (cold < .3: the croc) are never dealt on the tundra.
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

## Open threads (full list in BACKLOG.md)
1. Test $1,300 with scheme C prices (aim: top teams 75–85% wins, per-map champions preserved).
2. Add the chosen budget/price scheme as a rules option on the arena screen.
3. Possibly lower white-rhino aggression (they're placid grazers) if it still feels too strong.
4. Daily challenge (shared seed) + verified leaderboard (store config, re-simulate to verify score).
