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
4. **Prehistoric animals to build** (`research/prehistoric_candidates.md`, all proposed as rares): giant short-faced bear,
   woolly rhino, Doedicurus (tail-club glyptodont), Utahraptor; alternates Homotherium pair, dire wolf pack, Protoceratops
   herd; Stegosaurus if you want another giant. Recommendation: woolly rhino + short-faced bear first (best evidence,
   fill the tundra), after the musk ox / gaur / walrus batch is priced in.
5. **Compact draft cards on phones** (mobile UX audit, `research/ux_audit/README.md`): hide the stat bars on phone cards
   (they stay in the detail panel) to cut the draft page roughly in half. Default if no answer: leave cards as they are.
6. **5 in a Row:** the owner moved on to the progressive mode. Default: leave it hidden behind `?five=1`; delete later if
   unused.
7. **New animals' open questions** (musk ox herd, gaur, walrus — now live): musk ox only on the tundra, or also the forest at a
   low weight? The walrus won't leave its lake, so 4.5% of tundra-lake fights end "they gave up": acceptable as honest
   behaviour? Their signature moves are visible but barely move the numbers (the bodies carry the value): strengthen any
   only with a sourced reason (ideas: walrus stampede, gaur herd mobbing a tiger, lone-bull gaur).

## Decided
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
