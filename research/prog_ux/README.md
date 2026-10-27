# Progressive mode UX pass (Oct 27, 2026)

Driven by the owner's first playthrough of `?progressive=1`. Feedback, in substance: heal costs are weird and it isn't clear
who needs healing or what the button does; selling a nearly dead animal is too easy; the formation step is pointless and
doesn't include my animals (so I can't ride my elephant); it isn't clear what "reset" does; it isn't clear what experience
does; no need to earn money at the end of the run; the end should show every animal of the run; and in general fewer taps,
more information in front of you, choices for how to do things.

**How it was checked.** `node research/prog_ux/walk.js <before|after> [index.html]` plays a whole run through the UI with
a fixed `Math.random` (same run in both phases) on a 412×915 phone, a 360×780 phone and a 1200×900 desktop: it buys the
cheapest cards, heals one wounded survivor, sells one, fights, skips to the result and continues, until the run ends.
It screenshots every step (`before/`, `after/`, `<device>_<nn>_<step>.png`) and counts taps (`metrics.json`;
`QUICK=1` taps "Fight now" instead of going through the formation, `metrics_quick.json`). `node research/prog_ux/check.js`
checks the fixes (carried elephant on the formation page and ridden by default, heal/sell buttons, two-tap sell and
abandon, no sideways scroll at 360 px, no page errors) on all three devices. `node research/ux_audit/modes_check.js`
passes with its progressive part updated to the new flow.

## Findings (before) and what changed

1. **Healing was opaque.** A flat "Heal $50" on any wound, health shown only as a thin unlabeled bar, nothing said what the
   free rest did or what pressing Heal would do. *Before:* `before/phone_07_shop_wounded.png`.
   **Now** each survivor card shows a bar **and %** per member (packs and herds: one per member, plus "1 of 4 lost"), a
   *Full health / Wounded / Badly hurt* flag, and a line saying what the rest did ("Came out of the last fight at 36%; the
   free rest healed it to 55%"). The button states result and cost: **"Heal to 100% · $25"**; if you can't afford it,
   "(need $X more)". After a tap, a status line says what happened ("Healed the Black Bear from 55% to 100% for $25. $540
   left."). With two or more wounded: **"Heal all 2 wounded · $35"**. *After:* `after/phone_06_shop_wounded.png`,
   `after/phone_07_shop_healed.png`.
2. **Selling a dying animal paid full half-price.** **Now** sale value scales with health, and an animal under 25% can't be
   sold (the button says so). Selling asks twice ("Tap again to sell · +$25"): it throws away the XP and level.
   *After:* `after/phone_08_shop_sell_confirm.png`.
3. **Formation bug and flow.** Root cause of "it doesn't include my animals / can't ride my elephant": the mount was chosen
   once, when the round opened, and never followed the team after that, so a giant bought in the shop left you **on
   foot**, and the mount picker listed only rideable animals (so the rest looked missing). **Now** the mount follows the
   team (carried survivors and this visit's buys: you ride your elephant by default) until you pick one yourself, and that
   pick sticks for the round (a retry keeps it). The formation page in a run shows a roster of your whole team with health
   and level, who's against you, and which mount you're on. The flow is **shop → Formation → Fight**: the shop's primary
   button is *Formation*; the fight launches from the formation page (auto formation and the best mount are already set, so
   it is one tap). A secondary **Fight now** in the shop skips the formation for players who don't care.
   *After:* `after/phone_03_formation.png`, `after/check_phone_formation_elephant.png` (a carried, wounded elephant, ridden).
4. **Unclear resets.** Every control now says what it does, and the destructive ones ask twice:
   - HUD "Abandon" → **Abandon run** → second tap "Tap again: end the run for good" (wears off after 4 s).
   - Steps-bar "Start over" (in a run it silently left the run) → **Leave run**, tooltip: the run stays saved, resume it
     from the arena.
   - Shop "Undo" on a fresh buy → **Return · +$100** (full refund, only for this visit's buys).
   - Arena "Start a run" while a run is saved (it silently replaced it) → **New run**, second tap "Tap again: replace your
     saved run (round N)". Same for *Daily run*.
   - HUD "Run" → **Run overview**. Formation bar "Auto" = auto formation (tooltip says it puts everyone back).
   - Loss banner "Back to the shop" → **Retry round N: to the shop**, and the banner text says what's restored.
5. **XP was a number with no meaning.** Each card now says the current level's effect in plain words ("Cunning: holds its
   nerve longer; a fallen packmate shakes it less; spots threats 15% farther"), and the bar says what's next and how far
   ("59/60 XP → Cunning: spots threats 15% farther"). A tap-to-expand **How XP and levels work** explains earning (damage,
   double when protecting you, kills, surviving, signature moves, MVP) and the three levels. The round recap lists what each
   animal earned its XP for ("Wild Boar +92 XP: 37 for fighting, 30 for 3 kills, 10 for its signature move, 10 as MVP, 5 for
   surviving · now Cunning: spots threats 15% farther").
6. **Too many screens.** "Start a run" now opens round 1's shop directly (a "How a run works" note is open on the first
   visit), a won round's banner goes straight to the next shop ("Round 3: to the shop"), and a resumed run opens in the
   shop. The shop's top panel carries what you need for the decision: the round's tier and board, the **premium enemy with
   its face** ("Premium enemy: Black Rhino ($200)"), the last fight's recap (open right after a fight), retry status; the HUD
   above it keeps round, map, money, retries and the team's health. The run overview (trail of 7 rounds) is one tap away.
7. **End of run.** The last round no longer awards kill money or a top-up (nothing left to buy). The end screen lists
   **every animal of the run** (alive, dead, fled, sold; buys refunded by a replayed round are folded away): how it left
   ("Died in round 3 to the Moose", "Sold before round 2 · $50") or a gold **★ Survivor** badge, rounds served, kills,
   damage (protecting you), level and XP, scars, MVPs. Survivors first, then by kills. *After:* `after/phone_19_end_summary.png`.

## Heal and sell rules (progressive.js, `PROG`)
- *Condition* of a pick = its members' health summed ÷ its group size (a wolf pack down to 2 of 4 at full health is 50%).
- **Heal to 100%** = price × `HEAL_RATE` (.55) × the share of health missing, rounded **up** to $5, at least $10
  (`HEAL_MIN`, `STEP`). Old rule: a flat 25% of the price (at least $50) for any wound. Examples: a $100 boar at 92% → $10;
  a $100 bear at 55% → $25; a $700 elephant at 55% → $175.
- **Sell** = price × `SELL_SHARE` (.5) × condition, rounded **down** to $5. Under 25% condition (`SELL_MIN`) it can't be sold.
  Old rule: half price whatever its state.
- Heal rate ≥ sell rate, so healing then selling never makes money. The free rest (30% of what's missing) is unchanged.
- Round 1 money is unchanged: $400 (whole $100s). Kill bonus stays $25.
- `HEAL_RATE` was set with the bot: .5 made runs easier than before (20.6% complete vs 15.8%), .6 harder (11.6%), .55 kept
  the old difficulty (the owner's rule: don't make it easier).

## Bot (`node progressive_bot.js 500 4 1`, same seeds; the bot heals any pick under 60% and never sells)
| Rules | Round 1 first-try | Run ends (median) | Complete |
|---|---|---|---|
| Before (flat 25% heal, min $50) | 81% | round 6 | 15.8% |
| Heal rate .5 | 81% | round 6 | 20.6% |
| Heal rate .6 | 81% | round 6 | 11.6% |
| **Heal rate .55 (adopted)** | **81%** | **round 6** | **14.4%** |
| Seeds 1001+, before → adopted | 82% → 82% | round 6 → 6 | 18.8% → 17.4% |
| Both seed sets pooled (1,000 runs), before → adopted | 81.5% → 81.5% | | 17.3% → 15.9% (± ~1.7) |

Round 6 (the herd premium) is still the wall (first-try 30% vs 32% before).

## Taps (core loop, from `metrics.json`)
| Step | Before | After |
|---|---|---|
| Start → round 1's shop | 2 (Start, To the shop) | **1** |
| One round, shop → fight → result → next shop (buys not counted) | 4 (To the shop, Fight, Skip, Continue); 6 through the formation (+ Formation, Release) | **4 through the formation** (Formation, Fight, Skip, Continue); **3** with Fight now |
| Ride the giant you just bought | 3 (Formation, tap the mount, Release), and only if you knew | **0 extra**: it's the default |
| Heal 3 wounded animals | 3 | **1** (Heal all) |
| Sell | 1 | 2 (on purpose: it asks) |
| Resume after a reload → shop | 1 (lands on the run hub) | **0** (lands in the shop) |

Whole scripted run (same purchases): 47 taps before, 49 after through the formation every round (it also visits the
formation and confirms the sale, which the before-run never did), 44 with Fight now. No sideways scroll at 360 px, no page
errors, on all three devices, before or after.

## Not changed
- sim.js (the formation bug was in the UI).
- The mode is still hidden behind `?progressive=1`.
- Retries, scars, XP rates, levels, top-ups, board totals.
