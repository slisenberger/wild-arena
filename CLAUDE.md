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
- **No measured values on screen.** Discovering what's good is part of the fun (owner, Oct 27: hide the +s / −s): cards and
  draft screens show signatures, stats and the player's own record, never `MEASURED` swing numbers.
- **Mobile first.** The owner plays and screenshots on a phone (~412 px). Check every UI change with a Playwright
  screenshot at phone width and look at it, not just for page errors.
- **Bug reports are terse** ("this is broken", "the streak was wrong"). Reproduce, fix the most likely cause, and say the
  assumption in one line, so they can correct it if it's wrong. Don't block on clarifying questions.
- **One decisions list.** Keep the owner's pending decisions in `DECISIONS.md` (with a recommendation each) instead of
  repeating questions across messages. End a report with at most a 3-item "needs you" list pointing there.
- **The game's premise: two teams, known to everyone, with shared goals.** Every animal treats the other side as the enemy
  (owner, Oct 27: "all animals believe they are enemies with the other team ... teams *are* known and goals *are* shared").
  So herbivores finishing off enemies, or picking targets for the team, is in-premise; realism applies to *how* each animal
  fights (gait, weapons, temperament, sourced behaviour), not to whether it takes part.
- **The objective outranks realism (owner, Oct 31): "all animals on attack should at least participate in the objective of
  killing the human. It is the only assumption higher than realism. Each team understands their team's goal and helps."** So
  realism may bend only where it serves an animal taking part in its team's objective (e.g. kickers hunting on offense);
  physical abilities and species signatures still hold. **Disengaging is what breaks the spirit** (owner, Oct 31: "it doesnt
  violate game spirit the way disengaging does"): idling, stalling, avoiding the fight or giving up; latest framing (owner, Oct 31): "everyone should engage the way they'd
  realistically would conditioned on being part of a hunting team against the human" and "species realism can stay in training just
  not when it directly conflicts with objective seeking". So realism checks never count closing on the human against an animal
  (longChase / farHunt / farSprint), and species tendencies (buffalo mobbing lions) apply only while it isn't going for you; fighting
  your animals counts as helping. Measured then (500 fights, maps2): share of active time targeting you
  — gorilla 1.0%, elephant 1.3%, mammoth 1.4%, ostrich 2.2%, giraffe 2.9%, walrus 5.2%, chargers 11–20%, predators 24–76%.
- **Pricing rules:** $100 steps, the elephant stays affordable ($700 cap), budget $1,200. Re-measure after any roster or
  behaviour change.

## Files
- `sim.js` — the whole simulation engine. Pure JS, no DOM, deterministic per seed (`rng(seed)`).
  Exports `window.Arena` in the browser and `module.exports` in Node.
- `ui.js` — the game UI (arena → draft → deploy → fight → lab), canvas rendering, Lab batch runs.
  Mobile UX pass (Oct 27, `research/ux_audit/`): a sticky bottom action bar (`renderActBar`) carries each step's next action
  (Fight straight from the draft with auto formation, Skip to result, Play again / New board); `audit.js` re-measures taps
  and scroll on phone/360/desktop, `modes_check.js` checks the hidden modes, daily and share links through the bar.
  Daily Safari check (Oct 31, `research/daily_check.js <first date> <days> [K] [MIN]`): the bot plays each day's daily run K times; a day whose completion is under MIN gets the next salt (`daily_salt.json`, bundled by build.js as `DAILY_SALT`, read by `progDailySeed`). First run (abs_r20 engine, 45 days from Oct 31, K 30, MIN .08): median completion 17% (min 0, max 47%), 6 days re-dealt (each now ≥ 10%). Re-run Oct 31 after the 'unknown' fixes (from Nov 1, 45 days): see daily_salt.json. Re-run (Oct 31, terrain features default + `abs_r21` + the top-up retune, 45 days from Nov 1, K 30, MIN .08; Oct 31 had no salt and is untouched): median completion 17% (min 0, max 50%), 5 days re-dealt (Nov 9 needed salt 2; each now ≥ 13%). **Re-run it after any engine, price or Safari change, and before the covered dates run out (Dec 15); never change a date that has already started.**
  "Killed by the unknown" (Oct 31, owner: "in very safe situations you just die to unknown without even a threat"): (1) your own animals shoved you through the border into the closing fire (collisions moved the 75 kg human; maps2 walls/escorts made it common) → own animals now make way for you in collisions, and after collisions every unit (not routing) is clamped inside the playable box (`w.pb`); (2) caught outside the safe box on maps2 you make for its middle, routed round walls (`m2Route`); (3) a hazard's last tick no longer steals the kill from an animal that hit you in the last 5 s (`lastHitT`); (4) the UI names hazards (`killerHTML`: 🔥 the fire, 🌊 the flood water, ❄️ the blizzard) instead of "the unknown". 800 strong-team fights with random start spots: deaths to the hazard with nothing hitting you 8 → 0 (plain maps 0 → 0). Paired 1,200 fights: +2.9 ± 3.7 s (prices kept); Safari bot unchanged (round 1 82%, 18.8% complete).
  Safari playtest fixes (Oct 31): the post-fight recap (`recapHTML`) and the run summary are key/value tables (`table.kv`), the end screen's "Your animals" is a table (`table.runsum`: rounds, kills, damage, fate; "★ Made it" only on a complete run, "Alive" otherwise) without refunded animals; the loss banner states the retry rule and shows retries left as hearts; formation shows Ride above the team list; animal names in recaps, banners, the run summary, stats and the after-action fate column carry a small portrait (`fn(id, px)`; the fate column shows ✕ + the killer's portrait); the short-faced bear and woolly rhino cards no longer hedge ("hypothesis" / "speculative"; the sources stay in sim.js comments).
  Pre-friends polish (Oct 31): link previews (`<meta>` description / Open Graph / Twitter card in template.html, `preview.png` = a real fight at 1200×630, lion favicon), field notes fold the same line within 15 s into one entry with ×n, the river-only formation tip shows only on the river, and a Safari retry keeps the round's map (`M.mapSeedOf(run)` → `cfg.mapSeed`; first attempts are unchanged since their fight seed equals it).
  Draft map card (Oct 28, `renderDraftMap`, `#draftMap`): this game's / round's actual map (ground from `groundFor`, your side, your start), its features as chips (river, waterhole, frozen lake, snow depth, tree count) and a one-line tip (`MAP_TIP`); owner: "you don't know the map at draft time".
- `template.html` — page shell + CSS with placeholders `/*FACES*/`, `/*SIM*/`, `/*UI*/`.
- `faces.json` — 34 base64 portraits (112×112) keyed by species id, cropped from public-domain/CC0 (giant kangaroo: CC BY 3.0; gaur: CC BY 2.0; woolly rhino: CC BY 2.5)
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
- `progressive.js` — **progressive mode** rules (**the main mode since Oct 31, named "Safari" in the UI (owner, Oct 31; briefly "Food Chain")**: `PROG_ON = true`, the arena screen opens with its panel and the bottom bar's primary starts / resumes a run; the single-board game is "Quick game" below it; `?progressive=1` is no longer needed; the parenthetical history below is from the prototype days) (its shop opens in the Versus draft layout unless the player picked another with the switcher; a switcher choice sticks without the `?draftui` flag) (prototype Oct 27, **hidden unless `?progressive=1`**, `PROG_ON` in ui.js; it
  replaced the switched-off Migration mode, whose `migration.js`/`migration_bot.js` and `?migration=1` are gone). Pure JS,
  bundled by `build.js` after sim.js as `window.Progressive`: 7 rounds up a price ladder (`PROG.CAP/BOARD/TOTAL`), a premium
  enemy from round 3, top-ups, kill bonus, rest/heal, scars, XP/levels, two retries (`PROG` constants). Engine hooks in sim.js
  `setup` (all opt-in; absent = byte-identical, checked on 120 fixed fights with and without the live policies against a
  worktree of the base commit): `cfg.startHp = {id: fraction | [per surviving member]}` (wounds), `cfg.maxHp = {id: mult |
  [per member]}` (scars), `cfg.levels = {id: 0-3}` (`LEVEL_FX`, read as `u.lv`), `dealBoard` `rules.exclude` and
  `rules.maxPrice`; stats only: `u.st.sig` (per-unit signature count), `u.st.low` (lowest health fraction, your side).
  The Migration-era `cfg.humanHp` / `cfg.boons` (`BOONS`) hooks are still in sim.js but unused. Tools:
  `progressive_bot.js [runs] [workers] [seed0]` (greedy bot; env `PROG='{...}'` overrides constants, `NOISE`, `RAND`),
  `progressive_r1.js [boards] [seeds]` (every full-spend round-1 team on dealt round-1 boards), `level_abs.js [N] [level]`
  (paired level-L vs level-0 value per item); `progressive_bot.js` env `PROG_JS=` runs another rules file (before/after).
  UI (UX pass Oct 27, `research/prog_ux/`): Start → round 1's shop (the draft screen; `#progShop` panel: tier, premium
  enemy, last-fight recap, team cards with health % per member, rest line, level effect + next level, Heal to 100% / Heal all
  / Sell (two taps) / Return) → Formation (`#progForm` roster; the fight starts here; "Fight now" in the shop skips it) →
  result → next shop. `s-prog` = run overview and the end screen (every animal of the run from `run.hist`). The mount follows
  the team (`S.mountPick` = picked this round). Run in localStorage `wa-prog` (resumes in the shop after a reload), best
  `wa-prog-best`, daily `wa-prog-daily:<date>`. A fight's result is applied the moment it's simulated.
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
- **Roster (34 species, 40 picks with packs/herds; the lone musk ox is never dealt):** the original 16 plus black rhino (1.2 t, irritable blind charger — the white rhino is now
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
  Then (29–31, Oct 27, subagent; from `research/mid_tier_candidates.md`, stat lines revised after an independent zoology review):
  - **Habitat rule** in `dealBoard`: a species may carry `habitat: {terrain: weight}` (absent = every map, weight 1); it is dealt
    only on those maps, drawn with that weight (`habitatWeight`, `dealsOn(id, terrain)` exported; no terrain given = not dealt).
    It draws no extra random numbers: with no weight ≠ 1 in the pool the pick is the old `floor(R()·n)`, and on maps a habitat
    species can't go the boards equal those of a roster without it (checked on 2,000 seeds × 4 maps). `dealWeight: 0` = a form
    never dealt (`??` instead of `||`). Adding the gaur (no habitat) does change every board for a given seed (the pool grew).
  - **Musk ox herd ×3** (`muskoxherd` $400; the lone `muskox` is `dealWeight: 0`: swing 24 ± 5 s, no signature alone), tundra only
    (`habitat {tundra: 1.5}`, on ~62% of tundra boards). 285 kg (Wikipedia average), spd 11 / stam 15 (the 60 km/h figure is
    unsourced; reviewer), dmg 100, armor .35, heat .3 (sweat glands only on the head; Copenhagen Zoo), snow .92. `ring`
    (`ringUpdate`, `RING`): 2+ oxen within 15 m of you (their own centre on the other side) and a predator within 25 m coming for
    the herd, you or anything of yours inside it → a **line** across its approach (one threat) or a **ring** (several), each ox
    facing the nearest threat: front hits (±60°) +.25 armor (`horn boss`), morale floor .5, double weight in `guardsAround` (so
    predators fall back on `waitForOpening`); every 6–10 s the ox nearest a predator within 8 m dashes ≤ 10 m at it (`sortie`)
    and returns. Breaks (15 s cooldown) when a grizzly/polar (`RING_BREAKERS`: the herd bolts 2.5–4.5 s) or anything over 2× an
    ox's mass hits a member, or a member drops below 30%; dissolves after 20 s with no predator within 8 m, or 2 s after the last
    predator leaves. Ringing *you* is the game's abstraction (real rings shelter calves). Sources: NPS Gates of the Arctic
    "circle defense" and Cape Krusenstern "defense strategy" (line vs circle, one ox charges out and rejoins, grizzlies break it),
    ADF&G muskox guide (mass), Wikipedia "Muskox". Swing 79 ± 7 s (mine +57, theirs −22; 240 tundra boards); the ring itself is value-neutral (ablated: 86 ± 7): the herd body is the value. Rates per fight it is in (`audit.js 100 1200`): forms a line .78, a ring .18, sortie .49, horn-boss block .52, ring broken .46 (+ .04 by a bear). Stalling (paired with the ring stripped, 400 tundra fights per side): yours 2.8 s of ring per fight, longest no-damage stretch 8.1 vs 7.8 s median, enemy loiter and "gave up" endings unchanged; theirs 3.8 s/fight (it helps you, +14 s mean score), longest ring 22 s, no extra quiet endings.
  - **Gaur** (`gaur` $300, every map): 1,200 kg (bulls 588–1,500), spd 12 (no measured top speed; reviewer), dmg 170, armor .4,
    `placid` (no rising agitation floor on the other side), `forestRunner` (charges thread the trees; no forest slowdown),
    no rival bonus (gaur don't hunt cats; reviewer). `facesDown` (`faceDown`): a stalker (stalk gait or ambush) it can see within
    20 m creeping on it or on anything of its side within 10 m of it → it walks steadily at the cat for 3 s, the cat loses its
    ambush and gives up that prey for 12 s and backs off with `FACEDOWN_P` (tiger .4, sabre-tooth .5, jaguar/cougar .7, leopard
    .8), else attacks without the ambush bonus; 10 s cooldown; hidden cats aren't seen. Sources: Wikipedia "Gaur" (adults circle
    and face a tiger; tigers "almost always abandon a hunt if detected and met in this manner"; Karanth's Nagarahole herd
    walking a tiger off; "crash into the jungle at a surprising speed"). Swing 62 ± 7 s (mine +41, theirs −21; savanna 55, river 100, forest 55, tundra 38). Rates: faces down a stalker .22/fight (+ .09 spotted but the cat pressed on). facesDown is value-neutral within noise (stripped: score 215 vs 213 yours, 189 vs 193 theirs) and adds no stalling.
  - **Walrus** (`walrus` $200, tundra only, `habitat {tundra: 2.5}`, on ~78% of tundra boards): 1,200 kg, land spd 2.5 with
    stam 4 (a short burst, then ~1.1 m/s exhausted), swim 2.2 (cruise ~7 km/h) with a 7.5 m/s surge at prey within 6 m (the
    aquatic lunge), dmg 150, armor .5 (10 cm hide, 15 cm blubber), `shoreGuard` (keeps to its water, waits in the water nearest
    its target, only takes on what comes within 6 m of the water; not stealthy, unlike the croc), `territorial`. `tuskStab`: both
    it and its target within 1.5 m of water → every other strike ×1.5, half armor, stuns ≤ 1.5× its mass 1 s; a rider on a
    mount ≤ 2 m tall in water is thrown 30%. On a dry tundra (no lake, ~56%) it is a slow armored lump. Sources: Wikipedia
    "Walrus" (mass, hide, tusks used for fighting; "even an injured walrus is a formidable opponent for a polar bear"), "Walrus
    attack" (boats, a hunter stabbed at the ice edge), SeaWorld / NAMMCO (swim speeds). Unverified: land speed (no measurement
    found). Swing 31 ± 5 s (mine +22, theirs −9; 240 tundra boards; lake maps 27 ± 8, dry 34 ± 8: on a lake it keeps to the water, on dry snow it is an armored lump beside you). Rates: tusk stab .49/fight, surges from the water .36. tuskStab alone adds ~1 s (stripped 30 ± 6). Left alone in its lake on their side it ends 4.5% of fights 'quiet' (moose 1.8%): honest, it won't leave the water; making it haul out instead turned those into slow crawls to 5:00 (reverted). A ×.6 land-damage penalty suggested by the reviewer was dropped: bulls fight with their tusks on haul-outs.
  Then (32–34, Oct 27, subagent, branch `animals-prehist1`; from `research/prehistoric_candidates.md`, all **rares**, stat lines
  revised after an independent paleontology review: what it changed is in brackets). Adding three rares changes the rare draw:
  with the same seed, boards on the savanna, forest and tundra that had or now get a rare are dealt differently (20%, 31%, 30% of
  4,000 seeds per map); river boards and every rare-less board are unchanged, and boards without the new species fight
  byte-identically to the base commit (1,600 fights, live policies on and off). New rares are on ~5% of savanna, ~9% of forest,
  ~10% of tundra boards (the rare slot is uniform over the rares that can go on that map).
  - **Woolly rhinoceros** (`woollyrhino`, rare, tundra only `habitat {tundra: 1}`): 2,000 kg (1.5–2 t typical, European mean
    2–2.5 t), spd 10 [12; no measured speed, short legs], dmg 175, armor .5 (skin 5–15 mm over 1.5–3 cm of fat), reach 2.8 (nasal
    horn 1–1.35 m), cold 1, heat .4, charger (overshoot 7, turn .3); snow speed by mass (.65: likely intolerant of deep snow).
    `snowPlough` (`plough`/`furrowAt`, `FURROW`): moving on snow it drops a trail point every 0.5 s lasting 12 s [20]; anything
    within 1.2 m [1.5] (either side, you included; not the rhino on its own fresh trail) has the snow's drag halved. Speculative
    (reviewer): the basis is horn abrasion read as sweeping snow aside (Fortelius 1983) plus trail-following in living hoofed
    animals; the card says so. Rendered as a pale trail that fades (`drawFurrows`, `w.furrowAll`). Sources: Wikipedia "Woolly
    rhinoceros" (frozen carcasses, horn, skin, deep-snow intolerance, healed fight wounds). Swing 96 ± 8 s (mine +74, theirs −22;
    240 tundra boards) → $500. Rates (yours / theirs): `opens a lane` 5.3 / 3.1 per fight. The furrow is value-neutral (stripped:
    −5 ± 5 yours, −3 ± 4 theirs) and adds no stalling (longest no-damage p90 26 vs 30 s, quiet endings 0 vs .7%, enemy loiter
    lower).
  - **Giant short-faced bear** (`shortface`, rare, tundra + forest): 650 kg (adults 317–957, mean ~625; Christiansen 1999,
    Figueirido et al. 2010), spd 12 (Matheus: 40–45 km/h), stam 15 [25: the pacing gait is a travel gait, not sprint endurance],
    dmg 160, armor .35, hp ×1.1, strikeH 4.3 (vertical arm reach ~4.3 m standing, a reconstruction: it reaches riders on giants),
    maul every 3rd swipe, mock charge .5, prey human .5 (a game assumption; diet debated: Fox-Dobbs et al. 2008 isotopes vs
    Figueirido et al. 2010 omnivore). `usurps` (`usurp`, `killInHand`, `USURP`): an enemy predator within 35 m it can see that
    holds prey or is biting a downed target (stunned or < 30% health), ≤ .5× [.6] the bear's mass → it goes over (≤ 8 s) and rears
    up; the holder lets go and backs off (ignores that prey 15 s) with p .4 if the prey is down, .25 [.4] if it is still fighting,
    +.2 if ≤ .3× the bear, −.15 per packmate within 15 m (Gunther & Smith 2004), never a honey badger; else the bear's next swipe
    mauls. 8 s cooldown. Basis: bears displaced cougars at 11 of 27 kills they reached (Murphy et al. 1998, Ursus 10); Arctodus
    kleptoparasitism is a hypothesis (Matheus 1995), flagged on the card. Swing 58 ± 5 s (mine +42, theirs −16; 480 tundra +
    forest boards) → $300. Rates: `makes it let go` .11 / .08, `rears over a kill` .14 / .09 per fight (holds near it are rare).
    Value-neutral (stripped −2 ± 4, +0 ± 4), no stalling (p90 29 vs 33 s yours).
  - **Utahraptor** (`utahraptor`, rare, forest + savanna): 350 kg (estimates 280–500: Kirkland et al. 1993, Paul, Makovicky),
    spd 8 [11; robust legs, an ambusher; dromaeosaurids score low on cursorial indices, Persons & Currie 2016], stam 8, dmg 120,
    armor .1, pierce .2, strikeH 2.8, stalk gait with a 6 m pounce, `ambush` (×1.7, ×2 in forest; it re-arms like the cats' after
    ~8 s out of the action), feathered (inferred). `pinDown`: any hold (latchMax 1 [1.3]: prey up to its own mass) pins the
    prey (stun 1.2 s, .8 s above .6× its mass [new]) and halves its chance to shake free; bigger prey it only bites. Basis:
    Fowler et al. 2011 (PLoS ONE 6: e28964), raptor prey restraint. Savanna = the Yellow Cat Member's open seasonal floodplain
    (no grass yet; reviewer's note). The enemy one is driven by `cat_v1` (stalk gait = cat archetype; its species one-hot is all
    zero). Swing 24 ± 4 s (mine +15, theirs −9; 480 forest + savanna boards) → $100. Rates: `pins it down` .23 / .18 per fight
    (mostly you, cats, wolves). Value-neutral (stripped −2 ± 2, −3 ± 2), no stalling.
  - Portraits: woolly rhino Mauricio Antón (CC BY 2.5, via PLoS Biology), short-faced bear museum model (Hunsvotti, CC0),
    Utahraptor (PaleoNeolitic, CC0; Commons flags minor inaccuracies: jaw, eye). Musk ox, gaur and walrus got their card
    signature lines (they were missing from `SIGNATURE`).
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
  `buffaloherd` ×3, `bisonherd` ×3, `muskoxherd` ×3 (herd only) are extra catalog entries (`species` points at the base animal, `group` = size,
  `dealWeight`; `sp(s)` gives the species for rivals/yields/snow checks). A board deals each species once, solo or
  as a group. One pick brings the whole group; left on the board, all of it is
  against you. Whole-roster mode (no `cfg.board`) ignores pack items.
- **Croc:** on a map with water it only takes prey within 5 m of the water and lurks submerged otherwise (it
  used to walk out and spend 86% of the fight on land). Away from water it bites as hard as ever but moves at
  70% and tires fast. Cold-blooded animals (cold < .3: the croc) are never dealt on the tundra. **Last stand (Oct 28, owner: "won because the last enemy croc never left the water"):** when water lurkers (`waterbound` croc, `shoreGuard` walrus) are all the other side has left, `w.lastStand` lifts their water rules (targets, engage moves) and they come out after you at their land speed (croc 70% → 25% beyond 10 m; walrus hauls along); log line + `sig 'comes out of the water'`. Progressive round-1-style fights on boards with one (`lurk3.js`, 1,242): 'quiet' wins 73 → 4, survival 22.1% → 16.3%; full games 36.0% → 34.9%. Swing croc 29 ± 3 (was 28), walrus 23 (same); progressive bot round 1 76%, 23.6% complete (unchanged). Fights without a last stand are byte-identical (400).
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
- **Terrain features are the default since Oct 31** (owner played it: "I like maps2 … maps2 feels better"): `MAPS2_DEFAULT = true` in sim.js, so `mapVariant` and `setup` use them unless `cfg.maps2:false` / `{maps2:false}` (the old open maps; `?maps2=0` in the UI, `MAPS2=0` for board.js). Every tool now fights on them by default. Same day, a tree stall fix (owner: "hiding in a tree might produce a bit too much stalling"): the human treated a fleeing or treed animal that still had them as its target as a threat, so they stayed up a tree (up to 100 s) or cycled up and down (15 climbs); now `moveHuman`'s climb trigger (`treeTh`) and its "safe to climb down" check ignore those. Hook fix (Oct 31, found when `target_ident_test` failed for cats on the maps2 default): with a learned cat target net live, `chooseTarget` returned right after `policyChoose` and skipped cat_v1's 'soften' hold (`u.cT`); the policy path now applies it like the heuristic path, so zero target weights = the game again (all four groups pass); 598/600 cat fights unchanged, survival 272 vs 272. Plus a cap (owner, Oct 31): `TREE_MAX` = 30 s up trees per match, all climbs together (`h.treeT`); then "your arms give out" and you can't climb again that fight. A backstop: after the fix no fight in 700 forest samples reached 30 s. Forest, maps2: tree time 3.3 → 2.1 s/fight, fights with > 60 s up 1.0% → 0%, survival 39% (unchanged); with `maps2:false` the engine matches main except fights where the human climbs or heads for a tree (18/300).
  History: - **Terrain features (prototype Oct 28, hidden unless `?maps2=1`, `MAPS2_ON` in ui.js → `cfg.maps2`; `research/map_features.md`):**
  `mapVariant(tid, seed, {maps2:true})` draws (after every other variant draw) `v.pb` (playable box: an impassable border trims
  ~17% of the field per game) and `v.obst` (solid circles: savanna kopje / donga / termite mounds, river cut banks + side gully,
  forest ravine + deadfall, tundra moraine + erratics; the final arena core x 38–62, y 25–41 kept clear) and `v.nav` (waypoints).
  Engine (all behind `w.obst` / `w.pb`; `pbOf(w)` = full field without the flag): collision, steering (`steerTrees`) and
  `m2Route` (Dijkstra over waypoints when a wall is in the way; outside the closing box behind a wall → head for its middle),
  `canSee` blocked by tall features beyond 4 m, no strikes across a feature, charges stop at one (stun 1.2 s, 3% hp), spawns,
  wander, flight, the zone and the integrate clamp use the playable box; `placeOK` / `clampPlace` / `zoneFor` respect it.
  Rendered in `groundFor` (`drawFeatures`). Without the flag byte-identical to origin/main (`research/maps2/ident.js`: 480
  fights, live on/off). Measured: best-formation gain over the default +8.2 ± 4.5 s plain → +15.2 ± 5.5 s maps2 (paired
  +7.0 ± 5.4, tundra +33.7); no clear easing (paired score −2.4 ± 5.8 s; board.js best team 88 → 83%, typical 165 → 175 s);
  stuck beside a feature 0.15 animal-s per fight. Tools: `research/maps2/{ident,probe,formation,shots}.js`; `board.js` takes
  `MAPS2=1`. DECISIONS.md item 10.
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
  - **Milestone 4 shipped (Oct 27 night): learned target choice for enemy chargers (`charger_target_a1`)**, on top of
    `charger_v1` movement; owner-approved under the two-teams premise. GCP run tgt2 ch_t_s1 (`m4/targeting-v2`; ES on a
    'target-lin' scorer: score = .25·[heuristic's pick] + w·x over `policy/features.js`'s 63 per-candidate features, so zero
    weights = the heuristic exactly). Hook (opt-in): `cfg.policy = {byArch: {charger: weights}}` → sim.js `chooseTarget` calls
    `INTERNALS.chooseHerb` (policy/policy.js) over `herbCandidates` (mirrors `herbivoreTarget`'s filters: change both
    together); predators use `byArch` too. Live: `policy/weights/live.json` `"target": {"charger": ...}` → `INTERNALS.LIVE_TARGET`,
    applied in `setup` under the same opt-outs as the movement policies (and only if the cfg has no `policy`); harness fights
    with `withLive` get it via `move_run.js setPolicy`. Without target weights the engine is byte-identical to main before it
    (320 board fights, live on and `livePolicy:false`, against main 83e19df and again against a70aae9). Re-check on the merged
    engine with the prehistoric rares (`policy/probes/eval_target.js … 2000 81|82|83`, zero weights as base, other policies
    live): **+0.094 ± 0.013** goal over 6,000 fresh fights (draws +0.058 ± 0.023, +0.068 ± 0.022, +0.155 ± 0.022), style 1.00,
    no gates or drift; your survival −3.4 ± 0.5 pts, time alive −10.2 ± 1.3 s, chargers' own deaths −0.08 ± 0.01/fight; it
    deviates from the heuristic on ~8% of decisions. (Before the merge, probes 71–73: +0.090 ± 0.013. The branch's own
    +0.158 was on its older engine without the musk ox / gaur / walrus.) Fights without an enemy charger are unchanged.
  - **Milestone 4, round 2 (Oct 28, shipped: merged to main in PR #41): learned target choice for YOUR guards
    (`guard_target_m2`) and a stronger enemy-charger scorer (`charger_target_m1`, replaces a1).** Both from the GCP session's
    `m4/guard-target` (only what they need was brought over): 'target-mlp' scorers (`policy/target_model.js`: score =
    .25·[heuristic's pick] + w·x + v·tanh(W1·x + b1); `self` appends the unit's own species trait vector, `policy/traits.js`,
    36 traits, so one net can weigh the same candidate differently per species; zero output = the heuristic). charger m1: tgt5
    ch_mlp_s2 over features.js's 63 + 36 traits. guard m2: tgt9 gaw_mlp over `policy/guard_features.js` (78 guard features incl.
    the enemy's traits) + 36, `wide` = no leash (candidates: any enemy your side sees or within 10 m). Hook (opt-in):
    `cfg.policy.byArch.guard` → sim.js `chooseTarget` (guard branch) and `guardDecide` call `INTERNALS.chooseGuard`
    (policy/policy.js), which has the last word over allyTarget's pick and re-judges guard_v1's intercept/help targets; riders
    keep the heuristic; if the heuristic's pick isn't a candidate it stands. `guardCandidates` mirrors `allyTarget`'s filters
    (change both together; used by non-wide scorers). Live: live.json `"target": {"charger": "charger_target_m1.json",
    "guard": "guard_target_m2.json"}`. Without the new weights the engine is byte-identical to main d58f679 (400 board fights,
    live on and `livePolicy:false`); with them, `livePolicy:false` is still identical and live fights with a charger-only
    `cfg.policy` (a1) are identical to main (400), so the guard scorer is the only other change. The bundle (index.html run in a
    vm) gives the same fights as the Node modules (40/40). `policy/target_ident_test.js` (zero weights = the game, cat /
    bulldozer / guard) passes.
    - guard m2 vs off (guard_v1's targets; `eval_target.js … guard 2000 91|92|94 … per-archetype 0`, other policies live):
      **+0.152 ± 0.017, +0.146 ± 0.017** (charger a1 live), **+0.114 ± 0.018** (charger m1 live), style 1.00, no gates or drift;
      your survival +8.7 / +8.8 / +6.1 pts (± 1.1), time alive +22.4 / +20.6 / +16.6 s (± 3), guard deaths −0.33 / −0.39 /
      −0.09 per fight, guards' damage +430–480 per fight, fewer withdraw (−0.13 to −0.23), less standing by (−3 to −8 s); fights
      with your big cat +25 / +20 / +18 s. It deviates from the heuristic on ~22–30% of guard decisions, mostly about enemy
      chargers (take one on / hold back from one / switch to another, by guard species: wolves and bears hold back, chargers
      and cats go in) and going for a cat that is on you. No leash, but guards don't range further: mean distance from you 13.7 →
      13.7 m (13.5 → 14.0 with m1), > 24 m 15.7 → 16.2% of guard time, > 40 m 2.1 → 2.1%; time something is on you with no
      guard within 10 m 0.44 → 0.48, 0.52 → 0.47, 0.44 → 0.43 s per fight (within noise).
    - charger m1 vs the live a1 (`BASE=…a1.json eval_target.js …m1.json charger 2000 91|92|93`): +0.063 ± 0.028, +0.071 ±
      0.028 (guard targets off), +0.085 ± 0.030 (guard m2 live); pooled **+0.073 ± 0.017** over 6,000 fresh fights (4.4 SE),
      style 1.00, no gates or drift; your survival −1.6 / −2.1 / −2.4 pts (± 1.1), time alive −8 to −11 s, chargers' own deaths
      −0.05 to −0.11 per fight. It differs from a1 on ~33% of decisions: species-specific, mostly going for you instead of
      one of your animals, or leaving a fight with your cat / charger alone (herds, rhinos, gaur, hippo).
  - **Milestone 4, round 3 (Oct 31, branch `smart-ship`): learned target choice for enemy big cats (`cat_target_e1`) and
    brawlers (`brawler_target_e1`) is live; your guards keep `guard_target_m2`.** Both from the GCP session's `m4/guard-target`
    (`policy/SPECIATION.md` ei7–ei8: expert iteration with a 20-s / 8-s lookahead teacher, gain regression): 'target-mlp' 32
    hidden over `policy/features_rich.js` (features_plus.js's 71 + 20 'rich' per-target inputs: time to contact, kill race,
    who is after whom, facing, ...) + 36 species traits, `targetsOnly` (the net re-ranks targets; 'none' / 'feed' only when
    they are the heuristic's pick), margin .001. Ported only the inference: policy.js `P.feat === 'rich'|'plus'` and the
    targets-only mask (FP/FR required on first use: they require sim.js); no sim.js change (the hooks were already on main).
    Live via live.json `"target"` `cat` and `brawler`; build.js bundles features_plus.js / features_rich.js. No in-game planning.
    - Evaluated in order on today's engine (`eval_target.js … 2000 101|102`, checkmate goal + spec, zero target weights as the
      base, every other live policy on): **cat +0.113 ± 0.026, +0.077 ± 0.024** (style 1.00, no gates; telemetry drift
      humanShare .18 → .32: the cats put more of their damage on you, in-premise); your survival −4.2 / −2.6 pts (± 1.1),
      time alive −12.7 / −8.0 s (± 2.8); cats deviate from the heuristic on 30% of decisions. Then with the cat net live,
      **brawler +0.104 ± 0.027, +0.096 ± 0.026** (style 1.00, no gates or drift); your survival −4.0 / −3.6 pts, time alive
      −11.8 / −11.1 s. Then **guard_target_m3 vs live m2** (`BASE=…m2.json … guard 2000 101|102 2027 per-archetype 0`, cat and
      brawler nets live): **−0.003 ± 0.018, −0.008 ± 0.018** (survival −0.1 / +0.1 pts, time alive +0.3 / +0.7 s): a tie, so m2
      stays and m3 isn't on this branch (it is on `m4/guard-target`). m3 does idle more (35% → 41%, standby +10 s/fight).
    - Determinism (`policy/ship_ident.js <worktree of origin/main 755c5f5> 400`, before the reprice): livePolicy:false
      identical 400/400; live fights whose other side has no cat or brawler identical 91/91 (the other 309 differ, as they
      should); the bundle (index.html in a vm) gives the same fights as the Node modules 40/40 (again after the reprice).
      `policy/target_ident_test.js` (now cat, brawler, bulldozer, guard; zero weights incl. a fresh rich targets-only MLP =
      the game; its base arm is now `{kind:'target-none'}` = the arch's shipped movement without a target scorer, which also
      fixes its stale guard FAIL since m2 went live) passes. `eval_target.js` takes `BASE=none` (no target scorer for the arch).
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
- **Current prices (`abs_r21`, Oct 31, terrain features (maps2) as the default game + the human's tree-stall fix and
  `TREE_MAX`):** **16 s of swing per $100**, giants/herds capped at $700 (triceratops $800), **board total $2,600** (kept;
  `price_scheme` itself landed on it), budget $1,200, rares 30%. `price_abs.js 240` (all items) merged with `price_abs.js 960`
  for muskox, musk ox herd, walrus, woolly rhino, short-faced bear, Utahraptor. Mean base-team score 43 → 47 s. Why not keep
  `abs_r20`: it still sat inside the targets on the new game (median board's best team 88%, min 58, p25 71; typical full-spend
  team 162 s; 67% of teams win a screen run; 16 distinct best teams), but two items were off by $100 well beyond the SE (bull
  37 ± 6 s at $100, walrus 32 ± 5 at $100). Changes vs `abs_r20`: giraffe $100, buffalo $300, bison $300, black rhino $200,
  bull $200, mammoth $700, Smilodon $100, walrus $200, great wolf pack $200, musk ox herd $500. Validation (`RAREP=.3 board.js
  16 2 24 12 1200 2600`, best-team SE ±7 pts): **16 s/$100 median board's best team 88%** (min 46, p25 71), typical full-spend
  team **165 s**, 67% of teams win a screen run, 15 distinct best teams; 17 s/$100 88% (p25 67) / 167 s; 15 s/$100 75% (p25 67)
  / 167 s. Swings: triceratops 213, elephant 157, buffalo herd 157, bison herd 151, mammoth 107, musk ox herd 76 ± 7, woolly
  rhino 70 ± 7, rhino 70, hippo 70, gaur 53, short-faced bear 46 ± 5, bison 45, buffalo 42, bull 37, croc 35, walrus 32 ± 5,
  Utahraptor 20 ± 4.
- *Previous* prices (`abs_r20`, Oct 31, branch `smart-ship`: cat_target_e1 + brawler_target_e1 live on top of guard m2 +
  charger m1):** **16 s of swing per $100**, giants/herds capped at $700 (triceratops $800), **board total $2,600** (kept;
  `price_scheme` itself gives $2,500 at 16 s, $2,600 at 15 s), budget $1,200, rares 30%. `price_abs.js 240` (all items) merged
  with `price_abs.js 960` for muskox, musk ox herd, walrus, woolly rhino, short-faced bear, Utahraptor. The smarter enemy cats
  and brawlers cut every swing: mean base-team score 52 → 43 s. Changes vs `abs_r19`: hippo $400, polar $200, croc $200,
  bison $200, black rhino $300, mammoth $600, Smilodon $200, woolly rhino $400, musk ox herd $400 (lone musk ox $100, never
  dealt), great wolf pack $100, lion coalition $200. Validation (`RAREP=.3 board.js 16 2 24 12 1200 2600`; boards depend on
  prices, best-team SE ±7–8 pts): **16 s/$100 median board's best team 88%** (min 42, p25 75), typical full-spend team
  **163 s**, 65% of teams win a screen run, 16 distinct best teams; 15 s/$100 71% (p25 58) / 164 s; 17 s/$100 79% / 162 s;
  `abs_r19` prices on this engine 79% (p25 71) / 162 s. Swings: triceratops 197, elephant 137, bison herd 134, buffalo herd
  114, mammoth 95, woolly rhino 64 ± 7, musk ox herd 59 ± 7, hippo 57, rhino 56, gaur 52, short-faced bear 42 ± 4, croc 36,
  walrus 22 ± 5, Utahraptor 19 ± 3.
- *Previous* prices (`abs_r19`, Oct 28, live since PR #41: guard_target_m2 + charger_target_m1 live): **19 s of swing
  per $100**, giants/herds capped at $700 (triceratops $800), **board total $2,600** (kept; `price_scheme` itself would give $2,400
  at 19–20 s and $2,500 at 18 s: the owner's floor wins), budget $1,200, rares 30%. `price_abs.js 240` (all items) merged with
  `price_abs.js 960` for muskox, musk ox herd, walrus, woolly rhino, short-faced bear, Utahraptor. Changes vs `abs_r18`: hippo
  $300, polar $100, buffalo $200, bison $300, grizzly $200, black rhino $200, bull $100, mammoth $500, gaur $300, wolf pack $100,
  hyena clan $200, lion coalition $100, musk ox herd $500 (lone musk ox $200, never dealt). Validation (`RAREP=.3 board.js 16 2
  24 12 1200 2600`, same 16 boards each): **19 s/$100 median board's best team 88%** (min 42, p25 83), typical full-spend team
  **165 s**, 64% of teams win a screen run, 15 distinct best teams; 18 s/$100 92% (p25 75) / 165 s; 20 s/$100 83% / 166 s;
  `abs_r18` prices on this engine **96%** / 169 s (the stronger guards made it easier, hence the reprice). Mean base-team score
  in price_abs fell 63 → 52 s (charger m1). Swings: triceratops 213, buffalo herd 174, bison herd 163, elephant 157, mammoth
  100, woolly rhino 92 ± 8, musk ox herd 87 ± 8, rhino 79, gaur 60, hippo 60, short-faced bear 54 ± 5, walrus 23 ± 6,
  Utahraptor 17 ± 4.
- *Previous* prices (`abs_r18`, Oct 27 night, merged engine with the prehistoric rares and the learned charger target choice
  live): **19 s of swing per $100**, giants/herds capped at $700 (triceratops $800), **board total $2,600** (kept; `price_scheme`
  itself gives $2,600 at 19 s, $2,500 at 20 s), budget $1,200, rares 30%. `price_abs.js 240` (all items) merged with
  `price_abs.js 960` for the map-limited items (musk ox, walrus, woolly rhino, short-faced bear, Utahraptor). Changes vs
  `abs_p1`: hippo $400, black rhino $300, gaur $400, wolf pack $200; croc, grizzly, Smilodon, walrus $100; bison $200.
  Validation (`RAREP=.3 board.js 16 2 24 12 1200 2600`, same 16 boards each): 19 s/$100 median board's best team **92%** (min
  21, p25 83), typical full-spend team **166 s**, 61% of teams win a screen run, 16 distinct best teams; 20 s/$100 at $2,600
  88% / 163 s; 20 s/$100 at its own $2,500 92% / 182 s (easier, not adopted); `abs_p1` prices on this engine 88% / 166 s.
  Swings with the charger policy on: woolly rhino 95 ± 8, musk ox herd 81 ± 7, gaur 70 ± 7, hippo 75, rhino 81, short-faced
  bear 53 ± 5, walrus 25 ± 5, Utahraptor 24 ± 4. (`abs_r17`, the same reprice before the merge, without the prehistoric rares:
  19 s/$100, median 83%, 173 s.)
- *Previous* prices (`abs_p1`, on `animals-prehist1` Oct 27, after adding the woolly rhino, short-faced bear and Utahraptor; a separate
  commit, the main session reprices again after merging): 20 s of swing per $100, giants/herds capped at $700 (triceratops $800),
  board total $2,600 (kept: `price_scheme` landed on it), budget $1,200, rares 30%. `price_abs.js 240` (all items) merged with
  `price_abs.js 960` for the map-limited items. Validation (`RAREP=.3 board.js 16 2 24 12 1200 2600`): median board's best team
  88% (min 42, p25 79), typical full-spend team 169 s, 63% of teams win a screen run, 16 distinct best teams over 16 boards.
  New: woolly rhino $500 (96 ± 8), short-faced bear $300 (58 ± 5), Utahraptor $100 (24 ± 4). Changed: hippo $300, black rhino
  $200, croc $200, Smilodon $200, lion coalition $200, hyena clan $100.
- *Previous* prices (`abs_r16`, Oct 27 night, the final integrated engine: GCP realism pass + bulldozer_v1 + charger_v1 + cat_v1
  live, rare elephant, musk ox herd / gaur / walrus, progressive hooks): 20 s of swing per $100, giants/herds capped at $700
  (triceratops $800), **board total $2,600** (kept: `price_scheme` itself landed on $2,600), budget $1,200, rares 30%.
  Validation (`RAREP=.3 board.js 16 2 24 12 1200 2600`): median board's best team 92% (min 38, p25 71), typical full-spend
  team 166 s, 60% of teams win a screen run, 16 distinct best teams over 16 boards. ($2,500: 92%, 176 s, 71%.) Changes vs
  `abs_mid1`: croc $100, buffalo $300, bison $300, bull $200, mammoth $600, hyena clan $200, lion coalition $100. New items:
  musk ox herd $400 (78 ± 13 s), gaur $300 (60 ± 7), walrus $200 (30 ± 10).
- *Previous* prices (`abs_mid1`, Oct 27, on the animals branch before the integration, with the musk ox herd, gaur and walrus): 20 s of swing per $100, giants/herds capped
  at $700 (triceratops $800), **board total $2,500** (was $2,600), budget $1,200, rares 30%, elephant rare. `price_abs.js 240`
  (all items) + `price_abs.js 960` for the tundra-only items (240 tundra boards), merged. New: musk ox herd $400 (79 s), gaur
  $300 (62), walrus $200 (31). Repriced: hippo $400, mammoth $500, croc $200; buffalo, bison $200; grizzly, lion coalition $100.
  Validation (`RAREP=.3 board.js 16 2 24 12 1200 T`): at $2,500 median board's best team 92% (min 21, p25 79), typical
  full-spend team 206 s, 79% of teams win a screen run, 16 distinct best teams; at $2,600 (same prices) 79% (min 29, p25 67),
  166 s, 66%. Neither hits both targets (88–92%, 160–200 s); $2,500 is in range on the median and 6 s over on the typical team.
- *Previous* prices (`abs_r14`, with `cat_v1` live): 20 s of swing per $100, board total $2,600, budget $1,200, rares 30%.
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

## In flight (Oct 27, for a new session)
- **Night of Oct 26–27 integration (one PR to main):** gcp/arch1 (bulldozer_v1, charger_v1, realism pass, GCP tooling) +
  progressive-mode + animals-mid1 + the mobile UX pass (already on main), then one final reprice (`abs_r16`). Re-checks on
  the merged engine (`policy/probes/eval_arch.js … 1000 61`): bulldozer +0.113 ± 0.029, charger +0.124 ± 0.037, cat
  +0.067 ± 0.026 vs heuristic, style 1.00, no drift. guard round 3 (GCP) found no guard_v2; brawler/kicker stay heuristic.
  The GCP session keeps training (milestone 4 learned targets on `m4/*` branches); it pushes only to its own branches.
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

## Progressive mode (prototype Oct 27, `?progressive=1`; details and numbers in `research/progressive_mode.md`)
- 7 rounds up a price ladder (round 1 $100 animals only … round 7 any, a giant for sale), premium enemy from round 3 (top
  band, not for sale), $400 start (round 1 is all $100 animals: no stranded $50, owner) + top-ups 450/500/450/450/550/750, boards 10/10/10/10/11/11/12 worth
  $1,000/1,200/1,500/1,800/2,100/2,300/2,600 (retuned Oct 31 for the cat + brawler target policies and `abs_r20`, top-ups again for terrain features and `abs_r21`, see below), $25/kill (cap $150; the last round pays nothing), rest 30%; full heal =
  price × .55 × health missing ($5 steps up, min $10), sell = price × .5 × health ($5 steps down), not under 25% health
  (was a flat 25% heal / half-price sale; .55 kept the bot's completion rate: 1,000 runs 17.3% → 15.9%, round 1 81.5%),
  scars, XP and levels (level 3 ≈ +8% of swing, `level_abs.js`), two retries (a loss restores the round's shop).
- Bot on terrain features (maps2 default, tree-stall fix + `TREE_MAX`, `abs_r21` prices; `progressive_bot.js 500 4 1`): round 1
  first-try **82%**, median run ends in round 6, **18.8% complete**; round 6 is the wall (first-try 38%; buffalo herd premium won
  35%, bison herd 40%). At the previous constants the new game gave round 1 82% and **12.4% complete**. Retune (300-run probes):
  top-ups 450/450/450/450/500/750 → 450/500/450/450/550/750 (500/450/450/450/500/750: 16.0%; 500/500/500/450/550/750: 34%;
  500/500/500/500/550/800: 39%; at 500 runs 500/500/450/450/550/750: 26.4%). Boards and START unchanged.
- Previously, bot with the cat + brawler target nets live (`abs_r20` prices, retries keep the round's map since PR #46;
  `progressive_bot.js 500 4 1`): round 1 first-try **80%**, median run ends in round 6, **19.8% complete**; round 6 is the wall
  (first-try 34%; buffalo herd premium won 30%, bison herd 31%). At the old constants the new engine + prices gave round 1 65%
  and **2.8% complete** (smarter cats and brawlers; croc, polar and Smilodon left round 1's $100 pool). Retune (300-run probes):
  round 1's board 12 → 10 animals ($1,200 → $1,000: 82%; 11 gave 70%), top-ups 400/400/400/350/400/650 → 450/450/450/450/500/750
  (450/500/500/450/550/800: 33%; 400/450/450/400/500/750: 12%; 400/450/500/450/550/750: 23%). Rounds 2–7 boards and START unchanged.
- Previously, bot with guard_target_m2 + charger_target_m1 live (`abs_r19` prices; `progressive_bot.js 500 4 1`): round 1 first-try **77%**,
  median run ends in round 6, **23.4% complete**; round 6 is the wall (first-try 42%; buffalo herd premium won 26%, bison herd
  40%). At the old constants the new engine + prices gave round 1 72% and **69.6% complete** (your guards are much better and
  later-round teams are big). Retune (300-run probes): round 1 back to 12 animals / $1,200 (77%), top-ups 450/500/500/450/550/800
  → 400/400/400/350/400/650 (all-400 + 450/700: 30.7%; all-350 + 400/600: 9.0%; +$300–400 on the round 3–7 boards instead:
  31%). Board totals for rounds 2–7 and START unchanged.
- Previously, with the charger target policy live (`abs_r18` prices, merged engine; `progressive_bot.js 500 4 1`): round 1 first-try
  **79%**, median run ends in round 6, **21.4% complete**; round 6 (herd premium) is still the wall (first-try 35%). Retune: at
  main's constants the reprice (croc, grizzly, Smilodon, walrus back to $100) made round 1 easy (88%, 23.0% complete); round 1's
  board went 11 → 13 animals ($1,100 → $1,300: the other side gets 9 vs your 4; 12 gave 86%), which pushed completion to 27%,
  so the round 5–6 top-ups went −$50 each (500/600 → 450/550; −$50 in rounds 3–6 instead gave 10.2%). START stays $400.
  Before the merge (`abs_r17`, no prehistoric rares) the same policy needed round 1 at 12 / $1,200: 80%, 19.6%.
  Earlier: main's prehistoric reprice 80%, 18.4%; `abs_r16` engine 81%, round 6, 15.8%; before the integration 83%, round 5, 16.4%.
  `PROG.R1_OUT` (species kept out of round 1) was tried with the $100 big cats + croc out: runs got harder (2.6% complete)
  and the badger still barely kills, so it's off. Earlier bot (pre-integration): Round 1 has real choices (random team
  40%, 9 best teams over 16 boards) but tiger/lion/croc dominate it; the honey badger gets 0.02 kills a fight (open).

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
   - **Versus is the draft screen for every mode since Oct 31** (owner); `?draftui=…` shows the switcher (a switcher choice then sticks while the flag is on). Prototype history: (Oct 27, ui.js `DRAFT_UIS` block, hidden unless `?draftui=versus|list|deck|1`): alternative draft screens with a
     Default · Versus · List · Deck switcher (`wa-draftui`); one hook in `renderDraft` (`draftAlt`). All host the progressive shop.
     `research/draft_ui/` (README, `check.js`, tap/scroll numbers). Owner to play and pick.
