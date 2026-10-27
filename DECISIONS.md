# Decisions waiting on the owner

Each item has a recommendation; reply with a number and "yes", or your own call. Decided items move to the bottom.

## Open
1. **Progressive mode: what a retry undoes.** Built: a lost round goes back to the shop as the round opened (team,
   wounds, XP and money as they were; only the time alive counts), then a new fight seed. The alternative (the dead stay
   dead, no refund) made 17% of bot runs die in round 1 from a crippled retry. Recommendation: keep the undo.
2. **Progressive mode: the premium herd.** In rounds 6–7 the round's top non-rare band is the $700 buffalo / bison herd
   (3 animals), so the premium enemy is a whole herd; that's the run's wall (round 6 first-try win 44%). Option: cap the
   premium at $400 (a rhino). Recommendation: playtest it as is first; the bot still completes 18% of runs.
3. **Progressive mode: the honey badger story.** Round 1 is a big-cat round (tiger, lion, croc fill the best teams); the badger
   barely kills. Tried overnight: dealing round 1 without the $100 big cats and croc (`PROG.R1_OUT`) made runs harder (2.6%
   complete) and the badger still didn't kill, so it's off. Real fix ideas: a badger-specific XP/kill source (it harries
   and steals kills?), or accept that its story is surviving (12% of runs still have it in round 4). Your call.
5. **Compact draft cards on phones** (mobile UX audit, `research/ux_audit/README.md`): hide the stat bars on phone cards
   (they stay in the detail panel) to cut the draft page roughly in half. Default if no answer: leave cards as they are.
6. **5 in a Row:** the owner moved on to the progressive mode. Default: leave it hidden behind `?five=1`; delete later if
   unused.
7. **New animals' open questions** (musk ox herd, gaur, walrus — now live): musk ox only on the tundra, or also the forest at a
   low weight? The walrus won't leave its lake, so 4.5% of tundra-lake fights end "they gave up": acceptable as honest
   behaviour? Their signature moves are visible but barely move the numbers (the bodies carry the value): strengthen any
   only with a sourced reason (ideas: walrus stampede, gaur herd mobbing a tiger, lone-bull gaur).
8. **Board difficulty after the smarter chargers.** With charger target choice live, the median board's best team measures
   83% (`abs_r17` prices, $2,600; was 92% before it), a little under the 88–92% band; typical full-spend team 173 s (in band).
   A $2,500 total measured the same 83% (the median is ±8 pts noise), so the total stays $2,600 (it's the other side's
   budget). Recommendation: accept (the other side got smarter, not richer); no knob change.
9. **Prehistoric batch 1 (built on `animals-prehist1`, not merged):** (a) the woolly rhino's snow furrow is speculative (the
   reviewer would rather have a side-to-side horn sweep, also inferred from the horn wear); it measured value-neutral and is
   the first map-changing effect. Recommendation: keep it, labelled speculative on the card. (b) The rhino measured 96 s of swing
   on the tundra, so it prices at $500 (a $300 guess before). (c) Utahraptor on the savanna: there was no grass in its world
   (open floodplain with ferns); recommendation: keep it there as the open-floodplain stand-in, say so in its text. (d) Eight
   rares can now turn up on the tundra, so each one is rarer: a themed rare pool (Ice Age / Cretaceous) is an option. (e) The reprice drops the hyena clan to $100, so progressive round 1
   (the $100 round) gets easier: bot first-try 90% (target ~80%), completion 18% (in range). Left for the `prog-ux` work.

- Oct 27 (night): **learned target choice for chargers ships** (owner: "I am fine with herbivores finishing off enemies ...
  teams *are* known and goals *are* shared"; the two-teams premise in CLAUDE.md). `charger_target_a1` is live on top of
  `charger_v1` movement (branch `charger-target`). Re-check on main's engine: +0.090 ± 0.013 goal over 6,000 fresh fights
  (three draws: +0.046 ± 0.024, +0.101 ± 0.022, +0.123 ± 0.023), style 1.00, no gates or drift; your survival −3.1 ± 0.6 pts,
  time alive −10.4 ± 1.4 s. Repriced (`abs_r17`, 19 s/$100, board total kept at $2,600) and progressive retuned; numbers
  in CLAUDE.md.
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
