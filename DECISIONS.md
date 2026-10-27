# Decisions waiting on the owner

Each item has a recommendation; reply with a number and "yes", or your own call. Decided items move to the bottom.

## Open
1. **Progressive mode: an extra premium enemy.** The other side gets one animal from the round's top price band that you
   can't buy. Recommendation: yes, from round 3 (needs a bigger top-up). Design: `research/progressive_mode.md`.
2. **Progressive mode: money.** A fixed top-up each round only, or plus a small per-kill bonus? Recommendation: fixed +
   $25 per kill, capped at $150 a round.
3. **Progressive mode replaces Migration** (switched off) rather than sitting beside it. Recommendation: replace.
4. **Personal stats screen** (per-animal kills, damage and win rates, per-map win rates, your nemesis, last games with
   replay links, achievements, a bestiary; local storage). Recommendation: build it.
5. **5 in a Row after playtest:** put it on the arena screen? One retry or two (the progressive mode has two)? Filter out
   boards that are too hard? Recommendation: two retries, keep raw boards for now, show it once you like it.
6. **A more fragile human** (open since the realism audit). Recommendation: leave as is; the underdog feel is already
   strong.
7. **Card bars ("Helps you" / "Threat if left")** are measured with small 3-animal base teams; full $1,200 teams flip
   giants' numbers. Recommendation: measure with full teams, the way players actually draft.
8. **Pick N and Migration code** (both switched off): delete or keep hidden behind URL flags? Recommendation: keep
   Migration's engine hooks for the progressive mode; delete Pick N's UI code.

## Decided
- Oct 27: progressive mode uses experience (XP and levels, capped, realistic), two retries per run; T. rex at most a
  final-round boss. Elephant is a rare; board total stays $2,600 (the player stays the underdog). Pick N switched off.
  Dailies use the local date. Musk ox herd, gaur and tundra-only walrus approved for building; smaller real dinosaurs
  welcome as candidates.
- Oct 26: Migration switched off until properly designed. Prices in $100 steps; the $50 tier deferred. Rares on 30% of
  boards. GCP for training; the launcher must fail gracefully.
