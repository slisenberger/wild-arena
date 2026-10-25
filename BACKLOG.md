# Wild Arena backlog

Every idea raised so far, grouped by theme. Status: **done**, **measured** (data exists, no change yet),
**next** (agreed order), **idea** (captured, not scheduled). Anything that changes stats, rules or the
roster changes what every price is worth, so re-run the probes (`quick.js`, `camp.js`) after it.

Design spine to test every idea against: **every animal is on both sides.** Anything you add (an animal,
a herd, a mechanic) is also something the other side gets when you don't pick it.

## Suggested order
1. Realism fixes (stats) → 2. anti-camping / pacing → 3. pricing → 4. your actions + mixed-herd bonus →
5. packs as a rules option, procedural map parameters → 6. new animals, two or three at a time, re-priced.

---

## 1. Realism (stats) — **next**
Audit pass 1 is merged (polar bear, elephant, white rhino, swim-speed bug). Still open:
- [ ] **Deep-water speed per animal in m/s.** Today swim speed = land speed × 1.25 (swimmers, or
  `swimMul`), × .7 (water ≥ .4) or × .4. Results, engine vs real (m/s): hippo 10 vs ~2 (it can't swim,
  it bounds along the bottom), polar 8.8 vs 2.5–3, croc 5.6 vs 4–5 burst (fine), jaguar 12.6 vs ~2,
  tiger 11.9 vs ~2, lion 8 vs ~1.5, elephant 4.9 vs 1–2. Biggest open item; reshapes the river map.
- [ ] Cougar 20 m/s → ~17–18. Jaguar 18 m/s is about as poorly supported → ~15–16.
- [ ] Grizzly, buffalo and bison swim competently but have water .2–.3.
- [ ] `blindCharger` fits a black rhino, not a white one (rename the animal, or change the behavior).
- [ ] Hippo armor .4 vs rhino .55 is arguable (hippo skin is 5–6 cm).
- [ ] Polar bear snow camouflage on the tundra is not modeled.
- [ ] Hippo stamina 8 s (probably fine: its land threat is the charge).
- Checked and left alone: lion 20 m/s, polar land speed/heat/mass/health, most masses and land speeds.

## 2. Camping, stalling and other anti-patterns
**Goal: low camping.** Tool: `camp.js` (telemetry + start-position exploit search, verified on fresh seeds).

Findings (post-audit engine, Oct 2026; see "Camping probe" in CLAUDE.md):
- **measured — no player-side camping exploit found.** Corner and back-wall starts help weak teams a
  little (+4 to +18 s, significant) and strong teams not at all. Trees never produce a "gave up" ending:
  all 9 fights with >10 s in a tree ended in death.
- **measured — the "they gave up" ending is honest.** With the rule switched off, 97%+ of would-be
  quiet wins still reach 5:00. It's a time-saver, not an exploit.
- **measured — the real problem is the other side stalling.** 67% of all 5:00 results are "gave up";
  for strong teams the fight is decided by ~1.5–2 min, then ~6 enemies loiter without a target for the
  remaining 3 minutes (~340 enemy-seconds of loitering per minute). That is camping by the AI, and it's
  dull to watch.

Ideas to fix the stall (each changes win rates, so before pricing):
- [ ] **Closing arena** (classic anti-camping): a themed hazard shrinks the safe area over time —
  wildfire on the savanna, rising water on the river, a blizzard front on the tundra, a forest fire. It
  pushes both sides together and makes position matter.
- [ ] **Hunger / desperation:** enemies that haven't fed or fought get bolder over time; after N s of
  loitering, the most aggressive one commits.
- [ ] **Coordinated rushes:** loiterers regroup and attack together (a pack, a herd stampede).
- [ ] **Shorter quiet window** or "they gave up" earlier once the remaining enemies are clearly outmatched
  (pure pacing fix; doesn't change outcomes since the rule is honest).
- [ ] Keep tree height and the "cornered" rules under watch; re-run `camp.js` after any AI change.

More anti-pattern checks to add to `camp.js`:
- [ ] Enemy target churn (oscillation/dithering): target switches per minute, time near you without striking.
- [ ] Kiting loops: units with a high distance travelled and no damage dealt (giraffe keep-away).
- [ ] Shade hogging on the savanna (time in shade vs heat taken).
- [ ] Mount escapes across the river; riverbank posts.
- [ ] Degenerate drafts: no animals, one animal, all cheap animals.
- [ ] Optimizer-driven exploit search over guard posts too (not just your start spot); make it a standing
  regression test.

## 3. Pricing — **next after 1–2**
Full brief from the handover: change only the 16 prices ($100 steps, min $100) and the budget; level
value per $; elephant may stay strongest and most expensive but not mandatory; top-25 contenders at
70–85% wins with a spread; different champions per map; screen once and cache, iterate 2–3 rounds,
validate the best 1–2 schemes plus the $1,000 baseline at top 25 × 100 runs/map with ± SE.
Expect the budget to need to rise with the elephant's price (scheme C at $1,200 was already at 65%).
- [ ] Add the chosen scheme as a rules option on the arena screen.
- [ ] Show prices/budget clearly on the draft screen.

## 4. Herds and packs
Pack animals (lion, wolf, hyena) carry the `pack` tag, a morale penalty for being alone — so in a meme
that gives you one of each animal, they're weaker by design.
- [ ] **Mixed-species herd bonus** (stays in the meme): herbivores near each other share spotting
  and rally morale; a lone herbivore panics sooner. Cheap; do first.
- [ ] **Sell some animals as groups** (rules option, bends "one of each"): "Wolf pack (4) $300",
  "Hyena clan (3) $300", "Lion pride (2 lionesses + male) $500", "Buffalo herd (3) $600". The pack
  orbits, flanks and hamstrings as a unit; skip it and the other side gets the whole pack.
- [ ] **Emergent herd behavior:** cohesion, ringing up around the vulnerable one (musk-ox style, with
  you as the calf), stampede contagion when one breaks. Most realistic and fun to watch, hardest to balance.

## 5. Maps and variety
- [ ] **Moderately procedural maps:** seeded, bounded parameters per map type (not freeform) — river
  position and bends, number of fords, forest density and clearings, snow-depth patches, rocky outcrops
  (high ground, chokepoints), a savanna waterhole. Half there: acacias are already random per seed.
- [ ] **Weather modifiers:** rain on the savanna (cooler, mud slows chargers), fog on the river (vision
  down, crocs stronger), a blizzard on the tundra.
- [ ] **Night:** many predators are nocturnal; a time-of-day lever reshuffles the value table.
- [ ] New map types later: swamp/mangrove, rocky kopje, bamboo forest, desert.
- Caveat: variety adds noise to rankings, so the "many runs per contender" rule matters even more.

## 6. New animals
Each one also joins the other side, so a bigger roster makes the game harder unless the budget grows.
Pick for new roles. Top three for design value: **honey badger, moose, Komodo dragon**.
- [ ] Honey badger — cheap, nearly unkillable, ignores morale. The "$100 nuisance".
- [ ] Moose — tundra/forest heavyweight, strong in snow; rivals the bison and grizzly there.
- [ ] Komodo dragon — venom, a bite that kills slowly. New damage type (damage over time).
- [ ] King cobra / black mamba — small, nearly invisible, lethal to you specifically; tests your escort.
- [ ] Ostrich — fast, killer kick, a light mount that evades rather than tanks.
- [ ] Cassowary — the forest's ostrich, angrier.
- [ ] Chimpanzee troop — smart, a group, climbs: the anti-tree-camper.
- [ ] Anaconda — river ambusher that constricts instead of biting.
- [ ] Golden / harpy eagle — attacks from the air; height matters in reverse.
- [ ] Kangaroo — kickboxer, holds a fighter at arm's length.
- [ ] Wolverine — the tundra's honey badger.

## 7. Mechanics
- [ ] **Your own actions:** 1–2 cooldown abilities (flare scares off the timid, whistle rallies guards,
  climb a tree, mount/dismount). Biggest lever for making it *feel* like a game.
- [ ] **You can fight back.** Today you only struggle when something latches on (5 dmg/s × (1 − its
  armor) against the latcher); otherwise you never attack (`HUMAN.dmg: 6` is unused). Options: punch/kick
  (realistically almost nothing against a lion, but it can finish a wounded hyena or break a latch),
  an improvised weapon (stick, rock, spear as a draft item that costs budget), or a flare/shout that
  scares rather than damages. Pairs with "your own actions" above.
- [ ] **Wounds sap power directly.** Today it's indirect: lost HP lowers morale (`tgt = 1 − .85·(1 − hp/maxhp)`),
  morale scales damage (`× (.65 + .35·morale)`, so up to −35%), and <30% HP routs. Make it explicit and
  visible: damage, speed and stamina fall with wounds (a limp), maybe per-wound location (a hamstrung
  leg slows, a bitten neck weakens).
- [ ] **Mid-fight commands** ("hold", "regroup on me", "charge that one") — light tactics; maybe a mode.
- [ ] **Draft synergies** beyond the rivals table (elephant + tiger: the tiger won't leap onto your mount;
  buffalo + lion feud).
- [ ] **Carcasses as terrain:** scavengers stop to eat (partly modeled); kills create usable distractions.
- [ ] **Wounds and limping:** crippling hits that read better than raw HP.
- [ ] **Replays:** time scrubber, per-animal damage graphs, death reasons. Also a debugging tool.

## 8. Replayability
- [ ] **Daily challenge** (shared seed, shared map) + **verified leaderboard** (store the config,
  re-simulate to verify the score — cheap because the sim is deterministic).
- [ ] **Mutators / rules cards:** drought, night, double predators, no mounts, half budget, random prices.
- [ ] **Shop draft** (autobattler-style): each round you're offered a random subset of animals instead
  of all 16, so the best team isn't the same every game.
- [ ] **Run mode** (roguelike): a series of maps; survivors carry over wounded; earn budget between fights.
- [ ] **Challenges / achievements:** win without the elephant, win under $500, win on foot, survive the
  river with no swimmers, clear the board.
- [ ] **PvP draft:** two players each draft from the same 16; unpicked animals are neutral or split. Async
  first (ghost drafts), since fights are deterministic.
- [ ] **Bans:** each side bans one animal before the draft.
- [ ] **Dynamic animal sets** (once the roster is big, ~25+): each game draws a subset of the roster
  (e.g. 16 of 30), by map theme or at random per seed. Unpicked animals in the set are the other side;
  animals outside the set sit out. Needs prices that hold up across sets (price by value, not by set).
- [ ] Per-map score-attack leaderboards; shareable seed + team links.

## 9. Infrastructure
- [ ] Turn the probes into a regression suite run after every engine change (`quick.js`, `camp.js`,
  `idle.js`), with thresholds (e.g. quiet-win share, loiter time, corner advantage).
- [ ] Record per-run telemetry once and reuse it across analyses.
