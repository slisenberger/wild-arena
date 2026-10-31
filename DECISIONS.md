# Decisions waiting on the owner

Each item has a recommendation; reply with a number and "yes", or your own call. Decided items move to the bottom.

## Open
17. **Does the "realism can bend for the team's objective" rule lift the buffalo check?** (Your rule, relayed by the training
   session Oct 31: "realism can be violated ONLY IF it allows for the grounding assumption of animals know their team and ultimate
   objective"; e.g. kickers may hunt on offense, so that gate is lifted for the kicker run.) The charger nets learn to have buffalo
   steer clear of predators because that helps them get at you. Recommendation: keep the buffalo check. Mobbing lions is the buffalo's
   signature behaviour (like gates on physical ability, signatures stay), and the realistic charger net is already as strong as the
   live one.
12. **Two-sided species training: how much a sourced tendency may cost** (training session, `research/speciation_strategy.md` on
   `m4/guard-target`: animals on both sides learn per species, with realism checks shaping the reward). Recommendation: a well-sourced
   tendency (e.g. buffalo mobbing lions) may cost up to all of the gain training finds, but never make an animal weaker than today.
13. **Who writes the realism checks per species.** Recommendation: a zoology subagent drafts them from sources; you spot-check 8
   species; anecdotal sources count at most half (confidence ≤ .5).
14. **Network size:** ~8k weights per animal class instead of ~5k. Recommendation: allow it, then check the game still runs
   smoothly on a phone (frame time).
15. **Training compute (GCP CPU quota):** the training session asked you for a quota of 1,000. Recommendation: raise it after
   its Stage 4, or sooner if you want results faster.
16. **Playtest before release:** the whole jointly trained set goes behind `?smart=1` for you to play before it goes live.
   Recommendation: yes.
11. **Enemy chargers' learned targets: buffalo shy away from predators** (training session's speciation report, Oct 31): the live
   `charger_target_m1` uses one rule for every charger (onto you and smaller animals, away from predators), and the buffalo
   avoids predators the most, which is the opposite of real buffalo (they mob lions). Recommendation: keep it live for now (it is
   +0.073 ± 0.017 over the previous scorer); the training session retrains chargers species-aware (traits v2) with a check that
   buffalo and bison don't learn to shun predators, and I'll swap it in when it passes.
1. **Safari (progressive mode): what a retry undoes.** Built: a lost round goes back to the shop as the round opened (team,
   wounds, XP and money as they were; only the time alive counts), then a new fight seed. The alternative (the dead stay
   dead, no refund) made 17% of bot runs die in round 1 from a crippled retry. Recommendation: keep the undo.
2. **Safari: the premium herd.** In rounds 6–7 the round's top non-rare band is the $700 buffalo / bison herd
   (3 animals), so the premium enemy is a whole herd; that's the run's wall (round 6 first-try win 34% after the Oct 31 retune). Option: cap the
   premium at $400 (a rhino). Recommendation: playtest it as is first; the bot still completes 20% of runs.
3. **Safari: the honey badger story.** Round 1 is a big-cat round (tiger, lion, croc fill the best teams); the badger
   barely kills. Tried overnight: dealing round 1 without the $100 big cats and croc (`PROG.R1_OUT`) made runs harder (2.6%
   complete) and the badger still didn't kill, so it's off. Real fix ideas: a badger-specific XP/kill source (it harries
   and steals kills?), or accept that its story is surviving (12% of runs still have it in round 4). Your call.
6. **5 in a Row:** the owner moved on to the progressive mode. Default: leave it hidden behind `?five=1`; delete later if
   unused.
7. **New animals' open questions** (musk ox herd, gaur, walrus — now live): musk ox only on the tundra, or also the forest at a
   low weight? The walrus won't leave its lake, so 4.5% of tundra-lake fights end "they gave up": acceptable as honest
   behaviour? Their signature moves are visible but barely move the numbers (the bodies carry the value): strengthen any
   only with a sourced reason (ideas: walrus stampede, gaur herd mobbing a tiger, lone-bull gaur).
9. **Prehistoric batch 1 (live since PR #39):** (a) the woolly rhino's snow furrow is speculative (the
   reviewer would rather have a side-to-side horn sweep, also inferred from the horn wear); it measured value-neutral and is
   the first map-changing effect. Recommendation: keep it, labelled speculative on the card. (b) The rhino measured 96 s of swing
   on the tundra, so it prices at $500 (a $300 guess before). (c) Utahraptor on the savanna: there was no grass in its world
   (open floodplain with ferns); recommendation: keep it there as the open-floodplain stand-in, say so in its text. (d) Eight
   rares can now turn up on the tundra, so each one is rarer: a themed rare pool (Ice Age / Cretaceous) is an option. (e) The reprice drops the hyena clan to $100, so progressive round 1
   (the $100 round) gets easier: bot first-try 90% (target ~80%), completion 18% (in range). Left for the `prog-ux` work.

- Oct 28 (merged in PR #41, live): **your guards get learned target choice** (`guard_target_m2`:
  you survive +6 to +9 pts more often, guards die less and don't range further from you) and **enemy chargers get the stronger
  species-aware scorer** (`charger_target_m1`, beats a1 by +0.073 ± 0.017: chargers come for you a bit more, you −2 pts).
  Together the game got easier (median best team 96% at the old prices), so it was repriced at 19 s/$100 with the board total
  kept at $2,600 (88%, typical team 165 s) and progressive retuned (round 1 board back to 12 / $1,200, top-ups
  400/400/400/350/400/650: round 1 77%, 23.4% complete; START $400 kept).
- Oct 27 (night): **learned target choice for chargers ships** (owner: "I am fine with herbivores finishing off enemies ...
  teams *are* known and goals *are* shared"; the two-teams premise in CLAUDE.md). `charger_target_a1` is live on top of
  `charger_v1` movement (branch `charger-target`, merged with main a70aae9). Re-check on the merged engine: +0.094 ± 0.013 goal
  over 6,000 fresh fights, style 1.00, no gates or drift; your survival −3.4 ± 0.5 pts, time alive −10.2 ± 1.3 s. Repriced
  (`abs_r18`, 19 s/$100, board total kept at $2,600: median best team 92%, typical team 166 s) and progressive retuned
  (round 1 board 13 / $1,300, round 5–6 top-ups −$50: round 1 79%, 21.4% complete); numbers in CLAUDE.md.
- Oct 27 (built, branch `animals-prehist1`): prehistoric batch 1 approved and built as rares: woolly rhino (tundra), giant
  short-faced bear (tundra, forest), Utahraptor (forest, savanna). Remaining candidates (Doedicurus, Homotherium pair, dire
  wolf pack, Protoceratops herd, Stegosaurus) stay in `research/prehistoric_candidates.md`.
- Oct 27: cards show the signature move and your own record (built); personal stats panel built.
- Oct 27 (progressive build): money = fixed top-up + $25 per kill, capped at $150 a round (`PROG.PER_KILL/KILL_CAP`).
  Progressive mode replaces Migration (`migration.js`, `migration_bot.js` and `?migration=1` removed; prototype behind
  `?progressive=1`). Your own health resets every round (Migration carried it; the human stays as fragile as now).
- Oct 27 (later): progressive mode adds one premium enemy (top price band, can't be bought) from round 3. The human
  stays as fragile as now. Pick N removed. The Helps / Threat bars go (replacement to pick).
- Oct 27: progressive mode uses experience (XP and levels, capped, realistic), two retries per run; T. rex at most a
  final-round boss. Elephant is a rare; board total stays $2,600 (the player stays the underdog). Pick N switched off.
  Dailies use the local date. Musk ox herd, gaur and tundra-only walrus approved for building; smaller real dinosaurs
  welcome as candidates.
- Oct 26: Migration switched off until properly designed. Prices in $100 steps; the $50 tier deferred. Rares on 30% of
  boards. GCP for training; the launcher must fail gracefully.

## Decided
- Oct 31: **terrain features (maps2) are the default** (owner: "I like maps2 … feels better"); the old open maps stay behind `?maps2=0`. Tree-hiding stalls fixed the same day.
- Oct 31: **progressive mode is the main mode, named Safari** (owner: "make the progressive mode the main mode and give it a name", then "I like safari as a name"; briefly shipped as Food Chain). It opens the arena screen and owns the bottom bar's main button; the single-board game stays below as **Quick game**. **Versus is the draft screen** for both (owner: "versus the default view"); the old cards, List and Deck stay reachable with `?draftui=…`. That retires item 5 (compact cards on phones).
