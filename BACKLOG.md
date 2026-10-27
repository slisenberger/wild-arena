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
- [x] **done (v2)** **Deep-water speed per animal in m/s.** Today swim speed = land speed × 1.25 (swimmers, or
  `swimMul`), × .7 (water ≥ .4) or × .4. Results, engine vs real (m/s): hippo 10 vs ~2 (it can't swim,
  it bounds along the bottom), polar 8.8 vs 2.5–3, croc 5.6 vs 4–5 burst (fine), jaguar 12.6 vs ~2,
  tiger 11.9 vs ~2, lion 8 vs ~1.5, elephant 4.9 vs 1–2. Biggest open item; reshapes the river map.
- [x] **done (v2)** Cougar 20 → 18 m/s, jaguar 18 → 16 m/s.
- [x] **done (v2)** Grizzly, buffalo and bison swim competently: covered by their swim speeds (1.5–1.8 m/s).
- [ ] `blindCharger` fits a black rhino, not a white one (rename the animal, or change the behavior).
- [ ] Hippo armor .4 vs rhino .55 is arguable (hippo skin is 5–6 cm).
- [ ] Polar bear snow camouflage on the tundra is not modeled.
- [ ] Hippo stamina 8 s (probably fine: its land threat is the charge).
- Checked and left alone: lion 20 m/s, polar land speed/heat/mass/health, most masses and land speeds.

**Behavior-spec review (Oct 26, GCP session; doc "Wild Arena: archetype behavior specs", every claim checked against an
opened source).** Engine changes the evidence supports. Each changes the heuristic and the live game, so rebuild, re-verify
the shipped policies and reprice after:
- [ ] Elephant/mammoth bluff .6 has no source; real attacks on people are mostly sudden and unprovoked (Das &
  Chattopadhyay 2011: 14 autopsies; Mohanty 2024: 84% of 45 survivors). Lower it, or tie bluffing to the elephant's state.
- [ ] Grizzly bluff .5 is low: ~90% of aggressive grizzly reactions end without contact (Gunther et al. 2024, 7,090
  Yellowstone interactions). Try .7–.8. Black bear .7: split by mode (defensive high, predatory low; Herrero et al. 2011).
- [ ] Honey badger `fearless` overstates it: wary, bolts from lion tracks, attacks mostly when surprised (Begg). Keep
  unbreakable morale once fighting; drop "takes on anything".
- [ ] Gorilla "always bluffs first" is too strict: when surprised or cornered it bites without the display (Betsem 2011,
  74 bitten hunters). Give it its own contact model (bite, several bites possible) instead of the elephant's.
- [ ] Wolves: a standing moose was never killed (0 of 36), a running one sometimes (5 of 41; Mech 1966). Gate commits
  on the target fleeing; test with close lunges and short retreats, not circling at ~30 m (no source for that distance).
- [ ] Stalking cats break cover and run prey down from any distance once it runs; a spotted tiger doesn't pursue
  (Schaller 1967) and stalkers need 15–20 m (Laundré & Hernández 2003). Lions do hunt buffalo (54% success in Queen
  Elizabeth NP), so don't gate group lions off dangerous prey.
- [ ] Moose and bison renew the attack on a downed target that moves (Alaska Fish & Game; Mech et al. 2004); bison press
  predators for minutes to hours. Buffalo face lions backed into thickets.
- [ ] Ostrich kicks only forward (a rear approach is safe); giraffe safer standing than running (lions trip a galloping
  giraffe); big male kangaroos challenge an upright person as a rival (Coulson).
- [ ] **Cats need ambush decisions, not more training.** Every sweep (arch1, arch2, arch3) left cats at or near zero.
  Cats deal 28% of the damage to you but are in contact only 8% of the time (150 fights); the engine gait already makes
  the stalk/pounce/wait-for-opening calls, so commit/wait/flank/regroup/disengage barely change anything. Add the
  sourced decisions the spec names: hold in cover until a guard is busy, abort a spotted stalk and reposition
  (Schaller 1967), switch to an isolated or running target (Mattson 2011), lion wing/centre roles (Stander 1992); warm
  start from a cover-waiting rule; more fights per candidate.
  **Next milestone (owner): every archetype's policy chooses whom as well as how.** Today the target comes from engine
  formulas (predators: meat x vulnerability / deterrence; herbivores: engage radius; guards: threat rank, with only
  intercept/help able to switch) and the policy only picks the movement intent for that target. Joint policy: score
  every (candidate target x intent) option from the milestone-2 per-candidate features + the milestone-3 intent
  features (a trained hidden layer, `--mode=deep`, fits), under the side-level checkmate goal, with targeting realism
  metrics (cats favour isolated/running prey, herbivores defend rather than hunt). Bigger action space: more fights per
  update. Start with cats (weakest target choice, below).
  - [x] **Shipped Oct 27: learned target choice for chargers** (`charger_target_a1`, GCP milestone 4 on `m4/targeting-v2`;
    linear 'target-lin' scorer on top of `charger_v1` movement, live via `policy/weights/live.json` "target"). Owner approved
    it under the two-teams premise. Main-engine re-check +0.090 ± 0.013 (6,000 fresh fights). Bulldozer/kicker/cat target
    runs found nothing clean so far (bulldozer +0.036 ± 0.028, cat +0.055 with a stillLong gate); guard targets on `m4/guard-target`.
  **Owner design direction (Oct 27): speciation from broad archetypes + species tuning + open control + a general
  reward.** (1) Move decisions out of engine rules into the policy (target, approach, attack, bluff, retreat, movement),
  keeping physics in the engine (speed, reach, stamina, armor, morale): bodies are what make species differ. (2) One
  network per archetype, conditioned on a species/trait vector (mass, top speed, sprint stamina, weapon, armor, reach,
  pack/solo, swim); the vector can grow. (3) Reward: the side's checkmate goal + self-preservation. (4) The reviewed
  behavior spec's per-species ranges and never-gates become the constraints that keep emergent styles realistic.
  (5) Success metric: a speciation report: per species, learned behavior diverges from the heuristic in the
  directions the spec sources (e.g. cougars quit stalks sooner than lion coalitions; moose renew attacks on a downed
  target, white rhinos don't), alongside the goal.
  Owner hypothesis: with dense inputs, some layers and compute, emergent targeting goals appear (kill the human's
  mount, pick on what you beat). The inputs mostly exist (`policy/features.js`: isMount, riding, logStrVsSelf,
  muchStronger, heightRatio, busyElsewhere, fleeing, hpFrac, guardRatio); add matchup inputs (weapon vs armor/pierce,
  reach vs height, counters/yieldsTo, human HP, guards near the human). Optimizer: ES noise grows with parameter count,
  so for a layered net use behaviour cloning of the heuristic (milestone 1 reached 99%) then policy-gradient RL (PPO)
  under the checkmate goal, with a KL/drift penalty to the heuristic and the spec metrics as constraints.
  **Try first (owner idea): learned target choice for cats.** 82% of cat damage already goes to your animals, but 60%
  of cat approaches never reach contact and 1.1 cats die per fight (of ~1.7; 150 fights, realism engine): they pick
  fights they lose. Real cats take the isolated, hurt, busy or running animal. The milestone-2 target hook
  (`cfg.policy`, per-candidate features) exists; it found little leverage as one policy for all predators under the
  old goal and engine. Retry cat-only, under the checkmate goal (own deaths count), combined with the movement policy.
- [ ] No source for: jaguar 7 m and cougar 12 m horizontal pounces (cougar: 5.5 m vertical documented), hippo ~30 km/h
  (never measured), any rhino or boar bluff share.

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
- [x] **done (v2)** **Closing arena** (classic anti-camping): a themed hazard shrinks the safe area over time —
  wildfire on the savanna, rising water on the river, a blizzard front on the tundra, a forest fire. It
  pushes both sides together and makes position matter.
- [x] **done (v2), as opportunism:** predators value targets already locked in a fight or badly hurt; busy
  guards deter half as much. (Loiter diagnosis: in quiet wins the leftovers were almost all the stranded
  croc and the self-defense-only giraffe — realistic, so no forced aggression for them.)
- [ ] **Hunger / desperation:** enemies that haven't fed or fought get bolder over time; after N s of
  loitering, the most aggressive one commits.
- [ ] **Coordinated rushes:** loiterers regroup and attack together (a pack, a herd stampede).
- [x] **done (v2)** "They gave up" only counts once the arena has fully closed (240 s).
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
- [x] **done (v2)** **Pack bonding:** any `pack` animal (lion, wolf, hyena) is bolder beside another pack animal,
  converges on its packmate's target and doesn't spread out; rivals (lion–hyena) excluded.
- [x] **done** **Buffalo and bison herds:** `buffaloherd`, `bisonherd` (×3) items; `herd` animals bond with their
  own kind like packs (no lone penalty: a lone buffalo is grumpy, not nervous) and mob the same target.
- [ ] Herd ideas next: ~~ringing up around you (musk-ox style)~~ (done Oct 27: musk ox herd `ring`), stampede contagion, herd-class bonuses (e.g. any two
  bovids together hold their nerve).
- [ ] **Sell some animals as groups** (rules option, bends "one of each"): "Wolf pack (4) $300",
  "Hyena clan (3) $300", "Lion pride (2 lionesses + male) $500", "Buffalo herd (3) $600". The pack
  orbits, flanks and hamstrings as a unit; skip it and the other side gets the whole pack.
- [ ] **Emergent herd behavior:** cohesion, ~~ringing up around the vulnerable one (musk-ox style, with
  you as the calf)~~ (done for the musk ox herd, Oct 27), stampede contagion when one breaks. Most realistic and fun to watch, hardest to balance.

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
- [x] **Giant kangaroo (built Oct 2026; portrait pending, Commons rate-limited):** rare Ice Age megafauna like the mammoth — *Procoptodon goliah*,
  ~230 kg, ~2 m tall, likely walked more than hopped; braced on its tail for a two-footed kick, long-clawed arms.
  Kit idea: kickboxer that holds attackers at leg's length (keep-away gait that actually fights back).
  Built after a zoology review (Janis 2014, Tedford 1967, Dawson 2000): grab-then-kick, backs into water and holds
  lighter attackers under, foot-thump alarm, doesn't hunt you from the other side. Hold-under rarely fires unless it
  starts near water (it gets mobbed on the way): a deployment-skill payoff, revisit if it should be more common.
- [ ] **More rare megafauna (owner asked, Oct 2026)**, ranked by new identity: ~~Smilodon~~ (built Oct 2026: pin,
  killing stab, let it bleed, fragile canines), Glyptodon (~2 t armadillo: near-total armor, spiked tail club; a fortress),
  Megatherium (~4 t ground sloth: rears to 4 m, huge claws; anti-rider reach), ~~Arctodus~~ (built Oct 27 as the giant
  short-faced bear: 650 kg, rears over predators holding prey, a hypothesis), Thylacoleo (marsupial lion: strongest bite for its size, climbs), Megalania (5–7 m monitor,
  venom over time; cold-blooded, no tundra), Irish elk (3.6 m antler sweep), ~~woolly rhino~~ (built Oct 27: tundra rare, snow-plough furrow),
  Gigantopithecus (overlaps gorilla), terror bird (overlaps ostrich), Diprotodon (2.7 t wombat). Idea: an
  "Ice Age Australia" themed board (giant kangaroo, Diprotodon, Thylacoleo, Megalania).
- [x] **Prehistoric batch 1 (Oct 27, `animals-prehist1`; `research/prehistoric_candidates.md`):** woolly rhinoceros (tundra),
  giant short-faced bear (tundra, forest), Utahraptor (forest, savanna), all rares. Next from the doc: Doedicurus (tail club,
  savanna), Homotherium pair, dire wolf pack, Protoceratops herd; a themed rare pool per board (Ice Age / Cretaceous) so the
  rare slot isn't diluted (now 8 rares on the tundra). Open: the furrow is speculative (reviewer); the bear's take-over fires
  ~.1-.2 a fight (holds near it are rare); Utahraptor pins mostly you and small cats.
- [ ] Wolverine — the tundra's honey badger.
- [ ] **Fighting bull** (Spanish toro bravo, ~550 kg, bred for aggression): the most willing charger on the board,
  never needs provoking, turns fast for its size. Cheap-to-mid price.
- [ ] **Moose** (already above): ~600 kg, front-hoof strikes, at home in snow and water (strong swimmer ~2.5 m/s).
- [ ] **Ostrich** (~120 kg, ~19 m/s, forward kick with a 10 cm claw): the first bird; a fast evasive light mount
  (people do ride them). Height ~2.7 m makes it a lookout too.
- [ ] **Triceratops** as a rare dinosaur (~6–9 t, horns and frill, charger): an elephant-class rival; only on rare
  boards, priced at the top.
- [ ] **Dinosaurs as a rare easter egg** (e.g. a T. rex or velociraptor pack showing up in a rare rotation
  or a special daily seed). Same rules — if you don't pick it, it's against you — so it should be rare and
  priced high. Ties into "rotating sets with rare choices" (§8). Realism stays: use paleontology estimates
  for mass, bite force and speed (T. rex ~8 t, ~5–7 m/s; raptors small and pack-hunting).

## 7. Mechanics
- [ ] **Collateral damage to you (measured Oct 2026):** with full $1,200 teams ~40% of your damage is collateral, mostly
  the enemy elephant's sweep while it fights your escort (~33 HP/fight), then buffalo herd charges (~11). Tried: you
  keep out of locked melees (9 m, 12 m for sweepers) and step out of charge lines: collateral −5%, survival −2 ± 2 s
  (no gain; reverted). The escort sits next to you by design, so the fix probably belongs in escort spacing or the
  sweep arc (front only), not in your movement.
- [ ] **Your own actions:** 1–2 cooldown abilities (flare scares off the timid, whistle rallies guards,
  climb a tree, mount/dismount). Biggest lever for making it *feel* like a game.
- [x] **done (v2), basic:** on foot you kick/punch whatever is on you. Weapons/flare still open.
- [ ] **You can fight back (more).** Today you only struggle when something latches on (5 dmg/s × (1 − its
  armor) against the latcher); otherwise you never attack (`HUMAN.dmg: 6` is unused). Options: punch/kick
  (realistically almost nothing against a lion, but it can finish a wounded hyena or break a latch),
  an improvised weapon (stick, rock, spear as a draft item that costs budget), or a flare/shout that
  scares rather than damages. Pairs with "your own actions" above.
- [x] **done (v2), basic:** below half health, up to −30% speed and −20% damage. Per-wound locations still open.
- [ ] **Wounds sap power directly (more).** Today it's indirect: lost HP lowers morale (`tgt = 1 − .85·(1 − hp/maxhp)`),
  morale scales damage (`× (.65 + .35·morale)`, so up to −35%), and <30% HP routs. Make it explicit and
  visible: damage, speed and stamina fall with wounds (a limp), maybe per-wound location (a hamstrung
  leg slows, a bitten neck weakens).
- [ ] **Mid-fight commands** ("hold", "regroup on me", "charge that one") — light tactics; maybe a mode.
- [ ] **Draft synergies** beyond the rivals table (elephant + tiger: the tiger won't leap onto your mount;
  buffalo + lion feud).
- [ ] **Carcasses as terrain:** scavengers stop to eat (partly modeled); kills create usable distractions.
- [ ] **Wounds and limping:** crippling hits that read better than raw HP.
- [ ] **Replays:** time scrubber, per-animal damage graphs, death reasons. Also a debugging tool.

## 7a. Roster identity (owner: "a roster like Smash Bros.")
- [ ] Work through ROSTER.md: every animal gets one visible signature it does better than anyone. First targets:
  lone wolf, leopard, cougar, honey badger, black bear, ostrich (lowest measured value).
- [ ] Identity check in audit.js: per-fight counts of each signature (sweeps, mock charges, stomps, tree drops,
  death rolls, holds, grudge kills, lookout spots).
- [x] Decided against: leopard dragging kills up a tree (it would leave the fight: a liability on your side).
- [x] **Light-pick signatures (Oct 26):** musk (honey badger), claw kick (ostrich), nape bite (cougar), swims in unseen
  (jaguar), tester/leads a chase (lone wolf), cracks bone (hyena), repeat bluffs that run things off (black bear),
  chest-beat (gorilla), upends (boar), leaps on its back (lion), hidden guard (leopard). ROSTER.md has rates and values.
- [ ] Follow-ups: musk rarely fires (predators skip badgers); lone hyena lost value (−7 ± 5); black bear and ostrich
  still barely move the score; jaguar needs a dry-map hook; reprice (big enemies' threat fell 4–10 s).

## 7b. Art and presentation
- [ ] **Portraits for every animal** (in progress: public-domain/CC0 Commons images only, credited in CREDITS.md).
- [ ] **Credits footer + panel** in the game listing each portrait's source, author and license.
- [ ] **"Video-game" feel without new art:** animate the tokens — squash-and-stretch on charges, a lunge toward
  the target on a strike, red flash and shake when hit, dust trails behind chargers, facing flips, a stylized
  (posterized / cel-shaded) filter on portraits. PD/CC0 images may be modified freely (we still credit);
  CC BY needs credit, CC BY-SA also needs derivatives shared alike — which is why we only take PD/CC0.
- [ ] **Game-portrait look for real photos (owner's direction):** keep the photos, add a consistent game treatment
  (bolder contrast, slight posterize/painted filter, tier-colored rim, soft vignette), applied in the build step
  or at draw time. Fine for PD/CC0 sources.
- [ ] Effects are behind `FX` switches in ui.js: death fades and big-impact bursts on; hit flash/shake, charge
  stretch, breathing, dust and camera shake built but off (owner: "doesn't need to be too busy yet").
- [ ] Real frame animation needs drawn sprites: an original art project (don't trace others' photos).

## 8. Replayability
- [x] **Progressive mode (owner, Oct 27) — prototype built behind `?progressive=1` (Oct 27), replaces Migration.** 7 rounds
  up a price ladder, premium enemy from round 3, fixed top-ups + $25/kill (cap $150), rest 30% / paid full heal, scars,
  XP and levels (Seasoned / Cunning / Veteran), two retries. Rules `progressive.js`, bot `progressive_bot.js`, round-1
  check `progressive_r1.js`, level value `level_abs.js`; numbers in `research/progressive_mode.md`. Follow-ups: owner
  playtest; a smarter bot (does selling, healing or saving money matter?); "training" spend (XP for money) from the
  design; T. rex final-round boss (owner: maybe, later); the premium herd in rounds 6–7 is the run's wall (see the doc);
  per-run share link that replays the run; scout the next board before buying.
- [x] ~~Roguelike "migration" mode~~ (removed Oct 27: progressive mode replaced it; its rules/bot files are gone).
  Original entry: **(owner, Oct 26) — first playable done (Oct 26).** 7 fights, $600 start; earn $80/min alive
  + $25 per enemy down + $50 for surviving (rounded to $50); survivors keep wounds (heal 40%, you 30%), the dead are gone,
  packs carry their surviving members; death ends the run. Between fights: recap, 1-of-3 boons (8: spear, waterskin,
  snowshoes, ranger's whistle, smoke pots, thick hide coat, field dressing, lookout tower), trading post (a fresh board
  of 8 + 1.5/fight animals at $1,100 + $550/fight; buy, undo, sell for half). Fight 4 megafauna (a rare giant or
  sabre-tooth guaranteed), fight 7 the herd (elephant + mammoth); maps rotate through all four terrains. Score: fights
  survived, then total time; best run + daily migration in localStorage, share line. Rules in `migration.js`; greedy
  bot `migration_bot.js` (200 runs: median 4 fights survived, 74% reach fight 4, 51% fight 5, 7% win).
  Follow-ups: sell price by health; a smarter bot (does selling or boon choice matter?); boon balance (measure each
  boon's swing; spear and hide are weak, whistle/tower/dressing likely matter most); events between fights (river
  crossing, drought); "rest" option (skip the trading post to heal more); per-run leaderboard via the daily seed;
  a migration share link that replays the run; scout the next board before buying; mount choice remembered per run.
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
- [ ] **Random board, fixed budget (owner's direction, Oct 2026):** each game deals a random board of K animals
  (an "auction board"); the budget is fixed; **the other side is every board animal you don't pick**. Fresh every
  game, and difficulty is tuned by K and by checking the board is winnable. Board items can be groups ("Wolf
  pack ×3"): skip it and the whole pack is against you. Key property: the roster can grow (new animals, rare
  ones, dinosaurs) without making every game harder, because only K animals are in any one game.
  Engine: `cfg.board` (done). Probe: `board.js` (how winnable random boards are by K). Open: group items
  (multiple units per species), a winnability check when dealing a board (offline-verified daily boards, or a
  fast value model), UI for the board, and pricing measured in board mode.
- [x] **Fixed animal-count choices** (done Oct 2026, UI only; removed Oct 27: the owner found it bad): a "Pick N" draft mode on the arena screen next to
  Budget — pick exactly N (2–5, default 3) board animals whatever they cost; everything unpicked is still the other
  side. Header shows picks left, prices are hidden, bests are kept per mode (`|pickN` key suffix), and there's a
  **Daily Pick-3** with its own seed and best key (`wa-daily-pick3:<date>`). Open: price-free winnability check
  (some boards may be lopsided with 3 picks; not measured yet).
- [ ] **Rotating sets with rare choices:** each day/week/seed offers a rotating roster; some animals are
  rare (appear in few rotations), so a game with the honey badger or an orca-in-the-river is an event.
- [x] **Shareable game links** (done Oct 2026): `#g=1,m:<map>,b:<board seed>,s:<fight seed>,d:<b|pN>[,t:<ids>,r:<mount|->,p:you=x_y;id=x_y][,sc:<score>]`.
  "Copy link" on the draft screen and in the result banner (Clipboard API, falls back to a selected field). Opening one
  restores map, board, seed, mode and team/formation, shows "Shared game: can you beat 3:12?", and replays the same fight.
  Versioned and lenient (missing fields default; unreadable links or unknown maps get a fresh board and a note).
- [x] **Daily streak** (done Oct 2026): consecutive UTC days with a daily run (either kind), `wa-streak` in localStorage,
  shown next to the Daily buttons.
- [ ] Per-map score-attack leaderboards.

## 9. Learned AI (ambition)
- [ ] **Cat headroom (owner: "no headroom, so far"):** rules over the generic intents found nothing for cats, but the guards
  also showed nothing from rules and then learned +13 s. Next: (1) the cold cat runs in m3_arch_s1; (2) cat-specific
  intents (pounce now vs creep closer, abandon the stalk, switch to softer prey, re-set the ambush, wait in cover, take
  the blind side); (3) species-aware / per-species cat nets (60 kg cougar vs 260 kg sabre-tooth); (4) your-side cats.
- [ ] **Per-animal policies (owner, Oct 26):** archetype nets (in progress) → species-aware archetype nets (a species
  one-hot input) → per-species fine-tunes warm-started from the archetype net (`--initWeights` + `--thetaClip`), each
  graded against its own species' style profile, shipped only if it beats the archetype net on held-out fights. Rare
  species need fight sets that deal them in deliberately. Compute: ~30–50 nets × ~5 h on 4 cores = ~3 rounds on free
  GitHub Actions (15 h wall); a 96-core GCP spot VM (~$1–2/h) would do a species in ~15 min (~$10–20 for the roster).
- [ ] **Long-term architecture (owner, Oct 2026):** per-archetype policy nets with two rewards: goal (win the fight)
  and style (grade against the animal's intended behaviour from `sig`/audit telemetry, as a constraint). Plan in
  `policy/README.md` (Milestone 3). Replaces piecemeal heuristics like the battle drive and contextual targets.
- [ ] **Policy nets.** The sim is pure, deterministic and fast (~40 fights/s on 4 cores in Node), so it can
  serve as an RL environment. Uses, roughly in order of payoff:
  0. *Predator target selection (owner's pick, Oct 2026):* the cleanest first problem — one decision (whom to
     hunt, or whether to wait), a clear reward (damage dealt / survival / killing you), and an easy realism check
     (does it still look like a tiger?). Today it's hand-tuned scoring (`predatorTarget`, `waitForOpening`).
  0a. *Result of milestone 2 (Oct 2026):* evolution strategies on target choice found nothing better than the
     hand-tuned heuristic on fresh fights; even "always go for the human" barely helps predators. Target choice has
     little leverage. Next: give the net the decisions that matter — when to commit vs wait for an opening, pack
     timing — and then movement (0c).
  0b. *Guard positioning / anti-idle:* the same setup can train where your guards stand and when they step out
     (reward survival, small penalty for idle time) instead of hand-tuning it. Owner: "can help idle behavior too".
  0c. *Movement policy per archetype (owner idea):* ~7 archetypes (chargers, stalkers, pack harriers, lumberers,
     keep-away, water ambushers, your guards). Observation: own state, nearest allies/enemies (relative position,
     velocity, strength, intent), target, hazard edge, nearby trees/water. Action: direction + speed, and when to
     trigger the signature move; physics stays hand-coded (a rhino still can't turn like a cat). Train like
     targeting: clone today's gaits, then ES with an idle penalty + realism penalty. Plan: finish targeting ES
     first, then pilot on pack harriers (wolves/hyenas), then roll out if it reads better and idles less.
  1. *Learned exploit finder:* train a policy for your side's placement/commands to maximize survival;
     whatever it discovers is a camping/exploit report (stronger than grid search).
  2. *Learned enemy pressure:* train the other side to kill you, then keep the hand-written realistic
     AI but borrow the tactics it finds (flanking, coordinated rushes) where they're realistic.
  3. *Draft model:* predict a team's value per map from its composition, to price instantly and to rate
     rotating/dynamic animal sets without hours of simulation.
  Caveat: learned behavior must stay recognizably like the real animal; realism beats optimality.
  Practical path: port `step()` hot loops to typed arrays or run batched in Node workers; a small
  per-unit MLP over local observations (nearby units, terrain, own state) trained with PPO.

## 10. Engine notes found while building v2
- [x] **done** Animals hugged the shrinking edge while fighting at range (elephant trunk reach ~9 m): now step inward.
- [x] **done** No obstacle steering: animals pushed into trunks and got wedged in narrow gaps. Now they steer
  around trees, detour when stuck, and elephants shove trees over.
- [ ] The forest generates a ring of trees around your start spot (so you can climb); a mounted elephant can
  start boxed in. Consider leaving a gap.

## 11. Infrastructure
- [ ] Turn the probes into a regression suite run after every engine change (`quick.js`, `camp.js`,
  `idle.js`), with thresholds (e.g. quiet-win share, loiter time, corner advantage).
- [ ] Record per-run telemetry once and reuse it across analyses.

- [ ] **5 in a Row** (owner idea, Oct 27; prototype behind `?five=1`): five boards in a row, win all five, one retry.
  Open after playtest: daily-only vs free play, best-of-3 per board instead of the retry, filtering out boards where even the
  best team wins < ~70% (board.js-style check per daily board), whether a replay of today's run should count.

- [x] **Elephant rare** (owner, Oct 27): dealt through the rare slot (~8% of boards); board total kept at $2,600 (harder,
  median best team 88%, typical team 160 s). Next for variety: new mid-tier animals that can cost $200+ (research in
  `research/mid_tier_candidates.md`).

- [ ] **Harness: brawler style-sensitivity checks fail after the realism pass** (Oct 27, `harness_test.js --quick` 176/178 on
  the merged engine): "always wait / always disengage" brawler policies now score style 0.82 / 0.91 (threshold 0.9) and
  don't trip the long-idle gate. Brawlers have no live policy, so the game is unaffected; recalibrate the brawler style
  gates (or the check) before the next brawler training round.
- [x] **Mid-tier animals, first three (Oct 27):** musk ox herd ×3 (tundra, `ring`), gaur (`facesDown`), walrus (tundra,
  `tuskStab`), plus the `habitat` deal rule. Details and numbers in CLAUDE.md "Then (29–31)" and ROSTER.md.
  Follow-ups from the zoology review, not built: a **walrus stampede** (a predator or person near hauled-out walruses sends
  them all rushing to the water, crushing what's in the way: Kochnev 2002, 85% of Wrangel deaths were crush deaths; needs a
  walrus herd item), gaur group mobbing of a tiger (several adults; needs a gaur herd), the ring as a liability against
  human hunters (Inuit + dogs), a "solitary bull" gaur variant (aggr .5), a walrus aggression split (bold in water, flees to
  water on land). Remaining research candidates: zebra harem ×4, gemsbok, Komodo/Megalania.
- [ ] **Map-biased deal frequency (long term, owner):** the `habitat {terrain: weight}` field now exists (walrus and musk ox:
  tundra only). Extend it to the rest of the roster where realism says so (croc/hippo heavier on the river, polar bear and
  mammoth on the tundra, cats and gaur in the forest, savanna big game), re-measure each map's board strength, and decide
  whether the board total should vary by map.
