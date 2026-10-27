# Decisions waiting on the owner

Each item has a recommendation; reply with a number and "yes", or your own call. Decided items move to the bottom.

## Open
1. **Progressive mode: money.** A fixed top-up each round only, or plus a small per-kill bonus? Default if no answer:
   fixed + $25 per kill, capped at $150 a round (XP already rewards kills). Design: `research/progressive_mode.md`.
2. **Progressive mode replaces Migration** (switched off) rather than sitting beside it. Default if no answer: replace,
   reusing Migration's engine hooks.
3. **Personal stats screen** (per-animal kills, damage and win rates, per-map win rates, your nemesis, last games with
   replay links, achievements, a bestiary; local storage). Recommendation: build it.
4. **What replaces the Helps / Threat bars on the cards.** Options in the Oct 27 chat: signature move line, measured
   "good against / struggles against" counters, a role tag. Recommendation: signature + counters.
5. **5 in a Row:** the owner moved on to the progressive mode. Default: leave it hidden behind `?five=1`; delete later if
   unused.

## Decided
- Oct 27 (later): progressive mode adds one premium enemy (top price band, can't be bought) from round 3. The human
  stays as fragile as now. Pick N removed. The Helps / Threat bars go (replacement to pick).
- Oct 27: progressive mode uses experience (XP and levels, capped, realistic), two retries per run; T. rex at most a
  final-round boss. Elephant is a rare; board total stays $2,600 (the player stays the underdog). Pick N switched off.
  Dailies use the local date. Musk ox herd, gaur and tundra-only walrus approved for building; smaller real dinosaurs
  welcome as candidates.
- Oct 26: Migration switched off until properly designed. Prices in $100 steps; the $50 tier deferred. Rares on 30% of
  boards. GCP for training; the launcher must fail gracefully.
